const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')

test('SDK adapter: launch calibration, airtime, local-only contacts, replay and bounded entity reuse', async () => {
  // Real installed SDK ECS components and physics helpers, simulated renderer observations.
  // This verifies wiring, NOT native collision response or touch usability.
  const ecs = require('@dcl/ecs/dist-cjs')
  const oldJs = require.extensions['.js']
  require.extensions['.js'] = (module, filename) => {
    if (filename.includes('ecs-math')) module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, allowJs: true }
    }).outputText, filename)
    else oldJs(module, filename)
  }
  let math
  try { math = require('@dcl/ecs-math') } finally { require.extensions['.js'] = oldJs }
  const hud = {}, identity = { userId: 'local-test', name: 'Local' }
  let actions, rayCallback, leave, moveRequest, moveSuccess = true
  const originalLoad = Module._load
  const originalNow = Date.now
  let clock = Date.parse('2026-09-08T12:00:00Z')
  Date.now = () => clock
  const impulses = []
  const originalImpulse = ecs.Physics.applyImpulseToPlayer
  ecs.Physics.applyImpulseToPlayer = value => { impulses.push({ ...value }); originalImpulse(value) }
  Module._load = function(request, parent, isMain) {
    if (request === '@dcl/sdk/ecs') return { ...ecs,
      raycastSystem: { registerGlobalDirectionRaycast: (_, callback) => { rayCallback = callback } } }
    if (request === '@dcl/sdk/math') return math
    if (request === '@dcl/sdk/players') return { getPlayer: () => identity, onLeaveScene: callback => { leave = callback } }
    if (request === '~system/Runtime') return { getExplorerInformation: async () => ({ platform: 'mobile', agent: 'simulated-observations' }) }
    if (request === '~system/RestrictedActions') return { movePlayerTo: async request => { moveRequest = request; return { success: moveSuccess } } }
    if (request === './ui' && parent?.filename.endsWith('index.ts')) return { hud, setupUi: value => { actions = value } }
    return originalLoad.call(this, request, parent, isMain)
  }
  let game
  try { game = require('../src/index.ts') } finally { Module._load = originalLoad }
  const { engine, Transform, RealmInfo, MeshCollider, VisibilityComponent } = ecs
  try {
    await game.main()
    RealmInfo.createOrReplace(engine.RootEntity, { baseUrl: 'https://test.invalid', realmName: 'test', networkId: 1,
      commsAdapter: 'test', isPreview: false, isConnectedSceneRoom: true })
    ecs.PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false }) // touch must not require mouse lock
    Transform.createOrReplace(engine.PlayerEntity, { position: { x: 16, y: 12.9, z: 10 } })
    const tick = async position => {
      clock += 40
      if (position) Transform.getMutable(engine.PlayerEntity).position = position
      await engine.update(0.04)
    }
    const deck = [...engine.getEntitiesWith(MeshCollider, Transform)].find(([, , t]) => t.position.y === 11.8)[0]
    for (let i = 0; i < 4; i++) {
      rayCallback({ hits: [{ entityId: deck, normalHit: { y: 1 }, length: 1.9 }] })
      await tick()
    }
    assert.equal(hud.status, 'READY')
    for (let i = 0; i < 10; i++) await tick({ x: 16, y: 13.1 + i * 0.1, z: 10 })
    assert.equal(hud.status, 'AIRBORNE'); assert.ok(Number(hud.seconds) > 0)
    const beforeLeave = Number(hud.seconds)
    leave('different-player')
    await tick({ x: 16, y: 14.2, z: 10 }); await tick({ x: 16, y: 14.3, z: 10 }); await tick({ x: 16, y: 14.4, z: 10 })
    assert.equal(hud.status, 'AIRBORNE'); assert.ok(Number(hud.seconds) >= beforeLeave)

    // Drive through a real bubble position gradually to avoid teleport invalidation.
    const spheres = [...engine.getEntitiesWith(ecs.MeshRenderer, Transform)].filter(([, mesh]) => mesh.mesh?.$case === 'sphere')
    const bubble = spheres.find(([, , t]) => t.position.y === 13)
    assert.ok(bubble)
    const target = bubble[2].position
    for (let i = 1; i <= 20; i++) await tick({ x: 16 + (target.x - 16) * i / 20,
      y: 14.4 + (target.y - 14.4) * i / 20, z: 10 + (target.z - 10) * i / 20 })
    assert.equal(VisibilityComponent.get(bubble[0]).visible, false)
    assert.ok(impulses.some(value => value.y > 0 && value.y <= 2.2))

    // Let course scheduling advance through warnings/expiry away from spawn slots.
    for (let i = 1; i <= 12; i++) await tick({ x: target.x + (16 - target.x) * i / 12,
      y: 13 + i * 0.005, z: target.z + (16 - target.z) * i / 12 })
    let landed = false, touchedPush = false, maxColliders = 6
    const travel = async (target, steps = 30) => {
      const from = { ...Transform.get(engine.PlayerEntity).position }
      for (let i = 1; i <= steps; i++) await tick({ x: from.x + (target.x - from.x) * i / steps,
        y: from.y + (target.y - from.y) * i / steps, z: from.z + (target.z - from.z) * i / steps })
    }
    for (let i = 0; i < 750; i++) {
      await tick({ x: 16, y: 13 + Math.sin(i / 12) * 0.2, z: 16 })
      maxColliders = Math.max(maxColliders, [...engine.getEntitiesWith(MeshCollider)].length)
      const landing = [...engine.getEntitiesWith(MeshCollider, Transform)].find(([, collider]) => collider.mesh?.$case === 'cylinder')
      if (landing && !landed) {
        const p = landing[2].position
        await travel({ x: p.x, y: p.y + 1.05, z: p.z })
        for (let n = 0; n < 4; n++) await tick()
        assert.equal(hud.status, 'PAUSED')
        const paused = hud.seconds
        for (let n = 0; n < 4; n++) await tick()
        assert.equal(hud.seconds, paused)
        for (let n = 1; n <= 6; n++) await tick({ x: p.x, y: p.y + 1.05 + n * 0.1, z: p.z })
        assert.equal(hud.status, 'AIRBORNE'); assert.ok(Number(hud.seconds) > Number(paused))
        landed = true
        await travel({ x: 16, y: 13, z: 16 })
      }
      const push = [...engine.getEntitiesWith(ecs.TextShape, Transform)].find(([entity, shape]) =>
        shape.text === '↓↓ PUSH ↓↓' && (VisibilityComponent.getOrNull(entity)?.visible ?? true))
      if (push && !touchedPush) {
        const p = push[2].position
        // Approach above the trigger, settle speed, then cross its upper contact boundary.
        await travel({ x: p.x, y: p.y + 0.35, z: p.z })
        impulses.length = 0
        for (let n = 1; n <= 4; n++) await tick({ x: p.x + n * 0.001, y: p.y + 0.35 - n * 0.1, z: p.z })
        assert.equal(impulses.filter(value => value.y === -3).length, 1)
        // Continue moving within the volume beyond cooldown; entry latch must stop retriggering.
        const afterEntry = impulses.length
        for (let n = 1; n <= 42; n++) await tick({ x: p.x + n * 0.001, y: p.y - 0.05, z: p.z })
        assert.equal(impulses.slice(afterEntry).filter(value => value.y === -3).length, 0)
        touchedPush = true
        await travel({ x: 16, y: 13, z: 16 })
      }
    }
    assert.equal(landed, true); assert.equal(touchedPush, true); assert.ok(maxColliders > 6)
    assert.equal(hud.status, 'AIRBORNE')
    const activeColliders = [...engine.getEntitiesWith(MeshCollider)].length
    assert.ok(activeColliders <= 9) // floor + 4 walls + launch + <=3 decks
    const entitiesBeforeReplay = [...engine.getEntitiesWith(Transform)].length
    console.log(`SDK fixture: ${entitiesBeforeReplay} transformed entities; peak ${maxColliders} colliders; one local avatar (no renderer)`)
    actions.replay(); await Promise.resolve()
    assert.equal(moveRequest.newRelativePosition.y, 12.2)
    await tick({ x: 16, y: 12.9, z: 10 })
    for (let i = 0; i < 5; i++) { rayCallback({ hits: [{ entityId: deck, normalHit: { y: 1 }, length: 1.9 }] }); await tick() }
    assert.equal(hud.status, 'READY'); assert.equal(Number(hud.seconds), 0)
    assert.ok(Number(hud.best) > 0)
    assert.equal([...engine.getEntitiesWith(Transform)].length, entitiesBeforeReplay)
    assert.equal([...engine.getEntitiesWith(MeshCollider)].length, 6)
    for (let i = 0; i < 8; i++) await tick({ x: 16, y: 13.1 + i * 0.1, z: 10 })
    for (let i = 1; i <= 20; i++) await tick({ x: 16, y: 13.8 - i * 0.01, z: 10 + i * 0.3 })
    for (let y = 13.6; y > 1.25; y -= 0.2) await tick({ x: 16, y, z: 16 })
    await tick({ x: 16, y: 1.25, z: 16 }); await tick(); await tick()
    assert.equal(hud.status, 'FINISHED'); assert.equal(hud.detail, 'Floor contact')
    const finalScore = hud.seconds
    for (let i = 0; i < 10; i++) await tick()
    assert.equal(hud.seconds, finalScore)
  } finally {
    Date.now = originalNow
    ecs.Physics.applyImpulseToPlayer = originalImpulse
  }
})
