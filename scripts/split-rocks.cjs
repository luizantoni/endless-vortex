// Split the artist-authored, one-node-per-rock GLB into independent collidable assets.
// Each node translation becomes the entity origin; rotation and scale stay in its GLB.
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const inputPath = path.join(root, 'assets/models/rocks2.glb')
const outputDir = path.join(root, 'assets/models/rock-pieces')
const layoutPath = path.join(root, 'src/rock-layout.ts')
const source = fs.readFileSync(inputPath)

if (source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) {
  throw new Error('Expected a binary glTF 2.0 rocks model')
}
const jsonLength = source.readUInt32LE(12)
const gltf = JSON.parse(source.toString('utf8', 20, 20 + jsonLength))
const binHeader = 20 + jsonLength
const binLength = source.readUInt32LE(binHeader)
const binary = source.subarray(binHeader + 8, binHeader + 8 + binLength)

if (gltf.buffers?.length !== 1 || gltf.buffers[0].uri || gltf.images?.length) {
  throw new Error('Splitter expects one embedded buffer and no external images')
}
if ((gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? []).length !== gltf.nodes.length) {
  throw new Error('Every rock must be a root node so its origin can move independently')
}
if (gltf.nodes.some(node => node.children?.length || node.matrix || node.mesh === undefined)) {
  throw new Error('Expected independent mesh nodes with TRS transforms')
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function transformPoint(point, node) {
  const scale = node.scale ?? [1, 1, 1]
  const rotation = node.rotation ?? [0, 0, 0, 1]
  const v = point.map((value, axis) => value * scale[axis])
  const [x, y, z, w] = rotation
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [
    v[0] + w * tx + y * tz - z * ty,
    v[1] + w * ty + z * tx - x * tz,
    v[2] + w * tz + x * ty - y * tx
  ]
}

function encodeGlb(output, binaryChunks, binaryBytes) {
  const rawJson = Buffer.from(JSON.stringify(output), 'utf8')
  const jsonPadding = (4 - rawJson.length % 4) % 4
  const json = Buffer.concat([rawJson, Buffer.alloc(jsonPadding, 0x20)])
  const rawBinary = Buffer.concat(binaryChunks, binaryBytes)
  const binPadding = (4 - rawBinary.length % 4) % 4
  const bin = binPadding ? Buffer.concat([rawBinary, Buffer.alloc(binPadding)]) : rawBinary
  const header = Buffer.alloc(12)
  header.write('glTF', 0, 4, 'ascii')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8)
  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(json.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)
  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(bin.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jsonHeader, json, binHeader, bin])
}

