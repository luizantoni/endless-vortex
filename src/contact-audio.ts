import { AudioSource, engine, Transform } from '@dcl/sdk/ecs'

// Each obstacle type has its own source, so contact sounds can overlap pickups and music.
export function createContactSound(clip: string, volume = 0.5): () => void {
  const source = engine.addEntity()
  Transform.create(source, { parent: engine.PlayerEntity })
  AudioSource.create(source, { audioClipUrl: clip, playing: false, loop: false, global: true, volume })
  return () => { AudioSource.playSound(source, clip, true) }
}
