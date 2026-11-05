// Use the same file discovery and ignore rules as the installed publishing SDK.
const fs = require('node:fs')
const path = require('node:path')
const { getPublishableFiles } = require('@dcl/sdk-commands/dist/logic/project-files')
const { createFsComponent } = require('@dcl/sdk-commands/dist/components/fs')

const root = path.resolve(__dirname, '..')
const limit = 49_000_000
;(async () => {
  const paths = await getPublishableFiles({ fs: createFsComponent() }, root)
  const files = paths.map(file => ({ path: file, size: fs.statSync(path.join(root, file)).size }))
    .sort((a, b) => b.size - a.size)
  const bytes = files.reduce((sum, file) => sum + file.size, 0)
  const manifest = new Map(files.map(file => [file.path.toLowerCase(), file.path]))
  const scene = JSON.parse(fs.readFileSync(path.join(root, 'scene.json'), 'utf8'))
  for (const file of [scene.main, scene.display.navmapThumbnail, 'assets/models/orchard-runtime.glb']) {
    if (!manifest.has(file.toLowerCase())) throw new Error('Required publishable file missing: ' + file)
  }
  // Catch literal runtime paths removed by ignore rules. Dynamic UI paths remain covered by game tests.
  const code = fs.readFileSync(path.join(root, scene.main), 'utf8')
  for (const match of code.matchAll(/["'](assets\/[^"'\n]+\.(?:png|glb|mp3|wav))["']/g)) {
    const file = match[1]
    // Some literal paths are legacy GLBs that the entry point explicitly removes from the scene.
    if (!manifest.has(file.toLowerCase()) && fs.existsSync(path.join(root, file)) &&
      !file.endsWith('orchard.glb') && !file.endsWith('blue-lava-vortex.glb') &&
      !file.endsWith('rocks2.glb') && !file.includes('wind_tunnel2/')) {
      throw new Error('Referenced asset excluded from publication: ' + file)
    }
  }
  console.log(`Scene: ${bytes.toLocaleString('en-US')} bytes (${(bytes / 1e6).toFixed(2)} MB), ${files.length} files`)
  console.log(`Limit: 49.00 MB. Remaining: ${((limit - bytes) / 1e6).toFixed(2)} MB`)
  for (const file of files.slice(0, 8)) console.log(`${(file.size / 1e6).toFixed(2).padStart(6)} MB  ${file.path}`)
  if (bytes > limit) throw new Error('Scene exceeds 49 MB. Run npm run build:publish before checking.')
})().catch(error => { console.error(error.message); process.exitCode = 1 })
