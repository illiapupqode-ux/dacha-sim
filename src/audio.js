/**
 * Procedural gloomy "MIDI" BGM (dark Serious Sam–adjacent) + SFX.
 * No external assets — Web Audio oscillators / noise only.
 */

const BPM = 96
const BEAT = 60 / BPM
const STEP = BEAT / 4 // 16th
const MUSIC_GAIN = 0.32
const SFX_GAIN = 0.9

const LS_MUSIC = 'dacha-music'
const LS_SFX = 'dacha-sfx'

/** Sparse low lead — E Phrygian / diminished dread. */
const LEAD = [
  // bar 1 — crawling
  [52, 4], [0, 2], [51, 2], [52, 4], [48, 4],
  // bar 2 — tritone pull
  [55, 4], [54, 4], [52, 2], [51, 2], [48, 4],
  // bar 3 — hollow climb
  [52, 2], [0, 2], [55, 2], [58, 2], [57, 4], [55, 4],
  // bar 4 — sink
  [54, 4], [52, 4], [51, 4], [48, 2], [46, 2],
]

/** Deep bass drone roots. */
const BASS = [
  28, 28, 28, 28, 28, 28, 31, 31,
  27, 27, 27, 27, 26, 26, 28, 28,
  28, 28, 31, 31, 34, 34, 33, 33,
  31, 31, 27, 27, 28, 28, 26, 26,
]

/** Dark pad / stab roots (low). */
const STABS = [40, 39, 40, 43, 40, 38, 39, 40]

function midiToHz(m) {
  return 440 * 2 ** ((m - 69) / 12)
}

function expandLead(pattern) {
  const steps = []
  for (const [note, dur] of pattern) {
    steps.push(note)
    for (let i = 1; i < dur; i++) steps.push(-1)
  }
  return steps
}

const LEAD_STEPS = expandLead(LEAD)

function readFlag(key, fallback = true) {
  try {
    const v = localStorage.getItem(key)
    if (v == null) return fallback
    return v === '1' || v === 'true'
  } catch {
    return fallback
  }
}

