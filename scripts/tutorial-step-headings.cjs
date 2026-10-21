// Yellow sans-serif outline images keep lesson names and step digits out of native text rendering.
const forms=require('./step-letterforms.json')
module.exports=save=>{
 const names=['THE UPDRAFT','STEER & GLIDE','GOLDEN ORBS','LIVING PLATFORMS','CHASE YOUR BEST']
 const draw=(text,w,h)=>{
  const labelLength=text.startsWith('FLIGHT GUIDE')?12:0
  const size=i=>i<labelLength?.82:1
  const total=[...text].reduce((sum,c,i)=>sum+(forms[c].advance+2)*size(i),0)
  const scale=Math.min(1,(w-28)/total), baseline=(h+72*scale)/2
  let x=14
  const paths=[...text].map((c,i)=>{
   const factor=scale*size(i), transform=`translate(${x} ${baseline}) scale(${factor})`
   x+=(forms[c].advance+2)*factor
   return {path:`d="${forms[c].path}" transform="${transform}"`,color:i<labelLength?'#d8ba73':'url(#step-yellow)'}
  })
  const title=text.replaceAll('&','&amp;')
  return `<title>${title}</title><defs><linearGradient id="step-yellow" x2="0" y2="1"><stop stop-color="#fff8c5"/><stop offset=".5" stop-color="#ffe16c"/><stop offset="1" stop-color="#ffc846"/></linearGradient></defs><g transform="translate(0 3)" fill="#03121d" stroke="#03121d" stroke-width="4">${paths.map(p=>`<path ${p.path}/>`).join('')}</g>${paths.map(p=>`<path ${p.path} fill="${p.color}"/>`).join('')}`

 }
 names.forEach((name,i)=>{
  const count=`0${i+1} OF 05`
  for(const [mode,text,w,h]of[
   ['full',`FLIGHT GUIDE · ${count} · ${name}`,2400,120],
   ['short',`${count} · ${name}`,1500,120],
   ['progress',`FLIGHT GUIDE · ${count}`,1200,120],
   ['name',name,1100,120]
  ])save(`tutorial-step-${i+1}-${mode}`,w,h,draw(text,w,h))
 })
}
