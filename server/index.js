const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { emptyDb, validateResult, applyResult, snapshot } = require('./model')

// Reuses the existing small HTTP + JSON-file service. Old pop-score database is deliberately untouched.
function createServer({ dbPath = path.join(__dirname, 'vortex-v1.json'), now = Date.now } = {}) {
  const readDb = () => {
    if (!fs.existsSync(dbPath)) return emptyDb()
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    if (db.version !== 1 || !Array.isArray(db.players) || !Array.isArray(db.weeks)) throw new Error('Invalid database; restore backup')
    return db // Corruption fails closed; never silently replaces records with an empty file.
  }
  const writeDb = db => {
    fs.writeFileSync(dbPath + '.tmp', JSON.stringify(db, null, 2))
    fs.renameSync(dbPath + '.tmp', dbPath)
  }
  const send = (response, status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(data))
  }
  return http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') return send(response, 204, {})
      const url = new URL(request.url, 'http://localhost')
      if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true, version: 1 })
      if (request.method === 'GET' && url.pathname === '/v1/progress') {
        return send(response, 200, snapshot(readDb(), (url.searchParams.get('userId') || '').slice(0, 96), now()))
      }
      if (request.method === 'POST' && url.pathname === '/v1/results') {
        let body = '', size = 0
        for await (const chunk of request) {
          size += chunk.length
          if (size > 4096) return send(response, 413, { error: 'Body too large' })
          body += chunk.toString()
        }
        let parsed
        try { parsed = JSON.parse(body) } catch { return send(response, 400, { error: 'Invalid JSON' }) }
        const result = validateResult(parsed, now())
        if (!result) return send(response, 400, { error: 'Invalid result (completion must be within 24 hours)' })
        const db = applyResult(readDb(), result, now())
        writeDb(db)
        return send(response, 200, snapshot(db, result.userId, now()))
      }
      return send(response, 404, { error: 'Not found' })
    } catch (error) {
      console.error('Vortex service:', error.message)
      if (!response.headersSent) send(response, 500, { error: 'Records unavailable' })
    }
  })
}
if (require.main === module) {
  const port = Number(process.env.PORT || 8787)
  const host = process.env.HOST || '127.0.0.1'
  createServer({ dbPath: process.env.VORTEX_DB_PATH || undefined }).listen(port, host, () => {
    console.log(`Endless Vortex playtest records at http://${host}:${port} (client-reported, unauthenticated)`)
  })
}
module.exports = { createServer }
