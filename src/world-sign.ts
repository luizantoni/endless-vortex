import { engine, Material, MeshRenderer, Transform } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion } from '@dcl/sdk/math'
import type { Point } from './arena'

type SignLayout = { position: Point; yawDegrees: number; scale: number; width: number; height: number; faceY: number }

export function createWorldSign({ position, yawDegrees, scale, width, height, faceY }: SignLayout,
  artwork: string, artHeight = height) {
  const root = engine.addEntity()
  Transform.create(root, { position: { ...position }, rotation: Quaternion.fromEulerDegrees(0, yawDegrees, 0),
    scale: { x: scale, y: scale, z: scale } })
  const navy = Color4.create(.036, .086, .14, 1)
  const metal = Color4.create(.22, .15, .077, 1)
  const brass = Color4.create(.76, .49, .19, 1)
  const blue = Color4.create(.19, .79, .97, 1)
  function part(x: number, y: number, z: number, w: number, h: number, d: number, color: Color4, lit = false) {
    const entity = engine.addEntity()
    Transform.create(entity, { parent: root, position: { x, y, z }, scale: { x: w, y: h, z: d } })
    MeshRenderer.setBox(entity)
    Material.setPbrMaterial(entity, { albedoColor: color, metallic: lit ? 0 : .58, roughness: .33,
      ...(lit ? { emissiveColor: Color3.create(.13, .63, 1), emissiveIntensity: 1.5 } : {}) })
  }

  // The face angles inward toward the arena. Keep the installation clear of the flight physics.
  part(0, faceY, .19, width + .03, height + .03, .32, navy)
  part(0, faceY, .41, width - .38, height - .38, .17, metal)
  // The board stands outside the raised arena floor. Ground its feet at world Y=0.
  const footDrop = position.y / scale
  for (const side of [-1, 1]) {
    const x = side * 2.75
    part(x, .1 - footDrop, .31, 1.16, .2, 1.55, navy)
    part(x, .25 - footDrop, .31, .96, .12, 1.32, brass)
    part(x, .67 - footDrop / 2, .31, .56, .76 + footDrop, .63, metal)
    part(x, .67 - footDrop / 2, -.015, .105, .68 + footDrop, .027, blue, true)
    part(x, 1.04, .31, .74, .13, .79, brass)
    part(side * (width / 2 + .11), faceY, .13, .18, height - .64, .32, metal)
    part(side * (width / 2 + .11), faceY, -.043, .062, height - 1.02, .026, blue, true)
  }

  const face = engine.addEntity()
  Transform.create(face, { parent: root, position: { x: 0, y: faceY, z: 0 }, scale: { x: width, y: artHeight, z: 1 } })
  MeshRenderer.setPlane(face)
  Material.setBasicMaterial(face, { texture: Material.Texture.Common({ src: artwork }) })

  return root
}
