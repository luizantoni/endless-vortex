const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
test('low-center reward shot faces the avatar, limits lift, and restores normal controls across repeated cycles and interruptions',()=>{
  const data=()=>{const values=new Map();return {create:(id,value={})=>values.set(id,structuredClone(value)),createOrReplace:(id,value)=>values.set(id,structuredClone(value)),getOrNull:id=>values.get(id),getMutable:id=>values.get(id),deleteFrom:id=>values.delete(id)}}
  const Transform=data(),MainCamera=data(),VirtualCamera=data(),InputModifier=data(),AudioSource=data()
  let next=10,force,active=false,played=false,nativeCameraTarget
  AudioSource.playSound=()=>played=true;AudioSource.stopSound=()=>played=false
  const engine={addEntity:()=>next++,PlayerEntity:1,CameraEntity:2}
  // Model a renderer that keeps its last camera target when a component is
  // removed; only an explicit MainCamera update changes that target.
  const setCamera=MainCamera.createOrReplace
  MainCamera.createOrReplace=(id,value)=>{setCamera(id,value);nativeCameraTarget=value.virtualCameraEntity}
  Transform.create(2,{position:{x:38,y:12,z:34}})
  const {ARENA}=require('../src/arena.ts'),{ORB_REWARD}=require('../src/orb-reward.ts'),mod={exports:{}}
  const code=ts.transpileModule(fs.readFileSync('src/orb-cinematic.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  new Function('require','exports',code)(name=>name==='./arena'?{ARENA}:name==='@dcl/sdk/math'?{Vector3:{create:(x,y,z)=>({x,y,z})}}:{engine,Transform,MainCamera,VirtualCamera,InputModifier,AudioSource,Physics:{applyForceToPlayer:(_,value)=>force=value,removeForceFromPlayer:()=>force=undefined}},mod.exports)
  const c=mod.exports.createOrbCinematic(value=>active=value),p={...ARENA.center,y:ORB_REWARD.height}
  for(let cycle=0;cycle<2;cycle++){
    const yaw=cycle*Math.PI/2
    Transform.createOrReplace(1,{position:p,rotation:{x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}})
    assert.equal(c.start(p),true);assert.ok(active&&played)
    const camera=MainCamera.getOrNull(2).virtualCameraEntity,focus=VirtualCamera.getOrNull(camera).lookAtEntity
    const shot=Transform.getOrNull(camera).position,target=Transform.getOrNull(focus).position
    assert.equal(Transform.getOrNull(camera).parent,engine.PlayerEntity,'camera follows live avatar relocation and facing in the renderer')
    assert.equal(Transform.getOrNull(focus).parent,engine.PlayerEntity,'aim point cannot stay at the old pickup position')
    assert.equal(shot.x,0);assert.equal(shot.z,7,'camera sits in front in avatar-local space')
    assert.equal(VirtualCamera.getOrNull(camera).defaultTransition.transitionMode.time,0,'does not blend from the old pickup camera')
    assert.ok(shot.y>target.y,'elevated camera looks downward')
    assert.equal(InputModifier.getOrNull(1),undefined,'native movement and held glide remain enabled during the shot')
    assert.equal(c.start(p),false,'cannot stack cinematic ownership')
    c.update(.1,p);assert.ok(force.y>30&&force.y<=40,'stronger lift launches the upward movement')
    c.update(.1,{...p,y:p.y+2});assert.equal(force.y,0,'lift brakes excessive upward speed')
    const later={...p,y:p.y+10};c.update(.1,later)
    Transform.getMutable(1).position=later
    assert.equal(Transform.getOrNull(focus).position.y,.65,'aim stays attached at the torso as avatar rises')
    assert.equal(Transform.getOrNull(camera).position.z,shot.z,'camera does not orbit unpredictably')
    for(let i=0;i<64;i++)c.update(.1,later)
    assert.equal(active,false);assert.equal(played,false);assert.equal(force,undefined)
    assert.equal(MainCamera.getOrNull(2).virtualCameraEntity,undefined,'explicitly selects the native camera')
    assert.equal(nativeCameraTarget,undefined,'renderer receives a reset instead of retaining the last shot')
    assert.equal(VirtualCamera.getOrNull(camera),undefined,'finished cinematic camera is deactivated')
    assert.equal(InputModifier.getOrNull(1),undefined,'walk, jump and gliding are released')
  }
  Transform.createOrReplace(1,{position:p,rotation:{x:0,y:0,z:0,w:1}})
  c.start(p)
  const turningCamera=MainCamera.getOrNull(2).virtualCameraEntity
  Transform.getMutable(1).rotation={x:0,y:1,z:0,w:0}
  for(let i=0;i<12;i++)c.update(.1,p)
  assert.equal(Transform.getOrNull(turningCamera).parent,1)
  assert.equal(Transform.getOrNull(turningCamera).position.z,7,'local front offset follows an avatar turn without a stale world-space position')
  assert.equal(mod.exports.ORB_CINEMATIC.liftHeight,ARENA.height-8+4,'lift endpoint is exactly four meters higher')
  c.stop()
  const original={mode:{$case:'standard',standard:{disableEmote:true}}}
  InputModifier.createOrReplace(1,original);MainCamera.createOrReplace(2,{virtualCameraEntity:7})
  c.start(p);assert.deepEqual(InputModifier.getOrNull(1),original,'existing controls are never replaced');c.update(.1,undefined)
  assert.equal(active,false);assert.equal(force,undefined)
  assert.equal(MainCamera.getOrNull(2).virtualCameraEntity,undefined,'returns to natural play even if an older camera override existed')
  assert.deepEqual(InputModifier.getOrNull(1),original,'restores preexisting input settings')
  for(const interrupt of [()=>c.update(.1,p,false),()=>c.update(1,p),()=>c.update(.1,{...p,x:p.x+10})]){
    c.start(p);interrupt();assert.equal(c.active,false);assert.equal(force,undefined)
  }
  c.start(p);MainCamera.createOrReplace(2,{virtualCameraEntity:99});c.update(.1,p)
  assert.equal(c.active,false)
  assert.equal(MainCamera.getOrNull(2).virtualCameraEntity,99,'does not overwrite a newer camera owner')
  for(let i=0;i<10;i++)c.update(.1,p)
  assert.equal(MainCamera.getOrNull(2).virtualCameraEntity,99,'release retries respect the next camera owner')
  assert.deepEqual(InputModifier.getOrNull(1),original)
  MainCamera.createOrReplace(2,{virtualCameraEntity:undefined})
  let moving={...p},motion={x:0,y:0,z:0}
  assert.ok(c.start(moving))
  // Integrate the actual controller through a complete ascent and handoff.
  for(let frame=0;frame<400&&c.active;frame++){
    c.update(.02,moving)
    if(!c.active)break
    motion.x+=force.x*.02;motion.y+=(force.y-9.81)*.02;motion.z+=force.z*.02
    moving={x:moving.x+motion.x*.02,y:moving.y+motion.y*.02,z:moving.z+motion.z*.02}
  }
  assert.equal(c.active,false)
  assert.ok(moving.y>=mod.exports.ORB_CINEMATIC.liftHeight,'player ascends to the vortex crown')
  assert.ok(motion.y>7,'handoff retains upward momentum instead of hovering')
  const offset=Math.hypot(moving.x-ARENA.center.x,moving.z-ARENA.center.z)
  assert.ok(offset>1.5&&offset<3,'handoff leaves the player slightly off center')
  assert.equal(force,undefined,'cinematic force is released at handoff')
  assert.equal(nativeCameraTarget,undefined)
})
test('miniature reward spheres follow the avatar in a bounded helix at any teleport destination',()=>{
 const {BUBBLES,goldenPlayerWrapPoint}=require('../src/bubble-rules.ts')
 for(const player of [{x:5,y:8,z:20},{x:40,y:50,z:40}])for(const age of [0,1.4,4])for(let i=0;i<BUBBLES.particleCount;i++){
  const p=goldenPlayerWrapPoint(player,i,age),r=Math.hypot(p.x-player.x,p.z-player.z)
  assert.ok(r>=.5&&r<=1.1);assert.ok(p.y>=player.y-.4&&p.y<=player.y+2.3)
 }
})
