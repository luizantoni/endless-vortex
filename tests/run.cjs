// Transpile actual source modules in-memory; no extra test dependency or copied game logic.
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename)
require('./vortex.test.cjs')
require('./airtime.test.cjs')
require('./floor-reset-platform.test.cjs')
require('./shared-obstacles.test.cjs')
require('./bubble.test.cjs')
require('./avatar-airtime-badge.test.cjs')
require('./flight-ranks.test.cjs')
require('./progress.test.cjs')
require('./server.test.cjs')
require('./hud.test.cjs')

require('./tutorial.test.cjs')
