// Bounds of a flat authored glTF mesh node, including its rotation and scale.
exports.nodeBounds=(json,node)=>{
 if(node.matrix||node.children?.length)throw new Error('Orchard fitting expects flat TRS mesh nodes')
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity]
 const q=node.rotation||[0,0,0,1],s=node.scale||[1,1,1],t=node.translation||[0,0,0]
 for(const primitive of json.meshes[node.mesh].primitives){
  const a=json.accessors[primitive.attributes.POSITION]
  for(let k=0;k<8;k++){
   const v=a.min.map((_,i)=>(k>>i&1?a.max[i]:a.min[i])*s[i]),u=q.slice(0,3)
   const dot=u.reduce((z,c,i)=>z+c*v[i],0),uu=u.reduce((z,c)=>z+c*c,0)
   const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
   v.forEach((value,i)=>{const r=2*dot*u[i]+(q[3]*q[3]-uu)*value+2*q[3]*cross[i]+t[i];lo[i]=Math.min(lo[i],r);hi[i]=Math.max(hi[i],r)})
  }
 }
 return {lo,hi}
}
