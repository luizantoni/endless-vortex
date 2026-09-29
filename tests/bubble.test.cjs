const { test } = require('node:test')
const assert = require('node:assert/strict')
const { BUBBLES: B, BubbleLift, sweptBubbleContact } = require('../src/bubble-rules.ts')

test('swept bubble contact detects a pass even when both frame endpoints miss', () => {
  const bubble = { x: 0, y: 0, z: 0 }
  assert.equal(sweptBubbleContact({ x: -1.5, y: 0, z: 0 }, { x: 1.5, y: 0, z: 0 }, bubble, bubble), true)
  assert.equal(sweptBubbleContact(bubble, bubble, { x: -1.5, y: 0, z: 0 }, { x: 1.5, y: 0, z: 0 }), true)
  assert.equal(sweptBubbleContact({ x: -1.5, y: 0, z: 1.1 }, { x: 1.5, y: 0, z: 1.1 }, bubble, bubble), false)
})
test('bubble contact covers the avatar body, with real near misses rejected', () => {
  const player = { x: 0, y: 0, z: 0 }
  for (const y of [-1.45, 1.45]) {
    const bubble = { x: 0, y, z: 0 }
    assert.equal(sweptBubbleContact(player, player, bubble, bubble), true)
  }
  const high = { x: 0, y: 2.1, z: 0 }
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
