// Editable SVG masters + native-client PNG textures. npm run tutorial:assets
const fs = require('node:fs'), path = require('node:path')
const { Resvg } = require('@resvg/resvg-js')
const root = path.resolve(__dirname, '../assets/ui/tutorial')
fs.mkdirSync(root, { recursive: true })
const defs = `<defs>
 <linearGradient id="ink" x2="1" y2="1"><stop stop-color="#103b4a"/><stop offset=".45" stop-color="#061d2a"/><stop offset="1" stop-color="#040f1b"/></linearGradient>
 <linearGradient id="gold" x2="1" y2="1"><stop stop-color="#fff0b5"/><stop offset=".4" stop-color="#e6bd60"/><stop offset="1" stop-color="#9f692d"/></linearGradient>
 <linearGradient id="teal" x2="0" y2="1"><stop stop-color="#2ad8ce"/><stop offset="1" stop-color="#075b75"/></linearGradient>
 <linearGradient id="leaf" x2="1" y2="1"><stop stop-color="#a9f7ad"/><stop offset=".4" stop-color="#31ad85"/><stop offset="1" stop-color="#0b424b"/></linearGradient>
 <radialGradient id="glow"><stop stop-color="#54e8f5" stop-opacity=".25"/><stop offset="1" stop-color="#36cde8" stop-opacity="0"/></radialGradient>
 <radialGradient id="orb" cx=".35" cy=".3"><stop stop-color="#fffde3"/><stop offset=".35" stop-color="#ffdb72"/><stop offset=".8" stop-color="#b67a21"/><stop offset="1" stop-color="#774013"/></radialGradient>
 </defs>`
