#!/usr/bin/env node
// Keeps the local authoritative scene available when the Bevy preview process
// exits during a hot reload. The published scene uses Decentraland hosting.
const { spawn } = require('node:child_process')
const port = Number(process.argv[2] || 8000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Expected a preview port')

const realm = `http://localhost:${port}`
const packageName = '@dcl-regenesislabs/bevy-headless-server@0.1.0-36033403774.commit-19347eb'
let child
let timer
let stopping = false

async function previewAvailable() {
  try {
    const response = await fetch(`${realm}/about`, { signal: AbortSignal.timeout(3000) })
    return response.ok
  } catch { return false }
}

function later() {
  if (!stopping) timer = setTimeout(start, 3000)
}

async function start() {
  if (stopping) return
  if (!await previewAvailable()) { later(); return }
  console.log(`[Flight preview] connecting scoring server to ${realm}`)
  child = spawn('npx', ['--yes', packageName, `--realm=${realm}`, '--position=0,0'], {
    cwd: require('node:path').join(__dirname, '..'),
    env: { ...process.env, RUST_LOG: process.env.RUST_LOG || 'warn,scene_runner::renderer_context=info' },
    stdio: ['ignore', 'inherit', 'inherit']
  })
  child.once('error', error => console.error('[Flight preview] server launch failed:', error.message))
  child.once('exit', (code, signal) => {
    child = undefined
    if (!stopping) {
      console.warn(`[Flight preview] scoring server stopped (${signal || code}); reconnecting`)
      later()
    }
  })
}

function stop() {
  stopping = true
  clearTimeout(timer)
  child?.kill('SIGTERM')
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
void start()
