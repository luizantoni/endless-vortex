const {test}=require('node:test'),assert=require('node:assert/strict')
const {FlightAuthority}=require('../src/authority-core.ts')
const {ARENA}=require('../src/arena.ts')
const {touchingLava,clearForTakeoff,LAVA_SURFACE}=require('../src/lava-contact.ts')
const air={...ARENA.center,y:12},lava={...ARENA.center,y:ARENA.floorTop+.88}
const turn=()=>new Promise(resolve=>setImmediate(resolve))
function fixture(store){
 let now=Date.now()
 const game=new FlightAuthority(store)
 const step=(id,position,options={})=>{now+=50;game.input(id,!!options.supported,options.focused!==false,id,now,!!options.rockTouch);game.sample(id,position,.05,now,!!options.rockSupport,!!options.rockTouchGeometry)}
 const flight=(id,frames)=>{for(let i=0;i<frames;i++)step(id,air);step(id,lava)}
 return {game,step,flight}
}
test('continuous lava occupancy is independent of camera movement and excludes supported rocks',()=>{
 assert.equal(touchingLava(lava,false),true)
 assert.equal(touchingLava({...lava,y:lava.y-.3},false),true)
 assert.equal(touchingLava(lava,true),false)
 assert.equal(clearForTakeoff(lava,false),false)
 assert.equal(clearForTakeoff({...lava,y:lava.y+.2},false),false)
 assert.equal(clearForTakeoff(air,false),true)
 assert.equal(touchingLava({...lava,x:LAVA_SURFACE.x+LAVA_SURFACE.radiusX+1},false),false)
})
test('server completes once, locks score through camera changes and clears the popup only on takeoff',async()=>{
 const {game,step,flight}=fixture({get:async()=>null,set:async()=>true});await game.load()
 flight('alice',43)
 const result=game.snapshot('alice');assert.equal(result.milliseconds,2000);assert.equal(result.result.milliseconds,2000)
 assert.equal(result.result.record,true);assert.equal(result.phase,'finished')
 for(let i=0;i<50;i++)step('alice',lava,{focused:i%2===0})
 assert.equal(game.snapshot('alice').resultId,result.resultId);assert.equal(game.snapshot('alice').milliseconds,2000)
 for(let i=0;i<4;i++)step('alice',air)
 assert.equal(game.snapshot('alice').milliseconds,0);assert.equal(game.snapshot('alice').result,undefined)
 for(let i=0;i<10;i++)step('alice',air);step('alice',lava)
 assert.equal(game.snapshot('alice').result.record,false);assert.equal(game.snapshot('alice').bestMs,2000)
})
test('falling rock contact pauses the run and gives time to recover before lava can finish it',async()=>{
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 for(let i=0;i<24;i++)step('alice',air)
 for(let y=air.y-2;y>lava.y+1;y-=2)step('alice',{...lava,y})
 const before=game.snapshot('alice').milliseconds
 step('alice',lava,{supported:true,rockSupport:true,rockTouch:true,rockTouchGeometry:true})
 for(let i=0;i<10;i++)step('alice',lava,{rockTouch:true,rockTouchGeometry:true})
 assert.equal(game.snapshot('alice').result,undefined)
 assert.equal(game.snapshot('alice').milliseconds,before)
 for(let y=lava.y+2;y<air.y;y+=2)step('alice',{...lava,y})
 for(let i=0;i<8;i++)step('alice',air)
 assert.equal(game.snapshot('alice').phase,'airborne')
 assert.ok(game.snapshot('alice').milliseconds>before,'airtime continues after a successful recovery')
 for(let i=0;i<24;i++)step('alice',air)
 step('alice',lava)
 assert.equal(game.snapshot('alice').phase,'finished','a later lava landing still ends the run')
})
test('leaving a rock collider for blue lava finishes immediately despite recent rock contact',async()=>{
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 for(let i=0;i<24;i++)step('alice',air)
 for(let y=air.y-2;y>lava.y+1;y-=2)step('alice',{...lava,y})
 step('alice',lava,{supported:true,rockSupport:true,rockTouch:true,rockTouchGeometry:true})
 assert.equal(game.snapshot('alice').result,undefined)
 step('alice',lava,{rockTouchGeometry:true})
 assert.equal(game.snapshot('alice').phase,'finished')
 assert.equal(game.snapshot('alice').result.valid,true)
})
test('world records survive restart, rank multiple players consistently and failed writes retry',async()=>{
 let disk=null,fail=true,writes=0
 const store={get:async()=>disk,set:async value=>{writes++;if(fail)return false;disk=value;return true}}
 const {game,flight}=fixture(store);await game.load();flight('alice',43);await turn()
 assert.equal(game.snapshot('alice').saved,false)
 flight('bob',63);await turn();fail=false;await game.flush()
 assert.equal(game.snapshot('alice').saved,true);assert.ok(writes>=2)
 const restored=new FlightAuthority(store);await restored.load()
 assert.equal(restored.snapshot('alice').bestMs,2000);assert.equal(restored.snapshot('bob').bestMs,3000)
 assert.deepEqual(restored.snapshot('alice').rows.map(row=>[row.userId,row.airtimeMs,row.rank]),[['bob',3000,1],['alice',2000,2]])
})
test('a slower completed checkpoint cannot overwrite a newer multiplayer result',async()=>{
 let release,disk=null,first=true
 const store={get:async()=>disk,set:value=>first?(first=false,new Promise(resolve=>{release=()=>{disk=value;resolve(true)}})):(disk=value,Promise.resolve(true))}
 const {game,flight}=fixture(store);await game.load();flight('alice',43);flight('bob',63)
 release();await turn()
 const restored=new FlightAuthority(store);await restored.load()
 assert.equal(restored.snapshot('bob').bestMs,3000);assert.equal(restored.snapshot('alice').bestMs,2000)
})
test('server ignores movement-derived scores and will not overwrite corrupt/unreadable storage',async()=>{
 let writes=0
 for(const get of [async()=>'{broken',async()=>{throw Error('offline')}]){
  const {game,flight}=fixture({get,set:async()=>{writes++;return true}});await game.load();flight('alice',43)
  assert.equal(game.snapshot('alice').ready,false)
 }
 assert.equal(writes,0)
})

