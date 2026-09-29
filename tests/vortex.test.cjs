const { test } = require('node:test')
const assert = require('node:assert/strict')
const { AIRFLOW, inWindArea, liftFor, rotationForce, vortexForce } = require('../src/vortex.ts')
const { ARENA, scalePoint: at, insideArena } = require('../src/arena.ts')

test('central-only playtest preserves saved vortex tuning for later restoration', () => {
  assert.equal(AIRFLOW.centralOnly, true)
  assert.equal(AIRFLOW.rotationEnabled, true)
  const east = vortexForce(at({ x: 21, y: 5, z: 16 }))
  const north = vortexForce(at({ x: 16, y: 5, z: 21 }))
  const west = vortexForce(at({ x: 11, y: 5, z: 16 }))
  const south = vortexForce(at({ x: 16, y: 5, z: 11 }))
  assert.equal(east.z, 11); assert.equal(east.x, -1.05)
  assert.equal(north.x, -11); assert.equal(north.z, -1.05)
  assert.equal(west.z, -11); assert.equal(west.x, 1.05)
  assert.equal(south.x, 11); assert.equal(south.z, 1.05)
  assert.ok(Math.abs(AIRFLOW.edgeContainment / 4.9 - 0.6) < 1e-10)
})
test('active rotation is tangential and does not restore center pull or extra lift', () => {
  assert.deepEqual(rotationForce({ x: 29, y: 5, z: 24 }), { x: 0, y: 0, z: 11 })
  assert.deepEqual(rotationForce({ x: 24, y: 5, z: 29 }), { x: -11, y: 0, z: 0 })
  assert.equal(rotationForce({ x: 24, y: 5, z: 24 }), undefined)
  assert.equal(rotationForce({ x: 29, y: 1.79, z: 24 }), undefined)
  assert.ok(rotationForce({ x: 29, y: 1.8, z: 24 }))
  assert.equal(AIRFLOW.rotationOuterRadius, 12.25)
  assert.ok(rotationForce({ x: 36, y: 5, z: 24 }).z > 0)
  assert.equal(rotationForce({ x: 36.3, y: 5, z: 24 }), undefined)
})
test('3x3 updraft bounds, desktop lift -20%, mobile lift -65%', () => {
  const [broad, central] = AIRFLOW.zones
  assert.equal(broad.lift, 10); assert.equal(central.lift, 44)
  assert.equal(inWindArea(at({ x: 16, y: 2, z: 16 }), broad), true)
  assert.equal(inWindArea(at({ x: 16, y: 12, z: 16 }), central), true)
  assert.equal(inWindArea(at({ x: 16, y: 7, z: 16 }), broad), false)
  assert.equal(inWindArea(at({ x: 19, y: 2, z: 16 }), central), false)
  assert.equal(inWindArea({ x: 24, y: 29.9, z: 24 }, central), true)
  assert.equal(inWindArea({ x: 24, y: 30.1, z: 24 }, central), false)
  assert.equal(liftFor('desktop'), 0.8); assert.equal(liftFor('web'), 0.8)
  for (const device of ['mobile', 'android', 'iOS', 'iPad']) assert.equal(liftFor(device), 0.35)
})
test('vortex clears outside tunnel/above its height and avoids a center singularity', () => {
  assert.equal(vortexForce(at({ x: 16, y: 3, z: 16 })), undefined)
  assert.equal(vortexForce(at({ x: 18, y: 21, z: 16 })), undefined)
  assert.equal(vortexForce(at({ x: 31, y: 3, z: 31 })), undefined)
  assert.equal(insideArena({ x: 43, y: 25, z: 24 }), true) // Beyond the old radius and height.
  assert.equal(insideArena({ x: 47, y: 25, z: 24 }), false)
})

