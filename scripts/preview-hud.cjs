// Local visual fixture: renders the actual HUD component tree as HTML, not the DCL client.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
function snapshot(width,height,seconds){
 let render,update
 const R={createElement:(type,props,...children)=>({props:props||{},children:children.flat(Infinity).filter(Boolean)})}
 const modules={
 '@dcl/sdk/react-ecs':{__esModule:true,default:R,UiEntity:'div',ReactEcsRenderer:{setUiRenderer:f=>render=f}},
 '@dcl/sdk/ecs':{engine:{RootEntity:0,addSystem:f=>update=f},UiCanvasInformation:{getOrNull:()=>({width,height})}},
 '@dcl/sdk/math':{Color4:{create:(r,g,b,a)=>({r,g,b,a})}}}
 const m={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/airtime-ui.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,jsxFactory:'ReactEcs.createElement'}}).outputText
 new Function('require','module','exports',code)(n=>modules[n],m,m.exports)
 const {display,setupAirtimeUi}=m.exports
 Object.assign(display,{time:seconds,best:'142.38',state:'Airborne',energy:65,orbs:16,localUser:'local',
 rows:['Nova','Kael','You','Lume','Orin'].map((name,i)=>({rank:i+1,userId:i===2?'local':'fixture'+i,name,airtime:(142.38-i*15).toFixed(2)+'s'}))})
 setupAirtimeUi({lift(){},refresh(){},sound(){}});update(.06)
 if(Number(seconds)%10!==0){update(.45);update(.45)}
 return render()
}
const escape=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
const unit=v=>typeof v==='number'?v+'px':v
function html(node){
 const t=node.props.uiTransform||{},b=node.props.uiBackground,l=node.props.uiText
 let css='box-sizing:border-box;display:flex;position:relative;flex-direction:column;flex-shrink:1;'
 for(const key of ['width','height','flexDirection','alignItems','justifyContent','flexShrink','opacity','overflow'])if(t[key]!==undefined)css+=key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+(['width','height'].includes(key)?unit(t[key]):t[key])+';'
 if(t.positionType==='absolute')css+='position:absolute;'
 for(const [k,v]of Object.entries(t.position||{}))css+=k+':'+unit(v)+';'
 let image=''
 if(b?.texture){
  const u=b.uvs
  if(u?.length){const xs=[u[0],u[2],u[4],u[6]],ys=[u[1],u[3],u[5],u[7]],x=Math.min(...xs),y=1-Math.max(...ys),dw=Math.max(...xs)-x,dh=Math.max(...ys)-Math.min(...ys)
   image='<span style="position:absolute;inset:0;overflow:hidden"><img src="/'+b.texture.src+'" style="position:absolute;max-width:none;width:'+100/dw+'%;height:'+100/dh+'%;left:'+(-100*x/dw)+'%;top:'+(-100*y/dh)+'%"></span>'
  }else image='<img src="/'+b.texture.src+'" style="position:absolute;width:100%;height:100%">'
 }
 if(b?.avatarTexture)image='<span style="background:#325a68;color:#ffe2a0;text-align:center;font-size:18px">♟</span>'
 let content=''
 if(l){const c=l.color||{r:1,g:1,b:1,a:1};content='<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;white-space:nowrap;font-family:Georgia,serif;font-size:'+l.fontSize+'px;color:rgba('+[c.r*255,c.g*255,c.b*255,c.a].join(',')+')">'+escape(l.value)+'</span>'}
 return '<div style="'+css+'">'+image+content+node.children.map(html).join('')+'</div>'
}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost')
 if(url.pathname.startsWith('/assets/ui/modular/')&&/^[a-z]+\.png$/.test(path.basename(url.pathname))){
 const p=path.join(root,url.pathname);if(fs.existsSync(p)){res.setHeader('Content-Type','image/png');return fs.createReadStream(p).pipe(res)}
 }
 if(url.pathname!=='/'){res.writeHead(404);return res.end()}
 const w=Number(url.searchParams.get('w'))||1280,h=Number(url.searchParams.get('h'))||720
 const time=url.searchParams.get('time')||'78.24'
 if(w<300||w>2000||h<300||h>1200){res.writeHead(400);return res.end()}
 res.setHeader('Content-Type','text/html; charset=utf-8')
 res.end('<!doctype html><title>HUD layout fixture</title><style>body{margin:0;background:#0a1826;color:white}nav{height:44px;padding:8px;font:14px Georgia}a{color:#7ff;margin-right:20px}#stage{position:relative;background:radial-gradient(ellipse at center,#3b7187,#152d40);transform-origin:top left}</style><nav>Desktop and landscape HUD fixture · placeholder portraits · <a href="/?w=1280&h=720">Desktop</a><a href="/?w=844&h=390">Landscape phone</a><a href="/?w='+w+'&h='+h+'&time=123456.78">Long numbers</a><a href="/?w='+w+'&h='+h+'&time=80.00">Streak</a></nav><div id="stage" style="width:'+w+'px;height:'+h+'px">'+html(snapshot(w,h,time))+'</div><script>function fit(){document.querySelector("#stage").style.transform="scale("+Math.min(1,innerWidth/'+w+', (innerHeight-50)/'+h+')+")"}fit();onresize=fit</script>')
})
const port=Number(process.argv[2])||8127
server.listen(port,'127.0.0.1',()=>console.log('HUD fixture: http://127.0.0.1:'+port))
