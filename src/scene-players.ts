import { getPlayer, onEnterScene, onLeaveScene } from '@dcl/sdk/players'
import { getPlayersInScene } from '~system/Players'
import { Point } from './arena'
/** Presence/clearance only. Scores come exclusively from the hosted flight server. */
export class ScenePlayers {
  private entries = new Map<string, Point | undefined>()
  private clock = 5
  private discovering = false
  constructor() {
    onEnterScene(player => this.entries.set(player.userId, player.position))
    onLeaveScene(id => this.entries.delete(id))
  }
  positions(): Point[] {
    const self=getPlayer()
    if(self)this.entries.set(self.userId,self.position)
    for(const id of this.entries.keys()){
      const player=getPlayer({userId:id})
      if(player?.position)this.entries.set(id,{...player.position})
    }
    return [...this.entries.values()].flatMap(point=>point?[{...point}]:[])
  }
  update(dt:number) {
    this.clock+=dt
    if(this.clock<5 || this.discovering || typeof getPlayersInScene!=='function')return
    this.clock=0;this.discovering=true
    void getPlayersInScene({}).then(result=>{
      for(const {userId} of result.players){
        const player=getPlayer({userId})
        if(player)this.entries.set(userId,player.position)
      }
    }).catch(()=>{}).finally(()=>{this.discovering=false})
  }
}
