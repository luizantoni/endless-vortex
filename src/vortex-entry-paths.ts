import { ARENA, Point } from './arena'

export const ENTRY_CUES = { incoming: 48, rising: 72 } as const
const wrap=(value:number)=>((value%1)+1)%1
export const entryOrbProgress=(index:number,time:number,rising=false)=>
  wrap(time*(rising?.16:.22)+index/(rising?ENTRY_CUES.rising:ENTRY_CUES.incoming))

/** Curved streams draw the eye from outside the lift volume into its center. */
export function entryOrbPoint(index:number,time:number):Point {
  const progress=entryOrbProgress(index,time)
  const ease=progress*progress*(3-2*progress)
  const angle=index*Math.PI*2/6+ease*1.3+Math.sin(time*.55+index)*.08
  const radius=8.5-6.4*ease
  return {x:ARENA.center.x+Math.cos(angle)*radius,
    y:ARENA.floorTop+1.15+ease*2.1+Math.sin(progress*Math.PI)*.25,
    z:ARENA.center.z+Math.sin(angle)*radius}
}

/** Miniature blue spheres rise along gently twisting helices. */
export function entryRisePoint(index:number,time:number):Point {
  const progress=entryOrbProgress(index,time,true)
  const angle=index*2.399963+time*.8+progress*3.2
  const radius=1.35+1.1*(1-progress)+Math.sin(progress*Math.PI*2+index)*.12
  return {x:ARENA.center.x+Math.cos(angle)*radius,
    y:ARENA.floorTop+.9+progress*11,
    z:ARENA.center.z+Math.sin(angle)*radius}
}
