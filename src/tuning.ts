// V1 playtest defaults, not validated balance. Distances are metres, times seconds.
export const TUNING = {
  arena: { center: 16, halfWidth: 10, floorY: 0.35, ceilingY: 22, ceilingBrakeY: 18, dangerY: 4 },
  launch: { x: 16, y: 12, z: 10, width: 3.5, depth: 3.5 },
  movement: {
    walk: 3, jog: 5, run: 5, jumpHeight: 2.5,
    spin: 0.7, inward: 1.2, edgePull: 7, lift: 1.5,
    maxUp: 6, maxDown: 8, maxHorizontal: 7, brakeGain: 5, maxForce: 24,
    sampleInterval: 1 / 30, maxSampleGap: 0.25, maxTeleportDistance: 4,
    stationaryLimit: 2, ceilingLimit: 3, supportTolerance: 0.13, defaultFootOffset: 0.9
  },
  platforms: {
    maxActive: 3, width: 2.8, depth: 2.8, thickness: 0.3,
    rotationDegrees: 35, warning: 1.4, lifetime: 7, disappearWarning: 2, fade: 0.8,
    firstSpawn: 0.8, initialInterval: 3.8, minInterval: 2.2, rampSeconds: 90,
    spacing: 4, clearance: 2.5, minPushY: 8,
    pushImpulse: 3, pushCooldown: 1.5
  },
  bubbles: { count: 12, radius: 0.95, liftImpulse: 2.2, maxUp: 4, cooldown: 0.65, respawn: 7, topY: 17 },
  audio: { clip: 'assets/sounds/hit3.mp3', defaultVolume: 0.5, minInterval: 0.18 },
  medals: [15, 30, 60] as readonly number[],
  visuals: { interval: 1 / 20 },
  // Used only in local preview. Set an HTTPS URL for a hosted playtest service.
  persistence: { previewUrl: 'http://127.0.0.1:8787', publicUrl: '', refreshSeconds: 30 },
  // Enable only for a named-device test session; prints aggregate scene tick timings.
  diagnostics: false
} as const
