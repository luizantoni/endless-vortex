import { DAILY_ORBS, RareOrb, rareOrbTexture, rollRareOrb } from './daily-orbs'
import { AudioSource, Billboard, BillboardMode, engine, Material, MaterialTransparencyMode, MeshRenderer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ARENA, BUILD_SCALE, Point } from './arena'
import { BUBBLES as B, BubbleLift, bubbleSlot, goldenPlayerWrapPoint, goldenVortexOrbitPoint,
  goldenVortexParticlePoint, sweptBubbleContact } from './bubble-rules'
import { ORB_CINEMATIC } from './orb-cinematic'
import { createSharedRandom, onSharedObstacleEvent, publishSharedObstacleEvent } from './shared-obstacles'

const vortexTexture = 'assets/ui/modular/vortex.png'

function paintOrbOverlay(entity: ReturnType<typeof engine.addEntity>, src: string, opacity: number) {
  const texture = Material.Texture.Common({ src })
  // The unlit material can render transparent PNG pixels as black in Explorer.
  // Explicit alpha blending preserves the soft edges and the pickup fade.
  Material.setPbrMaterial(entity, {
    texture, albedoColor: Color4.create(1, 1, 1, opacity),
    emissiveTexture: texture, emissiveColor: Color3.create(1, 1, 1), emissiveIntensity: .85,
    directIntensity: 0, specularIntensity: 0, metallic: 0, roughness: 1, castShadows: false,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
  })
}

