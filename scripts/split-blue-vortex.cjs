// Split the supplied two-material GLB by primitive so each material can be controlled separately.
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const inputPath = path.join(root, 'assets/models/blue-lava-vortex.glb')
const source = fs.readFileSync(inputPath)
if (source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) {
  throw new Error('Expected a binary glTF 2.0 blue vortex model')
}
const jsonLength = source.readUInt32LE(12)
const gltf = JSON.parse(source.toString('utf8', 20, 20 + jsonLength))
const binHeader = 20 + jsonLength
const binLength = source.readUInt32LE(binHeader)
const binary = source.subarray(binHeader + 8, binHeader + 8 + binLength)
const roots = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []
if (roots.length !== 1 || gltf.nodes.length !== 1 || gltf.meshes.length !== 1 ||
    gltf.meshes[0].primitives.length !== 2 || gltf.images?.length || gltf.nodes[0].children?.length) {
  throw new Error('Expected one mesh node with two untextured material primitives')
}

function clone(value) { return JSON.parse(JSON.stringify(value)) }

function encodeGlb(output, chunks, bytes) {
  const rawJson = Buffer.from(JSON.stringify(output), 'utf8')
  const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 0x20)])
  const rawBinary = Buffer.concat(chunks, bytes)
  const bin = Buffer.concat([rawBinary, Buffer.alloc((4 - rawBinary.length % 4) % 4)])
  const header = Buffer.alloc(12)
  header.write('glTF', 0, 4, 'ascii'); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8)
  const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(json.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jsonHeader, json, binHeader, bin])
}

function buildPrimitive(primitiveIndex, file) {
  const accessors = [], bufferViews = [], viewMap = new Map(), accessorMap = new Map(), chunks = []
  let byteLength = 0
  function copyView(index) {
    if (viewMap.has(index)) return viewMap.get(index)
    const view = gltf.bufferViews[index]
    if (!view || (view.buffer ?? 0) !== 0) throw new Error(`Unsupported buffer view ${index}`)
    const padding = (4 - byteLength % 4) % 4
    if (padding) { chunks.push(Buffer.alloc(padding)); byteLength += padding }
    const mapped = bufferViews.length
    viewMap.set(index, mapped)
    bufferViews.push({ ...clone(view), buffer: 0, byteOffset: byteLength })
    chunks.push(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength))
    byteLength += view.byteLength
    return mapped
  }
  function copyAccessor(index) {
    if (accessorMap.has(index)) return accessorMap.get(index)
    const accessor = clone(gltf.accessors[index])
    if (accessor.bufferView !== undefined) accessor.bufferView = copyView(accessor.bufferView)
    if (accessor.sparse) {
      accessor.sparse.indices.bufferView = copyView(accessor.sparse.indices.bufferView)
      accessor.sparse.values.bufferView = copyView(accessor.sparse.values.bufferView)
    }
    const mapped = accessors.length
    accessorMap.set(index, mapped); accessors.push(accessor)
    return mapped
  }
  const primitive = clone(gltf.meshes[0].primitives[primitiveIndex])
  for (const key of Object.keys(primitive.attributes)) primitive.attributes[key] = copyAccessor(primitive.attributes[key])
  if (primitive.indices !== undefined) primitive.indices = copyAccessor(primitive.indices)
  for (const target of primitive.targets ?? []) for (const key of Object.keys(target)) target[key] = copyAccessor(target[key])
  const output = {
    asset: { ...clone(gltf.asset), generator: 'Endless Vortex material-slot splitter' }, scene: 0,
    scenes: [{ name: file, nodes: [0] }],
    nodes: [{ ...clone(gltf.nodes[0]), mesh: 0 }],
    meshes: [{ ...clone(gltf.meshes[0]), primitives: [primitive] }], materials: clone(gltf.materials ?? []),
    accessors, bufferViews, buffers: [{ byteLength }],
    ...(gltf.extensionsUsed ? { extensionsUsed: clone(gltf.extensionsUsed) } : {}),
    ...(gltf.extensionsRequired ? { extensionsRequired: clone(gltf.extensionsRequired) } : {})
  }
  fs.writeFileSync(path.join(root, 'assets/models', file), encodeGlb(output, chunks, byteLength))
}

buildPrimitive(0, 'blue-lava-vortex-base.glb')
buildPrimitive(1, 'blue-lava-vortex-lava.glb')
console.log('Split base and lava material primitives into independently controlled GLBs')
