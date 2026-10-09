import { AvatarAnchorPointType, AvatarAttach, Billboard, BillboardMode, engine, Entity, Material,
  MeshRenderer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { myProfile, parentEntity, syncEntity } from '@dcl/sdk/network'

const ROOT = 'assets/ui/modular/'
const BADGE_ROOT = ROOT + 'avatar-badge/'
const MAX_GLYPHS = 9
const GLYPH_HEIGHT = 0.19
const GLYPH_GAP = 0.012
const PLATE_WIDTH = 1.82
const VORTEX_PERIOD = 30
const VORTEX_DURATION = 2.4
const VORTEX_TICK = 0.1
const VORTEX_FRONT_OFFSET = -0.025

function glyphCell(value: string) {
  return Math.max(0, Math.min(9, Number(value)))
}

function setGlyph(entity: Entity, value: string) {
  const digit = glyphCell(value)
  Material.setBasicMaterial(entity, {
    texture: Material.Texture.Common({ src: `${BADGE_ROOT}digits/${digit}.png`, wrapMode: 1 }),
    alphaTexture: Material.Texture.Common({ src: `${BADGE_ROOT}digits/${digit}-alpha.png`, wrapMode: 1 }),
    diffuseColor: Color4.White(), castShadows: false
  })
}

function setPlate(entity: Entity, seconds: number) {
  const tier = Math.min(10, Math.floor(Math.max(0, seconds) / 100))
  const src = tier > 0
    ? `${ROOT}milestones/milestone-${Math.min(10, tier) * 100}.png`
    : `${ROOT}streak.png`
  const alpha = tier > 0
    ? `${BADGE_ROOT}plate-${Math.min(10, tier) * 100}-alpha.png`
    : `${BADGE_ROOT}plate-streak-alpha.png`
  Material.setBasicMaterial(entity, { texture: Material.Texture.Common({ src, wrapMode: 1 }),
    alphaTexture: Material.Texture.Common({ src: alpha, wrapMode: 1 }),
    diffuseColor: Color4.White(), castShadows: false })
  return tier
}

/** Bright UI-art billboard attached to the avatar head and visible to nearby players. */
export function createAvatarAirtimeBadge() {
  let owner = ''
  let anchor: Entity | undefined, billboard: Entity | undefined, plate: Entity | undefined
  let vortex: Entity | undefined
  let glyphs: Entity[] = [], lastGlyphValues: string[] = [], lastText = '', lastTier = -1, updateClock = 0
  let lastVortexStep = 0, vortexAge = VORTEX_DURATION, vortexTick = 0

  function attach(userId: string) {
    if (!Number.isSafeInteger(myProfile.networkId) || myProfile.networkId <= 0) return false

    anchor = engine.addEntity()
    Transform.create(anchor)
    AvatarAttach.create(anchor, { avatarId: userId, anchorPointId: AvatarAnchorPointType.AAPT_NAME_TAG })
    syncEntity(anchor, [AvatarAttach.componentId, Transform.componentId])

    // One billboard parent keeps the plate and every PNG numeral on the exact same plane.
    billboard = engine.addEntity()
    // Use the Explorer's own name-tag anchor so nearby clients keep the badge with
    // the avatar label; lift it 50 cm above that anchor to avoid covering the name.
    Transform.create(billboard, { position: Vector3.create(0, 0.5, 0) })
    Billboard.create(billboard, { billboardMode: BillboardMode.BM_ALL })
    syncEntity(billboard, [Transform.componentId, Billboard.componentId])
    parentEntity(billboard, anchor)

    plate = engine.addEntity()
    Transform.create(plate, { scale: Vector3.create(PLATE_WIDTH, PLATE_WIDTH / 3, 1) })
    MeshRenderer.setPlane(plate)
    lastTier = setPlate(plate, 0)
    syncEntity(plate, [Transform.componentId, MeshRenderer.componentId, Material.componentId])
    parentEntity(plate, billboard)

    glyphs = Array.from({ length: MAX_GLYPHS }, () => {
      const entity = engine.addEntity()
      Transform.create(entity)
      MeshRenderer.setPlane(entity)
      VisibilityComponent.create(entity, { visible: false })
      setGlyph(entity, '0')
      syncEntity(entity, [Transform.componentId, MeshRenderer.componentId, Material.componentId,
        VisibilityComponent.componentId])
      parentEntity(entity, billboard!)
      return entity
    })
    lastGlyphValues = Array(MAX_GLYPHS).fill('')
    lastText = ''
    lastTier = -1

    vortex = engine.addEntity()
    // Center the rotating spiral around the digits; its plane sits between the
    // plate and numerals so the art frames the number instead of obscuring it.
    Transform.create(vortex, { position: Vector3.create(0, 0, VORTEX_FRONT_OFFSET),
      scale: Vector3.create(0.5, 0.5, 1) })
    MeshRenderer.setPlane(vortex)
    Material.setBasicMaterial(vortex, {
      texture: Material.Texture.Common({ src: `${ROOT}vortex.png`, wrapMode: 1 }),
      alphaTexture: Material.Texture.Common({ src: `${BADGE_ROOT}vortex-alpha.png`, wrapMode: 1 }),
      diffuseColor: Color4.White(), castShadows: false
    })
    VisibilityComponent.create(vortex, { visible: false })
    syncEntity(vortex, [Transform.componentId, MeshRenderer.componentId, Material.componentId,
      VisibilityComponent.componentId])
    parentEntity(vortex, billboard)
    lastVortexStep = 0
    vortexAge = VORTEX_DURATION
    vortexTick = 0
    return true
  }

  return {
    update(userId: string, airtime: number, dt: number) {
      if (!userId || !Number.isFinite(airtime)) return
      if (owner !== userId) {
        owner = userId; anchor = undefined; billboard = undefined; plate = undefined; glyphs = []
        lastText = ''; lastGlyphValues = []; lastTier = -1; updateClock = 0
        lastVortexStep = 0; vortexAge = VORTEX_DURATION; vortexTick = 0; vortex = undefined
      }
      if (!plate && !attach(userId)) return

      // Sample at HUD cadence; whole-second text only changes once per second.
      updateClock += Math.max(0, Math.min(0.1, dt || 0))
      if (updateClock < 0.05) return
      const elapsed = updateClock
      updateClock %= 0.05
      const seconds = Math.max(0, airtime)
      const text = String(Math.floor(seconds)).slice(0, MAX_GLYPHS)
      const vortexSize = Math.min(PLATE_WIDTH * 0.76, Math.max(0.48, text.length * 0.14 + 0.21))
      const vortexStep = Math.floor(seconds / VORTEX_PERIOD)
      if (vortexStep < lastVortexStep) {
        lastVortexStep = vortexStep
        vortexAge = VORTEX_DURATION
      }
      else if (vortexStep > lastVortexStep) {
        lastVortexStep = vortexStep
        vortexAge = 0
        vortexTick = 0
      }
      if (vortex) {
        const visibility = VisibilityComponent.getMutable(vortex)
        const visible = vortexAge < VORTEX_DURATION
        if (visibility.visible !== visible) visibility.visible = visible
        if (visible) {
          vortexTick += elapsed
          if (vortexTick >= VORTEX_TICK) {
            vortexTick %= VORTEX_TICK
            const transform = Transform.getMutable(vortex)
            const phase = vortexAge / VORTEX_DURATION
            const scale = vortexSize * (0.88 + 0.12 * Math.sin(phase * Math.PI))
            transform.scale = Vector3.create(scale, scale, 1)
            transform.rotation = Quaternion.fromEulerDegrees(0, 0, phase * 720)
            vortexAge += VORTEX_TICK
          }
        }
      }
      const tier = Math.min(10, Math.floor(seconds / 100))
      if (text === lastText && tier === lastTier) return
      if (tier !== lastTier && plate) lastTier = setPlate(plate, seconds)

      const layoutChanged = text.length !== lastText.length
      if (layoutChanged) {
        const widths = [...text].map(() => GLYPH_HEIGHT * 0.7)
        const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, text.length - 1) * GLYPH_GAP
        const fit = Math.min(1, (PLATE_WIDTH * 0.62) / Math.max(0.001, totalWidth))
        let x = -totalWidth * fit / 2
        for (let i = 0; i < text.length; i++) {
          const width = widths[i] * fit
          // Plane local forward is opposite the plate's visible face in DCL clients.
          // Negative Z brings the numerals toward the camera and prevents occlusion.
          Transform.getMutable(glyphs[i]).position = Vector3.create(x + width / 2, 0, -0.04)
          Transform.getMutable(glyphs[i]).scale = Vector3.create(width, GLYPH_HEIGHT * fit, 1)
          x += width + GLYPH_GAP * fit
        }
      }
      for (let i = 0; i < glyphs.length; i++) {
        const visible = i < text.length
        const visibility = VisibilityComponent.getMutable(glyphs[i])
        if (visibility.visible !== visible) visibility.visible = visible
        if (visible && lastGlyphValues[i] !== text[i]) {
          setGlyph(glyphs[i], text[i])
          lastGlyphValues[i] = text[i]
        }
      }
      lastText = text
    }
  }
}
