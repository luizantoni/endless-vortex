const {test}=require('node:test'),assert=require('node:assert/strict')
const {Airtime,FloorContactLatch}=require('../src/airtime.ts')
const epoch=Date.parse('2026-09-08T12:00:00Z')
const sample=(patch={})=>({dt:.1,wallDt:.1,now:epoch,inside:true,connected:true,floor:false,supported:false,moved:false,airborne:true,focused:true,teleported:false,...patch})
const takeoff=(run,patch={})=>{run.update(sample(patch));run.update(sample(patch));assert.equal(run.phase,'airborne')}
test('lava locks the completed score until a stable takeoff starts a fresh run',()=>{
 const run=new Airtime();takeoff(run);for(let i=0;i<20;i++)run.update(sample())
 assert.equal(run.milliseconds,2000)
 assert.equal(run.update(sample({floor:true,airborne:false})),true)
 assert.equal(run.result.milliseconds,2000);assert.equal(run.phase,'finished');assert.equal(run.milliseconds,2000)
 for(let i=0;i<50;i++){
  assert.equal(run.update(sample({floor:i%2===0,airborne:false,moved:true,focused:i%3!==0})),false)
  assert.equal(run.milliseconds,2000,'camera/focus/position changes while grounded never resume the run')
 }
 run.update(sample());assert.equal(run.milliseconds,2000,'one noisy air sample does not reset the result')
 run.update(sample({airborne:false}));assert.equal(run.phase,'finished')
 takeoff(run);assert.equal(run.milliseconds,0);assert.equal(run.result,undefined)
 run.update(sample());assert.equal(run.milliseconds,100)
})
test('brief lava contact latches once; standing on leaves and rocks pauses without finishing',()=>{
 const run=new Airtime(),latch=new FloorContactLatch();takeoff(run);run.update(sample())
 run.update(sample({supported:true,airborne:false}));assert.equal(run.phase,'paused');assert.equal(run.milliseconds,100)
 run.update(sample());run.update(sample());assert.equal(run.milliseconds,200)
 latch.record(true);latch.record(false)
 assert.equal(run.update(sample({floor:latch.consume()})),true);assert.equal(run.milliseconds,200)
 assert.equal(latch.consume(),false)
})
test('lost focus and outside arena pause; returning discards the boundary interval',()=>{
 const run=new Airtime();takeoff(run);run.update(sample());assert.equal(run.milliseconds,100)
 for(const pause of [{focused:false},{inside:false}]){
  run.update(sample(pause));for(let i=0;i<5;i++)run.update(sample(pause))
  assert.equal(run.milliseconds,100);run.update(sample());assert.equal(run.milliseconds,100)
 }
 run.update(sample());assert.equal(run.milliseconds,200)
})
test('interruptions preserve the result but cannot submit it or restart before landing',()=>{
 for(const event of [{connected:false},{teleported:true},{wallDt:30}]){
  const run=new Airtime();takeoff(run);run.update(sample())
  assert.equal(run.update(sample(event)),true);assert.equal(run.milliseconds,100);assert.equal(run.result.valid,false)
  for(let i=0;i<10;i++)run.update(sample());assert.equal(run.phase,'finished')
  run.update(sample({floor:true}));assert.equal(run.milliseconds,100)
  takeoff(run);assert.equal(run.milliseconds,0)
 }
})
test('startup gaps do not disarm a new run; unsupported hovering counts independently of movement',()=>{
 const run=new Airtime();run.update(sample({connected:false}));run.update(sample({wallDt:30}));run.update(sample({teleported:true}))
 takeoff(run);for(let i=0;i<20;i++)run.update(sample({moved:false}));assert.equal(run.milliseconds,2000)
})
test('observed airborne seconds are frame-rate independent and retain the starting day',()=>{
 for(const hz of [20,30,60]){
  const run=new Airtime(),s={dt:1/hz,wallDt:1/hz,now:Date.parse('2026-09-08T23:59:59Z')}
  for(let i=0;i<Math.ceil(.15*hz);i++)run.update(sample(s))
  for(let i=0;i<hz*2;i++)run.update(sample({...s,now:Date.parse('2026-09-09T00:00:01Z')}))
  assert.equal(run.milliseconds,2000);assert.equal(run.day,'2026-09-08')
 }
})
