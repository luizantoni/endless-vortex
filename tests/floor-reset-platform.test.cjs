const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

test('the 0.01 cm floor trigger has no solid collider and only latches local-player contact', () => {
  const transforms = new Map(), triggers = new Map()
  let onEnter
  let nextEntity = 1
  const player = 0
  const ecs = {
    ColliderLayer: { CL_PLAYER: 4 },
    engine: { PlayerEntity: player, addEntity: () => nextEntity++ },
    Transform: { create: (entity, value) => transforms.set(entity, value) },
    TriggerArea: { setBox: (entity, layer) => triggers.set(entity, layer) },
    triggerAreaEventsSystem: { onTriggerEnter: (entity, callback) => { onEnter = callback; triggers.set('eventEntity', entity) } }
  }
  const math = { Vector3: { create: (x, y, z) => ({ x, y, z }) } }
  const originalLoad = Module._load
  Module._load = function(request, parent, isMain) {
    if (request === '@dcl/sdk/ecs') return ecs
    if (request === '@dcl/sdk/math') return math
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    delete require.cache[require.resolve('../src/floor-reset-platform.ts')]
    const { ARENA } = require('../src/arena.ts')
    const { FLOOR_RESET_PLATFORM, createFloorResetPlatform, crossedLocalPlayerResetPlane } = require('../src/floor-reset-platform.ts')
    const { entity, consumeContact } = createFloorResetPlatform()
    const transform = transforms.get(entity)
    assert.equal(FLOOR_RESET_PLATFORM.surfaceOffset, 0.0001)
    assert.equal(transform.position.y, ARENA.floorTop + 0.0001)
    assert.equal(transform.scale.y, 0.0001)
    assert.equal(triggers.get(entity), 4)
    assert.equal(triggers.get('eventEntity'), entity)
    const plane = ARENA.floorTop + FLOOR_RESET_PLATFORM.surfaceOffset
    const crossing = (feetBefore, feetAfter, x = ARENA.center.x, z = ARENA.center.z) => crossedLocalPlayerResetPlane(
      { x, y: feetBefore + 0.88, z }, { x, y: feetAfter + 0.88, z }, 0.88)
    assert.equal(crossing(plane + 0.1, plane), true,
      'the local feet crossing the exact plane ends the attempt if mobile misses its trigger event')
    assert.equal(crossing(plane + 0.2, plane + 0.1), false,
      'falling near the floor does not reset before contact')
    assert.equal(crossing(plane - 0.1, plane - 0.1), false,
      'being below the plane without crossing does not repeatedly reset')
    assert.equal(crossing(plane - 0.1, plane + 0.1), false,
      'rising away from the floor does not reset')
    assert.equal(crossing(plane + 0.1, plane, ARENA.size + 2, ARENA.size + 2), false,
      'a plane crossing outside the arena cannot end the attempt')
    assert.equal(consumeContact(), false)
    onEnter({ trigger: { entity: player + 1 } })
    assert.equal(consumeContact(), false, 'another player cannot reset the local attempt')
    onEnter({ trigger: { entity: player } })
    assert.equal(consumeContact(), true, 'local feet contact with the trigger resets the attempt')
    assert.equal(consumeContact(), false, 'one contact is consumed once')
  } finally {
    Module._load = originalLoad
  }
})
