const fs=require('node:fs')
const {Resvg}=require('@resvg/resvg-js')
const root='assets/ui/tutorial/'
function save(name,width,height,body){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
  fs.writeFileSync(root+name+'.svg',svg)
  fs.writeFileSync(root+name+'.png',new Resvg(svg).render().asPng())
}
save('entry-arrow-blue',128,192,`<defs><linearGradient id="ice" x1="0" x2="1" y1="1" y2="0"><stop stop-color="#0062dd"/><stop offset=".5" stop-color="#2fd8ff"/><stop offset="1" stop-color="#dcffff"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="8"/></filter></defs><path d="M64 10L113 76H87V150H41V76H15Z" fill="#00aaff" opacity=".8" filter="url(#glow)"/><path d="M64 12L112 76H86V154H42V76H16Z" fill="#0477dc" stroke="#b8faff" stroke-width="5" stroke-linejoin="round"/><path d="M64 28L97 72H79V143H49V72H31Z" fill="url(#ice)"/><path d="M64 45V138" stroke="#f5ffff" stroke-width="7" stroke-linecap="round" opacity=".9"/><path d="M37 166Q64 183 91 166" fill="none" stroke="#5ceaff" stroke-width="4" opacity=".8"/>`)
save('entry-wind-blue',96,224,`<defs><linearGradient id="wind" x1="0" x2="1" y1="1" y2="0"><stop stop-color="#13adff" stop-opacity="0"/><stop offset=".28" stop-color="#1fcaff" stop-opacity=".76"/><stop offset=".66" stop-color="#d9ffff" stop-opacity=".96"/><stop offset="1" stop-color="#59dfff" stop-opacity="0"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="7"/></filter></defs><path d="M76 208C-4 178 88 139 33 92C6 69 37 32 64 8" fill="none" stroke="#00bfff" stroke-width="16" opacity=".75" filter="url(#glow)"/><path d="M76 208C-4 178 88 139 33 92C6 69 37 32 64 8" fill="none" stroke="url(#wind)" stroke-width="7" stroke-linecap="round"/><path d="M30 129C48 119 52 103 44 88" fill="none" stroke="#d8ffff" stroke-width="3" opacity=".8"/>`)
