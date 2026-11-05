// Generate transparent orb textures shared by the arena and daily HUD.
const { Resvg } = require('@resvg/resvg-js')
const { writeFileSync } = require('node:fs')
const palettes = {
  blue: ['#e9ffff', '#62e7ff', '#3574ff', '#22368f'],
  purple: ['#f0dcff', '#c685ff', '#9e50fc', '#5426a3']
}
for (const [kind, colors] of Object.entries(palettes)) {
  const stops = colors.map((color, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${color}"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="s" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
      <radialGradient id="core"><stop stop-color="white"/><stop offset=".25" stop-color="${colors[1]}" stop-opacity=".9"/><stop offset="1" stop-color="${colors[2]}" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="64" cy="64" r="55" fill="url(#core)"/>
    <circle cx="64" cy="64" r="44" fill="none" stroke="url(#s)" stroke-width="3" opacity=".75"/>
    <path d="M19 66 C17 34 55 12 83 31 C111 51 76 85 60 64 M109 62 C111 94 73 116 45 97 C17 77 52 43 68 64" fill="none" stroke="url(#s)" stroke-width="8" stroke-linecap="round"/>
    <path d="M64 45 L69 59 L84 64 L69 69 L64 84 L59 69 L44 64 L59 59 Z" fill="#f7ffff"/>
    <path d="M103 17 L105 23 L112 25 L105 27 L103 33 L101 27 L94 25 L101 23 Z" fill="${colors[1]}"/>
  </svg>`
  writeFileSync(`assets/ui/modular/orb-${kind}.png`, new Resvg(svg).render().asPng())
}

// A separate silhouette and saturated spectrum keep this pickup readable in bright scenery.
const spectrum = ['#ff315b', '#ff9d23', '#fff94b', '#54ff79', '#31e4ff', '#4b73ff', '#be5bff', '#ff58ce']
const arcs = spectrum.map((color, i) => {
  const point = degrees => {
    const a = degrees * Math.PI / 180
    return `${80 + 54 * Math.cos(a)} ${80 + 54 * Math.sin(a)}`
  }
  return `<path d="M${point(i * 45 - 90)}A54 54 0 0 1 ${point((i + 1) * 45 - 92)}" stroke="${color}"/>`
}).join('')
const rainbow = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
<defs>
  <radialGradient id="aura"><stop offset=".63" stop-color="#5055ff" stop-opacity="0"/><stop offset=".78" stop-color="#656dff" stop-opacity=".54"/><stop offset="1" stop-color="#61e6ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="prism" x1="0" y1="0" x2="1" y2="1">
    ${spectrum.map((color, i) => `<stop offset="${i / (spectrum.length - 1)}" stop-color="${color}"/>`).join('')}
  </linearGradient>
</defs>
<circle cx="80" cy="80" r="78" fill="url(#aura)"/>
<circle cx="80" cy="80" r="54" fill="none" stroke="#11163f" stroke-width="20"/>
<g fill="none" stroke-width="13" stroke-linecap="round">${arcs}</g>
<path d="M80 39L112 80L80 121L48 80Z" fill="url(#prism)" stroke="#151941" stroke-width="6" stroke-linejoin="round"/>
<path d="M80 39L112 80L80 121L48 80Z M48 80H112 M80 39L69 80L80 121L91 80Z" fill="none" stroke="#edffff" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M134 22L137 29L144 32L137 35L134 42L131 35L124 32L131 29Z M24 115L27 122L34 125L27 128L24 135L21 128L14 125L21 122Z" fill="#d4ffff" stroke="#536eff" stroke-width="1.6"/>
</svg>`
writeFileSync('assets/ui/modular/orb-rainbow.png', new Resvg(rainbow).render().asPng())
