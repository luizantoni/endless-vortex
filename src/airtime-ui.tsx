import { ORB_REWARD } from './orb-reward'
import { FlightPopup } from './flight-feedback'
export type { FlightPopup } from './flight-feedback'
import ReactEcs, { ReactEcsRenderer, UiEntity, UiTransformProps } from '@dcl/sdk/react-ecs'
import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { createFlightTutorial } from './tutorial'
import { flightRankTier } from './flight-ranks'

export type LeaderRow = { rank: number; userId: string; name: string; airtime: string; phase: string; approximate?: boolean }
export const display = {
  time: '0.000', best: '0.000', bestLoaded: false, state: 'Jump into the wind',
  orbs: 0, flightStarted: 0, result: undefined as FlightPopup | undefined, resultEvent: undefined as FlightPopup | undefined, persistentBoard: false,
  rows: [] as LeaderRow[], storage: 'Session records only',
  energy: 0, altitude: '0.0', altitudeMeters: 0,
  touchControls: false, localUser: '', rewardCelebration: 0, rewardTransition: false
}
export const POPUP_DURATION = 2
export function popupOpacity(age: number) {
  const progress = Math.max(0, Math.min(1, age / .2, (POPUP_DURATION - age) / .3))
  return progress * progress * (3 - 2 * progress)
}
const ROOT = 'assets/ui/modular/'
const gold = Color4.create(1, .79, .3, 1), cyan = Color4.create(.38, .94, 1, 1)
const white = Color4.create(1, .96, .82, 1), dim = Color4.create(.58, .79, .89, 1)
const box = (x: number, y: number, w: number, h: number): UiTransformProps => ({
  positionType: 'absolute', position: { left: x, top: y }, width: w, height: h,
  pointerFilter: 'none', flexShrink: 0
})
const label = (value: string, size: number, color = white, align: 'middle-left' | 'middle-center' | 'middle-right' = 'middle-center',
  wrap: 'nowrap' | 'wrap' = 'nowrap') => ({
  value, fontSize: Math.max(11, size), color, font: 'serif' as const,
  textWrap: wrap, textAlign: align
})
function uv(cell: number, cols: number, rows: number) {
  const l = cell % cols / cols, r = l + 1 / cols
  const t = 1 - Math.floor(cell / cols) / rows, b = t - 1 / rows
  return [l, b, l, t, r, t, r, b]
}
function glyphUv(char: string) {
  const coords = uv(char === '.' ? 10 : char === ':' ? 11 : char === '/' ? 12 : char === 's' ? 13 : Number(char), 6, 3)
  if (char === '.' || char === ':') {
    coords[0] += .26 / 6; coords[2] += .26 / 6
    coords[4] -= .26 / 6; coords[6] -= .26 / 6
  }
  return coords
}
function art(name: string, bounds: UiTransformProps, opacity = 1, uvs?: number[]) {
  return <UiEntity uiTransform={{ ...bounds, opacity }} uiBackground={{ texture: {
    src: ROOT + name + '.png', filterMode: 'bi-linear', wrapMode: 'clamp'
  }, textureMode: 'stretch', uvs }} />
}
function tutorialArt(name: string, bounds: UiTransformProps) {
  return <UiEntity uiTransform={bounds} uiBackground={{ texture: {
    src: 'assets/ui/tutorial/' + name + '.png', filterMode: 'bi-linear', wrapMode: 'clamp'
  }, textureMode: 'stretch', ...(bounds.opacity === undefined ? {} : { color: Color4.create(1, 1, 1, Number(bounds.opacity)) }) }} />
}
function heading(name: 'altitude' | 'airtime' | 'nearby' | 'orbs', x: number, y: number, maxWidth: number, height: number) {
  const ratio = name === 'altitude' ? 920 / 180 : name === 'airtime' ? 800 / 180 : name === 'orbs' ? 2200 / 180 : 516 / 112
  const width = Math.min(maxWidth, height * ratio)
  return tutorialArt(name === 'altitude' ? 'heading-altitude-special' : name === 'airtime' ? 'heading-airtime-special' : name === 'orbs' ? 'heading-teleporting-spheres' : 'heading-' + name + '-light', box(x + (maxWidth - width) / 2, y + (height - width / ratio) / 2, width, width / ratio))
}
export function scoreHudLayout(W: number, H: number, inset?: { left: number; right: number; top: number; bottom: number }, touchControls = false) {
  const l = inset?.left || 0, t = inset?.top || 0
  const w = W - l - (inset?.right || 0), h = H - t - (inset?.bottom || 0)
  const portrait = w < h, dense = h < 400, short = (h < 640 && portrait) || h < 500, compact = h < 560 || portrait
  const width = portrait ? Math.min(208, w * .50) : Math.min(340, Math.max(190, w * .26))
  const sideX = l + w - width - 12
  const orbWidth = portrait ? Math.min(240, w * .50) : Math.min(340, w * .36, Math.max(120, 2 * (sideX - (l + w / 2) - 8)))
  const orbColumns = ORB_REWARD.every
  const orbGap = -7
  const orbSize = Math.min(48, (orbWidth - 32 - (orbColumns - 1) * orbGap) / orbColumns)
  const pad = dense ? 6 : short ? 8 : compact ? 10 : 12, gap = dense ? 3 : short ? 4 : compact ? 6 : 12
  const titleW = (width - pad * 2) * .94, titleH = titleW * 180 / 800
  const orbTitleW = orbWidth * 1.08, orbTitleH = orbTitleW * 180 / 2200
  const orbGridY = 10 + orbTitleH * .7
  const orbGridH = (ORB_REWARD.every / orbColumns) * orbSize + (ORB_REWARD.every / orbColumns - 1) * orbGap
  const orbHeight = orbGridY + orbGridH + 14
  const orbY = t + Math.max(12, orbTitleH * .3 + 6)
  const toolsClearance = h >= 560 ? 50 : 36
  const x = l + w - width - 12
  const y = portrait ? orbY + orbHeight + 10 + titleH * .30 : t + 12 + toolsClearance
  const timerH = dense ? 26 : short ? 28 : compact ? 46 : 64
  const bestH = short ? 12 : compact ? 16 : 18, stateH = h >= 640 ? 16 : 0
  const timerY = pad + titleH * .70, bestY = timerY + timerH, stateY = bestY + bestH
  const nearbyY = stateY + stateH + 4 + gap, nearbyTitleH = dense ? 18 : short ? 20 : compact ? 24 : 28
  const rowsY = nearbyY + nearbyTitleH, rowH = 80
  const altitudeWidth = Math.min(420, Math.max(260, w * .30), w - 24)
  const altitudeHeight = h < 500 ? 52 : 60
  const altitudeX = l + w - altitudeWidth - 12, altitudeY = t + h - altitudeHeight - 12
  const altitudeOverhang = (h < 500 ? 26 : 34) * 1.25 * .20
  const sidebarBottom = portrait ? t + h * .92 : Math.min(t + h * .92, altitudeY - altitudeOverhang - (h < 360 ? 2 : 6))
  const footerGap = dense ? 0 : gap
  const interactiveHeight = rowsY + gap + 44 + pad
  const availableForRows = Math.min(t + h * .74 - y - interactiveHeight, sidebarBottom - y - (rowsY + gap + 44 + footerGap + 10))
  const reserveRow = availableForRows >= rowH ? rowH : 0
  const footerSpace = Math.max(10, sidebarBottom - y - (rowsY + gap + 44 + footerGap) - reserveRow)
  const footerLogoW = Math.min(360, width * 1.06, footerSpace * 2145 / 733)
  const footerLogoH = footerLogoW * 733 / 2145
  const fixedHeight = rowsY + gap + 44 + footerGap + footerLogoH
  const rowSpace = Math.min(t + h * .74 - y - interactiveHeight, sidebarBottom - y - fixedHeight)
  const maxRows = Math.max(0, Math.min(portrait ? 3 : 5, Math.floor(rowSpace / rowH)))
  const desktop = { x, y, width, pad, gap, titleW, titleH, timerY, timerH, bestY, bestH, stateY, stateH,
    nearbyY, nearbyTitleH, rowsY, rowH, fixedHeight, maxRows, footerLogoW, footerLogoH, footerGap, altitudeWidth, altitudeHeight, altitudeX, altitudeY,
    orbX: l + (w - orbWidth) / 2, orbY, orbWidth, orbHeight, orbColumns, orbTitleW, orbTitleH, orbGap, orbSize, orbGridY, compact, portrait }
  if (!touchControls) return { ...desktop, mobile: false, airtimeX: 0, airtimeY: 0, airtimeWidth: width, airtimeHeight: stateY + stateH }
  const mobileWidth = Math.min(280, Math.max(170, w * .22), w * .44)
  const airtimeWidth = Math.min(240, w * (portrait ? .44 : .30))
  const mobileTitleH = airtimeWidth * .88 * 180 / 800
  const mobileTimerY = mobileTitleH * .72 + 6, mobileTimerH = h < 400 ? 30 : 38
  const mobileBestY = mobileTimerY + mobileTimerH, mobileStateY = mobileBestY + 14
  const airtimeHeight = mobileStateY + 14 + 6
  const logoW = mobileWidth * 1.02, logoH = logoW * 733 / 2145
  const mobileNearbyY = logoH + 6, mobileRowsY = mobileNearbyY + 22
  const mobileY = t + (portrait ? airtimeHeight + 30 : 18)
  const mobileRowH = 68
  const mobileMaxRows = Math.max(0, Math.min(3, Math.floor((t + h * .72 - mobileY - mobileRowsY - 48) / mobileRowH)))
  const mobileAltitudeWidth = Math.min(260,Math.max(180,w*.27),w-mobileWidth-32)
  const mobileAltitudeHeight = 76
  const mobileAltitudeY = portrait ? t+18+airtimeHeight+16 : t+18
  const mobileOrbSize = Math.min(58,h*.12,w*.18)
  const mobileOrbH = ORB_REWARD.every * mobileOrbSize - (ORB_REWARD.every - 1) * 5
  return { ...desktop, mobile: true, x: l + w - mobileWidth - 12, y: mobileY, width: mobileWidth,
    pad: 8, gap: 4, rowH: mobileRowH, maxRows: mobileMaxRows,
    titleW: airtimeWidth * .88, titleH: mobileTitleH, timerY: mobileTimerY, timerH: mobileTimerH,
    bestY: mobileBestY, bestH: 14, stateY: mobileStateY, stateH: 14,
    nearbyY: mobileNearbyY, nearbyTitleH: 22, rowsY: mobileRowsY,
    footerLogoW: logoW, footerLogoH: logoH, footerGap: 0,
    airtimeX: l + (w - airtimeWidth) / 2, airtimeY: t + 18, airtimeWidth, airtimeHeight,
    altitudeX: l+12, altitudeY: mobileAltitudeY, altitudeWidth: mobileAltitudeWidth, altitudeHeight: mobileAltitudeHeight,
    orbX: l + 12, orbY: Math.max(t+90,t+(h-mobileOrbH)/2,mobileAltitudeY+mobileAltitudeHeight+12), orbWidth: mobileOrbSize,
    orbHeight: mobileOrbH, orbColumns: 1, orbSize: mobileOrbSize, orbGap: -5, orbGridY: 0 }
}

