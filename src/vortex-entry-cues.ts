import { engine, Material, MeshRenderer, Transform } from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import { ENTRY_CUES, entryOrbPoint, entryOrbProgress, entryRisePoint } from './vortex-entry-paths'
export { ENTRY_CUES } from './vortex-entry-paths'

export function createVortexEntryCues() {
  let time=0
  function orb(index:number,rising:boolean) {
    const entity=engine.addEntity(),shade=(index%6)/5
    Transform.create(entity,{position:rising?entryRisePoint(index,0):entryOrbPoint(index,0),scale:Vector3.create(0,0,0)})
    MeshRenderer.setSphere(entity)
    Material.setPbrMaterial(entity,{albedoColor:Color4.create(.08+shade*.16,.48+shade*.3,1,1),
      emissiveColor:Color3.create(.025+shade*.08,.35+shade*.3,1),emissiveIntensity:3+shade*2,
      metallic:.76,roughness:.035,castShadows:false})
    return entity
  }
  const incoming=Array.from({length:ENTRY_CUES.incoming},(_,i)=>orb(i,false))
  const rising=Array.from({length:ENTRY_CUES.rising},(_,i)=>orb(i,true))
  engine.addSystem(dt=>{
    if(!Number.isFinite(dt)||dt<=0||dt>.5)return
    time+=dt
    function animate(entities:typeof incoming,up:boolean) {
      entities.forEach((entity,index)=>{
        const progress=entryOrbProgress(index,time,up)
        // Smoothly vanish at both ends, hiding the wrap to the next journey.
        const envelope=Math.sin(Math.PI*Math.min(1,progress/.14)/2)**2*
          Math.sin(Math.PI*Math.min(1,(1-progress)/.18)/2)**2
        const size=(.13+(index%4)*.025)*envelope*(.92+.08*Math.sin(time*2+index))
        const transform=Transform.getMutable(entity)
        transform.position=up?entryRisePoint(index,time):entryOrbPoint(index,time)
        transform.scale=Vector3.create(size,size,size)
      })
    }
    animate(incoming,false)
    animate(rising,true)
  })
  return {incoming,rising}
}
