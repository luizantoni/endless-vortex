import ReactEcs, { UiEntity, UiTransformProps } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

const ROOT = 'assets/ui/tutorial/'
const gold = Color4.create(1, .83, .49, 1), cyan = Color4.create(.55, .96, .92, 1)
const white = Color4.create(.93, .97, .97, 1)
export const FLIGHT_LESSONS = [
  { name: 'THE UPDRAFT', title: 'Meet your\nsecond wind.', art: 'flight',
    body: 'Enter the central vortex to receive lift. Ride upward, then steer and glide to stay in the air.',
    shortBody: 'Enter the central vortex for lift. Ride upward, then steer and glide.',
    goal: 'STAY AIRBORNE.',
    keyboard: 'ESC  ·  cursor     W A S D  ·  steer     SPACE  ·  jump', touch: 'Drag the movement stick. Tap the jump control.', cue: 'FIRST FLIGHT  /  Catch the central current' },
  { name: 'STEER & GLIDE', title: 'Find your flow.', art: 'glide',
    body: 'Ride the central current to gain height. Glide toward the golden orbs, then return to the vortex to climb again.',
    shortBody: 'Ride the current to climb. Glide toward golden orbs, then return to the central vortex.',
    goal: 'FIND YOUR FLOW.',
    keyboard: 'Use your Explorer’s native jump and glide controls.', touch: 'Use the Explorer’s on-screen jump and glide controls.', cue: 'FLIGHT PATH  /  Rise, glide, return' },
  { name: 'GOLDEN ORBS', title: 'Five sparks.\nBack to the sky.', art: 'orbs',
    body: 'Orbs give a small boost. Every fifth sphere returns you above the vortex floor, then lifts you upward. Your airtime keeps running.',
    shortBody: 'Orbs give a boost. Every fifth sphere lifts you from the vortex center. Your airtime keeps running.',
    goal: 'COLLECT 5 SPHERES.',
    keyboard: 'No interaction key needed. Fly into an orb to collect it.', touch: 'No extra tap needed. Fly into an orb to collect it.', cue: 'ORB CHAIN  /  Collect 5 for a return to the sky' },
  { name: 'LIVING PLATFORMS', title: 'Rest. Then rise.', art: 'leaf',
    body: 'Leaves keep moving and fall 0.3 seconds after contact. Standing pauses airtime. Jump off quickly. Rocks fall too.',
    shortBody: 'Leaves keep moving and drop 0.3 seconds after contact. Jump off quickly.',
    goal: 'JUMP. DON’T WAIT.',
    keyboard: 'Steer toward a leaf. Jump back into the current.', touch: 'Guide your landing, then tap jump to leave the leaf.', cue: 'QUICK RECOVERY  /  Leaves buy time, not safety' },
  { name: 'CHASE YOUR BEST', title: 'Make every\nsecond count.', art: 'airtime',
    body: 'Airborne time is your score. Blue lava locks your result; take off to start fresh. Earn a new flight rank every 100 airborne seconds.',
    shortBody: 'Blue lava locks your score. Take off to start fresh. Earn a new flight rank every 100 airborne seconds.',
    goal: 'BEAT YOUR BEST.',
    keyboard: 'Press ESC to free the cursor when you need this guide.', touch: 'Reopen FLIGHT GUIDE from the HUD whenever you need it.', cue: 'YOU ARE READY  /  The sky is yours' }
] as const

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
        const word = id === 'reopen' ? 'flight-guide' : id === 'skip' ? 'skip' : id === 'back' ? 'back' : step === 4 ? 'fly' : 'next'
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
      const trackY = metaY + metaH - 18
      const contentTop = metaY + metaH + (shortLandscape ? 8 : 20)
      const footerY = h - (shortLandscape ? 56 : 64), contentH = footerY - contentTop - 12
      const controlW = Math.min(152, (w - pad * 2 - 16) / 3)
      const titleSize = shortLandscape || compact ? 20 : portrait ? 24 : 28
      const bodySize = shortLandscape ? 16 : portrait ? 18 : 20
      const goalSize = shortLandscape && w < 640 ? 22 : compact ? 24 : portrait ? (w < 330 ? 25 : 28) : w < 800 ? 30 : 36
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
      const controlsY = goalY + goalH + 8
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
            uiTransform={{ ...box(pad + i * (w - pad * 2) / 5, trackY, (w - pad * 2) / 5, 44), pointerFilter: 'block' }}
            onMouseDown={() => change(() => { step = i })}>
            <UiEntity uiTransform={box(0, 18, (w - pad * 2) / 5 - 5, 3)}
              uiBackground={{ color: i <= step ? gold : Color4.create(.16, .29, .34, 1) }} />
          </UiEntity>)}
          <UiEntity key={'lesson-' + step} uiTransform={{ ...box(0, (1 - enter) * slide, w, h), opacity: .4 + enter * .6 }}>
            {artH > 30 && art(lesson.art, box(portrait ? (w - artW) / 2 : Math.max(0, (tx - artW) / 2),
              portrait ? contentTop - 6 : contentTop + (contentH - artH) / 2, artW, artH))}
            <UiEntity uiTransform={box(tx, titleY, tw, titleH)} uiText={text(lesson.title.replace('\n', ' '), titleSize, white)} />
            <UiEntity uiTransform={box(tx, bodyY, tw, bodyH)} uiText={text(shortLandscape || (portrait && compact) ? lesson.shortBody : lesson.body, bodySize, white)} />
            <UiEntity key="goal" uiTransform={box(goalX, goalY, goalW, goalH)}>
              {art('goal', {...box(0, 0, goalW, goalH), opacity: .6})}
              <UiEntity uiTransform={box(14, 4, goalW - 28, 24)} uiText={text('GOAL', 18, cyan)} />
              <UiEntity uiTransform={box(14, 30, goalW - 28, goalH - 34)} uiText={text(lesson.goal, goalSize, gold)} />
            </UiEntity>
            {controlsY + 34 <= footerY - 6 && <UiEntity uiTransform={box(tx, controlsY, tw, 34)}
              uiText={text(touch ? lesson.touch : lesson.keyboard, 13, cyan)} />}
          </UiEntity>
          {step > 0 && button('back', 'BACK', box(pad, footerY, controlW, 46), () => { step-- })}
          {button('skip', 'SKIP', box((w - controlW) / 2, footerY, controlW, 46), () => { open = false })}
          {button('next', step === 4 ? 'LET’S FLY  >' : 'NEXT  >', box(w - pad - controlW, footerY, controlW, 46),
            () => { if (step < 4) step++; else open = false }, true)}
        </UiEntity>
      </UiEntity>
    }
  }
}
