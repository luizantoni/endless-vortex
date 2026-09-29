const fs = require('node:fs')
const path = require('node:path')

const source = path.join(__dirname, '../assets/models/leaf1-source.glb')
const destination = path.join(__dirname, '../assets/models/leaf-platform.glb')
const input = fs.readFileSync(source)
if (input.toString('ascii', 0, 4) !== 'glTF' || input.readUInt32LE(4) !== 2) {
  throw new Error('Expected a binary glTF 2.0 leaf model')
}

const jsonLength = input.readUInt32LE(12)
const json = JSON.parse(input.toString('utf8', 20, 20 + jsonLength))
const node = json.nodes.find(value => Number.isInteger(value.mesh))
if (!node) throw new Error('Leaf model has no mesh node')
const mesh = json.meshes[node.mesh]
const positions = mesh.primitives.map(primitive => json.accessors[primitive.attributes.POSITION])
const min = [0, 1, 2].map(axis => Math.min(...positions.map(accessor => accessor.min[axis])))
const max = [0, 1, 2].map(axis => Math.max(...positions.map(accessor => accessor.max[axis])))
const scale = node.scale || [1, 1, 1]
// Recenter the node pivot without changing mesh vertices, scale, or aspect ratio.
node.translation = [0, 1, 2].map(axis => -((min[axis] + max[axis]) / 2) * scale[axis])

const rawJson = Buffer.from(JSON.stringify(json))
const paddedLength = (rawJson.length + 3) & ~3
const jsonChunk = Buffer.alloc(paddedLength, 0x20)
rawJson.copy(jsonChunk)
const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonChunk.length, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4) // JSON
const binaryChunks = input.subarray(20 + jsonLength)
const output = Buffer.concat([Buffer.alloc(12), jsonHeader, jsonChunk, binaryChunks])
output.write('glTF', 0, 4, 'ascii')
output.writeUInt32LE(2, 4)
output.writeUInt32LE(output.length, 8)
fs.writeFileSync(destination, output)
console.log(`Centered leaf pivot; preserved mesh scale and aspect ratio: ${destination}`)
