/** Rock protection exists only while the player's capsule touches an active collider. */
export class RockRecovery {
  static readonly durationMs = 1500
  private safeUntil = 0
  private wasTouching = false

  update(now: number, touching: boolean, supported: boolean): boolean {
    if (!touching) {
      this.safeUntil = 0
      this.wasTouching = false
      return false
    }
    if (supported || (touching && !this.wasTouching)) {
      this.safeUntil = now + RockRecovery.durationMs
    }
    this.wasTouching = touching
    return this.safeUntil > now
  }
}
