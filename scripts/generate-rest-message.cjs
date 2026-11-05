const { Resvg } = require('@resvg/resvg-js')
const { writeFileSync } = require('node:fs')

const goldGradient = `  <linearGradient id="gold" x2="0" y2="1">
    <stop stop-color="#fffce9"/><stop offset=".38" stop-color="#ffe698"/><stop offset=".51" stop-color="#b87122"/>
    <stop offset=".76" stop-color="#ffba43"/><stop offset="1" stop-color="#fff1af"/>
  </linearGradient>`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="248" viewBox="0 0 1024 248">
<defs>
  ${goldGradient}
  <linearGradient id="aqua" x2="0" y2="1">
    <stop stop-color="#dfffff"/><stop offset=".46" stop-color="#74ddff"/><stop offset="1" stop-color="#39a4da"/>
  </linearGradient>
  <linearGradient id="line">
    <stop stop-color="#45c5e8" stop-opacity="0"/><stop offset=".45" stop-color="#95f2ff"/><stop offset=".55" stop-color="#95f2ff"/>
    <stop offset="1" stop-color="#45c5e8" stop-opacity="0"/>
  </linearGradient>
</defs>
<g text-anchor="middle" font-family="Georgia" font-weight="bold" stroke-linejoin="round">
  <text x="512" y="48" font-size="41" letter-spacing="4" stroke="#041421" stroke-width="7" fill="url(#aqua)">5 ORBS COLLECTED!</text>
  <text x="512" y="48" font-size="41" letter-spacing="4" fill="url(#aqua)">5 ORBS COLLECTED!</text>
  <text x="512" y="148" font-size="99" stroke="#020b16" stroke-width="16" fill="#020b16">TAKE A REST!</text>
  <text x="512" y="144" font-size="99" stroke="#74dced" stroke-width="10" fill="#0d354a">TAKE A REST!</text>
  <text x="512" y="144" font-size="99" stroke="#152936" stroke-width="6" fill="url(#gold)">TAKE A REST!</text>
  <text x="512" y="144" font-size="99" stroke="#fff3c1" stroke-width="1" fill="url(#gold)">TAKE A REST!</text>
  <text x="512" y="231" font-size="31" letter-spacing="5" stroke="#07101b" stroke-width="5" fill="#ffe4a1">BACK TO FLIGHT IN</text>
  <text x="512" y="231" font-size="31" letter-spacing="5" fill="#ffe4a1">BACK TO FLIGHT IN</text>
</g>
<path d="M265 180H759" stroke="#041320" stroke-width="7"/>
<path d="M265 180H759" stroke="url(#line)" stroke-width="2"/>
<path d="M512 173L519 180L512 187L505 180Z" stroke="#161f2a" stroke-width="3" fill="#ffdc7c"/>
</svg>`
writeFileSync('assets/ui/tutorial/heading-rest-cinematic.png', new Resvg(svg, {
  font: { defaultFontFamily: 'Georgia' }
}).render().asPng())

const bonus = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140" viewBox="0 0 900 140">
<defs>${goldGradient}</defs>
<g text-anchor="middle" font-family="Georgia" font-weight="bold" font-size="88" stroke-linejoin="round">
  <text x="450" y="105" stroke="#020b16" stroke-width="16" fill="#020b16">+30 SEC BONUS</text>
  <text x="450" y="101" stroke="#74dced" stroke-width="10" fill="#0d354a">+30 SEC BONUS</text>
  <text x="450" y="101" stroke="#152936" stroke-width="6" fill="url(#gold)">+30 SEC BONUS</text>
  <text x="450" y="101" stroke="#fff3c1" stroke-width="1" fill="url(#gold)">+30 SEC BONUS</text>
</g>
</svg>`
writeFileSync('assets/ui/tutorial/heading-rest-bonus.png', new Resvg(bonus, {
  font: { defaultFontFamily: 'Georgia' }
}).render().asPng())

const font = { defaultFontFamily: 'Georgia' }
writeFileSync('assets/ui/tutorial/heading-rest-rainbow.png', new Resvg(
  svg.replaceAll('5 ORBS COLLECTED!', 'RAINBOW ORB COLLECTED!'), { font }
).render().asPng())
writeFileSync('assets/ui/tutorial/heading-rest-bonus-rainbow.png', new Resvg(
  bonus.replaceAll('+30 SEC BONUS', '+60 SEC BONUS'), { font }
).render().asPng())