function save(name, w, h, body) {
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${body}</svg>`
 fs.writeFileSync(path.join(root, name + '.svg'), svg)
 fs.writeFileSync(path.join(root, name + '.png'), new Resvg(svg).render().asPng())
}
const diamond = (x,y,s=8) => `<path d="M${x} ${y-s}l${s*.6} ${s}l-${s*.6} ${s}l-${s*.6}-${s}Z" fill="url(#gold)"/>`
save('panel', 960, 720, `<path d="M28 2H932L958 28V692L932 718H28L2 692V28Z" fill="url(#ink)" stroke="#56adad" stroke-width="2"/>
 <path d="M36 12H924L948 36V684L924 708H36L12 684V36Z" fill="none" stroke="#bc9554" stroke-opacity=".65"/>
 <defs><clipPath id="panel-cutout"><path d="M28 2H932L958 28V692L932 718H28L2 692V28Z"/></clipPath></defs>
 <ellipse cx="160" cy="300" rx="430" ry="380" fill="url(#glow)" clip-path="url(#panel-cutout)"/>
 ${[0,1,2,3].map(i=>`<g transform="translate(${i%2?960:0} ${i>1?720:0}) scale(${i%2?-1:1} ${i>1?-1:1})"><path d="M4 68L4 28L28 4H100L62 14H34L14 34V56Z" fill="url(#gold)"/><path d="M22 65V38L38 22H65" fill="none" stroke="#70e0cd" stroke-width="2"/></g>`).join('')}
 <path d="M130 2H420L480 12L540 2H830M130 718H420L480 708L540 718H830" fill="none" stroke="#d4ad60"/>
 ${diamond(480,12,10)}${diamond(480,708,10)}`)
for (const [name, fill, stroke] of [['button','url(#teal)','#8af6e7'],['button-hover','url(#gold)','#fff1bc'],['button-quiet','url(#ink)','#487a83']]) {
 save(name, 400, 88, `<path d="M16 2H384L398 16V72L384 86H16L2 72V16Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><path d="M22 8H378L392 22M8 62V68L22 80H378" fill="none" stroke="${stroke}" stroke-opacity=".5"/><path d="M30 4H370" stroke="#fff" stroke-opacity=".22"/>`)
}
const rings = `<circle cx="240" cy="190" r="150" fill="url(#glow)"/><g fill="none" stroke="#57b8c4"><ellipse cx="240" cy="290" rx="174" ry="44" opacity=".4"/><ellipse cx="240" cy="290" rx="144" ry="30" opacity=".25"/><path d="M65 290V270M415 290V270M240 340V328" opacity=".7"/></g>`
const wind = `<g fill="none" stroke="url(#teal)" stroke-linecap="round"><path d="M164 279C385 258 329 217 204 220S147 175 273 177S338 131 244 138S184 94 269 76" stroke-width="7"/><path d="M185 286C345 277 376 240 279 232S159 197 222 183S328 162 292 144S211 119 247 104" stroke-width="3"/><path d="M208 292C94 262 149 243 187 239M304 200C367 173 338 155 317 149M211 127C176 110 222 77 240 72" stroke-width="2"/></g>`
const avatar = `<g fill="#defbff" stroke="#9de9ef" stroke-width="2"><circle cx="238" cy="156" r="9"/><path d="M234 168L225 193L241 203L253 179L272 171L268 166L247 173Z"/><path d="M229 190L205 210L208 215L237 201L246 227L252 226L248 198" fill="none" stroke-width="6" stroke-linecap="round"/></g>`
save('flight',480,360,`${rings}${wind}${avatar}<path d="M359 244V159m-12 14l12-14l12 14" stroke="#e8c579" fill="none" stroke-width="2"/>${diamond(112,163,6)}${diamond(336,101,5)}`)
save('glide',480,360,`${rings}<path d="M80 174Q240 55 400 174L287 155L240 180L193 155Z" fill="url(#teal)" stroke="#abf2ed" stroke-width="2"/><path d="M80 174L240 125L400 174M193 155L240 125L287 155M240 125V180" fill="none" stroke="#d0b776" stroke-width="2"/>${avatar}<path d="M113 227Q230 307 364 230m-18-3l18 3l-5 17" fill="none" stroke="#d8b66e" stroke-width="2" stroke-dasharray="6 6"/>`)
save('orbs',480,360,`${rings}${wind}<g>${[[-90,25,23],[0,-45,38],[95,35,23]].map(([x,y,r])=>`<circle cx="${240+x}" cy="${180+y}" r="${r*1.8}" fill="url(#glow)"/><circle cx="${240+x}" cy="${180+y}" r="${r}" fill="url(#orb)"/><ellipse cx="${240+x}" cy="${180+y}" rx="${r*1.35}" ry="${r*.35}" transform="rotate(-30 ${240+x} ${180+y})" fill="none" stroke="#ffe9a0" stroke-width="2"/>`).join('')}</g>${diamond(180,100,6)}${diamond(350,140,8)}`)
save('leaf',480,360,`${rings}<path d="M117 246Q93 82 374 98Q367 291 117 246Z" fill="url(#leaf)" stroke="#8cf1c5" stroke-width="2"/><path d="M100 270Q189 184 345 117M165 218L162 156M204 193L235 246M245 165L248 125M285 143L318 191" fill="none" stroke="#c2f4b3" stroke-width="2" opacity=".7"/><path d="M326 272l17 20l-8 17M354 264l16 21l-8 17" fill="none" stroke="#d7b66c" stroke-width="2" stroke-dasharray="5 4"/>${diamond(105,112,7)}`)
save('airtime',480,360,`${rings}<circle cx="240" cy="183" r="105" fill="url(#ink)" stroke="#c9a45e" stroke-width="3"/><circle cx="240" cy="183" r="93" fill="none" stroke="#498894"/>${Array.from({length:12},(_,i)=>`<path d="M240 99V109" stroke="#edd498" stroke-width="3" transform="rotate(${i*30} 240 183)"/>`).join('')}<path d="M240 121V183L281 206" fill="none" stroke="#9af2e8" stroke-width="5" stroke-linecap="round"/><circle cx="240" cy="183" r="6" fill="url(#gold)"/><path d="M220 70h40M240 70V79M319 99l12-12" stroke="#e5c079" stroke-width="6"/>${diamond(103,176,9)}${diamond(381,175,9)}`)
// A short, original UI tick: soft attack, two decaying sine partials, no external audio.
const sampleRate=22050, count=Math.floor(sampleRate*.085), wav=Buffer.alloc(44+count*2)
wav.write('RIFF');wav.writeUInt32LE(36+count*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*2,40)
for(let i=0;i<count;i++){const t=i/sampleRate,env=Math.min(1,t/.004)*Math.exp(-t*58);wav.writeInt16LE(Math.round(9000*env*(Math.sin(2*Math.PI*920*t)+.22*Math.sin(2*Math.PI*1840*t))),44+i*2)}
fs.writeFileSync(path.resolve(root,'../../sounds/ui-click.wav'),wav)
console.log('Tutorial SVG masters, PNG textures and click sound generated.')

