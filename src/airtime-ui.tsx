import ReactEcs, { ReactEcsRenderer, UiEntity, UiTransformProps } from '@dcl/sdk/react-ecs'
import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { createFlightTutorial } from './tutorial'
import { flightRankTier } from './flight-ranks'

export type LeaderRow = { rank: number; userId: string; name: string; airtime: string; phase: string; approximate?: boolean }
export const display = {
  time: '0.000', best: '0.000', state: 'Jump into the wind',
  orbs: 0,
  rows: [] as LeaderRow[], storage: 'Session records only',
  energy: 0, altitude: '0.0', altitudeMeters: 0,
  touchControls: false, localUser: '', medals: 'No medals yet', rewardCelebration: 0
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
  }, textureMode: 'stretch' }} />
}
function heading(name: 'altitude' | 'airtime' | 'medals' | 'nearby' | 'orbs', x: number, y: number, maxWidth: number, height: number) {
  const ratio = name === 'altitude' ? 920 / 180 : name === 'airtime' ? 800 / 180 : name === 'orbs' ? 540 / 180 : 516 / 112
  const width = Math.min(maxWidth, height * ratio)
  return tutorialArt(name === 'altitude' ? 'heading-altitude-special' : name === 'airtime' ? 'heading-airtime-special' : name === 'orbs' ? 'heading-orbs-special' : 'heading-' + name + '-light', box(x + (maxWidth - width) / 2, y + (height - width / ratio) / 2, width, width / ratio))
}
export function scoreHudLayout(W: number, H: number, inset?: { left: number; right: number; top: number; bottom: number }) {
  const l = inset?.left || 0, t = inset?.top || 0
  const w = W - l - (inset?.right || 0), h = H - t - (inset?.bottom || 0)
  const portrait = w < h, dense = h < 400, short = (h < 640 && portrait) || h < 500, compact = h < 560 || portrait
  const width = portrait ? Math.min(208, w * .50) : Math.min(340, Math.max(190, w * .26))
  const sideX = l + w - width - 12
  const orbWidth = portrait ? Math.min(240, w * .50) : Math.min(340, w * .36, Math.max(120, 2 * (sideX - (l + w / 2) - 8)))
  const orbColumns = orbWidth >= 280 ? 10 : 5
  const orbHeight = h < 560 ? (orbColumns === 10 ? 104 : 120) : orbColumns === 10 ? 128 : 148
  const pad = dense ? 6 : short ? 8 : compact ? 10 : 12, gap = dense ? 3 : short ? 4 : compact ? 6 : 12
  const titleW = (width - pad * 2) * .94, titleH = titleW * 180 / 800
  const orbTitleW = Math.min(orbWidth * .80, h < 560 ? 190 : 250), orbTitleH = orbTitleW * 180 / 540
  const orbY = t + Math.max(12, orbTitleH * .30 + 8)
  const toolsClearance = h >= 560 ? 50 : 36
  const x = l + w - width - 12
  const y = portrait ? orbY + orbHeight + 10 + titleH * .30 : t + 12 + toolsClearance
  const timerH = dense ? 26 : short ? 28 : compact ? 46 : 64
  const bestH = short ? 12 : compact ? 16 : 18, stateH = h >= 640 ? 16 : 0
  const timerY = pad + titleH * .70, bestY = timerY + timerH, stateY = bestY + bestH
  const medalY = stateY + stateH + 4 + gap, medalTitleH = dense ? 16 : short ? 18 : 22, medalBodyH = dense ? 26 : short ? 30 : compact ? 50 : 60
  const nearbyY = medalY + medalTitleH + medalBodyH + gap, nearbyTitleH = dense ? 18 : short ? 20 : compact ? 24 : 28
  const rowsY = nearbyY + nearbyTitleH, rowH = width < 260 ? 100 : 72
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
  return { x, y, width, pad, gap, titleW, titleH, timerY, timerH, bestY, bestH, stateY, stateH,
    medalY, medalTitleH, medalBodyH, nearbyY, nearbyTitleH, rowsY, rowH, fixedHeight, maxRows, footerLogoW, footerLogoH, footerGap, altitudeWidth, altitudeHeight, altitudeX, altitudeY,
    orbX: l + (w - orbWidth) / 2, orbY, orbWidth, orbHeight, orbColumns, orbTitleW, orbTitleH, compact, portrait }
}