test('returning players restore their wallet best before scoring; a lower run is never a new record',async()=>{
 let world=null
 const personal=new Map([['alice',JSON.stringify({userId:'alice',name:'Alice',airtimeMs:31000})]])
 const store={get:async()=>world,set:async value=>(world=value,true),getPlayer:async id=>personal.get(id)||null,setPlayer:async(id,value)=>(personal.set(id,value),true)}
 const {game,flight}=fixture(store);await game.load()
 assert.equal(game.snapshot('alice').ready,false,'unknown personal records are not treated as a zero best')
 await game.loadPlayer('alice');await turn()
 assert.equal(game.snapshot('alice').bestMs,31000);assert.equal(game.snapshot('alice').ready,true)
 flight('alice',43);await turn()
 assert.equal(game.snapshot('alice').result.record,false);assert.equal(game.snapshot('alice').bestMs,31000)
 assert.equal(JSON.parse(personal.get('alice')).airtimeMs,31000)
 const restored=new FlightAuthority(store);await restored.load();await restored.loadPlayer('alice')
 assert.equal(restored.snapshot('alice').bestMs,31000)
})
test('failed personal-best writes remain pending and retry before the shared board is acknowledged',async()=>{
 let world=null,fail=true,player=null
 const store={get:async()=>world,set:async value=>(world=value,true),getPlayer:async()=>player,setPlayer:async(_id,value)=>{if(fail)return false;player=value;return true}}
 const {game,flight}=fixture(store);await game.load();await game.loadPlayer('alice');flight('alice',43);await turn()
 assert.equal(game.snapshot('alice').saved,false);assert.equal(world,null)
 fail=false;await game.flush()
 assert.equal(game.snapshot('alice').saved,true);assert.equal(JSON.parse(player).airtimeMs,2000)
 assert.equal(JSON.parse(world).records[0].airtimeMs,2000)
})


