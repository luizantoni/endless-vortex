import ReactEcs, { ReactEcsRenderer, UiEntity, UiTransformProps } from '@dcl/sdk/react-ecs'
import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

export type LeaderRow = { rank: number; userId: string; name: string; airtime: string; phase: string; approximate?: boolean }
export const display = {
  time: '0.000', best: '0.000', state: 'Jump into the wind',
  rows: [] as LeaderRow[], storage: 'Session records only',
  orbs: 0, energy: 0, altitude: '0.0', localUser: '', medals: 'No medals yet'
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

export function setupAirtimeUi() {
  let clock = 0, nextTick = 0, tick = 0, milestone = 0, hundredMilestone = 0
  let achievementTier = 0, achievementStart = -10
  let shotUntil = 0, shotStart = 0, vortexUntil = 0, vortexStart = 0
  let cached: ReactEcs.JSX.Element | undefined, cachedTick = -1
  engine.addSystem(dt => {
    if (!Number.isFinite(dt) || dt <= 0) return
    if (dt > .5) { shotUntil = 0; vortexUntil = 0; tick++; return }
    clock += dt
    if (clock < nextTick) return
    nextTick = clock + .05; tick++
    const step = Math.floor((Number(display.time) || 0) / 30)
    if (step < milestone) milestone = step
    if (step > milestone && display.state === 'Airborne') {
      milestone = step
      if (step % 2 === 0) { vortexStart = clock; vortexUntil = clock + 2.4 }
      else { shotStart = clock; shotUntil = clock + .55 }
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
  ReactEcsRenderer.setUiRenderer(() => {
    if (cached && cachedTick === tick) return cached
    cachedTick = tick
    const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
    const W = canvas?.width || 1280, H = canvas?.height || 720, inset = canvas?.screenInsetArea
    const l = inset?.left || 0, t = inset?.top || 0
    const w = W - l - (inset?.right || 0), h = H - t - (inset?.bottom || 0)
    if (w < h) {
      cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }} />
      return cached
    }
    const small = w < 1000 || h < 560
    const s = Math.min(1, w / 1280, h / 720)
    const sec = Number(display.time) || 0, airborne = display.state === 'Airborne'
    const finished = /Finished|Interrupted/.test(display.state)
    const status = airborne ? 'AIRBORNE' : finished ? 'JUMP TO REPLAY' :
      /Paused/.test(display.state) ? 'PAUSED' : 'READY TO FLY'
    const wave = (Math.sin(clock * 5) + 1) / 2, bright = .73 + .27 * wave
    const streak = Math.floor(sec)
    const shooting = clock < shotUntil, vortexing = clock < vortexUntil
    const celebrationAge = clock - achievementStart
    const celebrating = achievementTier > 0 && celebrationAge >= 0 && celebrationAge < 2.25
    const achievementAsset = (tier: number) => 'milestones/milestone-' + (Math.min(10, tier) * 100)

    // Keep scene-facing HUD in the allowed top and right zones; the center and corners stay clear.
    const pw = w * .245, ph = h * .255
    const px = l + w * .72, py = t + h * .025
    const sx = l + w * .36, sy = t + h * .018
    const sw = w * .28, sh = h * .175
    const bw = w * (small ? .30 : .25), rh = Math.max(30, 36 * s)
    const bx = l + w * (small ? .69 : .74)
    const by = t + h * .26
    const maxRows = small ? 3 : 5
    const rowLimit = Math.max(0, Math.min(maxRows, Math.floor(h * .53 / rh) - 1))
    const leaders = display.rows.slice(0, rowLimit)
    const localRow = display.rows.find(row => row.userId === display.localUser)
    if (localRow && !leaders.some(row => row.userId === localRow.userId) && leaders.length) {
      leaders[leaders.length - 1] = localRow
      leaders.sort((a, b) => a.rank - b.rank)
    }
    const ex = l + w * (small ? .80 : .815)
    const ey = t + h * .575
    const ew = w * (small ? .18 : .17), eh = h * .092
    const orbH = Math.max(24, 36 * s), orbY = ey + eh + 4 * s
    const mw = w * .28, mh = Math.max(30, 40 * s)
    const mx = l + (w - mw) / 2, my = t + h - mh - 8 * s - (inset?.bottom || 0)
    const orbCount = display.orbs ? (display.orbs % 10 || 10) : 0
    cached = <UiEntity uiTransform={{ width: '100%', height: '100%', pointerFilter: 'none' }}>
      <UiEntity uiTransform={box(px, py, pw, ph)}>
        {art('panel', box(0, 0, pw, ph))}
        <UiEntity uiTransform={box(pw * .13, ph * .16, pw * .74, 24 * s)}
          uiText={label('ENDLESS VORTEX · AIRTIME', 15 * s, cyan)} />
        <UiEntity uiTransform={box(pw * .09, ph * .3, pw * .82, ph * .39)}>
          {numbers(sec.toFixed(2), Math.min(72 * s, ph * .39), pw * .82)}
        </UiEntity>
        <UiEntity uiTransform={box(pw * .1, ph * .69, pw * .8, 22 * s)}
          uiText={label(status, 13 * s, airborne ? gold : cyan)} />
        <UiEntity uiTransform={box(pw * .1, ph * .82, pw * .32, 20 * s)} uiText={label('BEST', 12 * s, dim)} />
        <UiEntity uiTransform={box(pw * .43, ph * .8, pw * .44, 22 * s)}>
          {numbers(Number(display.best).toFixed(2), 20 * s, pw * .44, 'middle-right')}
        </UiEntity>
      </UiEntity>

      <UiEntity uiTransform={box(sx, sy, sw, sh + 12 * s)}>
        <UiEntity uiTransform={box(0, 12 * s, sw, sh - 12 * s)}>
          {art(achievementTier ? achievementAsset(achievementTier) : 'streak',
            box(0, 0, sw, sh - 12 * s), shooting || vortexing ? bright : 1)}
          <UiEntity uiTransform={box(sw * .2, (sh - 12 * s) * .31, sw * .6, (sh - 12 * s) * .44)}>
            {numbers(String(streak), Math.min(68 * s, (sh - 12 * s) * .42), sw * .6)}
          </UiEntity>
          {shooting && art('burst', box(sw * .34, (sh - 12 * s) * .1, sw * .32, (sh - 12 * s) * .8), .95,
            uv(Math.min(7, Math.floor((clock - shotStart) * 15)), 4, 2))}
          {vortexing && art('burst', box(sw * .13, -(sh - 12 * s) * .18, sw * .74, (sh - 12 * s) * 1.36), .46,
            uv((Math.floor((clock - vortexStart) * 8) + 4) % 8, 4, 2))}
          {vortexing && art('burst', box(sw * .2, -(sh - 12 * s) * .1, sw * .6, (sh - 12 * s) * 1.2), .96,
            uv(Math.floor((clock - vortexStart) * 8) % 8, 4, 2))}
          {vortexing && art('vortex', box(sw * .43, (sh - 12 * s) * .36, sw * .14, (sh - 12 * s) * .28), .75 + wave * .25)}
          <UiEntity uiTransform={box(sw * .18, (sh - 12 * s) * .81, sw * .64, (sh - 12 * s) * .18)}
            uiText={label(vortexing ? 'GOLDEN VORTEX!' : shooting ? 'WIND FLASH!' : 'KEEP IT GOING!', 12 * s, shooting || vortexing ? white : gold)} />
        </UiEntity>
        <UiEntity uiTransform={box(sw * .26, 0, sw * .48, 14 * s)}
          uiText={label(achievementTier ? 'AIRTIME RANK ' + achievementTier : 'AIR STREAK', 12 * s, gold)} />
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

      <UiEntity uiTransform={box(bx, by, bw, rh * Math.max(2, leaders.length + 1))}>
        {art('row', box(0, 0, bw, rh))}
        <UiEntity uiTransform={box(bw * .08, 0, bw * .84, rh)}
          uiText={label('IN THIS SCENE', 15 * s, cyan)} />
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
        {!leaders.length && <UiEntity uiTransform={box(0, rh, bw, rh)} uiText={label('WAITING FOR RUNNERS', 11 * s, dim)} />}
      </UiEntity>

      <UiEntity uiTransform={box(ex, ey, ew, eh)}>
        {[
          { title: 'BEST AIRTIME', value: Number(display.best).toFixed(2), numeric: true },
          { title: 'RUN STATE', value: airborne ? 'FLYING' : finished ? 'ENDED' : /Paused/.test(display.state) ? 'PAUSED' : 'READY' },
          { title: 'AIRTIME MEDALS', value: 'medals' }
        ].map((event, i) =>
          <UiEntity key={'event-' + i} uiTransform={box(0, i * eh / 3, ew, eh / 3)}>
            {art('row', box(0, 0, ew, eh / 3), .9)}
            {i === 0 && art('vortex', box(8 * s, 2 * s, eh / 3 - 4 * s, eh / 3 - 4 * s), .9)}
            <UiEntity uiTransform={box(i === 0 ? eh / 3 : 8 * s, 0,
              ew * (i === 0 ? .52 : .66), eh / 3)}
              uiText={label(event.title, 12 * s, i === 0 ? cyan : white, 'middle-left')} />
            {i < 2 && <UiEntity uiTransform={box(ew * .68, eh / 24, ew * .27, eh / 3 * .7)}>
              {event.numeric ? numbers(event.value, eh / 5, ew * .27, 'middle-right') :
                <UiEntity uiTransform={{ width: '100%', height: '100%' }}
                  uiText={label(event.value, 11 * s, gold, 'middle-right')} />}
            </UiEntity>}
            {i === 2 && [
              { name: 'B', earned: display.medals.includes('✓ Bronze'), tint: Color4.create(.72, .43, .16, 1) },
              { name: 'S', earned: display.medals.includes('✓ Silver'), tint: dim },
              { name: 'G', earned: display.medals.includes('✓ Gold'), tint: gold }
            ].map(({ name, earned, tint }, medal) => <UiEntity key={'medal-' + medal}
              uiTransform={box(ew * (.67 + medal * .105), 0, ew * .1, eh / 3)}
              uiText={label((earned ? '✓' : '○') + name, 11 * s, earned ? tint : dim)} />)}
          </UiEntity>)}
      </UiEntity>

      <UiEntity uiTransform={box(ex, orbY, ew, orbH)}>
        {art('row', box(0, 0, ew, orbH), .95)}
        {art('vortex', box(5 * s, 4 * s, orbH - 8 * s, orbH - 8 * s), bright)}
        <UiEntity uiTransform={box(orbH, 0, ew * .42, orbH)}
          uiText={label('TELEPORT', 11 * s, gold, 'middle-left')} />
        <UiEntity uiTransform={box(ew * .69, 0, ew * .25, orbH)}
          uiText={label(orbCount + '/10', 14 * s, white, 'middle-right')} />
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

    </UiEntity>
    return cached
  })
}
