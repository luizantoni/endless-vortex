import { createContactSound } from './contact-audio'
import { ColliderLayer, engine, Entity, GltfContainer, Transform, TriggerArea, triggerAreaEventsSystem,
  VisibilityComponent } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { ARENA, BUILD_SCALE, GROUND_ASSET_LIFT } from './arena'
import { ROCK_LAYOUT } from './rock-layout'
import { TUNING } from './tuning'
import { onSharedObstacleEvent, publishSharedObstacleEvent } from './shared-obstacles'

type Rock = {
  index: number
  entity: Entity
  sensor: Entity
  home: Vector3
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  radius: number
  idlePhase: number
  state: 'ready' | 'armed' | 'falling' | 'hidden' | 'rising'
  armedAt: number
  fallAt: number
  fallStartY: number
  respawnAt: number
  riseAt: number
  riseStartY: number
}

let sharedField: ReturnType<typeof makeField> | undefined
const ROCK_SCALE = 1.2 * BUILD_SCALE

function overlapsPlayer(rock: Rock, player: Vector3 | undefined): boolean {
  if (!player) return false
  const dx = player.x - rock.home.x, dz = player.z - rock.home.z
  const horizontal = rock.radius + 0.85
  const playerBottom = player.y - 0.88, playerTop = player.y + 0.88
  return dx * dx + dz * dz < horizontal * horizontal &&
    playerTop >= rock.home.y + rock.minY - 0.2 && playerBottom <= rock.home.y + rock.maxY + 0.2
}

// The GLB stays the physical collider. This matching invisible trigger covers its
// transformed visible-mesh bounds so side, underside, and airborne contact can arm it.
function touchesRockBounds(rock: Rock, player: Vector3 | undefined): boolean {
  if (!player) return false
  const transform = Transform.get(rock.entity)
  const radius = 0.3
  const bottom = player.y - 0.88, top = player.y + 0.88
  return player.x + radius >= rock.home.x + rock.minX && player.x - radius <= rock.home.x + rock.maxX &&
    player.z + radius >= rock.home.z + rock.minZ && player.z - radius <= rock.home.z + rock.maxZ &&
    top >= transform.position.y + rock.minY && bottom <= transform.position.y + rock.maxY + 0.2
}

function placeSensor(rock: Rock) {
  const y = Transform.get(rock.entity).position.y
  Transform.getMutable(rock.sensor).position = {
    x: rock.home.x + (rock.minX + rock.maxX) / 2,
    y: y + (rock.minY + rock.maxY) / 2,
    z: rock.home.z + (rock.minZ + rock.maxZ) / 2
  }
}

