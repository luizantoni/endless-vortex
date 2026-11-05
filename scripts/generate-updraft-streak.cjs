const { Resvg } = require('@resvg/resvg-js')
const { writeFileSync } = require('node:fs')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="160" viewBox="0 0 48 160">
<defs>
  <linearGradient id="trail" x1="0" y1="1" x2="0" y2="0">
    <stop stop-color="#0e79ff" stop-opacity="0"/>
    <stop offset=".5" stop-color="#28adff" stop-opacity=".48"/>
    <stop offset=".86" stop-color="#7ae9ff" stop-opacity=".94"/>
    <stop offset="1" stop-color="#e8ffff"/>
  </linearGradient>
  <linearGradient id="core" x1="0" y1="1" x2="0" y2="0">
    <stop stop-color="#4ed4ff" stop-opacity="0"/><stop offset=".48" stop-color="#aef7ff"/>
    <stop offset="1" stop-color="#ffffff"/>
  </linearGradient>
</defs>
<path d="M24 0 C47 23 50 51 24 158 C-2 51 1 23 24 0Z" fill="url(#trail)" opacity=".65"/>
<path d="M24 3 C34 23 39 50 24 145 C9 50 14 23 24 3Z" fill="url(#trail)"/>
<path d="M24 5 C28 20 30 38 24 119 C18 38 20 20 24 5Z" fill="url(#core)"/>
<path d="M11 54L24 38L37 54L24 45Z" fill="#bff8ff" opacity=".79"/>
</svg>`
writeFileSync('assets/ui/modular/updraft-streak.png', new Resvg(svg).render().asPng())
