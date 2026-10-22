import { presentFlightResult, presentLanding } from './flight-feedback'
import { isServer as serverRole } from '~system/EngineApi'
import { startFlightServer } from './flight-server'
import { authoritativeFlight, startFlightClient, sendFlightInput } from './flight-client'
import { clearForTakeoff, touchingLava } from './lava-contact'
import { heldGlideBrake } from './glide-assist'
import { Animator, AudioSource, AvatarLocomotionSettings, ColliderLayer, engine, Entity, GltfContainer, InputModifier, InputAction, inputSystem, Physics, PointerLock, RaycastQueryType, raycastSystem, RealmInfo, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import * as RestrictedActions from '~system/RestrictedActions'
import { getPlayer } from '@dcl/sdk/players'
import * as Runtime from '~system/Runtime'
import * as Environment from '~system/EnvironmentApi'
import { AIRFLOW, inWindArea, liftFor, rotationForce } from './vortex'
import { Airtime, FloorContactLatch } from './airtime'
import { createLandingPlatforms, LANDINGS } from './landing-platforms'
import { display, setupAirtimeUi } from './airtime-ui'
import { TUNING } from './tuning'
import { ARENA, BUILD_SCALE, insideArena } from './arena'
import { createRecoveryBubbles } from './bubbles'
import { createOrbCinematic } from './orb-cinematic'
import { ORB_REWARD, orbsSinceReset, isOrbRewardDestination } from './orb-reward'
import { ScenePlayers } from './scene-players'
import { createRockField } from './rock-field'
import { RockRecovery } from './rock-recovery'
import { createBlueLavaVortex } from './blue-lava-vortex'
import { createVortexEntryCues } from './vortex-entry-cues'
import { createContactSound } from './contact-audio'
import { createArenaEnclosure } from './arena-enclosure'

const ORCHARD_SCALE = ARENA.size / 44 * 1.2
const WIND_LAYER_SPACING = 3 * BUILD_SCALE
const WIND_POSITION_VARIANCE = 0.2
const WIND_ANIMATION_VARIANCE = 0.2

// Extend the restored movement baseline; keep native steering, jump and gliding.
export async function main() {
  // Await the runtime role instead of racing the SDK's initially-false role cache.
  if ((await serverRole({})).isServer) { startFlightServer(); return }
  startFlightClient()
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
  // Keep the modeled orchard, including its animated foliage, centered on the land.
  if (!Transform.has(environment)) Transform.create(environment, { position: { ...ARENA.center },
    scale: Vector3.create(ORCHARD_SCALE, ORCHARD_SCALE, ORCHARD_SCALE) })
  else {
    const authoredTransform = Transform.getMutable(environment)
    authoredTransform.position = Vector3.create(ARENA.center.x, 0, ARENA.center.z)
    authoredTransform.rotation = { x: 0, y: 0, z: 0, w: 1 }
    authoredTransform.scale = Vector3.create(ORCHARD_SCALE, ORCHARD_SCALE, ORCHARD_SCALE)
  }
  for (const [entity, model] of models) {
    if (entity !== environment && (model.src === source || model.src === previousSource || model.src === 'assets/models/rocks.glb' ||
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
  Animator.createOrReplace(environment, { states: [{ clip: 'Animation', playing: true, loop: true, speed: 1 }] })
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
  createVortexEntryCues()

  const music = engine.addEntity()
  Transform.create(music, { parent: engine.PlayerEntity })
  const musicClip = 'assets/sounds/musictheme.mp3'
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
  const glideSource = engine.addEntity()
  const zones = AIRFLOW.zones.map(zone => ({ zone, source: engine.addEntity(), strength: 0 }))
  const platforms = createLandingPlatforms()
  const rocks = createRockField()
  const bubbles = createRecoveryBubbles(platforms.overlaps)
  createArenaEnclosure()
  const scenePlayers = new ScenePlayers()
  const orbCinematic = createOrbCinematic(active => { display.rewardTransition = active })
  let orbCycleStart = 0
  let rewardReturnUntil = 0, expectedRewardTeleportUntil = 0
  let expectedRewardPosition: { x: number; y: number; z: number } | undefined
  let rewardTeleportId = 0
  let pendingReward: { id: number; until: number; confirmed: boolean } | undefined
  function cancelOrbReward() {
    pendingReward = undefined
    expectedRewardPosition = undefined
    expectedRewardTeleportUntil = rewardReturnUntil = 0
    orbCinematic.stop()
    display.rewardTransition = false
  }
  function teleportForOrbReward() {
    if (pendingReward || orbCinematic.active) return
    const destination = { x: ARENA.center.x, y: ORB_REWARD.height, z: ARENA.center.z }
    const id = ++rewardTeleportId
    pendingReward = { id, until: Date.now()+3000, confirmed: false }
    expectedRewardPosition = destination
    expectedRewardTeleportUntil = pendingReward.until
    rewardReturnUntil = Date.now() + ORB_REWARD.returnGraceSeconds * 1000
    display.rewardTransition = true
    void RestrictedActions.movePlayerTo({ newRelativePosition: destination,
      avatarTarget: { x: destination.x, y: destination.y, z: destination.z+10 } }).then(result => {
      if (pendingReward?.id !== id) return
      if (result.success) pendingReward.confirmed = true
      else { cancelOrbReward(); console.error('The five-sphere teleport could not be completed.') }
    }).catch(() => {
      if (pendingReward?.id === id) cancelOrbReward()
      console.error('The five-sphere teleport could not be completed.')
    })
  }
  let run = new Airtime()
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
  setupAirtimeUi({
    onUiClick: () => AudioSource.playSound(uiClick, 'assets/sounds/ui-click.wav', true),
    onRank: createContactSound('assets/sounds/achievement-rank.mp3'),
    onNewRecord: createContactSound('assets/sounds/newrecord.mp3')
  })

  const footOffset = 0.88, floorTop = ARENA.floorTop, groundSupportTolerance = 0.4
  const playLost = createContactSound('assets/sounds/lost.mp3')
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
  // Probe the feet, torso and head so touching a leaf from the side also arms its fall.
  const bodyRays = [0, footOffset].flatMap(y => [
    Vector3.Down(), Vector3.Up(), Vector3.Right(), Vector3.Left(), Vector3.Forward(), Vector3.Backward()
  ].map(direction => ({ offset: Vector3.create(0, y, 0), direction })))
  for (const ray of [...footRays, ...bodyRays]) {
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
  let sampleAccumulator = 0, recordsAccumulator = 1, windRefreshAccumulator = 0
  let lastWall = Date.now(), lastPosition: Vector3 | undefined
  let lastFramePosition: Vector3 | undefined
  let landingPresented=false,wasOnLava=false,attemptBestMs:number|undefined,lastTakeoffAt=0
  let onPlatform = false, localUser = '', wasConnected = false
  const floorContact = new FloorContactLatch()
  const rockRecovery = new RockRecovery()
  const presentRunLanding=(milliseconds:number)=>{
    const state=authoritativeFlight.state
    if(lastTakeoffAt>0 && state?.result && state.resultId && authoritativeFlight.userId===localUser.toLowerCase() &&
      authoritativeFlight.resultSeenAt>=lastTakeoffAt && Date.now()-authoritativeFlight.receivedAt<2000){
      presentFlightResult(display,{id:state.resultId,milliseconds:state.result.milliseconds,record:state.result.record,
        valid:state.result.valid,saved:state.saved})
    }else{
      presentLanding(display,milliseconds,attemptBestMs!==undefined?attemptBestMs:
        display.bestLoaded?(Number(display.best)||0)*1000:undefined)
    }
    landingPresented=true
  }

  engine.addSystem(dt => {
    const position = Transform.getOrNull(engine.PlayerEntity)?.position
    const now = Date.now()
    const sharedPlayers = scenePlayers.positions()
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
    if (rayContact) {
      rocks.stepOn(support!.entityId as Entity | undefined)
      if (platforms.confirmRayLanding(support!.entityId, position, support, footOffset)) {
        footLeafContact = { entityId: support!.entityId as Entity, at: now }
      }
    }
    // Contact runs every frame: a brief edge landing must start the collapse countdown too.
    const landed = !!position && !!footLeafContact && now - footLeafContact.at < 100 &&
      platforms.checkLanding(footLeafContact.entityId)
    if (footLeafContact && now - footLeafContact.at >= 100) footLeafContact = undefined
    const leafSupport = platforms.supportsPlayer(position)
    const supportedByRay = rayContact && rocks.isRock(support!.entityId as Entity | undefined)
    const supportedByRock = supportedByRay || rocks.isPlayerSupportedByRock(position)
    const supported = leafSupport || supportedByRock
    const rockTouch = rocks.isPlayerTouchingRock(position)
    const rockGrace = rockRecovery.update(now, rockTouch, supportedByRock)
    const groundAltitude = position ? position.y - footOffset - floorTop : Infinity
    // A supported player on a low rock must not finish from capsule overlap with the floor.
    const lavaContact = touchingLava(position, supported || rockGrace)
    floorContact.record(lavaContact)
    if(lavaContact && !wasOnLava && !landingPresented){
      const visibleMs=Math.max(run.milliseconds,Math.round((Number(display.time)||0)*1000))
      if(visibleMs>0){
        playLost()
        presentRunLanding(visibleMs)
      }
    }
    wasOnLava=lavaContact
    // Only a real landing leaf pauses its updraft. The tunnel's curved collision mesh can
    // also appear in the ground ray and must not switch the central wind off.
    onPlatform = leafSupport
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
      const focused = !!pendingReward || orbCinematic.active || /mobile|android|ios|iphone|ipad/i.test(platform) || !pointer || pointer.isPointerLocked
      const priorPhase=run.phase
      const completed=run.update({ dt: sampleDt, wallDt, now, inside, connected, floor: floorContact.consume(), supported,
        airborne: clearForTakeoff(position, supported), moved: false,
        teleported: !rewardTeleportTransition && distance > (rockGrace ? 20 : 4), focused })
      if((priorPhase==='ready'||priorPhase==='finished')&&run.phase==='airborne'){
        lastTakeoffAt=now
        attemptBestMs=display.bestLoaded?(Number(display.best)||0)*1000:undefined
        orbCycleStart=bubbles.getPoppedTotal()
        bubbles.resetAccumulation()
        display.orbs=0
      }else if(run.phase==='airborne'&&attemptBestMs===undefined&&display.bestLoaded){
        attemptBestMs=(Number(display.best)||0)*1000
      }
      if(completed && run.result?.valid && !landingPresented){
        presentRunLanding(run.result.milliseconds)
      }
      if(run.phase==='airborne' && clearForTakeoff(position,supported))landingPresented=false
      lastPosition = position ? { ...position } : undefined
      const remote=authoritativeFlight.state
      const validRemote=remote && authoritativeFlight.userId===localUser.toLowerCase() && now-authoritativeFlight.receivedAt<2000
      // Ground contact locks immediately, even while the server landing packet is in flight.
      const time=validRemote && (!lavaContact || remote.phase==='finished') ? remote.milliseconds : run.milliseconds
      display.time=(time/1000).toFixed(3)
      display.state=validRemote ? remote.reason : run.reason
      if(!validRemote)display.storage='CONNECTING TO SCORE SERVER'

    }
    const glideHeld = inputSystem.isPressed(InputAction.IA_JUMP)
    const glideBrake = heldGlideBrake(glideHeld, !pendingReward && !orbCinematic.active && dt > 0 && dt <= .5 && !!position && insideArena(position) && !supported &&
      groundAltitude > .8 && !(wasConnected && RealmInfo.getOrNull(engine.RootEntity)?.isConnectedSceneRoom === false) &&
      (/mobile|android|ios|iphone|ipad/i.test(platform) || PointerLock.getOrNull(engine.CameraEntity)?.isPointerLocked !== false), landingVelocityY)
    if (glideBrake) Physics.applyForceToPlayer(glideSource, Vector3.create(0, glideBrake, 0))
    else Physics.removeForceFromPlayer(glideSource)
    // Visual motion and contact run every frame, independent of score sampling or cursor mode.
    // A finished/paused attempt must not disable the basic bubble recovery mechanic.
    const connectedForBubbles = !(wasConnected && RealmInfo.getOrNull(engine.RootEntity)?.isConnectedSceneRoom === false)
    if (pendingReward) {
      if (!connectedForBubbles || now>pendingReward.until) cancelOrbReward()
      else if (pendingReward.confirmed && position && isOrbRewardDestination(position)) {
        pendingReward=undefined
        if (orbCinematic.start(position)) bubbles.explodeAccumulation(position)
        else cancelOrbReward()
      }
    }
    orbCinematic.update(dt, position, connectedForBubbles)
    const bubbleImpulse = bubbles.update(dt, position, velocityY, liftScale === AIRFLOW.mobileLift,
      !!position && connectedForBubbles && !pendingReward && !orbCinematic.active && insideArena(position), sharedPlayers)
    const popped = bubbles.getPoppedTotal()
    if (orbsSinceReset(popped,orbCycleStart) >= ORB_REWARD.every) {
      orbCycleStart = popped
      bubbles.resetAccumulation()
      if (position && insideArena(position)) teleportForOrbReward()
    } else if (bubbleImpulse > 0) {
      Physics.applyImpulseToPlayer(Vector3.create(0, bubbleImpulse, 0))
    }
    display.orbs = orbsSinceReset(popped,orbCycleStart)
    display.energy = Math.round(Math.max(0, Math.min(1, groundAltitude / ARENA.height)) * 100)
    display.altitudeMeters = Number.isFinite(groundAltitude) ? Math.max(0, groundAltitude) : 0
    display.altitude = display.altitudeMeters.toFixed(1)
    scenePlayers.update(dt)
    const inputFocused = !!pendingReward || orbCinematic.active || /mobile|android|ios|iphone|ipad/i.test(platform) || PointerLock.getOrNull(engine.CameraEntity)?.isPointerLocked !== false
    sendFlightInput(dt, supported, rockTouch, inputFocused, getPlayer()?.name || 'Runner')
    // Reassert steady wind occasionally. Multiplayer CRDT traffic can briefly remove the
    // local player's combined-force component while the player remains inside one zone.
    windRefreshAccumulator += dt
    const refreshWind = windRefreshAccumulator >= 0.25
    if (refreshWind) windRefreshAccumulator = 0
    for (const item of zones) {
      const enabled = !AIRFLOW.centralOnly || item.zone.id === 'central'
      const strength = enabled && !orbCinematic.active && position && position.y >= AIRFLOW.forceMinY && !onPlatform &&
        inWindArea(position, item.zone) ? item.zone.lift * liftScale : 0
      if (strength === item.strength && !(refreshWind && strength > 0)) continue
      item.strength = strength
      if (strength) Physics.applyForceToPlayer(item.source, Vector3.create(0, strength, 0))
      else Physics.removeForceFromPlayer(item.source)
    }

    const force = position && !orbCinematic.active && !onPlatform ? rotationForce(position) : undefined
    if (force) Physics.applyForceToPlayer(swirlSource, Vector3.create(force.x, 0, force.z))
    else Physics.removeForceFromPlayer(swirlSource)

    recordsAccumulator += dt
    if (recordsAccumulator >= 1) {
      recordsAccumulator = 0
      const player = getPlayer()
      if (player && player.userId !== localUser) {
        // Discard any attempt from a previous signed-in player before changing records owner.
        if (localUser) {run = new Airtime();attemptBestMs=undefined;lastTakeoffAt=0}
        localUser = player.userId
        display.localUser = player.userId
      }

    }
  })
}