function createRock(node, index) {
  const sourceMesh = gltf.meshes[node.mesh]
  const accessors = []
  const bufferViews = []
  const accessorMap = new Map()
  const bufferViewMap = new Map()
  const chunks = []
  let byteLength = 0

  function copyView(sourceIndex) {
    if (bufferViewMap.has(sourceIndex)) return bufferViewMap.get(sourceIndex)
    const view = gltf.bufferViews[sourceIndex]
    if (!view || (view.buffer ?? 0) !== 0) throw new Error(`Invalid buffer view ${sourceIndex}`)
    const start = view.byteOffset ?? 0
    const end = start + view.byteLength
    if (end > binary.length) throw new Error(`Buffer view ${sourceIndex} exceeds the GLB buffer`)
    const padding = (4 - byteLength % 4) % 4
    if (padding) {
      chunks.push(Buffer.alloc(padding))
      byteLength += padding
    }
    const mapped = bufferViews.length
    bufferViewMap.set(sourceIndex, mapped)
    bufferViews.push({ ...clone(view), buffer: 0, byteOffset: byteLength })
    const data = binary.subarray(start, end)
    chunks.push(data)
    byteLength += data.length
    return mapped
  }

  function copyAccessor(sourceIndex) {
    if (accessorMap.has(sourceIndex)) return accessorMap.get(sourceIndex)
    const accessor = clone(gltf.accessors[sourceIndex])
    if (accessor.bufferView !== undefined) accessor.bufferView = copyView(accessor.bufferView)
    if (accessor.sparse) {
      accessor.sparse.indices.bufferView = copyView(accessor.sparse.indices.bufferView)
      accessor.sparse.values.bufferView = copyView(accessor.sparse.values.bufferView)
    }
    const mapped = accessors.length
    accessorMap.set(sourceIndex, mapped)
    accessors.push(accessor)
    return mapped
  }

  const mesh = clone(sourceMesh)
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (const primitive of mesh.primitives) {
    for (const key of Object.keys(primitive.attributes)) {
      primitive.attributes[key] = copyAccessor(primitive.attributes[key])
    }
    if (primitive.indices !== undefined) primitive.indices = copyAccessor(primitive.indices)
    for (const target of primitive.targets ?? []) {
      for (const key of Object.keys(target)) target[key] = copyAccessor(target[key])
    }

    const positionAccessor = gltf.accessors[sourceMesh.primitives[mesh.primitives.indexOf(primitive)].attributes.POSITION]
    for (let mask = 0; mask < 8; mask++) {
      const corner = [0, 1, 2].map(axis => (mask & (1 << axis)) ? positionAccessor.max[axis] : positionAccessor.min[axis])
      const point = transformPoint(corner, node)
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis])
        max[axis] = Math.max(max[axis], point[axis])
      }
    }
  }

  const output = {
    asset: { ...clone(gltf.asset), generator: 'Endless Vortex rock splitter' },
    scene: 0,
    scenes: [{ name: node.name ?? `Rock ${index + 1}`, nodes: [0] }],
    nodes: [{ name: node.name, mesh: 0, ...(node.rotation ? { rotation: clone(node.rotation) } : {}),
      ...(node.scale ? { scale: clone(node.scale) } : {}) }],
    meshes: [mesh],
    materials: clone(gltf.materials ?? []),
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
    ...(gltf.extensionsUsed ? { extensionsUsed: clone(gltf.extensionsUsed) } : {}),
    ...(gltf.extensionsRequired ? { extensionsRequired: clone(gltf.extensionsRequired) } : {})
  }
  const filename = `rock-${String(index).padStart(3, '0')}.glb`
  const outPath = path.join(outputDir, filename)
  fs.writeFileSync(outPath, encodeGlb(output, chunks, byteLength))
  const translation = node.translation ?? [0, 0, 0]
  const radius = Math.max(...[
    [min[0], min[2]], [min[0], max[2]], [max[0], min[2]], [max[0], max[2]]
  ].map(([x, z]) => Math.hypot(x, z)))
  return { src: `assets/models/rock-pieces/${filename}`, x: translation[0], y: translation[1], z: translation[2],
    minX: min[0], maxX: max[0], minY: min[1], maxY: max[1], minZ: min[2], maxZ: max[2], radius }
}

fs.mkdirSync(outputDir, { recursive: true })
for (const name of fs.readdirSync(outputDir)) {
  if (/^rock-\d+\.glb$/i.test(name)) fs.unlinkSync(path.join(outputDir, name))
}
const sceneNodes = gltf.scenes[gltf.scene ?? 0].nodes
const layout = sceneNodes.map((nodeIndex, index) => createRock(gltf.nodes[nodeIndex], index))
const output = `// Generated by scripts/split-rocks.cjs from assets/models/rocks2.glb.\n` +
  `export type RockLayoutItem = { src: string; x: number; y: number; z: number; minX: number; maxX: number; ` +
  `minY: number; maxY: number; minZ: number; maxZ: number; radius: number }\n` +
  `export const ROCK_LAYOUT: readonly RockLayoutItem[] = ${JSON.stringify(layout, null, 2)}\n`
fs.writeFileSync(layoutPath, output)
console.log(`Split ${layout.length} rock objects into independent GLBs`)
