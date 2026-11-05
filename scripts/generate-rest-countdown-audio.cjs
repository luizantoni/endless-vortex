// Generate the teleport hit and the shorter chime used for the final countdown.
const fs = require('node:fs')
const rate = 32000
const sine = cycles => Math.sin(cycles * 2 * Math.PI)

function writeWave(filename, duration, sample) {
  const frames = Math.round(rate * duration)
  const wave = Buffer.alloc(44 + frames * 2)
  wave.write('RIFF', 0)
  wave.writeUInt32LE(wave.length - 8, 4)
  wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16)
  wave.writeUInt16LE(1, 20)
  wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(rate, 24)
  wave.writeUInt32LE(rate * 2, 28)
  wave.writeUInt16LE(2, 32)
  wave.writeUInt16LE(16, 34)
  wave.write('data', 36)
  wave.writeUInt32LE(frames * 2, 40)
  for (let i = 0; i < frames; i++) {
    const t = i / rate
    const value = sample(t) * Math.min(1, t / .013, (duration - t) / .045)
    wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2)
  }
  fs.writeFileSync(`assets/sounds/${filename}.wav`, wave)
}

writeWave('rest-countdown', .44, t => {
  const bass = .36 * Math.exp(-13 * t) * sine(62 * t + 4 * (1 - Math.exp(-12 * t)))
  const bell = Math.exp(-7 * t) * (.32 * sine(523.25 * t) + .15 * sine(784.88 * t) + .08 * sine(1046.5 * t))
  return bass + bell
})

writeWave('orb-teleport-flash', 1.02, t => {
  const impact = .43 * Math.exp(-8 * t) * sine(49 * t + 4 * (1 - Math.exp(-16 * t)))
  const chord = Math.exp(-3.9 * t) * (.22 * sine(261.63 * t) + .15 * sine(392 * t) + .12 * sine(523.25 * t))
  const glint = .12 * Math.exp(-5 * t) * sine(740 * t + 910 * t * t)
  return impact + chord + glint
})

// Prism fanfare: a low impact, a quick rising arpeggio, and a shimmering major chord.
writeWave('rainbow-orb-reward', 1.48, t => {
  const impact = .32 * Math.exp(-7 * t) * sine(56 * t + 3 * (1 - Math.exp(-12 * t)))
  const notes = [392, 493.88, 587.33, 783.99, 987.77]
  const arpeggio = notes.reduce((sum, hz, i) => {
    const age = t - i * .068
    if (age < 0) return sum
    return sum + .21 * Math.min(1, age / .018) * Math.exp(-3.7 * age) *
      (sine(hz * age) + .24 * sine(2.01 * hz * age))
  }, 0)
  const chord = .12 * Math.exp(-2.4 * t) * (sine(196 * t) + sine(293.66 * t))
  return impact + arpeggio + chord
})
