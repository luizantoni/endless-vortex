const {test}=require('node:test')
const assert=require('node:assert/strict')
const {vortexReversalTime,vortexReversalAt}=require('../src/vortex-reversal.ts')
const {AIRFLOW,rotationForce}=require('../src/vortex.ts')

test('shared vortex reversals occur at varied 60–120 second intervals and ease through zero',()=>{
 const intervals=new Set()
 const point={x:AIRFLOW.center.x+5,y:12,z:AIRFLOW.center.z}
 for(let i=0;i<100;i++){
  const start=vortexReversalTime(i),gap=vortexReversalTime(i+1)-start
  assert.ok(gap>=60000&&gap<=120000)
  intervals.add(gap)
  const before=vortexReversalAt(start-1),middle=vortexReversalAt(start+750),after=vortexReversalAt(start+1500)
  assert.equal(before.spin,-after.spin)
  assert.equal(Math.abs(middle.spin),0)
  const oldForce=rotationForce(point,before.spin),newForce=rotationForce(point,after.spin)
  assert.equal(oldForce.z,-newForce.z)
  assert.equal(newForce.y,0,'reversal does not change vertical lift')
 }
 assert.ok(intervals.size>1)
})
