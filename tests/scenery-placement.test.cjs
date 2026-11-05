const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {nodeBounds}=require('../scripts/gltf-bounds.cjs')
const {ARENA}=require('../src/arena.ts')
test('arena scenery is centered, grounded, and contained by the land with original trees and animated foliage',()=>{
 const b=fs.readFileSync('assets/models/orchard.glb'),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)))
 const scale=ARENA.size/44*1.2,limit=(ARENA.size/2-1)/scale
 const arena=j.nodes.find(n=>n.name==='four-point faceted ornament 08'),bounds=nodeBounds(j,arena)
 assert.ok(Math.abs((bounds.lo[0]+bounds.hi[0])/2)<1e-6,'arena mesh is centered along x')
 assert.ok(Math.abs((bounds.lo[2]+bounds.hi[2])/2)<1e-6,'arena mesh is centered along z')
 assert.ok(Math.abs(bounds.lo[1])<1e-6,'build sits on the land instead of below its edge')
 let trees=0
 for(const n of j.nodes.filter(n=>n.mesh!==undefined)){
  const a=nodeBounds(j,n)
  for(const axis of [0,2])assert.ok(a.lo[axis]>=-limit-1e-6 && a.hi[axis]<=limit+1e-6,`${n.name}: complete mesh bounds stay inside the plot`)
  const isTree=j.meshes[n.mesh].primitives.every(p=>/^mat(19|20)\./.test(j.materials[p.material]?.name||''))
  if(!isTree)continue
  trees++
  const nearest=a.lo.map((lo,i)=>Math.max(0,lo,-a.hi[i])*scale)
  const original=fs.readFileSync('assets/models/orchard-source.glb')
  const source=JSON.parse(original.toString('utf8',20,20+original.readUInt32LE(12)))
  assert.deepEqual(n.scale,source.nodes.find(node=>node.name===n.name).scale,'modeled trees keep their original scale')
 }
 assert.equal(trees,4,'all four original trees remain as corner scenery')
 assert.equal(j.animations[0].channels.length,258,'authored foliage animation is preserved')
})

test('optimized runtime orchard preserves scenery, materials, and animated foliage',()=>{
 const read=file=>{
  const b=fs.readFileSync(file)
  assert.equal(b.readUInt32LE(8),b.length)
  return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)))
 }
 const source=read('assets/models/orchard.glb'),runtime=read('assets/models/orchard-runtime.glb')
 assert.deepEqual(runtime.nodes.map(n=>n.name).sort(),source.nodes.map(n=>n.name).sort())
 assert.deepEqual(runtime.materials.map(m=>m.name),source.materials.map(m=>m.name))
 assert.equal(runtime.animations[0].name,'Animation')
 assert.equal(runtime.animations[0].channels.length,source.animations[0].channels.length)
 assert.deepEqual(runtime.extensionsRequired||[],[],'no extra model decoder is needed')
 const worldScale=ARENA.size/44*1.2
 for(const node of runtime.nodes.filter(n=>n.mesh!==undefined)){
  const original=source.nodes.find(n=>n.name===node.name)
  const before=nodeBounds(source,original),after=nodeBounds(runtime,node)
  for(const side of ['lo','hi'])for(let axis=0;axis<3;axis++){
   assert.ok(Math.abs(before[side][axis]-after[side][axis])*worldScale<.06,
     node.name+': optimized silhouette bounds stay within six centimeters')
  }
 }
 assert.ok(fs.statSync('assets/models/orchard-runtime.glb').size<13_000_000)
})
