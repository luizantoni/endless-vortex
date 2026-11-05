const { Resvg } = require('@resvg/resvg-js')
const { writeFileSync } = require('node:fs')

const rows = Array.from({ length: 10 }, (_, i) => {
  const y = 213 + 45 * i
  const accent = ['#f4c776', '#aedeea', '#d49b73'][i] || '#35738c'
  return `<path d="M89 ${y}H1063L1073 ${y+10}V${y+30}L1063 ${y+40}H89L79 ${y+30}V${y+10}Z"
    fill="${i % 2 ? '#102d43' : '#15364d'}" stroke="${accent}" stroke-opacity="${i < 3 ? .65 : .22}"/>
    <path d="M112 ${y+7}L136 ${y+7}L149 ${y+20}L136 ${y+33}H112L99 ${y+20}Z"
      fill="${accent}" fill-opacity=".14" stroke="${accent}" stroke-opacity=".6"/>`
}).join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="768" viewBox="0 0 1152 768">
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#fff0b1"/><stop offset=".25" stop-color="#ad672b"/><stop offset=".48" stop-color="#f6d78c"/>
    <stop offset=".78" stop-color="#75401e"/><stop offset="1" stop-color="#f1bc66"/>
  </linearGradient>
  <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
    <stop stop-color="#194760"/><stop offset=".28" stop-color="#102d41"/><stop offset="1" stop-color="#071321"/>
  </linearGradient>
  <radialGradient id="halo"><stop stop-color="#52caf1" stop-opacity=".29"/><stop offset="1" stop-color="#52caf1" stop-opacity="0"/></radialGradient>
  <g id="wing" fill="none" stroke="url(#gold)" stroke-width="2.5">
    <path d="M0 0C36 3 56 -8 78 -24C68 -3 47 9 13 13M16 17C44 16 57 10 68 0C59 17 45 25 25 25M29 29C44 28 53 23 57 19C54 31 46 35 35 36"/>
  </g>
</defs>
<path d="M0 0H1152V768H0Z" fill="#081724"/>
<path d="M53 14H1099L1138 53V715L1099 754H53L14 715V53Z" fill="url(#gold)"/>
<path d="M62 26H1090L1126 62V706L1090 742H62L26 706V62Z" fill="#0a1b29" stroke="#f9dda1" stroke-width="2"/>
<path d="M69 41H1083L1111 69V699L1083 727H69L41 699V69Z" fill="url(#ink)" stroke="#47a4ba" stroke-width="2"/>
<ellipse cx="576" cy="77" rx="505" ry="148" fill="url(#halo)"/>
<path d="M69 94V69L94 52M1058 52L1083 69V94M69 674V699L94 716M1058 716L1083 699V674" fill="none" stroke="#8cdbea" stroke-width="3"/>
<path d="M576 49L590 63L576 77L562 63Z" fill="url(#gold)" stroke="#fff0b1" stroke-width="1.6"/>
<path d="M576 55L584 63L576 71L568 63Z" fill="#5adeff"/>
<use href="#wing" transform="translate(599 56)"/>
<use href="#wing" transform="translate(553 56) scale(-1 1)"/>
<g text-anchor="middle" font-family="Georgia" font-weight="bold">
  <text x="576" y="128" font-size="48" fill="#070f1b" stroke="#070f1b" stroke-width="7">VORTEX LEADERBOARD</text>
  <text x="576" y="126" font-size="48" fill="url(#gold)" stroke="#fff1c8" stroke-width=".7">VORTEX LEADERBOARD</text>
  <text x="576" y="157" font-size="15" letter-spacing="4" fill="#b8eafa">ALL-TIME FLIGHT RECORDS</text>
</g>
<path d="M95 169H1057M95 675H1057" fill="none" stroke="url(#gold)" stroke-opacity=".73"/>
<g font-family="Georgia" font-weight="bold" font-size="16" letter-spacing="2" fill="#ecc889">
  <text x="124" y="198" text-anchor="middle">RANK</text>
  <text x="185" y="198">PILOT</text>
  <text x="921" y="198" text-anchor="middle">AIRTIME</text>
</g>
${rows}
</svg>`

writeFileSync('assets/ui/leaderboard/flight-records.png', new Resvg(svg, {
  font: { defaultFontFamily: 'Georgia' }
}).render().asPng())
