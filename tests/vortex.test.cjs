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

test('3x3 scene and Creator Hub parcel/spawn metadata agree', () => {
  const fs = require('node:fs')
  const scene = JSON.parse(fs.readFileSync('scene.json', 'utf8'))
  const composite = JSON.parse(fs.readFileSync('assets/scene/main.composite', 'utf8'))
  const meta = composite.components.find(c => c.name === 'inspector::SceneMetadata-v5').data['0'].json
  const expected = Array.from({ length: 9 }, (_, i) => `${i % 3},${Math.floor(i / 3)}`).sort()
  assert.deepEqual([...scene.scene.parcels].sort(), expected)
  assert.deepEqual(meta.layout.parcels.map(p => `${p.x},${p.y}`).sort(), expected)
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
  const display = {}
  let groundCallback
  const footCallbacks = []
  const sdkEcs = { ...ecs, raycastSystem: { ...ecs.raycastSystem,
    registerGlobalDirectionRaycast: (options, callback) => {
      if (options.opts.maxDistance > 1) groundCallback = callback
      else footCallbacks.push(callback)
      return ecs.raycastSystem.registerGlobalDirectionRaycast(options, callback)
    }
  } }
  Module._load = function(request, parent, isMain) {
    if (request === '@dcl/sdk/ecs') return sdkEcs
    if (request === '@dcl/sdk/math') return math
    if (request === '@dcl/sdk/players') return { getPlayer: () => ({ userId: 'local', name: 'Local' }),
      onEnterScene: () => {}, onLeaveScene: () => {} }
    if (request === '@dcl/sdk/network') return { myProfile: { networkId: 1 }, syncEntity: () => {}, parentEntity: () => {} }
    if (request === '@dcl/sdk/message-bus') return { MessageBus: class {
      on(_name, callback) { this.callback = callback }
      emit(name, payload) { this.callback?.(payload, 'self') }
    } }
    if (request === '~system/Runtime' || request === '~system/EnvironmentApi') return {} // Missing APIs cannot stop startup.
    if (request === '~system/RestrictedActions') return { movePlayerTo: async () => ({}) }
    if (request === './airtime-ui') return { display, setupAirtimeUi: () => {} }
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
  GltfContainer.create(authoredEnvironment, { src: 'assets/models/endless-vortex-plants.glb',
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
  assert.equal(leafEntities().length, 48)
  assert.equal(GltfContainer.get(authoredEnvironment).visibleMeshesCollisionMask,
    ecs.ColliderLayer.CL_POINTER | ecs.ColliderLayer.CL_PHYSICS)
  assert.equal(GltfContainer.get(authoredEnvironment).invisibleMeshesCollisionMask, 0)
  assert.equal(GltfContainer.get(authoredEnvironment).src, 'assets/models/orchard.glb')
  assert.equal(ecs.Animator.has(authoredEnvironment), false)
  assert.deepEqual(Transform.get(authoredEnvironment).position, { x: 23.75, y: 0, z: 24.25 })
  const orchardScale = ARENA.size / 44 * 1.2
  assert.deepEqual(Transform.get(authoredEnvironment).scale,
    { x: orchardScale, y: orchardScale, z: orchardScale })
  const modelsBySource = Object.fromEntries([...engine.getEntitiesWith(GltfContainer)].map(([id, model]) => [model.src, id]))
  const blueBase = modelsBySource['assets/models/blue-lava-vortex-base.glb']
  const blueLava = modelsBySource['assets/models/blue-lava-vortex-lava.glb']
  assert.ok(blueBase); assert.ok(blueLava)
  assert.equal(modelsBySource['assets/models/blue-lava-vortex.glb'], undefined)
  for (const entity of [blueBase, blueLava]) {
    assert.deepEqual(Transform.get(entity).position, { x: 24, y: 0.12, z: 24 })
    assert.deepEqual(Transform.get(entity).scale, { x: 1.2, y: 1.2, z: 1.2 })
    assert.deepEqual(Transform.get(entity).rotation, { x: 0, y: 0, z: 0, w: 1 })
    assert.equal(GltfContainer.get(entity).visibleMeshesCollisionMask, ecs.ColliderLayer.CL_NONE)
    assert.equal(GltfContainer.get(entity).invisibleMeshesCollisionMask, ecs.ColliderLayer.CL_NONE)
  }
  assert.equal([...engine.getEntitiesWith(ecs.TriggerArea, Transform)]
    .some(([id]) => Transform.get(id).scale.x === 28.3 && Transform.get(id).scale.y === 1.4), false,
  'lava remains visually rendered without becoming a solid collider; airtime contact uses its mesh bounds')
  assert.equal(ecs.GltfNodeModifiers.has(blueBase), false) // Keep the base's authored gray slot.
  const readPrimitiveMaterial = src => {
    const bytes = fs.readFileSync(src), jsonLength = bytes.readUInt32LE(12)
    return JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength))
  }
  const baseGlb = readPrimitiveMaterial('assets/models/blue-lava-vortex-base.glb')
  const lavaGlb = readPrimitiveMaterial('assets/models/blue-lava-vortex-lava.glb')
  assert.equal(baseGlb.meshes[0].primitives[0].material, 0)
  assert.deepEqual(baseGlb.materials[0].pbrMetallicRoughness.baseColorFactor, [0.800000011920929, 0.800000011920929, 0.800000011920929, 1])
  assert.equal(lavaGlb.meshes[0].primitives[0].material, 1)
  const lavaPbr = () => ecs.GltfNodeModifiers.get(blueLava).modifiers[0].material.material.pbr
  assert.equal(ecs.GltfNodeModifiers.get(blueLava).modifiers[0].material.material.$case, 'pbr')
  assert.equal(ecs.GltfNodeModifiers.get(blueLava).modifiers[0].path, '')
  assert.equal(lavaPbr().texture.tex.texture.src, 'assets/materials/blue-lava-molten.png')
  assert.deepEqual(lavaPbr().texture.tex.texture.offset, { x: 0, y: 0 })
  const blueGlowAtStart = lavaPbr().emissiveIntensity
  const staticBaseTransform = structuredClone(Transform.get(blueBase))
  const staticLavaTransform = structuredClone(Transform.get(blueLava))
  const windEnvironments = [...engine.getEntitiesWith(GltfContainer)]
    .filter(([, model]) => model.src === 'assets/models/endless-vortex-wind.glb').map(([id]) => id)
  assert.equal(windEnvironments.length, 3)
  windEnvironments.forEach((wind, layer) => {
    assert.equal(GltfContainer.get(wind).visibleMeshesCollisionMask, 0)
    assert.equal(GltfContainer.get(wind).invisibleMeshesCollisionMask, 0)
    const position = Transform.get(wind).position
    assert.ok(Math.abs(position.x - Transform.get(authoredEnvironment).position.x) <= ARENA.scale * 0.2)
    assert.ok(Math.abs(position.y - (Transform.get(authoredEnvironment).position.y + layer * 3)) <= 0.6)
    assert.ok(Math.abs(position.z - Transform.get(authoredEnvironment).position.z) <= ARENA.scale * 0.2)
    assert.deepEqual(Transform.get(wind).scale, Transform.get(authoredEnvironment).scale)
    const state = ecs.Animator.get(wind).states[0]
    assert.equal(state.clip, 'Animation'); assert.equal(state.playing, true); assert.equal(state.loop, true)
    assert.ok(state.speed >= 0.8 && state.speed <= 1.2)
  })
  const windMaterials = readPrimitiveMaterial('assets/models/endless-vortex-wind.glb').materials
  assert.deepEqual(windMaterials.map(material => Number(material.pbrMetallicRoughness.baseColorFactor[3].toFixed(3))),
    [0.025, 0.238, 0.287, 0.189, 0.112, 0.63])
  const floorResetTrigger = [...engine.getEntitiesWith(ecs.TriggerArea, Transform)].find(([id, trigger]) =>
    Math.abs(Transform.get(id).position.y - (ARENA.floorTop + 0.0001)) < 1e-7 &&
    Math.abs(Transform.get(id).scale.y - 0.0001) < 1e-7)
  assert.ok(floorResetTrigger, 'the timer uses a 0.01 cm ground-level trigger plane')
  assert.equal(ecs.MeshCollider.has(floorResetTrigger[0]), false, 'the reset plane is not a solid collider')
  const visuals = [...engine.getEntitiesWith(ecs.MeshRenderer, Transform)]
  assert.equal(visuals.length, 176) // Orb bodies, billboard sprites, pooled glitter and the expanded leaf pool.
  assert.equal(visuals.filter(([, mesh]) => mesh.mesh.$case === 'plane').length, 24) // One vortex overlay per orb.
  assert.equal(visuals.filter(([, mesh]) => mesh.mesh.$case === 'cylinder').length, 0)
  assert.equal(visuals.filter(([, mesh]) => mesh.mesh.$case === 'sphere').length, 152) // 24 orbs + 128 reusable particles.
  assert.equal([...engine.getEntitiesWith(ecs.TextShape)].length, 0) // No global board or overhead platform labels.
  assert.equal([...engine.getEntitiesWith(ecs.Billboard)].length, 24) // One camera-facing vortex overlay per orb.
  const music = [...engine.getEntitiesWith(ecs.AudioSource)].map(([, audio]) => audio)
    .find(audio => audio.audioClipUrl.endsWith('looped-theme.mp3'))
  assert.ok(music); assert.equal(music.playing, false); assert.equal(music.loop, true); assert.equal(music.volume, 0.2)
  await engine.update(0.35)
  assert.deepEqual(Transform.get(blueBase), staticBaseTransform)
  assert.deepEqual(Transform.get(blueLava), staticLavaTransform)
  assert.ok(lavaPbr().texture.tex.texture.offset.y > 0, 'lava UVs drift while the mesh transform stays fixed')
  assert.ok(lavaPbr().emissiveIntensity > blueGlowAtStart)
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
  await engine.update(0.05)
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
  assert.equal(LANDINGS.count, 48)
  assert.equal(landingSlots.length, 80)
  assert.equal(landingSlots.filter(slot => slot.y >= LANDINGS.heights[2]).length, 48)
  assert.ok(landingSlots.filter(slot => slot.y >= LANDINGS.heights[2]).every(slot =>
    Math.abs(Math.hypot(slot.x - ARENA.center.x, slot.z - ARENA.center.z) - LANDINGS.upperOrbitRadius) < 1e-9))
  assert.ok(LANDINGS.heights[0] < 5.25, 'the existing leaf bands are lowered slightly')
  assert.ok(LANDINGS.heights.at(-1) > 12.75, 'a higher leaf band extends upward')
  assert.equal(LANDINGS.orbitRadius, 14.5)
  assert.ok(ARENA.radius - LANDINGS.orbitRadius - LANDINGS.radius >= 1.7)
  for (let time = 0; time <= 45; time += 0.5) {
    const positions = landingSlots.map(slot => orbitPoint(slot, time))
    assert.ok(positions.every(p => p.y >= LANDINGS.heights[0] &&
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
      const touch = { x: p.x, y: surfaceY(observedPlatform, p.x, p.z), z: p.z }
      Transform.getMutable(player).position = { ...touch, y: touch.y + 0.88 }
      footCallbacks[0]({ hits: [{ entityId: observedPlatform, position: touch, length: LANDINGS.contactEpsilon / 2 }] })
      await engine.update(0.05); await engine.update(0.05)
      assert.equal(PhysicsCombinedForce.has(player), false) // stable landing allows a normal jump
      stoodOnPlatform = true
    }
    if (observedPlatform && leafSolid(observedPlatform)) {
      const p = Transform.get(observedPlatform).position
      const radius = Math.hypot(p.x - 24, p.z - 24)
      const expectedRadius = p.y > (LANDINGS.heights[1] + LANDINGS.heights[2]) / 2
        ? LANDINGS.upperOrbitRadius : LANDINGS.orbitRadius
      assert.ok(Math.abs(radius - expectedRadius) <= LANDINGS.radialWobble + 1e-6)
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
  assert.equal([...engine.getEntitiesWith(ecs.MeshRenderer)].length, 187) // Includes expanded leaves/orbs and the airtime badge; no wind planes.
  await engine.update(2)
  assert.equal(activeLeaves().length, 0) // no collider sweep after suspension

  await t.test('real entry point animates every frame and emits lift with a paused timer/unlocked pointer', async () => {
    const { BUBBLES } = require('../src/bubble-rules.ts')
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
    assert.deepEqual(impulse.vector, { x: 0, y: BUBBLES.mobileImpulse, z: 0 })
    assert.equal(display.time, score) // Physical recovery never adds time directly.
    await frame()
    assert.ok(Transform.get(body).scale.x < BUBBLES.radius * 2)
    assert.equal(ecs.PhysicsCombinedImpulse.get(player).eventId, impulse.eventId)
    ecs.PointerLock.deleteFrom(engine.CameraEntity)
    await engine.update(2)
  })

  await t.test('one-frame visible-mesh foot ray starts leaf collapse before the next airtime sample', async () => {
    const away = { x: 24, y: 2, z: 24 }
    Transform.getMutable(player).position = away
    for (let i = 0; i < 400; i++) await engine.update(0.05)
    const ids = activeLeaves()
    assert.ok(ids.length > 0 && ids.length <= LANDINGS.count)
    const target = ids[0], p = { ...Transform.get(target).position }
    const radius = Math.hypot(p.x - 24, p.z - 24)
    const radial = { x: (p.x - 24) / radius, z: (p.z - 24) / radius }
    const hit = { x: p.x, y: surfaceY(target, p.x, p.z), z: p.z }
    const edge = { x: hit.x, y: hit.y + 0.88, z: hit.z }
    let tick = 2000
    const frame = async () => {
      ecs.EngineInfo.createOrReplace(engine.RootEntity, { tickNumber: tick, frameNumber: tick++, totalRuntime: 60 })
      await engine.update(1 / 60)
    }
    Transform.getMutable(player).position = { ...edge, y: edge.y + 0.8 }
    await frame()
    Transform.getMutable(player).position = edge
    // Inject a short local-foot ray hit; the fixture does not simulate collision physics.
    footCallbacks[0]({ hits: [{ entityId: target, length: LANDINGS.contactEpsilon / 2,
      normalHit: { x: 0, y: 1, z: 0 }, position: hit }] })
    await frame()
    assert.equal(PhysicsCombinedForce.has(player), false)
    footCallbacks[0]({ hits: [] })
    Transform.getMutable(player).position = away // A single brief touch must be enough.
    // The native hit arms immediately, before the first rendered contact frame advances.
    for (let i = 0; i < 118; i++) await frame()
    assert.equal(leafSolid(target), true)
    await frame()
    assert.equal(leafSolid(target), false)
    assert.ok(ids.slice(1).every(leafSolid))
    await engine.update(2)
  })

  await t.test('leaf collapse requires the local feet point to touch its visible mesh from any direction', async () => {
    const away = { x: 24, y: 2, z: 24 }
    Transform.getMutable(player).position = away
    for (let i = 0; i < 400; i++) await engine.update(0.05)
    const ids = activeLeaves()
    assert.ok(ids.length > 0 && ids.length <= LANDINGS.count)
    const leafIds = new Set(ids)
    assert.ok([...engine.getEntitiesWith(ecs.TriggerArea)].every(([id]) => !leafIds.has(id)))
    const target = ids[0], manager = require('../src/landing-platforms.ts').createLandingPlatforms(() => 0)
    const managerIds = [...engine.getEntitiesWith(GltfContainer)]
      .filter(([, model]) => model.src === leafSource).map(([id]) => id).slice(-LANDINGS.count)
    for (let i = 0; i < 600; i++) manager.update(0.05, away)
    const ownTarget = managerIds[0], p = Transform.get(ownTarget).position
    const hit = { x: p.x, y: p.y + LANDINGS.thickness / 2, z: p.z }
    const feet = { x: hit.x, y: hit.y + 0.88, z: hit.z }
    assert.equal(manager.confirmRayLanding(ownTarget, feet, { ...hit, x: hit.x + 0.01 }, 0.88), false,
      'nearby contact outside the 5 mm ray epsilon is ignored')
    assert.equal(manager.confirmRayLanding(ownTarget, feet, hit, 0.88), true,
      'upward contact with the exact visible mesh point starts the timer')
    assert.equal(manager.checkLanding(ownTarget), true)
    for (let i = 0; i < 40; i++) manager.update(0.05, away)
    assert.equal(leafSolid(ownTarget), false)

    const targetHit = { x: Transform.get(target).position.x,
      y: Transform.get(target).position.y + LANDINGS.thickness / 2,
      z: Transform.get(target).position.z }
    Transform.getMutable(player).position = { ...targetHit, y: targetHit.y + 0.88 }
    assert.ok(footCallbacks.length >= 6)
    for (const hitFromSide of footCallbacks) hitFromSide({ hits: [{ entityId: target,
      length: LANDINGS.contactEpsilon / 2, normalHit: { x: 1, y: 0, z: 0 }, position: targetHit }] })
    let tick = 3000
    const frame = async (dt = 1 / 60) => {
      ecs.EngineInfo.createOrReplace(engine.RootEntity, { tickNumber: tick, frameNumber: tick++, totalRuntime: 100 })
      await engine.update(dt)
    }
    await frame()
    for (let i = 0; i < 118; i++) await frame()
    assert.equal(leafSolid(target), true)
    await frame()
    assert.equal(leafSolid(target), false)
  })

  await t.test('forty-eight opaque platforms wait for landing, last two seconds and fall independently', () => {
    const { createLandingPlatforms } = require('../src/landing-platforms.ts')
    const before = new Set(leafEntities())
    const platforms = createLandingPlatforms(() => 0)
    const ids = leafEntities().filter(id => !before.has(id))
    const active = () => ids.filter(leafSolid)
    const away = { x: 24, y: 2, z: 24 }
    const step = () => {
      platforms.update(0.05, away)
      for (const entity of ids.filter(id => ecs.VisibilityComponent.get(id).visible)) {
        assert.equal(ecs.VisibilityComponent.get(entity).visible, true)
        assert.equal(GltfContainer.get(entity).src, leafSource)
      }
    }
    for (let i = 0; i < 600; i++) step()
    assert.equal(ids.length, LANDINGS.count)
    assert.equal(active().length, LANDINGS.count)
    for (let i = 0; i < 1200; i++) step() // Another minute untouched: no age-based expiry.
    assert.deepEqual(active(), ids)
    const target = ids[0]
    const standing = () => {
      const p = Transform.get(target).position
      return { x: p.x, y: p.y + LANDINGS.thickness / 2 + 0.88, z: p.z }
    }
    const hit = { x: standing().x, y: standing().y - 0.88, z: standing().z }
    assert.equal(platforms.confirmRayLanding(target, standing(), { ...hit, x: hit.x + 0.01 }, 0.88), false)
    assert.equal(platforms.confirmRayLanding(target, standing(), hit, 0.88), true) // Upward contact also counts.
    for (let i = 0; i < 200; i++) step()
    assert.ok(ids.every(leafSolid))
    assert.equal(platforms.checkLanding(target), true)
    for (let i = 0; i < 38; i++) {
      step()
      if (i % 10 === 0) platforms.checkLanding(target) // Re-entry cannot refresh the deadline.
    }
    assert.equal(leafSolid(target), true) // Still solid at 1.9 s after landing.
    const height = Transform.get(target).position.y
    step(); step()
    assert.equal(leafSolid(target), false) // Releases at 2.0 s, not eight seconds.
    step()
    assert.equal(leafSolid(target), false)
    assert.equal(ecs.VisibilityComponent.get(target).visible, true)
    assert.ok(Transform.get(target).position.y < height) // Opaque falling visual, collision already removed.
    assert.equal(platforms.checkLanding(target), false)
    assert.ok(ids.slice(1).every(leafSolid))
    for (let i = 0; i < 80; i++) step()
    assert.ok(active().length <= LANDINGS.count)
    assert.ok(ids.slice(1).every(leafSolid))
    platforms.update(2, away)
  })

  await t.test('only short rays that hit a visible leaf start its fall timer', () => {
    const { createLandingPlatforms } = require('../src/landing-platforms.ts')
    const before = new Set(leafEntities())
    const platforms = createLandingPlatforms(() => 0), away = { x: 24, y: 2, z: 24 }
    const ids = leafEntities().filter(id => !before.has(id))
    for (let i = 0; i < 600; i++) platforms.update(0.05, away)
    assert.equal(ids.length, LANDINGS.count)
    assert.ok(ids.every(leafSolid))
    const id = ids[0], p = Transform.get(id).position
    const hit = { x: p.x, y: p.y + LANDINGS.thickness / 2, z: p.z }
    const feet = { x: hit.x, y: hit.y + 0.88, z: hit.z }
    assert.equal(platforms.confirmRayLanding(id, feet, { ...hit, z: hit.z + 0.02 }, 0.88), false)
    assert.equal(leafSolid(id), true)
    assert.equal(platforms.confirmRayLanding(id, feet, hit, 0.88), true)
    for (let i = 0; i < 119; i++) platforms.update(1 / 60, away)
    assert.equal(leafSolid(id), true)
    platforms.update(1 / 60, away)
    assert.equal(leafSolid(id), false)
    platforms.update(2, away)
  })

  await t.test('confirmed foot contact starts the leaf countdown', () => {
    const { createLandingPlatforms } = require('../src/landing-platforms.ts')
    const before = new Set(leafEntities())
    const platforms = createLandingPlatforms(() => 0.25), away = { x: 24, y: 2, z: 24 }
    const ids = leafEntities().filter(id => !before.has(id))
    for (let i = 0; i < 400; i++) platforms.update(0.05, away)
    const target = ids.find(leafSolid)
    assert.ok(target)
    const p = Transform.get(target).position
    const standing = { x: p.x, y: p.y + LANDINGS.thickness / 2 + 0.88, z: p.z }
    const hit = { x: p.x, y: p.y + LANDINGS.thickness / 2, z: p.z }
    assert.equal(platforms.confirmRayLanding(target, standing, hit, 0.88), true)
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
      const bodies = ids.filter(id => Transform.get(id).parent === engine.RootEntity &&
        ecs.MeshRenderer.get(id).mesh.$case === 'sphere' && Transform.get(id).scale.x > 0.2)
      const sound = [...engine.getEntitiesWith(ecs.AudioSource)].map(([id]) => id).find(id => !beforeAudio.has(id))
      return { manager, ids, bodies, sound }
    }
    const a = field(), b = field(), obstructed = field(() => true), away = { x: 24, y: 2, z: 24 }
    const step = (f, position = away, canPop = false, velocity = 0) => f.manager.update(0.05, position, velocity, false, canPop)
    for (let i = 0; i < 100; i++) { step(a); step(b); step(obstructed) }
    assert.equal(a.bodies.length, BUBBLES.count)
    assert.deepEqual(a.bodies.map(id => Transform.get(id).position),
      b.bodies.map(id => Transform.get(id).position), 'matching orb indices keep matching positions across local clients')
    assert.ok(a.ids.every(id => !ecs.MeshCollider.has(id)))
    assert.ok(obstructed.ids.every(id => !ecs.VisibilityComponent.get(id).visible))
    const target = a.bodies.find(id => ecs.VisibilityComponent.get(id).visible)
    const sparkIds = a.ids.filter(id => ecs.MeshRenderer.get(id).mesh.$case === 'sphere' &&
      Transform.get(id).scale.x < 0.2)
    assert.equal(sparkIds.length, BUBBLES.particleCount)
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
    for (let i = 0; i < 6; i++) step(a)
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
    assert.equal(a.ids.length, BUBBLES.count * 2 + BUBBLES.particleCount) // Bodies, overlays and reusable glitter.
  })

  await t.test('rocks2 use visible geometry, bob on landing, and fall independently in 0.3 seconds', () => {
    const { createRockField } = require('../src/rock-field.ts')
    const { TUNING } = require('../src/tuning.ts')
    const { ROCK_LAYOUT } = require('../src/rock-layout.ts')
    const rocks = createRockField()
    const entries = [...engine.getEntitiesWith(GltfContainer)]
      .filter(([, model]) => model.src.startsWith('assets/models/rock-pieces/rock-'))
    assert.equal(rocks.count, 158)
    assert.equal(entries.length, 158)
  assert.ok(entries.every(([, model]) => model.visibleMeshesCollisionMask ===
    (ecs.ColliderLayer.CL_POINTER | ecs.ColliderLayer.CL_PHYSICS) &&
    model.invisibleMeshesCollisionMask === ecs.ColliderLayer.CL_NONE))
  assert.ok(entries.every(([id]) => {
    const scale = Transform.get(id).scale
    return scale.x === 1.2 && scale.y === 1.2 && scale.z === 1.2
  }), 'visible rock colliders are uniformly enlarged with the meshes')
    const [first, second] = entries.map(([id]) => id)
    const firstHome = { ...Transform.get(first).position }
    const secondHome = { ...Transform.get(second).position }
    assert.equal(rocks.stepOn(first), true)
    assert.equal(rocks.stepOn(first), false)
    rocks.update(0.05, { x: 24, y: 2, z: 24 })
    assert.ok(Transform.get(first).position.y > firstHome.y)
    for (let i = 0; i < 18; i++) rocks.update(0.05, { x: 24, y: 2, z: 24 })
    assert.equal(GltfContainer.get(first).visibleMeshesCollisionMask, ecs.ColliderLayer.CL_POINTER | ecs.ColliderLayer.CL_PHYSICS)
    rocks.update(0.05, { x: 24, y: 2, z: 24 })
    assert.equal(GltfContainer.get(first).visibleMeshesCollisionMask, ecs.ColliderLayer.CL_NONE)
    assert.equal(GltfContainer.get(second).visibleMeshesCollisionMask, ecs.ColliderLayer.CL_POINTER | ecs.ColliderLayer.CL_PHYSICS)
    rocks.update(TUNING.rocks.fallDuration / 2, { x: 24, y: 2, z: 24 })
    assert.ok(Transform.get(first).position.y < firstHome.y)
    assert.equal(Transform.get(second).position.x, secondHome.x)
    assert.equal(Transform.get(second).position.z, secondHome.z)
    rocks.update(TUNING.rocks.fallDuration / 2, { x: 24, y: 2, z: 24 })
    assert.equal(ecs.VisibilityComponent.get(first).visible, false)
    assert.equal(ecs.VisibilityComponent.get(second).visible, true)
    const secondLayout = ROCK_LAYOUT.find(layout => layout.src === entries[1][1].src)
    const activeRock = entries.find(([id, model]) =>
      GltfContainer.get(id).visibleMeshesCollisionMask === (ecs.ColliderLayer.CL_POINTER | ecs.ColliderLayer.CL_PHYSICS) &&
      ecs.VisibilityComponent.get(id).visible && ROCK_LAYOUT.some(layout => layout.src === model.src))
    const activeTransform = Transform.get(activeRock[0]), activeLayout = ROCK_LAYOUT.find(item => item.src === activeRock[1].src)
    const onRock = { x: activeTransform.position.x + (activeLayout.minX + activeLayout.maxX) / 2,
      y: activeTransform.position.y + activeLayout.maxY + 0.88,
      z: activeTransform.position.z + (activeLayout.minZ + activeLayout.maxZ) / 2 }
    assert.equal(rocks.isPlayerTouchingRock(onRock), true,
      'rock contact is separately identifiable from the broad lava-disk trigger')
    assert.equal(rocks.isPlayerSupportedByRock(onRock), true,
      'standing on the visible rock bounds is recognized even if the raycast misses')
    const lowestLayout = ROCK_LAYOUT.find(layout => layout.src.endsWith('rock-118.glb'))
    const lowestRock = entries.find(([, model]) => model.src === lowestLayout.src)[0]
    const lowestTransform = Transform.get(lowestRock)
    assert.equal(rocks.isPlayerTouchingRock({
      x: lowestTransform.position.x + (lowestLayout.minX + lowestLayout.maxX) / 2,
      y: lowestTransform.position.y + lowestLayout.maxY + 0.88,
      z: lowestTransform.position.z + (lowestLayout.minZ + lowestLayout.maxZ) / 2
    }), true, 'standing on a rock embedded below the floor marker still counts as rock contact')
    assert.equal(rocks.isPlayerSupportedByRock({
      x: lowestTransform.position.x + (lowestLayout.minX + lowestLayout.maxX) / 2,
      y: lowestTransform.position.y + lowestLayout.maxY * 1.2 + 0.88,
      z: lowestTransform.position.z + (lowestLayout.minZ + lowestLayout.maxZ) / 2
    }), true, 'low stones do not get mistaken for a lava-floor reset')
    const sideContact = { x: secondHome.x + secondLayout.maxX + 0.15,
      y: secondHome.y + (secondLayout.minY + secondLayout.maxY) / 2,
      z: secondHome.z + (secondLayout.minZ + secondLayout.maxZ) / 2 }
    rocks.update(0.05, sideContact)
    rocks.update(0.05, sideContact)
    assert.ok(Transform.get(second).position.y > secondHome.y,
      'airborne side contact anywhere along the visible mesh bounds starts the hit bob')

    const idle = entries.map(([id, model]) => ({ id, layout: ROCK_LAYOUT.find(item => item.src === model.src) }))
      .find(({ id, layout }) => layout && ecs.VisibilityComponent.getOrNull(id)?.visible &&
        [...engine.getEntitiesWith(ecs.TriggerArea)].some(([sensor]) => {
          const p = Transform.get(sensor).position
          return Math.abs(p.x - (24 + layout.x + (layout.minX + layout.maxX) / 2 * 1.2)) < 0.001 &&
            Math.abs(p.z - (24 + layout.z + (layout.minZ + layout.maxZ) / 2 * 1.2)) < 0.001
        }))
    assert.ok(idle, 'at least one visible, untouched rock remains ready for idle movement')
    let low = Transform.get(idle.id).position.y, high = low
    for (let i = 0; i < 120; i++) {
      rocks.update(0.05, { x: -100, y: 50, z: -100 })
      const y = Transform.get(idle.id).position.y
      low = Math.min(low, y); high = Math.max(high, y)
    }
    assert.ok(high - low > 0.04, 'untouched rocks hover slowly while idle')

    let riseStarted = false
    for (let i = 0; i < 220; i++) {
      rocks.update(0.05, { x: -100, y: 50, z: -100 })
      if (ecs.VisibilityComponent.get(first).visible &&
          GltfContainer.get(first).visibleMeshesCollisionMask === ecs.ColliderLayer.CL_NONE) {
        riseStarted = true
        break
      }
    }
    assert.ok(riseStarted, 'a collapsed rock reappears at the start of its rising animation')
    const riseStartY = Transform.get(first).position.y
    rocks.update(0.2, { x: -100, y: 50, z: -100 })
    assert.ok(Transform.get(first).position.y > riseStartY, 'the reappearing rock rises smoothly')
    assert.equal(GltfContainer.get(first).visibleMeshesCollisionMask, ecs.ColliderLayer.CL_NONE,
      'the returning rock remains non-colliding until it reaches its home height')
    for (let i = 0; i < TUNING.rocks.riseDuration / 0.05; i++) rocks.update(0.05, { x: -100, y: 50, z: -100 })
    assert.equal(GltfContainer.get(first).visibleMeshesCollisionMask,
      ecs.ColliderLayer.CL_POINTER | ecs.ColliderLayer.CL_PHYSICS)
  })
})
