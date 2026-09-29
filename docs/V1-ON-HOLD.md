# Endless Vortex V1

**ON HOLD — not the current game.** The user requested a return to basic vortex/tunnel movement after rejecting this implementation. See the root README for the active build.

One arena, two temporary platform behaviors, and a single result: seconds actually observed airborne. This is an implemented playtest build, **not a desktop/mobile gameplay-certified release**. See [verification and test gates](docs/VERIFICATION.md).

## Launch

Use Node **24 or newer**, the pinned SDK **7.24.1**, and a current Decentraland desktop/mobile client. Dependencies are already present in this checkout. On a fresh checkout run `npm ci` first. Do not upgrade the SDK as part of routine testing.

From this scene directory, run the checks and build:

```powershell
npm test
npm run typecheck
npm run build -- --skip-install
```

Start the existing records service in a separate terminal:

```powershell
npm run server
```

Then launch the desktop client:

```powershell
npm start -- --skip-build
```

The service uses `http://127.0.0.1:8787` in local preview. It creates `server/vortex-v1.json` on the first saved result. Wait for the HUD to say **Saved** before closing a session. Stop either process with Ctrl+C.

If npm/npx is unavailable on PATH, these direct commands work with the installed dependencies and were used for verification here:

```powershell
node tests/run.cjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@dcl/sdk-commands/dist/index.js build --skip-install
```

In two terminals:

```powershell
node server/index.js
```

```powershell
node node_modules/@dcl/sdk-commands/dist/index.js start --skip-build
```

Creator Hub's Preview action can also launch the scene. Reload the scene in the editor if it was open during these edits: `assets/scene/main.composite` no longer attaches either legacy wind script. The build regenerates `main.crdt`. Do not reattach the old Wind Area asset pack.

The bundled localhost **legacy WebGL preview has an older Runtime API** and cannot validate V1 physics. Initial runs crashed while asset requests were denied by the sandbox. After granting access to required Decentraland assets, the preview loaded and visibly displayed **CLIENT UPDATE NEEDED**, exercising the capability guard. Use a current native client for physics acceptance testing.

## Play

1. Spawn on the raised green launch deck. Let the avatar settle so the floor probe calibrates. Use **REPLAY** if you spawned elsewhere.
2. Steer with normal desktop movement or the client's touch joystick. Use the client's normal jump action. Double jump, gliding and emotes are disabled for consistent rules.
3. Leave the launch deck to begin. **AIRBORNE** counts seconds; a round landing deck shows **PAUSED** and preserves the attempt. Jump or step off to resume.
4. Touch bubbles for a small recovery impulse. They never add time. Orange diamond platforms marked **↓↓ PUSH ↓↓** apply a downward impulse on entry, after their warning.
5. Decks warn before disappearing. The striped bottom floor ends the attempt. Returning to the launch deck also ends it; there is no permanent safe camping spot during a run.
6. Press/tap **REPLAY** immediately. It saves the earned result and resets only your attempt. **FX** cycles effects volume, including mute. **WEEKLY** opens standings.

No coins, cores, collection scores, multipliers, fixed run duration, shops, upgrades or other game modes are present. Unused original sound assets remain on disk but are excluded from deployment.

## Rules and implementation choices

All tuning lives in [src/tuning.ts](src/tuning.ts). Arena geometry and editor spawn metadata must be changed together if the launch position changes. Medal thresholds of **15 / 30 / 60 seconds are provisional**, not playtest-derived claims.

- Timer transitions use consecutive local observations at approximately 30 Hz, capped by elapsed wall time. Landing/departure boundary intervals are discarded conservatively. Display and ranks use integer milliseconds; displayed precision is not a claim of millisecond measurement accuracy.
- A grounded flag and writable player velocity are absent from this installed SDK. A downward ray calibrates avatar origin on the known launch surface; known collider geometry and observed movement classify later contacts. Motionless samples award no time. A 250 ms gap, lost room connection, desktop mouse unlock, teleport or arena exit ends the run without catch-up. A stalled avatar ends after two seconds; ceiling occupancy ends after three seconds.
- Native steering is preserved. The prior camera/Transform rotation override and three overlapping wind sources were removed. One mild vortex force, measured-speed corrections, flat walls, ceiling braking and recovery impulses use supported Physics APIs. Target bounds are 6 m/s up, 8 m/s down and 7 m/s horizontal; real-client overshoot must be measured.
- Round landing decks use **stable cylindrical collision with visuals rotating around Y**. They support standing and jumping, but do not physically carry the rider around the axis. This is a conservative fallback, not evidence that moving colliders were tested and failed. Do not expand moving collision until desktop/touch tests pass.
- Diamond push platforms have no solid collider; their marked contact volume pushes once per entry with a global cooldown. They cannot trap the avatar underneath. Warnings are textual and geometric as well as colored. Collision/effects stop before the final fade.
- Three pooled platforms, twelve pooled bubbles, one reused audio source, one ray probe, one game update system. Contact effects and pickup state are local. There are no pickup broadcasts, shared force callbacks, avatar collision entities or player-to-player pushes added by the scene.
- Eight allowed platform slots preserve a central escape column. Spawns reserve space and recheck avatar clearance and projected motion at activation. Unsafe events are skipped, never rerolled. Warnings/fades count toward the active cap. Frequency increases over 90 seconds to a minimum 2.2-second interval; force rules do not change.
- Daily seed changes at **00:00 UTC**, sampled at departure. Each run retains that day across midnight. Everyone receives the same candidate sequence relative to departure, with player-specific safety suppression. Course time continues while resting on a platform.
- Weekly standings reset **Monday 00:00 UTC** and use the best airtime completed in that week. Cross-reset runs belong to their completion week while retaining their starting daily seed. Equal millisecond results share a competition rank (1, 1, 3). The top ten rows are displayed; all players' lifetime records remain stored.

