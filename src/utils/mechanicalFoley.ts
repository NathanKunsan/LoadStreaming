// Hyper-Realistic Multi-Layered Acoustic Mechanical Foley Engine
// Sample-level physical modal synthesis + broadband contact transients + stereo early reflections

type FilterType = 'lowpass' | 'highpass' | 'bandpass';

function biquadFilter(
  input: Float32Array,
  sr: number,
  type: FilterType,
  freq: number,
  Q: number
): Float32Array {
  const out = new Float32Array(input.length);
  const clampedFreq = Math.max(20, Math.min(sr * 0.46, freq));
  const w0 = (2 * Math.PI * clampedFreq) / sr;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * Math.max(0.1, Q));

  let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

  if (type === 'lowpass') {
    b0 = (1 - cosw0) / 2;
    b1 = 1 - cosw0;
    b2 = (1 - cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw0) / 2;
    b1 = -(1 + cosw0);
    b2 = (1 + cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  }

  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

// Deterministic fast PRNG so cached buffers have consistent studio-grade micro-transients
function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

interface ModalSpec {
  freq: number;
  decay: number;
  gain: number;
}

function addModalImpact(
  left: Float32Array,
  right: Float32Array,
  sr: number,
  offsetSec: number,
  amp: number,
  modes: ModalSpec[],
  hardnessFreq: number,
  transientMs: number,
  pan = 0,
  bounceDelayMs = 0,
  bounceGain = 0.28,
  seed = 1337
) {
  const rng = createRng(seed);
  const renderSingle = (startSec: number, scale: number) => {
    const startIdx = Math.max(0, Math.floor(startSec * sr));
    const maxDecay = Math.max(...modes.map((m) => m.decay), 0.015);
    const len = Math.min(left.length - startIdx, Math.floor(maxDecay * 6.5 * sr));
    if (len <= 0) return;

    const lPan = Math.cos(((pan + 1) * Math.PI) / 4);
    const rPan = Math.sin(((pan + 1) * Math.PI) / 4);

    // Broadband physical contact impulse
    const transSamples = Math.max(8, Math.floor((transientMs / 1000) * sr));
    const noiseBurst = new Float32Array(Math.min(len, transSamples * 3));
    for (let i = 0; i < noiseBurst.length; i++) {
      const env = Math.exp((-i / transSamples) * 2.6);
      noiseBurst[i] = rng() * env;
    }
    const shapedBurst = biquadFilter(noiseBurst, sr, 'bandpass', hardnessFreq, 1.35);

    for (let i = 0; i < shapedBurst.length; i++) {
      const v = shapedBurst[i] * scale * 1.35;
      left[startIdx + i] += v * lPan;
      right[startIdx + i] += v * rPan;
    }

    // Multi-modal body resonance (plastic shell / stamped metal / rubber stop)
    for (const mode of modes) {
      const omega = (2 * Math.PI * mode.freq) / sr;
      const tau = mode.decay * sr;
      const phase0 = (rng() * 0.15);
      const modeLen = Math.min(len, Math.floor(tau * 6));
      for (let i = 0; i < modeLen; i++) {
        // Slight pitch drop on initial 2ms of hard impact for realistic nonlinear stiffness
        const bend = 1 + 0.03 * Math.exp(-i / (0.002 * sr));
        const sample = Math.sin(omega * bend * i + phase0) * Math.exp(-i / tau) * mode.gain * scale;
        left[startIdx + i] += sample * lPan;
        right[startIdx + i] += sample * rPan;
      }
    }
  };

  renderSingle(offsetSec, amp);
  if (bounceDelayMs > 0) {
    renderSingle(offsetSec + bounceDelayMs / 1000, amp * bounceGain);
  }
}

function addSlidingFriction(
  left: Float32Array,
  right: Float32Array,
  sr: number,
  offsetSec: number,
  durSec: number,
  amp: number,
  freqStart: number,
  freqEnd: number,
  pan = 0,
  seed = 4242
) {
  const rng = createRng(seed);
  const startIdx = Math.max(0, Math.floor(offsetSec * sr));
  const len = Math.min(left.length - startIdx, Math.floor(durSec * sr));
  if (len <= 0) return;

  const raw = new Float32Array(len);
  let stickSlip = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const env = Math.sin(Math.PI * Math.pow(p, 0.75));
    // Subtle micro-graininess of textured ABS plastic sliding on metal rails
    if (i % 19 === 0) {
      stickSlip = 0.65 + 0.35 * Math.abs(rng());
    }
    raw[i] = rng() * env * stickSlip;
  }

  const midFreq = (freqStart + freqEnd) * 0.5;
  const bp1 = biquadFilter(raw, sr, 'bandpass', midFreq, 1.9);
  const bp2 = biquadFilter(raw, sr, 'bandpass', midFreq * 2.15, 2.8);

  const lPan = Math.cos(((pan + 1) * Math.PI) / 4);
  const rPan = Math.sin(((pan + 1) * Math.PI) / 4);

  for (let i = 0; i < len; i++) {
    const v = (bp1[i] * 0.7 + bp2[i] * 0.45) * amp;
    left[startIdx + i] += v * lPan;
    right[startIdx + i] += v * rPan;
  }
}

