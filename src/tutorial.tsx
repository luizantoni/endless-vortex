import ReactEcs, { UiEntity, UiTransformProps } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

const ROOT = 'assets/ui/tutorial/'
const gold = Color4.create(1, .83, .49, 1), cyan = Color4.create(.55, .96, .92, 1)
const white = Color4.create(.93, .97, .97, 1)
export const FLIGHT_LESSONS = [
  { name: 'THE UPDRAFT', title: 'Catch the wind!', art: 'flight',
    body: 'Enter the central vortex to launch yourself into the sky. Press SPACE twice and hold to glide. Ride upward, then steer your glide to stay in the air.',
    shortBody: 'Enter the central vortex to launch. Press SPACE twice and hold to glide. Ride up, then steer to stay in the air.',
    touchBody: 'Enter the central vortex to launch. Tap Jump twice and hold to glide. Ride upward, then steer to stay in the air.',
    goal: 'STAY UP IN THE AIR' },
  { name: 'GOLDEN ORBS', title: 'Five orbs. One flight boost!', art: 'orbs',
    body: 'Collect golden orbs as you fly. Every 5 orbs give you a wind boost, lifting you back above the vortex without resetting your flight timer.',
    shortBody: 'Collect 5 golden orbs to lift back above the vortex. Your flight timer keeps running.',
    goal: 'STAY AIRBORNE LONGER!' },
  { name: 'PLATFORMS', title: 'Land, jump, and fly again!', art: 'leaf',
    body: 'Use leaves and rocks to stop yourself from falling. But be quick! Jump off before they disappear. Press SPACE once to jump, twice to glide.',
    shortBody: 'Land on leaves and rocks, then jump off before they disappear. Press SPACE once to jump, twice to glide.',
    touchBody: 'Land on leaves and rocks, then jump off before they disappear. Tap Jump once to jump, twice to glide.',
    goal: 'USE PLATFORMS TO REST' },
  { name: 'BEAT YOUR BEST', title: 'Beat the leaderboard', art: 'airtime',
    body: 'Your airborne time is your score. Touch the blue lava and your flight ends. Earn a new flight rank every 100 seconds in the air.',
    shortBody: 'Airborne time is your score. Blue lava ends your flight. Earn a new rank every 100 seconds in the air.',
    goal: 'STAY AIRBORNE TO SCORE!' }
] as const
const LAST_STEP = FLIGHT_LESSONS.length - 1

export function tutorialLogoWidth(width: number, portrait: boolean, shortLandscape: boolean) {
  return Math.min(shortLandscape ? 260 : 540, width * (portrait ? .90 : .74))
}

export function tutorialLayout(W: number, H: number, inset?: { left: number; right: number; top: number; bottom: number }) {
  const l = inset?.left || 0, t = inset?.top || 0
  const w = Math.max(0, W - l - (inset?.right || 0)), h = Math.max(0, H - t - (inset?.bottom || 0))
  const portrait = w < 600 && h > w
  const width = Math.min(920, Math.max(0, w - 24))
  const shortLandscape = !portrait && h < 640
  const logoOverhang = tutorialLogoWidth(width, portrait, shortLandscape) * 733 / 2145 * .30
  const height = Math.min(portrait ? 720 : 600, Math.max(0, h - 24 - logoOverhang))
  return { x: l + (w - width) / 2, y: t + logoOverhang + (h - logoOverhang - height) / 2,
    width, height, portrait, shortLandscape }
}
const box = (x: number, y: number, width: number, height: number): UiTransformProps => ({
  positionType: 'absolute', position: { left: x, top: y }, width, height, flexShrink: 0, pointerFilter: 'none'
})
const text = (value: string, fontSize: number, color = white, align: 'middle-left' | 'middle-center' = 'middle-left') => ({
  value, fontSize, color, font: 'serif' as const, textWrap: 'wrap' as const, textAlign: align
})
function art(name: string, bounds: UiTransformProps) {
  return <UiEntity uiTransform={bounds} uiBackground={{ texture: { src: ROOT + name + '.png',
    filterMode: 'bi-linear', wrapMode: 'clamp' }, textureMode: 'stretch', ...(bounds.opacity === undefined ? {} : { color: Color4.create(1, 1, 1, Number(bounds.opacity)) }) }} />
}