test('off-center sphere reward preserves authoritative airtime through two teleports and normal play afterward',async()=>{
 const {ORB_REWARD,isOrbRewardDestination}=require('../src/orb-reward.ts')
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 const launch={...ARENA.center,x:ARENA.center.x+.9,y:ORB_REWARD.height}
 assert.ok(launch.y>ARENA.floorTop+2,'launch never touches lava')
 assert.equal(isOrbRewardDestination(launch),true)
 assert.equal(isOrbRewardDestination({...launch,x:launch.x+5}),false)
 for(let i=0;i<24;i++)step('reward',air)
 for(let cycle=0;cycle<2;cycle++){
   const startY=cycle===0?air.y:launch.y+16.8,startX=cycle===0?40:43
   for(let i=1;i<=25;i++)step('reward',{x:startX+i*.4,y:startY+i*.2,z:40})
   const before=game.snapshot('reward').milliseconds
   step('reward',launch)
   for(let i=1;i<=56;i++)step('reward',{...launch,y:launch.y+i*.3})
   assert.equal(game.snapshot('reward').result,undefined,'reward relocation does not end the flight')
   assert.equal(game.snapshot('reward').milliseconds-before,57*50+30000,'airtime and exactly one 30-second bonus count per reward teleport')
   for(let i=1;i<=15;i++)step('reward',{...launch,x:40+i*.2,y:launch.y+16.8})
   assert.equal(game.snapshot('reward').phase,'airborne','normal movement continues after the shot')
 }
 for(let y=Math.ceil(launch.y+16.8);y<=ARENA.height-4;y++)step('reward',{...lava,y})
 assert.equal(game.snapshot('reward').phase,'airborne','flight continues within the scene ceiling')
 const beforeLanding=game.snapshot('reward').milliseconds
 for(let y=ARENA.height-4;y>lava.y;y-=1)step('reward',{...lava,y})
 step('reward',lava)
 assert.equal(game.snapshot('reward').phase,'finished')
 const landed = game.snapshot('reward')
 assert.ok(landed.result.milliseconds>=beforeLanding,'a later real landing still saves the run')
 assert.equal(landed.rows[0].airtimeMs,landed.result.milliseconds,'the leaderboard keeps the bonuses')
})

test('ordinary flight through the reward destination does not earn a bonus', async () => {
 const { ORB_REWARD } = require('../src/orb-reward.ts')
 const { game, step } = fixture({get:async()=>null,set:async()=>true}); await game.load()
 const launch = {...ARENA.center,x:ARENA.center.x+1,y:ORB_REWARD.height}
 const start = {...launch,x:launch.x+10}
 for(let i=0;i<20;i++) step('flyby',start)
 const before=game.snapshot('flyby').milliseconds
 for(let i=1;i<=20;i++) step('flyby',{...start,x:start.x-i*.5})
 assert.equal(game.snapshot('flyby').milliseconds-before,1000)
})

test('leaves and other support preserve airtime; only entering blue lava completes the run',async()=>{
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 for(let i=0;i<24;i++)step('alice',air)
 for(let y=air.y-1;y>lava.y;y-=1)step('alice',{...lava,y})
 const before=game.snapshot('alice').milliseconds
 for(let i=0;i<10;i++)step('alice',lava,{supported:true})
 assert.equal(game.snapshot('alice').phase,'paused')
 assert.equal(game.snapshot('alice').milliseconds,before)
 assert.equal(game.snapshot('alice').result,undefined,'a low leaf or collider is not lava contact')
 step('alice',lava)
 assert.equal(game.snapshot('alice').phase,'finished')
 assert.equal(game.snapshot('alice').result.milliseconds,before)
})

