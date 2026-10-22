export type Point = { x: number; y: number; z: number }

// Fit the complete world into a centered 5x5-parcel land footprint.
export const BUILD_SCALE = 5 / 3
// Absolute world-space lift for the rocks and fountain, in meters.
export const GROUND_ASSET_LIFT = 0.2
// Geometry scales; native avatar dimensions and the tuned forces do not.
export const ARENA = {
  scale: 1.5 * BUILD_SCALE, size: 48 * BUILD_SCALE, center: { x: 24 * BUILD_SCALE, y: 0, z: 24 * BUILD_SCALE },
  radius: 14.4 * 1.5 * BUILD_SCALE, height: 20 * 1.5 * BUILD_SCALE, floorTop: 0.275 * 1.5 * BUILD_SCALE,
  modelPosition: { x: 24 * BUILD_SCALE, y: 0, z: 15.75 * 1.5 * BUILD_SCALE }
} as const

export function scalePoint(point: Point): Point {
  return { x: point.x * ARENA.scale, y: point.y * ARENA.scale, z: point.z * ARENA.scale }
}

export function insideArena(point: Point, maxHeight = ARENA.height + 1): boolean {
  return point.y >= 0 && point.y <= maxHeight &&
    Math.hypot(point.x - ARENA.center.x, point.z - ARENA.center.z) <= ARENA.radius
}
