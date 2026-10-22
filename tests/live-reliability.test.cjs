const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const {touchesLeaf,leafLocalPoint}=require('../src/leaf-contact.ts')
test('leaf contact covers feet, sides and rotated surfaces while rejecting a genuine near miss',()=>{
 const center={x:10,y:10,z:10},q={x:0,y:0,z:0,w:1}
 assert.equal(touchesLeaf({x:10,y:11.38,z:10},center,q,2,1,1),true)
 assert.equal(touchesLeaf({x:12.25,y:10,z:10},center,q,2,1,1),true)
 assert.equal(touchesLeaf({x:12.5,y:10,z:10},center,q,2,1,1),false)
 const yaw={x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}
 assert.equal(touchesLeaf({x:10,y:10,z:12.25},center,yaw,2,1,1),true)
 const local=leafLocalPoint({x:10,y:10,z:12},center,yaw)
 assert.ok(Math.abs(local.x+2)<1e-9)
})
test('scene presence discovers already connected players without estimating their scores',async()=>{
 const peers=new Map([['a',{userId:'a',position:{x:40,y:10,z:40}}],['b',{userId:'b',position:{x:41,y:12,z:40}}]])
 let leave
 const imports={
  '@dcl/sdk/players':{getPlayer:req=>peers.get(req?.userId||'a'),onEnterScene:()=>{},onLeaveScene:cb=>leave=cb},
  '~system/Players':{getPlayersInScene:async()=>({players:[...peers.keys()].map(userId=>({userId}))})}
 }
 const m={exports:{}};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/scene-players.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(key=>imports[key]||{},m.exports)
 const scene=new m.exports.ScenePlayers();scene.update(5);await new Promise(resolve=>setImmediate(resolve))
 assert.equal(scene.positions().length,2)
 peers.delete('b');assert.equal(scene.positions().length,2,'temporary profile gaps do not erase presence')
 leave('b');assert.equal(scene.positions().length,1)
})

const {heldGlideBrake}=require('../src/glide-assist.ts')
test('held glide brakes descent only, releasing immediately on release, landing or ascent',()=>{
 assert.ok(heldGlideBrake(true,true,-8)>0)
 assert.equal(heldGlideBrake(false,true,-8),0)
 assert.equal(heldGlideBrake(true,false,-8),0)
 assert.equal(heldGlideBrake(true,true,4),0)
 assert.equal(heldGlideBrake(true,true,-2),0)
 assert.equal(heldGlideBrake(true,true,NaN),0)
 assert.ok(heldGlideBrake(true,true,-100)<=24)
})
