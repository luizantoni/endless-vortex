const {test}=require('node:test'),assert=require('node:assert/strict')
const {ARENA}=require('../src/arena.ts')
const {AIRFLOW}=require('../src/vortex.ts')
const {ENTRY_CUES,entryOrbPoint,entryRisePoint}=require('../src/vortex-entry-paths.ts')

test('blue entry orbs move from outside the active lift volume into its center',()=>{
  const half=AIRFLOW.zones.find(zone=>zone.id==='central').size.x/2
  assert.equal(ENTRY_CUES.incoming,48)
  for(const index of [0,1,2,3]){
    const outer=entryOrbPoint(index,0),inner=entryOrbPoint(index,4)
    const distance=p=>Math.hypot(p.x-ARENA.center.x,p.z-ARENA.center.z)
    assert.ok(distance(outer)>half)
    assert.ok(distance(inner)<half)
    assert.ok(inner.y>outer.y)
  }
  assert.equal(ENTRY_CUES.rising,72)
  const low=entryRisePoint(0,0),high=entryRisePoint(0,5.6)
  assert.ok(high.y>low.y+8,'blue orbs rise through the entrance')
})
