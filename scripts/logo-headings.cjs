// Filled serif contours, separate from the monoline lettering used by buttons.
// Outlines are stored locally so asset regeneration needs no installed fonts.
const forms = require('./logo-letterforms.json')
module.exports = save => {
 for (const [name, word, w, h, blue] of [
  ['heading-airtime-special', 'AIRTIME', 800, 180, true],
  ['heading-orbs-special', 'ORBS', 540, 180, false],
  ['heading-teleporting-spheres', 'TELEPORTING SPHERES', 2200, 180, false],
  ['heading-altitude-special', 'ALTITUDE', 920, 180, true]
 ]) {
  const baseline = 142
  const scales = [...word].map((_,i) => (i === 0 || i === word.length-1) ? 1.72 : 1.42)
  const advances = [...word].map((c,i) => forms[c].advance * scales[i] - 7)
  const wordWidth = advances.reduce((a,b)=>a+b,0)
  const textStart = (w - wordWidth) / 2 - 6
  let x = textStart
  const letters = [...word].map((c,i) => {
   const d = `<path d="${forms[c].path}" transform="translate(${x} ${baseline}) skewX(-6) scale(${scales[i]})"/>`
   x += advances[i]
   return d
  }).join('')
  const layer = (fill,stroke,width,extra='') => `<g fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" ${extra}>${letters}</g>`
  const star = (x,y,s) => `<path d="M${x} ${y-s}Q${x+3} ${y-3} ${x+s} ${y}Q${x+3} ${y+3} ${x} ${y+s}Q${x-3} ${y+3} ${x-s} ${y}Q${x-3} ${y-3} ${x} ${y-s}Z" fill="#d6ffff" stroke="#00bfff" stroke-width="2"/>`
  save(name,w,h,`<defs>
   <linearGradient id="logo-face" x1="0" y1="0" x2="0" y2="1">
    <stop stop-color="${blue?'#ffffff':'#fffcec'}"/><stop offset=".28" stop-color="${blue?'#e3fbff':'#fff3b7'}"/>
    <stop offset=".48" stop-color="${blue?'#83e5ff':'#ffd970'}"/><stop offset=".5" stop-color="${blue?'#1786bc':'#c27713'}"/>
    <stop offset=".66" stop-color="${blue?'#4cc9fa':'#ffb12d'}"/><stop offset=".88" stop-color="${blue?'#b0f5ff':'#ffe47b'}"/><stop offset="1" stop-color="${blue?'#f4ffff':'#fff7d3'}"/>
   </linearGradient>
   <linearGradient id="logo-rim" x2="0" y2="1"><stop stop-color="#fffbd6"/><stop offset=".3" stop-color="#ffc95d"/><stop offset=".55" stop-color="#8a400a"/><stop offset=".76" stop-color="#ffbf35"/><stop offset="1" stop-color="#fff3a3"/></linearGradient>
   <linearGradient id="logo-aqua" x2="0" y2="1"><stop stop-color="#d4ffff"/><stop offset=".35" stop-color="#21ddff"/><stop offset="1" stop-color="#087eaa"/></linearGradient>
   <filter id="logo-glow" x="-.2" y="-.5" width="1.4" height="2"><feGaussianBlur stdDeviation="6"/></filter>

  </defs>
  <g transform="translate(${w*.025} 0) scale(.95 1)">
  ${layer('#00d5ff','#00c6ff',8,'opacity=".45" filter="url(#logo-glow)"')}
  <g transform="translate(2 5)">${layer('#020c12','#020c12',16)}</g>
  ${layer('#083c54','url(#logo-aqua)',12)}
  ${layer('#03151d','#03151d',8)}
  ${layer('url(#logo-rim)','url(#logo-rim)',5)}
  ${layer('#351c0b','#351c0b',1.8)}
  ${layer('url(#logo-face)','none',0)}
  <path d="M${textStart-5} ${h-25}Q${textStart+wordWidth*.5} ${h-42} ${w-18} ${h-25}" fill="none" stroke="#04c7f8" stroke-width="5" opacity=".4" filter="url(#logo-glow)"/>
  <path d="M${textStart-10} ${h-24}Q${textStart+wordWidth*.5} ${h-39} ${w-16} ${h-24}Q${textStart+wordWidth*.5} ${h-29} ${textStart-10} ${h-24}" fill="url(#logo-aqua)"/>
  <path d="M${textStart+20} ${h-18}Q${textStart+wordWidth*.5} ${h-29} ${w-45} ${h-18}" fill="none" stroke="url(#logo-rim)" stroke-width="2"/>
  ${star(textStart+wordWidth*.25,28,5)}${star(textStart+wordWidth*.78,139,5)}</g>`)
 }
}
