"""Synthesise the music bed + sound design for the 38s reel (no samples, no copyright issues).
Cue times match src/main.js (scene cuts, climax at 20.0s, stamp hit at 21.43s, end-card chime at 33.8s).
usage: python3 -I tools/make_audio.py <out.wav>
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR, DUR = 48000, 38.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
BPM = 84.0
BEAT = 60.0 / BPM            # 0.714s -> 28 beats = 20.0s (climax) , 30 beats = 21.43s (stamp)


def mtof(m):
    return 440.0 * 2 ** ((np.asarray(m, float) - 69) / 12)


class Bus:
    def __init__(self):
        self.l = np.zeros(N)
        self.r = np.zeros(N)

    def put(self, sig, t0, pan=0.0, gain=1.0):
        i = int(round(t0 * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), N - i)
        if n <= 0:
            return
        a = (pan + 1) * np.pi / 4
        self.l[i:i + n] += sig[:n] * np.cos(a) * gain
        self.r[i:i + n] += sig[:n] * np.sin(a) * gain


music, fx = Bus(), Bus()          # music goes through the reverb, fx mostly dry


def tt(d):
    return np.arange(int(d * SR)) / SR


def lp(x, fc, order=4):
    return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


# ------------------------------------------------------------------ instruments
def piano(f, dur=3.2, vel=.6):
    t = tt(dur)
    tau0 = 2.6 * (220.0 / f) ** 0.45
    sig = np.zeros_like(t)
    for h, a in enumerate([1, .55, .34, .2, .12, .07, .04], 1):
        fh = f * h * np.sqrt(1 + 0.00025 * h * h)
        if fh > 9000:
            break
        for det, w in ((1.0, 1.0), (1.0009, .6)):
            sig += w * a * np.sin(2 * np.pi * fh * det * t + h * .7) * np.exp(-t / (tau0 / h ** 0.65))
    env = np.minimum(1, t / .004) * np.minimum(1, (dur - t) / .25)
    hammer = lp(noise(dur), 2500) * np.exp(-t / .012) * .25
    return (sig * .55 + hammer) * env * vel


def pad(freqs, dur, bright=0.0, att=.9, rel=1.3):
    t = tt(dur)
    out = np.zeros_like(t)
    for f in freqs:
        for d in (-7, 0, 6):                           # detuned saw trio
            fd = f * 2 ** (d / 1200)
            out += signal.sawtooth(2 * np.pi * fd * t + rng.uniform(0, 6.28))
    soft = lp(out, 1100)
    if bright > 0:
        soft = soft + bright * lp(out, 3600)
    env = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (dur - t)) / rel)
    return soft * env / (len(freqs) * 2.2)


def bass(f, dur):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t)
    return s * np.minimum(1, t / .04) * np.minimum(1, np.maximum(0, dur - t) / .5)


def lead(f, dur, vib=True):
    t = tt(dur)
    ph = 2 * np.pi * f * t + (0.006 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / .8) * 2 * np.pi * f / 5.2 if vib else 0)
    s = np.sin(ph) + .28 * np.sin(2 * ph) + .08 * np.sin(3 * ph)
    return s * np.minimum(1, t / .18) * np.minimum(1, np.maximum(0, dur - t) / .9)


def kick(f0=110, f1=44, dur=.5, decay=.14):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / .035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / decay) * np.minimum(1, t / .002)


def bell(f, dur=3.0):
    t = tt(dur)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 1.3) + .4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / .5) + .25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / .22)
    return s * np.minimum(1, t / .003)


def whoosh(dur=.5, lo=300, hi=5000):
    t = tt(dur)
    n = noise(dur)
    n = bp(n, lo, hi)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return n * env


def riser(dur):
    t = tt(dur)
    f = 140 * (9.0 ** (t / dur))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = lp(signal.sawtooth(ph), 3500) * .5 + lp(hp(noise(dur), 2500), 9000) * .22
    env = (t / dur) ** 2.2
    return s * env


# ------------------------------------------------------------------ arrangement
# chords: (start_sec, root_midi, quality)   4 beats each = 2.857s
CH = []
prog = [(50, 'm'), (46, 'M'), (53, 'M'), (48, 'M'), (50, 'm'), (46, 'M'), (53, 'M'), (46, 'M'),    # 0 .. 22.86 (idx7 = climax @20.0)
        (53, 'M'), (48, 'M'), (50, 'm'), (46, 'M'), (50, 'M'), (50, 'M')]                            # .. end on D major
for i, (r, q) in enumerate(prog):
    CH.append((i * 4 * BEAT, r, q))
CLIMAX, STAMP = 28 * BEAT, 30 * BEAT
assert abs(CLIMAX - 20.0) < 1e-6 and abs(STAMP - 21.4286) < 1e-3


def tones(r, q):
    third = 3 if q == 'm' else 4
    return [r, r + third, r + 7]


def climax_amt(t):
    # 0 -> 1 across the build (17.1-20.0), stays 1 until 30.6, then relaxes
    return float(np.clip((t - 17.1) / 2.9, 0, 1) * (1 - np.clip((t - 30.6) / 3.2, 0, 1) * .85))


for i, (t0, r, q) in enumerate(CH):
    d = 4 * BEAT
    tn = tones(r, q)
    ca = climax_amt(t0 + d / 2)
    # pad (mid register), overlaps next chord
    fr = [mtof(m + 12) for m in tn] + [mtof(tn[0] + 24)]
    music.put(pad(fr, d + 1.6, bright=.9 * ca + .15, att=1.0, rel=1.4), t0 - .15, 0.0, gain=.62 + .3 * ca)
    # wide airy octave layer in climax
    if ca > .05:
        music.put(pad([mtof(m + 24) for m in tn], d + 1.4, bright=.6, att=1.2, rel=1.2), t0 - .1, 0.0, gain=.34 * ca)
    # bass
    if t0 >= 4 * BEAT:
        music.put(bass(mtof(r - 12), d + .2), t0, 0.0, gain=.42 + .2 * ca)
    # piano arpeggio (8ths)
    third = 3 if q == 'm' else 4
    pat = [r, r + 7, r + 12, r + 12 + third, r + 19, r + 12 + third, r + 12, r + 7]
    if t0 < 3.5 * BEAT:       # sparse intro: just two notes per chord
        pat = [r, None, r + 12, None, r + 19, None, None, None]
    for k, m in enumerate(pat):
        if m is None:
            continue
        tv = t0 + k * BEAT / 2 + (0.012 if k % 2 else 0)
        vel = .5 + .12 * (k % 4 == 0) + .05 * ca
        music.put(piano(mtof(m + 12), 3.0, vel), tv, pan=-.25 + .5 * (k / 7), gain=.46)

# lead melody (sustained, enters with the climax)
for t0, m in [(20.0, 74), (22.857, 72), (25.714, 76), (28.571, 77), (31.43, 74), (34.29, 78)]:
    dur = 2.9 if t0 < 34 else 3.4
    music.put(lead(mtof(m), dur), t0, 0.0, gain=.20 if t0 < 31 else .14)

# soft heartbeat + shaker through the climax section
b = CLIMAX
while b < 30.6:
    music.put(kick(120, 46, .5, .16), b, 0, gain=.5 * (1 - max(0, b - 28) / 3.5))
    sh = hp(noise(.12), 6500) * np.exp(-tt(.12) / .03)
    fx.put(sh, b + BEAT / 2, 0.2, gain=.07)
    fx.put(sh, b + BEAT * .25, -0.2, gain=.035)
    fx.put(sh, b + BEAT * .75, 0.2, gain=.035)
    b += BEAT

# build + impact into the climax
fx.put(riser(2.9), CLIMAX - 2.9, 0, gain=.38)
fx.put(whoosh(.6, 200, 3500), CLIMAX - .6, 0, gain=.5)
t = tt(2.4)
boom = np.sin(2 * np.pi * (36 + 40 * np.exp(-t / .12)) * t) * np.exp(-t / .9) + lp(noise(2.4), 600) * np.exp(-t / .5) * .6
fx.put(boom, CLIMAX, 0, gain=.9)
fx.put(lp(hp(noise(1.2), 3000), 10000) * np.exp(-tt(1.2) / .35), CLIMAX, 0, gain=.10)       # cymbal-ish air

# stamp hit
fx.put(whoosh(.24, 500, 6000), STAMP - .24, 0, gain=.55)
fx.put(kick(95, 38, .7, .24), STAMP, 0, gain=1.0)
tc = tt(.25)
fx.put(bp(noise(.25), 1800, 5200) * np.exp(-tc / .02), STAMP, 0, gain=.45)         # click
fx.put(lp(noise(.9), 500) * np.exp(-tt(.9) / .25), STAMP, 0, gain=.4)               # thud body

# transition whooshes
for tc_, g in [(4.0, .22), (8.5, .22), (12.0, .22), (15.8, .22), (28.0, .38), (30.6, .2), (33.8, .3)]:
    fx.put(whoosh(.55, 350, 4500), tc_ - .25, 0.0, gain=g)

# page rustle (old book) + milk-bottle clink hint
fx.put(bp(noise(.7), 1800, 7000) * np.sin(np.pi * np.clip(tt(.7) / .7, 0, 1)) ** 1.5, 9.35, .3, gain=.22)
fx.put(bell(2400, .6) * .6, 17.85, 0.2, gain=.035)

# end-card chime + resolve
fx.put(bell(mtof(81), 3.5), 33.8, -.2, gain=.20)
fx.put(bell(mtof(86), 3.5), 34.25, .2, gain=.15)
fx.put(bell(mtof(90), 3.5), 34.75, 0.0, gain=.12)

# ------------------------------------------------------------------ reverb, master
def reverb_ir(rt=2.6):
    n = int(rt * SR)
    t = np.arange(n) / SR
    ir = [rng.standard_normal(n) * np.exp(-t / (rt / 5.5)) for _ in range(2)]
    ir = [lp(x, 5200, 2) for x in ir]
    ir = [x / np.sqrt(np.sum(x ** 2)) for x in ir]
    return ir


irL, irR = reverb_ir()
wetL = signal.fftconvolve(music.l + fx.l * .25, irL)[:N]
wetR = signal.fftconvolve(music.r + fx.r * .25, irR)[:N]
L = music.l + fx.l + wetL * .55
R = music.r + fx.r + wetR * .55

L, R = hp(L, 32, 2), hp(R, 32, 2)
# master envelope: fade in / out
t = np.arange(N) / SR
env = np.minimum(1, t / 1.2) * np.minimum(1, (DUR - t) / 2.2)
L, R = L * env, R * env
g = 10 ** (-19 / 20) / np.sqrt(np.mean((L ** 2 + R ** 2) / 2))      # aim for ~-19 dBFS RMS, loudnorm finishes the job


def limit(x, th=.7):
    a = np.abs(x)
    return np.where(a < th, x, np.sign(x) * (th + (1 - th) * np.tanh((a - th) / (1 - th))))


st = np.stack([limit(L * g), limit(R * g)], 1) * 0.95
wavfile.write(sys.argv[1], SR, (st * 32767).astype(np.int16))
rms = 20 * np.log10(np.sqrt(np.mean(st ** 2)) + 1e-9)
print(f"wrote {sys.argv[1]}  peak {np.abs(st).max():.2f}  rms {rms:.1f} dBFS")