// Bold beveled Roman letterforms matched to the gold/cyan game logo. Paths keep wordmarks independent of installed fonts.
const glyphs = {
 D:'M10 4V76H30C75 76 75 4 30 4H10M1 4H20M1 76H20',
 G:'M56 17C44 -3 9 -1 8 40C7 79 43 85 57 67V45H38M57 4V22',
 H:'M10 4V76M54 4V76M10 40H54M1 4H20M45 4H63M1 76H20M45 76H63',
 M:'M7 76V4L32 53L57 4V76M0 4H14M50 4H64M0 76H17M47 76H64',
 O:'M32 3C0 3 0 77 32 77C64 77 64 3 32 3Z',
 R:'M10 76V4H32C66 4 66 41 32 41H10M32 41L58 76M1 4H20M1 76H22M48 76H65',
 U:'M9 4V54C9 85 55 85 55 54V4M0 4H19M45 4H64',
 B:'M10 4V76H33C67 76 67 40 33 40H10M10 4H31C62 4 62 40 31 40M1 4H20M1 76H20',
 A:'M5 76L31 4L59 76M15 51H49M0 76H18M47 76H64',
 C:'M55 17C43 -3 9 -1 8 40C7 78 42 86 57 66M55 4V22',
 N:'M8 76V4L54 76V4M0 4H17M45 4H62M0 76H17M45 76H62',
 E:'M54 4H10V76H56M10 39H45M54 4V14M56 66V76M45 31V47M2 4H18M2 76H18',
 X:'M8 4L54 76M54 4L8 76M0 4H20M43 4H63M0 76H20M43 76H63',
 T:'M4 14V4H60V14M32 4V76M21 76H43',
 S:'M53 14C45 1 20 -1 11 10C-7 33 66 36 54 62C47 82 17 83 6 65M53 4V20M6 61V77',
 K:'M10 4V76M53 4L11 44M28 31L56 76M1 4H20M1 76H20M43 4H62M46 76H63',
 I:'M32 4V76M18 4H46M18 76H46',
 P:'M10 76V4H32C68 4 68 42 32 42H10M1 4H19M1 76H22',
 F:'M54 4H10V76M10 39H45M54 4V14M45 31V47M2 4H18M2 76H22',
 L:'M10 4V76H56V64M1 4H22M1 76H20',
 Y:'M5 4L32 43L59 4M32 43V76M0 4H17M47 4H64M21 76H43'
}
for (const [name, word] of [['next','NEXT'],['skip','SKIP'],['back','BACK'],['fly','FLY'],['heading-airtime','AIRTIME'],['heading-medals','MEDALS'],['heading-nearby','NEARBY'],['heading-orbs','ORBS'],['flight-guide','FLIGHT GUIDE']]) {
 for (const mode of ['light','dark']) {
  const light=mode==='light', total=word.split('').reduce((n,c)=>n+(c===' '?38:78),0)-14
  const canvasW=Math.max(360,total+62), start=(canvasW-total)/2
  let cursor=start
  const letters=word.split('').map(c=>{const x=cursor;cursor+=c===' '?38:78;return c===' '?'':`<path d="${glyphs[c]}" transform="translate(${x} 16)"/>`}).join('')
  const group=(stroke,width,extra='')=>`<g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="miter" stroke-linecap="square" ${extra}>${letters}</g>`
  save(`${name}-${mode}`,canvasW,112,`<defs>
   <linearGradient id="letter" x1="0" y1="0" x2="0" y2="1">
    <stop stop-color="${light?'#ffffed':'#effbff'}"/>
    <stop offset=".22" stop-color="${light?'#fff4c0':'#beeaff'}"/>
    <stop offset=".48" stop-color="${light?'#ffd368':'#94ddff'}"/>
    <stop offset=".51" stop-color="${light?'#d68b22':'#70c8ef'}"/>
    <stop offset=".8" stop-color="${light?'#ffbd38':'#a0e3ff'}"/>
    <stop offset="1" stop-color="${light?'#fff0a7':'#d7f5ff'}"/>
   </linearGradient></defs>
   ${group('#19c9f4',28,'opacity=".08"')}
   ${group('#17afcd',24,'opacity=".12"')}
   <g transform="translate(2 4)">${group('#050c12',21,'opacity=".8"')}</g>
   ${group(light?'#23150c':'#123b55',20)}
   ${group(light?'#ae661a':'#287da0',18)}
   ${group(light?'#fff0b0':'#d9f5ff',16)}
   ${group('url(#letter)',13)}
   <g fill="${light?'#f3ffff':'#91e4e9'}"><path d="M15 47l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2ZM${canvasW-14} 35l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2Z"/></g>`)

 }
}
save('goal',800,160,`<path d="M0 0H800V160H0Z" fill="url(#ink)" opacity=".85"/><path d="M1 0V160" stroke="url(#gold)" stroke-width="4"/><path d="M12 1H788M12 159H788" stroke="#bca05d" stroke-opacity=".35"/>${diamond(785,80,7)}`)

