export type FlightPopup = { id: number; milliseconds: number; record: boolean; valid: boolean; saved: boolean; provisional?: boolean; recordKnown?: boolean; presentationId?: number }
type FeedbackDisplay = { result?: FlightPopup; resultEvent?: FlightPopup }
/** Result events outlive the current grounded state; takeoff cannot swallow the popup. */
export function presentFlightResult(display: FeedbackDisplay, result: FlightPopup) {
  const previous=display.resultEvent
  const reconciles=previous?.provisional && !result.provisional
  const event={...result,presentationId:reconciles ? previous.presentationId??previous.id : result.presentationId??result.id}
  // Repeated server snapshots update save status without restarting the presentation.
  if(previous?.id===result.id)event.presentationId=previous.presentationId??previous.id
  display.result=event;display.resultEvent=event
}
let localId=0
export function presentLanding(display: FeedbackDisplay, milliseconds:number, bestMs?:number) {
  if(!Number.isFinite(milliseconds)||milliseconds<=0)return
  presentFlightResult(display,{id:--localId,milliseconds:Math.floor(milliseconds),record:bestMs!==undefined && milliseconds>bestMs,
    recordKnown:bestMs!==undefined,valid:true,saved:false,provisional:true})
}
