const { test } = require('node:test')
const assert = require('node:assert/strict')
const { DAILY_GOALS, rollRareOrb, utcOrbDay, dailyOrbProgress, recordDailyOrb } = require('../src/daily-orbs.ts')

test('rare orb spawn odds descend from blue to purple to rainbow', () => {
  const totals = { blue: 0, purple: 0, rainbow: 0, gold: 0 }
  for (let i = 0; i < 1000; i++) totals[rollRareOrb((i + .5) / 1000) ?? 'gold']++
  assert.deepEqual(totals, { blue: 150, purple: 50, rainbow: 10, gold: 790 })
})

test('daily progress survives a reload, rejects duplicate pickups, caps each tier and resets at midnight UTC', () => {
  const day = utcOrbDay(Date.parse('2026-11-04T23:59:59.999Z'))
  const progress = dailyOrbProgress(day)
  assert.equal(recordDailyOrb(progress, 'blue', 'first'), true)
  assert.equal(recordDailyOrb(progress, 'blue', 'first'), false)
  assert.equal(recordDailyOrb(progress, 'purple', 'first'), false)
  const reloaded = dailyOrbProgress(day, JSON.parse(JSON.stringify(progress)))
  assert.equal(reloaded.pickups.blue.length, 1)
  for (const [kind, goal] of Object.entries(DAILY_GOALS)) {
    for (let i = 0; i < goal + 2; i++) recordDailyOrb(reloaded, kind, kind + i)
    assert.equal(reloaded.pickups[kind].length, goal)
  }
  const nextDay = utcOrbDay(Date.parse('2026-11-05T00:00:00.000Z'))
  assert.deepEqual(dailyOrbProgress(nextDay, reloaded), { day: '2026-11-05', pickups: { blue: [], purple: [], rainbow: [] } })
})

test('daily server retries failed writes without awarding duplicate progress or mixing wallets', async () => {
  const fs = require('node:fs'), ts = require('typescript')
  const store = new Map(), replies = []
  let receive, fail = true
  const modules = {
    '@dcl/sdk/server': { Storage: { player: {
      get: async player => store.get(player),
      set: async (player, _key, value) => {
        if (fail) { fail = false; return false }
        store.set(player, value); return true
      }
    } } },
    './multiplayer-messages': { flightRoom: {
      onMessage: (_name, fn) => { receive = fn },
      send: async (_name, data, target) => replies.push({ ...data, target })
    } },
    './daily-orbs': require('../src/daily-orbs.ts')
  }
  const exports = {}
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync('src/daily-orb-server.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText)(name => modules[name], exports)
  exports.startDailyOrbServer()
  const request = { day: utcOrbDay(), kind: 'blue', id: 'example-1' }
  await receive(request, { from: 'WALLET-A' })
  assert.equal(replies.length, 0, 'failed storage must not acknowledge a pickup')
  await receive(request, { from: 'WALLET-A' })
  await receive(request, { from: 'WALLET-A' })
  assert.deepEqual(JSON.parse(replies.at(-1).payload).pickups.blue, ['example-1'])
  assert.deepEqual(replies.at(-1).target.to, ['WALLET-A'])
  await receive({ ...request, day: '2000-01-01' }, { from: 'WALLET-B' })
  assert.equal(JSON.parse(replies.at(-1).payload).pickups.blue.length, 0)
  assert.equal(replies.at(-1).player, 'wallet-b')
})

test('daily HUD counts pickups before identity or server readiness and reconciles without doubling', () => {
  const fs = require('node:fs'), ts = require('typescript')
  const requests = []
  let ready = false, receive
  const modules = {
    './multiplayer-messages': { flightRoom: {
      onMessage: (_name, fn) => { receive = fn },
      isReady: () => ready,
      send: (_name, data) => requests.push(data)
    } },
    './daily-orbs': require('../src/daily-orbs.ts')
  }
  const exports = {}
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync('src/daily-orb-client.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText)(name => modules[name], exports)
  const client = exports.createDailyOrbClient()
  const now = Date.parse('2026-11-04T12:00:00Z')
  client.update(now, '')
  client.collect('blue')
  client.collect('purple')
  client.collect('rainbow')
  assert.deepEqual(Object.values(client.progress.pickups).map(ids => ids.length), [1, 1, 1])
  client.update(now + 100, 'Wallet-A')
  assert.equal(requests.length, 0)
  ready = true
  client.update(now + 200, 'Wallet-A')
  assert.equal(requests[0].kind, 'blue')
  client.update(now + 1100, 'Wallet-A')
  assert.equal(requests[1].id, requests[0].id, 'retry sends the same pickup until saved')
  const payload = JSON.stringify({ day: utcOrbDay(now), pickups: { blue: ['saved-before', requests[0].id], purple: [], rainbow: [] } })
  receive({ player: 'wallet-a', payload })
  assert.deepEqual(Object.values(client.progress.pickups).map(ids => ids.length), [2, 1, 1])
  client.update(now + 2000, 'Wallet-A')
  assert.equal(requests.at(-1).kind, 'purple')
  client.update(now + 3000, 'Wallet-B')
  assert.deepEqual(Object.values(client.progress.pickups).map(ids => ids.length), [0, 0, 0])
  assert.equal(requests.at(-1).kind, '')
})
