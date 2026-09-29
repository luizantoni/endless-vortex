import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export const hud = {
  seconds: '0.000', best: '0.000', status: 'READY', detail: 'Leave the launch deck to begin',
  day: '', medals: 'Medals: 15 / 30 / 60 seconds', storage: 'Connecting to records…',
  volume: 50, danger: false, rows: ['No weekly records yet'], week: '', open: false
}
const white = Color4.create(0.9, 0.97, 1, 1)
const ink = Color4.create(0.025, 0.055, 0.1, 0.92)
export function setupUi(actions: { replay: () => void; volume: () => void; refresh: () => void }) {
  ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity uiTransform={{ positionType: 'absolute', position: { top: '3%', left: '3%' }, width: '94%',
      height: 225, flexDirection: 'column', alignItems: 'center' }}>
      <UiEntity uiTransform={{ width: '100%', maxWidth: 520, height: 136, flexDirection: 'column', padding: 6 }}
        uiBackground={{ color: ink }}>
        <UiEntity uiTransform={{ height: 21, width: '100%' }} uiText={{ value: 'ENDLESS VORTEX · AIRTIME', fontSize: 16, color: white }} />
        <UiEntity uiTransform={{ height: 36, width: '100%' }} uiText={{ value: `${hud.seconds}s   BEST ${hud.best}s`, fontSize: 25, color: white }} />
        <UiEntity uiTransform={{ height: 24, width: '100%' }} uiText={{ value: `${hud.status} · ${hud.detail}`, fontSize: 13,
          color: hud.danger ? Color4.create(1, 0.45, 0.2, 1) : white }} />
        <UiEntity uiTransform={{ height: 21, width: '100%' }} uiText={{ value: hud.medals, fontSize: 12, color: white }} />
        <UiEntity uiTransform={{ height: 20, width: '100%' }} uiText={{ value: hud.storage, fontSize: 11, color: white }} />
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', maxWidth: 520, height: 48, flexDirection: 'row', margin: { top: 4 } }}>
        {button('REPLAY', actions.replay)}
        {button(`FX ${hud.volume}%`, actions.volume)}
        {button(hud.open ? 'CLOSE' : 'WEEKLY', () => { hud.open = !hud.open; if (hud.open) actions.refresh() })}
      </UiEntity>
      <UiEntity uiTransform={{ width: '100%', maxWidth: 520, height: 35 }} uiBackground={{ color: ink }}
        uiText={{ value: hud.danger ? 'FLOOR ENDS RUN — steer toward a bubble' : 'Steer + jump · round deck = rest · diamond ↓ = push', fontSize: 12, color: white }} />
      {hud.open ? <UiEntity uiTransform={{ width: '100%', maxWidth: 520, height: 275, padding: 8, flexDirection: 'column' }} uiBackground={{ color: ink }}>
        <UiEntity uiTransform={{ width: '100%', height: 28 }} uiText={{ value: `WEEK ${hud.week} · daily ${hud.day}`, fontSize: 13, color: white }} />
        {hud.rows.slice(0, 10).map(row => <UiEntity uiTransform={{ width: '100%', height: 22 }} uiText={{ value: row, fontSize: 13, color: white }} />)}
      </UiEntity> : null}
    </UiEntity>
  ))
}
function button(text: string, action: () => void) {
  return <UiEntity uiTransform={{ width: '33.33%', height: 48, margin: { right: 2 } }}
    uiBackground={{ color: Color4.create(0.08, 0.28, 0.38, 0.96) }}
    uiText={{ value: text, fontSize: 14, color: white }} onMouseDown={action} />
}
