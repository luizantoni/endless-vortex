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
 './orb-reward':{ORB_REWARD:{every:5}},
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
  const { display, setupAirtimeUi, resultUsesGoldTheme } = mod.exports
  assert.equal(resultUsesGoldTheme({record:false,valid:true,provisional:true,recordKnown:false}),true,
    'a first score awaiting the server uses the blue and gold pending treatment')
  assert.equal(resultUsesGoldTheme({record:false,valid:true,provisional:true,recordKnown:true}),false)
  assert.equal(resultUsesGoldTheme({record:true,valid:true}),true)
  let rankSounds=0,recordSounds=0
  setupAirtimeUi({onRank:()=>rankSounds++,onNewRecord:()=>recordSounds++})
  assert.deepEqual(rendererOptions, { virtualWidth: 0, virtualHeight: 0, screenInset: 'none' },
    'pixel-positioned HUD opts out of SDK scaling and applies insets once')
  display.orbs = 3
  display.bestLoaded=true; display.best = '12.50'; display.state = 'Finished · floor pad · move to restart'
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
      if(key==='hud-airtime')assert.ok(Math.abs(title.position.top+title.height*.30)<.001,'airtime title overhang is exactly thirty percent')
      else {
        assert.ok(Math.abs(title.position.top+title.height*.3)<.001,'sphere title extends above the panel')
        assert.ok(title.width>p.width,'sphere title is wider than the panel')
      }
      assert.ok(Math.abs(title.position.left+title.width/2-p.width/2)<.001,'title is horizontally centered')
      assert.ok(p.position.top+title.position.top>=0,'title overhang remains on screen')
    }
    const orbTitle=find(orb,'hud-orbs-title').props.uiTransform
    assert.ok(orb.props.uiTransform.position.top+orbTitle.position.top<height*.08)
    assert.equal(find(orb,'orb-progress-value'),undefined,'orb panel has no numeric counter')
    const firstOrb=find(orb,'orb-tick-0').props.uiTransform,secondOrb=find(orb,'orb-tick-1').props.uiTransform
    assert.ok(firstOrb.position.left+firstOrb.width>secondOrb.position.left,'orb icons overlap')
    assert.equal(walk(orb).filter(n=>String(n.props.key||'').startsWith('orb-tick-')).length,5)
    if(width>=1000)assert.equal(firstOrb.width,48,'desktop spheres are larger')
    assert.ok(firstOrb.position.top>=orbTitle.position.top+orbTitle.height,'icons clear the new title')
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
    assert.equal(find(panel,'hud-medals'),undefined)
    assert.ok(find(panel,'hud-nearby').props.uiTransform.position.top>find(panel,'live-timer').props.uiTransform.position.top)
    assert.ok(walk(panel).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-airtime-special.png')))
    for(const word of ['nearby'])assert.ok(walk(panel).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-'+word+'-light.png')))
    assert.ok(walk(orb).some(n=>n.props.uiBackground?.texture?.src.endsWith('/heading-teleporting-spheres.png')))
    const guidePlate=guide.children[0].props.uiTransform
    assert.equal(guidePlate.width,guide.props.uiTransform.width*.575,'guide artwork is fifteen percent larger than the half-size version')
    assert.ok(Math.abs(guidePlate.height-25.3)<.001,'guide artwork height increases by fifteen percent')
    assert.equal(guide.props.uiTransform.height,44,'the tap target remains usable')
    for(const row of walk(panel).filter(n=>String(n.props.key||'').startsWith('leader-'))) {
      const id=row.props.key.slice(7), portrait=find(row,'portrait-'+id), score=find(row,'score-'+id)
      const insignia=find(row,'rank-insignia-'+id), name=find(row,'player-name-'+id)
      assert.ok(insignia.props.uiBackground.texture.src.endsWith('/rank-10.png'),'nearby insignia follows airtime tier rather than list position')
      const crest=insignia.props.uiTransform, n=name.props.uiTransform
      assert.ok(crest.width>=48 && crest.width<=64,'rank insignia stays proportional to the avatar')
      assert.equal(n.position.left,score.props.uiTransform.position.left,'name and score share a left edge')
      assert.ok(portrait.props.uiTransform.position.top+portrait.props.uiTransform.height<=crest.position.top,'rank sits below the avatar')
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
    assert.equal(walk(orb).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/modular/vortex.png') && n.props.uiTransform.opacity===1).length,3)
    assert.equal(walk(orb).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/orb-slot-empty.png')).length,2)
    assert.ok(walk(panel).some(n=>n.props.uiText?.value==='BEST'))
    const bestDigits=walk(find(panel,'best-time-digits')).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png'))
    assert.equal(bestDigits.length,8,'best time uses blue sprites for every digit and separator')
    assert.ok(!walk(panel).some(n=>/BEST .*\d/.test(n.props.uiText?.value||'')),'best score has no native numeric text')
    assert.ok(!walk(panel).some(n=>n.props.key==='orb-progress-value'),'orbs are no longer nested in the timer')
    assert.ok(!walk(tree).some(n=>['AIRTIME','MEDALS','NEARBY','ORBS','FLIGHT GUIDE'].includes(n.props.uiText?.value)),'section labels use image lettering')
    assert.ok(!walk(tree).some(n=>/\/(panel|row)\.png$/.test(n.props.uiBackground?.texture?.src||'') && (n.props.uiBackground?.texture?.src||'').includes('/modular/')),'old ornate panel and strips are replaced')

  }
  display.touchControls = true
  for (const [width, height] of [[844,390], [390,844], [568,320], [320,480], [1280,720]]) {
    size = {width, height, screenInsetArea: {left: 20, right: 12, top: 8, bottom: 10}}
    update(.06)
    const tree = render(), panel = find(tree, 'hud-sidebar'), timer = find(tree, 'hud-airtime-card')
    const orbs = find(tree, 'hud-orbs'), logo = find(panel, 'hud-footer-logo')
    const tb = timer.props.uiTransform, pb = panel.props.uiTransform, ob = orbs.props.uiTransform
    assert.ok(Math.abs(tb.position.left + tb.width / 2 - (20 + (width - 32) / 2)) < .01,
      'mobile airtime is centered within the safe area')
    assert.ok(tb.position.top < 30, 'mobile airtime sits at the top')
    assert.ok(find(timer, 'live-timer') && find(timer, 'best-time-digits'), 'timer and best remain together')
    assert.equal(find(panel, 'live-timer'), undefined, 'leaderboard no longer contains the mobile timer')
    assert.equal(find(orbs, 'hud-orbs-title'), undefined, 'vertical mobile sphere counter has no title')
    assert.ok(ob.position.left - 20 < width * .1, 'mobile spheres sit on the left')
    const altitude=find(tree,'hud-altitude'),ab=altitude.props.uiTransform
    assert.equal(ab.position.left,32,'mobile altitude aligns to the safe left corner')
    assert.ok(ab.position.top+ab.height<=ob.position.top,'altitude clears the larger sphere column')
    assert.ok(ab.position.left+ab.width<=pb.position.left || ab.position.top+ab.height<=pb.position.top,'altitude clears the leaderboard')
    const first = find(orbs, 'orb-tick-0').props.uiTransform
    const availableHeight=height-18
    assert.ok(first.width>Math.min(42,availableHeight*.085)*1.2,'mobile sphere icons are noticeably larger')
    const last = find(orbs, 'orb-tick-4').props.uiTransform
    assert.equal(first.position.left, last.position.left)
    assert.ok(last.position.top > first.position.top, 'all five mobile spheres form a vertical column')
    assert.ok(logo.props.uiTransform.position.top + logo.props.uiTransform.height <= find(panel, 'hud-nearby').props.uiTransform.position.top,
      'mobile logo sits above the nearby leaderboard')
    assert.ok(pb.width < mod.exports.scoreHudLayout(width, height, size.screenInsetArea).width,
      'mobile leaderboard is smaller than the desktop layout')
    assert.ok(pb.position.left >= tb.position.left + tb.width || pb.position.top >= tb.position.top + tb.height,
      'mobile timer clears the leaderboard in either orientation')
    for (const bounds of [tb, pb, ob, ab]) {
      assert.ok(bounds.position.left >= 20 && bounds.position.top >= 8)
      assert.ok(bounds.position.left + bounds.width <= width - 12)
      assert.ok(bounds.position.top + bounds.height <= height - 10)
    }
  }
  display.touchControls = false
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
  assert.ok(!walk(render()).some(n=>/medal/.test(n.props.uiBackground?.texture?.src||'')),'no medal assets are rendered')
  display.orbs=17;update(.06)
  assert.equal(walk(find(render(),'hud-orbs')).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/modular/vortex.png') && n.props.uiTransform.opacity===1).length,5,'orb progress is capped at five')
  display.orbs=-2;update(.06)
  assert.equal(walk(find(render(),'hud-orbs')).filter(n=>n.props.uiBackground?.texture?.src.endsWith('/modular/vortex.png') && n.props.uiTransform.opacity===1).length,0)
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
  assert.equal(find(render(),'orb-progress-value'),undefined)
  assert.equal(mobileDigits.length, 8, 'portrait mobile shows the live timer digits')
  display.time = '13.34'; update(.06)
  assert.notDeepEqual(portraitDigitUvs(), mobileDigits, 'the timer updates as airtime advances')
  assert.ok(walk(render()).some(n => n.props.uiText?.value === 'AIRBORNE'))
  size = { width: 844, height: 390 }
  for(const seconds of [15,30,60,99]){
    display.time=String(seconds);update(.06)
    assert.equal(find(render(),'rank-achievement'),undefined,'removed medal thresholds produce no popup')
  }
  display.time='100.000';update(.06)
  assert.ok(find(render(),'rank-achievement'),'100 seconds triggers the matching rank')
  update(.12);assert.ok(find(render(),'rank-achievement'))
  for(let i=0;i<20;i++)update(.1)
  assert.equal(find(render(),'rank-achievement'),undefined,'rank award expires after two seconds')
  display.time='0.000';display.rewardTransition=true;update(.06)
  assert.equal(render().props.key,'reward-cinematic','reward camera has a clear screen')
  assert.equal(walk(render()).filter(n=>n.props.uiText || n.props.uiBackground).length,0,'no orb, number or HUD obscures the avatar')
  display.rewardTransition=false;update(.06)
  assert.ok(find(render(),'hud-orbs'),'HUD returns after the cinematic')
  const assertPlain = popup => {
    assert.ok(popup)
    assert.ok(!walk(popup).some(n=>n.props.uiBackground?.color || /frame|vignette/.test(n.props.uiBackground?.texture?.src||'')),
      'popups have no colored backgrounds or border artwork')
  }
  display.result={id:1,milliseconds:23456,record:false,valid:true,saved:true}
  for(const [width,height] of [[1280,720],[390,844],[568,320]]){
    size={width,height};display.result={...display.result,id:display.result.id+1};update(.06)
    const popup=find(render(),'flight-result'),bounds=popup.props.uiTransform
    for(const node of walk(popup)){const src=node.props.uiBackground?.texture?.src;if(src)assert.ok(fs.existsSync(src),'every result image is packaged')}
    assert.ok(bounds.position.left>=0 && bounds.position.top>=0 && bounds.position.left+bounds.width<=width && bounds.position.top+bounds.height<=height)
    assert.ok(walk(find(popup,'result-score')).some(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-red.png')))
    assert.equal(find(popup,'result-title').props.uiBackground.texture.src,'assets/ui/tutorial/heading-flight-result-red.png')
    assertPlain(popup)
    assert.equal(find(popup,'result-save'),undefined)
    assert.equal(find(popup,'result-retry'),undefined)
  }
  display.result={id:20,milliseconds:45678,record:true,valid:true,saved:false};update(.2)
  const recordPopup=find(render(),'flight-result')
  assert.equal(find(recordPopup,'result-title').props.uiBackground.texture.src,'assets/ui/tutorial/heading-flight-result-gold.png')
  assert.ok(walk(find(recordPopup,'result-score')).some(n=>n.props.uiBackground?.texture?.src.endsWith('/digits-blue.png')))
  assertPlain(recordPopup)
  assert.equal(find(recordPopup,'result-save'),undefined)
  display.result=undefined;display.flightStarted++;display.time='0.000';update(.06)
  assert.ok(find(render(),'flight-result'),'instant takeoff cannot swallow the central result')
  assert.ok(find(render(),'takeoff-vignette'))
  assert.ok(find(render(),'timer-reset-old'))
  assert.ok(find(render(),'timer-reset-glow'))
  assert.equal(find(render(),'live-timer').props.uiTransform.overflow,'hidden','animated digits stay within their counter')
  update(.15);assert.ok(find(render(),'timer-current-digits').props.uiTransform.opacity>0)
  assert.ok(find(render(),'flight-result'),'flight result remains visible after takeoff during its two-second window')
  assert.equal(display.time,'0.000','animation never modifies the actual score')
  for(let i=0;i<15;i++)update(.06)
  assert.equal(find(render(),'timer-reset-glow'),undefined)
  assert.equal(find(render(),'timer-reset-old'),undefined)
  assert.equal(find(render(),'takeoff-vignette'),undefined)
  assert.equal(find(render(),'timer-current-digits').props.uiTransform.opacity,1)
  update(.1);assert.equal(find(render(),'timer-reset-glow'),undefined,'normal airborne packets do not restart the effect')
  for(let i=0;i<60;i++)update(.06)
  assert.equal(find(render(),'flight-result'),undefined,'the result popup exits after its readable presentation window')
  display.state='Airborne';display.time='0.000';update(.1)
  const ranksBefore=rankSounds
  for(let tier=1;tier<=10;tier++){
    display.state='Airborne';display.time=String(tier*100);update(.1)
    const card=find(render(),'rank-achievement'),bounds=card.props.uiTransform
    assert.ok(Math.abs(bounds.position.left+bounds.width/2-size.width/2)<.01)
    assert.ok(Math.abs(bounds.position.top+bounds.height/2-size.height/2)<.01)
    assertPlain(card)
    assert.equal(find(card,'rank-achievement-emblem').props.uiBackground.texture.src,`assets/ui/ranks/rank-${tier}.png`)
    const splash=walk(card).filter(n=>String(n.props.key||'').startsWith('rank-splash-'))
    assert.equal(splash.length,28)
    assert.ok(splash.every(n=>n.props.uiBackground.texture.src===`assets/ui/ranks/rank-${tier}-orb.png`))
    assert.deepEqual(walk(card).filter(n=>n.props.uiText),[],'rank popup is artwork only')
    for(const node of walk(card)){const src=node.props.uiBackground?.texture?.src;if(src)assert.ok(fs.existsSync(src))}
    update(.12);assert.ok(find(render(),'rank-achievement'))
    for(let i=0;i<22;i++)update(.1)
    assert.equal(find(render(),'rank-achievement'),undefined)
  }
  assert.equal(rankSounds-ranksBefore,10,'one achievement sound per earned rank')
  display.time='1100';update(.1)
  assert.equal(rankSounds-ranksBefore,10,'max rank does not repeat at later hundreds')
  display.flightStarted++;display.time='0';update(.1);display.time='100';update(.1)
  assert.ok(find(render(),'rank-achievement'),'new runs can earn their ranks again')

  display.flightStarted++;display.time='0';update(.1);display.rewardTransition=true
  const soundsBeforeCut=rankSounds
  display.time='300';update(.1)
  assert.equal(rankSounds,soundsBeforeCut,'rank sounds wait until their popup can be shown')
  display.rewardTransition=false;update(.1)
  assert.equal(find(render(),'rank-achievement-emblem').props.uiBackground.texture.src,'assets/ui/ranks/rank-3.png','network jumps show the newest rank')
  assert.equal(rankSounds,soundsBeforeCut+1)

  const recordsBefore=recordSounds
  display.state='Finished · floor pad';display.resultEvent={id:90,milliseconds:60000,record:true,valid:true,saved:true};update(.1)
  assert.equal(find(render(),'rank-achievement'),undefined)
  assert.equal(recordSounds,recordsBefore+1)
  display.resultEvent={...display.resultEvent,id:91,presentationId:90,saved:false};update(.1)
  display.resultEvent={...display.resultEvent,saved:true};update(.1)
  assert.equal(recordSounds,recordsBefore+1,'server reconciliation and save updates never replay record audio')
  for(let i=0;i<22;i++)update(.1)
  assert.equal(find(render(),'flight-result'),undefined)
  assert.equal(find(render(),'rank-achievement'),undefined,'queued ranks do not resume after the final score')
  for(let i=0;i<25;i++)update(.1)
  assert.equal(find(render(),'rank-achievement'),undefined,'finished scores do not enqueue ranks again')
  const opacity=mod.exports.popupOpacity
  assert.equal(opacity(0),0)
  assert.ok(opacity(.1)>0 && opacity(.1)<1,'fade in is gradual')
  assert.equal(opacity(.3),1)
  assert.equal(opacity(1.5),1)
  assert.ok(opacity(1.85)>0 && opacity(1.85)<1,'fade out is gradual')
  assert.equal(opacity(2),0)
  const resultSample={id:91,milliseconds:60000,record:true,valid:true,saved:true}
  for(const age of [.1,.5,1.85]) {
    assert.equal(mod.exports.flightResultOverlay(1280,720,resultSample,age).props.uiTransform.opacity,opacity(age))
    assert.equal(mod.exports.rankAchievementOverlay(1280,720,1,age).props.uiTransform.opacity,opacity(age))
  }

  find(render(),'reopen').props.onMouseDown();update(.1)
  display.resultEvent={id:99,milliseconds:12345,record:false,valid:true,saved:false,provisional:true};update(.1)
  assert.ok(find(render(),'flight-result'),'the central result is visible even when the flight guide is open')

})
