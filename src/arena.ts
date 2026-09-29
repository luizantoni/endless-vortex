export type Point = { x: number; y: number; z: number }

// Uniform enlargement of the original 2x2-parcel prototype to 3x3 parcels.
// Geometry scales; native avatar dimensions and the tuned forces do not.
export const ARENA = {
  scale: 1.5, size: 48, center: { x: 24, y: 0, z: 24 },
  radius: 14.4 * 1.5, height: 20 * 1.5, floorTop: 0.275 * 1.5,
  modelPosition: { x: 24, y: 0, z: 15.75 * 1.5 }
} as const

export function scalePoint(point: Point): Point {
  return { x: point.x * ARENA.scale, y: point.y * ARENA.scale, z: point.z * ARENA.scale }
}

export function insideArena(point: Point, maxHeight = ARENA.height + 1): boolean {
  return point.y >= 0 && point.y <= maxHeight &&
    Math.hypot(point.x - ARENA.center.x, point.z - ARENA.center.z) <= ARENA.radius
}
