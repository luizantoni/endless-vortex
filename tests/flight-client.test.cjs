const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
test('takeoff visual event fires once per completed run, including takeoff immediately followed by a platform pause',()=>{
 let receive
 const display={flightStarted:0},imports={
  '@dcl/sdk/network':{isStateSyncronized:()=>true},
  './multiplayer-messages':{flightRoom:{onMessage:(_key,cb)=>receive=cb,send:()=>{}}},
  './airtime-ui':{display}, './flight-feedback':require('../src/flight-feedback.ts')
 }
 const m={exports:{}}
 new Function('require','exports',ts.transpileModule(fs.readFileSync('src/flight-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(key=>imports[key],m.exports)
 m.exports.startFlightClient()
 const send=patch=>receive({payload:JSON.stringify({milliseconds:0,bestMs:1234,userId:'player',rows:[],ready:true,saved:true,resultId:0,phase:'airborne',...patch})})
 send({phase:'finished',milliseconds:1234,resultId:1,result:{milliseconds:1234,record:true,valid:true}})
 assert.ok(display.result)
 send({phase:'airborne'});assert.equal(display.flightStarted,1);assert.equal(display.result,undefined);assert.ok(display.resultEvent,'the result event survives immediate takeoff')
 send({phase:'airborne'});send({phase:'paused'});send({phase:'airborne'});assert.equal(display.flightStarted,1)
 send({phase:'finished',resultId:2,result:{milliseconds:500,record:false,valid:true}})
 send({phase:'paused'});assert.equal(display.flightStarted,2);assert.equal(display.result,undefined)
 send({ready:true,bestMs:95000});assert.equal(display.best,'95.000');assert.equal(display.bestLoaded,true)
 send({ready:false,bestMs:0});assert.equal(display.best,'95.000','reconnecting does not replace a loaded PB with zero')
 send({userId:'other',ready:false,bestMs:0});assert.equal(display.bestLoaded,false,'new identity waits for its own personal record')
})
