const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Progress } = require('../src/progress.ts')

test('replay and Monday rollover preserve PB and earned medals', () => {
  const p = new Progress(''); p.identify('a', 'Alice')
  p.record(35000, '2026-09-06', Date.parse('2026-09-06T23:59:59Z'))
  p.rollover(Date.parse('2026-09-07T00:00:00Z'))
  assert.equal(p.bestMs, 35000); assert.deepEqual(p.medals, [true, true, false]); assert.deepEqual(p.rows, [])
})
test('late response from old identity cannot import its records into the new player', async () => {
  const realFetch = global.fetch
  let resolve
  global.fetch = () => new Promise(r => { resolve = r })
  try {
    const p = new Progress('http://test'); p.identify('a', 'Alice')
    const work = p.sync(); p.identify('b', 'Bob')
    resolve({ ok: true, json: async () => ({ bestMs: 999000, medals: [true, true, true], week: '2026-09-07', rows: [] }) })
    await work
    assert.equal(p.bestMs, 0); assert.deepEqual(p.medals, [false, false, false])
  } finally { global.fetch = realFetch }
})
test('offline writes retain session records and retry only the per-week maximum', async () => {
  const realFetch = global.fetch, bodies = []
  global.fetch = async () => { throw new Error('offline') }
  try {
    const p = new Progress('http://test'); p.identify('a', 'Alice')
    p.record(20000, '2026-09-08', Date.parse('2026-09-08T12:00:00Z'))
    await new Promise(r => setImmediate(r))
    p.record(25000, '2026-09-08', Date.parse('2026-09-08T12:01:00Z'))
    await new Promise(r => setImmediate(r))
    assert.equal(p.bestMs, 25000); assert.match(p.status, /offline/)
    global.fetch = async (url, init) => {
      if (init?.method === 'POST') bodies.push(JSON.parse(init.body))
      return { ok: true, json: async () => ({ bestMs: 25000, medals: [true, false, false], week: '2026-09-07', rows: [] }) }
    }
    await p.sync(); assert.equal(bodies.length, 1); assert.equal(bodies[0].airtimeMs, 25000)
  } finally { global.fetch = realFetch }
})
test('delayed old-week response cannot restore expired standings after midnight', async () => {
  const realFetch = global.fetch, realNow = Date.now
  let resolve, now = Date.parse('2026-09-06T23:59:59Z')
  Date.now = () => now
  global.fetch = () => new Promise(r => { resolve = r })
  try {
    const p = new Progress('http://test'); p.identify('a', 'Alice')
    const work = p.sync(); now = Date.parse('2026-09-07T00:00:01Z'); p.rollover(now)
    resolve({ ok: true, json: async () => ({ bestMs: 60000, medals: [true, true, true], week: '2026-08-31',
      rows: [{ name: 'Alice', userId: 'a', airtimeMs: 60000, rank: 1 }] }) })
    await work
    assert.equal(p.week, '2026-09-07'); assert.deepEqual(p.rows, []); assert.equal(p.bestMs, 60000)
  } finally { global.fetch = realFetch; Date.now = realNow }
})
