const fs = require('node:fs')
const path = require('node:path')

const outline = [[0, .5], [.16, .4], [.29, .23], [.34, 0], [.28, -.24], [.12, -.43],
  [0, -.5], [-.12, -.43], [-.28, -.24], [-.34, 0], [-.29, .23], [-.16, .4]]
const positions = [], normals = [], indices = []
for (const y of [.5, -.5]) for (const [x, z] of outline) {
  positions.push(x, y, z); normals.push(0, y > 0 ? 1 : -1, 0)
}
positions.push(0, .5, 0, 0, -.5, 0); normals.push(0, 1, 0, 0, -1, 0)
const top = 24, bottom = 25, count = outline.length
for (let i = 0; i < count; i++) {
  const next = (i + 1) % count
  indices.push(top, i, next, bottom, count + next, count + i)
  indices.push(i, count + i, count + next, i, count + next, next)
}

const veinPositions = [], veinNormals = [], veinIndices = []
function vein(x1, z1, x2, z2, width) {
  const dx = x2 - x1, dz = z2 - z1, length = Math.hypot(dx, dz), px = -dz / length * width, pz = dx / length * width
  const base = veinPositions.length / 3
  veinPositions.push(x1 + px, .515, z1 + pz, x1 - px, .515, z1 - pz,
    x2 - px, .515, z2 - pz, x2 + px, .515, z2 + pz)
  veinNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
  veinIndices.push(base, base + 1, base + 2, base, base + 2, base + 3)
}
vein(0, -.43, 0, .43, .012)
for (const [z, x] of [[-.28, .2], [-.1, .29], [.08, .29], [.25, .22]]) {
  vein(0, z, x, z + .12, .008); vein(0, z, -x, z + .12, .008)
}

const chunks = [], views = [], accessors = []
let offset = 0
function add(data, target, componentType, type, countValue, min, max) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  const padding = Buffer.alloc((4 - buffer.length % 4) % 4)
  views.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length, target })
  chunks.push(buffer, padding)
  const accessor = { bufferView: views.length - 1, componentType, count: countValue, type }
  if (min) accessor.min = min
  if (max) accessor.max = max
  accessors.push(accessor)
  offset += buffer.length + padding.length
  return accessors.length - 1
}
const bodyPosition = add(new Float32Array(positions), 34962, 5126, 'VEC3', positions.length / 3, [-.34, -.5, -.5], [.34, .5, .5])
const bodyNormal = add(new Float32Array(normals), 34962, 5126, 'VEC3', normals.length / 3)
const bodyIndex = add(new Uint16Array(indices), 34963, 5123, 'SCALAR', indices.length)
const veinPosition = add(new Float32Array(veinPositions), 34962, 5126, 'VEC3', veinPositions.length / 3, [-.31, .515, -.44], [.31, .515, .44])
const veinNormal = add(new Float32Array(veinNormals), 34962, 5126, 'VEC3', veinNormals.length / 3)
const veinIndex = add(new Uint16Array(veinIndices), 34963, 5123, 'SCALAR', veinIndices.length)

const gltf = {
  asset: { version: '2.0', generator: 'Endless Vortex leaf platform generator' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
  meshes: [{ name: 'LeafPlatform', primitives: [
    { attributes: { POSITION: bodyPosition, NORMAL: bodyNormal }, indices: bodyIndex, material: 0 },
    { attributes: { POSITION: veinPosition, NORMAL: veinNormal }, indices: veinIndex, material: 1 }
  ] }],
  materials: [
    { name: 'EmeraldLeaf', pbrMetallicRoughness: { baseColorFactor: [.035, .48, .12, 1], metallicFactor: .05, roughnessFactor: .48 },
      emissiveFactor: [.015, .08, .02], doubleSided: true },
    { name: 'GoldenVeins', pbrMetallicRoughness: { baseColorFactor: [1, .55, .03, 1], metallicFactor: .5, roughnessFactor: .25 },
      emissiveFactor: [.7, .2, .01], doubleSided: true }
  ],
  buffers: [{ byteLength: offset }], bufferViews: views, accessors
}
const json = Buffer.from(JSON.stringify(gltf))
const jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 0x20)
const binary = Buffer.concat(chunks)
const total = 12 + 8 + json.length + jsonPadding.length + 8 + binary.length
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8)
const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(json.length + jsonPadding.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
const output = path.join(__dirname, '..', 'assets', 'models', 'leaf-platform.glb')
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, Buffer.concat([header, jsonHeader, json, jsonPadding, binHeader, binary]))
console.log(output)