## Records and multiplayer deployment

The original small HTTP/JSON-file server is reused. `server/vortex-v1.json` is a new schema: old `leaderboards.json` contains incompatible pop/coin scores and is left untouched. Writes use a temporary file and rename; corrupt databases fail closed. Back up this file before moving the service. Lifetime PBs and earned medals survive weekly resets. Only current and previous weekly tables are retained; archived weekly histories are outside V1 scope.

Records are **client-reported and unauthenticated**, matching the existing service's trust level. This is appropriate for a controlled playtest, not a trusted public competition or prize leaderboard. Authentication and authoritative result validation remain a release decision; no new service was introduced. No gameplay telemetry is sent to a custom analytics system.

The SDK does not provide browser `localStorage` as a guaranteed persistence API. Durable records require the service. When it is unavailable, PBs and a bounded retry queue remain in this scene session only; the HUD says so. Reconnecting reloads saved records but starts a fresh attempt. Unsent results are lost on scene/process reload. Server retries accept completions up to 24 hours old; keep device clocks synchronized to UTC.

For a hosted playtest, set `TUNING.persistence.publicUrl` to the common HTTPS service endpoint, rebuild, and run one persistent server instance behind that endpoint. A blank value intentionally leaves published scenes with session-only records. This task did not publish the scene or deploy a service.

For **mobile on the same trusted LAN**, change `TUNING.persistence.previewUrl` to `http://<PC-LAN-IP>:8787` before rebuilding; loopback on the phone would point to the phone itself. Start the records service on the LAN interface:

```powershell
$env:HOST = '0.0.0.0'
node server/index.js
```

Then launch the scene's mobile QR preview:

```powershell
npm start -- --skip-build --mobile
```

Use the same Wi-Fi and allow the development ports only on your trusted network. For a second desktop instance use `npm start -- --skip-build --multi-instance` with a current client, or two separate devices. Keep only one records service. Check both users have distinct identities before comparing records.

**Per-player obstacle visibility is an unresolved acceptance gate.** Nearby native avatars remain visible, but independent timelines mean another runner may appear to rest on an invisible surface. The local approach is technically expressible without custom multiplayer services; its readability/fairness and client behavior have not been proven. If two-player testing rejects it, the smallest alternative is one shared, UTC-aligned platform timetable with synchronized round starts. That would replace attempt-relative daily starts with daily seeded shared rounds; safety suppression would need all-player occupancy, and weekly result metadata/rules must identify the shared round's course day. Do not silently mix the two course rules on one leaderboard. See the test plan before making that change.

## Source map

| File | Responsibility |
| --- | --- |
| `src/rules.ts` | Timer, UTC boundaries, contact impulse limits, movement limits |
| `src/course.ts` | Daily sequence, spawn safety, warnings and lifetime phases |
| `src/index.ts` | Native SDK adapter, observation, contacts, replay and lifecycle |
| `src/world.ts` | Existing tunnel, simple arena collisions, pooled visuals/audio |
| `src/ui.tsx` | Airtime HUD, replay, medals, volume and standings |
| `src/progress.ts` | Per-identity records, bounded retries and weekly rollover |
| `server/model.js`, `server/index.js` | Existing persistence service adapted to airtime |
| `tests/` | Rule tests, real HTTP tests, installed-SDK adapter fixture |

Project instructions refer to `/.Codex`, which was absent and contained no available skills. As requested by `AGENTS.md`, the recommended setup command is `npx skills add decentraland/sdk-skills`. The separately attached scope document was not available in this workspace; the detailed requirements in the task were used as the implementation scope.
