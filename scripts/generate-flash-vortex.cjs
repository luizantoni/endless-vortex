// Bake a spin atlas from the same transparent vortex used by the pickup orbs.
const { Resvg } = require('@resvg/resvg-js')
const { readFileSync, writeFileSync } = require('node:fs')
const root = 'assets/ui/modular/'
const texture = readFileSync(root + 'vortex.png').toString('base64')
const size = 192, columns = 6, frames = columns ** 2, edge = size * columns
const tiles = Array.from({ length: frames }, (_, i) => {
  const x = i % columns * size + size / 2, y = Math.floor(i / columns) * size + size / 2
  return `<image href="data:image/png;base64,${texture}" x="-88" y="-88" width="176" height="176"
    transform="translate(${x} ${y}) rotate(${360 * i / frames})"/>`
}).join('')
writeFileSync(root + 'flash-vortex.png', new Resvg(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}">${tiles}</svg>`
).render().asPng())