function writeFlag(key, v) {
  try {
    localStorage.setItem(key, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function createAudio() {
  let ctx = null
  let master = null
  let musicBus = null
  let musicFilter = null
  let sfxBus = null
  let musicPlaying = false
  let menuPaused = false
  let musicEnabled = readFlag(LS_MUSIC, true)
  let sfxEnabled = readFlag(LS_SFX, true)
  let nextStepAt = 0
  let stepIndex = 0
  let schedId = 0

  const ensure = () => {
    if (ctx) return ctx
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.85
    master.connect(ctx.destination)

    musicFilter = ctx.createBiquadFilter()
    musicFilter.type = 'lowpass'
    musicFilter.frequency.value = 1800
    musicFilter.Q.value = 0.6
    musicFilter.connect(master)

    musicBus = ctx.createGain()
    musicBus.gain.value = musicEnabled ? MUSIC_GAIN : 0.0001
    musicBus.connect(musicFilter)

    sfxBus = ctx.createGain()
    sfxBus.gain.value = sfxEnabled ? SFX_GAIN : 0.0001
    sfxBus.connect(master)
    return ctx
  }

  const applyMusicGain = () => {
    if (!musicBus || !ctx) return
    const now = ctx.currentTime
    const target = !musicEnabled ? 0.0001 : menuPaused ? 0.06 : MUSIC_GAIN
    musicBus.gain.cancelScheduledValues(now)
    musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), now)
    musicBus.gain.linearRampToValueAtTime(target, now + 0.12)
  }

  const applySfxGain = () => {
    if (!sfxBus || !ctx) return
    sfxBus.gain.setValueAtTime(sfxEnabled ? SFX_GAIN : 0.0001, ctx.currentTime)
  }

  const resume = async () => {
    ensure()
    if (ctx.state === 'suspended') await ctx.resume()
  }

  const noiseBuffer = (seconds = 0.2) => {
    ensure()
    const n = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  let sharedNoise = null
  const getNoise = () => {
    if (!sharedNoise) sharedNoise = noiseBuffer(1)
    return sharedNoise
  }

  const tone = (freq, t0, dur, type, gain, bus, { attack = 0.01, release = 0.08, detune = 0 } = {}) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (detune) o.detune.setValueAtTime(detune, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.01, dur - release))
    o.connect(g)
    g.connect(bus)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }

  const kick = (t0) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(110, t0)
    o.frequency.exponentialRampToValueAtTime(32, t0 + 0.18)
    g.gain.setValueAtTime(0.75, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)
    o.connect(g)
    g.connect(musicBus)
    o.start(t0)
    o.stop(t0 + 0.3)
  }

  const snare = (t0) => {
    const src = ctx.createBufferSource()
    src.buffer = getNoise()
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 900
    f.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.28, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
    src.connect(f)
    f.connect(g)
    g.connect(musicBus)
    src.start(t0)
    src.stop(t0 + 0.18)
    tone(140, t0, 0.08, 'triangle', 0.1, musicBus, { attack: 0.001, release: 0.05 })
  }

  const hat = (t0) => {
    const src = ctx.createBufferSource()
    src.buffer = getNoise()
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 4500
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.035, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04)
    src.connect(f)
    f.connect(g)
    g.connect(musicBus)
    src.start(t0)
    src.stop(t0 + 0.05)
  }

  const scheduleStep = (t0, i) => {
    if (!musicEnabled) return
    const barStep = i % 32
    const sixteenth = barStep % 16

    // sparse gloomy drums
    if (sixteenth === 0 || sixteenth === 8) kick(t0)
    if (sixteenth === 4 || sixteenth === 12) snare(t0)
    if (sixteenth === 6 || sixteenth === 14) hat(t0)

    // bass drone
    const bassNote = BASS[barStep % BASS.length]
    if (bassNote && sixteenth % 2 === 0) {
      tone(midiToHz(bassNote), t0, STEP * 1.7, 'sawtooth', 0.2, musicBus, {
        attack: 0.02,
        release: 0.1,
      })
      tone(midiToHz(bassNote + 12), t0, STEP * 1.7, 'triangle', 0.05, musicBus, {
        attack: 0.03,
        release: 0.12,
        detune: -12,
      })
    }

    // dark pad stab
    if (sixteenth % 8 === 0) {
      const root = STABS[((barStep / 8) | 0) % STABS.length]
      ;[0, 3, 6].forEach((off, k) => {
        tone(midiToHz(root + off), t0, STEP * 5.5, 'sawtooth', 0.07 - k * 0.015, musicBus, {
          attack: 0.04,
          release: 0.25,
          detune: k * 4,
        })
      })
    }

    // low lead
    const lead = LEAD_STEPS[i % LEAD_STEPS.length]
    if (lead > 0) {
      tone(midiToHz(lead), t0, STEP * 2.4, 'triangle', 0.14, musicBus, {
        attack: 0.02,
        release: 0.12,
      })
      tone(midiToHz(lead), t0, STEP * 2.4, 'square', 0.045, musicBus, {
        attack: 0.02,
        release: 0.12,
        detune: -6,
      })
    }
  }

  const tickSched = () => {
    if (!musicPlaying || !ctx) return
    const ahead = 0.25
    while (nextStepAt < ctx.currentTime + ahead) {
      scheduleStep(nextStepAt, stepIndex)
      nextStepAt += STEP
      stepIndex++
    }
    schedId = window.setTimeout(tickSched, 40)
  }

  const startMusic = async () => {
    await resume()
    applyMusicGain()
    applySfxGain()
    if (musicPlaying) return
    if (!musicEnabled) return
    musicPlaying = true
    stepIndex = 0
    nextStepAt = ctx.currentTime + 0.05
    clearTimeout(schedId)
    tickSched()
  }

  const stopMusic = () => {
    musicPlaying = false
    clearTimeout(schedId)
  }

  const setPaused = (paused) => {
    menuPaused = !!paused
    ensure()
    applyMusicGain()
  }

  const setMusicEnabled = (on) => {
    musicEnabled = !!on
    writeFlag(LS_MUSIC, musicEnabled)
    ensure()
    applyMusicGain()
    if (musicEnabled) {
      if (!musicPlaying) startMusic()
    } else {
      stopMusic()
    }
  }

  const setSfxEnabled = (on) => {
    sfxEnabled = !!on
    writeFlag(LS_SFX, sfxEnabled)
    ensure()
    applySfxGain()
  }

  /** Bolt / hunting rifle crack — sharp transient + body boom (not airgun). */
  const playShoot = async () => {
    if (!sfxEnabled) return
    await resume()
    const t0 = ctx.currentTime

    // sharp crack (high transient)
    const crack = ctx.createBufferSource()
    crack.buffer = getNoise()
    const crackHp = ctx.createBiquadFilter()
    crackHp.type = 'highpass'
    crackHp.frequency.value = 2800
    crackHp.Q.value = 0.7
    const crackG = ctx.createGain()
    crackG.gain.setValueAtTime(1.15, t0)
    crackG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045)
    crack.connect(crackHp)
    crackHp.connect(crackG)
    crackG.connect(sfxBus)
    crack.start(t0)
    crack.stop(t0 + 0.05)

    // mid bark
    const bark = ctx.createBufferSource()
    bark.buffer = getNoise()
    const barkBp = ctx.createBiquadFilter()
    barkBp.type = 'bandpass'
    barkBp.frequency.setValueAtTime(900, t0)
    barkBp.frequency.exponentialRampToValueAtTime(320, t0 + 0.12)
    barkBp.Q.value = 1.1
    const barkG = ctx.createGain()
    barkG.gain.setValueAtTime(0.95, t0)
    barkG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
    bark.connect(barkBp)
    barkBp.connect(barkG)
    barkG.connect(sfxBus)
    bark.start(t0)
    bark.stop(t0 + 0.18)

    // low boom / recoil body
    const boom = ctx.createOscillator()
    const boomG = ctx.createGain()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(130, t0)
    boom.frequency.exponentialRampToValueAtTime(38, t0 + 0.22)
    boomG.gain.setValueAtTime(0.95, t0)
    boomG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)
    boom.connect(boomG)
    boomG.connect(sfxBus)
    boom.start(t0)
    boom.stop(t0 + 0.3)

    // metallic ring
    tone(1850, t0, 0.09, 'triangle', 0.18, sfxBus, { attack: 0.001, release: 0.07 })
    tone(920, t0 + 0.01, 0.07, 'square', 0.06, sfxBus, { attack: 0.001, release: 0.05 })

    // short room tail
    const tail = ctx.createBufferSource()
    tail.buffer = getNoise()
    const tailLp = ctx.createBiquadFilter()
    tailLp.type = 'lowpass'
    tailLp.frequency.setValueAtTime(700, t0)
    tailLp.frequency.exponentialRampToValueAtTime(180, t0 + 0.25)
    const tailG = ctx.createGain()
    tailG.gain.setValueAtTime(0.0001, t0)
    tailG.gain.linearRampToValueAtTime(0.28, t0 + 0.02)
    tailG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)
    tail.connect(tailLp)
    tailLp.connect(tailG)
    tailG.connect(sfxBus)
    tail.start(t0)
    tail.stop(t0 + 0.34)
  }

  const playMobDeath = async () => {
    if (!sfxEnabled) return
    await resume()
    const t0 = ctx.currentTime

    const moan = ctx.createOscillator()
    const mg = ctx.createGain()
    moan.type = 'sawtooth'
    moan.frequency.setValueAtTime(220, t0)
    moan.frequency.exponentialRampToValueAtTime(55, t0 + 0.35)
    mg.gain.setValueAtTime(0.35, t0)
    mg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4)
    moan.connect(mg)
    mg.connect(sfxBus)
    moan.start(t0)
    moan.stop(t0 + 0.42)

    const src = ctx.createBufferSource()
    src.buffer = getNoise()
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(1400, t0)
    f.frequency.exponentialRampToValueAtTime(200, t0 + 0.28)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.55, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32)
    src.connect(f)
    f.connect(g)
    g.connect(sfxBus)
    src.start(t0)
    src.stop(t0 + 0.35)

    tone(90, t0, 0.12, 'sine', 0.4, sfxBus, { attack: 0.002, release: 0.08 })
  }

  return {
    resume,
    startMusic,
    stopMusic,
    setPaused,
    setMusicEnabled,
    setSfxEnabled,
    isMusicEnabled: () => musicEnabled,
    isSfxEnabled: () => sfxEnabled,
    playShoot,
    playMobDeath,
  }
}
