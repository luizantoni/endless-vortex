const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict')
const { test } = require('node:test')
test('modular HUD reserves native corners, clips no panel, and bounds milestone effects', () => {
  let render, update, rendererOptions, size = { width: 1280, height: 720 }
  const ecs = { engine: { RootEntity: 0, addSystem: f => update = f }, UiCanvasInformation: { getOrNull: () => size } }
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }) }
  const imports = {
    '@dcl/sdk/react-ecs': { __esModule: true, default: react, UiEntity: 'entity', ReactEcsRenderer: {
      setUiRenderer: (f, options) => { render = f; rendererOptions = options }
    } },
    '@dcl/sdk/ecs': ecs, '@dcl/sdk/math': { Color4: { create: (r,g,b,a) => ({ r,g,b,a }) } }
  }
  const code = ts.transpileModule(fs.readFileSync('src/airtime-ui.tsx','utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, jsxFactory: 'ReactEcs.createElement' }
  }).outputText
  const mod = { exports: {} }
  new Function('require','module','exports',code)(name => imports[name],mod,mod.exports)
  const { display, setupAirtimeUi } = mod.exports
  setupAirtimeUi()
  assert.deepEqual(rendererOptions, { virtualWidth: 0, virtualHeight: 0, screenInset: 'none' },
    'pixel-positioned HUD opts out of SDK scaling and applies insets once')
  display.orbs = 3
  display.best = '12.50'; display.state = 'Finished · floor pad · move to restart'
  display.rows = Array.from({length:5},(_,i)=>({rank:i+1,userId:'avatar'+i,name:'Runner',airtime:'12480.000s'}))
  const walk = node => [node,...node.children.flatMap(walk)]
  const containsText = (node, value) => walk(node).some(n => n.props.uiText?.value === value)
  for (const [width,height] of [[1280,720],[844,390],[390,844]]) {
    size = {width,height}; update(.06)
    const tree = render()
    assert.equal(render(),tree,'renderer caches the tree between animation ticks')
    for (const node of tree.children) {
      const b = node.props.uiTransform, {left:x,top:y} = b.position
      assert.ok(x>=0 && y>=0 && x+b.width<=width && y+b.height<=height,'component stays on screen')
      assert.ok(!(x<width*.25 && y<height*.25),'top-left stays clear')
      assert.ok(!(y+b.height>height*.75 && (x<width*.2 || x+b.width>width*.8)),'lower corners stay clear')
    }
    for (const n of walk(tree)) {
      if(n.props.uiText) { assert.equal(n.props.uiText.font,'serif'); assert.ok(n.props.uiText.fontSize>=11) }
      assert.ok(!/LIFT|SOUND ON|SOUND OFF/.test(n.props.uiText?.value || ''),'manual lift and sound controls are removed')
      assert.ok(!/TELEPORT|RUN STATE|LAVA FLOW|READY TO FLY|IN THIS SCENE|AIRTIME MEDALS/.test(n.props.uiText?.value || ''),
        'the HUD avoids redundant state and instructional text')
      if(n.props.onMouseDown && /LIFT|SOUND/.test(n.props.uiText?.value)) assert.ok(n.props.uiTransform.height>=44)
      const src=n.props.uiBackground?.texture?.src
      if(src) { assert.ok(fs.existsSync(src)); assert.ok(!src.endsWith('eternal-vortex-hud.png')) }
    }
    if(width > height) {
      const topPanel = tree.children.find(node => containsText(node, 'AIRTIME'))
      const leaderboard = tree.children.find(node => containsText(node, 'NEARBY'))
      const medals = tree.children.find(node => containsText(node, 'MEDALS'))
      const bounds = node => ({ top: node.props.uiTransform.position.top, height: node.props.uiTransform.height })
      assert.equal(topPanel.props.uiTransform.width, leaderboard.props.uiTransform.width)
      assert.equal(leaderboard.props.uiTransform.width, medals.props.uiTransform.width,
        'timer, medal strip and nearby board share one width')
      assert.equal(topPanel.props.uiTransform.position.left, leaderboard.props.uiTransform.position.left)
      assert.equal(leaderboard.props.uiTransform.position.left, medals.props.uiTransform.position.left)
      assert.ok(walk(tree).some(node => node.props.uiText?.value === 'ORB 3/10'), 'HUD restores the orb counter')
      assert.ok(walk(topPanel).some(node => node.props.uiText?.value === 'BEST 12.50'),
        'personal best appears under the large timer digits')
      assert.equal(walk(topPanel).some(node => /FINISHED/.test(node.props.uiText?.value || '')), false,
        'the finished label no longer occupies the best-time slot')
      assert.ok(walk(topPanel).some(node => node.props.uiBackground?.texture?.src.endsWith('/row.png')),
        'orb progress uses the existing row-plaque texture inside the timer card')
      assert.ok(bounds(leaderboard).top >= bounds(topPanel).top + bounds(topPanel).height,
        'leaderboard starts below the timer plaque')
      assert.ok(bounds(medals).top >= bounds(topPanel).top + bounds(topPanel).height &&
        bounds(medals).top + bounds(medals).height <= bounds(leaderboard).top,
        'medal strip sits above the nearby board')
    }
  }
  const hasVignette = () => walk(render()).some(n =>
    n.props.uiBackground?.texture?.src.endsWith('/low-altitude-vignette.png'))
  display.state = 'Airborne'; display.time = '9.99'; display.altitudeMeters = .39; update(.06)
  assert.equal(hasVignette(), false, 'the danger edge stays off during the first ten seconds')
  display.time = '10.00'; update(.06)
  assert.equal(hasVignette(), true, 'ten airborne seconds and low altitude show the red vignette')
  display.altitudeMeters = .4; update(.06)
  assert.equal(hasVignette(), false, 'the warning clears at 40 cm')
  display.altitudeMeters = .39; display.state = 'Paused'; update(.06)
  assert.equal(hasVignette(), false, 'paused runs do not show the airborne warning')
  display.state = 'Airborne'; display.time = '0.00'; update(.06)
  assert.equal(hasVignette(), false, 'replay clears the warning')
  size = { width: 390, height: 844 }
  display.time = '12.34'; display.best = '18.00'; display.state = 'Airborne'; update(.06)
  const portraitDigitUvs = () => walk(render()).filter(n =>
    n.props.uiBackground?.texture?.src.endsWith('/digits.png')).map(n => n.props.uiBackground.uvs)
  const mobileDigits = portraitDigitUvs()
  assert.ok(walk(render()).some(node => node.props.uiText?.value === 'ORB 3/10'))
  assert.ok(walk(render()).some(node => node.props.uiBackground?.texture?.src.endsWith('/row.png')),
    'portrait orb progress keeps the same row-plaque style')
  assert.equal(mobileDigits.length, 5, 'portrait mobile shows the live timer digits')
  display.time = '13.34'; update(.06)
  assert.notDeepEqual(portraitDigitUvs()[1], mobileDigits[1], 'the blue timer updates as airtime advances')
  assert.ok(walk(render()).some(n => n.props.uiText?.value === 'AIRBORNE'))
  size = { width: 844, height: 390 }
  display.state='Airborne'; display.time='30.000'; update(.06)
  const hasBurst=()=>walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/burst.png'))
  assert.equal(hasBurst(),true)
  for(let i=0;i<20;i++) update(.06)
  assert.equal(hasBurst(),false,'burst terminates without continuous particle work')
  display.time='0.000'; update(.06); display.time='30.000'; update(.06)
  assert.equal(hasBurst(),true,'replay rearms the milestone')
  update(1); assert.equal(hasBurst(),false,'suspension clears the cached burst immediately')
  display.state='Airborne'; display.time='100.000'; update(.06)
  const findBanner = node => {
    if (node.children.some(child => child.props.uiText?.value === '100 SECONDS AIRBORNE!')) return node
    for (const child of node.children) { const found = findBanner(child); if (found) return found }
  }
  const banner = () => findBanner(render())
  assert.ok(banner(),'100 seconds triggers an exact-text center award')
  const start = banner().props.uiTransform.position
  for(let i=0;i<20;i++) update(.06)
  const moving = banner().props.uiTransform.position
  assert.ok(moving.left > start.left && moving.top < start.top,'award scales and travels upward toward the top slot')
  for(let i=0;i<20;i++) update(.06)
  assert.ok(!walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/milestone-100.png')),
    'the milestone award fades instead of leaving a fixed badge behind')
  display.time='0.000'; update(.06)
  assert.ok(!walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/streak.png')),
    'the obsolete fixed red streak plate is removed completely')
  display.time='0.000'; display.rewardCelebration++; update(.06)
  const celebration = () => walk(render())
  assert.ok(celebration().some(n=>n.props.uiBackground?.texture?.src.endsWith('/endless-vortex-logo.png')),
    'successful orb reward celebrates with the Endless Vortex logo')
  assert.ok(!celebration().some(n=>n.props.uiText?.value === 'ASCENSION!'),
    'the logo replaces the congratulatory subtitle')
  assert.equal(celebration().filter(n=>['✦','✧','•'].includes(n.props.uiText?.value)).length, 56,
    'the screen burst uses a fixed pool of 56 UI particles')
  for(let i=0;i<80;i++) update(.06)
  assert.ok(!celebration().some(n=>n.props.uiBackground?.texture?.src.endsWith('/endless-vortex-logo.png')),
    'slow-motion logo celebration fades away after its longer duration')
})