/** Session-local guide. It teaches without changing movement, scoring or world state. */
export function createFlightTutorial(playClick: () => void = () => {}) {
  let open = true, step = 0, clock = 0, changedAt = -1
  let hover = '', pressed = '', pressedUntil = 0
  const warmth: Record<string, number> = {}
  function change(action: () => void) {
    playClick()
    action()
    hover = ''; changedAt = clock
  }
  function button(id: string, caption: string, bounds: UiTransformProps, action: () => void, primary = false) {
    const heat = warmth[id] || 0, down = pressed === id && clock < pressedUntil
    const offset = down ? 2 : -2 * heat
    // Keep the 44 px tap target while making the guide's artwork half-size.
    const scale = id === 'reopen' ? .575 : 1
    const visualW = Number(bounds.width) * scale, visualH = Number(bounds.height) * scale
    const visualX = (Number(bounds.width) - visualW) / 2, visualY = (Number(bounds.height) - visualH) / 2 + offset
    return <UiEntity key={id} uiTransform={{ ...bounds, pointerFilter: 'block' }}
      onMouseEnter={() => { hover = id }} onMouseLeave={() => { if (hover === id) hover = '' }}
      onMouseDown={() => { pressed = id; pressedUntil = clock + .16; change(action) }}>
      {art(primary ? 'button' : 'button-quiet', { ...box(visualX, visualY, visualW, visualH), opacity: down ? .7 : 1 })}
      {heat > .01 && art('button-hover', { ...box(visualX, visualY, visualW, visualH), opacity: heat * (primary || id === 'skip' || id === 'back' || id === 'reopen' ? .95 : .3) })}
      {id === 'next' || id === 'skip' || id === 'back' || id === 'reopen' ? (() => {
        const word = id === 'reopen' ? 'flight-guide' : id === 'skip' ? 'skip' : id === 'back' ? 'back' : step === LAST_STEP ? 'fly' : 'next'
        const ratio = id === 'reopen' ? 944 / 112 : 360 / 112
        const width = id === 'reopen' ? Math.min(visualW * .9, visualH * .62 * ratio) : Math.min(Number(bounds.width) * .72, Number(bounds.height) * 2, 104)
        const height = width / ratio
        const boundsForWord = box((Number(bounds.width) - width) / 2, (Number(bounds.height) - height) / 2 + offset, width, height)
        return <UiEntity uiTransform={box(0, 0, Number(bounds.width), Number(bounds.height))}>
          {art(word + (heat > .5 ? '-dark' : '-light'), boundsForWord)}
        </UiEntity>
      })() : <UiEntity uiTransform={box(0, offset, Number(bounds.width), Number(bounds.height))}
        uiText={text(caption, 16, white, 'middle-center')} />}
    </UiEntity>
  }
  return {
    get isOpen() { return open },
    update(dt: number) {
      if (!Number.isFinite(dt) || dt <= 0) return
      clock += Math.min(dt, .1)
      for (const id of new Set([...Object.keys(warmth), hover].filter(Boolean))) {
        const target = hover === id ? 1 : 0
        warmth[id] = (warmth[id] || 0) + (target - (warmth[id] || 0)) * Math.min(1, dt * 14)
      }
    },
    render(W: number, H: number, inset: { left: number; right: number; top: number; bottom: number } | undefined, touch: boolean, reopenBounds?: UiTransformProps) {
      if (!open) {
        const l = inset?.left || 0, t = inset?.top || 0, w = W - l - (inset?.right || 0), h = H - t - (inset?.bottom || 0)
        return button('reopen', 'FLIGHT GUIDE', reopenBounds || box(l + w / 2 - 64, t + (w < h ? 142 : h * .205), 128, 44),
          () => { step = 0; open = true })
      }
      const { x, y, width: w, height: h, portrait, shortLandscape } = tutorialLayout(W, H, inset)
      const lesson = FLIGHT_LESSONS[step], pad = portrait ? (w < 330 ? 16 : 22) : 30
      const compact = h < 440
      const logoW = tutorialLogoWidth(w, portrait, shortLandscape)
      const logoH = logoW * 733 / 2145
      const metaY = shortLandscape ? logoH * .70 + 1 : logoH * .70 + 6
      const metaW = w - pad * 2
      const progressH = Math.min(24, metaW / 10), nameH = Math.min(24, metaW / (1100 / 120))
      const metaH = portrait ? progressH + nameH + 4 : Math.min(shortLandscape ? 24 : 30, metaW / (shortLandscape ? 12.5 : 20))
      const metaImageW = portrait ? 0 : metaH * (shortLandscape ? 12.5 : 20)
      const segmentW = metaW / FLIGHT_LESSONS.length
      const trackY = metaY + metaH - 18
      const contentTop = metaY + metaH + (shortLandscape ? 8 : 20)
      const footerY = h - (shortLandscape ? 56 : 64), contentH = footerY - contentTop - 12
      const controlW = Math.min(152, (w - pad * 2 - 16) / 3)
      const titleSize = shortLandscape || compact ? 20 : portrait ? 24 : 28
      const bodySize = shortLandscape ? 16 : portrait ? 18 : 20
      const goalSize = shortLandscape ? (w < 640 ? 17 : 22) : compact ? 17 : portrait ? 23 : w < 800 ? 26 : 30
      const titleH = shortLandscape ? 24 : compact ? 32 : portrait ? 56 : 76
      const bodyH = portrait ? (compact ? 88 : 112) : shortLandscape ? 64 : 120
      const goalH = shortLandscape ? 92 : compact ? 64 : portrait ? 80 : 96
      const desiredArtH = shortLandscape ? 0 : portrait ? Math.max(0, Math.min(154, contentH - titleH - bodyH - goalH - 20)) : Math.min(contentH, w * .30)
      const artH = desiredArtH >= 64 ? desiredArtH : 0
      const artW = artH * 4 / 3
      const tx = portrait ? pad : w * (shortLandscape ? .38 : .46)
      const tw = portrait ? w - pad * 2 : w - tx - pad
      const titleY = contentTop + (portrait ? artH : 0)
      const bodyY = titleY + titleH + 4
      const goalY = shortLandscape ? contentTop : bodyY + bodyH + 10
      const goalX = shortLandscape ? pad : tx, goalW = shortLandscape ? tx - pad - 16 : tw
      const body = touch && 'touchBody' in lesson ? lesson.touchBody : shortLandscape || (portrait && compact) ? lesson.shortBody : lesson.body
      const enter = Math.min(1, (clock - changedAt) / .22)
      const slide = Math.max(0, Math.min(8, footerY - goalY - goalH - 8))
      return <UiEntity uiTransform={box(0, 0, W, H)}>
        <UiEntity uiTransform={{ ...box(0, 0, W, H), pointerFilter: 'block' }}
          uiBackground={{ color: Color4.create(.01, .025, .06, .24) }} onMouseDown={() => {}} />
        <UiEntity key="tutorial-panel" uiTransform={{ ...box(x, y, w, h), overflow: 'visible' }}>
          {art('panel', {...box(0, 0, w, h), opacity: .84})}
          <UiEntity key="tutorial-logo" uiTransform={box((w - logoW) / 2, -logoH * .30, logoW, logoH)} uiBackground={{ texture: {
            src: 'assets/ui/endless-vortex-logo.png', filterMode: 'bi-linear', wrapMode: 'clamp'
          }, textureMode: 'stretch' }} />
          <UiEntity key="tutorial-step-description" uiTransform={box(pad, metaY, metaW, metaH)}>
            {portrait ? <UiEntity uiTransform={box(0, 0, metaW, metaH)}>
              {art(`tutorial-step-${step + 1}-progress`, box(0, 0, progressH * 10, progressH))}
              {art(`tutorial-step-${step + 1}-name`, box(0, progressH + 4, nameH * 1100 / 120, nameH))}
            </UiEntity> : art(`tutorial-step-${step + 1}-${shortLandscape ? 'short' : 'full'}`, box(0, 0, metaImageW, metaH))}
          </UiEntity>
          {FLIGHT_LESSONS.map((_, i) => <UiEntity key={'step-' + i}
            uiTransform={{ ...box(pad + i * segmentW, trackY, segmentW, 44), pointerFilter: 'block' }}
            onMouseDown={() => change(() => { step = i })}>
            <UiEntity uiTransform={box(0, 18, segmentW - 5, 3)}
              uiBackground={{ color: i <= step ? gold : Color4.create(.16, .29, .34, 1) }} />
          </UiEntity>)}
          <UiEntity key={'lesson-' + step} uiTransform={{ ...box(0, (1 - enter) * slide, w, h), opacity: .4 + enter * .6 }}>
            {artH > 30 && art(lesson.art, box(portrait ? (w - artW) / 2 : Math.max(0, (tx - artW) / 2),
              portrait ? contentTop - 6 : contentTop + (contentH - artH) / 2, artW, artH))}
            <UiEntity uiTransform={box(tx, titleY, tw, titleH)} uiText={text(lesson.title, titleSize, white)} />
            <UiEntity uiTransform={box(tx, bodyY, tw, bodyH)} uiText={text(body, bodySize, white)} />
            <UiEntity key="goal" uiTransform={box(goalX, goalY, goalW, goalH)}>
              {art('goal', {...box(0, 0, goalW, goalH), opacity: .6})}
              <UiEntity uiTransform={box(14, 3, goalW - 28, 19)} uiText={text('GOAL', 15, cyan)} />
              <UiEntity uiTransform={box(14, 22, goalW - 28, goalH - 25)} uiText={text(lesson.goal, goalSize, gold)} />
            </UiEntity>
          </UiEntity>
          {step > 0 && button('back', 'BACK', box(pad, footerY, controlW, 46), () => { step-- })}
          {button('skip', 'SKIP', box((w - controlW) / 2, footerY, controlW, 46), () => { open = false })}
          {button('next', step === LAST_STEP ? 'LET’S FLY  >' : 'NEXT  >', box(w - pad - controlW, footerY, controlW, 46),
            () => { if (step < LAST_STEP) step++; else open = false }, true)}
        </UiEntity>
      </UiEntity>
    }
  }
}
