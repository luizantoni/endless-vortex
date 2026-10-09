# Endless Vortex — Chat Context Handoff

Updated 2026-10-09. This file condenses the project's conversation history so work can continue from the repository without needing the original chat. For exact current tuning and implementation detail, see `README.md`, `src/tuning.ts`, and the relevant source modules.

## Project and current state

- Repository: https://github.com/luizantoni/endless-vortex
- Branch: `main`
- Latest published commit when this handoff was prepared: `4a04a80` (`Update Endless Vortex multiplayer scene`).
- The Creator Hub scene is the working Decentraland SDK 7 project. The scene is a 3x3-parcel arena (48 × 48 m); retain the current project as the starting point and preserve native movement, jump, and glider controls.
- The game is an airtime-focused vortex flight scene. Do not expand scope with more maps, shops, combat, quests, or unrelated systems.

## Design decisions captured from the chat

### Core flight and airtime

- The main result is actual airborne time. Standing still, pausing, leaving playable bounds, disconnection, or app suspension must not add time; re-entry while airborne resumes counting without crediting time spent outside.
- Landing on a leaf pauses airtime; leaving it resumes airtime. Only contact with the dedicated floor reset plane ends/resets the attempt. Rock contact and other scenery must not reset the timer.
- The floor reset is intended to be an exact, non-solid trigger very close to floor level. Mobile missed-trigger fallback should use a crossing of that same plane, not a broad altitude threshold.
- Keep movement predictable and bounded. The central air tunnel and tangential vortex force are active; inward pull and other paused forces should not be silently restored. Mobile lift should remain weaker than desktop.
- A past ten-orb reward teleports the collecting player to the arena center at 30 m; it must not stop their airtime timer. Keep reward effects local where they change that player's movement or run state.

### Scene, platforms, rocks, and orbs

- `orchard.glb` is the static visual environment, centered at ground level with its authored proportions preserved. Its visible mesh is intended to collide.
- The blue lava vortex has a stationary mesh. Animate only the lava material slot/UV flow and keep the base gray; the lava and wind visual layers have no collision.
- The leaf model replaces the original disks. Leaves orbit with restrained wind-like motion, use the visible mesh itself for collision, and collapse about two seconds after confirmed player-foot contact. Do not use enlarged invisible pads or reset airtime from a leaf/rock touch.
- Rocks are separate objects based on `rocks2.glb`; use their visible geometry for physical collision. On touch they bob, wait about one second, then fall in about 0.3 seconds and later rise back. Contact must work from the visible geometry, not only from jumping onto their tops.
- Golden orbs replace green bubbles. Use a vortex billboard centered on each orb, a subtle emissive/scan treatment, easier-to-hit contact, and a scale-down/fade plus reusable gold particles on pop. Keep pickup lift small and capped. No attached highlight sphere.
- On collecting ten orbs, use the established teleport reward and a brief celebratory particle effect. The request moved away from a cinematic camera cut and full-screen PNG overlays; keep celebrations aligned with the world/HUD rather than covering the screen with a single image.

### HUD and multiplayer

- Keep the HUD legible and compact, out of the center play space and reserved screen corners. Current design includes a live timer/best/state, nearby-scene player list, orb progress, altitude gauge, and milestone graphics. Do not reintroduce obsolete fixed red plates, redundant status words, or the removed oversized global board.
- Each nearby avatar should show their own whole-second airtime badge attached to the same head/name anchor technique used by Decentraland avatar name UI. The badge should remain bright, aligned, and visible to other players. It changes tier every 100 seconds and has a golden vortex accent at each 30-second mark.
- Global/persistent scores are separate from the nearby scene-player list. Airtime is the ranking value; personal best and medals persist across weekly resets.
- Per-player airtime, attempt, pickup lift/audio/totals remain independent. Rock/leaf/orb world-state changes should be visible to nearby players. No player-to-player pushing or obstacle transform streaming every frame.

## Current implementation snapshot

- Source modules include `src/airtime.ts`, `src/floor-reset-platform.ts`, `src/landing-platforms.ts`, `src/rock-field.ts`, `src/bubbles.ts`, `src/shared-obstacles.ts`, `src/avatar-airtime-badge.ts`, and `src/scene-leaderboard.ts`.
- Multiplayer obstacle transitions use small message-bus events; rocks arm on touch, leaf contact starts collapse, and an orb pop addresses its stable orb index. Orb lift, sound, airtime, and personal pickup totals stay local. Seeded procedural choices are used where applicable.
- The local scene leaderboard estimates nearby players' airtime from avatar motion; local airtime uses the precise timer.
- `README.md` contains the fuller active behavior, assets, and tuning notes. `src/tuning.ts` is the place to adjust shared gameplay constants.

## Known limitations and verification

- `npm run typecheck` passed at the latest check.
- The latest `npm test` run reported 39 passing tests and one failing movement assertion (the `real entry point animates every frame and emits lift...` subtest in `tests/vortex.test.cjs`, checking that the player position changed). Its enclosing SDK suite also reports failure. Re-run and investigate before claiming the full suite passes.
- No live two-client test has verified obstacle-event delivery, late joining, badge visibility, or reconnect behavior. The SDK message bus does not retain a current obstacle snapshot, so a late joiner may not immediately match an obstacle already in progress.
- No named-device mobile/desktop FPS measurements or real multiplayer capacity test have been completed. Do not claim ten-player capacity, mobile readiness, fairness, or fun without those tests.
- The project had repeated Creator Hub upload/deploy timeouts and a Cloudflare block while uploading. GitHub is the source handoff, not proof that a Decentraland deployment succeeded.

## Continue on another computer

Install Git and Node.js 24 or newer, then clone the repository and install the lockfile dependencies:

```powershell
git clone https://github.com/luizantoni/endless-vortex.git
cd endless-vortex
npm ci
npm start
```

Open the cloned project folder in Creator Hub or your editor. `npm start` runs the local Decentraland preview. If you need the local persistence/records service during preview, start a second terminal in the project folder and run `npm run server`.

Before starting work on a computer, run `git pull`. After a change, run the relevant checks, then save and share it with:

```powershell
git add -A
git commit -m "Describe the change"
git push origin main
```

Avoid editing the same checkout from multiple computers at once; push from one computer, then pull on the other.