// HUD exports share the tutorial palette and clipped chamfered corners.
for(const [name,w,h] of [['hud-panel',400,600],['hud-orbs',480,152],['hud-altitude',720,112]]) {
 const cut=18, outline=`M${cut} 2H${w-cut}L${w-2} ${cut}V${h-cut}L${w-cut} ${h-2}H${cut}L2 ${h-cut}V${cut}Z`
 save(name,w,h,`<defs><clipPath id="hud-cutout"><path d="${outline}"/></clipPath></defs>
 <path d="${outline}" fill="url(#ink)" stroke="#65b9b9" stroke-width="2"/>
 <ellipse cx="70" cy="${h*.32}" rx="${w*.8}" ry="${h*.8}" fill="url(#glow)" clip-path="url(#hud-cutout)"/>
 <path d="M24 8H${w-24}L${w-8} 24V${h-24}L${w-24} ${h-8}H24L8 ${h-24}V24Z" fill="none" stroke="#b79655" stroke-opacity=".65"/>
 ${[0,1,2,3].map(i=>`<g transform="translate(${i%2?w:0} ${i>1?h:0}) scale(${i%2?-1:1} ${i>1?-1:1})"><path d="M3 50V18L18 3H70L46 10H24L10 24V44Z" fill="url(#gold)"/><path d="M17 46V28L28 17H48" fill="none" stroke="#70dfd2" stroke-width="1.5"/></g>`).join('')}`)
}

