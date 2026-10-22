// Reproducible scenery placement. Keep an unchanged source GLB for future regeneration.
const fs=require('node:fs'),path=require('node:path'),{nodeBounds}=require('./gltf-bounds.cjs')
const root=path.resolve(__dirname,'..'),source=path.join(root,'assets/models/orchard-source.glb'),target=path.join(root,'assets/models/orchard.glb')
if(!fs.existsSync(source))fs.copyFileSync(target,source)
const input=fs.readFileSync(source),length=input.readUInt32LE(12),json=JSON.parse(input.toString('utf8',20,20+length))
const ts=require('typescript'),arenaModule={exports:{}}
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/arena.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(arenaModule.exports)
const {ARENA}=arenaModule.exports
const size=ARENA.size,scale=size/44*1.2,margin=1,radius=ARENA.radius
const arenaNode=json.nodes.find(n=>n.name==='four-point faceted ornament 08')
if(!arenaNode)throw new Error('Authored arena mesh not found')
const base=nodeBounds(json,arenaNode),cx=(base.lo[0]+base.hi[0])/2,cz=(base.lo[2]+base.hi[2])/2
const trees=json.nodes.filter(n=>n.mesh!==undefined&&json.meshes[n.mesh].primitives.every(p=>/^mat(19|20)\./.test(json.materials[p.material]?.name||'')))
if(trees.length!==4)throw new Error('Expected four authored tree groups')
const originalTranslations=json.nodes.map(n=>[...(n.translation||[0,0,0])])
for(const node of json.nodes.filter(n=>n.mesh!==undefined)){
 node.translation=(node.translation||[0,0,0]).map((v,i)=>v-[cx,base.lo[1],cz][i])
 // Keep complete decorative foliage meshes within the land, without clipping geometry.
 const b=nodeBounds(json,node)
 for(const i of [0,2]){
  const low=(-size/2+margin)/scale,high=(size/2-margin)/scale
  const offset=b.lo[i]<low?low-b.lo[i]:b.hi[i]>high?high-b.hi[i]:0
  node.translation[i]+=offset
 }
}
// Preserve the authored trees at their original size and retain all foliage animation.
// Retarget translation keyframes by the same fitted node offset; rotation/scale tracks stay intact.
const originalBinary=input.subarray(28+length),parts=[Buffer.from(originalBinary)]
let binaryLength=originalBinary.length
for(const animation of json.animations||[])for(const channel of animation.channels){
 if(channel.target.path!=='translation')continue
 const nodeIndex=channel.target.node,sampler=animation.samplers[channel.sampler],accessor=json.accessors[sampler.output]
 const view=json.bufferViews[accessor.bufferView],start=(view.byteOffset||0)+(accessor.byteOffset||0),stride=view.byteStride||12
 const delta=json.nodes[nodeIndex].translation.map((v,i)=>v-originalTranslations[nodeIndex][i])
 const keys=Buffer.alloc(accessor.count*12)
 for(let key=0;key<accessor.count;key++)for(let axis=0;axis<3;axis++)
  keys.writeFloatLE(originalBinary.readFloatLE(start+key*stride+axis*4)+delta[axis],key*12+axis*4)
 const bufferView=json.bufferViews.push({buffer:0,byteOffset:binaryLength,byteLength:keys.length})-1
 const copy={...accessor,bufferView,byteOffset:0}
 for(const bound of ['min','max'])if(copy[bound])copy[bound]=copy[bound].map((v,i)=>v+delta[i])
 const output=json.accessors.push(copy)-1
 channel.sampler=animation.samplers.push({...sampler,output})-1
 parts.push(keys);binaryLength+=keys.length
}
json.buffers[0].byteLength=binaryLength
const binaryHeader=Buffer.alloc(8);binaryHeader.writeUInt32LE(binaryLength);binaryHeader.writeUInt32LE(0x004e4942,4)
const binary=Buffer.concat([binaryHeader,...parts])
json.extras={...json.extras,placement:{landSize:size,worldScale:scale,margin,treeCount:trees.length,arenaRadius:radius}}
const raw=Buffer.from(JSON.stringify(json)),chunk=Buffer.alloc((raw.length+3)&~3,0x20);raw.copy(chunk)
const header=Buffer.alloc(8);header.writeUInt32LE(chunk.length);header.writeUInt32LE(0x4e4f534a,4)
const output=Buffer.concat([Buffer.alloc(12),header,chunk,binary])
output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);fs.writeFileSync(target,output)
console.log('Centered scenery within the land, preserved modeled trees and retargeted animated foliage.')
