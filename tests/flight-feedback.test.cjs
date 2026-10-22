const {test}=require('node:test'),assert=require('node:assert/strict')
const {presentLanding,presentFlightResult}=require('../src/flight-feedback.ts')
test('local lava contact presents a result immediately without a server response',()=>{
 const display={};presentLanding(display,12500,20000)
 assert.equal(display.resultEvent.milliseconds,12500);assert.equal(display.resultEvent.record,false)
 assert.equal(display.resultEvent.provisional,true);assert.equal(display.resultEvent.saved,false)
 display.result=undefined
 assert.ok(display.resultEvent,'an instant lift-off does not erase the visual event')
})
test('server confirmation reconciles the pending popup without restarting or duplicating it',()=>{
 const display={};presentLanding(display,21000,20000)
 const presentationId=display.resultEvent.presentationId
 presentFlightResult(display,{id:100,milliseconds:20950,record:true,valid:true,saved:false})
 assert.equal(display.resultEvent.presentationId,presentationId)
 assert.equal(display.resultEvent.milliseconds,20950);assert.equal(display.resultEvent.provisional,undefined)
 presentFlightResult(display,{id:100,milliseconds:20950,record:true,valid:true,saved:true})
 assert.equal(display.resultEvent.presentationId,presentationId);assert.equal(display.resultEvent.saved,true)
 presentLanding(display,5000,20950);assert.notEqual(display.resultEvent.presentationId,presentationId)
})

test('unknown bests never label a provisional score as a new record',()=>{
 const display={};presentLanding(display,20000,undefined)
 assert.equal(display.result.record,false);assert.equal(display.result.provisional,true)
 assert.equal(display.result.recordKnown,false,'the UI can keep an unknown result pending instead of red')
})
test('the best captured at takeoff classifies a run even if the HUD best has already advanced',()=>{
 const display={best:21};const bestAtTakeoff=10000
 presentLanding(display,21000,bestAtTakeoff)
 assert.equal(display.result.record,true)
 assert.equal(display.result.recordKnown,true)
})
