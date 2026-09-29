# Endless Vortex V1 verification — 2026-09-08

**Historical report: this V1 implementation was rejected and is now inactive.** The active build restores only the basic vortex/tunnel movement. The 35-test results below do not describe the current build; use the current README and `node tests/run.cjs`.

## Evidence obtained

| Check | Result | What it establishes |
| --- | --- | --- |
| Installed SDK TypeScript check | Pass | Current source matches SDK 7.24.1 types |
| SDK scene build, including production build | Pass | Bundle and Creator Hub composite/CRDT generation succeed |
| `node tests/run.cjs` | 35 tests pass | Pure rules, service behavior, and SDK adapter wiring |
| SDK adapter fixture | Pass | Actual installed ECS components/Physics helpers with simulated observations; launch calibration, timer, landing pause/departure, bubble contact, push entry latch, replay and floor |
| Local HTTP persistence | Pass | Two concurrent user submissions, ties, restart reads, invalid body rejection, corruption preservation |
| Entity reuse in SDK fixture | 52 transformed entities, peak 9 colliders | Structural bound in one local scene instance, no renderer or remote avatars |
| Local preview server | Started on port 8000 | Scene files can be served |
| In-app browser legacy WebGL preview | Compatibility screen verified | With required asset network access, the HUD visibly displays CLIENT UPDATE NEEDED; old Runtime API prevents physics testing |
| Desktop native gameplay | Not performed | No native client control was available to this task |
| Mobile/touch gameplay | Not performed | No physical mobile device session available |
| Two-player and ten-player gameplay | Not performed | No capacity, visibility, collision or fairness claim |
| Device FPS profiling | Not performed | No named-device 60/30 fps result; hardware inventory access was unavailable |

The original build failed because the sandbox denied esbuild parent-directory reads. The same SDK command succeeded with approved parent-directory access. No dependency upgrade was needed. The `.git` directory in this workspace has no usable repository metadata, so this handoff contains file changes rather than staged commits.

Initial browser attempts logged denied requests to Decentraland feature flags/avatar services and a Unity WASM `RuntimeError: null function` in `SendCrdt`. A retry with approved asset network access rendered the compatibility screen successfully. No successful gameplay run was performed in that old client. The temporary preview was stopped after testing.

Automated logs deliberately contain an `offline` message and a corrupt-database error: those come from negative test fixtures and pass assertions. HTTP fixtures use temporary databases, never player records. The adapter's `platform: mobile` is a mocked platform identifier to verify that pointer-lock checks are bypassed; it is **not mobile gameplay evidence**.

## Remaining client limitations

1. **Grounding and timing:** verify calibrated origin and all deck edges against actual client collision. The timer discards ambiguous transition/no-motion intervals; small undercounts are possible. The source does not assert millisecond accuracy.
2. **Movement:** speed corrections assume the Physics impulse changes velocity in the expected native-client way. Measure sampled and between-sample speed, launch height, steering authority and recovery. There is no direct velocity setter. Native client defaults/physics may differ from the legacy browser.
3. **Application pause:** desktop uses pointer unlock plus sample gaps; mobile uses scene-room state, missing motion and frame gaps. SDK 7.24.1 exposes no general foreground/background event. A mobile client that continues sending moving frames while backgrounded is not proven covered. Background/foreground and disconnect tests are mandatory before competitive use.
4. **Deck rotation:** stable collision + rotating visuals is enabled. Physical riding around the rotation axis is not implemented or tested. Landing/takeoff must pass before trying rotating collisions.
5. **Multiplayer:** the source adds no avatar blocking or pushing. Native avatar behavior and invisible remote landing surfaces need real two-player observation. There is no synchronized obstacle replica or obstacle network traffic.
6. **Records:** service must be reachable from each device; default loopback is desktop-local. Current service accepts client-reported identity/results and cannot prevent forged leaderboard submissions. Saved PBs survive reconnect; unsent in-session data cannot survive a process reload.
7. **Scene and world leaderboards:** the mid-right HUD roster is built only from avatars currently in this scene; its local timer is authoritative, while remote airtime is marked approximate because the SDK does not expose remote timer or local-platform support state. The persistent weekly service standings are displayed on the physical board beside the north-west concrete pillar. Verify text scale, readability and update behavior in the native client.
7. **Presentation:** UI uses relative width, a 520-pixel max width and 48-pixel action targets. Actual small-screen layout, notch/safe-area placement, fonts/arrows, occlusion and touch joystick overlap remain unverified.

## Ordered playtest gates

Run gates 1–3 before spending time on medals or extra presentation. Do not add maps or additional behaviors.

### Gate 1 — one desktop and one touch device

Record exact device model, CPU/GPU or mobile chipset, OS, client version, render settings and resolution. Begin on the launch deck. Record a screen video with the HUD visible.