// Base clock glyph paths: 0..9, decimal point and colon. The final atlas adds a slash and seconds suffix below.
const digitPaths=[
 'M32 4C0 4 0 76 32 76C64 76 64 4 32 4Z',
 'M15 20L32 4V76M14 76H50',
 'M8 20C8 -3 59 -3 57 22C56 39 19 51 8 76H58',
 'M8 11C35 -7 66 5 52 28L32 39C67 36 66 80 31 77C20 77 11 73 6 66',
 'M47 76V4L7 52H62',
 'M56 4H11V35C61 22 74 79 29 77C19 77 10 72 6 65',
 'M54 9C29 -6 6 18 7 50C7 88 61 85 59 52C58 25 17 26 8 49',
 'M6 4H59L23 76',
 'M32 4C0 4 1 39 32 39C65 39 65 76 32 77C0 78 0 39 32 39C65 39 65 4 32 4Z',
 'M10 69C35 84 58 60 57 28C57 -10 3 -7 5 26C6 53 47 52 56 29'
]
let atlas=''
for(let i=0;i<12;i++) {
 const x=(i%6)*128, y=Math.floor(i/6)*160
 const shape=i<10?`<path d="${digitPaths[i]}"/>`:i===10?'<circle cx="32" cy="69" r="4.8"/>':'<circle cx="32" cy="22" r="4.8"/><circle cx="32" cy="58" r="4.8"/>'
 const layer=(color,width,extra='')=>`<g fill="${i<10?'none':color}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${shape}</g>`
 atlas+=`<g transform="translate(${x+20.8} ${y+20}) scale(1.35 1.5)">${layer('#0e81b4',24,'opacity=".18"')}${layer('#09253e',18)}${layer('#278bb9',14)}${layer('url(#number-blue)',10)}</g>`
}

for(const [tier,a,b] of [['bronze','#efbd91','#915431'],['silver','#f0fcff','#708ea5'],['gold','#fff3b0','#c28d25']]) {
 for(const earned of [true,false]) {
  const edge=earned?a:'#537184', core=earned?b:'#112a3b'
  const rays=Array.from({length:24},(_,i)=>{const angle=i*Math.PI/12-Math.PI/2,r=i%2?79:91;return`${128+Math.cos(angle)*r},${110+Math.sin(angle)*r}`}).join(' ')
  save(`medal-${tier}-${earned?'earned':'locked'}`,256,288,`<defs><linearGradient id="metal" x2="1" y2="1"><stop stop-color="${edge}"/><stop offset=".5" stop-color="${core}"/><stop offset="1" stop-color="${edge}"/></linearGradient></defs>
   <path d="M65 150L48 269L91 246L116 280L139 167M117 167L149 280L174 246L216 267L192 149" fill="${earned?'#19617b':'#112d40'}" stroke="${edge}" stroke-width="4"/>
   <path d="M75 169L65 237M183 170L198 237" stroke="${earned?'#8be7ed':'#2c4c60'}" stroke-width="3"/>
   <polygon points="${rays}" fill="url(#metal)" stroke="${edge}" stroke-width="4"/>
   <circle cx="128" cy="110" r="68" fill="url(#ink)" stroke="${edge}" stroke-width="5"/>
   <circle cx="128" cy="110" r="57" fill="url(#metal)" stroke="${edge}" stroke-width="2"/>
   ${earned?`<path d="M151 78C111 52 78 108 107 138C139 169 186 119 153 96C127 78 105 113 125 121C138 127 147 110 135 104" fill="none" stroke="${a}" stroke-width="9" stroke-linecap="round"/>
   <path d="M70 130L52 120L60 156L84 163M186 130L204 120L196 156L172 163" fill="${a}"/>`:
   '<path d="M109 104V92C109 66 147 66 147 92V104M105 104H151V140H105Z" fill="none" stroke="#9eb8c8" stroke-width="7"/><circle cx="128" cy="120" r="4" fill="#9eb8c8"/>'}
   <path d="M82 189Q128 217 174 189" fill="none" stroke="${edge}" stroke-width="5"/>
  `)
 }
}
save('portrait-frame',128,128,`<path d="M14 2H114L126 14V114L114 126H14L2 114V14Z" fill="none" stroke="#73d8ef" stroke-width="3"/><path d="M20 7H108L121 20M7 103V108L20 121H108" fill="none" stroke="#d8bd7a" stroke-width="2"/>`)