function makeField() {
  const playContact = createContactSound('assets/sounds/rocktouch.mp3')
  let elapsed = 0
  let hoverAccumulator = 0
  const models = [...engine.getEntitiesWith(GltfContainer)]
  const rocks: Rock[] = ROCK_LAYOUT.map((layout, index) => {
    const entity = models.find(([, model]) => model.src === layout.src)?.[0] ?? engine.addEntity()
    const sensor = engine.addEntity()
    const home = Vector3.create(ARENA.center.x + layout.x * BUILD_SCALE, layout.y * BUILD_SCALE + GROUND_ASSET_LIFT, ARENA.center.z + layout.z * BUILD_SCALE)
    Transform.createOrReplace(entity, { position: home, scale: Vector3.create(ROCK_SCALE, ROCK_SCALE, ROCK_SCALE) })
    GltfContainer.createOrReplace(entity, { src: layout.src,
      visibleMeshesCollisionMask: ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })
    VisibilityComponent.createOrReplace(entity, { visible: true })
    const rock: Rock = { index, entity, sensor, home: { ...home }, minX: layout.minX * ROCK_SCALE,
      maxX: layout.maxX * ROCK_SCALE, minY: layout.minY * ROCK_SCALE, maxY: layout.maxY * ROCK_SCALE,
      minZ: layout.minZ * ROCK_SCALE, maxZ: layout.maxZ * ROCK_SCALE, radius: layout.radius * ROCK_SCALE,
      idlePhase: index * 2.399963,
      state: 'ready', armedAt: 0, fallAt: 0, fallStartY: home.y, respawnAt: 0, riseAt: 0, riseStartY: home.y }
    Transform.create(sensor, {
      position: Vector3.create(home.x + (rock.minX + rock.maxX) / 2,
        home.y + (rock.minY + rock.maxY) / 2, home.z + (rock.minZ + rock.maxZ) / 2),
      scale: Vector3.create(Math.max(0.1, rock.maxX - rock.minX), Math.max(0.1, rock.maxY - rock.minY),
        Math.max(0.1, rock.maxZ - rock.minZ))
    })
    TriggerArea.setBox(sensor, ColliderLayer.CL_PLAYER)
    triggerAreaEventsSystem.onTriggerEnter(sensor, result => {
      if (result.trigger?.entity === engine.PlayerEntity) armRock(rock, true)
    })
    return rock
  })

  function armRock(rock: Rock, broadcast: boolean, at = Date.now()) {
    if (rock.state !== 'ready') return false
    rock.state = 'armed'
    rock.armedAt = elapsed - (broadcast ? 0 : Math.max(0, (Date.now() - at) / 1000))
    TriggerArea.deleteFrom(rock.sensor)
    if (broadcast) {
      playContact()
      publishSharedObstacleEvent('rock', rock.index, 'step')
    }
    return true
  }

  const stopListening = onSharedObstacleEvent(event => {
    if (event.kind !== 'rock' || event.action !== 'step') return
    const rock = rocks[event.index]
    if (rock) armRock(rock, false, event.at)
  })

  return {
    count: rocks.length,
    stepOn(entity: Entity | undefined): boolean {
      const rock = rocks.find(item => item.entity === entity)
      return rock ? armRock(rock, true) : false
    },
    isRock(entity: Entity | undefined): boolean {
      return rocks.some(rock => rock.entity === entity && (rock.state === 'ready' || rock.state === 'armed'))
    },
    isPlayerTouchingRock(player?: Vector3): boolean {
      return rocks.some(rock => (rock.state === 'ready' || rock.state === 'armed') &&
        touchesRockBounds(rock, player))
    },
    /** Grounded support check against transformed visible bounds; broad overlap is not enough. */
    isPlayerSupportedByRock(player?: Vector3): boolean {
      if (!player) return false
      const footY = player.y - 0.88
      const avatarRadius = 0.35
      return rocks.some(rock => {
        if (rock.state !== 'ready' && rock.state !== 'armed') return false
        const transform = Transform.get(rock.entity)
        const top = transform.position.y + rock.maxY
        return footY >= top - 0.3 && footY <= top + 0.2 &&
          player.x + avatarRadius >= rock.home.x + rock.minX &&
          player.x - avatarRadius <= rock.home.x + rock.maxX &&
          player.z + avatarRadius >= rock.home.z + rock.minZ &&
          player.z - avatarRadius <= rock.home.z + rock.maxZ
      })
    },
    update(dt: number, player?: Vector3) {
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) return
      elapsed += dt
      hoverAccumulator += dt
      const updateHover = hoverAccumulator + 1e-9 >= 1 / 20
      if (updateHover) hoverAccumulator %= 1 / 20
      for (const rock of rocks) {
        const idleOffset = () => TUNING.rocks.idleHoverHeight *
          (0.5 + 0.5 * Math.sin(elapsed * Math.PI * 2 * TUNING.rocks.idleHoverFrequency + rock.idlePhase))
        if (rock.state === 'ready' && updateHover) {
          Transform.getMutable(rock.entity).position.y = rock.home.y + idleOffset()
          placeSensor(rock)
        }
        if (rock.state === 'ready' && touchesRockBounds(rock, player)) {
          armRock(rock, true)
        }
        if (rock.state === 'armed' && elapsed - rock.armedAt + 1e-9 >= TUNING.rocks.stepDelay) {
          rock.state = 'falling'
          rock.fallAt = elapsed
          rock.fallStartY = Transform.get(rock.entity).position.y
          GltfContainer.getMutable(rock.entity).visibleMeshesCollisionMask = ColliderLayer.CL_NONE
          TriggerArea.deleteFrom(rock.sensor)
        }
        if (rock.state === 'armed') {
          const age = elapsed - rock.armedAt
          const hitBob = Math.sin(age * Math.PI * 2 * TUNING.rocks.floatFrequency) * TUNING.rocks.floatHeight
          Transform.getMutable(rock.entity).position.y = rock.home.y + idleOffset() + hitBob
          placeSensor(rock)
        }
        if (rock.state === 'falling') {
          const t = Math.min(1, (elapsed - rock.fallAt + 1e-9) / TUNING.rocks.fallDuration)
          Transform.getMutable(rock.entity).position.y = rock.fallStartY - TUNING.rocks.fallDistance * t * t
          if (t >= 1) {
            VisibilityComponent.getMutable(rock.entity).visible = false
            rock.state = 'hidden'
            rock.respawnAt = elapsed + TUNING.rocks.respawnDelay
          }
        } else if (rock.state === 'hidden' && elapsed >= rock.respawnAt) {
          if (overlapsPlayer(rock, player)) {
            rock.respawnAt = elapsed + 0.5
            continue
          }
          rock.riseStartY = Transform.get(rock.entity).position.y
          rock.riseAt = elapsed
          rock.state = 'rising'
          VisibilityComponent.getMutable(rock.entity).visible = true
        } else if (rock.state === 'rising') {
          const t = Math.min(1, (elapsed - rock.riseAt) / TUNING.rocks.riseDuration)
          const eased = 1 - (1 - t) * (1 - t)
          Transform.getMutable(rock.entity).position.y = rock.riseStartY + (rock.home.y - rock.riseStartY) * eased
          if (t >= 1) {
            Transform.getMutable(rock.entity).position = { ...rock.home }
            GltfContainer.getMutable(rock.entity).visibleMeshesCollisionMask =
              ColliderLayer.CL_POINTER | ColliderLayer.CL_PHYSICS
            rock.state = 'ready'
            placeSensor(rock)
            TriggerArea.setBox(rock.sensor, ColliderLayer.CL_PLAYER)
          }
        }
      }
    },
    dispose() { stopListening() }
  }
}

export function createRockField() {
  if (!sharedField) sharedField = makeField()
  return sharedField
}
