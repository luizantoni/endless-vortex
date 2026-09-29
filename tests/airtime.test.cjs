const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Airtime } = require('../src/airtime.ts')
const sample = (patch = {}) => ({ dt: 0.1, wallDt: 0.1, now: Date.parse('2026-09-08T12:00:00Z'),
  inside: true, connected: true, floor: false, supported: false, moved: true, teleported: false, ...patch })

test('airtime runs, platform pauses, departure resumes, floor finishes exactly once', () => {
  const run = new Airtime()
  run.update(sample({ floor: true })); assert.equal(run.phase, 'ready')
  run.update(sample()); run.update(sample()); assert.equal(run.milliseconds, 100)
  run.update(sample({ supported: true }))
  for (let i = 0; i < 50; i++) run.update(sample({ supported: true }))
  assert.equal(run.phase, 'paused'); assert.equal(run.milliseconds, 100)
  run.update(sample()); run.update(sample()); assert.equal(run.milliseconds, 200)
  assert.equal(run.update(sample({ floor: true })), true)
  assert.equal(run.phase, 'finished'); assert.equal(run.milliseconds, 200)
  assert.equal(run.update(sample({ floor: true })), false)
  run.update(sample()); assert.equal(run.phase, 'airborne'); assert.equal(run.milliseconds, 0)
})
test('standing, lost focus and app suspension add no time; interruption requires a landing', () => {
  const run = new Airtime()
  run.update(sample()); run.update(sample())
  run.update(sample({ moved: false })); assert.equal(run.milliseconds, 100)
  run.update(sample({ focused: false })); assert.equal(run.milliseconds, 100)
  assert.equal(run.update(sample({ wallDt: 30 })), true)
  assert.equal(run.milliseconds, 100)
  run.update(sample()); assert.equal(run.phase, 'finished')
  run.update(sample({ floor: true })); run.update(sample()); assert.equal(run.milliseconds, 0)
})
test('leaving the arena pauses and re-entry resumes without crediting outside time', () => {
  const run = new Airtime()
  run.update(sample()); run.update(sample()); assert.equal(run.milliseconds, 100)
  run.update(sample({ inside: false })); assert.equal(run.phase, 'paused')
  for (let i = 0; i < 5; i++) run.update(sample({ inside: false }))
  assert.equal(run.milliseconds, 100)
  run.update(sample({ inside: true })); assert.equal(run.phase, 'airborne')
  assert.equal(run.milliseconds, 100, 'the re-entry sample is discarded')
  run.update(sample({ inside: true })); assert.equal(run.milliseconds, 200)
})
test('disconnect and unexpected teleport interrupt only the affected player', () => {
  for (const event of [{ connected: false }, { teleported: true }]) {
    const a = new Airtime(), b = new Airtime()
    a.update(sample()); b.update(sample()); a.update(sample()); b.update(sample())
    a.update(sample(event)); b.update(sample())
    assert.equal(a.phase, 'finished'); assert.equal(a.milliseconds, 100)
    assert.equal(b.phase, 'airborne'); assert.equal(b.milliseconds, 200)
  }
})
test('only observed seconds count at different frame rates; midnight keeps starting day', () => {
  for (const hz of [20, 30, 60]) {
    const run = new Airtime()
    run.update(sample({ now: Date.parse('2026-09-08T23:59:59Z') }))
    for (let i = 0; i < hz * 2; i++) run.update(sample({ dt: 1 / hz, wallDt: 1 / hz,
      now: Date.parse('2026-09-09T00:00:01Z') }))
    assert.equal(run.milliseconds, 2000); assert.equal(run.day, '2026-09-08')
  }
})
