import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { Storage } from '@dcl/sdk/server'
import { FlightAuthority } from './authority-core'
import { flightRoom } from './multiplayer-messages'
import { ARENA, BUILD_SCALE, GROUND_ASSET_LIFT, Point } from './arena'
import { ROCK_LAYOUT } from './rock-layout'
const KEY = 'endless-vortex:completed-flights:v2'
const PERSONAL_KEY='endless-vortex:personal-best:v2'
function rockSupport(position: Point) {
  const feet=position.y-.88,scale=1.2*BUILD_SCALE
  return ROCK_LAYOUT.some(r=>{
    const x=ARENA.center.x+r.x*BUILD_SCALE,z=ARENA.center.z+r.z*BUILD_SCALE
    const top=r.y*BUILD_SCALE+GROUND_ASSET_LIFT+r.maxY*scale
    return Math.abs(feet-top)<.45 && position.x>=x+r.minX*scale-.25 && position.x<=x+r.maxX*scale+.25 &&
      position.z>=z+r.minZ*scale-.25 && position.z<=z+r.maxZ*scale+.25
  })
}
function rockTouch(position: Point) {
  const bottom=position.y-.88,top=position.y+.88,scale=1.2*BUILD_SCALE
  return ROCK_LAYOUT.some(r=>{
    const x=ARENA.center.x+r.x*BUILD_SCALE,y=r.y*BUILD_SCALE+GROUND_ASSET_LIFT,z=ARENA.center.z+r.z*BUILD_SCALE
    return position.x+.3>=x+r.minX*scale && position.x-.3<=x+r.maxX*scale &&
      position.z+.3>=z+r.minZ*scale && position.z-.3<=z+r.maxZ*scale &&
      top>=y+r.minY*scale-.3 && bottom<=y+r.maxY*scale+.3
  })
}
export function startFlightServer() {
  const game=new FlightAuthority({get:()=>Storage.get<string>(KEY),set:value=>Storage.set(KEY,value),
    getPlayer:id=>Storage.player.get<string>(id,PERSONAL_KEY),setPlayer:(id,value)=>Storage.player.set(id,PERSONAL_KEY,value)})
  void game.load().then(()=>console.log(game.ready?'Flight server: persistent records loaded':'Flight server: storage unavailable; retrying'))
  flightRoom.onMessage('flightInput',(data,context)=>{
    if (!context || data.name.length>128) return
    // Wallet identity comes exclusively from the server's authenticated message context.
    game.input(context.from.toLowerCase(),data.supported,data.focused,data.name,Date.now(),data.rockTouch)
  })
  let clock=0,broadcast=0,retry=0
  const connected=new Set<string>()
  engine.addSystem(dt=>{
    if (!Number.isFinite(dt) || dt<=0) return
    clock+=dt;broadcast+=dt;retry+=dt
    if(retry>=5){retry=0;if(!game.ready)void game.load();else void game.flush()}
    if(clock<.05)return
    const sampleDt=clock;clock=0;const now=Date.now(),present=new Set<string>()
    for(const [entity,identity] of engine.getEntitiesWith(PlayerIdentityData)){
      const position=Transform.getOrNull(entity)?.position
      if(!position || !identity.address)continue
      const id=identity.address.toLowerCase();present.add(id)
      game.sample(id,position,sampleDt,now,rockSupport(position),rockTouch(position))
      if(broadcast>=.1)void flightRoom.send('flightState',{payload:JSON.stringify({...game.snapshot(id),userId:id})},{to:[identity.address]})
    }
    for(const id of connected)if(!present.has(id))game.leave(id)
    connected.clear();for(const id of present)connected.add(id)
    if(broadcast>=.1)broadcast=0
  })
}
