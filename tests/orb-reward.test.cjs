const {test}=require('node:test'),assert=require('node:assert/strict')
const {ARENA}=require('../src/arena.ts')
const {ORB_REWARD,orbTeleportResponseAccepted,orbRewardArrivalStatus}=require('../src/orb-reward.ts')
const destination={...ARENA.center,y:ORB_REWARD.height}
const pickup={x:ARENA.center.x+12,y:22,z:ARENA.center.z+7}
for(const [client,response] of [['desktop',{success:true}],['iOS',{}],['Android',{}]]){
 test(`${client} reward waits for actual teleport arrival before starting the cinematic`,()=>{
   let confirmed=false,started=false
   const step=(position,now)=>{
     const status=orbRewardArrivalStatus(position,confirmed,now,3000)
     if(status==='arrived')started=true
     return status
   }
   assert.equal(step(pickup,100),'waiting')
   confirmed=orbTeleportResponseAccepted(response)
   assert.equal(confirmed,true)
   assert.equal(step(pickup,150),'waiting','RPC completion alone never points the camera at the pickup spot')
   assert.equal(started,false)
   assert.equal(step(undefined,170),'waiting','a delayed player transform must not start the shot')
   assert.equal(step(destination,250),'arrived')
   assert.equal(started,true)
 })
}
test('explicit desktop failure remains a failure, and missing or malformed replies are rejected',()=>{
 for(const response of [{success:false},{success:null},{success:0},undefined,null,false,'']){
   assert.equal(orbTeleportResponseAccepted(response),false)
 }
 assert.equal(orbRewardArrivalStatus(destination,false,100,3000),'waiting')
})
test('arrival may precede the mobile response without starting the cut early',()=>{
 assert.equal(orbRewardArrivalStatus(destination,false,100,3000),'waiting')
 assert.equal(orbRewardArrivalStatus(destination,orbTeleportResponseAccepted({}),200,3000),'arrived')
})
test('silent or late mobile teleport failures time out instead of hiding the HUD indefinitely',()=>{
 assert.equal(orbRewardArrivalStatus(pickup,true,3001,3000),'expired')
 assert.equal(orbRewardArrivalStatus(undefined,true,3001,3000),'expired')
 assert.equal(orbRewardArrivalStatus(destination,true,3001,3000),'expired','late transforms cannot revive an expired sequence')
})
