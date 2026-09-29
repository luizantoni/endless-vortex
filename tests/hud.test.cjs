const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict')
const { test } = require('node:test')
test('modular HUD reserves native corners, clips no panel, and bounds milestone effects', () => {
  let render, update, size = { width: 1280, height: 720 }
  const ecs = { engine: { RootEntity: 0, addSystem: f => update = f }, UiCanvasInformation: { getOrNull: () => size } }
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }) }
  const imports = {
    '@dcl/sdk/react-ecs': { __esModule: true, default: react, UiEntity: 'entity', ReactEcsRenderer: { setUiRenderer: f => render = f } },
    '@dcl/sdk/ecs': ecs, '@dcl/sdk/math': { Color4: { create: (r,g,b,a) => ({ r,g,b,a }) } }
  }
  const code = ts.transpileModule(fs.readFileSync('src/airtime-ui.tsx','utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, jsxFactory: 'ReactEcs.createElement' }
  }).outputText
  const mod = { exports: {} }
  new Function('require','module','exports',code)(name => imports[name],mod,mod.exports)
  const { display, setupAirtimeUi } = mod.exports
  setupAirtimeUi({ lift() {}, refresh() {}, sound() {} })
  display.rows = Array.from({length:5},(_,i)=>({rank:i+1,userId:'avatar'+i,name:'Runner',airtime:'12480.000s'}))
  const walk = node => [node,...node.children.flatMap(walk)]
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
      if(n.props.onMouseDown && /LIFT|SOUND/.test(n.props.uiText?.value)) assert.ok(n.props.uiTransform.height>=44)
      const src=n.props.uiBackground?.texture?.src
      if(src) { assert.ok(fs.existsSync(src)); assert.ok(!src.endsWith('eternal-vortex-hud.png')) }
    }
  }
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
  assert.ok(walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/milestone-100.png')),
    'earned award frame settles into the top streak slot')
  display.time='0.000'; update(.06)
  assert.ok(walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/streak.png')),
    'replay resets the displayed award tier')
})
