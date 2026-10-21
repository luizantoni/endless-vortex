import { Animator, AudioSource, AvatarLocomotionSettings, ColliderLayer, engine, Entity, GltfContainer, InputModifier, Physics, PointerLock, RaycastQueryType, raycastSystem, RealmInfo, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import * as RestrictedActions from '~system/RestrictedActions'
import { getPlayer } from '@dcl/sdk/players'
import * as Runtime from '~system/Runtime'
import * as Environment from '~system/EnvironmentApi'
import { AIRFLOW, inWindArea, liftFor, rotationForce } from './vortex'
import { Airtime, FloorContactLatch } from './airtime'
import { createLandingPlatforms, LANDINGS } from './landing-platforms'
import { display, setupAirtimeUi } from './airtime-ui'
import { Progress } from './progress'
import { TUNING } from './tuning'
import { ARENA, insideArena } from './arena'
import { createRecoveryBubbles } from './bubbles'
import { ORB_REWARD } from './orb-reward'
import { SceneLeaderboard } from './scene-leaderboard'
import { createRockField } from './rock-field'
import { createBlueLavaVortex } from './blue-lava-vortex'
import { createFloorResetPlatform, crossedLocalPlayerResetPlane } from './floor-reset-platform'
import { createAvatarAirtimeBadge } from './avatar-airtime-badge'

const ORCHARD_SCALE = ARENA.size / 44 * 1.2
const WIND_LAYER_SPACING = 3
const WIND_POSITION_VARIANCE = 0.2
const WIND_ANIMATION_VARIANCE = 0.2

// Extend the restored movement baseline; keep native steering, jump and gliding.
export function main() {
  // Restore the client's normal steering, jump and glider behavior.
  InputModifier.deleteFrom(engine.PlayerEntity)
  AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)

  const source = 'assets/models/orchard.glb'
  const previousSource = 'assets/models/endless-vortex-plants.glb'
  const windSource = 'assets/models/endless-vortex-wind.glb'
  const models = [...engine.getEntitiesWith(GltfContainer)]
  const environment = models.find(([, model]) => model.src === source)?.[0] ??
    models.find(([, model]) => model.src === previousSource)?.[0] ??
    engine.addEntity()
  // Preserve the orchard's aspect ratio while enlarging the authored scene by 20%.
  if (!Transform.has(environment)) Transform.create(environment, { position: { x: 23.75, y: 0, z: 24.25 },
    scale: Vector3.create(ORCHARD_SCALE, ORCHARD_SCALE, ORCHARD_SCALE) })
  else {
    const authoredTransform = Transform.getMutable(environment)
    authoredTransform.position.y = 0
    authoredTransform.scale = Vector3.create(ORCHARD_SCALE, ORCHARD_SCALE, ORCHARD_SCALE)
  }
  for (const [entity, model] of models) {
    if (entity !== environment && (model.src === previousSource || model.src === 'assets/models/rocks.glb' ||
        model.src === 'assets/models/rocks2.glb' ||
        model.src === 'assets/models/endless_vortex6/endless_vortex6.glb' ||
        model.src === 'assets/scene/Models/wind_tunnel2/wind_tunnel2.glb')) {
      GltfContainer.deleteFrom(entity)
      Animator.deleteFrom(entity)
    }
  }
  GltfContainer.createOrReplace(environment, {
    src: source,
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  Animator.deleteFrom(environment)
  const existingWind = models.filter(([, model]) => model.src === windSource).map(([entity]) => entity)
  const plantsTransform = Transform.get(environment)
  for (let layer = 0; layer < 3; layer++) {
    const wind = existingWind[layer] ?? engine.addEntity()
    const offset = () => (Math.random() * 2 - 1) * WIND_POSITION_VARIANCE
    const animationSpeed = 1 + (Math.random() * 2 - 1) * WIND_ANIMATION_VARIANCE
    Transform.createOrReplace(wind, { position: {
      x: plantsTransform.position.x + offset() * ARENA.scale,
      y: plantsTransform.position.y + layer * WIND_LAYER_SPACING + offset() * WIND_LAYER_SPACING,
      z: plantsTransform.position.z + offset() * ARENA.scale
    },
      rotation: { ...plantsTransform.rotation }, scale: { ...plantsTransform.scale } })
    GltfContainer.createOrReplace(wind, { src: windSource,
      visibleMeshesCollisionMask: ColliderLayer.CL_NONE, invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })
    Animator.createOrReplace(wind, { states: [{ clip: 'Animation', playing: true, loop: true, speed: animationSpeed }] })
  }
  createBlueLavaVortex()

  const music = engine.addEntity()
  Transform.create(music, { parent: engine.PlayerEntity })
  const musicClip = 'assets/sounds/looped-theme.mp3'
  AudioSource.create(music, { audioClipUrl: musicClip, playing: false,
    loop: true, global: true, volume: 0.2 })
  const playMusic = () => AudioSource.playSound(music, musicClip, false)
  let musicStartDelay = 0.35
  const startMusic = (dt: number) => {
    musicStartDelay -= dt
    if (musicStartDelay > 0) return
    playMusic()
    engine.removeSystem(startMusic)
  }
  engine.addSystem(startMusic)

  const swirlSource = engine.addEntity()
  const zones = AIRFLOW.zones.map(zone => ({ zone, source: engine.addEntity(), strength: 0 }))
  const platforms = createLandingPlatforms()
  const rocks = createRockField()
  const bubbles = createRecoveryBubbles(platforms.overlaps)
  const airtimeBadge = createAvatarAirtimeBadge()
  const sceneLeaderboard = new SceneLeaderboard()
  let nextOrbReward = ORB_REWARD.every
  let rewardReturnUntil = 0, expectedRewardTeleportUntil = 0
  let expectedRewardPosition: { x: number; y: number; z: number } | undefined
  function teleportForOrbReward() {
    const destination = { x: ARENA.center.x, y: ORB_REWARD.height, z: ARENA.center.z }
    expectedRewardPosition = destination
    expectedRewardTeleportUntil = Date.now() + 4000
    rewardReturnUntil = Date.now() + ORB_REWARD.returnGraceSeconds * 1000
    void RestrictedActions.movePlayerTo({ newRelativePosition: destination }).then(result => {
      if (result.success) {
        bubbles.explodeAccumulation()
        display.rewardCelebration++
        return
      }
      expectedRewardPosition = undefined
      expectedRewardTeleportUntil = rewardReturnUntil = 0
      console.error('The ten-orb teleport could not be completed.')
    }).catch(() => {
      expectedRewardPosition = undefined
      expectedRewardTeleportUntil = rewardReturnUntil = 0
      console.error('The ten-orb teleport could not be completed.')
    })
  }
  let run = new Airtime()
  const progress = new Progress('')
  let platform = 'mobile'
  let liftScale: number = AIRFLOW.mobileLift // Gentle fallback until the client identifies itself.
  const setPlatform = (value: string) => {
    display.touchControls = /mobile|android|ios|iphone|ipad/i.test(value)
    platform = value
    liftScale = liftFor(value)
  }
  // Older preview clients omit this API. Detection never gates scene startup.
  void (async () => {
    try {
      if (typeof Runtime.getExplorerInformation === 'function') {
        const info = await Runtime.getExplorerInformation({})
        if (info.platform) { setPlatform(`${info.platform} ${info.agent}`); return }
      }
    } catch { /* Try the legacy platform API. */ }
    try {
      if (typeof Environment.getPlatform === 'function') {
        const info = await Environment.getPlatform({})
        if (info.platform) setPlatform(info.platform)
      }
    } catch { /* Keep the gentle fallback on unsupported clients. */ }
  })()
  const uiClick = engine.addEntity()
  Transform.create(uiClick, { parent: engine.PlayerEntity })
  AudioSource.create(uiClick, { audioClipUrl: 'assets/sounds/ui-click.wav', playing: false, global: true, volume: .35 })
  setupAirtimeUi({ onUiClick: () => AudioSource.playSound(uiClick, 'assets/sounds/ui-click.wav', true) })

  const footOffset = 0.88, floorTop = ARENA.floorTop, groundSupportTolerance = 0.4
  const floorResetPlatform = createFloorResetPlatform()
  const probe = engine.addEntity()
  Transform.create(probe, { parent: engine.PlayerEntity, position: Vector3.create(0, footOffset + 0.12, 0) })
  let support: { x: number; y: number; z: number; at: number; entityId?: number } | undefined
  let velocityY = 0
  raycastSystem.registerGlobalDirectionRaycast({ entity: probe, opts: {
    direction: Vector3.Down(), maxDistance: 2.2, collisionMask: ColliderLayer.CL_PHYSICS,
    queryType: RaycastQueryType.RQT_QUERY_ALL, continuous: true
  } }, result => {
    const hit = result.hits.filter(hit => hit.position && (hit.normalHit?.y ?? 0) > 0.5)
      .sort((a, b) => a.length - b.length)[0]
    support = hit?.position ? { ...hit.position, at: Date.now(), entityId: hit.entityId } : undefined
  })
  let footLeafContact: { entityId: Entity; at: number } | undefined
  const contactReach = LANDINGS.contactEpsilon
  const footRays = [
    { offset: Vector3.create(0, -footOffset + contactReach / 2, 0), direction: Vector3.Down() },
    { offset: Vector3.create(0, -footOffset - contactReach / 2, 0), direction: Vector3.Up() },
    { offset: Vector3.create(-contactReach / 2, -footOffset, 0), direction: Vector3.Right() },
    { offset: Vector3.create(contactReach / 2, -footOffset, 0), direction: Vector3.Left() },
    { offset: Vector3.create(0, -footOffset, -contactReach / 2), direction: Vector3.Forward() },
    { offset: Vector3.create(0, -footOffset, contactReach / 2), direction: Vector3.Backward() }
  ]
  for (const ray of footRays) {
    const footProbe = engine.addEntity()
    Transform.create(footProbe, { parent: engine.PlayerEntity, position: ray.offset })
    raycastSystem.registerGlobalDirectionRaycast({ entity: footProbe, opts: {
      direction: ray.direction, maxDistance: contactReach, collisionMask: ColliderLayer.CL_PHYSICS,
      queryType: RaycastQueryType.RQT_QUERY_ALL, continuous: true
    } }, result => {
      const position = Transform.getOrNull(engine.PlayerEntity)?.position
      if (!position) return
      for (const hit of result.hits) {
        if (hit.position && platforms.confirmRayLanding(hit.entityId, position, hit.position, footOffset)) {
          footLeafContact = { entityId: hit.entityId as Entity, at: Date.now() }
          return
        }
      }
    })
  }
  let sampleAccumulator = 0, recordsAccumulator = 1, refreshAccumulator = 30, windRefreshAccumulator = 0
  let lastWall = Date.now(), lastPosition: Vector3 | undefined
  let lastFramePosition: Vector3 | undefined
  let onPlatform = false, localUser = '', wasConnected = false
  const floorContact = new FloorContactLatch()

  engine.addSystem(dt => {
    const position = Transform.getOrNull(engine.PlayerEntity)?.position
    const now = Date.now()
    const sharedPlayers = sceneLeaderboard.positions()
    if (position && !sharedPlayers.some(other => Vector3.distance(position, other) < 0.01)) {
      sharedPlayers.push({ ...position })
    }
    // Move collision and support geometry together every frame, before grounding checks.
    platforms.update(dt, position, sharedPlayers)
    rocks.update(dt, position)
    const landingVelocityY = position && lastFramePosition && dt > 0 ? (position.y - lastFramePosition.y) / dt : 0
    const rayContact = !!position && !!support && now - support.at < 200 && landingVelocityY <= 0.5 &&
      Math.hypot(position.x - support.x, position.z - support.z) < 0.45 &&
      Math.abs(position.y - footOffset - support.y) <= groundSupportTolerance
    if (rayContact) rocks.stepOn(support!.entityId as Entity | undefined)
    // Contact runs every frame: a brief edge landing must start the collapse countdown too.
    const landed = !!position && !!footLeafContact && now - footLeafContact.at < 100 &&
      platforms.checkLanding(footLeafContact.entityId)
    if (footLeafContact && now - footLeafContact.at >= 100) footLeafContact = undefined
    const supportedByRay = rayContact && (!platforms.isPlatform(support!.entityId) || landed)
    const supported = landed || supportedByRay
    const groundAltitude = position ? position.y - footOffset - floorTop : Infinity
    floorContact.record(floorResetPlatform.consumeContact() ||
      (!!position && !!lastFramePosition && crossedLocalPlayerResetPlane(lastFramePosition, position, footOffset)))
    // Only a real landing leaf pauses its updraft. The tunnel's curved collision mesh can
    // also appear in the ground ray and must not switch the central wind off.
    onPlatform = landed
    lastFramePosition = position ? { ...position } : undefined
    sampleAccumulator += dt
    if (sampleAccumulator >= 0.05) {
      const sampleDt = sampleAccumulator, wallDt = (now - lastWall) / 1000
      sampleAccumulator = 0; lastWall = now
      const distance = position && lastPosition ? Vector3.distance(position, lastPosition) : 0
      const rewardTeleportPending = !!expectedRewardPosition && now <= expectedRewardTeleportUntil
      const expectedRewardTeleport = !!position && rewardTeleportPending &&
        Vector3.distance(position, expectedRewardPosition!) <= 2
      // A movePlayerTo transform can be observed between samples before it lands exactly at
      // its destination. Treat that large jump as the same intentional relocation, not a run-ending escape.
      const rewardTeleportTransition = expectedRewardTeleport || (rewardTeleportPending && distance > 4)
      if (expectedRewardTeleport || now > expectedRewardTeleportUntil) expectedRewardPosition = undefined
      velocityY = position && lastPosition ? (position.y - lastPosition.y) / sampleDt : 0
      if (expectedRewardTeleport) velocityY = 0
      const realm = RealmInfo.getOrNull(engine.RootEntity)
      if (realm?.isConnectedSceneRoom === true) wasConnected = true
      const connected = !!position && !(wasConnected && realm?.isConnectedSceneRoom === false)
      const inside = !!position && (rewardTeleportTransition || insideArena(position,
        now <= rewardReturnUntil ? ORB_REWARD.returnHeight : undefined))
      const pointer = PointerLock.getOrNull(engine.CameraEntity)
      const focused = /mobile|android|ios|iphone|ipad/i.test(platform) || !pointer || pointer.isPointerLocked
      const completedMilliseconds = run.milliseconds, completedDay = run.day
      if (run.update({ dt: sampleDt, wallDt, now, inside, connected, floor: floorContact.consume(), supported,
        moved: !rewardTeleportTransition && distance > 0.001,
        teleported: !rewardTeleportTransition && distance > 4, focused })) {
        progress.record(completedMilliseconds, completedDay, now)
      }
      lastPosition = position ? { ...position } : undefined
      display.time = (run.milliseconds / 1000).toFixed(3)
      display.best = (progress.bestMs / 1000).toFixed(3)
      display.state = run.reason
    }
    // Visual motion and contact run every frame, independent of score sampling or cursor mode.
    // A finished/paused attempt must not disable the basic bubble recovery mechanic.
    const connectedForBubbles = !(wasConnected && RealmInfo.getOrNull(engine.RootEntity)?.isConnectedSceneRoom === false)
    const bubbleImpulse = bubbles.update(dt, position, velocityY, liftScale === AIRFLOW.mobileLift,
      !!position && connectedForBubbles && insideArena(position), sharedPlayers)
    const popped = bubbles.getPoppedTotal()
    if (popped >= nextOrbReward) {
      nextOrbReward = (Math.floor(popped / ORB_REWARD.every) + 1) * ORB_REWARD.every
      if (position && insideArena(position)) teleportForOrbReward()
    } else if (bubbleImpulse > 0) {
      Physics.applyImpulseToPlayer(Vector3.create(0, bubbleImpulse, 0))
    }
    display.orbs = Math.max(0, Math.min(ORB_REWARD.every,
      popped - (nextOrbReward - ORB_REWARD.every)))
    airtimeBadge.update(localUser, run.milliseconds / 1000, dt)
    display.energy = Math.round(Math.max(0, Math.min(1, groundAltitude / ARENA.height)) * 100)
    display.altitudeMeters = Number.isFinite(groundAltitude) ? Math.max(0, groundAltitude) : 0
    display.altitude = display.altitudeMeters.toFixed(1)
    const sceneRows = sceneLeaderboard.update(dt, localUser, run.milliseconds / 1000, run.reason)
    if (sceneRows) display.rows = sceneRows
    // Reassert steady wind occasionally. Multiplayer CRDT traffic can briefly remove the
    // local player's combined-force component while the player remains inside one zone.
    windRefreshAccumulator += dt
    const refreshWind = windRefreshAccumulator >= 0.25
    if (refreshWind) windRefreshAccumulator = 0
    for (const item of zones) {
      const enabled = !AIRFLOW.centralOnly || item.zone.id === 'central'
      const strength = enabled && position && position.y >= AIRFLOW.forceMinY && !onPlatform &&
        inWindArea(position, item.zone) ? item.zone.lift * liftScale : 0
      if (strength === item.strength && !(refreshWind && strength > 0)) continue
      item.strength = strength
      if (strength) Physics.applyForceToPlayer(item.source, Vector3.create(0, strength, 0))
      else Physics.removeForceFromPlayer(item.source)
    }

    const force = position && !onPlatform ? rotationForce(position) : undefined
    if (force) Physics.applyForceToPlayer(swirlSource, Vector3.create(force.x, 0, force.z))
    else Physics.removeForceFromPlayer(swirlSource)

    recordsAccumulator += dt; refreshAccumulator += dt
    if (recordsAccumulator >= 1) {
      recordsAccumulator = 0
      const player = getPlayer()
      if (player && player.userId !== localUser) {
        // Discard any attempt from a previous signed-in player before changing records owner.
        if (localUser) run = new Airtime()
        localUser = player.userId
        display.localUser = player.userId
        progress.identify(player.userId, player.name)
        refreshAccumulator = 30
      }
      progress.url = RealmInfo.getOrNull(engine.RootEntity)?.isPreview ? TUNING.persistence.previewUrl : TUNING.persistence.publicUrl
      progress.rollover(now)
      if (refreshAccumulator >= TUNING.persistence.refreshSeconds) { refreshAccumulator = 0; void progress.sync() }
      display.medals = progress.medalLabel()
      display.storage = progress.status
    }
  })
}
