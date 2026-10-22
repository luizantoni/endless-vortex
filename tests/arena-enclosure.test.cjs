const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const {ARENA,BUILD_SCALE}=require('../src/arena.ts')
test('5x5 arena enclosure is hollow, invisible, continuous, and starts 1.5m above the floor',()=>{
 let next=1;const transforms=new Map(),walls=[]
 const imports={
  '@dcl/sdk/ecs':{ColliderLayer:{CL_PHYSICS:2},engine:{addEntity:()=>next++},Transform:{create:(id,t)=>transforms.set(id,t)},MeshCollider:{setBox:(id,layer)=>walls.push({id,layer})}},
  '@dcl/sdk/math':{Vector3:{create:(x,y,z)=>({x,y,z})},Quaternion:{fromEulerDegrees:(x,y,z)=>({x,y,z})}},
  './arena':{ARENA,BUILD_SCALE}
 }
 const m={exports:{}};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/arena-enclosure.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(n=>imports[n],m.exports)
 const {ENCLOSURE:E,createArenaEnclosure}=m.exports;createArenaEnclosure()
 assert.equal(ARENA.size,80);assert.equal(ARENA.height,50);assert.equal(walls.length,64)
 assert.equal(E.bottom-ARENA.floorTop,1.5)
 assert.ok(Math.abs(E.radius-29.16)<1e-9,'enclosure radius is another 10% smaller')
 assert.ok(Math.abs(E.top-83.21875)<1e-9,'enclosure extends 20m higher with its base fixed')
 for(const {id,layer}of walls){
  const t=transforms.get(id),r=Math.hypot(t.position.x-ARENA.center.x,t.position.z-ARENA.center.z)
  assert.equal(layer,2)
  assert.ok(Math.abs(t.position.y-t.scale.y/2-E.bottom)<1e-9)
  assert.ok(Math.abs(t.position.y+t.scale.y/2-E.top)<1e-9)
  assert.ok(Math.abs(r-E.radius-E.thickness/2)<1e-9)
  assert.ok(t.scale.z/2>(E.radius+E.thickness/2)*Math.tan(Math.PI/E.segments),'adjacent wall ends overlap')
  assert.ok(r-t.scale.x/2>=E.radius-1e-9,'colliders never fill the arena interior')
 }
 const {LANDINGS,landingSlots}=require('../src/landing-platforms.ts')
 for(const p of landingSlots)assert.ok(Math.hypot(p.x-ARENA.center.x,p.z-ARENA.center.z)+LANDINGS.radius+LANDINGS.radialWobble<E.radius,'whole leaf orbit fits inside enclosure')
 const main=fs.readFileSync('src/index.ts','utf8')
 assert.ok(!main.includes('createAvatarAirtimeBadge'),'scene does not create player-attached graphics')
 const b=fs.readFileSync('assets/models/leaf-platform.glb'),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)))
 for(const material of j.materials)assert.ok(material.emissiveFactor.some(c=>c>0)&&material.emissiveFactor.every(c=>c<=.22),'leaf glow stays subtle')
})
