const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict')
const { test } = require('node:test')
test('modular HUD reserves native corners, clips no panel, and bounds milestone effects', () => {
  let render, update, rendererOptions, size = { width: 1280, height: 720 }
  const ecs = { engine: { RootEntity: 0, addSystem: f => update = f }, UiCanvasInformation: { getOrNull: () => size } }
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }) }
  const rankMod={exports:{}}
  new Function('exports',ts.transpileModule(fs.readFileSync('src/flight-ranks.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(rankMod.exports)
  const imports = {
 './flight-ranks':rankMod.exports,
 '@dcl/sdk/react-ecs': { __esModule: true, default: react, UiEntity: 'entity', ReactEcsRenderer: {
      setUiRenderer: (f, options) => { render = f; rendererOptions = options }
    } },
    '@dcl/sdk/ecs': ecs, '@dcl/sdk/math': { Color4: { create: (r,g,b,a) => ({ r,g,b,a }) } }
  }
  const tutorialMod={exports:{}}
  const tutorialCode=ts.transpileModule(fs.readFileSync('src/tutorial.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,jsxFactory:'ReactEcs.createElement'}}).outputText
  new Function('require','module','exports',tutorialCode)(name=>imports[name],tutorialMod,tutorialMod.exports)
  imports['./tutorial']=tutorialMod.exports
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
  const find = (node,key)=>walk(node).find(n=>n.props.key===key)
  find(render(),'skip').props.onMouseDown();update(.06)
  display.altitude='19.5'; display.energy=65
  for (const [width,height] of [[1280,720],[844,390],[390,844],[320,480],[568,320]]) {
    size = {width,height}; update(.06)
    const tree = render()
    assert.equal(render(),tree,'renderer caches the tree between animation ticks')
    for (const node of tree.children) {
      const b = node.props.uiTransform, {left:x,top:y} = b.position
      assert.ok(x>=0 && y>=0 && x+b.width<=width && y+b.height<=height,'component stays on screen')
      assert.ok(!(x<width*.25 && y<height*.25),'top-left stays clear')
      assert.ok(!(y+b.height>height*(node.props.key==='hud-altitude' ? 1 : node.props.key==='hud-sidebar' ? .9 : .75) && (x<width*.2 || x+b.width>width*.8)),'lower corners stay clear')
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
    const panel=find(tree,'hud-sidebar'), orb=find(tree,'hud-orbs'), guide=find(panel,'reopen')
    assert.ok(panel && orb && guide)
    const altitude=find(tree,'hud-altitude')
    if(width>=height) {
      assert.ok(altitude,'landscape retains the altitude display')
      const a=altitude.props.uiTransform, footer=find(panel,'hud-footer-logo').props.uiTransform
      assert.ok(a.width/a.height>=5,'altitude card is slim and horizontal')
      assert.ok(Math.abs(a.position.left+a.width-(width-12))<.001,'altitude aligns with the right edge')
      assert.ok(panel.props.uiTransform.position.top+footer.position.top+footer.height<=a.position.top,'altitude clears the side panel and footer logo')
      assert.ok(walk(altitude).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-altitude-special.png')))
      assert.ok(walk(altitude).some(n=>n.props.uiBackground?.texture?.src.endsWith('/hud-altitude.png')))
      const title=find(altitude,'altitude-title').props.uiTransform
      assert.ok(Math.abs(title.position.top+title.height*.20)<.001,'altitude title extends twenty percent above its frame')
      const value=find(altitude,'altitude-value')
      assert.ok(title.position.left+title.width<value.props.uiTransform.position.left,'enlarged title clears the digits')
      assert.ok(panel.props.uiTransform.position.top+footer.position.top+footer.height<=a.position.top+title.position.top,'footer clears the lifted altitude title')
      assert.equal(walk(value).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png')).length,4,'altitude and decimal use blue sprites')
      assert.ok(!walk(altitude).some(n=>/\d|ALTITUDE/.test(n.props.uiText?.value||'')),'altitude avoids native numeric and heading text')
      const bar=find(altitude,'altitude-bar'), fill=find(bar,'altitude-fill')
      assert.equal(bar.props.uiTransform.height,16,'gradient bar is larger')
      assert.ok(Math.abs(fill.props.uiTransform.width/(bar.props.uiTransform.width-4)-.65)<.001,'fill tracks the live altitude percentage')
    }
    assert.ok(Math.abs(orb.props.uiTransform.position.left+orb.props.uiTransform.width/2-width/2)<.01,'orbs stay top-center')
    for (const [parent,key] of [[panel,'hud-airtime'],[orb,'hud-orbs-title']]) {
      const title=find(parent,key).props.uiTransform, p=parent.props.uiTransform
      assert.ok(Math.abs(title.position.top+title.height*.30)<.001,'title overhang is exactly thirty percent')
      assert.ok(Math.abs(title.position.left+title.width/2-p.width/2)<.001,'title is horizontally centered')
      assert.ok(p.position.top+title.position.top>=0,'title overhang remains on screen')
    }
    const orbTitle=find(orb,'hud-orbs-title').props.uiTransform
    assert.ok(orb.props.uiTransform.position.top+orbTitle.position.top<height*.08)
    const orbValue=find(orb,'orb-progress-value').props.uiTransform
    assert.ok(orbValue.position.top>=orbTitle.position.top+orbTitle.height,'count stays below title')
    assert.ok(orbValue.position.top+orbValue.height<=find(orb,'orb-tick-0').props.uiTransform.position.top,'count clears progress orbs')
    assert.ok(guide.props.uiTransform.position.top>find(panel,'hud-nearby').props.uiTransform.position.top,'guide follows nearby players')
    assert.ok(guide.props.uiTransform.position.top+44<=panel.props.uiTransform.height)
    assert.ok(panel.props.uiTransform.position.top+guide.props.uiTransform.position.top+44<=height*.75,'interactive content keeps lower corners clear')
    const footer=find(panel,'hud-footer-logo'), logo=footer.props.uiTransform
    assert.equal(footer,panel.children[panel.children.length-1],'game logo closes the side menu')
    assert.equal(footer.props.uiBackground.texture.src,'assets/ui/endless-vortex-logo.png')
    assert.ok(logo.position.top>=guide.props.uiTransform.position.top+44,'footer follows the guide tap target')
    assert.ok(Math.abs(logo.position.top+logo.height-panel.props.uiTransform.height-logo.height*.30)<.001,'footer projects exactly thirty percent below the panel')
    assert.ok(panel.props.uiTransform.position.top+logo.position.top+logo.height<=height,'footer logo stays on screen')
    assert.ok(panel.props.uiTransform.position.left+logo.position.left>=0 && panel.props.uiTransform.position.left+logo.position.left+logo.width<=width,'enlarged footer stays within screen width')
    assert.ok(Math.abs(logo.width/logo.height-2145/733)<.01,'logo keeps its original proportions')
    assert.ok(Math.abs(logo.position.left+logo.width/2-panel.props.uiTransform.width/2)<.01,'footer logo is centered')
    assert.ok(find(panel,'hud-medals').props.uiTransform.position.top>find(panel,'live-timer').props.uiTransform.position.top)
    assert.ok(find(panel,'hud-nearby').props.uiTransform.position.top>find(panel,'hud-medals').props.uiTransform.position.top)
    assert.ok(walk(panel).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-airtime-special.png')))
    for(const word of ['medals','nearby'])assert.ok(walk(panel).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-'+word+'-light.png')))
    assert.ok(walk(orb).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-orbs-special.png')))
    const guidePlate=guide.children[0].props.uiTransform
    assert.equal(guidePlate.width,guide.props.uiTransform.width*.575,'guide artwork is fifteen percent larger than the half-size version')
    assert.ok(Math.abs(guidePlate.height-25.3)<.001,'guide artwork height increases by fifteen percent')
    assert.equal(guide.props.uiTransform.height,44,'the tap target remains usable')
    for(const tier of ['bronze','silver','gold'])assert.ok(walk(panel).some(n=>n.props.uiBackground?.texture?.src.includes('/medal-'+tier+'-')))
    for(const row of walk(panel).filter(n=>String(n.props.key||'').startsWith('leader-'))) {
      const id=row.props.key.slice(7), portrait=find(row,'portrait-'+id), score=find(row,'score-'+id)
      const insignia=find(row,'rank-insignia-'+id), name=find(row,'player-name-'+id)
      assert.ok(insignia.props.uiBackground.texture.src.endsWith('/rank-10.png'),'nearby insignia follows airtime tier rather than list position')
      const crest=insignia.props.uiTransform, n=name.props.uiTransform
      assert.ok(crest.width>=80 && crest.height>=40,'rank insignia is large enough to recognize')
      const clears=(a,b)=>a.position.left+a.width<=b.position.left || b.position.left+b.width<=a.position.left || a.position.top+a.height<=b.position.top || b.position.top+b.height<=a.position.top
      assert.ok(clears(crest,n),'insignia clears the username')
      assert.ok(clears(crest,score.props.uiTransform),'insignia clears the score')
      assert.ok(n.position.left+n.width<=row.props.uiTransform.width,'username remains within the row')
      assert.ok(n.position.top+n.height<=score.props.uiTransform.position.top,'username clears the blue score')
      assert.equal(portrait.props.uiBackground.avatarTexture.userId,id,'portrait belongs to this player')
      assert.ok(portrait.props.uiTransform.width>=22,'portraits are enlarged')
      assert.ok(walk(score).some(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png')))
    }
    assert.ok(walk(guide).some(n=>n.props.uiBackground?.texture?.src.endsWith('/flight-guide-light.png')))
    const orbDigits=walk(find(orb,'orb-progress-value')).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-gold.png'))
    assert.equal(orbDigits.length,4,'orb total uses gold sprite digits and a slash')
    assert.equal(orbDigits[0].props.uiBackground.uvs[0],3/6,'orb count is still accurate')
    assert.equal(walk(orb).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/orb-icon.png')).length,3)
    assert.equal(walk(orb).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/orb-empty.png')).length,7)
    for(const caption of walk(find(panel,'hud-medals')).filter(n=>String(n.props.key||'').startsWith('medal-threshold-'))) {
      assert.ok(!walk(caption).some(n=>n.props.uiText),'medal numbers and the seconds suffix have no SDK text to ghost')
      assert.equal(walk(caption).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png')).length,3)
    }
    assert.ok(walk(panel).some(n=>n.props.uiText?.value==='BEST'))
    const bestDigits=walk(find(panel,'best-time-digits')).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png'))
    assert.equal(bestDigits.length,8,'best time uses blue sprites for every digit and separator')
    assert.ok(!walk(panel).some(n=>/BEST .*\d/.test(n.props.uiText?.value||'')),'best score has no native numeric text')
    assert.ok(!walk(panel).some(n=>n.props.key==='orb-progress-value'),'orbs are no longer nested in the timer')
    assert.ok(!walk(tree).some(n=>['AIRTIME','MEDALS','NEARBY','ORBS','FLIGHT GUIDE'].includes(n.props.uiText?.value)),'section labels use image lettering')
    assert.ok(!walk(tree).some(n=>/\/(panel|row)\.png$/.test(n.props.uiBackground?.texture?.src||'') && (n.props.uiBackground?.texture?.src||'').includes('/modular/')),'old ornate panel and strips are replaced')

  }
  size={width:1280,height:720,screenInsetArea:{left:24,right:36,top:18,bottom:22}}
  for(const energy of [0,100,150,-10,NaN]) {
    display.energy=energy;update(.06)
    const bar=find(render(),'altitude-bar'), fill=find(bar,'altitude-fill')
    if(!(energy>0)) assert.equal(fill,undefined,'empty and invalid values show no fill')
    else assert.equal(fill.props.uiTransform.width,bar.props.uiTransform.width-4,'full and overflowing values stay inside the track')
  }
  display.energy=65
  display.rows=[1,4,7,11,13].map((rank,i)=>({rank,userId:'u'+i,name:'Runner',airtime:'42.00s'}))
  display.localUser='u4';update(.06)
  const safePanel=find(render(),'hud-sidebar'), safeOrb=find(render(),'hud-orbs')
  assert.ok(safePanel.props.uiTransform.position.left+safePanel.props.uiTransform.width<=1280-36)
  assert.ok(Math.abs(safeOrb.props.uiTransform.position.left+safeOrb.props.uiTransform.width/2-(24+(1280-24-36)/2))<.01)
  const rows=walk(safePanel).filter(n=>String(n.props.key||'').startsWith('leader-'))
  assert.ok(rows.some(n=>n.props.key==='leader-u4'),'local player remains in the visible list')
  for(let i=1;i<rows.length;i++)assert.equal(rows[i].props.uiTransform.position.top-rows[i-1].props.uiTransform.position.top,rows[i].props.uiTransform.height,'gaps in rank never create gaps in layout')
  assert.equal(mod.exports.formatAirtime('59.999'),'01:00.00','centisecond carry is normalized')
  assert.equal(mod.exports.formatAirtime('78.24'),'01:18.24')
  assert.equal(mod.exports.formatAirtime('78.24',false),'01:18')
  display.medals='✓ Bronze · ✓ Silver · ○ Gold';update(.06)
  const medalSources=walk(render()).map(n=>n.props.uiBackground?.texture?.src||'')
  assert.ok(medalSources.some(src=>src.endsWith('/medal-bronze-earned.png')))
  assert.ok(medalSources.some(src=>src.endsWith('/medal-silver-earned.png')))
  assert.ok(medalSources.some(src=>src.endsWith('/medal-gold-locked.png')))
  const thresholds=walk(find(render(),'hud-medals')).filter(n=>String(n.props.key||'').startsWith('medal-threshold-'))
  assert.equal(thresholds.length,3)
  for(const caption of thresholds) {
    const digits=walk(caption).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png'))
    assert.equal(digits.length,3)
    assert.ok(Math.abs(digits[2].props.uiBackground.uvs[1])<1e-10,'seconds suffix comes from the third sprite row')
  }
  display.orbs=17;update(.06)
  assert.equal(walk(find(render(),'hud-orbs')).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/orb-icon.png')).length,10,'orb progress is capped at ten')
  display.orbs=-2;update(.06)
  assert.equal(walk(find(render(),'hud-orbs')).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/orb-icon.png')).length,0)
  display.orbs=3;update(.06)
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
  const portraitDigitUvs = () => walk(find(render(),'live-timer')).filter(n =>
    n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png')).map(n => n.props.uiBackground.uvs)
  const mobileDigits = portraitDigitUvs()
  assert.ok(walk(find(render(),'orb-progress-value')).some(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-gold.png')))
  assert.equal(mobileDigits.length, 8, 'portrait mobile shows the live timer digits')
  display.time = '13.34'; update(.06)
  assert.notDeepEqual(portraitDigitUvs(), mobileDigits, 'the timer updates as airtime advances')
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
  const slot = find(render(),'hud-milestone-slot').props.uiTransform.position
  const distance = p => Math.hypot(p.left-slot.left,p.top-slot.top)
  assert.ok(distance(moving)<distance(start),'award travels toward the slot below the orb card')
  for(let i=0;i<20;i++) update(.06)
  assert.ok(!walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/milestone-100.png')),
    'the milestone award fades instead of leaving a fixed badge behind')
  display.time='0.000'; update(.06)
  assert.ok(!walk(render()).some(n=>n.props.uiBackground?.texture?.src.endsWith('/streak.png')),
    'the obsolete fixed red streak plate is removed completely')
  display.time='0.000'; display.rewardCelebration++; update(.06)
  const celebration = () => walk(render()).filter(n=>n.props.key!=='hud-footer-logo')
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
