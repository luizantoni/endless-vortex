import { AudioSource, AvatarLocomotionSettings, ColliderLayer, engine, GltfContainer, InputModifier, Physics, PointerLock, RaycastQueryType, raycastSystem, RealmInfo, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import * as RestrictedActions from '~system/RestrictedActions'
import { getPlayer } from '@dcl/sdk/players'
import * as Runtime from '~system/Runtime'
import * as Environment from '~system/EnvironmentApi'
import { AIRFLOW, inWindArea, liftFor, rotationForce } from './vortex'
import { Airtime } from './airtime'
import { createLandingPlatforms, LANDINGS } from './landing-platforms'
import { display, setupAirtimeUi } from './airtime-ui'
import { Progress } from './progress'
import { TUNING } from './tuning'
import { ARENA, insideArena } from './arena'
import { createRecoveryBubbles } from './bubbles'
import { ORB_REWARD } from './orb-reward'
import { SceneLeaderboard } from './scene-leaderboard'
import { createGlobalLeaderboardBoard } from './global-leaderboard-board'

// Extend the restored movement baseline; keep native steering, jump and gliding.
export function main() {
  // Restore the client's normal steering, jump and glider behavior.
  InputModifier.deleteFrom(engine.PlayerEntity)
  AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)

  const source = 'assets/models/endless_vortex6/endless_vortex6.glb'
  const existing = [...engine.getEntitiesWith(GltfContainer)].find(([, model]) => model.src === source)
  const environment = existing?.[0] ?? engine.addEntity()
  // Keep the authored scene transform when the environment is already in the composite.
  // The visible meshes themselves provide collision; hidden helper meshes do not.
  if (!Transform.has(environment)) Transform.create(environment, { position: ARENA.modelPosition,
    scale: Vector3.create(ARENA.scale, ARENA.scale, ARENA.scale) })
  for (const [entity, model] of engine.getEntitiesWith(GltfContainer)) {
    if (entity !== environment && model.src === 'assets/scene/Models/wind_tunnel2/wind_tunnel2.glb') {
      GltfContainer.deleteFrom(entity)
    }
  }
  GltfContainer.createOrReplace(environment, {
    src: source,
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })

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
  const bubbles = createRecoveryBubbles(platforms.overlaps)
  const sceneLeaderboard = new SceneLeaderboard()
  const globalLeaderboard = createGlobalLeaderboardBoard()
  let nextOrbReward = ORB_REWARD.every
  let rewardReturnUntil = 0, expectedRewardTeleportUntil = 0
  let expectedRewardPosition: { x: number; y: number; z: number } | undefined
  function teleportForOrbReward() {
    const destination = { x: ARENA.center.x, y: ORB_REWARD.height, z: ARENA.center.z }
    expectedRewardPosition = destination
    expectedRewardTeleportUntil = Date.now() + 4000
    rewardReturnUntil = Date.now() + ORB_REWARD.returnGraceSeconds * 1000
    void RestrictedActions.movePlayerTo({ newRelativePosition: destination }).then(result => {
      if (result.success) return
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
  let platform = 'mobile', manualLift = false
  let liftScale: number = AIRFLOW.mobileLift // Gentle fallback until the client identifies itself.
  const setPlatform = (value: string) => {
    if (!manualLift) {
      platform = value
      liftScale = liftFor(value)
      display.lift = liftScale === AIRFLOW.mobileLift ? 'Mobile' : 'Desktop'
    }
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
    } catch { /* The visible lift toggle remains available on unsupported clients. */ }
  })()
  setupAirtimeUi({
    lift: () => {
      playMusic()
      manualLift = true
      liftScale = liftScale === AIRFLOW.mobileLift ? AIRFLOW.desktopLift : AIRFLOW.mobileLift
      display.lift = liftScale === AIRFLOW.mobileLift ? 'Mobile' : 'Desktop'
      platform = display.lift.toLowerCase()
    },
    refresh: () => { playMusic(); void progress.sync() },
    sound: () => {
      display.fx = (display.fx + 25) % 75
      bubbles.setVolume(display.fx / 100)
      AudioSource.getMutable(music).volume = display.fx / 250
      if (display.fx > 0) playMusic()
    }
  })

  const footOffset = 0.88, floorTop = ARENA.floorTop
  const probe = engine.addEntity()
  Transform.create(probe, { parent: engine.PlayerEntity, position: Vector3.create(0, 1, 0) })
  let support: { x: number; y: number; z: number; at: number; entityId?: number } | undefined
  let velocityY = 0
  raycastSystem.registerGlobalDirectionRaycast({ entity: probe, opts: {
    direction: Vector3.Down(), maxDistance: 2.2, collisionMask: ColliderLayer.CL_PHYSICS,
    queryType: RaycastQueryType.RQT_QUERY_ALL, continuous: true
  } }, result => {
    const hit = result.hits.filter(hit => hit.position && (hit.normalHit?.y ?? 0) > 0.5)
      .sort((a, b) => a.length - b.length)[0]
    support = hit?.position ? { ...hit.position, at: Date.now(), entityId: hit.entityId } : undefined
    if (hit?.position) platforms.confirmRayLanding(hit.entityId,
      Transform.getOrNull(engine.PlayerEntity)?.position, hit.position, footOffset, velocityY, hit.length)
  })
  let sampleAccumulator = 0, recordsAccumulator = 1, refreshAccumulator = 30, windRefreshAccumulator = 0
  let lastWall = Date.now(), lastPosition: Vector3 | undefined
  let lastFramePosition: Vector3 | undefined
  let onPlatform = false, localUser = '', wasConnected = false

  engine.addSystem(dt => {
    const position = Transform.getOrNull(engine.PlayerEntity)?.position
    const now = Date.now()
    // Move collision and support geometry together every frame, before grounding checks.
    platforms.update(dt, position)
    const landingVelocityY = position && lastFramePosition && dt > 0 ? (position.y - lastFramePosition.y) / dt : 0
    const rayContact = !!position && !!support && now - support.at < 200 && landingVelocityY <= 0.5 &&
      Math.hypot(position.x - support.x, position.z - support.z) < 0.45 &&
      Math.abs(position.y - footOffset - support.y) <= LANDINGS.nativeSupportTolerance
    // Contact runs every frame: a brief edge landing must start the collapse countdown too.
    const landed = !!position && platforms.checkLanding(position, footOffset, landingVelocityY,
      rayContact ? support!.entityId : undefined)
    const supportedByRay = rayContact && (!platforms.isPlatform(support!.entityId) || landed)
    const supported = landed || supportedByRay
    const floor = !!position && (position.y <= floorTop + footOffset + 0.12 ||
      (supportedByRay && support!.y <= floorTop + 0.15))
    // Only a real landing leaf pauses its updraft. The tunnel's curved collision mesh can
    // also appear in the ground ray and must not switch the central wind off.
    onPlatform = landed && !floor
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
      if (run.update({ dt: sampleDt, wallDt, now, inside, connected, floor, supported,
        moved: !rewardTeleportTransition && distance > 0.001,
        teleported: !rewardTeleportTransition && distance > 4, focused })) {
        progress.record(run.milliseconds, run.day, now)
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
      !!position && connectedForBubbles && insideArena(position))
    const popped = bubbles.getPoppedTotal()
    if (popped >= nextOrbReward) {
      nextOrbReward = (Math.floor(popped / ORB_REWARD.every) + 1) * ORB_REWARD.every
      if (position && insideArena(position)) teleportForOrbReward()
    } else if (bubbleImpulse > 0) {
      Physics.applyImpulseToPlayer(Vector3.create(0, bubbleImpulse, 0))
    }
    display.orbs = popped
    display.energy = position ? Math.round(Math.max(0, Math.min(1, position.y / ARENA.height)) * 100) : 0
    display.altitude = position ? Math.max(0, position.y).toFixed(1) : '0.0'
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
      globalLeaderboard.update(progress.rows, progress.status)
      display.medals = progress.medalLabel()
      display.storage = progress.status
    }
  })
}
