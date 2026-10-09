import ReactEcs, { ReactEcsRenderer, UiEntity, UiTransformProps } from '@dcl/sdk/react-ecs'
import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

export type LeaderRow = { rank: number; userId: string; name: string; airtime: string; phase: string; approximate?: boolean }
export const display = {
  time: '0.000', best: '0.000', state: 'Jump into the wind',
  orbs: 0,
  rows: [] as LeaderRow[], storage: 'Session records only',
  energy: 0, altitude: '0.0', altitudeMeters: 0,
  localUser: '', medals: 'No medals yet', rewardCelebration: 0
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
  const coords = uv(char === '.' ? 10 : char === ':' ? 11 : Number(char), 6, 2)
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
function numbers(value: string, height: number, maxWidth: number, align: 'middle-center' | 'middle-right' = 'middle-center') {
  const chars = value.replace(/[^0-9.:]/g, '').slice(0, 10).split('')
  height = Math.min(height, maxWidth / Math.max(1, chars.reduce((sum, c) => sum + (c === '.' || c === ':' ? .24 : .7), 0)))
  return <UiEntity uiTransform={{ width: '100%', height, flexDirection: 'row', alignItems: 'center',
    justifyContent: align === 'middle-right' ? 'flex-end' : 'center', pointerFilter: 'none' }}>
    {chars.map((char, i) => <UiEntity key={'digit-' + i} uiTransform={{
      width: height * (char === '.' || char === ':' ? .24 : .7), height, flexShrink: 0, pointerFilter: 'none'
    }} uiBackground={{ texture: { src: ROOT + 'digits.png', filterMode: 'bi-linear', wrapMode: 'clamp' },
      textureMode: 'stretch', uvs: glyphUv(char) }} />)}
  </UiEntity>
}
function simpleGauge(value: number, width: number, height: number) {
  return <UiEntity uiTransform={{ width, height, pointerFilter: 'none' }}
    uiBackground={{ color: Color4.create(.03, .11, .19, .92) }}>
    <UiEntity uiTransform={{ positionType: 'absolute', position: { left: 0, top: 0 },
      width: width * Math.max(0, Math.min(100, value)) / 100, height }}
      uiBackground={{ color: Color4.create(.22, .78, .94, .95) }} />
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

export function setupAirtimeUi() {
  let clock = 0, nextTick = 0, tick = 0, milestone = 0, hundredMilestone = 0
  let achievementTier = 0, achievementStart = -10
  let celebrationId = display.rewardCelebration, celebrationStart = -10
  let shotUntil = 0, shotStart = 0
  let cached: ReactEcs.JSX.Element | undefined, cachedTick = -1
  engine.addSystem(dt => {
    if (!Number.isFinite(dt) || dt <= 0) return
    if (dt > .5) { shotUntil = 0; tick++; return }
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
    const lowAltitudeWarning = display.state === 'Airborne' &&
      (Number(display.time) || 0) >= 10 && display.altitudeMeters < .4
    const vignetteOpacity = .68 + .16 * ((Math.sin(clock * 5) + 1) / 2)
    if (w < h) {
      // Phone portrait keeps only the essential timer/status, leaving controls
      // and the center/lower play area clear while making airtime readable.
      const portraitScale = Math.min(1, w / 390, h / 844)
      const cardW = Math.min(w * .68, 330 * portraitScale), cardH = 106 * portraitScale
      const cardX = l + w - cardW - 12 * portraitScale, cardY = t + 12 * portraitScale
      const portraitState = display.state === 'Airborne' ? 'AIRBORNE' :
        /Finished|Interrupted/.test(display.state) ? 'FINISHED' :
        /Paused/.test(display.state) ? 'PAUSED' : 'READY'
      const orbCounter = `ORB ${Math.max(0, Math.min(10, display.orbs))}/10`
      cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
        {lowAltitudeWarning && lowAltitudeVignette(W, H, vignetteOpacity)}
        <UiEntity uiTransform={box(cardX, cardY, cardW, 126 * portraitScale)}>
          {art('panel', box(0, 0, cardW, cardH), .96)}
          <UiEntity uiTransform={box(cardW * .07, cardH * .08, cardW * .56, cardH * .54)}>
            {numbers((Number(display.time) || 0).toFixed(2), Math.min(42 * portraitScale, cardH * .48), cardW * .54)}
          </UiEntity>
          <UiEntity uiTransform={box(cardW * .64, cardH * .12, cardW * .32, cardH * .28)}
            uiText={label('AIRTIME', 13 * portraitScale, cyan, 'middle-left')} />
          <UiEntity uiTransform={box(cardW * .64, cardH * .4, cardW * .32, cardH * .22)}
            uiText={label('BEST ' + (Number(display.best) || 0).toFixed(2), 11 * portraitScale, gold, 'middle-left')} />
          <UiEntity uiTransform={box(cardW * .07, cardH * .68, cardW * .86, cardH * .17)}
            uiText={label(portraitState, 12 * portraitScale, display.state === 'Airborne' ? gold : white)} />
          <UiEntity uiTransform={box(cardW * .29, cardH * .84, cardW * .62, cardH * .16)}>
            {art('row', box(0, 0, cardW * .62, cardH * .16), .9)}
            <UiEntity uiTransform={box(7 * portraitScale, 1 * portraitScale,
              16 * portraitScale, 14 * portraitScale)}>
              {art('vortex', box(0, 0, 16 * portraitScale, 14 * portraitScale), .95)}
            </UiEntity>
            <UiEntity uiTransform={box(28 * portraitScale, 0, cardW * .48, cardH * .16)}
              uiText={label(orbCounter, 11 * portraitScale, gold, 'middle-left')} />
          </UiEntity>
        </UiEntity>
        {rewardCelebrationOverlay(W, H, clock - celebrationStart, clock)}
      </UiEntity>
      return cached
    }
    const small = w < 1000 || h < 560
    const s = Math.min(1, w / 1280, h / 720)
    const sec = Number(display.time) || 0
    const wave = (Math.sin(clock * 5) + 1) / 2, bright = .73 + .27 * wave
    const shooting = clock < shotUntil
    const celebrationAge = clock - achievementStart
    const celebrating = achievementTier > 0 && celebrationAge >= 0 && celebrationAge < 2.25
    const achievementAsset = (tier: number) => 'milestones/milestone-' + (Math.min(10, tier) * 100)

    // Keep scene-facing HUD in the allowed top and right zones; the center and corners stay clear.
    const panelWidth = w * .25
    const pw = panelWidth, ph = h * .285
    const px = l + w * .715, py = t + h * .025
    const sx = l + w * .36, sy = t + h * .018
    const sw = w * .28, sh = h * .175
    const bw = panelWidth, rh = Math.max(30, 36 * s)
    const bx = px
    const medalY = py + ph + 5 * s
    const medalH = Math.max(20, 24 * s)
    const by = medalY + medalH + 4 * s
    const boardLimit = t + h * .565
    const maxRows = small ? 3 : 5
    const rowLimit = Math.max(0, Math.min(maxRows, Math.floor((boardLimit - by - 8 * s) / rh) - 1))
    const leaders = display.rows.slice(0, rowLimit)
    const localRow = display.rows.find(row => row.userId === display.localUser)
    if (localRow && !leaders.some(row => row.userId === localRow.userId) && leaders.length) {
      leaders[leaders.length - 1] = localRow
      leaders.sort((a, b) => a.rank - b.rank)
    }
    const mw = panelWidth, mh = Math.max(30, 40 * s)
    const mx = l + (w - mw) / 2, my = t + h - mh - 8 * s - (inset?.bottom || 0)
    cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
      {lowAltitudeWarning && lowAltitudeVignette(W, H, vignetteOpacity)}
      <UiEntity uiTransform={box(px, py, pw, ph)}>
        {art('panel', box(0, 0, pw, ph))}
        <UiEntity uiTransform={box(pw * .13, ph * .16, pw * .74, 24 * s)}
          uiText={label('AIRTIME', 15 * s, cyan)} />
        <UiEntity uiTransform={box(pw * .09, ph * .3, pw * .82, ph * .39)}>
          {numbers(sec.toFixed(2), Math.min(72 * s, ph * .39), pw * .82)}
        </UiEntity>
        <UiEntity uiTransform={box(pw * .1, ph * .69, pw * .8, 22 * s)}
          uiText={label('BEST ' + (Number(display.best) || 0).toFixed(2), 13 * s, gold)} />
        <UiEntity uiTransform={box(pw * .27, ph * .81, pw * .46, 22 * s)}>
          {art('row', box(0, 0, pw * .46, 22 * s), .9)}
          <UiEntity uiTransform={box(pw * .045, 2 * s, 18 * s, 18 * s)}>
            {art('vortex', box(0, 0, 18 * s, 18 * s), .95)}
          </UiEntity>
          <UiEntity uiTransform={box(pw * .14, 0, pw * .29, 22 * s)}
            uiText={label(`ORB ${Math.max(0, Math.min(10, display.orbs))}/10`, 12 * s, gold, 'middle-left')} />
        </UiEntity>
      </UiEntity>

      <UiEntity uiTransform={box(sx, sy, sw, sh)}>
        {shooting && art('burst', box(sw * .34, sh * .1, sw * .32, sh * .8), .95,
          uv(Math.min(7, Math.floor((clock - shotStart) * 15)), 4, 2))}
        {shooting && <UiEntity uiTransform={box(sw * .18, sh * .81, sw * .64, sh * .18)}
          uiText={label('WIND', 12 * s, white)} />}
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

      <UiEntity uiTransform={box(bx, medalY, bw, medalH)}>
        {art('row', box(0, 0, bw, medalH), .9)}
        <UiEntity uiTransform={box(bw * .06, 0, bw * .3, medalH)}
          uiText={label('MEDALS', 11 * s, cyan, 'middle-left')} />
        {[
          { name: 'B', earned: display.medals.includes('✓ Bronze'), tint: Color4.create(.72, .43, .16, 1) },
          { name: 'S', earned: display.medals.includes('✓ Silver'), tint: dim },
          { name: 'G', earned: display.medals.includes('✓ Gold'), tint: gold }
        ].map(({ name, earned, tint }, medal) => <UiEntity key={'medal-' + medal}
          uiTransform={box(bw * (.57 + medal * .12), 0, bw * .12, medalH)}
          uiText={label((earned ? '✓' : '○') + name, 11 * s, earned ? tint : dim)} />)}
      </UiEntity>

      <UiEntity uiTransform={box(bx, by, bw, rh * Math.max(2, leaders.length + 1))}>
        {art('row', box(0, 0, bw, rh))}
        <UiEntity uiTransform={box(bw * .08, 0, bw * .84, rh)}
          uiText={label('NEARBY', 15 * s, cyan)} />
        {leaders.map(row => <UiEntity key={row.userId} uiTransform={box(0, rh * row.rank, bw, rh)}>
          {art('row', box(0, 0, bw, rh), row.userId === display.localUser ? bright : 1)}
          <UiEntity uiTransform={box(bw * .015, rh * .1, bw * .075, rh * .8)}>
            {numbers(String(row.rank), rh * .66, bw * .075)}
          </UiEntity>
          <UiEntity uiTransform={box(bw * .11, (rh - Math.min(bw * .15, rh * .84)) / 2,
            Math.min(bw * .15, rh * .84), Math.min(bw * .15, rh * .84))}
            uiBackground={{ avatarTexture: { userId: row.userId } }} />
          <UiEntity uiTransform={box(bw * .275, 0, bw * .48, rh)}
            uiText={label((row.approximate ? '~' : '') + row.name, 13 * s,
              row.userId === display.localUser ? gold : white, 'middle-left', 'wrap')} />
          <UiEntity uiTransform={box(bw * .77, rh * .2, bw * .21, rh * .6)}>
            {numbers(parseFloat(row.airtime).toFixed(2), rh * .55, bw * .21, 'middle-right')}
          </UiEntity>
        </UiEntity>)}
        {!leaders.length && <UiEntity uiTransform={box(0, rh, bw, rh)} uiText={label('EMPTY', 11 * s, dim)} />}
      </UiEntity>

      <UiEntity uiTransform={box(mx, my, mw, mh)}>
        {art('row', box(0, 0, mw, mh), .78)}
        <UiEntity uiTransform={box(mw * .04, 0, mw * .62, mh * .58)}
          uiText={label('ALTITUDE', 12 * s, cyan, 'middle-left')} />
        <UiEntity uiTransform={box(mw * .62, 0, mw * .32, mh * .58)}>
          {numbers(display.altitude, Math.max(12, 17 * s), mw * .25, 'middle-right')}
        </UiEntity>
        <UiEntity uiTransform={box(mw * .91, 0, mw * .08, mh * .58)}
          uiText={label('m', 11 * s, white, 'middle-right')} />
        <UiEntity uiTransform={box(mw * .04, mh * .69, mw * .92, mh * .12)}>
          {simpleGauge(display.energy, mw * .92, mh * .12)}
        </UiEntity>
      </UiEntity>

      {rewardCelebrationOverlay(W, H, clock - celebrationStart, clock)}

    </UiEntity>
    return cached
  }, { virtualWidth: 0, virtualHeight: 0, screenInset: 'none' })
}
