import { AudioSource, engine, InputModifier, MainCamera, Physics, TouchScreenControls, Transform, VirtualCamera } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { ARENA, Point } from './arena'

export const ORB_CINEMATIC = { duration: 10, liftHeight: ARENA.height - 4, exitOffset: 2.4, riseSpeed: 3.65, maxLiftForce: 30, sound: 'assets/sounds/ethereal-riser.mp3', beatSound: 'assets/sounds/rest-countdown.wav' } as const

/** Starts only after the off-center teleport is observed in the player's real transform. */
export function createOrbCinematic(onActive: (active: boolean) => void, coverHandoff?: () => void) {
  const camera = engine.addEntity(), focus = engine.addEntity(), sound = engine.addEntity(), lift = engine.addEntity(), rig = engine.addEntity()
  const beatAudio = engine.addEntity()
  // A translation-only rig prevents joystick/avatar yaw from spinning the shot.
  // The aim point follows the live avatar independently of the rig's smoothed motion.
  Transform.create(rig)
  Transform.create(camera, { parent: rig, position: Vector3.create(0,3.4,7) })
  Transform.create(focus, { parent: engine.PlayerEntity, position: Vector3.create(0,.65,0) })
  Transform.create(sound, { parent: engine.PlayerEntity })
  Transform.create(beatAudio, { parent: engine.PlayerEntity })
  function configureCamera() {
    VirtualCamera.createOrReplace(camera, { lookAtEntity: focus, fov: 48,
      defaultTransition: { transitionMode: { $case: 'time', time: 0 } } })
  }
  AudioSource.create(sound, { audioClipUrl: ORB_CINEMATIC.sound, playing: false, loop: false, global: true, volume: .55 })
  AudioSource.create(beatAudio, { audioClipUrl: ORB_CINEMATIC.beatSound, playing: false, loop: false, global: true, volume: .48 })
  let lastBeat = 5, handoffPending = false, finishedRest = false
  let age = -1, lastY = 0, lastX = 0, lastZ = 0, velocity = 0, releaseLeft = 0, launchY = 0
  let launchX = 0, launchZ = 0, exitX = 0, exitZ = 0
  let previousInput: ReturnType<typeof InputModifier.getOrNull>
  let previousTouch: ReturnType<typeof TouchScreenControls.getOrNull>
  function restControls() {
    const input=InputModifier.getOrNull(engine.PlayerEntity)
    previousInput=input ? { mode: input.mode ? {$case:'standard',standard:{...input.mode.standard}} : undefined } : null
    const touch=TouchScreenControls.getOrNull(engine.RootEntity)
    previousTouch=touch ? {...touch,touchInputs:touch.touchInputs.map(item=>({...item}))} : null
    InputModifier.createOrReplace(engine.PlayerEntity,{mode:{$case:'standard',standard:{
      ...input?.mode?.standard,disableWalk:true,disableJog:true,disableRun:true
    }}})
    TouchScreenControls.createOrReplace(engine.RootEntity,{
      touchInputs:touch?.touchInputs.map(item=>({...item})) || [],mainAction:touch?.mainAction,
      hideJoystick:true,hideCrosshair:true
    })
  }
  function resumeControls() {
    // Explicit updates release native input reliably; never disable jump or glide.
    InputModifier.createOrReplace(engine.PlayerEntity,previousInput || {mode:{$case:'standard',standard:{
      disableAll:false,disableWalk:false,disableJog:false,disableRun:false,
      disableJump:false,disableDoubleJump:false,disableGliding:false,disableEmote:false
    }}})
    TouchScreenControls.createOrReplace(engine.RootEntity,previousTouch ? {...previousTouch,touchInputs:previousTouch.touchInputs.map(item=>({...item}))} : {
      touchInputs:[],hideJoystick:false,hideCrosshair:false
    })
  }
  function releaseCamera() {
    const current = MainCamera.getOrNull(engine.CameraEntity)?.virtualCameraEntity
    if (current === undefined || current === camera) {
      // Publish a component update clearing the target. Deleting MainCamera alone
      // can leave a native client holding its last virtual camera selection.
      MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: undefined })
    }
    VirtualCamera.deleteFrom(camera)
  }
  function stop() {
    if (age < 0) return
    finishedRest = handoffPending
    age = -1; releaseLeft = .5; handoffPending = false
    Physics.removeForceFromPlayer(lift)
    releaseCamera()
    resumeControls()
    AudioSource.stopSound(sound, true)
    AudioSource.stopSound(beatAudio, true)
    onActive(false)
  }
  function remainingSeconds() {
    if (age < 0) return undefined
    // The shot ends at the crown or the time limit, whichever comes first.
    const crownEta = (ORB_CINEMATIC.liftHeight - lastY) / ORB_CINEMATIC.riseSpeed + .45 * Math.exp(-2 * age)
    return Math.min(ORB_CINEMATIC.duration - age, crownEta)
  }
  return {
    get active() { return age >= 0 },
    get restoringCamera() { return finishedRest && releaseLeft > 0 },
    get remainingSeconds() { return remainingSeconds() },
    start(player: Point) {
      if (age >= 0) return false
      lastBeat = 5
      age = 0; lastY = player.y; lastX = player.x; lastZ = player.z; velocity = 0; launchY = player.y
      launchX = player.x - ARENA.center.x; launchZ = player.z - ARENA.center.z
      const radius = Math.hypot(launchX, launchZ)
      exitX = radius > .1 ? launchX / radius * ORB_CINEMATIC.exitOffset : ORB_CINEMATIC.exitOffset
      exitZ = radius > .1 ? launchZ / radius * ORB_CINEMATIC.exitOffset : 0
      // Capture facing once; the shot never inherits subsequent joystick rotation.
      const q=Transform.getOrNull(engine.PlayerEntity)?.rotation
      const yaw=q ? Math.atan2(2*(q.x*q.z+q.w*q.y),1-2*(q.x*q.x+q.y*q.y)) : 0
      Transform.getMutable(rig).position={...player}
      Transform.getMutable(camera).position=Vector3.create(Math.sin(yaw)*7,3.4,Math.cos(yaw)*7)
      restControls()
      releaseLeft = 0
      configureCamera()
      MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: camera })
      AudioSource.getMutable(sound).volume = .55
      AudioSource.playSound(sound, ORB_CINEMATIC.sound, true)
      onActive(true)
      return true
    },
    update(dt: number, player: Point | undefined, connected = true) {
      if (age < 0) {
        if (releaseLeft > 0 && Number.isFinite(dt) && dt > 0) {
          releaseLeft = Math.max(0,releaseLeft-dt)
          releaseCamera()
        }
        return
      }
      if (handoffPending) { stop(); return }
      if (MainCamera.getOrNull(engine.CameraEntity)?.virtualCameraEntity !== camera || !player || !connected || !Number.isFinite(dt) || dt <= 0 || dt > .5 ||
        Math.hypot(player.x-ARENA.center.x,player.z-ARENA.center.z)>4 || player.y>ARENA.height-2) { stop(); return }
      age += dt
      const anchor=Transform.getMutable(rig).position,follow=1-Math.exp(-10*dt)
      anchor.x+=(player.x-anchor.x)*follow
      anchor.y+=(player.y-anchor.y)*follow
      anchor.z+=(player.z-anchor.z)*follow
      if (age >= ORB_CINEMATIC.duration || player.y >= ORB_CINEMATIC.liftHeight) {
        if (coverHandoff) {
          // Give the flash a frame to cover the view before restoring the native camera.
          handoffPending = true
          coverHandoff()
        } else stop()
        return
      }
      velocity += ((player.y-lastY)/dt-velocity)*Math.min(1,dt*8);lastY=player.y
      // Keep rising through the handoff rather than braking into a hover.
      // Reaching the crown ends the shot without resetting the avatar's velocity.
      const targetSpeed = ORB_CINEMATIC.riseSpeed
      const force = Math.max(0,Math.min(ORB_CINEMATIC.maxLiftForce,9.81+(targetSpeed-velocity)*4))
      const centerForce = (offset: number, speed: number) => Math.max(-18,Math.min(18,offset*8-speed*6))
      const heightProgress = Math.max(0,Math.min(1,(player.y-launchY)/Math.max(1,ORB_CINEMATIC.liftHeight-launchY)))
      const drift = Math.max(0,Math.min(1,(heightProgress-.35)/.65))
      const easedDrift = drift*drift*(3-2*drift)
      const targetX = ARENA.center.x + launchX + (exitX - launchX) * easedDrift
      const targetZ = ARENA.center.z + launchZ + (exitZ - launchZ) * easedDrift
      Physics.applyForceToPlayer(lift,Vector3.create(
        centerForce(targetX-player.x,(player.x-lastX)/dt),force,
        centerForce(targetZ-player.z,(player.z-lastZ)/dt)))
      lastX=player.x;lastZ=player.z
      const remaining = remainingSeconds()!
      const beat = Math.ceil(remaining)
      if (beat >= 1 && beat < lastBeat) {
        lastBeat = beat
        const accent = AudioSource.getMutable(beatAudio)
        accent.pitch = [1.5, 1.26, 1.12, 1][beat - 1]
        accent.volume = [1, .90, .78, .48][beat - 1]
        AudioSource.playSound(beatAudio, ORB_CINEMATIC.beatSound, true)
      }
      AudioSource.getMutable(sound).volume = .55 * Math.min(1, age / .15, remaining / .5)
    },
    stop
  }
}
