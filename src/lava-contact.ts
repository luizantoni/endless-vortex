import { ARENA, BUILD_SCALE, GROUND_ASSET_LIFT, Point } from './arena'
import { TUNING } from './tuning'
// Bounds of Cylinder.001 in blue-lava-vortex-lava.glb, including its authored node translation.
const scale = TUNING.blueLavaVortex.scale * BUILD_SCALE
export const LAVA_SURFACE = {
  x: ARENA.center.x + (13.357259750366211 - 14.102493286132812) / 2 * scale,
  z: ARENA.center.z + (13.310684204101562 - 14.149070739746094) / 2 * scale,
  radiusX: (13.357259750366211 + 14.102493286132812) / 2 * scale,
  radiusZ: (13.310684204101562 + 14.149070739746094) / 2 * scale,
  y: Math.max(ARENA.floorTop, TUNING.blueLavaVortex.y * BUILD_SCALE + GROUND_ASSET_LIFT + (.37876254320144653 - .4189453125) * scale)
}
/** Continuous occupancy, not movement/camera input or a one-frame crossing event. */
export function touchingLava(player: Point | undefined, supported: boolean): boolean {
  if (!player || supported) return false
  const ellipse = ((player.x - LAVA_SURFACE.x) / LAVA_SURFACE.radiusX) ** 2 + ((player.z - LAVA_SURFACE.z) / LAVA_SURFACE.radiusZ) ** 2
  return ellipse <= 1 && player.y >= -1 && player.y - .88 <= LAVA_SURFACE.y + .12
}
export function clearForTakeoff(player: Point | undefined, supported: boolean): boolean {
  return !!player && !supported && player.y - .88 > Math.max(ARENA.floorTop, LAVA_SURFACE.y) + .45
}
