import { Point } from './arena'
// Transform an avatar sample into the leaf's local axes; rotations must not change contact rules.
export function leafLocalPoint(point: Point, center: Point, q: {x:number;y:number;z:number;w:number}): Point {
  const x=point.x-center.x,y=point.y-center.y,z=point.z-center.z
  const tx=2*(-q.y*z+q.z*y),ty=2*(-q.z*x+q.x*z),tz=2*(-q.x*y+q.y*x)
  return {x:x+q.w*tx-q.y*tz+q.z*ty,y:y+q.w*ty-q.z*tx+q.x*tz,z:z+q.w*tz-q.x*ty+q.y*tx}
}
export function touchesLeaf(player: Point, center: Point, rotation: {x:number;y:number;z:number;w:number}, length:number,width:number,thickness:number): boolean {
  // Sample the capsule axis, including feet and torso, with native contact skin tolerance.
  return [-.88,-.44,0,.44,.88].some(offset=>{
    const p=leafLocalPoint({...player,y:player.y+offset},center,rotation)
    return Math.hypot(Math.max(0,Math.abs(p.x)-length),Math.max(0,Math.abs(p.y)-thickness/2),Math.max(0,Math.abs(p.z)-width))<=.35
  })
}
