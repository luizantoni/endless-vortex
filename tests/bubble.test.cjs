const { ARENA, BUILD_SCALE } = require('../src/arena.ts')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { BUBBLES: B, BubbleLift, goldenVortexCelebrationPoint, goldenVortexOrbitPoint,
  goldenVortexParticlePoint, sweptBubbleContact } = require('../src/bubble-rules.ts')
const {ORB_REWARD,orbsSinceReset}=require('../src/orb-reward.ts')

test('golden pickup glitter spirals inward and rises into the vortex', () => {
  const origin = { x: ARENA.center.x + 16 * BUILD_SCALE, y: 8 * BUILD_SCALE, z: ARENA.center.z }, angle = 0
  const burstEdge = goldenVortexParticlePoint(origin, angle, 0.2, B.particleBurstSpeedMax,
    B.particleRadialSpeedMin, 2, 0.7, 0, B.particleBurstDuration)
  assert.ok(Math.hypot(burstEdge.x - origin.x, burstEdge.y - origin.y, burstEdge.z - origin.z) > 5,
    'pickup burst sprays several metres across the view')
  const start = goldenVortexParticlePoint(origin, angle, 0, B.particleBurstSpeedMax,
    B.particleRadialSpeedMin, 2, 0.7, 0, B.particleBurstDuration)
  const later = goldenVortexParticlePoint(origin, angle, 0, B.particleBurstSpeedMax,
    B.particleRadialSpeedMin, 0.8, 0.7, 0, 1.8)
  assert.ok(Math.hypot(later.x - ARENA.center.x, later.z - ARENA.center.z) < Math.hypot(start.x - ARENA.center.x, start.z - ARENA.center.z))
  assert.ok(later.y > start.y)
  assert.ok(B.particleCount >= B.particlesPerPop && B.particlesPerPop >= 48 && B.particleLifetime >= 3)
  assert.ok(B.particleBurstDuration >= 0.6, 'the wide spray moves in gentle slow motion')
})

test('five sphere cohorts accumulate as a bounded tangent orbit around the vortex center', () => {
  assert.equal(B.accumulationEvery * B.accumulationPerPop, B.accumulationCapacity)
  const origin = { x: ARENA.center.x + 14 * BUILD_SCALE, y: 9 * BUILD_SCALE, z: ARENA.center.z }
  const approaching = goldenVortexOrbitPoint(origin, 0, B.accumulationRadius, 5, 0, B.accumulationTravel)
  const later = goldenVortexOrbitPoint(origin, 0, B.accumulationRadius, 5, 0, B.accumulationTravel + 0.8)
  assert.ok(Math.abs(Math.hypot(approaching.x - ARENA.center.x, approaching.z - ARENA.center.z) - B.accumulationRadius) < 1e-9)
  assert.ok(Math.abs(Math.hypot(later.x - ARENA.center.x, later.z - ARENA.center.z) - B.accumulationRadius) < 1e-9)
  assert.notEqual(later.x, approaching.x, 'the motes keep moving tangentially after reaching the ring')
  assert.ok(B.accumulationCapacity + B.particlesPerPop <= B.particleCount,
    'orbiting and pickup spray fit in the fixed particle budget')
})

test('ten-orb celebration fills and circles the upper vortex cylinder for three seconds', () => {
  assert.equal(B.rewardExplosionLifetime, 3.2)
  for (let i = 0; i < B.particleCount; i++) {
    const a = goldenVortexCelebrationPoint(i, 0.6)
    const b = goldenVortexCelebrationPoint(i, 1.1)
    const radius = Math.hypot(a.x - ARENA.center.x, a.z - ARENA.center.z)
    assert.ok(radius >= B.rewardExplosionMinRadius - 1e-9 && radius <= B.rewardExplosionMaxRadius + 1e-9)
    assert.ok(a.y > 14 * BUILD_SCALE && a.y < ARENA.height, 'particles stay in the upper half and below the scene ceiling')
    assert.ok(Math.hypot(b.x - a.x, b.z - a.z) > 0.1, 'particles continue circling around the vortex axis')
  }
})

test('orb progress starts a fresh five-pickup cycle whenever a flight score resets',()=>{
  assert.equal(ORB_REWARD.every,5)
  assert.equal(orbsSinceReset(4,0),4)
  assert.equal(orbsSinceReset(5,0),5)
  assert.equal(orbsSinceReset(9,0),5)
  assert.equal(orbsSinceReset(9,9),0)
  assert.equal(orbsSinceReset(12,9),3)
  assert.equal(orbsSinceReset(19,9),ORB_REWARD.every)
  assert.equal(orbsSinceReset(19,19),0)
})

test('swept bubble contact detects a pass even when both frame endpoints miss', () => {
  assert.equal(B.contactRadius, 1.6 * BUILD_SCALE)
  const edge=B.contactRadius+.2
  const bubble = { x: 0, y: 0, z: 0 }
  assert.equal(sweptBubbleContact({ x: -edge, y: 0, z: 0 }, { x: edge, y: 0, z: 0 }, bubble, bubble), true)
  assert.equal(sweptBubbleContact(bubble, bubble, { x: -edge, y: 0, z: 0 }, { x: edge, y: 0, z: 0 }), true)
  assert.equal(sweptBubbleContact({ x: -1.5, y: 0, z: B.contactRadius + .2 }, { x: 1.5, y: 0, z: B.contactRadius + .2 }, bubble, bubble), false)
})
test('bubble contact covers the avatar body, with real near misses rejected', () => {
  const player = { x: 0, y: 0, z: 0 }
  for (const y of [-1.45, 1.45]) {
    const bubble = { x: 0, y, z: 0 }
    assert.equal(sweptBubbleContact(player, player, bubble, bubble), true)
  }
  const high = { x: 0, y: B.contactRadius + B.capsuleHalfHeight + .2, z: 0 }
  assert.equal(sweptBubbleContact(player, player, high, high), false)
  assert.equal(sweptBubbleContact(player, player, { x: NaN, y: 0, z: 0 }, high), false)
})

test('bubble lift is small, weaker on mobile, and capped against observed upward velocity', () => {
  assert.equal(new BubbleLift().pop(0, -5, false), 1.2)
  assert.equal(new BubbleLift().pop(0, -5, true), 0.7)
  assert.ok(Math.abs(new BubbleLift().pop(0, 2.8, false) - 0.2) < 1e-9)
  assert.equal(new BubbleLift().pop(0, 3, false), 0)
  assert.equal(new BubbleLift().pop(0, 10, true), 0)
  assert.equal(new BubbleLift().pop(0, NaN, false), undefined)
})
test('rapid pickups share one cooldown per player; another player has independent lift', () => {
  const a = new BubbleLift(), b = new BubbleLift()
  assert.equal(a.pop(0, 0, false), B.desktopImpulse)
  assert.equal(a.pop(0, 0, false), undefined)
  assert.equal(a.pop(0.79, 0, false), undefined)
  assert.equal(b.pop(0.1, 0, false), B.desktopImpulse)
  assert.equal(a.pop(0.8, 0, false), B.desktopImpulse)
  assert.equal(b.pop(0.8, 0, false), undefined)
})
