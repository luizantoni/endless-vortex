// Preserve the editable orchard and generate a portable, floating-point runtime GLB.
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  '--yes', 'gltfpack@1.3.0',
  '-i', 'assets/models/orchard.glb',
  '-o', 'assets/models/orchard-runtime.glb',
  '-si', '0.5', '-se', '0.002', '-sp', '-sv', '-noq',
  '-kn', '-km', '-ke', '-af', '0', '-ac'
], { cwd: root, stdio: 'inherit' })