- Wait on launch for 30 seconds: airtime must remain zero. Walk off, then replay and jump off: both must begin an attempt.
- Land centrally and on each edge of a round platform. Stand, walk on it, then jump/step off. Rest must preserve time without incrementing it; departure must resume. Repeat at least 20 landings per device. Verify a disappearing deck drops the player cleanly with no invisible collider.
- Read the push warning at approach speed, including muted audio. Touch from above/below/side, remain in the volume longer than cooldown, leave and re-enter. Only contact entry may push; confirm a second hazard inside the global cooldown cannot stack force.
- Collect bubbles while ascending and descending, then approach two close together. Confirm small capped lift, no direct time jump, no repeated lift while resting, and cooldown/respawn behavior.
- Collect ten local orbs. Confirm an instant move to scene center at y=30, that the relocation does not finish the attempt, the 12-second return window, and continued airtime while moving inside the extended return height and arena's horizontal bounds. Repeat for ten more; other players' pickups must not contribute. Test on desktop and landscape mobile.
- Check all eighteen leaf platforms around the new 14.5 m orbit. Verify the center remains traversable and that player clearance, neighbor spacing and warning-before-collision still hold as the pool fills.
- Touch the floor from a fall and after a jump. The attempt must end. Replay 20 times; PB/medals survive, timer resets, and movement recovers immediately.
- Approach all four walls and corners, the top region and the arena boundary. Verify inward steering remains possible, descent is prompt, top camping ends, and no outside airtime accrues.
- On mobile, use only the normal joystick and jump button. Test recovery while turning the camera, left/right turns and low-altitude bubble approaches. Confirm HUD buttons do not overlap essential controls.

Acceptance: no stuck player, no surprise collision activation inside the avatar, no repeated push, no uncontrolled upward stack. Tune values in `src/tuning.ts`, rerun checks, then repeat the affected cases.

### Gate 2 — lifecycle and time

- On each client, background/minimize while airborne for 1, 10 and 60 seconds. Also open the client menu, lose focus, disconnect Wi-Fi, reconnect and fully restart the client. No inactive time may be added; interrupted runs require replay.
- Repeat while standing on a platform. The platform must not become a permanent camping place. Another user's ongoing attempt must remain intact.
- With a controllable test clock in an isolated build/service, start at 23:59:55 UTC and cross midnight. Compare next attempt: old run keeps old day, new run uses new day.
- Repeat across Sunday/Monday. Finish an old-day run on Monday, retry a Sunday completion after Monday, and reload the service. Only the weekly table resets; lifetime PBs/medals survive. Tests already cover these data boundaries, but client/service clock agreement needs a real run.

### Gate 3 — two players, then ten

- Begin with two distinct identities in the same realm/scene. Start attempts at different times, collect the same bubble independently, land on different decks, and trigger a push. Compare both HUDs continuously.
- Have player A replay, leave, disconnect and reconnect while B stays airborne. B's timer, pickups, collision effects and course must not reset or change.
- Try to walk through another avatar and pass in flight. Verify no blocking/pushing.
- Observe the other runner resting where your own layout has no deck. Record whether this is confusing or acceptable. This is the explicit go/no-go gate for independent obstacles.
- If that approach fails, use the shared-timetable alternative described in README and update the daily start and weekly course metadata assumptions together. Do not just network collision entities into the existing attempt-relative course.
- Only after two-player behavior is acceptable, increase to 4, 6 and 10 real players. Record FPS and memory over repeated runs and joins/leaves. Ten is a test target, not verified capacity.

### Gate 4 — performance and balance

Target 60 fps desktop (16.7 ms frame budget) and 30 fps mobile (33.3 ms). Use the native client's profiler/frame statistics and record median, p95 and worst frame duration over at least five minutes after warm-up, at two and ten players. Include 20 replays and repeated platform expiration cycles; record entity/collider/audio counts before and after.

`TUNING.diagnostics = true` enables local aggregate scene-tick rate/worst-delta logs every ten seconds. It is off by default. These are scene scheduling measurements, **not render FPS**, and they do not send telemetry. Use client tools for render/GPU/memory measurements.

| Device model / OS / client | Players | Resolution/settings | Median FPS | p95 frame ms | Worst ms | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop — untested | 2, then 10 | — | — | — | — | Pending |
| Mobile — untested | 2, then 10 | — | — | — | — | Pending |

Optimize measured bottlenecks first: transparent-wall overdraw, model draw calls, native avatar load, HUD text/material updates or probe frequency. Retain warning lead times, control responsiveness and contact safety. Change one relevant setting at a time and repeat the same device/run sample.

Collect enough complete runs to choose Bronze/Silver/Gold thresholds from actual airtime distributions. The current 15/30/60 defaults are placeholders. No claim of fun, fairness, mobile readiness, retention or competitive integrity has been established.

## Four-week V1 follow-through

- Week 1: run native desktop/touch grounding, movement, floor and replay gates; tune the two platform prototypes.
- Week 2: validate spawn clearance, bubbles, two-player independence and the visibility decision.
- Week 3: validate durable records/reconnect, UTC boundaries and provisional medal thresholds on playtest results.
- Week 4: complete-run playtests, named-device profiling, target ten-player test and observed-bottleneck fixes.

## API evidence

Checked installed SDK 7.24.1 declarations/implementations for `Physics`, `AvatarLocomotionSettings`, `InputModifier`, `RealmInfo`, `PointerLock`, `RaycastResult`, `movePlayerTo`, `getExplorerInformation`, `AudioSource`, and the composite build loader. The ten-orb reward uses `~system/RestrictedActions.movePlayerTo` with scene-relative coordinates and no duration, so it requests an immediate local move. In particular, the loader initializes editor-attached scripts independently of the scene's `main()`, which is why removing only TypeScript wind calls would have left the original excessive lift.

Official documentation consulted: [move a player](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/avatars/move-player) describes moving to local coordinates in the current scene; [player physics](https://docs.decentraland.org/creator/scenes-sdk7/interactivity/player-physics) confirms local-only forces, accumulating impulses and replacing/removing a force by source. Type availability does not establish native-client behavior; the WebGL API mismatch demonstrates the need for the client gates above.
