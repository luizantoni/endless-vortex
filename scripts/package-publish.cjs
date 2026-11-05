// Archive exactly the deployment manifest; never ZIP the source project directory.
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { getPublishableFiles } = require('@dcl/sdk-commands/dist/logic/project-files')
const { createFsComponent } = require('@dcl/sdk-commands/dist/components/fs')
const root = path.resolve(__dirname, '..')
const limit = 49_000_000

;(async () => {
  const files = (await getPublishableFiles({ fs: createFsComponent() }, root)).sort()
  const expandedBytes = files.reduce((sum, file) => sum + fs.statSync(path.join(root, file)).size, 0)
  if (expandedBytes > limit) throw new Error('Deployment files exceed 49 MB; run npm run build:publish first.')
  const directory = path.join(root, 'export')
  fs.mkdirSync(directory, { recursive: true })
  const output = path.join(directory, 'endless-vortex-publish.zip')
  const temporary = path.join(directory, `publish-${process.pid}.zip`)
  try {
    execFileSync('zip', ['-X', '-9', '-q', temporary, ...files], { cwd: root, stdio: 'inherit' })
    execFileSync('unzip', ['-tq', temporary], { stdio: 'pipe' })
    const entries = execFileSync('unzip', ['-Z1', temporary], { encoding: 'utf8' }).trim().split('\n').sort()
    if (JSON.stringify(entries) !== JSON.stringify(files)) throw new Error('ZIP does not match the deployment manifest.')
    const zipBytes = fs.statSync(temporary).size
    if (zipBytes > limit) throw new Error('ZIP exceeds 49 MB.')
    fs.renameSync(temporary, output)
    fs.writeFileSync(path.join(directory, 'publish-manifest.json'), JSON.stringify({
      zipBytes, expandedBytes, limitBytes: limit, files
    }, null, 2) + '\n')
    console.log(`Created ${output}`)
    console.log(`ZIP: ${(zipBytes / 1e6).toFixed(2)} MB (${zipBytes.toLocaleString('en-US')} bytes)`)
    console.log(`Expanded: ${(expandedBytes / 1e6).toFixed(2)} MB; ${files.length} files; integrity verified.`)
  } finally {
    fs.rmSync(temporary, { force: true })
  }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