export function formatAirtime(value: string | number, hundredths = true) {
  const seconds = Math.max(0, Number.parseFloat(String(value)) || 0)
  const units = hundredths ? Math.round(seconds * 100) : Math.floor(seconds) * 100
  const minutes = String(Math.floor(units / 6000)).padStart(2, '0')
  const remainder = String(Math.floor(units / 100) % 60).padStart(2, '0')
  return minutes + ':' + remainder + (hundredths ? '.' + String(units % 100).padStart(2, '0') : '')
}

function numbers(value: string, height: number, maxWidth: number, align: 'middle-left' | 'middle-center' | 'middle-right' = 'middle-center', palette: 'blue' | 'gold' | 'red' = 'blue') {
  const chars = value.split('').filter(c => '0123456789.:/s'.includes(c)).slice(0, 10)
  const advance = (c: string) => c === '.' || c === ':' ? .24 : c === '/' ? .32 : c === 's' ? .4 : .7
  height = Math.min(height, maxWidth / Math.max(1, chars.reduce((sum, c) => sum + advance(c), 0)))
  return <UiEntity uiTransform={{ width: '100%', height, flexDirection: 'row', alignItems: 'center',
    justifyContent: align === 'middle-right' ? 'flex-end' : align === 'middle-left' ? 'flex-start' : 'center', pointerFilter: 'none' }}>
    {chars.map((char, i) => <UiEntity key={'digit-' + i} uiTransform={{
      width: height * advance(char), height, flexShrink: 0, pointerFilter: 'none'
    }} uiBackground={{ texture: { src: 'assets/ui/tutorial/digits-' + palette + '.png', filterMode: 'bi-linear', wrapMode: 'clamp' },
      textureMode: 'stretch', uvs: glyphUv(char) }} />)}
  </UiEntity>
}
function altitudeGauge(value: number, width: number, height: number) {
  const fill = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0
  return <UiEntity key="altitude-bar" uiTransform={box(0, 0, width, height)}>
    {tutorialArt('altitude-track', box(0, 0, width, height))}
    {fill > 0 && <UiEntity key="altitude-fill" uiTransform={box(2, 2, (width - 4) * fill, height - 4)}>
      {tutorialArt('altitude-fill', box(0, 0, (width - 4) * fill, height - 4))}
    </UiEntity>}
  </UiEntity>
}