test('3x3 scene and Creator Hub geometry/spawn metadata agree', () => {
  const fs = require('node:fs')
  const scene = JSON.parse(fs.readFileSync('scene.json', 'utf8'))
  const composite = JSON.parse(fs.readFileSync('assets/scene/main.composite', 'utf8'))
  const meta = composite.components.find(c => c.name === 'inspector::SceneMetadata-v5').data['0'].json
  const model = composite.components.find(c => c.name === 'core::Transform').data['515'].json
  const expected = Array.from({ length: 9 }, (_, i) => `${i % 3},${Math.floor(i / 3)}`).sort()
  assert.deepEqual([...scene.scene.parcels].sort(), expected)
  assert.deepEqual(meta.layout.parcels.map(p => `${p.x},${p.y}`).sort(), expected)
  assert.deepEqual(model.position, ARENA.modelPosition)
  assert.deepEqual(model.scale, { x: 1.5, y: 1.5, z: 1.5 })
  assert.equal(meta.disablePortableExperiences, false)
  for (const axis of ['x', 'y', 'z']) assert.deepEqual(meta.spawnPoints[0].position[axis].value, scene.spawnPoints[0].position[axis])
  assert.deepEqual(scene.spawnPoints[0].position.y, [0, 0])
  assert.ok(scene.spawnPoints[0].position.x.every(x => x > 20 && x < 28))
})
test('installed SDK: wind forces without planes, retained gliding, matching platform colliders', async (t) => {
  const fs = require('node:fs'), Module = require('node:module'), ts = require('typescript')
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
  const load = Module._load
  const display = { fx: 50 }, actions = {}
  let groundCallback
  const sdkEcs = { ...ecs, raycastSystem: { ...ecs.raycastSystem,
    registerGlobalDirectionRaycast: (options, callback) => {
      groundCallback = callback
      return ecs.raycastSystem.registerGlobalDirectionRaycast(options, callback)
    }
  } }
  Module._load = function(request, parent, isMain) {
    if (request === '@dcl/sdk/ecs') return sdkEcs
    if (request === '@dcl/sdk/math') return math
    if (request === '@dcl/sdk/players') return { getPlayer: () => ({ userId: 'local', name: 'Local' }),
      onEnterScene: () => {}, onLeaveScene: () => {} }
    if (request === '~system/Runtime' || request === '~system/EnvironmentApi') return {} // Missing APIs cannot stop startup.
    if (request === '~system/RestrictedActions') return { movePlayerTo: async () => ({}) }
    if (request === './airtime-ui') return { display, setupAirtimeUi: value => Object.assign(actions, value) }
    if (request === './world') throw new Error('Do not recreate the rejected box or launch deck')
    if (request === './vortex-visuals') throw new Error('Wind planes must not be loaded')
    return load.call(this, request, parent, isMain)
  }
  let game
  try { game = require('../src/index.ts') } finally { Module._load = load }
  const { engine, Transform, PhysicsCombinedForce, GltfContainer } = ecs
  const player = engine.PlayerEntity
  Transform.createOrReplace(player, { position: at({ x: 16, y: 2, z: 16 }) })
  ecs.InputModifier.createOrReplace(player, { mode: { $case: 'standard', standard: { disableGliding: true } } })
  ecs.AvatarLocomotionSettings.createOrReplace(player, { runSpeed: 5 })
  const existingTunnel = engine.addEntity()
  Transform.create(existingTunnel, { position: { x: 16, y: 0, z: 15.75 } })
  GltfContainer.create(existingTunnel, { src: 'assets/scene/Models/wind_tunnel2/wind_tunnel2.glb' })
  const authoredEnvironment = engine.addEntity()
  Transform.create(authoredEnvironment, { position: { x: 23.75, y: 0, z: 24.25 },
    scale: { x: 1.4, y: 1.4, z: 1.4 } })
  GltfContainer.create(authoredEnvironment, { src: 'assets/models/endless_vortex6/endless_vortex6.glb',
    visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 3 })
  game.main()
  assert.equal(ecs.InputModifier.has(player), false)
  assert.equal(ecs.AvatarLocomotionSettings.has(player), false)
  const leafSource = 'assets/models/leaf-platform.glb'
  const leafEntities = () => [...engine.getEntitiesWith(GltfContainer)]
    .filter(([, model]) => model.src === leafSource).map(([id]) => id)
  const leafSolid = id => (GltfContainer.getOrNull(id)?.visibleMeshesCollisionMask ?? 0) === ecs.ColliderLayer.CL_PHYSICS
  const activeLeaves = () => leafEntities().filter(leafSolid)
  assert.equal([...engine.getEntitiesWith(GltfContainer)]
    .filter(([, model]) => model.src === 'assets/scene/Models/wind_tunnel2/wind_tunnel2.glb').length, 0)
  assert.equal(leafEntities().length, 18)
  assert.equal(GltfContainer.get(authoredEnvironment).visibleMeshesCollisionMask, 3)
  assert.equal(GltfContainer.get(authoredEnvironment).invisibleMeshesCollisionMask, 0)
  assert.deepEqual(Transform.get(authoredEnvironment).position, { x: 23.75, y: 0, z: 24.25 })
  assert.deepEqual(Transform.get(authoredEnvironment).scale, { x: 1.4, y: 1.4, z: 1.4 })
  assert.equal([...engine.getEntitiesWith(ecs.MeshCollider)].length, 0)
  const visuals = [...engine.getEntitiesWith(ecs.MeshRenderer, Transform)]
  assert.equal(visuals.length, 45) // Orb bodies, billboard sprites, pooled sparks and world leaderboard trim.
  assert.equal(visuals.filter(([, mesh]) => mesh.mesh.$case === 'plane').length, 12) // Orb vortex overlays.
  assert.equal(visuals.filter(([, mesh]) => mesh.mesh.$case === 'cylinder').length, 0)
  assert.equal(visuals.filter(([, mesh]) => mesh.mesh.$case === 'sphere').length, 28) // 12 orbs + 16 reusable sparks.
  assert.equal([...engine.getEntitiesWith(ecs.TextShape)].length, 12) // Global board only; no overhead platform labels.
  assert.equal([...engine.getEntitiesWith(ecs.Billboard)].length, 12) // One camera-facing vortex overlay per orb.
  const music = [...engine.getEntitiesWith(ecs.AudioSource)].map(([, audio]) => audio)
    .find(audio => audio.audioClipUrl.endsWith('looped-theme.mp3'))
  assert.ok(music); assert.equal(music.playing, false); assert.equal(music.loop, true); assert.equal(music.volume, 0.2)
  await engine.update(0.35)
  assert.equal([...engine.getEntitiesWith(ecs.AudioSource)].map(([, audio]) => audio)
    .find(audio => audio.audioClipUrl.endsWith('looped-theme.mp3')).playing, true)
  await engine.update(0.05)
  assert.deepEqual(PhysicsCombinedForce.get(player).vector, { x: 0, y: 44 * AIRFLOW.mobileLift, z: 0 })
  // A client/network overwrite must not permanently kill an active steady updraft.
  PhysicsCombinedForce.deleteFrom(player)
  await engine.update(0.25)
  assert.deepEqual(PhysicsCombinedForce.get(player).vector, { x: 0, y: 44 * AIRFLOW.mobileLift, z: 0 })
  Transform.getMutable(player).position = { x: 24, y: 1.79, z: 24 }
  await engine.update(0.05)
  assert.equal(PhysicsCombinedForce.has(player), false)
  Transform.getMutable(player).position = { x: 24, y: 1.8, z: 24 }
  await engine.update(0.05)
  assert.deepEqual(PhysicsCombinedForce.get(player).vector, { x: 0, y: 44 * AIRFLOW.mobileLift, z: 0 })
  Transform.getMutable(player).position = at({ x: 16, y: 2, z: 16 })
  for (let i = 0; i < 10; i++) await engine.update(0.05)
  assert.deepEqual(PhysicsCombinedForce.get(player).vector, { x: 0, y: 44 * AIRFLOW.mobileLift, z: 0 }) // no stacking
  actions.lift(); await engine.update(0.05)
  assert.deepEqual(PhysicsCombinedForce.get(player).vector, { x: 0, y: 44 * AIRFLOW.desktopLift, z: 0 })
  actions.lift(); await engine.update(0.05)
  assert.deepEqual(PhysicsCombinedForce.get(player).vector, { x: 0, y: 44 * AIRFLOW.mobileLift, z: 0 })
  Transform.getMutable(player).position = { x: 25, y: 3, z: 25 }
  await engine.update(0.05)
  const rotating = PhysicsCombinedForce.get(player).vector
  assert.ok(rotating.x < -7.7 && rotating.x > -7.8)
  assert.equal(rotating.y, 44 * AIRFLOW.mobileLift)
  assert.ok(rotating.z > 7.7 && rotating.z < 7.8) // Tangential rotation plus central lift; no inward pull.
  Transform.getMutable(player).position = at({ x: 18, y: 2, z: 16 })
  await engine.update(0.05)
  assert.deepEqual(PhysicsCombinedForce.get(player).vector, { x: 0, y: 0, z: 11 }) // Rotation remains; broad lift is paused.
  Transform.getMutable(player).position = { x: 43, y: 5, z: 24 }
  await engine.update(0.05)
  assert.equal(PhysicsCombinedForce.has(player), false) // No outer containment pull or distant rotation.
  Transform.getMutable(player).position = at({ x: 31, y: 2, z: 31 })
  await engine.update(0.05)
  assert.equal(PhysicsCombinedForce.has(player), false)
  // Inspect the actual collider lifecycle, not simulated native physics.
  const { clearLanding, landingSlots, LANDINGS, orbitPoint } = require('../src/landing-platforms.ts')
  const surfaceY = (entity, x, z) => {
    const transform = Transform.get(entity), q = transform.rotation
    const normal = { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z),
      z: 2 * (q.y * q.z + q.w * q.x) }
    const top = { x: transform.position.x + normal.x * LANDINGS.thickness / 2,
      y: transform.position.y + normal.y * LANDINGS.thickness / 2,
      z: transform.position.z + normal.z * LANDINGS.thickness / 2 }
    return top.y - (normal.x * (x - top.x) + normal.z * (z - top.z)) / normal.y
  }
  assert.equal(clearLanding(landingSlots[0], landingSlots[0], []), false)
  assert.equal(clearLanding(landingSlots[0], undefined, [landingSlots[0]]), false)
  assert.ok(Math.abs(LANDINGS.radius * 2 - 3.86) < 0.02)
  assert.ok(Math.abs(LANDINGS.halfWidth * 2 - 1.96) < 0.02)
  assert.equal(LANDINGS.count, 18)
  assert.equal(LANDINGS.orbitRadius, 14.5)
  assert.ok(ARENA.radius - LANDINGS.orbitRadius - LANDINGS.radius >= 1.7)
  for (let time = 0; time <= 45; time += 0.5) {
    const positions = landingSlots.map(slot => orbitPoint(slot, time))
    assert.ok(positions.every(p => p.y >= 5.25 &&
      Math.hypot(p.x - 24, p.z - 24) - LANDINGS.radius > 4 &&
      p.x - LANDINGS.radius > 0 && p.x + LANDINGS.radius < ARENA.size &&
      p.z - LANDINGS.radius > 0 && p.z + LANDINGS.radius < ARENA.size))
    const initialDistance = math.Vector3.distance(landingSlots[0], landingSlots[7])
    assert.ok(Math.abs(math.Vector3.distance(positions[0], positions[7]) - initialDistance) < 1e-9)
  }
  let sawSolid = false, stoodOnPlatform = false, sawExpiry = false, observedPlatform, firstOrbitPosition,
    firstSelfRotation, sawOrbit = false, sawSelfRotation = false
  for (let i = 0; i < 650; i++) {
    await engine.update(0.05)
    const colliders = activeLeaves()
    assert.ok(colliders.length <= LANDINGS.count)
    for (const id of colliders) {
      assert.equal(GltfContainer.get(id).src, leafSource)
      assert.equal(GltfContainer.get(id).visibleMeshesCollisionMask, ecs.ColliderLayer.CL_PHYSICS)
      assert.equal(ecs.MeshCollider.has(id), false) // The visible GLB mesh itself supplies collision.
      const scale = Transform.get(id).scale
      assert.ok(scale.x >= 1 && scale.x <= 1.035)
      assert.equal(scale.z, scale.x)
      assert.equal(scale.y, scale.x)
    }
    if (colliders.length && !stoodOnPlatform) {
      sawSolid = true; observedPlatform = colliders[0]
      const p = Transform.get(observedPlatform).position
      firstOrbitPosition = { ...p }
      firstSelfRotation = { ...Transform.get(observedPlatform).rotation }
      assert.equal(Transform.get(observedPlatform).scale.x, 1)
      Transform.getMutable(player).position = { x: p.x, y: surfaceY(observedPlatform, p.x, p.z) + 0.88, z: p.z }
      await engine.update(0.05); await engine.update(0.05)
      assert.equal(PhysicsCombinedForce.has(player), false) // stable landing allows a normal jump
      stoodOnPlatform = true
    }
    if (observedPlatform && leafSolid(observedPlatform)) {
      const p = Transform.get(observedPlatform).position
      const radius = Math.hypot(p.x - 24, p.z - 24)
      assert.ok(Math.abs(radius - LANDINGS.orbitRadius) <= LANDINGS.radialWobble + 1e-6)
      assert.ok(p.x - LANDINGS.radius > 0 && p.x + LANDINGS.radius < ARENA.size)
      assert.ok(p.z - LANDINGS.radius > 0 && p.z + LANDINGS.radius < ARENA.size)
      if (math.Vector3.distance(p, firstOrbitPosition) > 0.5) sawOrbit = true
      const rotation = Transform.get(observedPlatform).rotation
      if (firstSelfRotation && Math.abs(rotation.x - firstSelfRotation.x) + Math.abs(rotation.y - firstSelfRotation.y) +
        Math.abs(rotation.z - firstSelfRotation.z) + Math.abs(rotation.w - firstSelfRotation.w) > 0.01) sawSelfRotation = true
    }
    if (observedPlatform && !leafSolid(observedPlatform)) sawExpiry = true
  }
  assert.ok(sawSolid); assert.ok(stoodOnPlatform); assert.ok(sawExpiry); assert.ok(sawOrbit); assert.ok(sawSelfRotation)
  assert.equal([...engine.getEntitiesWith(ecs.MeshRenderer)].length, 45) // Orb pool, physical board, no decorative wind planes.
  await engine.update(2)
  assert.equal(activeLeaves().length, 0) // no collider sweep after suspension

  await t.test('real entry point animates every frame and emits lift with a paused timer/unlocked pointer', async () => {
    const { BUBBLES } = require('../src/bubble-rules.ts')
    actions.lift() // desktop
    ecs.PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })
    const body = [...engine.getEntitiesWith(ecs.MeshRenderer, Transform)]
      .filter(([id, mesh, tr]) => mesh.mesh.$case === 'sphere' && tr.parent === engine.RootEntity &&
        ecs.VisibilityComponent.get(id).visible && Math.abs(tr.scale.x - BUBBLES.radius * 2) < 1e-6)
      .map(([id]) => id)[0]
    assert.ok(body)
    const center = { ...Transform.get(body).position }
    Transform.getMutable(player).position = { x: center.x - 1.5, y: center.y, z: center.z }
    let tick = 1000
    const frame = async () => {
      ecs.EngineInfo.createOrReplace(engine.RootEntity, { tickNumber: tick, frameNumber: tick++, totalRuntime: 40 })
      await engine.update(1 / 60)
    }
    for (let i = 0; i < 4; i++) {
      const before = { ...Transform.get(body).position }
      await frame()
      const after = Transform.get(body).position
      assert.ok(math.Vector3.distance(before, after) > 0) // Previously frozen between score samples.
      assert.ok(math.Vector3.distance(before, after) < 0.07)
    }
    const score = display.time
    let current = Transform.get(body).position
    Transform.getMutable(player).position = { x: current.x - 1.5, y: current.y, z: current.z }
    await frame() // Establish a fresh previous player position beside the live bubble.
    const beforeEvent = ecs.PhysicsCombinedImpulse.getOrNull(player)?.eventId ?? 0
    current = Transform.get(body).position
    Transform.getMutable(player).position = { x: current.x + 1.5, y: current.y, z: current.z }
    await frame() // Sweeps through the bubble, ending outside its radius.
    const impulse = ecs.PhysicsCombinedImpulse.get(player)
    assert.ok(impulse.eventId > beforeEvent)
    assert.deepEqual(impulse.vector, { x: 0, y: BUBBLES.desktopImpulse, z: 0 })
    assert.equal(display.time, score) // Physical recovery never adds time directly.
    await frame()
    assert.ok(Transform.get(body).scale.x < BUBBLES.radius * 2)
    assert.equal(ecs.PhysicsCombinedImpulse.get(player).eventId, impulse.eventId)
    ecs.PointerLock.deleteFrom(engine.CameraEntity)
    actions.lift()
    await engine.update(2)
  })

  await t.test('one-frame ray-confirmed edge contact arms collapse before the next airtime sample', async () => {
    const away = { x: 24, y: 2, z: 24 }
    Transform.getMutable(player).position = away
    for (let i = 0; i < 400; i++) await engine.update(0.05)
    const ids = activeLeaves()
    assert.equal(ids.length, LANDINGS.count)
    const target = ids[0], p = { ...Transform.get(target).position }
    const radial = { x: (p.x - 24) / LANDINGS.orbitRadius, z: (p.z - 24) / LANDINGS.orbitRadius }
    const edge = { x: p.x + radial.x * (LANDINGS.radius + 0.15), y: 0,
      z: p.z + radial.z * (LANDINGS.radius + 0.15) }
    edge.y = surfaceY(target, edge.x, edge.z) + 0.88 + 0.1
    let tick = 2000
    const frame = async () => {
      ecs.EngineInfo.createOrReplace(engine.RootEntity, { tickNumber: tick, frameNumber: tick++, totalRuntime: 60 })
      await engine.update(1 / 60)
    }
    Transform.getMutable(player).position = { ...edge, y: edge.y + 0.8 }
    await frame()
    Transform.getMutable(player).position = edge
    // Inject a native ray result; the fixture does not simulate collision physics.
    const hitX = p.x + radial.x * (LANDINGS.radius - 0.1)
    const hitZ = p.z + radial.z * (LANDINGS.radius - 0.1)
    groundCallback({ hits: [{ entityId: target, length: 1.88,
      normalHit: { x: 0, y: 1, z: 0 }, position: { x: hitX, y: surfaceY(target, hitX, hitZ), z: hitZ } }] })
    await frame()
    assert.equal(PhysicsCombinedForce.has(player), false)
    groundCallback({ hits: [] })
    Transform.getMutable(player).position = away // A single brief touch must be enough.
    // The native hit arms immediately, before the first rendered contact frame advances.
    for (let i = 0; i < 118; i++) await frame()
    assert.equal(leafSolid(target), true)
    await frame()
    assert.equal(leafSolid(target), false)
    assert.ok(ids.slice(1).every(leafSolid))
    await engine.update(2)
  })

  await t.test('native capsule contact arms rim landings; other avatars and underside touches cannot', async () => {
    const away = { x: 24, y: 2, z: 24 }
    Transform.getMutable(player).position = away
    for (let i = 0; i < 400; i++) await engine.update(0.05)
    const ids = activeLeaves()
    const sensors = [...engine.getEntitiesWith(ecs.TriggerArea)].map(([id]) => id)
    assert.equal(ids.length, LANDINGS.count); assert.equal(sensors.length, LANDINGS.count)
    assert.ok(sensors.every(id => !leafSolid(id) && !ecs.MeshRenderer.has(id)))
    const target = ids[0]
    const sensor = sensors.map(id => [id, math.Vector3.distance(Transform.get(id).position, Transform.get(target).position)])
      .sort((a, b) => a[1] - b[1])[0]?.[0]
    assert.ok(sensor)
    assert.ok(math.Vector3.distance(Transform.get(sensor).position, Transform.get(target).position) < 0.5)
    assert.equal(ecs.TriggerArea.get(sensor).collisionMask, ecs.ColliderLayer.CL_PLAYER)
    let stamp = 10000, tick = 3000
    const frame = async (dt = 1 / 60) => {
      ecs.EngineInfo.createOrReplace(engine.RootEntity, { tickNumber: tick, frameNumber: tick++, totalRuntime: 100 })
      await engine.update(dt)
    }
    const emit = (entity, eventType = ecs.TriggerAreaEventType.TAET_ENTER) => ecs.TriggerAreaResult.addValue(sensor, {
      triggeredEntity: sensor, triggeredEntityPosition: { ...Transform.get(sensor).position },
      triggeredEntityRotation: math.Quaternion.Identity(), eventType, timestamp: stamp++,
      trigger: { entity, layers: ecs.ColliderLayer.CL_PLAYER,
        position: { ...Transform.get(player).position }, rotation: math.Quaternion.Identity(), scale: { x: 1, y: 1, z: 1 } }
    })
    emit(engine.addEntity()) // Another avatar must never arm the local deck.
    for (let i = 0; i < 45; i++) await frame(0.05)
    assert.ok(ids.every(leafSolid))
    let p = { ...Transform.get(target).position }
    Transform.getMutable(player).position = { ...p, y: p.y - 0.5 }
    emit(player)
    for (let i = 0; i < 45; i++) await frame(0.05)
    assert.ok(ids.every(leafSolid)) // Contact underneath cannot start the countdown.
    emit(player, ecs.TriggerAreaEventType.TAET_EXIT)
    await frame()
    p = { ...Transform.get(target).position }
    const radial = { x: (p.x - 24) / LANDINGS.orbitRadius, z: (p.z - 24) / LANDINGS.orbitRadius }
    const rim = { x: p.x + radial.x * (LANDINGS.radius + 0.15), y: 0,
      z: p.z + radial.z * (LANDINGS.radius + 0.15) }
    rim.y = surfaceY(target, rim.x, rim.z) + 0.88 + 0.2
    Transform.getMutable(player).position = rim // Capsule overlaps the visible/collider rim.
    emit(player)
    await frame()
    emit(player, ecs.TriggerAreaEventType.TAET_EXIT)
    Transform.getMutable(player).position = away
    for (let i = 0; i < 119; i++) await frame()
    assert.equal(leafSolid(target), true)
    await frame()
    assert.equal(leafSolid(target), false)
    assert.equal(ecs.TriggerArea.has(sensor), false)
    assert.ok(ids.slice(1).every(leafSolid))
    await engine.update(2)
    assert.equal([...engine.getEntitiesWith(ecs.TriggerArea)].length, 0)
  })

  await t.test('eighteen opaque platforms wait for landing, last two seconds and fall independently', () => {
    const { createLandingPlatforms } = require('../src/landing-platforms.ts')
    const platforms = createLandingPlatforms(() => 0)
    const away = { x: 24, y: 2, z: 24 }
    const step = () => {
      platforms.update(0.05, away)
      for (const entity of activeLeaves()) {
        assert.equal(ecs.VisibilityComponent.get(entity).visible, true)
        assert.equal(GltfContainer.get(entity).src, leafSource)
      }
    }
    for (let i = 0; i < 400; i++) step()
    const ids = activeLeaves()
    assert.equal(ids.length, LANDINGS.count)
    for (let i = 0; i < 1200; i++) step() // Another minute untouched: no age-based expiry.
    assert.deepEqual(activeLeaves(), ids)
    const target = ids[0]
    const standing = () => {
      const p = Transform.get(target).position
      return { x: p.x, y: p.y + LANDINGS.thickness / 2 + 0.88, z: p.z }
    }
    assert.equal(platforms.checkLanding({ ...standing(), y: standing().y - 2 }, 0.88, 0), false)
    assert.equal(platforms.checkLanding({ ...standing(), x: standing().x + 4 }, 0.88, 0), false)
    assert.equal(platforms.checkLanding({ ...standing(), x: standing().x + LANDINGS.radius + 0.01 }, 0.88, 0), false)
    assert.equal(platforms.checkLanding(standing(), 0.88, 2), false) // Ascending past it is not a landing.
    for (let i = 0; i < 200; i++) step()
    assert.ok(ids.every(leafSolid))
    assert.equal(platforms.checkLanding(standing(), 0.88, 0), true)
    for (let i = 0; i < 38; i++) {
      step()
      if (i % 10 === 0) platforms.checkLanding(standing(), 0.88, 0) // Re-entry cannot refresh the deadline.
    }
    assert.equal(leafSolid(target), true) // Still solid at 1.9 s after landing.
    const height = Transform.get(target).position.y
    step(); step()
    assert.equal(leafSolid(target), false) // Releases at 2.0 s, not eight seconds.
    step()
    assert.equal(leafSolid(target), false)
    assert.equal(ecs.VisibilityComponent.get(target).visible, true)
    assert.ok(Transform.get(target).position.y < height) // Opaque falling visual, collision already removed.
    assert.equal(platforms.checkLanding(standing(), 0.88, 0), false)
    assert.ok(ids.slice(1).every(leafSolid))
    for (let i = 0; i < 80; i++) step()
    assert.ok(activeLeaves().length <= LANDINGS.count)
    assert.ok(ids.slice(1).every(leafSolid))
    platforms.update(2, away)
  })

  await t.test('all eighteen decks arm at their previous rendered edge and collapse without renewed contact', () => {
    const { createLandingPlatforms } = require('../src/landing-platforms.ts')
    const platforms = createLandingPlatforms(() => 0), away = { x: 24, y: 2, z: 24 }
    for (let i = 0; i < 400; i++) platforms.update(0.05, away)
    const ids = activeLeaves()
    assert.equal(ids.length, LANDINGS.count)
    const previous = ids.map(id => ({ ...Transform.get(id).position }))
    platforms.update(1 / 60, away)
    for (const [index, id] of ids.entries()) {
      const current = Transform.get(id).position, old = previous[index]
      const distance = Math.hypot(old.x - current.x, old.z - current.z)
      const edge = { x: old.x + (old.x - current.x) / distance * (LANDINGS.radius - 0.001),
        y: 0, z: old.z + (old.z - current.z) / distance * (LANDINGS.radius - 0.001) }
      edge.y = surfaceY(id, edge.x, edge.z) + 0.88
      assert.ok(Math.hypot(edge.x - current.x, edge.z - current.z) > LANDINGS.radius)
      assert.equal(platforms.checkLanding({ ...edge, y: edge.y - 1 }, 0.88, 0, id), false)
      assert.equal(platforms.checkLanding(edge, 0.88, 2, id), false)
      assert.equal(platforms.checkLanding(edge, 0.88, 0), true)
    }
    for (let i = 0; i < 119; i++) platforms.update(1 / 60, away)
    assert.ok(ids.every(leafSolid))
    platforms.update(1 / 60, away)
    assert.ok(ids.every(id => !leafSolid(id)))
    const id = ids[0], p = Transform.get(id).position
    assert.equal(platforms.checkLanding({ ...p, y: p.y + LANDINGS.thickness / 2 + 0.88 }, 0.88, 0, id), false)
    platforms.update(2, away)
  })

  await t.test('platform update arms collapse when the player is standing on a leaf', () => {
    const { createLandingPlatforms } = require('../src/landing-platforms.ts')
    const platforms = createLandingPlatforms(() => 0.25), away = { x: 24, y: 2, z: 24 }
    for (let i = 0; i < 400; i++) platforms.update(0.05, away)
    const target = activeLeaves()[0]
    assert.ok(target)
    const p = Transform.get(target).position
    const standing = { x: p.x, y: p.y + LANDINGS.thickness / 2 + 0.88, z: p.z }
    platforms.update(1 / 60, standing)
    for (let i = 0; i < 119; i++) platforms.update(1 / 60, away)
    assert.equal(leafSolid(target), true)
    platforms.update(1 / 60, away)
    assert.equal(leafSolid(target), false)
    platforms.update(2, away)
  })

  await t.test('local golden orbs spin, pop once, respawn, mute and avoid platform geometry', () => {
    const { createRecoveryBubbles } = require('../src/bubbles.ts')
    const { BUBBLES } = require('../src/bubble-rules.ts')
    function field(blocked = () => false) {
      const before = new Set([...engine.getEntitiesWith(ecs.MeshRenderer)].map(([id]) => id))
      const beforeAudio = new Set([...engine.getEntitiesWith(ecs.AudioSource)].map(([id]) => id))
      const manager = createRecoveryBubbles(blocked, () => 0)
      const ids = [...engine.getEntitiesWith(ecs.MeshRenderer)].map(([id]) => id).filter(id => !before.has(id))
      const bodies = ids.filter(id => Transform.get(id).parent === engine.RootEntity)
      const sound = [...engine.getEntitiesWith(ecs.AudioSource)].map(([id]) => id).find(id => !beforeAudio.has(id))
      return { manager, ids, bodies, sound }
    }
    const a = field(), b = field(), obstructed = field(() => true), away = { x: 24, y: 2, z: 24 }
    const step = (f, position = away, canPop = false, velocity = 0) => f.manager.update(0.05, position, velocity, false, canPop)
    for (let i = 0; i < 100; i++) { step(a); step(b); step(obstructed) }
    assert.equal(a.bodies.length, 12)
    assert.ok(a.ids.every(id => !ecs.MeshCollider.has(id)))
    assert.ok(obstructed.ids.every(id => !ecs.VisibilityComponent.get(id).visible))
    const target = a.bodies.find(id => ecs.VisibilityComponent.get(id).visible)
    const rotation = { ...Transform.get(target).rotation }
    step(a)
    assert.notDeepEqual(Transform.get(target).rotation, rotation)
    const p = { ...Transform.get(target).position }
    assert.equal(step(a, p, false), 0) // Absent/disconnected/outside player cannot collect.
    assert.equal(step(a, p, true), BUBBLES.desktopImpulse)
    assert.equal(step(a, p, true), 0)
    assert.equal(ecs.AudioSource.get(a.sound).playing, true)
    assert.equal(ecs.AudioSource.get(b.sound).playing, false)
    assert.ok(b.bodies.every(id => ecs.VisibilityComponent.get(id).visible))
    const other = a.bodies.find(id => id !== target && ecs.VisibilityComponent.get(id).visible)
    const otherPosition = { ...Transform.get(other).position }
    step(a, otherPosition, true) // A distant move is not swept as a pickup.
    assert.equal(step(a, otherPosition, true), 0) // Cooldown blocks extra lift, but not the pop.
    for (let i = 0; i < 5; i++) step(a)
    assert.equal(ecs.VisibilityComponent.get(target).visible, false)
    assert.equal(ecs.VisibilityComponent.get(other).visible, false)
    a.manager.setVolume(0)
    assert.equal(ecs.AudioSource.get(a.sound).volume, 0)
    assert.equal(ecs.AudioSource.get(a.sound).playing, false)
    for (let i = 0; i < 120; i++) step(a)
    assert.equal(ecs.VisibilityComponent.get(target).visible, true)
    assert.equal(Transform.get(target).scale.x, BUBBLES.radius * 2)
    assert.equal(step(a, { ...Transform.get(target).position }, true, 3), 0) // Pops at the upward cap without extra lift.
    assert.equal(ecs.AudioSource.get(a.sound).playing, false)
    assert.equal(a.ids.length, 24)
  })
})
