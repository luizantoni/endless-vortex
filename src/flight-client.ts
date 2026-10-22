import { presentFlightResult } from './flight-feedback'
import { isStateSyncronized } from '@dcl/sdk/network'
import { flightRoom } from './multiplayer-messages'
import { AuthoritySnapshot } from './authority-core'
import { display } from './airtime-ui'
export const authoritativeFlight: {state?:AuthoritySnapshot;receivedAt:number;userId:string;resultSeenAt:number}={receivedAt:0,userId:'',resultSeenAt:0}
export function startFlightClient() {
  flightRoom.onMessage('flightState',data=>{
    try {
      const state=JSON.parse(data.payload) as AuthoritySnapshot & {userId:string}
      if(!Number.isSafeInteger(state.milliseconds) || state.milliseconds<0 || !Number.isSafeInteger(state.bestMs) ||
        typeof state.userId!=='string' || !Array.isArray(state.rows))return
      const previous=authoritativeFlight.state
      if(previous?.resultId && !state.resultId && (state.phase==='airborne'||state.phase==='paused') && authoritativeFlight.userId===state.userId) display.flightStarted++
      const changedUser=authoritativeFlight.userId!==state.userId
      if(state.resultId && (changedUser || previous?.resultId!==state.resultId)) authoritativeFlight.resultSeenAt=Date.now()
      authoritativeFlight.state=state;authoritativeFlight.receivedAt=Date.now();authoritativeFlight.userId=state.userId
      if(changedUser){display.bestLoaded=false;display.best='0.000'}
      if(state.ready){display.best=(state.bestMs/1000).toFixed(3);display.bestLoaded=true}
      display.rows=state.rows.filter(row=>typeof row.name==='string' && typeof row.userId==='string' && Number.isSafeInteger(row.airtimeMs))
        .map(row=>({userId:row.userId,name:row.name,rank:row.rank,airtime:(row.airtimeMs/1000).toFixed(3),phase:'Saved best'}))
      display.storage=!state.ready?'CONNECTING TO RECORDS':state.saved?'SAVED · MULTIPLAYER':'SAVING · RETRYING'
      display.persistentBoard=true
      if(state.result && state.resultId){
        // An older server landing must not replace new local feedback while its reply is in flight.
        if(!display.resultEvent?.provisional || state.resultId!==previous?.resultId) presentFlightResult(display,{id:state.resultId,milliseconds:state.result.milliseconds,record:state.result.record,valid:state.result.valid,saved:state.saved})
      } else if(state.phase==='airborne'||state.phase==='paused') display.result=undefined
    }catch(error){console.error('Invalid flight server state:',String(error))}
  })
}
let inputClock=0,lastRockTouch:boolean|undefined
export function sendFlightInput(dt:number,supported:boolean,rockTouch:boolean,focused:boolean,name:string){
  inputClock+=dt
  if((inputClock<.1 && lastRockTouch===rockTouch) || !isStateSyncronized())return
  inputClock=0
  lastRockTouch=rockTouch
  void flightRoom.send('flightInput',{supported,rockTouch,focused,name:name.slice(0,64)})
}
