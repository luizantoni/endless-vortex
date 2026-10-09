const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Airtime, FloorContactLatch } = require('../src/airtime.ts')
const sample = (patch = {}) => ({ dt: 0.1, wallDt: 0.1, now: Date.parse('2026-09-08T12:00:00Z'),
  inside: true, connected: true, floor: false, supported: false, moved: true, teleported: false, ...patch })

test('airtime runs, platform pauses, departure resumes, floor-pad contact resets exactly once', () => {
  const run = new Airtime()
  run.update(sample({ floor: true })); assert.equal(run.phase, 'ready')
  run.update(sample()); run.update(sample()); assert.equal(run.milliseconds, 100)
  run.update(sample({ supported: true }))
  for (let i = 0; i < 50; i++) run.update(sample({ supported: true }))
  assert.equal(run.phase, 'paused'); assert.equal(run.milliseconds, 100)
  run.update(sample()); run.update(sample()); assert.equal(run.milliseconds, 200)
  assert.equal(run.update(sample({ floor: true })), true)
  assert.equal(run.phase, 'finished'); assert.equal(run.milliseconds, 0)
  assert.equal(run.update(sample({ floor: true })), false)
  run.update(sample()); assert.equal(run.phase, 'airborne'); assert.equal(run.milliseconds, 0)
  assert.equal(run.reason, 'Airborne')
  const nextRun = new Airtime()
  nextRun.update(sample()); nextRun.update(sample()); nextRun.update(sample())
  assert.equal(nextRun.update(sample({ floor: true })), true)
  assert.equal(nextRun.reason, 'Finished · floor pad · move to restart')
})
test('one-frame reset-pad contact is latched until the airtime sample consumes it', () => {
  const run = new Airtime(), contact = new FloorContactLatch()
  run.update(sample()); run.update(sample()); run.update(sample())
  assert.equal(run.milliseconds, 200)
  contact.record(true) // contact lasted only one rendered frame
  contact.record(false) // avatar has already bounced away before the next timer sample
  assert.equal(run.update(sample({ floor: contact.consume() })), true)
  assert.equal(run.milliseconds, 0)
  assert.equal(contact.consume(), false, 'the same touch only resets once')
})
test('standing, lost focus and app suspension add no time; floor-pad contact rearms interrupted run', () => {
  const run = new Airtime()
  run.update(sample()); run.update(sample())
  run.update(sample({ moved: false })); assert.equal(run.milliseconds, 100)
  run.update(sample({ focused: false })); assert.equal(run.milliseconds, 100)
  assert.equal(run.update(sample({ wallDt: 30 })), true)
  assert.equal(run.milliseconds, 100)
  run.update(sample()); assert.equal(run.phase, 'finished')
  run.update(sample({ floor: true })); assert.equal(run.milliseconds, 0)
  run.update(sample()); assert.equal(run.phase, 'airborne'); assert.equal(run.milliseconds, 0)
})
test('startup gaps, missing player samples and spawn teleports cannot disarm a not-yet-started mobile run', () => {
  const run = new Airtime()
  run.update(sample({ connected: false })) // avatar transform is not ready yet
  run.update(sample({ dt: 1.2, wallDt: 1.2 })) // slow first client frame
  run.update(sample({ teleported: true })) // initial spawn placement
  assert.equal(run.phase, 'ready')
  run.update(sample())
  assert.equal(run.phase, 'airborne')
  run.update(sample())
  assert.equal(run.milliseconds, 100)
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
