import { isOrbRewardDestination } from './orb-reward'
import { Airtime } from './airtime'
import { Point, insideArena } from './arena'
import { clearForTakeoff, touchingLava } from './lava-contact'
import { RockRecovery } from './rock-recovery'
export type SavedFlight = { userId: string; name: string; airtimeMs: number }
export type AuthoritySnapshot = {
  milliseconds: number; phase: string; reason: string; bestMs: number; resultId: number
  result?: { milliseconds: number; record: boolean; valid: boolean }
  rows: (SavedFlight & {rank: number})[]; saved: boolean; ready: boolean
}
type Runner = { run: Airtime; rockRecovery: RockRecovery; previous?: Point; hintAt: number; supported: boolean; rockTouch: boolean; focused: boolean; name: string; resultId: number; result?: AuthoritySnapshot['result']; revision: number }
type Store = { get(): Promise<string | null>; set(value: string): Promise<boolean>; getPlayer?(id:string):Promise<string|null>; setPlayer?(id:string,value:string):Promise<boolean> }
export class FlightAuthority {
  ready = false
  private records = new Map<string, SavedFlight>()
  private runners = new Map<string, Runner>()
  private revision = 0
  private persisted = 0
  private saving = false
  private serial = Date.now()
  private loadedPlayers=new Set<string>()
  private loadingPlayers=new Set<string>()
  private playerAttempt=new Map<string,number>()
  private dirtyPlayers=new Map<string,SavedFlight>()
  constructor(private store: Store) {}
  async load() {
    try {
      const raw = await this.store.get()
      const data = raw ? JSON.parse(raw) : {version: 1, records: []}
      if (data.version !== 1 || !Array.isArray(data.records)) throw new Error('Invalid flight records')
      for (const row of data.records) {
        if (typeof row.userId !== 'string' || typeof row.name !== 'string' || !Number.isSafeInteger(row.airtimeMs) || row.airtimeMs < 0) throw new Error('Invalid flight record')
      }
      this.records = new Map(data.records.map((row: SavedFlight) => [row.userId, row]))
      this.ready = true
    } catch (error) { console.error('Flight records unavailable:', String(error)) }
  }
  async loadPlayer(id:string) {
    if(!this.ready || !this.store.getPlayer || this.loadedPlayers.has(id) || this.loadingPlayers.has(id))return
    const now=Date.now()
    if(now-(this.playerAttempt.get(id)||0)<5000)return
    this.playerAttempt.set(id,now);this.loadingPlayers.add(id)
    try{
      const raw=await this.store.getPlayer(id)
      const saved=raw?JSON.parse(raw):undefined
      if(saved && (saved.userId!==id || typeof saved.name!=='string' || !Number.isSafeInteger(saved.airtimeMs) || saved.airtimeMs<0))throw Error('Invalid personal record')
      const shared=this.records.get(id)
      const row=saved && (!shared || saved.airtimeMs>shared.airtimeMs)?saved:shared
      if(row && (!shared || shared.airtimeMs!==row.airtimeMs || !saved || saved.airtimeMs<row.airtimeMs)){
        this.records.set(id,row);this.dirtyPlayers.set(id,row);this.revision++
        void this.flush()
      }
      this.loadedPlayers.add(id)
    }catch(error){console.error('Personal flight record unavailable:',String(error))}
    finally{this.loadingPlayers.delete(id)}
  }
  private runner(id: string): Runner {
    let value = this.runners.get(id)
    if (!value) {
      value = {run: new Airtime(), rockRecovery: new RockRecovery(), hintAt: 0, supported: false, rockTouch: false, focused: false, name: this.records.get(id)?.name || 'Runner', resultId: 0, revision: 0}
      this.runners.set(id, value)
    }
    return value
  }
  input(verifiedAddress: string, supported: boolean, focused: boolean, name: string, now: number, rockTouch = false) {
    const runner = this.runner(verifiedAddress)
    // These hints can pause/decrease time, never supply a position, time, result or another identity.
    runner.hintAt = now; runner.supported = supported; runner.rockTouch = rockTouch; runner.focused = focused
    runner.name = Array.from(name.replace(/<[^>]*>/g, '').replace(/\u0000/g, '')).slice(0,32).join('') || 'Runner'
  }
  sample(id: string, position: Point, dt: number, now: number, rockSupport = false, rockTouch = false) {
    if (!this.ready) return
    if(this.store.getPlayer && !this.loadedPlayers.has(id)){void this.loadPlayer(id);return}
    const value = this.runner(id), fresh = now - value.hintAt < 750
    const rockHintFresh = now - value.hintAt < 250
    const confirmedRockTouch = rockTouch && rockHintFresh && value.rockTouch
    const confirmedRockSupport = rockSupport && confirmedRockTouch && value.supported
    const supported = confirmedRockSupport || (fresh && value.supported)
    const rockGrace = value.rockRecovery.update(now, confirmedRockTouch, confirmedRockSupport)
    const lava = touchingLava(position, supported || rockGrace)
    const distance = value.previous ? Math.hypot(position.x-value.previous.x,position.y-value.previous.y,position.z-value.previous.z) : 0
    const teleported = !lava && distance > (rockGrace ? 20 : 8) &&
      !(distance < 80 && isOrbRewardDestination(position))
    const previousPhase=value.run.phase
    const finished = value.run.update({dt, wallDt: dt, now, connected: true, inside: insideArena(position), floor: lava,
      supported, airborne: clearForTakeoff(position,supported), moved: false, teleported, focused: fresh && value.focused})
    value.previous = {...position}
    if (previousPhase === 'finished' && value.run.phase === 'airborne') { value.result=undefined;value.resultId=0 }
    if (!finished) return
    const result = value.run.result!
    const best = this.records.get(id)?.airtimeMs || 0
    value.resultId = ++this.serial
    value.result = {milliseconds: result.milliseconds, record: result.valid && result.milliseconds > best, valid: result.valid}
    if (result.valid && result.milliseconds > best) {
      const row={userId:id,name:value.name,airtimeMs:result.milliseconds}
      this.records.set(id,row);this.dirtyPlayers.set(id,row)
      value.revision = ++this.revision
      void this.flush()
    }
  }
  leave(id: string) { this.runners.delete(id) }
  snapshot(id: string): AuthoritySnapshot {
    const value = this.runner(id)
    const sorted = [...this.records.values()].sort((a,b)=>b.airtimeMs-a.airtimeMs || a.userId.localeCompare(b.userId))
    let rank = 0
    const rows = sorted.map((row,index)=>{ if (!index || row.airtimeMs !== sorted[index-1].airtimeMs) rank=index+1;return {...row,rank} })
    const own = rows.find(row=>row.userId===id), top=rows.slice(0,10)
    if (own && !top.some(row=>row.userId===id)) top.push(own)
    return {milliseconds:value.run.milliseconds,phase:value.run.phase,reason:value.run.reason,bestMs:this.records.get(id)?.airtimeMs||0,
      resultId:value.resultId,result:value.result,rows:top,saved:this.ready && this.persisted>=this.revision,ready:this.ready && (!this.store.getPlayer||this.loadedPlayers.has(id))}
  }
  async flush() {
    if (!this.ready || this.saving || this.persisted>=this.revision) return
    this.saving = true
    try {
      while (this.persisted<this.revision) {
        const revision=this.revision,payload=JSON.stringify({version:1,records:[...this.records.values()]})
        const players=[...this.dirtyPlayers]
        if(this.store.setPlayer)for(const [id,row] of players){
          const saved=await this.store.setPlayer(id,JSON.stringify(row))
          if(!saved)return
        }
        const ok=await this.store.set(payload)
        if (!ok) return // Keep dirty; the periodic checkpoint retries this exact progress.
        this.persisted=revision
        for(const [id,row] of players)if(this.dirtyPlayers.get(id)===row)this.dirtyPlayers.delete(id)
      }
    } catch (error) { console.error('Flight save pending:', String(error)) }
    finally { this.saving=false }
  }
}
