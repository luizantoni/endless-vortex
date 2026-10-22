const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const {ARENA}=require('../src/arena.ts'),{ORB_REWARD}=require('../src/orb-reward.ts')
const launch={...ARENA.center,y:ORB_REWARD.height}
function fixture(input,touch){
 const data=()=>{const values=new Map();return {create:(id,value={})=>values.set(id,structuredClone(value)),createOrReplace:(id,value)=>values.set(id,structuredClone(value)),getOrNull:id=>values.get(id),getMutable:id=>values.get(id),deleteFrom:id=>values.delete(id)}}
 const Transform=data(),MainCamera=data(),VirtualCamera=data(),InputModifier=data(),TouchScreenControls=data(),AudioSource=data()
 let next=10,force,active=false,played=false,nativeCameraTarget
 const transitions=[]
 AudioSource.playSound=()=>played=true;AudioSource.stopSound=()=>played=false
 const engine={addEntity:()=>next++,RootEntity:0,PlayerEntity:1,CameraEntity:2}
 const setCamera=MainCamera.createOrReplace
 MainCamera.createOrReplace=(id,value)=>{setCamera(id,value);nativeCameraTarget=value.virtualCameraEntity}
 Transform.create(1,{position:{...launch},rotation:{x:0,y:0,z:0,w:1}})
 Transform.create(2,{position:{x:38,y:12,z:34}})
 if(input)InputModifier.create(1,input)
 if(touch)TouchScreenControls.create(0,touch)
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync('src/orb-cinematic.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
 new Function('require','exports',code)(name=>name==='./arena'?{ARENA}:name==='@dcl/sdk/math'?{Vector3:{create:(x,y,z)=>({x,y,z})}}:{engine,Transform,MainCamera,VirtualCamera,InputModifier,TouchScreenControls,AudioSource,Physics:{applyForceToPlayer:(_,value)=>force=value,removeForceFromPlayer:()=>force=undefined}},mod.exports)
 const c=mod.exports.createOrbCinematic(value=>{active=value;transitions.push(value)})
 return {c,config:mod.exports.ORB_CINEMATIC,engine,Transform,MainCamera,VirtualCamera,InputModifier,TouchScreenControls,transitions,
  get force(){return force},get active(){return active},get played(){return played},get nativeCameraTarget(){return nativeCameraTarget}}
}
function assertReleased(f){
 assert.equal(f.c.active,false);assert.equal(f.active,false);assert.equal(f.force,undefined);assert.equal(f.played,false)
 const controls=f.InputModifier.getOrNull(1).mode.standard
 for(const field of ['disableAll','disableWalk','disableJog','disableRun','disableJump','disableDoubleJump','disableGliding'])assert.notEqual(controls[field],true,field+' is released')
 assert.equal(f.TouchScreenControls.getOrNull(0).hideJoystick,false)
}
test('cinematic camera follows ascent without inheriting joystick-driven avatar rotation',()=>{
 const f=fixture(),{c,Transform,MainCamera,VirtualCamera}=f
 Transform.getMutable(1).rotation={x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}
 assert.equal(c.start(launch),true)
 const camera=MainCamera.getOrNull(2).virtualCameraEntity,rig=Transform.getOrNull(camera).parent
 const offset=structuredClone(Transform.getOrNull(camera).position)
 assert.notEqual(rig,1,'camera is not parented to the turning avatar')
 assert.ok(Math.abs(offset.x-7)<1e-8&&Math.abs(offset.z)<1e-8,'shot captures the front view once')
 const focus=VirtualCamera.getOrNull(camera).lookAtEntity
 assert.equal(Transform.getOrNull(focus).parent,1,'aim point follows the live player')
 for(let i=0;i<30;i++){
   const yaw=i*1.2
   Transform.getMutable(1).rotation={x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}
   c.update(.1,{...launch,y:launch.y+i*.1})
   assert.deepEqual(Transform.getOrNull(camera).position,offset,'held joystick cannot spin the shot')
 }
 assert.ok(Transform.getOrNull(rig).position.y>launch.y,'rig follows the upward movement')
 c.stop();assertReleased(f)
 assert.equal(f.nativeCameraTarget,undefined)
 assert.equal(VirtualCamera.getOrNull(camera),undefined)
})
test('rest temporarily pauses lateral input and hides the joystick while preserving jump/glide settings',()=>{
 const input={mode:{$case:'standard',standard:{disableEmote:true,disableGliding:false,disableJump:false}}}
 const touch={mainAction:4,touchInputs:[{inputAction:1,hide:true}],hideJoystick:false,hideCrosshair:false}
 const f=fixture(input,touch)
 for(let cycle=0;cycle<3;cycle++){
   assert.ok(f.c.start(launch));assert.equal(f.c.start(launch),false)
   const controls=f.InputModifier.getOrNull(1).mode.standard
   for(const field of ['disableWalk','disableJog','disableRun'])assert.equal(controls[field],true)
   assert.equal(controls.disableGliding,false);assert.equal(controls.disableJump,false)
   assert.equal(f.TouchScreenControls.getOrNull(0).hideJoystick,true)
   for(let i=0;i<52;i++)f.c.update(.2,launch)
   assertReleased(f)
   assert.deepEqual(f.InputModifier.getOrNull(1),input)
   assert.deepEqual(f.TouchScreenControls.getOrNull(0),touch,'native action glyph and hidden buttons are restored')
 }
 assert.deepEqual(f.transitions,[true,false,true,false,true,false])
})
test('disconnects, suspension, missing players and camera takeover always release rest controls',()=>{
 for(const interrupt of [f=>f.c.update(.1,undefined),f=>f.c.update(.1,launch,false),f=>f.c.update(1,launch),f=>f.c.update(.1,{...launch,x:launch.x+10}),f=>{f.MainCamera.createOrReplace(2,{virtualCameraEntity:99});f.c.update(.1,launch)}]){
   const f=fixture();f.c.start(launch);f.c.update(.1,launch);interrupt(f);assertReleased(f)
   for(let i=0;i<10;i++)f.c.update(.1,launch)
   if(f.MainCamera.getOrNull(2)?.virtualCameraEntity===99)assert.equal(f.nativeCameraTarget,99,'release retries respect a new camera owner')
   else assert.equal(f.nativeCameraTarget,undefined,'renderer receives an explicit normal-camera reset')
 }
})
test('slow rest ascent gains high altitude and airtime, then hands off upward and slightly off center',()=>{
 const f=fixture();let moving={...launch},motion={x:0,y:0,z:0},elapsed=0
 f.c.start(moving)
 for(let frame=0;frame<600&&f.c.active;frame++){
   f.c.update(.02,moving);elapsed+=.02
   if(!f.c.active)break
   assert.ok(f.force.y<=f.config.maxLiftForce)
   motion.x+=f.force.x*.02;motion.y+=(f.force.y-9.81)*.02;motion.z+=f.force.z*.02
   moving={x:moving.x+motion.x*.02,y:moving.y+motion.y*.02,z:moving.z+motion.z*.02}
 }
 assertReleased(f)
 assert.ok(elapsed>=8&&elapsed<=10.1,'rest provides several seconds of uninterrupted airborne time')
 assert.ok(moving.y>=f.config.liftHeight&&moving.y<ARENA.height-2)
 assert.ok(motion.y>3&&motion.y<6,'ascent remains gentle and hands back upward momentum')
 const offset=Math.hypot(moving.x-ARENA.center.x,moving.z-ARENA.center.z)
 assert.ok(offset>1.5&&offset<3,'player finishes slightly off center')
 assert.equal(f.nativeCameraTarget,undefined)
})
test('miniature reward spheres follow the avatar in a bounded helix at any teleport destination',()=>{
 const {BUBBLES,goldenPlayerWrapPoint}=require('../src/bubble-rules.ts')
 for(const player of [{x:5,y:8,z:20},{x:40,y:46,z:40}])for(const age of [0,1.4,8])for(let i=0;i<BUBBLES.particleCount;i++){
   const p=goldenPlayerWrapPoint(player,i,age),r=Math.hypot(p.x-player.x,p.z-player.z)
   assert.ok(r>=.5&&r<=1.1);assert.ok(p.y>=player.y-.4&&p.y<=player.y+2.3)
 }
})
