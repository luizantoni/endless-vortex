const fs=require('node:fs'),{Resvg}=require('@resvg/resvg-js')
const source=fs.readFileSync('assets/ui/tutorial/digits-blue.svg','utf8')
const red=source.replace(/#[0-9a-f]{6}/gi,color=>{
 const [r,g,b]=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16))
 if(b<=r*1.05 || g<=r*1.05)return color
 const brightness=Math.max(r,g,b)
 return '#'+[brightness,Math.round(brightness*.24),Math.round(brightness*.27)].map(c=>c.toString(16).padStart(2,'0')).join('')
})
fs.writeFileSync('assets/ui/tutorial/digits-red.svg',red)
fs.writeFileSync('assets/ui/tutorial/digits-red.png',new Resvg(red).render().asPng())