export function createRecoveryBubbles(_blocked: (point: Point, radius: number) => boolean, random = Math.random, onPickup?: (kind: RareOrb | undefined, index: number) => void | boolean, rarityRandom = Math.random) {
  if (random === Math.random) random = createSharedRandom(0x4f524253)
  const lift = new BubbleLift()
  const pickupSounds = new Map<RareOrb | undefined, { entity: ReturnType<typeof engine.addEntity>; clip: string; readyAt: number }>()
  for (const kind of [undefined, ...DAILY_ORBS]) {
    const entity = engine.addEntity()
    const clip = kind ? `assets/sounds/orb-pickup-${kind}.mp3` : B.sound
    Transform.create(entity, { parent: engine.PlayerEntity })
    AudioSource.create(entity, { audioClipUrl: clip, playing: false, loop: false, global: true, volume: B.volume })
    pickupSounds.set(kind, { entity, clip, readyAt: 0 })
  }
  let volume: number = B.volume, time = 0, poppedTotal = 0
  let previousPlayer: Point | undefined, previousCanPop = false
  const pool = Array.from({ length: B.count }, (_, index) => {
    const entity = engine.addEntity(), billboard = engine.addEntity(), vortex = engine.addEntity()
    Transform.create(entity, { scale: Vector3.create(B.radius * 2, B.radius * 2, B.radius * 2) })
    MeshRenderer.setSphere(entity)
    Material.setPbrMaterial(entity, { albedoColor: Color4.create(1, 0.58, 0.03, B.orbOpacity),
      emissiveTexture: Material.Texture.Common({ src: vortexTexture }),
      emissiveColor: Color3.create(1, 0.57, 0.12), emissiveIntensity: B.glowBaseIntensity,
      roughness: 0.08, metallic: 0.45, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND })
    // The reusable vortex image is the only orb ornament; no attached highlight sphere.
    Transform.create(billboard, { parent: entity, scale: Vector3.create(B.vortexScale, B.vortexScale, 1) })
    Billboard.create(billboard, { billboardMode: BillboardMode.BM_ALL })
    Transform.create(vortex, { parent: billboard })
    MeshRenderer.setPlane(vortex)
    paintOrbOverlay(vortex, vortexTexture, 1)
    VisibilityComponent.create(entity, { visible: false })
    VisibilityComponent.create(billboard, { visible: false })
    VisibilityComponent.create(vortex, { visible: false })
    return { entity, billboard, vortex, index, slot: bubbleSlot(index),
      rare: undefined as RareOrb | undefined,
      mode: 'waiting' as 'waiting' | 'active' | 'popping',
      readyAt: 0.2 + index * 0.16, poppedAt: 0, glowAt: -Infinity,
      // A stable slot per orb keeps an orb index tied to the same world
      // position on every client, even when one peer delays its appearance.
      point: { x: 0, y: 0, z: 0 } }
  })
  const sparks = Array.from({ length: B.particleCount }, (_, index) => {
    const entity = engine.addEntity()
    Transform.create(entity, { scale: Vector3.create(0.08, 0.08, 0.08) })
    MeshRenderer.setSphere(entity)
    Material.setPbrMaterial(entity, { albedoColor: Color4.create(1, 0.62, 0.12, 1),
      emissiveColor: Color3.create(1, 0.38, 0.035), emissiveIntensity: 2.4,
      roughness: 0.15, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
    VisibilityComponent.create(entity, { visible: false })
    return { entity, rare: undefined as RareOrb | undefined, born: 0, materialAt: 0, origin: { x: 0, y: 0, z: 0 }, angle: 0, pitch: 0, burstSpeed: 0,
      radialSpeed: 0, spin: 0, riseSpeed: 0, phase: 0, size: 0.08, shade: 0, active: false,
      index, kind: 'idle' as 'idle' | 'burst' | 'orbit' | 'celebrate', orbitRadius: 0, orbitHeight: 0 }
  })
  const burstSparks = sparks.slice(B.accumulationCapacity)
  let nextSpark = B.accumulationCapacity
  let accumulationPops = 0

  function paintOrb(item: typeof pool[number], opacity: number, scan: number, paintVortex: boolean) {
    const kind = item.rare
    const src = kind ? rareOrbTexture(kind) : vortexTexture
    const texture = Material.Texture.Common({ src })
    const tint = kind === 'blue' ? [.19, .65, 1] : kind === 'purple' ? [.72, .30, 1] :
      kind === 'rainbow' ? [.20, .32, .82] : [1, .54 + scan * .16, .025 + scan * .055]
    Material.setPbrMaterial(item.entity, {
      albedoColor: Color4.create(tint[0], tint[1], tint[2], B.orbOpacity * opacity),
      emissiveTexture: kind === 'rainbow' ? undefined : texture, emissiveColor: Color3.create(tint[0], tint[1], tint[2]),
      emissiveIntensity: (kind === 'rainbow' ? .65 + scan * .25 : B.glowBaseIntensity + scan * B.glowScanIntensity) * opacity,
      roughness: .08, metallic: .45, transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
    })
    if (paintVortex) paintOrbOverlay(item.vortex, src, opacity)
  }

  function visible(item: typeof pool[number], value: boolean) {
    VisibilityComponent.getMutable(item.entity).visible = value
    VisibilityComponent.getMutable(item.billboard).visible = value
    VisibilityComponent.getMutable(item.vortex).visible = value
  }
  function wait(item: typeof pool[number], delay: number) {
    item.mode = 'waiting'; item.rare = undefined; item.readyAt = time + delay; visible(item, false)
  }
  function position(slot: ReturnType<typeof bubbleSlot>): Point {
    const angle = slot.angle + time * B.orbitDegrees * Math.PI / 180
    return { x: ARENA.center.x + Math.cos(angle) * slot.radius,
      y: slot.y + Math.sin(time * 1.5 + slot.angle) * 0.2 * BUILD_SCALE, z: ARENA.center.z + Math.sin(angle) * slot.radius }
  }
  const rainbow = [
    [1, .18, .36], [1, .59, .16], [.87, 1, .19], [.2, 1, .54], [.18, .71, 1], [.66, .26, 1]
  ] as const
  function paintSpark(particle: typeof sparks[number], opacity: number, shimmer: number) {
    const { rare, shade, index } = particle
    const glow = rare === 'rainbow' ? rainbow[index % rainbow.length] :
      rare === 'blue' ? [.06, .44 + shade * .32, 1] :
        rare === 'purple' ? [.55 + shade * .3, .09 + shade * .15, 1] :
          [1, .42 + shade * .42, .04 + shade * .22]
    const tint = (value: number) => value + (1 - value) * .17
    Material.setPbrMaterial(particle.entity, { albedoColor: Color4.create(tint(glow[0]), tint(glow[1]), tint(glow[2]), opacity),
      emissiveColor: Color3.create(glow[0], glow[1], glow[2]),
      emissiveIntensity: (5 + shade * 5) * shimmer * opacity, metallic: .76, roughness: .035,
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND, castShadows: false })
  }
  function showSpark(particle: typeof sparks[number]) {
    Transform.getMutable(particle.entity).scale = Vector3.create(particle.size * BUILD_SCALE, particle.size * BUILD_SCALE, particle.size * BUILD_SCALE)
    paintSpark(particle, 1, 1)
    particle.active = true
    VisibilityComponent.getMutable(particle.entity).visible = true
  }
  function emitSparks(origin: Point, rare: RareOrb | undefined) {
    // Each pickup adds twelve motes to the current five-pickup cycle.
    const cohort = accumulationPops++ % B.accumulationEvery
    for (let i = 0; i < B.accumulationPerPop; i++) {
      const slot = cohort * B.accumulationPerPop + i
      const particle = sparks[slot]
      particle.kind = 'orbit'; particle.born = time; particle.origin = { ...origin }
      particle.angle = slot * Math.PI * 2 / B.accumulationCapacity
      particle.phase = random() * Math.PI * 2; particle.size = 0.105 + random() * 0.045
      particle.shade = (i + cohort % 4) / (B.accumulationPerPop + 2)
      particle.orbitRadius = B.accumulationRadius + (slot % 3) * 0.42 * BUILD_SCALE
      particle.orbitHeight = ARENA.center.y + (3 + Math.floor(slot / 12) * 0.58) * BUILD_SCALE
      particle.rare = rare
      showSpark(particle)
    }
    for (let i = 0; i < B.particlesPerPop; i++) {
      const particle = burstSparks[(nextSpark++ - B.accumulationCapacity) % burstSparks.length]
      particle.born = time
      particle.materialAt = time - (nextSpark % 16) / 16 * B.particleMaterialInterval
      particle.origin = { ...origin }
      particle.kind = 'burst'
      particle.angle = Math.PI * 2 * (i + random()) / B.particlesPerPop
      particle.pitch = -0.35 + (i % 6) / 5 * 1.7 + (random() - 0.5) * 0.16
      particle.burstSpeed = B.particleBurstSpeedMin + (i % 3) * 2 +
        random() * (B.particleBurstSpeedMax - B.particleBurstSpeedMin - 4)
      particle.radialSpeed = B.particleRadialSpeedMin + random() *
        (B.particleRadialSpeedMax - B.particleRadialSpeedMin)
      particle.spin = B.particleSpinMin + random() * (B.particleSpinMax - B.particleSpinMin)
      particle.riseSpeed = 0.35 + random() * 0.8
      particle.phase = random() * Math.PI * 2
      particle.size = 0.055 + (i % 3) * 0.025 + random() * 0.03
      particle.shade = (i % 4 + random()) / 4
      particle.rare = rare
      showSpark(particle)
    }
  }
  const pendingPops = new Map<number, number>()
  function popOrb(item: typeof pool[number], at: number) {
    if (item.mode !== 'active') return false
    item.mode = 'popping'
    item.poppedAt = time - Math.max(0, (Date.now() - at) / 1000)
    emitSparks(item.point, item.rare)
    return true
  }
  const stopListening = onSharedObstacleEvent(event => {
    if (event.kind !== 'orb' || event.action !== 'pop') return
    const item = pool[event.index]
    if (!item || item.rare || item.mode === 'popping') return
    if (!popOrb(item, event.at)) pendingPops.set(event.index, event.at)
  })

  return {
    update(dt: number, player: Point | undefined, velocityY: number, mobile: boolean, canPop: boolean,
      _players: Point[] = player ? [player] : []): number {
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) {
        previousPlayer = undefined; previousCanPop = false
        return 0
      }
      time += dt
      const teleported = !!player && !!previousPlayer && Vector3.distance(player, previousPlayer) > B.maxSweep
      const playerBefore = previousCanPop && previousPlayer ? previousPlayer : player
      previousPlayer = player ? { ...player } : undefined
      previousCanPop = canPop && !teleported
      let impulse = 0
      for (const item of pool) {
        const transform = Transform.getMutable(item.entity)
        const vortexTransform = Transform.getMutable(item.vortex)
        if (item.mode === 'popping') {
          const fraction = (time - item.poppedAt) / B.popDuration
          if (fraction >= 1) { wait(item, B.respawn); continue }
          const orbScale = 1 - 0.35 * fraction
          transform.scale = Vector3.create(B.radius * 2 * orbScale, B.radius * 2 * orbScale, B.radius * 2 * orbScale)
          vortexTransform.scale = Vector3.create(1 - fraction, 1 - fraction, 1)
          vortexTransform.rotation = Quaternion.fromEulerDegrees(0, 0,
            (time * B.vortexSpinDegrees + item.slot.angle * 180 / Math.PI) % 360)
          paintOrb(item, 1 - fraction, .25, true)
          continue
        }
        let spawned = false
        if (item.mode === 'waiting') {
          if (time < item.readyAt || !player) continue
          const spawnPoint = position(item.slot)
          if (_players.some(avatar => Vector3.distance(spawnPoint, avatar) <= B.spawnClearance) ||
            _blocked(spawnPoint, B.radius + 0.2)) {
            item.readyAt = time + 1
            continue
          }
          item.mode = 'active'
          spawned = true
          transform.scale = Vector3.create(B.radius * 2, B.radius * 2, B.radius * 2)
          vortexTransform.scale = Vector3.create(1, 1, 1)
          item.rare = rollRareOrb(rarityRandom())
          const overlayScale = B.vortexScale * (item.rare === 'rainbow' ? 1.35 : 1)
          Transform.getMutable(item.billboard).scale = Vector3.create(overlayScale, overlayScale, 1)
          item.point = spawnPoint
          paintOrb(item, 1, .25, true)
          visible(item, true)
          const pendingAt = pendingPops.get(item.index)
          if (pendingAt !== undefined) {
            if (!item.rare) popOrb(item, pendingAt)
            pendingPops.delete(item.index)
          }
        }
        const bubbleBefore = item.point
        item.point = position(item.slot)
        transform.position = { ...item.point }
        transform.rotation = Quaternion.fromEulerDegrees(15, (time * B.spinDegrees + item.slot.angle * 180 / Math.PI) % 360, 0)
        vortexTransform.rotation = Quaternion.fromEulerDegrees(0, 0,
          (time * B.vortexSpinDegrees + item.slot.angle * 180 / Math.PI) % 360)
        if (time - item.glowAt >= B.glowUpdateInterval) {
          item.glowAt = time
          const scan = (Math.sin(time * 3.2 - item.slot.angle * 2.5) + 1) * 0.5
          paintOrb(item, 1, scan, false)
        }
        if (item.mode !== 'active' || !canPop || teleported || !player || !playerBefore || spawned ||
          !sweptBubbleContact(playerBefore, player, bubbleBefore, item.point)) continue
        const amount = lift.pop(time, velocityY, mobile)
        popOrb(item, Date.now())
        // Rarity is rolled locally, so another player's gold pickup must never consume a rare drop.
        if (!item.rare) publishSharedObstacleEvent('orb', item.index, 'pop')
        poppedTotal++
        const keepCollecting = onPickup?.(item.rare, item.index)
        impulse += amount ?? 0
        const sound = pickupSounds.get(item.rare)!
        if (volume > 0 && time >= sound.readyAt) {
          AudioSource.playSound(sound.entity, sound.clip, true)
          sound.readyAt = time + B.soundInterval
        }
        if (keepCollecting === false) break
      }
      for (const particle of sparks) {
        if (!particle.active) continue
        const age = time - particle.born
        const lifetime = particle.kind === 'orbit' ? Number.POSITIVE_INFINITY :
          particle.kind === 'celebrate' ? ORB_CINEMATIC.duration : B.particleLifetime
        const fraction = age / lifetime
        if (fraction >= 1) {
          particle.active = false
          VisibilityComponent.getMutable(particle.entity).visible = false
          continue
        }
        const shimmer = 0.65 + 0.35 * Math.sin(age * 24 + particle.phase)
        if (particle.kind === 'celebrate') {
          Transform.getMutable(particle.entity).position = goldenPlayerWrapPoint(player || particle.origin, particle.index, age)
        } else if (particle.kind === 'orbit') {
          Transform.getMutable(particle.entity).position = goldenVortexOrbitPoint(particle.origin, particle.angle,
            particle.orbitRadius, particle.orbitHeight, particle.phase, age)
        } else {
          Transform.getMutable(particle.entity).position = goldenVortexParticlePoint(particle.origin,
            particle.angle, particle.pitch, particle.burstSpeed, particle.radialSpeed, particle.spin,
            particle.riseSpeed, particle.phase, age)
        }
        const burstScale = particle.kind === 'burst' && age < B.particleBurstDuration ?
          1 + 2.4 * (1 - age / B.particleBurstDuration) : 1
        const size = particle.size * BUILD_SCALE * burstScale * (0.72 + shimmer * 0.55) *
          (particle.kind === 'orbit' ? 1 : 1 - fraction)
        Transform.getMutable(particle.entity).scale = Vector3.create(size, size, size)
        if (time - particle.materialAt >= B.particleMaterialInterval) {
          particle.materialAt = time
          paintSpark(particle, 1 - fraction, shimmer)
        }
      }
      return impulse
    },
    setVolume(value: number) {
      volume = Math.max(0, Math.min(1, value))
      for (const { entity } of pickupSounds.values()) {
        AudioSource.getMutable(entity).volume = volume
        if (volume === 0) AudioSource.stopSound(entity, true)
      }
    },
    resetAccumulation(keepBursts = false) {
      accumulationPops = 0
      for (const particle of sparks) {
        if (keepBursts && particle.kind === 'burst') continue
        particle.active = false
        particle.kind = 'idle'
        VisibilityComponent.getMutable(particle.entity).visible = false
      }
    },
    explodeAccumulation(player: Point) {
      // Wrap the real player in three strands of miniature golden spheres.
      for (let i = 0; i < sparks.length; i++) {
        const particle = sparks[i]
        if (particle.active && particle.kind === 'burst') continue
        particle.born = time
        particle.rare = undefined
        particle.kind = 'celebrate'
        particle.origin = { ...player }
        particle.phase = (i % 17) * 0.17
        particle.size = 0.045 + (i % 4) * 0.012
        particle.shade = (i % 6) / 5
        particle.materialAt = -Infinity
        particle.active = true
        Transform.getMutable(particle.entity).position = goldenPlayerWrapPoint(player, i, 0)
        Transform.getMutable(particle.entity).scale = Vector3.create(particle.size * BUILD_SCALE, particle.size * BUILD_SCALE, particle.size * BUILD_SCALE)
        VisibilityComponent.getMutable(particle.entity).visible = true
      }
    },
    dispose() { stopListening() },
    getPoppedTotal() { return poppedTotal }
  }
}
