const { test } = require('node:test')
const assert = require('node:assert/strict')
const { advance, newAttempt, bubbleImpulse, pushImpulse, dayKey, weekKey, windForce, speedCorrection, milliseconds } = require('../src/rules.ts')
const { createCourse, phaseAt, safeSpawn, SLOTS, intervalAt } = require('../src/course.ts')
const { TUNING: T } = require('../src/tuning.ts')
const now = Date.parse('2026-09-08T12:00:00Z')
const sample = overrides => ({ dt: 0.1, wallDt: 0.1, now, connected: true, focused: true, inside: true,
  floor: false, launch: false, supported: false, moved: true, teleported: false, ...overrides })
function airborne() { const run = newAttempt(); advance(run, sample()); return run }
function tick(run, count, overrides) { for (let i = 0; i < count; i++) advance(run, sample(overrides)) }
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`) }

test('launch wait → airborne seconds → rest → resume → floor → replay', () => {
  let run = newAttempt()
  tick(run, 100, { launch: true, supported: true, moved: false })
  assert.equal(run.airtime, 0); assert.equal(run.phase, 'ready')
  advance(run, sample()); tick(run, 20)
  near(run.airtime, 2)
  advance(run, sample({ supported: true })); tick(run, 100, { supported: true })
  assert.equal(run.phase, 'paused'); near(run.airtime, 2); assert.ok(run.elapsed > 12)
  advance(run, sample()); tick(run, 10); near(run.airtime, 3)
  advance(run, sample({ floor: true })); tick(run, 100)
  assert.equal(run.phase, 'finished'); near(run.airtime, 3)
  run = newAttempt(); assert.equal(run.airtime, 0); assert.equal(run.phase, 'ready')
})
test('a long flight has no fixed run duration or difficulty-driven timeout', () => {
  const run = airborne(); tick(run, 10000); near(run.airtime, 1000); assert.equal(run.phase, 'airborne')
})
for (const [name, invalid] of Object.entries({ disconnect: { connected: false }, pause: { focused: false },
  wallGap: { wallDt: 10 }, simulationGap: { dt: 10 }, clockRollback: { wallDt: -1 },
  badDelta: { dt: NaN }, teleport: { teleported: true }, escape: { inside: false } })) {
  test(`${name} ends only prior observed airtime, without catch-up`, () => {
    const run = airborne(); tick(run, 5); const earned = run.airtime
    advance(run, sample(invalid)); assert.equal(run.phase, 'finished'); assert.equal(run.airtime, earned)
    tick(run, 50); assert.equal(run.airtime, earned)
  })
}
test('stationary hovering and frozen transforms never award time; stall ends run', () => {
  const run = airborne(); tick(run, 25, { moved: false })
  assert.equal(run.airtime, 0); assert.equal(run.phase, 'finished')
})
test('simulation cannot outrun the observation wall clock', () => {
  const run = airborne(); tick(run, 10, { dt: 0.2, wallDt: 0.1 }); near(run.airtime, 1)
})
test('separate players cannot affect each other through replay, pickup, pause or reconnect', () => {
  let a = airborne(); const b = airborne()
  tick(a, 5); tick(b, 8); const before = structuredClone(b)
  bubbleImpulse(a, 0, 10); pushImpulse(a, 1); advance(a, sample({ connected: false })); a = newAttempt()
  assert.deepEqual(b, before); assert.equal(a.airtime, 0)
})
test('bubble lift is capped, cooldown is run-wide, and airtime never changes', () => {
  const run = airborne(); tick(run, 10); const earned = run.airtime
  near(bubbleImpulse(run, 3.5, 10), 0.5)
  assert.equal(bubbleImpulse(run, 0, 10), 0)
  tick(run, 7); assert.equal(bubbleImpulse(run, 4, 10), 0)
  assert.equal(bubbleImpulse(run, 0, 19), 0)
  assert.equal(bubbleImpulse(run, -6, 10), T.bubbles.liftImpulse)
  near(run.airtime, earned + 0.7)
  run.phase = 'paused'; run.elapsed += 10; assert.equal(bubbleImpulse(run, 0, 10), 0)
})
test('push is one capped impulse per cooldown and cannot accelerate beyond descent target', () => {
  const run = airborne()
  assert.equal(pushImpulse(run, 1), -3); assert.equal(pushImpulse(run, 1), 0)
  tick(run, 16); assert.equal(pushImpulse(run, -7), -1)
  tick(run, 16); assert.equal(pushImpulse(run, -8), -0)
  run.phase = 'finished'; assert.equal(pushImpulse(run, 0), 0)
})
test('daily midnight seed stays pinned across reset; new attempt gets new day', () => {
  const run = newAttempt()
  advance(run, sample({ now: Date.parse('2026-09-08T23:59:59.950Z') }))
  advance(run, sample({ now: Date.parse('2026-09-09T00:00:00.050Z') }))
  assert.equal(run.day, '2026-09-08')
  const fresh = newAttempt(); advance(fresh, sample({ now: Date.parse('2026-09-09T00:00:00.050Z') }))
  assert.equal(fresh.day, '2026-09-09')
})
test('UTC Monday weekly reset, year boundary and leap day', () => {
  assert.equal(weekKey(Date.parse('2026-09-06T23:59:59.999Z')), '2026-08-31')
  assert.equal(weekKey(Date.parse('2026-09-07T00:00:00Z')), '2026-09-07')
  assert.equal(weekKey(Date.parse('2027-01-01T00:00:00Z')), '2026-12-28')
  assert.equal(dayKey(Date.parse('2028-02-29T23:59:59Z')), '2028-02-29')
})
test('daily sequence is deterministic, varied, bounded and unaffected by skipped events', () => {
  const a = createCourse('2026-09-08'), b = createCourse('2026-09-08'), c = createCourse('2026-09-09')
  const plans = Array.from({ length: 500 }, a)
  for (let i = 1; i < plans.length; i++) assert.ok(plans[i].at - plans[i - 1].at >= T.platforms.minInterval - 1e-10)
  assert.deepEqual(plans, Array.from({ length: 500 }, b))
  assert.notDeepEqual(plans, Array.from({ length: 500 }, c))
  assert.equal(new Set(plans.map(p => p.kind)).size, 2)
  for (const plan of plans) {
    assert.ok(plan.slot >= 0 && plan.slot < SLOTS.length)
    if (plan.kind === 'push') assert.ok(SLOTS[plan.slot].y >= T.platforms.minPushY)
  }
  assert.equal(intervalAt(1000), T.platforms.minInterval)
  assert.equal(intervalAt(0), T.platforms.initialInterval)
})
test('spawn suppression respects player clearance, prediction, spacing, floor safety and entity cap', () => {
  const plan = { index: 0, at: 0, kind: 'landing', slot: 0 }, zero = { x: 0, y: 0, z: 0 }
  const far = { x: 24, y: 14, z: 24 }
  assert.equal(safeSpawn(plan, far, zero, []), true)
  assert.equal(safeSpawn(plan, SLOTS[0], zero, []), false)
  assert.equal(safeSpawn(plan, far, zero, [plan]), false)
  assert.equal(safeSpawn(plan, far, zero, [plan, plan, plan]), false)
  assert.equal(safeSpawn({ ...plan, kind: 'push' }, far, zero, []), false)
  assert.equal(safeSpawn({ ...plan, kind: 'push', slot: 3 }, { ...far, y: 2 }, zero, []), false)
  const toward = { x: (SLOTS[0].x - far.x) / T.platforms.warning,
    y: (SLOTS[0].y - far.y) / T.platforms.warning, z: (SLOTS[0].z - far.z) / T.platforms.warning }
  assert.equal(safeSpawn(plan, far, toward, []), false)
})
test('warn before activation, warn before expiry, then remove collision before fade', () => {
  const p = { at: 2 }
  assert.equal(phaseAt(p, 2), 'warning')
  assert.equal(phaseAt(p, 2 + T.platforms.warning + 0.01), 'active')
  assert.equal(phaseAt(p, 2 + T.platforms.warning + T.platforms.lifetime - 0.1), 'expiring')
  assert.equal(phaseAt(p, 2 + T.platforms.warning + T.platforms.lifetime + 0.1), 'fade')
  assert.equal(phaseAt(p, 20), 'gone')
})
test('bounded wind brakes ceiling ascent, fast descent and horizontal escape', () => {
  const up = windForce({ x: 16, y: 20, z: 16 }, { x: 0, y: 10, z: 0 }); assert.ok(up.y < 0)
  const down = windForce({ x: 16, y: 10, z: 16 }, { x: 0, y: -15, z: 0 }); assert.ok(down.y > 0)
  const edge = windForce({ x: 25.5, y: 10, z: 16 }, { x: 20, y: 0, z: 0 }); assert.ok(edge.x < 0)
  for (const force of [up, down, edge]) for (const value of Object.values(force)) assert.ok(Math.abs(value) <= T.movement.maxForce)
})
test('velocity corrections target configured speed bounds without changing in-range motion', () => {
  assert.deepEqual(speedCorrection({ x: 1, y: 1, z: 1 }), { x: 0, y: 0, z: 0 })
  const velocity = { x: 12, y: 10, z: 9 }, delta = speedCorrection(velocity)
  near(Math.hypot(velocity.x + delta.x, velocity.z + delta.z), T.movement.maxHorizontal)
  near(velocity.y + delta.y, T.movement.maxUp)
  assert.equal(speedCorrection({ x: 0, y: -20, z: 0 }).y, 12)
})
test('horizontal ceiling circling cannot sustain an indefinite run', () => {
  const run = airborne(); tick(run, 31, { atCeiling: true, moved: true })
  assert.equal(run.phase, 'finished'); assert.ok(run.airtime < T.movement.ceilingLimit)
})
test('millisecond ranking does not lose a millisecond to binary floating point', () => {
  const run = airborne(); tick(run, 10)
  assert.equal(milliseconds(run.airtime), 1000)
  assert.equal(milliseconds(1.0009), 1000)
})
