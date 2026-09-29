const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createServer } = require('../server/index.js')
const { emptyDb, applyResult, snapshot, validateResult, weekKey } = require('../server/model.js')
const fetchHttp = global.fetch // Capture native fetch before other fixtures temporarily stub it.
const now = Date.parse('2026-09-08T12:00:00Z')
const result = (userId, airtimeMs, at = now) => ({ userId, name: userId, airtimeMs, day: new Date(at - airtimeMs).toISOString().slice(0, 10), finishedAt: at })

test('weekly airtime ties share rank; lifetime records below top ten are retained', () => {
  const db = emptyDb()
  for (let i = 0; i < 12; i++) applyResult(db, result(`p${i}`, 10000 + i * 1000), now)
  applyResult(db, result('tie', 21000), now)
  const data = snapshot(db, 'p0', now)
  assert.equal(data.bestMs, 10000); assert.equal(data.rows.length, 10)
  assert.deepEqual(data.rows.slice(0, 3).map(row => row.rank), [1, 1, 3])
})
test('Monday clears current standings only; crossing attempt belongs to completion week', () => {
  const before = Date.parse('2026-09-06T23:59:59Z'), after = Date.parse('2026-09-07T00:00:30Z'), db = emptyDb()
  applyResult(db, result('a', 60000, before), before)
  assert.equal(snapshot(db, 'a', after).rows.length, 0)
  assert.equal(snapshot(db, 'a', after).bestMs, 60000)
  assert.deepEqual(snapshot(db, 'a', after).medals, [true, true, true])
  applyResult(db, result('a', 40000, after), after)
  assert.equal(snapshot(db, 'a', after).rows[0].airtimeMs, 40000)
  assert.equal(snapshot(db, 'a', after).bestMs, 60000)
  assert.equal(weekKey(after), '2026-09-07')
})
test('retry after reset credits original completion week and is idempotent', () => {
  const before = Date.parse('2026-09-06T23:59:59Z'), after = before + 60000, db = emptyDb(), value = result('a', 20000, before)
  applyResult(db, value, after); applyResult(db, value, after)
  assert.equal(snapshot(db, 'a', after).rows.length, 0); assert.equal(db.players.length, 1)
  assert.equal(db.weeks[0].rows.length, 1)
})
test('bad scores, malformed days and stale/future completions are rejected', () => {
  for (const airtimeMs of [NaN, Infinity, -1, 0, 2.5, Number.MAX_SAFE_INTEGER]) assert.equal(validateResult({ ...result('a', 20), airtimeMs }, now), null)
  for (const day of ['2026-99-99', '2026-02-30', '', '2027-01-01']) assert.equal(validateResult({ ...result('a', 20), day }, now), null)
  assert.equal(validateResult(result('a', 20, now - 86400001), now), null)
  assert.equal(validateResult(result('a', 20, now + 6000), now), null)
  assert.ok(validateResult(result('a', 60000), now))
})
test('real HTTP service persists across restart, isolates users and fails closed on corrupt disk', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vortex-test-'))
  const dbPath = path.join(directory, 'records.json')
  let server
  const start = async () => {
    server = createServer({ dbPath, now: () => now })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${server.address().port}`
  }
  const stop = () => new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
  try {
    let base = await start()
    const post = async body => fetchHttp(`${base}/v1/results`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    assert.equal((await post('{broken')).status, 400)
    const responses = await Promise.all([post(JSON.stringify(result('a', 31000))), post(JSON.stringify(result('b', 24000)))])
    assert.deepEqual(responses.map(response => response.status), [200, 200])
    assert.equal((await post(' '.repeat(5000))).status, 413)
    assert.equal((await fetchHttp(`${base}/leaderboards/coins`)).status, 404)
    await stop(); base = await start()
    const a = await (await fetchHttp(`${base}/v1/progress?userId=a`)).json()
    const b = await (await fetchHttp(`${base}/v1/progress?userId=b`)).json()
    assert.equal(a.bestMs, 31000); assert.equal(b.bestMs, 24000)
    fs.writeFileSync(dbPath, '{corrupt')
    assert.equal((await post(JSON.stringify(result('a', 32000)))).status, 500)
    assert.equal(fs.readFileSync(dbPath, 'utf8'), '{corrupt')
  } finally {
    if (server?.listening) await stop()
    // Exact fixture files only; no recursive filesystem operations.
    for (const file of [dbPath, dbPath + '.tmp']) if (fs.existsSync(file)) fs.unlinkSync(file)
    fs.rmdirSync(directory)
  }
})
