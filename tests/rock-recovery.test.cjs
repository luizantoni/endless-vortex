const {test}=require('node:test'),assert=require('node:assert/strict')
const {RockRecovery}=require('../src/rock-recovery.ts')

test('rock recovery ends on the first frame without active collider contact',()=>{
  const grace=new RockRecovery()
  assert.equal(grace.update(1000,false,false),false)
  assert.equal(grace.update(1050,true,false),true,'first contact is protected before a support ray arrives')
  assert.equal(grace.update(1100,true,true),true,'landing refreshes the recovery window')
  assert.equal(grace.update(2100,true,false),true,'contact retains the short recovery window')
  assert.equal(grace.update(2150,false,false),false,'lava is exposed immediately after leaving the collider')
  assert.equal(grace.update(2200,false,false),false)
  assert.equal(grace.update(2700,true,false),true,'a separate contact can earn another recovery window')
})