function addDcMotorMechanism(
  left: Float32Array,
  right: Float32Array,
  sr: number,
  offsetSec: number,
  durSec: number,
  amp: number,
  baseHzStart: number,
  baseHzEnd: number,
  seed = 7777
) {
  const rng = createRng(seed);
  const startIdx = Math.max(0, Math.floor(offsetSec * sr));
  const len = Math.min(left.length - startIdx, Math.floor(durSec * sr));
  if (len <= 0) return;

  const gearNoise = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    gearNoise[i] = rng();
  }
  const filteredGear = biquadFilter(gearNoise, sr, 'bandpass', 1480, 3.4);

  let phase = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    // Fast 18ms spin-up, steady load, crisp 20ms dynamic brake stop
    const attack = Math.min(1, i / (0.018 * sr));
    const release = Math.min(1, (len - i) / (0.022 * sr));
    const env = attack * release;

    // Subtle mechanical torque sag in the middle of carriage travel
    const loadCurve = baseHzStart + (baseHzEnd - baseHzStart) * p - 12 * Math.sin(Math.PI * p);
    phase += (2 * Math.PI * loadCurve) / sr;

    // Commutator brush harmonics + nylon worm gear mesh
    const brush =
      Math.sin(phase) * 0.35 +
      Math.sin(phase * 2) * 0.22 +
      Math.sin(phase * 3) * 0.18 +
      Math.sin(phase * 6) * 0.09;
    const gearMod = 0.65 + 0.35 * Math.sin(phase * 3);
    const sample = (brush * 0.52 + filteredGear[i] * 0.68 * gearMod) * env * amp;

    left[startIdx + i] += sample * 0.96;
    right[startIdx + i] += sample * 1.04;
  }
}

function finalizeBufferWithMicroRoom(
  ctx: AudioContext,
  left: Float32Array,
  right: Float32Array,
  roomMix = 0.14
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = left.length;
  const buffer = ctx.createBuffer(2, len, sr);
  const outL = buffer.getChannelData(0);
  const outR = buffer.getChannelData(1);

  // Short desktop early reflections (7.3ms, 13.9ms, 21.4ms) + soft saturation
  const d1 = Math.floor(0.0073 * sr);
  const d2 = Math.floor(0.0139 * sr);
  const d3 = Math.floor(0.0214 * sr);

  for (let i = 0; i < len; i++) {
    let l = left[i];
    let r = right[i];
    if (i >= d1) {
      l += right[i - d1] * roomMix * 0.55;
      r += left[i - d1] * roomMix * 0.52;
    }
    if (i >= d2) {
      l += left[i - d2] * roomMix * 0.34;
      r += right[i - d2] * roomMix * 0.36;
    }
    if (i >= d3) {
      l += right[i - d3] * roomMix * 0.18;
      r += left[i - d3] * roomMix * 0.18;
    }
    // Gentle analog soft-clipping ceiling
    outL[i] = Math.tanh(l * 1.05);
    outR[i] = Math.tanh(r * 1.05);
  }
  return buffer;
}

class MechanicalFoleyEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private cache = new Map<string, AudioBuffer>();
  private crackleSource: AudioBufferSourceNode | null = null;
  private crackleGain: GainNode | null = null;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopVinylCrackle();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getAudioContext(): AudioContext | null {
    return this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playCached(key: string, generator: (ctx: AudioContext) => AudioBuffer, gain = 0.85, playbackRate = 1.0) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    let buf = this.cache.get(key);
    if (!buf) {
      buf = generator(ctx);
      this.cache.set(key, buf);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;

    const g = ctx.createGain();
    g.gain.value = gain;

    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  // 1. CRT TV Video Cartridge Insert (Pure Broadband Acoustic Plastic/Metal Foley — Zero Tonal Synth!)
  public playCartridgeInsert() {
    this.playCached('cartridge_insert_v2', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.52);
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const rng = createRng(1101);

      const addBroadbandKnock = (
        timeSec: number,
        amp: number,
        bodyHz: number,
        shellHz: number,
        snapHz: number,
        durMs: number,
        pan = 0
      ) => {
        const sIdx = Math.max(0, Math.floor(timeSec * sr));
        const bLen = Math.min(len - sIdx, Math.floor((durMs / 1000) * sr * 4));
        if (bLen <= 0) return;

        const raw = new Float32Array(bLen);
        const tau = (durMs / 1000) * sr;
        for (let i = 0; i < bLen; i++) {
          // Asymmetric crisp physical pressure spike + fast exponential decay
          const spike = i < 18 ? (1 - i / 18) * 1.4 : 0;
          raw[i] = (rng() * Math.exp(-i / tau) + spike * rng() * 0.5);
        }

        const lowBody = biquadFilter(raw, sr, 'lowpass', bodyHz, 0.9);
        const midShell = biquadFilter(raw, sr, 'bandpass', shellHz, 1.35);
        const highSnap = biquadFilter(raw, sr, 'bandpass', snapHz, 1.75);

        const lG = Math.cos(((pan + 1) * Math.PI) / 4);
        const rG = Math.sin(((pan + 1) * Math.PI) / 4);
        for (let i = 0; i < bLen; i++) {
          const v = (lowBody[i] * 0.65 + midShell[i] * 0.85 + highSnap[i] * 0.72) * amp;
          L[sIdx + i] += v * lG;
          R[sIdx + i] += v * rG;
        }
      };

      // Stage 1 (0.008s): Plastic cartridge shell lip pushing open hinged slot flap
      addBroadbandKnock(0.008, 0.58, 180, 740, 2900, 3.2, -0.06);
      addBroadbandKnock(0.017, 0.22, 210, 920, 3400, 1.8, -0.04);

      // Stage 2 (0.030s - 0.215s): Textured ABS plastic rails sliding along metal slot guides
      addSlidingFriction(L, R, sr, 0.03, 0.185, 0.36, 980, 1680, 0, 1102);

      // Stage 3 (0.185s - 0.255s): Edge connector pins scrubbing snugly into 60-pin socket
      addSlidingFriction(L, R, sr, 0.185, 0.075, 0.42, 2400, 3600, 0.03, 1103);

      // Stage 4 (0.262s): Firm mechanical seat + steel latch catch CLACK-THUD (with realistic 8ms micro-rebound)
      addBroadbandKnock(0.262, 0.92, 135, 620, 3150, 4.8, 0.04);
      addBroadbandKnock(0.271, 0.34, 160, 840, 4100, 2.2, 0.02);

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.12);
    }, 0.88);
  }

  // 2. CRT TV Video Cartridge Eject (Pure Spring-Latch Release & Hollow Plastic Pop-Out — Zero Tonal Synth!)
  public playCartridgeEject() {
    this.playCached('cartridge_eject_v2', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.46);
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const rng = createRng(1201);

      const addBroadbandKnock = (
        timeSec: number,
        amp: number,
        bodyHz: number,
        shellHz: number,
        snapHz: number,
        durMs: number,
        pan = 0
      ) => {
        const sIdx = Math.max(0, Math.floor(timeSec * sr));
        const bLen = Math.min(len - sIdx, Math.floor((durMs / 1000) * sr * 4));
        if (bLen <= 0) return;

        const raw = new Float32Array(bLen);
        const tau = (durMs / 1000) * sr;
        for (let i = 0; i < bLen; i++) {
          const spike = i < 16 ? (1 - i / 16) * 1.35 : 0;
          raw[i] = (rng() * Math.exp(-i / tau) + spike * rng() * 0.45);
        }

        const lowBody = biquadFilter(raw, sr, 'lowpass', bodyHz, 0.95);
        const midShell = biquadFilter(raw, sr, 'bandpass', shellHz, 1.4);
        const highSnap = biquadFilter(raw, sr, 'bandpass', snapHz, 1.85);

        const lG = Math.cos(((pan + 1) * Math.PI) / 4);
        const rG = Math.sin(((pan + 1) * Math.PI) / 4);
        for (let i = 0; i < bLen; i++) {
          const v = (lowBody[i] * 0.58 + midShell[i] * 0.88 + highSnap[i] * 0.76) * amp;
          L[sIdx + i] += v * lG;
          R[sIdx + i] += v * rG;
        }
      };

      // Stage 1 (0.005s): Mechanical Eject button lever press & steel latch hook unclipping
      addBroadbandKnock(0.005, 0.65, 220, 1150, 3850, 2.5, 0.08);
      addBroadbandKnock(0.032, 0.48, 175, 890, 4400, 2.1, 0.05);

      // Stage 2 (0.042s - 0.175s): Connector unseating & brisk spring-loaded slide up the rails
      addSlidingFriction(L, R, sr, 0.042, 0.135, 0.4, 2100, 1180, 0, 1202);

      // Stage 3 (0.178s): Hollow plastic cartridge hitting upper bezel stop + dust flap snap
      addBroadbandKnock(0.178, 0.84, 165, 790, 2750, 4.2, -0.04);
      addBroadbandKnock(0.191, 0.36, 195, 960, 3300, 2.4, -0.02);
      addBroadbandKnock(0.245, 0.24, 240, 1280, 3900, 1.8, 0);

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.12);
    }, 0.86);
  }

  // 3. CRT Tube Ignition (Switch + Degauss Thump + Glass Static Crackle)
  public playCrtTurnOn() {
    this.playCached('crt_on', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.72);
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const rng = createRng(301);

      // Heavy push-latch power switch
      addModalImpact(
        L, R, sr, 0.003, 0.62,
        [
          { freq: 440, decay: 0.014, gain: 0.42 },
          { freq: 1650, decay: 0.009, gain: 0.38 },
          { freq: 4800, decay: 0.004, gain: 0.32 }
        ],
        3400, 1.0, -0.15, 6, 0.3, 302
      );

      // Degauss coil magnetic thump (58Hz + 116Hz warm cabinet resonance)
      const degaussStart = Math.floor(0.032 * sr);
      const degaussLen = Math.floor(0.32 * sr);
      for (let i = 0; i < degaussLen && degaussStart + i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 11.5) * Math.min(1, t / 0.008);
        const hum = (Math.sin(2 * Math.PI * 58 * t) * 0.65 + Math.sin(2 * Math.PI * 116 * t) * 0.25) * env * 0.42;
        L[degaussStart + i] += hum;
        R[degaussStart + i] += hum;
      }

      // Electrostatic phosphor glass micro-sparks
      for (let s = 0; s < 28; s++) {
        const sparkTime = 0.045 + Math.pow(s / 28, 1.45) * 0.48 + Math.abs(rng()) * 0.015;
        const sparkAmp = (0.16 + Math.abs(rng()) * 0.18) * (1 - s / 34);
        const pan = rng() * 0.7;
        addModalImpact(
          L, R, sr, sparkTime, sparkAmp,
          [
            { freq: 3800 + Math.abs(rng()) * 3200, decay: 0.0022, gain: 0.45 },
            { freq: 7200 + Math.abs(rng()) * 2500, decay: 0.0012, gain: 0.35 }
          ],
          6400, 0.45, pan, 0, 0, 310 + s
        );
      }

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.12);
    }, 0.82);
  }

  // 4. CRT Tube Power Off
  public playCrtTurnOff() {
    this.playCached('crt_off', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.42);
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const rng = createRng(401);

      addModalImpact(
        L, R, sr, 0.003, 0.55,
        [
          { freq: 490, decay: 0.013, gain: 0.38 },
          { freq: 2100, decay: 0.007, gain: 0.4 },
          { freq: 5100, decay: 0.003, gain: 0.28 }
        ],
        3600, 0.9, -0.15, 5, 0.25, 402
      );

      // Gentle static collapse ticks
      for (let s = 0; s < 12; s++) {
        const sparkTime = 0.03 + (s / 12) * 0.24 + Math.abs(rng()) * 0.01;
        addModalImpact(
          L, R, sr, sparkTime, 0.14 * (1 - s / 14),
          [{ freq: 4600 + Math.abs(rng()) * 2400, decay: 0.0016, gain: 0.4 }],
          5800, 0.4, rng() * 0.5, 0, 0, 410 + s
        );
      }

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.1);
    }, 0.8);
  }

  // 5. Turntable Place Disc on Platter Mat
  public playDiscPlace() {
    this.playCached('disc_place', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.55);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Sleeve paper whisper
      addSlidingFriction(L, R, sr, 0.005, 0.14, 0.18, 2200, 3100, -0.1, 501);

      // Center hole touching brass spindle (tiny metallic tink)
      addModalImpact(
        L, R, sr, 0.14, 0.32,
        [
          { freq: 1420, decay: 0.015, gain: 0.32 },
          { freq: 3480, decay: 0.009, gain: 0.38 }
        ],
        3500, 0.7, 0, 0, 0, 502
      );

      // Vinyl record settling flat onto heavy damped rubber platter mat
      addModalImpact(
        L, R, sr, 0.185, 0.68,
        [
          { freq: 68, decay: 0.048, gain: 0.65 },
          { freq: 165, decay: 0.028, gain: 0.42 },
          { freq: 620, decay: 0.012, gain: 0.2 }
        ],
        540, 2.4, 0.02, 12, 0.2, 503
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.15);
    }, 0.88);
  }

  // 6. Turntable Remove Disc
  public playDiscRemove() {
    this.playCached('disc_remove', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.38);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      addModalImpact(
        L, R, sr, 0.01, 0.28,
        [
          { freq: 420, decay: 0.014, gain: 0.35 },
          { freq: 2150, decay: 0.006, gain: 0.25 }
        ],
        1900, 1.0, 0, 0, 0, 601
      );
      addSlidingFriction(L, R, sr, 0.04, 0.24, 0.24, 2800, 1900, 0.08, 602);

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.12);
    }, 0.8);
  }

  // 7. Tonearm Stylus Drop onto Vinyl Groove
  public playTonearmDrop() {
    this.playCached('tonearm_drop', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.48);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Cue lever soft mechanical click
      addModalImpact(
        L, R, sr, 0.005, 0.28,
        [
          { freq: 920, decay: 0.009, gain: 0.35 },
          { freq: 3100, decay: 0.004, gain: 0.28 }
        ],
        2800, 0.8, 0.22, 0, 0, 701
      );

      // Diamond stylus tip contacting vinyl groove (characteristic warm phono cartridge thump + needle pop)
      addModalImpact(
        L, R, sr, 0.16, 0.62,
        [
          { freq: 84, decay: 0.042, gain: 0.58 },
          { freq: 230, decay: 0.022, gain: 0.32 },
          { freq: 2950, decay: 0.0045, gain: 0.36 },
          { freq: 5600, decay: 0.0022, gain: 0.22 }
        ],
        3400, 0.9, 0.06, 8, 0.18, 702
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.1);
    }, 0.85);
  }

  // 8. Tonearm Lift off Vinyl
  public playTonearmLift() {
    this.playCached('tonearm_lift', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.26);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Stylus unweighting pop + cueing lever tick
      addModalImpact(
        L, R, sr, 0.008, 0.36,
        [
          { freq: 140, decay: 0.018, gain: 0.35 },
          { freq: 2600, decay: 0.004, gain: 0.34 }
        ],
        3100, 0.7, 0.12, 0, 0, 751
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.1);
    }, 0.78);
  }

  // 9. Continuous Subtle Analog Vinyl Surface Warmth Loop
  public startVinylCrackle() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.crackleSource) return;

    let buf = this.cache.get('vinyl_crackle_loop');
    if (!buf) {
      const sr = ctx.sampleRate;
      const dur = 4.8;
      const len = Math.floor(sr * dur);
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const rng = createRng(888);

      // Subtle analog surface floor
      const floorRaw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        floorRaw[i] = rng() * 0.018;
      }
      const warmFloor = biquadFilter(floorRaw, sr, 'bandpass', 780, 0.8);
      for (let i = 0; i < len; i++) {
        // Crossfade loop ends seamlessly over 40ms
        const fadeSamples = Math.floor(0.04 * sr);
        let env = 1;
        if (i < fadeSamples) env = i / fadeSamples;
        else if (i > len - fadeSamples) env = (len - i) / fadeSamples;
        L[i] += warmFloor[i] * env;
        R[i] += warmFloor[(i + 37) % len] * env;
      }

      // Sparse authentic micro-dust pops
      for (let p = 0; p < 34; p++) {
        const t = 0.08 + Math.abs(rng()) * (dur - 0.18);
        const amp = 0.03 + Math.pow(Math.abs(rng()), 2.2) * 0.085;
        const pan = rng() * 0.55;
        addModalImpact(
          L, R, sr, t, amp,
          [
            { freq: 2400 + Math.abs(rng()) * 2800, decay: 0.0018, gain: 0.5 },
            { freq: 5500 + Math.abs(rng()) * 2200, decay: 0.0009, gain: 0.35 }
          ],
          4200, 0.35, pan, 0, 0, 900 + p
        );
      }

      buf = finalizeBufferWithMicroRoom(ctx, L, R, 0.05);
      this.cache.set('vinyl_crackle_loop', buf);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.18);

    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.crackleSource = src;
    this.crackleGain = gain;
  }

  public stopVinylCrackle() {
    if (!this.crackleSource || !this.crackleGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.crackleGain.gain.cancelScheduledValues(now);
      this.crackleGain.gain.setValueAtTime(this.crackleGain.gain.value, now);
      this.crackleGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
      const oldSrc = this.crackleSource;
      setTimeout(() => {
        try {
          oldSrc.stop();
          oldSrc.disconnect();
        } catch {}
      }, 100);
    } catch {}
    this.crackleSource = null;
    this.crackleGain = null;
  }

  // 10. Cassette Deck Door Eject Open
  public playCassetteDoorOpen() {
    this.playCached('cassette_open', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.52);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Stop/Eject key press + metal hook release
      addModalImpact(
        L, R, sr, 0.004, 0.58,
        [
          { freq: 480, decay: 0.015, gain: 0.42 },
          { freq: 1780, decay: 0.009, gain: 0.44 },
          { freq: 4600, decay: 0.004, gain: 0.28 }
        ],
        3200, 1.1, 0.08, 5, 0.24, 1001
      );

      // Damped rotary damper gear opening acrylic cassette door
      addSlidingFriction(L, R, sr, 0.045, 0.28, 0.28, 1250, 860, 0, 1002);

      // Door reaching full open hinge stop
      addModalImpact(
        L, R, sr, 0.31, 0.46,
        [
          { freq: 290, decay: 0.022, gain: 0.48 },
          { freq: 940, decay: 0.012, gain: 0.34 }
        ],
        1500, 1.4, 0, 8, 0.26, 1003
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.15);
    }, 0.86);
  }

  // 11. Cassette Shell Insert + Door Snap Shut
  public playCassetteLoadAndClose() {
    this.playCached('cassette_load_close', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.72);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Characteristic hollow polycarbonate cassette shell & loose sprocket rattle sliding into metal holder
      addModalImpact(
        L, R, sr, 0.01, 0.44,
        [
          { freq: 680, decay: 0.014, gain: 0.42 },
          { freq: 1850, decay: 0.009, gain: 0.38 },
          { freq: 3750, decay: 0.005, gain: 0.3 }
        ],
        2900, 1.0, -0.04, 14, 0.38, 1101
      );
      addSlidingFriction(L, R, sr, 0.035, 0.16, 0.28, 1400, 1950, 0, 1102);

      // Firm thumb push closing the cassette compartment door -> sharp dual-hook latch SNAP
      addModalImpact(
        L, R, sr, 0.34, 0.74,
        [
          { freq: 195, decay: 0.028, gain: 0.52 },
          { freq: 640, decay: 0.016, gain: 0.46 },
          { freq: 2280, decay: 0.007, gain: 0.42 },
          { freq: 5200, decay: 0.0035, gain: 0.3 }
        ],
        3400, 1.2, 0.02, 6, 0.28, 1103
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.15);
    }, 0.88);
  }

  // 12. Cassette Mechanical Piano Key Latch Down
  public playPianoKeyLatch() {
    this.playCached('piano_latch', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.24);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Finger contact + steel lever travel
      addSlidingFriction(L, R, sr, 0.002, 0.032, 0.26, 1700, 2400, 0, 1201);

      // Heavy mechanical pinch-roller engagement + latch catch CLACK
      addModalImpact(
        L, R, sr, 0.032, 0.72,
        [
          { freq: 165, decay: 0.026, gain: 0.54 },
          { freq: 580, decay: 0.015, gain: 0.46 },
          { freq: 1960, decay: 0.007, gain: 0.42 },
          { freq: 4450, decay: 0.0035, gain: 0.28 }
        ],
        2850, 1.3, 0, 6.5, 0.26, 1202
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.14);
    }, 0.86);
  }

  // 13. Cassette Piano Key Spring Release
  public playPianoKeyRelease() {
    this.playCached('piano_release', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.2);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      addModalImpact(
        L, R, sr, 0.004, 0.58,
        [
          { freq: 380, decay: 0.016, gain: 0.44 },
          { freq: 1540, decay: 0.008, gain: 0.45 },
          { freq: 4100, decay: 0.004, gain: 0.3 }
        ],
        3300, 1.0, 0, 8, 0.3, 1301
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.13);
    }, 0.82);
  }

  // 14. Fast-Forward / Rewind Tape Spooling Burst
  public playTapeFastWind() {
    this.playCached('tape_wind', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.34);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      addModalImpact(
        L, R, sr, 0.003, 0.48,
        [
          { freq: 520, decay: 0.012, gain: 0.38 },
          { freq: 2150, decay: 0.006, gain: 0.38 }
        ],
        2900, 1.0, 0, 0, 0, 1401
      );
      addDcMotorMechanism(L, R, sr, 0.02, 0.26, 0.28, 220, 310, 1402);
      addSlidingFriction(L, R, sr, 0.025, 0.25, 0.22, 2400, 3400, 0, 1403);

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.12);
    }, 0.8);
  }

  // 15. Rotary Volume / Pitch Detent Micro-Tick
  public playKnobDetent(pitchFactor = 1.0) {
    this.playCached('knob_detent', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.035);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      addModalImpact(
        L, R, sr, 0.001, 0.28,
        [
          { freq: 1450, decay: 0.0028, gain: 0.42 },
          { freq: 3850, decay: 0.0014, gain: 0.36 }
        ],
        3600, 0.5, 0, 0, 0, 1501
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.05);
    }, 0.55, Math.max(0.8, Math.min(1.25, pitchFactor)));
  }

  // 16. Iconic Pocket Player Piezo Click-Wheel Tick
  public playClickWheelTick() {
    this.playCached('click_wheel_tick', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.022);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Authentic ultra-tight internal piezo clicker transient (2.15kHz + 4.85kHz, zero ringing)
      addModalImpact(
        L, R, sr, 0.0008, 0.46,
        [
          { freq: 2150, decay: 0.0011, gain: 0.55 },
          { freq: 4850, decay: 0.00065, gain: 0.48 }
        ],
        4600, 0.35, 0, 0, 0, 1601
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.03);
    }, 0.72);
  }

  // 17. Pocket Player Tactile Dome Button Press
  public playClickWheelButton() {
    this.playCached('click_wheel_btn', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.055);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      addModalImpact(
        L, R, sr, 0.001, 0.52,
        [
          { freq: 820, decay: 0.0045, gain: 0.38 },
          { freq: 2750, decay: 0.0022, gain: 0.48 },
          { freq: 5800, decay: 0.0011, gain: 0.32 }
        ],
        4200, 0.55, 0, 3.5, 0.22, 1701
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.06);
    }, 0.76);
  }

  // 18. Missing File Hollow Notice Thud
  public playMissingErrorThud() {
    this.playCached('missing_thud', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.36);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      addModalImpact(
        L, R, sr, 0.005, 0.58,
        [
          { freq: 145, decay: 0.045, gain: 0.55 },
          { freq: 310, decay: 0.028, gain: 0.42 },
          { freq: 1120, decay: 0.01, gain: 0.25 }
        ],
        980, 1.8, -0.05, 65, 0.45, 1801
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.14);
    }, 0.82);
  }

  // 19. Brittle Shell Fracture + Crystalline Sand/Dust Wind Disintegration
  public playDisintegrate() {
    this.playCached('disintegrate_dust', (ctx) => {
      const sr = ctx.sampleRate;
      const dur = 1.85;
      const len = Math.floor(sr * dur);
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      const rng = createRng(1999);

      // Phase 1 (0.00s - 0.35s): Dry brittle fractures cracking across the shell
      const crackTimes = [0.008, 0.055, 0.115, 0.19, 0.265];
      crackTimes.forEach((t, idx) => {
        const pan = (idx % 2 === 0 ? -1 : 1) * (0.12 + idx * 0.08);
        addModalImpact(
          L, R, sr, t, 0.52 - idx * 0.06,
          [
            { freq: 460 + idx * 90, decay: 0.016, gain: 0.36 },
            { freq: 1950 + idx * 260, decay: 0.008, gain: 0.42 },
            { freq: 4900 + idx * 410, decay: 0.0035, gain: 0.36 }
          ],
          4200, 0.75, pan, 4, 0.25, 1910 + idx
        );
      });

      // Phase 2 (0.12s - 1.80s): Cascading fine particulate grains & airy dispersion breeze
      const windStart = Math.floor(0.1 * sr);
      const windLen = len - windStart;
      const rawWind = new Float32Array(windLen);
      for (let i = 0; i < windLen; i++) {
        const p = i / windLen;
        const env = Math.pow(Math.sin(Math.PI * Math.pow(p, 0.62)), 1.35);
        rawWind[i] = rng() * env;
      }

      // Dual-band airy sand rustle (silky high-mid + fine crystalline shimmer)
      const sandBand = biquadFilter(rawWind, sr, 'bandpass', 2850, 1.15);
      const airBand = biquadFilter(rawWind, sr, 'highpass', 5400, 0.85);

      for (let i = 0; i < windLen; i++) {
        const p = i / windLen;
        // Sweep gently from center toward wide right/upward breeze as particles drift away
        const pan = -0.15 + p * 0.65;
        const lGain = Math.cos(((pan + 1) * Math.PI) / 4);
        const rGain = Math.sin(((pan + 1) * Math.PI) / 4);
        const v = (sandBand[i] * 0.24 + airBand[i] * 0.19);
        L[windStart + i] += v * lGain;
        R[windStart + i] += v * rGain;
      }

      // 95 individual micro-grain crystalline ticks scattering during dissolution
      for (let g = 0; g < 95; g++) {
        const u = g / 95;
        const grainTime = 0.14 + Math.pow(u, 0.92) * 1.42 + Math.abs(rng()) * 0.03;
        const grainAmp = (1 - u * 0.78) * (0.08 + Math.abs(rng()) * 0.11);
        const pan = rng() * 0.85;
        addModalImpact(
          L, R, sr, grainTime, grainAmp,
          [
            { freq: 3100 + Math.abs(rng()) * 4200, decay: 0.0024, gain: 0.48 },
            { freq: 6800 + Math.abs(rng()) * 3200, decay: 0.0012, gain: 0.35 }
          ],
          5800, 0.35, pan, 0, 0, 2000 + g
        );
      }

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.22);
    }, 0.9);
  }

  // 20. 3.5mm TRS Stereo Headphone Jack Plug-In Click-Snap
  public playHeadphonePlugIn() {
    this.playCached('headphone_plug_in', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.22);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      // Brass tip sliding past spring contacts + crisp TRS ring detent snap
      addSlidingFriction(L, R, sr, 0.005, 0.055, 0.24, 1800, 2900, 0.12, 2101);
      addModalImpact(
        L, R, sr, 0.058, 0.62,
        [
          { freq: 340, decay: 0.008, gain: 0.42 },
          { freq: 1950, decay: 0.004, gain: 0.48 },
          { freq: 4950, decay: 0.0018, gain: 0.36 }
        ],
        3800, 0.85, 0.1, 4.5, 0.26, 2102
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.08);
    }, 0.8);
  }

  // 21. Subtle Elastic Rubber Headphone Cord Twang Release
  public playCordTwang(stretchRatio = 0.5) {
    const clamped = Math.max(0.2, Math.min(1, stretchRatio));
    this.playCached('cord_twang', (ctx) => {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.16);
      const L = new Float32Array(len);
      const R = new Float32Array(len);

      addSlidingFriction(L, R, sr, 0.002, 0.065, 0.26, 750, 1450, 0.08, 2201);
      addModalImpact(
        L, R, sr, 0.004, 0.34,
        [
          { freq: 145, decay: 0.018, gain: 0.45 },
          { freq: 520, decay: 0.007, gain: 0.3 }
        ],
        920, 1.1, 0.08, 0, 0, 2202
      );

      return finalizeBufferWithMicroRoom(ctx, L, R, 0.06);
    }, 0.42 * clamped, 0.9 + clamped * 0.25);
  }
}

export const mechanicalFoley = new MechanicalFoleyEngine();