// Extend the clock atlas with a slash and a sprite seconds suffix. No SDK text is
// needed for orb totals or medal thresholds.
let extraNumeric=''
for(const [i,path] of [[12,'M14 78L50 2'],[13,glyphs.S]]) {
 const x=(i%6)*128, y=Math.floor(i/6)*160
 const layer=(color,width,extra='')=>`<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
 extraNumeric+=`<g transform="translate(${x+20.8} ${y+20}) scale(1.35 1.5)">${layer('#0e81b4',24,'opacity=".18"')}${layer('#09253e',18)}${layer('#278bb9',14)}${layer('url(#number-blue)',10)}</g>`
}
const blueNumeric=`<defs><linearGradient id="number-blue" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset=".3" stop-color="#c4f2ff"/><stop offset=".48" stop-color="#8bdefb"/><stop offset=".52" stop-color="#4eacd9"/><stop offset="1" stop-color="#b3f2ff"/></linearGradient></defs>${atlas}${extraNumeric}`
save('digits-blue',768,480,blueNumeric)
let goldNumeric=blueNumeric
for(const [a,b] of Object.entries({'number-blue':'number-gold','#ffffff':'#fffcec','#c4f2ff':'#fff1b0','#8bdefb':'#ffe081','#4eacd9':'#dca544','#b3f2ff':'#ffeeb0','#0e81b4':'#bc852a','#09253e':'#432710','#278bb9':'#b47721'}))goldNumeric=goldNumeric.replaceAll(a,b)
save('digits-gold',768,480,goldNumeric)

// Tighter crops make the sphere itself large, without losing its orbital band.
save('orb-icon',160,160,`<circle cx="80" cy="80" r="76" fill="url(#glow)" opacity=".25"/><circle cx="80" cy="80" r="64" fill="url(#orb)"/><ellipse cx="80" cy="80" rx="86" ry="22" transform="rotate(-30 80 80)" fill="none" stroke="#fff0b1" stroke-width="3"/>`)
save('orb-empty',160,160,`<circle cx="80" cy="80" r="64" fill="#102c39" stroke="#b59453" stroke-width="3"/><ellipse cx="80" cy="80" rx="86" ry="22" transform="rotate(-30 80 80)" fill="none" stroke="#938455" stroke-width="2"/>`)

// Distinct game-logo headings use filled serif outlines and metallic lighting.
require('./logo-headings.cjs')(save)

// Altitude meter shares the HUD chamfers, with a luminous blue fill.
save('altitude-track',600,28,`<path d="M10 1H590L599 10V18L590 27H10L1 18V10Z" fill="#041521" stroke="#599fb6" stroke-width="2"/><path d="M13 5H587" stroke="#c7efff" stroke-opacity=".25"/>`)
save('altitude-fill',600,24,`<defs><linearGradient id="altitude-blue"><stop stop-color="#1646b7"/><stop offset=".38" stop-color="#168ce0"/><stop offset=".76" stop-color="#35d4fa"/><stop offset="1" stop-color="#b5faff"/></linearGradient><linearGradient id="altitude-glass" x2="0" y2="1"><stop stop-color="#e7ffff" stop-opacity=".5"/><stop offset=".45" stop-color="#9ff4ff" stop-opacity="0"/><stop offset="1" stop-color="#003870" stop-opacity=".3"/></linearGradient></defs><path d="M7 1H593L599 7V17L593 23H7L1 17V7Z" fill="url(#altitude-blue)"/><path d="M7 1H593L599 7V17L593 23H7L1 17V7Z" fill="url(#altitude-glass)"/><path d="M10 4H590" stroke="#e3ffff" stroke-opacity=".65" stroke-width="2"/>`)

require('./tutorial-step-headings.cjs')(save)