export function formatAirtime(value: string | number, hundredths = true) {
  const seconds = Math.max(0, Number.parseFloat(String(value)) || 0)
  const units = hundredths ? Math.round(seconds * 100) : Math.floor(seconds) * 100
  const minutes = String(Math.floor(units / 6000)).padStart(2, '0')
  const remainder = String(Math.floor(units / 100) % 60).padStart(2, '0')
  return minutes + ':' + remainder + (hundredths ? '.' + String(units % 100).padStart(2, '0') : '')
}

function numbers(value: string, height: number, maxWidth: number, align: 'middle-center' | 'middle-right' = 'middle-center', palette: 'blue' | 'gold' = 'blue') {
  const chars = value.split('').filter(c => '0123456789.:/s'.includes(c)).slice(0, 10)
  const advance = (c: string) => c === '.' || c === ':' ? .24 : c === '/' ? .32 : c === 's' ? .4 : .7
  height = Math.min(height, maxWidth / Math.max(1, chars.reduce((sum, c) => sum + advance(c), 0)))
  return <UiEntity uiTransform={{ width: '100%', height, flexDirection: 'row', alignItems: 'center',
    justifyContent: align === 'middle-right' ? 'flex-end' : 'center', pointerFilter: 'none' }}>
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

function rewardCelebrationOverlay(width: number, height: number, age: number, clock: number) {
  const duration = 4.4
  if (age < 0 || age >= duration) return null
  const centerX = width / 2, centerY = height / 2
  const maxRadius = Math.hypot(width, height) * .47
  const particles = Array.from({ length: 56 }, (_, index) => {
    const delay = (index % 14) * .022
    const progress = Math.max(0, Math.min(1, (age - delay) / 3.1))
    const angle = index * 2.399 + age * (index % 2 ? .19 : -.19)
    const radius = maxRadius * progress * (.78 + (index % 5) * .055)
    const x = centerX + Math.cos(angle) * radius
    const y = centerY + Math.sin(angle) * radius
    const life = Math.max(0, Math.min(1, age / .18, (duration - age) / .8))
    const shimmer = .72 + .28 * Math.sin(clock * 5 + index * 1.7)
    const size = (11 + (index % 5) * 4) * (.45 + .7 * shimmer) * (1 - progress * .34)
    const color = index % 5 === 0 ? cyan : index % 4 === 0 ? white : gold
    return <UiEntity key={'orb-ui-particle-' + index}
      uiTransform={{ ...box(x - size / 2, y - size / 2, size, size), opacity: life * shimmer }}
      uiText={{ ...label(index % 3 === 0 ? '✦' : index % 3 === 1 ? '✧' : '•', size, color),
        textAlign: 'middle-center' }} />
  })
  const titleOpacity = Math.max(0, Math.min(1, age * 2.5, (duration - age) * 1.5))
  const logoWidth = Math.min(width * .58, height * 1.35)
  const logoHeight = logoWidth / 3
  return <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
    {particles}
    <UiEntity uiTransform={{ ...box(centerX - logoWidth / 2, centerY - logoHeight / 2,
      logoWidth, logoHeight), opacity: titleOpacity }}
      uiBackground={{ texture: { src: 'assets/ui/endless-vortex-logo.png',
        filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
  </UiEntity>
}

export function setupAirtimeUi(options: { onUiClick?: () => void } = {}) {
  const tutorial = createFlightTutorial(options.onUiClick)
  let clock = 0, nextTick = 0, tick = 0, milestone = 0, hundredMilestone = 0
  let achievementTier = 0, achievementStart = -10
  let celebrationId = display.rewardCelebration, celebrationStart = -10
  let shotUntil = 0, shotStart = 0
  let cached: ReactEcs.JSX.Element | undefined, cachedTick = -1
  engine.addSystem(dt => {
    if (!Number.isFinite(dt) || dt <= 0) return
    if (dt > .5) { shotUntil = 0; tick++; return }
    tutorial.update(dt)
    clock += dt
    if (display.rewardCelebration !== celebrationId) {
      celebrationId = display.rewardCelebration
      celebrationStart = clock
    }
    if (clock < nextTick) return
    nextTick = clock + .05; tick++
    const step = Math.floor((Number(display.time) || 0) / 30)
    if (step < milestone) milestone = step
    if (step > milestone && display.state === 'Airborne') {
      milestone = step
      shotStart = clock
      shotUntil = clock + .55
    }
    const hundreds = Math.floor((Number(display.time) || 0) / 100)
    if (hundreds < hundredMilestone) {
      hundredMilestone = hundreds
      if (!hundreds) achievementTier = 0
    }
    if (hundreds > hundredMilestone && display.state === 'Airborne') {
      hundredMilestone = hundreds
      achievementTier = Math.min(10, hundreds)
      achievementStart = clock
    }
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
    if (tutorial.isOpen) {
      cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
        {tutorial.render(W, H, inset, display.touchControls)}
      </UiEntity>
      return cached
    }
    const lowAltitudeWarning = display.state === 'Airborne' &&
      (Number(display.time) || 0) >= 10 && display.altitudeMeters < .4
    const vignetteOpacity = .68 + .16 * ((Math.sin(clock * 5) + 1) / 2)
    const layout = scoreHudLayout(W, H, inset)
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
    const footerY = guideY + 44 + layout.footerGap
    const panelH = footerY + layout.footerLogoH * .70
    const state = display.state === 'Airborne' ? 'AIRBORNE' : /Finished|Interrupted/.test(display.state) ? 'FINISHED' : /Paused/.test(display.state) ? 'PAUSED' : 'READY'
    const orbCount = Math.max(0, Math.min(10, display.orbs))
    const { orbX, orbY, orbWidth: ow, orbHeight: oh, orbColumns } = layout
    const smallOrbs = oh <= 120
    const counterY = 6 + layout.orbTitleH * .70, counterH = smallOrbs ? 16 : 20
    const orbSize = Math.min(smallOrbs ? 24 : 30, (ow - 20 - (orbColumns - 1)) / orbColumns)
    const orbRows = 10 / orbColumns, orbGridW = orbColumns * orbSize + orbColumns - 1
    const orbGridY = oh - 7 - orbRows * orbSize - (orbRows - 1)
    const sx = l + w * .36, sy = orbY + oh + 8, sw = w * .28, sh = h * .12
    const shooting = clock < shotUntil
    const celebrationAge = clock - achievementStart
    const celebrating = achievementTier > 0 && celebrationAge >= 0 && celebrationAge < 2.25
    const achievementAsset = (tier: number) => 'milestones/milestone-' + (Math.min(10, tier) * 100)
    const mw = layout.altitudeWidth, mh = layout.altitudeHeight, mx = layout.altitudeX, my = layout.altitudeY
    const altitudeDigitsH = h < 500 ? 20 : 26, altitudeScoreY = 4
    const altitudeValue = Number.parseFloat(display.altitude)
    const altitudeText = Math.max(0, Number.isFinite(altitudeValue) ? altitudeValue : 0).toFixed(1)
    const altitudeDigitsW = Math.min(mw * .70, altitudeDigitsH * altitudeText.split('').reduce((sum, c) => sum + (c === '.' ? .24 : .7), 0))
    const altitudeValueX = mw - altitudeDigitsW - 30
    const altitudeTitleW = Math.min(mw * .68, (h < 500 ? 26 : 34) * 1.25 * 920 / 180, altitudeValueX - 24)
    const altitudeTitleH = altitudeTitleW * 180 / 920
    cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
      {lowAltitudeWarning && lowAltitudeVignette(W, H, vignetteOpacity)}
      <UiEntity key="hud-orbs" uiTransform={box(orbX, orbY, ow, oh)}>
        {tutorialArt('hud-orbs', box(0, 0, ow, oh))}
        <UiEntity key="hud-orbs-title" uiTransform={box((ow - layout.orbTitleW) / 2, -layout.orbTitleH * .30, layout.orbTitleW, layout.orbTitleH)}>
          {heading('orbs', 0, 0, layout.orbTitleW, layout.orbTitleH)}
        </UiEntity>
        <UiEntity key="orb-progress-value" uiTransform={box(ow * .25, counterY, ow * .50, counterH)}>
          {numbers(`${orbCount}/10`, counterH, ow * .50, 'middle-center', 'gold')}
        </UiEntity>
        {Array.from({ length: 10 }, (_, i) => {
          const x = (ow - orbGridW) / 2 + (i % orbColumns) * (orbSize + 1)
          const y = orbGridY + Math.floor(i / orbColumns) * (orbSize + 1)
          return <UiEntity key={'orb-tick-' + i} uiTransform={box(x, y, orbSize, orbSize)}>
            {tutorialArt(i < orbCount ? 'orb-icon' : 'orb-empty', box(0, 0, orbSize, orbSize))}
          </UiEntity>
        })}
      </UiEntity>
      <UiEntity key="hud-sidebar" uiTransform={box(px, py, pw, panelH)}>
        {tutorialArt('hud-panel', box(0, 0, pw, panelH))}
        <UiEntity key="hud-airtime" uiTransform={box((pw - layout.titleW) / 2, -layout.titleH * .30, layout.titleW, layout.titleH)}>
          {heading('airtime', 0, 0, layout.titleW, layout.titleH)}
        </UiEntity>
        <UiEntity key="live-timer" uiTransform={box(pad, layout.timerY, pw - pad * 2, layout.timerH)}>
          {numbers(formatAirtime(sec), layout.timerH * .94, pw - pad * 2)}
        </UiEntity>
        <UiEntity key="best-time" uiTransform={box(pad, layout.bestY, pw - pad * 2, layout.bestH)}>
          <UiEntity uiTransform={box((pw - pad * 2 - (32 + layout.bestH * 4.8)) / 2, 0, 30, layout.bestH)}
            uiText={label('BEST', compact ? 11 : 13, cyan)} />
          <UiEntity key="best-time-digits" uiTransform={box((pw - pad * 2 - (32 + layout.bestH * 4.8)) / 2 + 32, 0, layout.bestH * 4.8, layout.bestH)}>
            {numbers(formatAirtime(display.best), layout.bestH * .94, layout.bestH * 4.8)}
          </UiEntity>
        </UiEntity>
        {layout.stateH > 0 && <UiEntity uiTransform={box(pad, layout.stateY, pw - pad * 2, layout.stateH)}
          uiText={label(state, 11, state === 'AIRBORNE' ? cyan : dim)} />}
        <UiEntity key="hud-medals" uiTransform={box(pad, layout.medalY, pw - pad * 2, layout.medalTitleH + layout.medalBodyH)}>
          {heading('medals', 0, 0, pw - pad * 2, layout.medalTitleH)}
          {[
            { tier: 'bronze', seconds: 15, earned: display.medals.includes('✓ Bronze') },
            { tier: 'silver', seconds: 30, earned: display.medals.includes('✓ Silver') },
            { tier: 'gold', seconds: 60, earned: display.medals.includes('✓ Gold') }
          ].map(({ tier, seconds, earned }, i) => {
            const cellW = (pw - pad * 2) / 3, showCaption = layout.medalBodyH >= 40
            const iconH = layout.medalBodyH - (showCaption ? 14 : 0), iconW = Math.min(cellW - 4, iconH * 256 / 288)
            return <UiEntity key={'medal-' + i} uiTransform={box(i * cellW, layout.medalTitleH, cellW, layout.medalBodyH)}>
              {tutorialArt('medal-' + tier + (earned ? '-earned' : '-locked'), box((cellW - iconW) / 2, 0, iconW, iconH))}
              {showCaption && <UiEntity key={'medal-threshold-' + i} uiTransform={box(0, iconH, cellW, 14)}>
                {numbers(seconds + 's', 14, cellW)}
              </UiEntity>}
            </UiEntity>
          })}

        </UiEntity>
        <UiEntity key="hud-nearby" uiTransform={box(pad, layout.nearbyY, pw - pad * 2, layout.nearbyTitleH)}>
          {heading('nearby', 0, 0, pw - pad * 2, layout.nearbyTitleH)}
        </UiEntity>
        {leaders.map((row, i) => {
          const innerW = pw - pad * 2, portraitSize = Math.min(46, rowH - 10)
          const portraitX = 4, contentX = portraitX + portraitSize + 6, contentW = innerW - contentX - 5
          const stacked = pw < 260, nameH = 20, scoreY = stacked ? 74 : 33
          const rankW = Math.min(stacked ? 96 : 88, contentW), rankH = rankW / 2
          const rankX = stacked ? contentX + (contentW - rankW) / 2 : contentX
          const rankY = stacked ? 22 : (rowH - rankH) / 2
          const nameX = stacked ? contentX : contentX + rankW + 4
          const nameY = stacked ? 1 : 8, nameW = Math.max(20, innerW - nameX - 5)
          const scoreX = stacked ? contentX : nameX, scoreW = innerW - scoreX - 5
          const scoreH = Math.min(32, rowH - scoreY - 2)
          const fontSize = compact ? 12 : 13, maxName = Math.max(3, Math.min(16, Math.floor(nameW / (fontSize * .66))))
          const playerName = (row.approximate ? '~' : '') + row.name
          const fittedName = playerName.length > maxName ? playerName.slice(0, maxName - 1) + '…' : playerName
          const tier = flightRankTier(row.airtime)
          return <UiEntity key={'leader-' + row.userId} uiTransform={box(pad, layout.rowsY + i * rowH, innerW, rowH)}>
            {tutorialArt('goal', box(0, 1, innerW, rowH - 2))}
            <UiEntity key={'portrait-' + row.userId} uiTransform={box(portraitX + 2, (rowH - portraitSize) / 2 + 2, portraitSize - 4, portraitSize - 4)}
              uiBackground={{ avatarTexture: { userId: row.userId, filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
            {tutorialArt('portrait-frame', box(portraitX, (rowH - portraitSize) / 2, portraitSize, portraitSize))}
            <UiEntity key={'rank-insignia-' + row.userId} uiTransform={box(rankX, rankY, rankW, rankH)}
              uiBackground={{ texture: { src: `assets/ui/ranks/rank-${tier}.png`, filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
            <UiEntity key={'player-name-' + row.userId} uiTransform={box(nameX, nameY, nameW, nameH)}
              uiText={label(fittedName, fontSize, row.userId === display.localUser ? gold : white, 'middle-left', 'nowrap')} />
            <UiEntity key={'score-' + row.userId} uiTransform={box(scoreX, scoreY, scoreW, scoreH)}>
              {numbers(formatAirtime(parseFloat(row.airtime) || 0, false), scoreH, scoreW, 'middle-right')}
            </UiEntity>
          </UiEntity>
        })}

        {!leaders.length && rowCount > 0 && <UiEntity uiTransform={box(pad, layout.rowsY, pw - pad * 2, rowH)} uiText={label('EMPTY', 11, dim)} />}
        {tutorial.render(W, H, inset, display.touchControls, box(pad, guideY, pw - pad * 2, 44))}
        <UiEntity key="hud-footer-logo" uiTransform={box((pw - layout.footerLogoW) / 2, footerY, layout.footerLogoW, layout.footerLogoH)}
          uiBackground={{ texture: { src: 'assets/ui/endless-vortex-logo.png', filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch' }} />
      </UiEntity>
      <UiEntity key="hud-milestone-slot" uiTransform={box(sx, sy, sw, sh)}>
        {shooting && art('burst', box(sw * .34, 0, sw * .32, sh), .95,
          uv(Math.min(7, Math.floor((clock - shotStart) * 15)), 4, 2))}
      </UiEntity>
      {celebrating && (() => {
        const travel = Math.max(0, Math.min(1, (celebrationAge - .42) / 1.38))
        const eased = travel * travel * (3 - 2 * travel)
        const popW = w * .72, popH = popW / 3
        const startX = l + (w - popW) / 2, startY = t + (h - popH) / 2
        const targetX = sx, targetY = sy + 12 * s
        const currentW = popW + (sw - popW) * eased
        const currentH = popH + (sh - 12 * s - popH) * eased
        const currentX = startX + (targetX - startX) * eased
        const currentY = startY + (targetY - startY) * eased
        const flash = celebrationAge < .42 ? .78 + .22 * ((Math.sin(clock * 42) + 1) / 2) : 1
        return <UiEntity uiTransform={{ ...box(currentX, currentY, currentW, currentH), opacity: flash }}>
          {art(achievementAsset(achievementTier), box(0, 0, currentW, currentH))}
          <UiEntity uiTransform={box(currentW * .25, currentH * .39, currentW * .5, currentH * .24)}
            uiText={label((achievementTier * 100) + ' SECONDS AIRBORNE!', Math.max(18 * s, 13), white)} />
        </UiEntity>
      })()}
      {!portrait && <UiEntity key="hud-altitude" uiTransform={box(mx, my, mw, mh)}>
        {tutorialArt('hud-altitude', box(0, 0, mw, mh))}
        <UiEntity key="altitude-title" uiTransform={box(12, -altitudeTitleH * .20, altitudeTitleW, altitudeTitleH)}>
          {heading('altitude', 0, 0, altitudeTitleW, altitudeTitleH)}
        </UiEntity>
        <UiEntity key="altitude-value" uiTransform={box(altitudeValueX, altitudeScoreY, altitudeDigitsW, altitudeDigitsH)}>
          {numbers(altitudeText, altitudeDigitsH, altitudeDigitsW)}
        </UiEntity>
        <UiEntity uiTransform={box(altitudeValueX + altitudeDigitsW + 4, altitudeScoreY, 14, altitudeDigitsH)}
          uiText={label('m', 13, cyan, 'middle-left')} />
        <UiEntity uiTransform={box(12, mh - 22, mw - 24, 16)}>
          {altitudeGauge(display.energy, mw - 24, 16)}
        </UiEntity>
      </UiEntity>}
      {rewardCelebrationOverlay(W, H, clock - celebrationStart, clock)}
    </UiEntity>
    return cached
  }, { virtualWidth: 0, virtualHeight: 0, screenInset: 'none' })
}
