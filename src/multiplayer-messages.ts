import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'
export const flightRoom = registerMessages({
  // No score, identity or position is accepted from a client.
  flightInput: Schemas.Map({ supported: Schemas.Boolean, rockTouch: Schemas.Boolean,
    focused: Schemas.Boolean, name: Schemas.String }),
  flightState: Schemas.Map({ payload: Schemas.String })
})
