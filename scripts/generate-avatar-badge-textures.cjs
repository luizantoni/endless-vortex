const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')

const root = path.resolve(__dirname, '..')
const sourceRoot = path.join(root, 'assets/ui/modular')
const outputRoot = path.join(sourceRoot, 'avatar-badge')

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file))
}

function writePng(file, image, colorType) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, PNG.sync.write(image, { colorType, inputColorType: colorType }))
}

function alphaMask(image) {
  const data = Buffer.alloc(image.width * image.height)
  for (let source = 3, target = 0; target < data.length; source += 4, target++) {
    data[target] = image.data[source]
  }
  return { width: image.width, height: image.height, data }
}

const plates = [
  ['streak.png', 'plate-streak-alpha.png'],
  ...Array.from({ length: 10 }, (_, index) => {
    const seconds = (index + 1) * 100
    return [`milestones/milestone-${seconds}.png`, `plate-${seconds}-alpha.png`]
  })
]

for (const [source, mask] of plates) {
  const image = readPng(path.join(sourceRoot, source))
  writePng(path.join(outputRoot, mask), alphaMask(image), 0)
}

const vortex = readPng(path.join(sourceRoot, 'vortex.png'))
const vortexAlphaPath = path.join(outputRoot, 'vortex-alpha.png')
writePng(vortexAlphaPath, alphaMask(vortex), 0)

const atlas = readPng(path.join(sourceRoot, 'digits.png'))
const cellWidth = atlas.width / 6
const cellHeight = atlas.height / 2
if (!Number.isInteger(cellWidth) || !Number.isInteger(cellHeight)) {
  throw new Error('Expected the digit atlas to contain six columns and two rows')
}

for (let digit = 0; digit < 10; digit++) {
  const x0 = (digit % 6) * cellWidth
  const y0 = Math.floor(digit / 6) * cellHeight
  const cell = { width: cellWidth, height: cellHeight,
    data: Buffer.alloc(cellWidth * cellHeight * 4) }
  for (let y = 0; y < cellHeight; y++) {
    const sourceStart = ((y0 + y) * atlas.width + x0) * 4
    const targetStart = y * cellWidth * 4
    atlas.data.copy(cell.data, targetStart, sourceStart, sourceStart + cellWidth * 4)
  }
  writePng(path.join(outputRoot, 'digits', `${digit}.png`), cell, 6)
  writePng(path.join(outputRoot, 'digits', `${digit}-alpha.png`), alphaMask(cell), 0)
}

// Verify every generated transparency image is a true one-channel PNG and retains source alpha.
for (const [source, mask] of plates) {
  const original = readPng(path.join(sourceRoot, source))
  const generated = readPng(path.join(outputRoot, mask))
  if (generated.colorType !== 0 || generated.width !== original.width || generated.height !== original.height) {
    throw new Error(`Invalid alpha mask generated for ${source}`)
  }
  if (Array.from({ length: original.width * original.height }, (_, index) =>
    generated.data[index * 4] !== original.data[index * 4 + 3]).some(Boolean)) {
    throw new Error(`Alpha mask does not match source transparency for ${source}`)
  }
}

const vortexMask = readPng(vortexAlphaPath)
if (vortexMask.colorType !== 0 || vortexMask.width !== vortex.width || vortexMask.height !== vortex.height ||
  Array.from({ length: vortex.width * vortex.height }, (_, index) =>
    vortexMask.data[index * 4] !== vortex.data[index * 4 + 3]).some(Boolean)) {
  throw new Error('Alpha mask does not match source transparency for vortex.png')
}

for (let digit = 0; digit < 10; digit++) {
  const image = readPng(path.join(outputRoot, 'digits', `${digit}.png`))
  const mask = readPng(path.join(outputRoot, 'digits', `${digit}-alpha.png`))
  if (image.width !== mask.width || image.height !== mask.height || mask.colorType !== 0) {
    throw new Error(`Invalid digit alpha mask generated for ${digit}`)
  }
  if (Array.from({ length: image.width * image.height }, (_, index) =>
    mask.data[index * 4] !== image.data[index * 4 + 3]).some(Boolean)) {
    throw new Error(`Alpha mask does not match digit ${digit}`)
  }
}

console.log('Generated and verified avatar badge alpha masks and cropped digit sprites.')
