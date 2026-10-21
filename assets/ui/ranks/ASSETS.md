# Endless Vortex flight-rank insignia

Original editable SVG artwork, exported as transparent PNGs for the native HUD and avatar materials. Regenerate with `npm run rank:assets`.

| Airborne seconds in this run | Rank |
| --- | --- |
| 0 | Cadet |
| 100 | Scout |
| 200 | Pilot |
| 300 | Ace |
| 400 | Sky Captain |
| 500 | Storm Rider |
| 600 | Sky Marshal |
| 700 | Vortex Guard |
| 800 | Aether Commander |
| 900 | Celestial |
| 1000 and above | Vortex Legend |

`rank-N.png` is the small 384×192 username insignia. `rank-N-plate.png` is a 384×224 overhead variant with a separate score ribbon. `rank-N-plate-alpha.png` contains its matching single-channel transparency mask. SVGs are source masters and excluded from scene deployment.

The shared selector in `src/flight-ranks.ts` preserves the existing hundred-second progression and reset behavior. Nearby ranks follow the displayed run airtime; remote runs retain their existing approximate timing. These are not permanent account unlocks. Bronze/silver/gold medals remain separate rewards.

Low ranks use metal wings, a crest and chevrons. Higher families gain a blue vortex core, crown, stars and laurels, culminating in the gold Vortex Legend. Colors and silhouettes complement the Endless Vortex gold/cyan logo. The full comparison sheet is `docs/previews/rank-insignia.png`.
