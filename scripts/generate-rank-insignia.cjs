// Original vector insignia, shared by the Nearby HUD and networked avatar badges.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
const {Resvg}=require('@resvg/resvg-js'),{PNG}=require('pngjs')
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/ui/ranks')
fs.mkdirSync(out,{recursive:true})
const moduleRanks={exports:{}}
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/flight-ranks.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleRanks.exports)
const ranks=moduleRanks.exports.FLIGHT_RANKS
const palettes=[
 ['#d5e6ee','#6d8c9a','#243f52'],['#ffdda1','#c17c3b','#6c3617'],['#ffebba','#d38c3e','#793c18'],
 ['#f6ffff','#92bed7','#355d82'],['#f5ffff','#abd8ed','#397eab'],['#e8ffff','#32d5ed','#0862a1'],
 ['#fff8c7','#ffc23e','#98500d'],['#fffbd3','#ffcb4b','#aa4e12'],['#ffffff','#bcecff','#5385b7'],
 ['#e7fff5','#56f0cf','#08757e'],['#fffde2','#ffe17b','#c48319']
]
const star=(x,y,r,fill)=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.43:r;d+=(i?'L':'M')+(x+Math.cos(a)*s).toFixed(2)+' '+(y+Math.sin(a)*s).toFixed(2)}return `<path d="${d}Z" fill="${fill}" stroke="#71421a" stroke-width="1.5"/>`}
const pieces=[]
for(let tier=0;tier<ranks.length;tier++){
 const [light,metal,dark]=palettes[tier],feathers=tier<2?2:tier<6?3:tier<9?4:5
 const defs=`<defs><linearGradient id="metal" x2="0" y2="1"><stop stop-color="${light}"/><stop offset=".35" stop-color="${metal}"/><stop offset=".49" stop-color="${light}"/><stop offset=".53" stop-color="${dark}"/><stop offset="1" stop-color="${metal}"/></linearGradient><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff9cb"/><stop offset=".4" stop-color="#ffd367"/><stop offset=".55" stop-color="#a35b18"/><stop offset="1" stop-color="#ffe18b"/></linearGradient><linearGradient id="shield" x2="0" y2="1"><stop stop-color="#164a62"/><stop offset="1" stop-color="#021322"/></linearGradient><radialGradient id="gem" cx=".3" cy=".2"><stop stop-color="#f8ffff"/><stop offset=".3" stop-color="#68eaff"/><stop offset=".7" stop-color="#0d8bce"/><stop offset="1" stop-color="#06366d"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter></defs>`
 const wing=`<path d="M165 70Q102 64 22 30L38 65Q86 106 164 116Z" fill="url(#metal)" stroke="#061b29" stroke-width="7"/>`+Array.from({length:feathers},(_,j)=>{
  const y=j*18,x=j*16
  return `<path d="M166 ${70+y*.45}Q102 ${64+y*.72} ${24+x} ${34+y}L${38+x} ${60+y}Q97 ${107+y*.54} 166 ${114+y*.40}Z" fill="url(#metal)" stroke="${dark}" stroke-width="2.5"/><path d="M${37+x} ${43+y}Q105 ${78+y*.57} 159 ${80+y*.52}" fill="none" stroke="${light}" stroke-width="2" opacity=".85"/>`
 }).join('')
 const crown=tier>=7?`<path d="M161 44L156 23L175 32L192 ${tier===10?5:15}L209 32L228 23L223 44Z" fill="url(#gold)" stroke="#082337" stroke-width="5"/><path d="M162 42H222" stroke="#fff3a8" stroke-width="3"/>`:''
 const crest=tier===0?'M159 60H225V106Q221 137 192 151Q163 137 159 106Z':tier<5?'M192 43L230 64V108Q223 139 192 157Q161 139 154 108V64Z':'M192 38L235 61L229 116L192 162L155 116L149 61Z'
 const chevrons=1+(tier%3)
 const chevronArt=tier<7?Array.from({length:chevrons},(_,i)=>`<path d="M178 ${113+i*9}L192 ${122+i*9}L206 ${113+i*9}" fill="none" stroke="${light}" stroke-width="4"/>`).join(''):''
 const icon=`${defs}<g stroke-linejoin="round">${wing}<g transform="translate(384 0) scale(-1 1)">${wing}</g>${crown}<path d="${crest}" fill="url(#metal)" stroke="#041724" stroke-width="7"/><path d="${crest}" transform="translate(192 99) scale(.84) translate(-192 -99)" fill="url(#shield)" stroke="${light}" stroke-width="2"/>
 ${tier>=8?`<path d="M192 60L215 85L192 111L169 85Z" fill="url(#gem)" stroke="url(#gold)" stroke-width="3"/>`:''}
 ${tier===0?'<path d="M177 82L192 64L207 82L192 102Z" fill="url(#metal)" stroke="#d5edf2" stroke-width="2"/>':tier<5?star(192,84,17,'url(#metal)'):`<circle cx="192" cy="84" r="${tier>=8?19:23}" fill="url(#gem)" stroke="url(#gold)" stroke-width="3"/><path d="M205 70C185 51 160 82 179 99C200 116 225 87 205 72C188 60 174 85 190 91C203 96 212 78 198 77" fill="none" stroke="#ddffff" stroke-width="3"/>`}
 ${chevronArt}${tier>=7?Array.from({length:tier-6},(_,i)=>star(192+(i-(tier-7)/2)*17,137,7,'url(#gold)')).join(''):''}
 ${tier>=9?`<path d="M130 153Q102 141 104 112M254 153Q282 141 280 112" fill="none" stroke="url(#gold)" stroke-width="5"/>${[0,1,2].map(i=>`<path d="M${112+i*5} ${140+i*6}l-11 -13l14 4M${272-i*5} ${140+i*6}l11 -13l-14 4" fill="url(#gold)"/>`).join('')}`:''}</g>`
 pieces.push(icon)
 const save=(name,h,body)=>{
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="${h}" viewBox="0 0 384 ${h}">${body}</svg>`
  fs.writeFileSync(path.join(out,name+'.svg'),svg)
  const png=new Resvg(svg).render().asPng();fs.writeFileSync(path.join(out,name+'.png'),png)
  return png
 }
 save(`rank-${tier}`,192,icon)
 const png=save(`rank-${tier}-plate`,224,icon+`<path d="M76 174H308L322 188V207L308 221H76L62 207V188Z" fill="url(#shield)" stroke="url(#gold)" stroke-width="3"/><path d="M82 179H302M82 216H302" stroke="#6adcf0" stroke-width="1.5"/>`)
 const img=PNG.sync.read(png),alpha=Buffer.alloc(img.width*img.height)
 for(let i=0;i<alpha.length;i++)alpha[i]=img.data[i*4+3]
 fs.writeFileSync(path.join(out,`rank-${tier}-plate-alpha.png`),PNG.sync.write({width:img.width,height:img.height,data:alpha},{colorType:0,inputColorType:0}))
}
// Shareable progression sheet; actual outline artwork is embedded without font dependencies.
const forms=require('./step-letterforms.json')
function title(text,x,y,size,color){let cur=x;return [...text].map(c=>{const f=forms[c];if(!f)return '';const p=`<path d="${f.path}" transform="translate(${cur} ${y}) scale(${size/100})" fill="${color}"/>`;cur+=(f.advance+2)*size/100;return p}).join('')}
const cards=ranks.map((r,i)=>{const x=24+(i%3)*344,y=90+Math.floor(i/3)*240;return `<g transform="translate(${x} ${y})"><rect width="320" height="220" rx="16" fill="#092838" stroke="#28586b"/><image href="data:image/png;base64,${fs.readFileSync(path.join(out,`rank-${i}.png`)).toString('base64')}" x="24" y="0" width="272" height="136"/>${title(r.name.toUpperCase(),18,164,19,'#fff0b0')}${title(`${r.seconds} SECONDS`,18,195,18,'#8eeaff')}</g>`}).join('')
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="1056" height="1070"><rect width="1056" height="1070" fill="#03131f"/>${title('ENDLESS VORTEX  FLIGHT RANKS',24,48,30,'#ffe5a0')}${cards}</svg>`
fs.mkdirSync(path.join(root,'docs/previews'),{recursive:true});fs.writeFileSync(path.join(root,'docs/previews/rank-insignia.png'),new Resvg(sheet).render().asPng())
console.log('Generated 11 rank insignia, avatar plates, alpha masks, and progression sheet.')