function lowAltitudeVignette(width: number, height: number, opacity: number) {
  return <UiEntity uiTransform={{ ...box(0, 0, width, height), opacity }}
    uiBackground={{ texture: { src: ROOT + 'low-altitude-vignette.png',
      filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
}

export function flightResultOverlay(W: number, H: number, result: FlightPopup, age: number) {
  if (age < 0 || age >= POPUP_DURATION) return null
  const width=Math.min(500,W-32),height=Math.min(180,H-32)
  const goldTheme=resultUsesGoldTheme(result)
  const titleHeight=Math.min(86,height*.48),titleWidth=Math.min(width,titleHeight*2170/435)
  const scoreY=titleHeight+8
  return <UiEntity key="flight-result" uiTransform={{...box((W-width)/2,(H-height)/2,width,height),opacity:popupOpacity(age)}}>
    <UiEntity key="result-title" uiTransform={box((width-titleWidth)/2,0,titleWidth,titleWidth*435/2170)}
      uiBackground={{ texture: { src: 'assets/ui/tutorial/heading-flight-result-'+(goldTheme?'gold':'red')+'.png',
        filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch',
        // Trim the transparent vertical padding while preserving the lettering's proportions.
        uvs: [0,.2,0,.8,1,.8,1,.2] }} />
    <UiEntity key="result-score" uiTransform={box(0,scoreY,width,height-scoreY)}>
      {numbers(formatAirtime(result.milliseconds/1000),Math.min(80,height-scoreY),width,'middle-center',goldTheme?'blue':'red')}
    </UiEntity>
  </UiEntity>
}

export function resultUsesGoldTheme(result: FlightPopup): boolean {
  return result.valid && (result.record || (result.provisional===true && result.recordKnown===false))
}

export function rankAchievementOverlay(W:number,H:number,tier:number,age:number) {
  if (tier<1 || tier>10 || age<0 || age>=POPUP_DURATION) return null
  const width=Math.min(480,W-32),height=Math.min(300,H-32)
  const centerX=width/2,centerY=height/2,emblemW=Math.min(width*.82,height*1.5),emblemH=emblemW/2
  const progress=Math.min(1,age/1.5)
  return <UiEntity key="rank-achievement" uiTransform={{...box((W-width)/2,(H-height)/2,width,height),opacity:popupOpacity(age)}}>
    {Array.from({length:28},(_,i)=>{
      const angle=i*2.399963,spread=(.22+.28*progress)*(1+(i%4)*.055)
      const size=(12+(i%4)*3)*(1-.45*progress)
      const x=centerX+Math.cos(angle)*width*spread-size/2
      const y=centerY+Math.sin(angle)*height*spread-age*12-size/2
      return <UiEntity key={'rank-splash-'+i} uiTransform={{...box(x,y,size,size),opacity:Math.max(0,1-age/POPUP_DURATION)}}
        uiBackground={{texture:{src:`assets/ui/ranks/rank-${tier}-orb.png`,filterMode:'bi-linear',wrapMode:'clamp'},textureMode:'stretch'}} />
    })}
    <UiEntity key="rank-achievement-emblem" uiTransform={box(centerX-emblemW/2,centerY-emblemH/2,emblemW,emblemH)}
      uiBackground={{texture:{src:`assets/ui/ranks/rank-${tier}.png`,filterMode:'bi-linear',wrapMode:'clamp'},textureMode:'stretch'}} />
  </UiEntity>
}

export function setupAirtimeUi(options: { onUiClick?: () => void; onRank?: (tier: number) => void; onNewRecord?: () => void } = {}) {
  const tutorial = createFlightTutorial(options.onUiClick)
  let clock = 0, nextTick = 0, tick = 0
  let resultId = 0, resultStart = -10,shownResult:FlightPopup|undefined
  let recordSoundPlayed = false
  let rankSeen=0,pendingRank=-1,rankTier=-1,rankAge=0,previousSeconds=0
  let flightStarted=display.flightStarted,resetStart=-10,resetFrom=display.time,lastTime=display.time
  let cached: ReactEcs.JSX.Element | undefined, cachedTick = -1
  engine.addSystem(dt => {
    if (!Number.isFinite(dt) || dt <= 0) return
    if (dt > .5) { rankTier=-1; tick++; return }
    tutorial.update(dt)
    clock += dt
    if(display.flightStarted!==flightStarted){
      flightStarted=display.flightStarted;resetStart=clock;resetFrom=lastTime
      rankSeen=0;pendingRank=-1;rankTier=-1
    }
    lastTime=display.time
    const event=display.resultEvent||display.result
    if(event){
      const id=event.presentationId??event.id
      if(id!==resultId){resultId=id;resultStart=clock;recordSoundPlayed=false}
      if(event.valid && event.record && !recordSoundPlayed){
        recordSoundPlayed=true
        options.onNewRecord?.()
      }
      shownResult=event
    }
    const resultActive=!!shownResult&&clock-resultStart<POPUP_DURATION
    const seconds=Number(display.time)||0
    if(seconds<previousSeconds-.5){rankSeen=0;pendingRank=-1;rankTier=-1}
    previousSeconds=seconds
    const tier=flightRankTier(seconds)
    // Final results consume current progression, so no celebration reappears afterward.
    if(resultActive){pendingRank=-1;rankTier=-1;rankSeen=Math.max(rankSeen,tier)}
    if(!resultActive && /^(Airborne|Paused)/.test(display.state) && tier>rankSeen){
      rankSeen=tier;pendingRank=tier
    }
    if(rankTier>=0){rankAge+=dt;if(rankAge>=POPUP_DURATION)rankTier=-1}
    if(!resultActive && !display.rewardTransition && rankTier<0 && pendingRank>=0){
      rankTier=pendingRank;pendingRank=-1;rankAge=0;options.onRank?.(rankTier)
    }
    if (clock < nextTick) return
    nextTick = clock + .05; tick++

  })
  // This HUD derives every position from UiCanvasInformation pixel dimensions
  // and applies the device insets itself. Disable SDK virtual scaling and its
  // automatic safe-area wrapper to prevent the whole interface shifting/scaling twice.
  ReactEcsRenderer.setUiRenderer(() => {
    if (cached && cachedTick === tick) return cached
    cachedTick = tick
    const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
    const W = canvas?.width || 1280, H = canvas?.height || 720, inset = canvas?.screenInsetArea
    const l = inset?.left || 0, t = inset?.top || 0
    const w = W - l - (inset?.right || 0), h = H - t - (inset?.bottom || 0)
    const resultActive=!!shownResult&&clock-resultStart<POPUP_DURATION
    if (display.rewardTransition) {
      cached = <UiEntity key="reward-cinematic" uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}} />
      return cached
    }
    if (tutorial.isOpen) {
      cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
        {tutorial.render(W, H, inset, display.touchControls)}
        {resultActive && flightResultOverlay(W,H,shownResult!,clock-resultStart)}
        {!resultActive && rankTier>=0 && rankAchievementOverlay(W,H,rankTier,rankAge)}
      </UiEntity>
      return cached
    }
    const lowAltitudeWarning = display.state === 'Airborne' &&
      (Number(display.time) || 0) >= 10 && display.altitudeMeters < .4
    const vignetteOpacity = .68 + .16 * ((Math.sin(clock * 5) + 1) / 2)
    const layout = scoreHudLayout(W, H, inset, display.touchControls)
    const { x: px, y: py, width: pw, pad, gap, rowH, compact, portrait } = layout
    const s = Math.min(1, w / 1280, h / 720), sec = Number(display.time) || 0
    const leaders = display.rows.slice(0, layout.maxRows)
    const localRow = display.rows.find(row => row.userId === display.localUser)
    if (localRow && leaders.length && !leaders.some(row => row.userId === localRow.userId)) {
      leaders[leaders.length - 1] = localRow
      leaders.sort((a, b) => a.rank - b.rank)
    }
    const rowCount = Math.max(leaders.length, layout.maxRows > 0 ? 1 : 0)
    const guideY = layout.rowsY + rowCount * rowH + gap
    const footerY = layout.mobile ? 0 : guideY + 44 + layout.footerGap
    const panelH = layout.mobile ? guideY + 44 + pad : footerY + layout.footerLogoH * .70
    const state = display.state === 'Airborne' ? 'AIRBORNE' : /Finished|Interrupted/.test(display.state) ? 'FINISHED' : /Paused/.test(display.state) ? 'PAUSED' : 'READY'
    const orbCount = Math.max(0, Math.min(ORB_REWARD.every, display.orbs))
    const { orbX, orbY, orbWidth: ow, orbHeight: oh, orbColumns } = layout
    const { orbSize, orbGap, orbGridY } = layout
    const orbGridW = orbColumns * orbSize + (orbColumns - 1) * orbGap
    const mw = layout.altitudeWidth, mh = layout.altitudeHeight, mx = layout.altitudeX, my = layout.altitudeY
    const altitudeDigitsH = layout.mobile || h < 500 ? 20 : 26
    const altitudeValue = Number.parseFloat(display.altitude)
    const altitudeText = Math.max(0, Number.isFinite(altitudeValue) ? altitudeValue : 0).toFixed(1)
    const altitudeDigitsW = Math.min(mw * .70, altitudeDigitsH * altitudeText.split('').reduce((sum, c) => sum + (c === '.' ? .24 : .7), 0))
    const altitudeValueX = layout.mobile ? (mw-altitudeDigitsW-18)/2 : mw-altitudeDigitsW-30
    const altitudeTitleW = layout.mobile ? Math.min(mw-16,160) : Math.min(mw * .68, (h < 500 ? 26 : 34) * 1.25 * 920 / 180, altitudeValueX - 24)
    const altitudeTitleH = altitudeTitleW * 180 / 920
    const altitudeScoreY = layout.mobile ? altitudeTitleH+6 : 4
    const aw = layout.airtimeWidth
    const airtimeCard = <UiEntity key="hud-airtime-card" uiTransform={box(layout.mobile ? layout.airtimeX : 0, layout.mobile ? layout.airtimeY : 0, aw, layout.airtimeHeight)}>
      {layout.mobile && tutorialArt('hud-orbs', { ...box(0, 0, aw, layout.airtimeHeight), opacity: .8 })}
        <UiEntity key="hud-airtime" uiTransform={box((aw - layout.titleW) / 2, -layout.titleH * .30, layout.titleW, layout.titleH)}>
          {heading('airtime', 0, 0, layout.titleW, layout.titleH)}
        </UiEntity>
        <UiEntity key="live-timer" uiTransform={{...box(pad, layout.timerY, aw - pad * 2, layout.timerH),overflow:'hidden'}}>
          {(() => {
            const age=clock-resetStart,active=age>=0&&age<.65,p=Math.min(1,Math.max(0,age/.45))
            const ease=1-Math.pow(1-p,3),width=aw-pad*2
            return <UiEntity uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}}>
              {active && <UiEntity key="timer-reset-glow" uiTransform={{...box(0,0,width,layout.timerH),opacity:1-age/.65}}>
                {tutorialArt('timer-reset-glow',box(0,0,width,layout.timerH))}
              </UiEntity>}
              {active && age<.22 && <UiEntity key="timer-reset-old" uiTransform={{...box(0,-layout.timerH*.35*(age/.22),width,layout.timerH),opacity:1-age/.22}}>
                {numbers(formatAirtime(resetFrom),layout.timerH*.94,width)}
              </UiEntity>}
              <UiEntity key="timer-current-digits" uiTransform={{...box(0,active?layout.timerH*.3*(1-ease):0,width,layout.timerH),opacity:active?Math.min(1,age/.18):1}}>
                {numbers(formatAirtime(sec),layout.timerH*.94,width)}
              </UiEntity>
              {active && <UiEntity key="timer-reset-sweep" uiTransform={{...box(0,layout.timerH-2,width*ease,2),opacity:1-age/.65}} uiBackground={{color:gold}} />}
            </UiEntity>
          })()}
        </UiEntity>
        <UiEntity key="best-time" uiTransform={box(pad, layout.bestY, aw - pad * 2, layout.bestH)}>
          <UiEntity uiTransform={box((aw - pad * 2 - (32 + layout.bestH * 4.8)) / 2, 0, 30, layout.bestH)}
            uiText={label('BEST', compact ? 11 : 13, cyan)} />
          <UiEntity key="best-time-digits" uiTransform={box((aw - pad * 2 - (32 + layout.bestH * 4.8)) / 2 + 32, 0, layout.bestH * 4.8, layout.bestH)}>
            {display.bestLoaded ? numbers(formatAirtime(display.best), layout.bestH * .94, layout.bestH * 4.8) : <UiEntity uiTransform={{width:'100%',height:'100%'}} uiText={{...label('LOADING',11,dim),font:'sans-serif'}} />}
          </UiEntity>
        </UiEntity>
        {layout.stateH > 0 && <UiEntity uiTransform={box(pad, layout.stateY, aw - pad * 2, layout.stateH)}
          uiText={label(!display.bestLoaded?'RECORDS LOADING':display.storage.includes('SAVING')?'SAVING RECORD':state,11,!display.bestLoaded?gold:state==='AIRBORNE'?cyan:dim)} />}
    </UiEntity>
    cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
      {lowAltitudeWarning && lowAltitudeVignette(W, H, vignetteOpacity)}
      {layout.mobile && airtimeCard}
      <UiEntity key="hud-orbs" uiTransform={box(orbX, orbY, ow, oh)}>
        {!layout.mobile && tutorialArt('hud-orbs', {...box(0, 0, ow, oh), opacity: .8})}
        {!layout.mobile && <UiEntity key="hud-orbs-title" uiTransform={box((ow - layout.orbTitleW) / 2, -layout.orbTitleH * .3, layout.orbTitleW, layout.orbTitleH)}>
          {heading('orbs', 0, 0, layout.orbTitleW, layout.orbTitleH)}
        </UiEntity>}
        {Array.from({ length: ORB_REWARD.every }, (_, i) => {
          const x = (ow - orbGridW) / 2 + (i % orbColumns) * (orbSize + orbGap)
          const y = orbGridY + Math.floor(i / orbColumns) * (orbSize + orbGap)
          return <UiEntity key={'orb-tick-' + i} uiTransform={box(x, y, orbSize, orbSize)}>
            {i < orbCount ? art('vortex', box(0, 0, orbSize, orbSize)) : tutorialArt('orb-slot-empty', box(0, 0, orbSize, orbSize))}
          </UiEntity>
        })}
      </UiEntity>
      <UiEntity key="hud-sidebar" uiTransform={box(px, py, pw, panelH)}>
        {tutorialArt('hud-panel', {...box(0, 0, pw, panelH), opacity: .8})}
        {!layout.mobile && airtimeCard}
        <UiEntity key="hud-nearby" uiTransform={box(pad, layout.nearbyY, pw - pad * 2, layout.nearbyTitleH)}>
          {heading('nearby', 0, 0, pw - pad * 2, layout.nearbyTitleH)}
        </UiEntity>

        {leaders.map((row, i) => {
          const innerW = pw - pad * 2, narrow = pw < 260
          const rankW = narrow ? 48 : 64, rankH = rankW / 2
          const portraitSize = narrow ? 32 : 40, identityW = rankW + 8
          const portraitX = (identityW - portraitSize) / 2, portraitY = 6
          const rankX = (identityW - rankW) / 2, rankY = portraitY + portraitSize + 2
          const nameX = identityW + 10, nameY = 10, nameH = 20
          const nameW = Math.max(20, innerW - nameX - 10)
          const scoreX = nameX, scoreY = 36, scoreW = nameW
          const scoreH = Math.min(narrow ? 24 : 28, scoreW / 3.04)
          const fontSize = narrow ? 12 : 15, maxName = Math.max(3, Math.min(20, Math.floor(nameW / (fontSize * .66))))
          const playerName = (row.approximate ? '~' : '') + row.name
          const fittedName = playerName.length > maxName ? playerName.slice(0, maxName - 1) + '…' : playerName
          const tier = flightRankTier(row.airtime)
          return <UiEntity key={'leader-' + row.userId} uiTransform={box(pad, layout.rowsY + i * rowH, innerW, rowH)}>
            {tutorialArt('goal', {...box(0, 1, innerW, rowH - 2), opacity: .42})}
            <UiEntity key={'portrait-' + row.userId} uiTransform={box(portraitX + 2, portraitY + 2, portraitSize - 4, portraitSize - 4)}
              uiBackground={{ avatarTexture: { userId: row.userId, filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
            {tutorialArt('portrait-frame', box(portraitX, portraitY, portraitSize, portraitSize))}
            <UiEntity key={'rank-insignia-' + row.userId} uiTransform={box(rankX, rankY, rankW, rankH)}
              uiBackground={{ texture: { src: `assets/ui/ranks/rank-${tier}.png`, filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
            <UiEntity key={'player-name-' + row.userId} uiTransform={box(nameX, nameY, nameW, nameH)}
              uiText={label(fittedName, fontSize, row.userId === display.localUser ? gold : white, 'middle-left', 'nowrap')} />
            <UiEntity key={'score-' + row.userId} uiTransform={box(scoreX, scoreY, scoreW, scoreH)}>
              {numbers(formatAirtime(parseFloat(row.airtime) || 0, false), scoreH, scoreW, 'middle-left')}
            </UiEntity>
          </UiEntity>
        })}

        {!leaders.length && rowCount > 0 && <UiEntity uiTransform={box(pad, layout.rowsY, pw - pad * 2, rowH)} uiText={label('EMPTY', 11, dim)} />}
        {tutorial.render(W, H, inset, display.touchControls, box(pad, guideY, pw - pad * 2, 44))}
        <UiEntity key="hud-footer-logo" uiTransform={box((pw - layout.footerLogoW) / 2, footerY, layout.footerLogoW, layout.footerLogoH)}
          uiBackground={{ texture: { src: 'assets/ui/endless-vortex-logo.png', filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
      </UiEntity>
      {(layout.mobile || !portrait) && <UiEntity key="hud-altitude" uiTransform={box(mx, my, mw, mh)}>
        {tutorialArt('hud-altitude', {...box(0, 0, mw, mh), opacity: .8})}
        <UiEntity key="altitude-title" uiTransform={box(layout.mobile ? (mw-altitudeTitleW)/2 : 12, layout.mobile ? 0 : -altitudeTitleH*.20, altitudeTitleW, altitudeTitleH)}>
          {heading('altitude', 0, 0, altitudeTitleW, altitudeTitleH)}
        </UiEntity>
        <UiEntity key="altitude-value" uiTransform={box(altitudeValueX, altitudeScoreY, altitudeDigitsW, altitudeDigitsH)}>
          {numbers(altitudeText, altitudeDigitsH, altitudeDigitsW)}
        </UiEntity>
        <UiEntity uiTransform={box(altitudeValueX + altitudeDigitsW + 4, altitudeScoreY, 14, altitudeDigitsH)}
          uiText={label('m', 13, cyan, 'middle-left')} />
        <UiEntity uiTransform={box(12, mh-(layout.mobile ? 16 : 22), mw-24, layout.mobile ? 10 : 16)}>
          {altitudeGauge(display.energy, mw-24, layout.mobile ? 10 : 16)}
        </UiEntity>
      </UiEntity>}
      {clock-resetStart>=0 && clock-resetStart<.7 && <UiEntity key="takeoff-vignette"
        uiTransform={{...box(0,0,W,H),opacity:Math.pow(1-(clock-resetStart)/.7,2)*.6}}>
        {tutorialArt('result-vignette-record',box(0,0,W,H))}
      </UiEntity>}
      {!resultActive && rankTier>=0 && rankAchievementOverlay(W,H,rankTier,rankAge)}
      {resultActive && flightResultOverlay(W,H,shownResult!,clock-resultStart)}
    </UiEntity>
    return cached
  }, { virtualWidth: 0, virtualHeight: 0, screenInset: 'none' })
}