test('airtime keeps counting above the updraft while the player is over the arena', async () => {
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 for(let i=0;i<20;i++)step('high',air)
 const before=game.snapshot('high').milliseconds
 let frames=0
 for(let y=air.y+1;y<=ARENA.height+45;y++){step('high',{...air,y});frames++}
 assert.equal(game.snapshot('high').phase,'airborne')
 assert.equal(game.snapshot('high').milliseconds-before,frames*50)
 const edge={x:ARENA.center.x+ARENA.radius,y:ARENA.height+45,z:ARENA.center.z}
 for(let x=air.x+1;x<=edge.x;x++)step('high',{...edge,x})
 const atEdge=game.snapshot('high').milliseconds
 step('high',{...edge,x:edge.x+1})
 assert.equal(game.snapshot('high').phase,'paused')
 assert.equal(game.snapshot('high').milliseconds,atEdge)
})

test('airtime counts during free fall even when the client reports its pointer unlocked',async()=>{
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 for(let i=0;i<20;i++)step('drop',{...air,y:90})
 const before=game.snapshot('drop').milliseconds
 for(let i=1;i<=18;i++)step('drop',{...air,y:90-i*4.5},{focused:false})
 const after=game.snapshot('drop')
 assert.equal(after.phase,'airborne')
 assert.equal(after.milliseconds-before,900)
})

test('the rainbow rest awards one minute and includes it in the completed score',async()=>{
 const {randomOrbRewardDestination}=require('../src/orb-reward.ts')
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 const rainbow=randomOrbRewardDestination(()=>.5,'rainbow')
 for(let i=0;i<20;i++)step('prism',{...air,x:air.x+16,y:rainbow.y})
 const before=game.snapshot('prism').milliseconds
 step('prism',rainbow)
 for(let i=0;i<4;i++)step('prism',rainbow)
 assert.equal(game.snapshot('prism').milliseconds-before,60250)
 for(let y=rainbow.y-1;y>lava.y;y--)step('prism',{...rainbow,y})
 step('prism',lava)
 const landed=game.snapshot('prism')
 assert.equal(landed.result.valid,true)
 assert.ok(landed.result.milliseconds>=60000)
 assert.equal(landed.rows[0].airtimeMs,landed.result.milliseconds)
})

test('blue and purple bonuses bank until five-orb rest, then enter the saved score',async()=>{
 const {bubbleSlot}=require('../src/bubble-rules.ts')
 const {randomOrbRewardDestination}=require('../src/orb-reward.ts')
 const {game,step}=fixture({get:async()=>null,set:async()=>true});await game.load()
 const pointFor=slot=>{const lane=bubbleSlot(slot);return {...ARENA.center,x:ARENA.center.x+lane.radius,y:lane.y}}
 const point=pointFor(0)
 for(let i=0;i<20;i++)step('bonus',point)
 const before=game.snapshot('bonus').milliseconds
 const now=Date.now()+1000
 assert.equal(game.bonusOrbPickup('bonus','blue',0,now),true)
 assert.equal(game.bonusOrbPickup('bonus','purple',0,now+20),false)
 assert.equal(game.bonusOrbPickup('bonus','purple',-1,now+20),false)
 assert.equal(game.snapshot('bonus').milliseconds,before)
 const next=pointFor(1)
 for(let i=1;i<=20;i++)step('bonus',{...point,x:point.x+(next.x-point.x)*i/20,y:point.y+(next.y-point.y)*i/20})
 const purpleBefore=game.snapshot('bonus').milliseconds
 assert.equal(game.bonusOrbPickup('bonus','purple',1,now+1000),true)
 assert.equal(game.snapshot('bonus').milliseconds,purpleBefore)
 const rest=randomOrbRewardDestination(()=>.5)
 step('bonus',rest)
 assert.equal(game.snapshot('bonus').milliseconds-purpleBefore,48050)
 for(let y=rest.y-1;y>lava.y;y--)step('bonus',{...rest,y})
 step('bonus',lava)
 assert.ok(game.snapshot('bonus').rows[0].airtimeMs>=48000)
})
