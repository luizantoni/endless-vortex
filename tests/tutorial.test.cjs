const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict')
const { test } = require('node:test')
function load() {
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }) }
  const imports = { '@dcl/sdk/react-ecs': { __esModule: true, default: react, UiEntity: 'entity' },
    '@dcl/sdk/math': { Color4: { create: (r,g,b,a) => ({r,g,b,a}) } } }
  const code = ts.transpileModule(fs.readFileSync('src/tutorial.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, jsxFactory: 'ReactEcs.createElement'
  } }).outputText
  const mod = {exports:{}}
  new Function('require','module','exports',code)(name => imports[name],mod,mod.exports)
  return mod.exports
}
const walk = n => [n, ...n.children.flatMap(walk)]
const find = (tree, key) => walk(tree).find(n => n.props.key === key)
const texts = tree => walk(tree).map(n => n.props.uiText?.value || '').join(' ')
test('guide teaches five lessons, navigates both ways, exits and reopens with one click sound per action', () => {
  const {createFlightTutorial,FLIGHT_LESSONS} = load()
  let clicks = 0
  const guide = createFlightTutorial(() => clicks++)
  const render = () => guide.render(1280,720,undefined,false)
  assert.equal(FLIGHT_LESSONS.length,5)
  for (let i=0;i<5;i++) {
    assert.ok(walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith(`/tutorial-step-${i+1}-full.png`)))
    if(i===2) { find(render(),'back').props.onMouseDown(); assert.ok(walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/tutorial-step-2-full.png'))); find(render(),'next').props.onMouseDown() }
    find(render(),'next').props.onMouseDown()
  }
  assert.equal(clicks,7); assert.equal(guide.isOpen,false)
  find(render(),'reopen').props.onMouseDown()
  assert.ok(walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/tutorial-step-1-full.png')))
  find(render(),'skip').props.onMouseDown(); assert.equal(guide.isOpen,false)
})
test('guide respects safe areas and keeps independent 44px targets on desktop, tablet and both phone orientations', () => {
  const {createFlightTutorial,tutorialLayout} = load()
  const sizes = [[1920,1080],[1280,720],[1280,560],[1024,768],[768,1024],[844,390],[568,320],[390,844],[375,667],[320,568],[320,480],[360,640]]
  for(const [W,H] of sizes) {
    const inset={left:8,right:8,top:12,bottom:12}, layout=tutorialLayout(W,H,inset), guide=createFlightTutorial()
    assert.ok(layout.x>=8 && layout.y>=12 && layout.x+layout.width<=W-8 && layout.y+layout.height<=H-12)
    for(let i=0;i<5;i++) {
      const tree=guide.render(W,H,inset,W<H)
      const controls=walk(tree).filter(n=>n.props.onMouseDown && n.props.key && !String(n.props.key).startsWith('step-'))
      for(const n of controls) {
        const b=n.props.uiTransform
        assert.ok(b.height>=44 && b.width>=44)
        assert.ok(b.position.left>=0 && b.position.top>=0 && b.position.left+b.width<=layout.width && b.position.top+b.height<=layout.height)
      }
      const footer=controls.filter(n=>['back','skip','next'].includes(n.props.key)).sort((a,b)=>a.props.uiTransform.position.left-b.props.uiTransform.position.left)
      for(let j=1;j<footer.length;j++)assert.ok(footer[j-1].props.uiTransform.position.left+footer[j-1].props.uiTransform.width<=footer[j].props.uiTransform.position.left,`${W}x${H}: no overlapping buttons`)
      for(const n of walk(tree)) {
        const src=n.props.uiBackground?.texture?.src
        if(src)assert.ok(fs.existsSync(src),src)
      }
      find(tree,'next').props.onMouseDown()
    }
  }
})
test('image lettering changes light/dark on hover, keeps hit targets stable and has no FX or motion controls', () => {
  const {createFlightTutorial}=load();let clicks=0
  const guide=createFlightTutorial(()=>clicks++), render=()=>guide.render(1280,720,undefined,false)
  const normal=find(render(),'next')
  const lettering=(node,name)=>walk(node).find(n=>n.props.uiBackground?.texture?.src.endsWith(name+'.png'))
  assert.ok(lettering(normal,'next-light'))
  assert.equal(lettering(normal,'next-dark'),undefined,'resting state contains no dark image overlay')
  assert.ok(!walk(normal).some(n=>n.props.uiText),'NEXT uses image lettering instead of text')
  assert.ok(!walk(find(render(),'skip')).some(n=>n.props.uiText),'SKIP uses image lettering instead of text')
  normal.props.onMouseEnter();guide.update(.08)
  const hovered=find(render(),'next')
  assert.deepEqual(hovered.props.uiTransform,normal.props.uiTransform)
  assert.ok(lettering(hovered,'next-dark'))
  assert.equal(lettering(hovered,'next-light'),undefined,'hover swaps the single lettering texture')
  assert.ok(hovered.children.some(n=>n.props.uiTransform.opacity>0 && n.props.uiBackground?.texture?.src.endsWith('button-hover.png')))
  assert.equal(find(render(),'motion'),undefined);assert.equal(find(render(),'back'),undefined)
  assert.ok(!/FX ON|FX OFF|MOTION|STILL/.test(texts(render())))
  find(render(),'skip').props.onMouseDown();find(render(),'reopen').props.onMouseDown()
  assert.equal(clicks,2)
  find(render(),'next').props.onMouseDown();guide.update(.1);guide.update(.1)
  assert.ok(!walk(find(render(),'back')).some(n=>n.props.uiText),'BACK uses image lettering')
  assert.ok(lettering(find(render(),'back'),'back-light'))
  assert.equal(lettering(find(render(),'back'),'back-dark'),undefined)
  assert.equal(Math.abs(find(render(),'next').children[0].props.uiTransform.position.top),0,'press feedback expires')
  assert.ok(fs.statSync('assets/sounds/ui-click.wav').size>44)
})
test('logo and larger descriptions/goals render without covering navigation at all responsive sizes', () => {
  const {createFlightTutorial,FLIGHT_LESSONS}=load()
  for(const [W,H] of [[1280,720],[1280,560],[1280,640],[722,894],[390,844],[320,568],[320,480],[568,320],[844,390]]) {
    const guide=createFlightTutorial(), inset={left:8,right:8,top:12,bottom:12}
    for(let i=0;i<5;i++) {
      const tree=guide.render(W,H,inset,W<H), nodes=walk(tree)
      assert.ok(nodes.some(n=>n.props.uiBackground?.texture?.src==='assets/ui/endless-vortex-logo.png'))
      const body=nodes.find(n=>[FLIGHT_LESSONS[i].body,FLIGHT_LESSONS[i].shortBody].includes(n.props.uiText?.value))
      const title=nodes.find(n=>n.props.uiText?.value===FLIGHT_LESSONS[i].title.replace('\n',' '))
      const goal=nodes.find(n=>n.props.uiText?.value===FLIGHT_LESSONS[i].goal)
      const meta=find(tree,'tutorial-step-description')
      assert.ok(!walk(meta).some(n=>n.props.uiText),'step description and count use image lettering')
      assert.ok(meta.props.uiTransform.height>=24,'step lettering remains readable on compact layouts')
      for(const image of walk(meta).filter(n=>n.props.uiBackground?.texture)) assert.equal(image.props.uiTransform.position.left,0,'step artwork is left aligned')
      assert.ok(walk(meta).some(n=>n.props.uiBackground?.texture?.src.includes(`/tutorial-step-${i+1}-`)),'step artwork follows navigation')
      assert.ok(body.props.uiText.fontSize>=16)
      assert.ok(title.props.uiText.fontSize<=30)
      assert.ok(goal.props.uiText.fontSize>title.props.uiText.fontSize)
      const g=find(tree,'goal').props.uiTransform, footer=find(tree,'next').props.uiTransform.position.top
      assert.ok(g.position.top+g.height<=footer,`${W}x${H} lesson ${i}: goal stays above navigation`)
      assert.ok(body.props.uiTransform.position.top+body.props.uiTransform.height<=footer,`${W}x${H}: description stays above navigation`)
      find(tree,'next').props.onMouseDown()
    }
  }
})
test('actual HUD mounts the guide, restores the live HUD after skip, and opens it again', () => {
  let render, update, clicks=0
  const react={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(Boolean)})}
  const rankMod={exports:{}}
  new Function('exports',ts.transpileModule(fs.readFileSync('src/flight-ranks.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(rankMod.exports)
  const imports={
    './flight-ranks':rankMod.exports,
    './tutorial':load(),
    '@dcl/sdk/react-ecs':{__esModule:true,default:react,UiEntity:'entity',ReactEcsRenderer:{setUiRenderer:f=>render=f}},
    '@dcl/sdk/ecs':{engine:{RootEntity:0,addSystem:f=>update=f},UiCanvasInformation:{getOrNull:()=>({width:1280,height:720})}},
    '@dcl/sdk/math':{Color4:{create:(r,g,b,a)=>({r,g,b,a})}}
  }
  const mod={exports:{}}
  const code=ts.transpileModule(fs.readFileSync('src/airtime-ui.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,jsxFactory:'ReactEcs.createElement'}}).outputText
  new Function('require','module','exports',code)(name=>imports[name],mod,mod.exports)
  mod.exports.setupAirtimeUi({onUiClick:()=>clicks++})
  assert.ok(find(render(),'tutorial-step-description'))
  find(render(),'skip').props.onMouseDown();update(.06)
  assert.ok(walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-airtime-special.png')));assert.ok(!find(render(),'tutorial-step-description'))
  find(render(),'reopen').props.onMouseDown();update(.06)
  assert.ok(find(render(),'tutorial-step-description'));assert.equal(clicks,2)
})

test('centered logo projects exactly 30 percent above the panel while staying within screen safe areas', () => {
  const {createFlightTutorial}=load(), inset={left:8,right:8,top:12,bottom:12}
  for(const [W,H] of [[1920,1080],[1280,720],[768,1024],[390,844],[320,568],[320,480],[568,320],[844,390]]) {
    const tree=createFlightTutorial().render(W,H,inset,W<H)
    const panel=find(tree,'tutorial-panel').props.uiTransform, logo=find(tree,'tutorial-logo').props.uiTransform
    assert.equal(panel.overflow,'visible')
    assert.ok(Math.abs(logo.position.left+logo.width/2-panel.width/2)<.01)
    assert.ok(Math.abs(logo.position.top+logo.height*.3)<.01)
    assert.ok(panel.position.top+logo.position.top>=inset.top)
    assert.ok(logo.width>=Math.min(250,panel.width*.85),'logo stays prominent')
  }
})

test('panel glow stays inside the chamfered frame instead of filling the corner cutouts', () => {
  const {Resvg}=require('@resvg/resvg-js')
  const image=new Resvg(fs.readFileSync('assets/ui/tutorial/panel.svg','utf8')).render()
  const pixels=image.pixels, alpha=(x,y)=>pixels[(y*image.width+x)*4+3]
  for(const [x,y] of [[5,5],[10,10],[5,20],[954,5],[949,10],[5,714],[10,709],[954,714],[949,709]]) {
    assert.equal(alpha(x,y),0,`corner cutout ${x},${y} stays transparent`)
  }
  assert.equal(alpha(30,30),255,'the panel interior stays opaque')
})

test('navigation wordmarks have balanced padding and a single filled image at rest on every device size', () => {
  const {createFlightTutorial}=load()
  for(const [W,H] of [[1280,720],[390,844],[320,480],[568,320]]) {
    const guide=createFlightTutorial(), render=()=>guide.render(W,H,undefined,W<H)
    find(render(),'next').props.onMouseDown();guide.update(.1);guide.update(.1)
    for(const key of ['back','skip','next']) {
      const button=find(render(),key), b=button.props.uiTransform
      const wordmarks=walk(button).filter(n=>/\/(back|skip|next)-(light|dark)\.png$/.test(n.props.uiBackground?.texture?.src||''))
      assert.equal(wordmarks.length,1,'no hidden variant stacked over the visible image')
      assert.ok(wordmarks[0].props.uiBackground.texture.src.endsWith('-light.png'))
      const label=wordmarks[0].props.uiTransform
      assert.ok(label.width<=b.width*.72 && label.height<=b.height*.63)
      assert.ok(label.position.left+.01>=b.width*.14 && label.position.top+.01>=b.height*.18)
    }
  }
})
