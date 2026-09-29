import { ARENA, scalePoint, Point as Position } from './arena'
type WindArea = { id: 'broad' | 'central'; center: Position; size: Position; lift: number }

// Preserve the prototype's orbit. Lift multipliers apply to every updraft source.
export const AIRFLOW = {
  // Keep the broad lift and center pull paused; the central air tunnel and rotation stay active.
  centralOnly: true,
  rotationEnabled: true,
  center: ARENA.center,
  radius: 5 * ARENA.scale,
  rotationOuterRadius: 5 * ARENA.scale * 1.5 + 1,
  forceMinY: 1.8,
  height: ARENA.height,
  spin: 11,
  inwardPull: 1.05,
  edgeContainment: 2.94,
  lift: 2.25,
  desktopLift: 0.8,
  mobileLift: 0.35,
  zones: [
    { id: 'broad', center: scalePoint({ x: 15.797340393066406, y: 0, z: 16.450000762939453 }),
      size: scalePoint({ x: 15, y: 12, z: 14.899999618530273 }), lift: 10 },
    { id: 'central', center: { ...ARENA.center, y: ARENA.height / 2 },
      size: { ...scalePoint({ x: 3.5999999046325684, y: 0, z: 3.5999999046325684 }), y: ARENA.height }, lift: 44 }
  ] as readonly WindArea[]
} as const

export function liftFor(platform: string): number {
  return /mobile|android|ios|iphone|ipad/i.test(platform) ? AIRFLOW.mobileLift : AIRFLOW.desktopLift
}

// These are air volumes, not solid boxes. Check only the local player; each force
// has a single owner so re-entering does not accumulate another wind source.
export function inWindArea(position: Position, zone: WindArea): boolean {
  return Math.abs(position.x - zone.center.x) <= zone.size.x / 2 &&
    Math.abs(position.y - zone.center.y) <= zone.size.y / 2 &&
    Math.abs(position.z - zone.center.z) <= zone.size.z / 2
}

export function vortexForce(position: Position): Position | undefined {
  if (position.y < 0 || position.y > AIRFLOW.height) return undefined
  const offsetX = position.x - AIRFLOW.center.x
  const offsetZ = position.z - AIRFLOW.center.z
  const distance = Math.hypot(offsetX, offsetZ)
  // Stop affecting players outside the physical tunnel. Within it, keep the original force curve.
  if (distance < 0.1 || distance > ARENA.radius) return undefined
  const radialX = offsetX / distance, radialZ = offsetZ / distance
  const edge = distance / AIRFLOW.radius
  const outside = Math.max(edge - 1, 0)
  const spinFactor = Math.max(1 - outside * 2, 0)
  const inward = AIRFLOW.inwardPull * edge + AIRFLOW.edgeContainment * outside
  return {
    x: -radialZ * AIRFLOW.spin * spinFactor - radialX * inward,
    y: AIRFLOW.lift * Math.max(0.15 + 1 - edge, 0),
    z: radialX * AIRFLOW.spin * spinFactor - radialZ * inward
  }
}

// Tangential rotation is kept separate so it can run without restoring the strong
// inward pull or the extra vertical lift from the original prototype force.
export function rotationForce(position: Position): Position | undefined {
  if (!AIRFLOW.rotationEnabled || position.y < AIRFLOW.forceMinY || position.y > AIRFLOW.height) return undefined
  const offsetX = position.x - AIRFLOW.center.x
  const offsetZ = position.z - AIRFLOW.center.z
  const distance = Math.hypot(offsetX, offsetZ)
  if (distance < 0.1 || distance > ARENA.radius) return undefined
  const spinFactor = distance <= AIRFLOW.radius ? 1 :
    Math.max(1 - (distance - AIRFLOW.radius) / (AIRFLOW.rotationOuterRadius - AIRFLOW.radius), 0)
  if (spinFactor <= 0) return undefined
  return {
    x: offsetZ === 0 ? 0 : -(offsetZ / distance) * AIRFLOW.spin * spinFactor,
    y: 0,
    z: offsetX === 0 ? 0 : (offsetX / distance) * AIRFLOW.spin * spinFactor
  }
}
