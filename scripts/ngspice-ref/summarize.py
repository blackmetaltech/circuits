#!/usr/bin/env python3
"""Prints the key summary numbers of every committed reference CSV (used for tests/ref/README.md). Usage: python3 -I summarize.py"""
import csv, glob, math, os

REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests', 'ref')

def load(prefix):
    path = sorted(glob.glob(os.path.join(REF, prefix + '*.csv')))[0]
    with open(path) as f:
        r = list(csv.reader(f))
    h = r[0]
    cols = {n: [float(row[i]) for row in r[1:]] for i, n in enumerate(h)}
    return h, cols

def interp(x, y, q):
    for i in range(1, len(x)):
        if (x[i - 1] <= q <= x[i]) or (x[i - 1] >= q >= x[i]):
            return y[i - 1] + (y[i] - y[i - 1]) * (q - x[i - 1]) / (x[i] - x[i - 1]) if x[i] != x[i - 1] else y[i]
    return float('nan')

def crossings(t, y, level, rising=True):
    out = []
    for i in range(1, len(t)):
        a, b = y[i - 1] - level, y[i] - level
        if (a < 0 <= b) if rising else (a > 0 >= b):
            out.append(t[i - 1] + (t[i] - t[i - 1]) * (-a) / (b - a))
    return out

def first_cross(x, y, level):
    for i in range(1, len(x)):
        a, b = y[i - 1] - level, y[i] - level
        if a * b <= 0 and a != b:
            return x[i - 1] + (x[i] - x[i - 1]) * (-a) / (b - a)
    return float('nan')

def dft(t, y, f, t0, t1):
    """amplitude and phase of the component at f over [t0, t1] (whole cycles), trapezoid sums."""
    n = [(a, b) for a, b in zip(t, y) if t0 <= a <= t1]
    c = s = 0.0
    for k in range(1, len(n)):
        dt = n[k][0] - n[k - 1][0]
        for (tt, v), w in ((n[k - 1], 0.5), (n[k], 0.5)):
            c += w * dt * v * math.cos(2 * math.pi * f * tt)
            s += w * dt * v * math.sin(2 * math.pi * f * tt)
    T = n[-1][0] - n[0][0]
    return 2 * math.hypot(c, s) / T

def stats(y):
    return sum(y) / len(y), max(y), min(y), max(y) - min(y)

def p(name, val, unit=''):
    print(f'{name:55s} {val:.6g} {unit}')

_, d = load('01-'); p('01 clipper v_out max / min (V)', max(d['v_out_V'])); p('', min(d['v_out_V']))
_, d = load('02-'); m, mx, mn, rp = stats(d['v_out_V']); p('02 halfwave mean V', m); p('02 peak V', mx); p('02 min V', mn); p('02 ripple Vpp', rp)
_, d = load('03-bridge-settled'); m, mx, mn, rp = stats(d['v_out_V']); p('03 settled mean V', m); p('03 peak V', mx); p('03 ripple Vpp', rp)
_, d = load('03-bridge-inrush'); p('03 inrush peak i_src A', max(d['i_src_A']))
_, d = load('04-'); v = d['vin_V']; o = d['v_out_V']
for q in (4, 5, 5.5, 6, 8, 13, 17, 20): p(f'04 zener v_out at vin={q}', interp(v, o, q))
p('04 vin where iz = 1 mA (i_in-vout/...)', first_cross(v, [i - 0 for i in d['i_in_A']], 0) if False else float('nan'))
iz = [i for i in d['i_in_A']]
p('04 i_in at vin=13 (mA)', 1e3 * interp(v, iz, 13)); p('04 i_in at vin=17 (mA)', 1e3 * interp(v, iz, 17))
p('04 vout where i_in(=iz) = 5 mA ... vin', first_cross(v, [i - 5e-3 for i in iz], 0))
p('04 v_out at i_in = 5 mA', interp(iz, o, 5e-3)); p('04 v_out at i_in = 1 mA', interp(iz, o, 1e-3)); p('04 v_out at i_in = 49 mA', interp(iz, o, 49e-3))
_, d = load('05-'); v = d['v_src_V']; i = d['i_A']; vl = d['v_led_V']
for q in (1.8, 2.0, 2.5, 3, 5): p(f'05 led i at v_src={q} (mA)', 1e3 * interp(v, i, q)); p(f'05 led v at v_src={q}', interp(v, vl, q))
p('05 led v at i = 10 mA', interp(i, vl, 10e-3)); p('05 led v at i = 20 mA', interp(i, vl, 20e-3)); p('05 led v at i = 2 mA', interp(i, vl, 2e-3))
for tag, col in (('Early', 'v_out_V'), ('no Early', 'v_out_noearly_V')):
    _, d = load('06-'); t = d['time_s']; a = dft(t, d[col], 1000, 0.0, 9.995e-3 - 0.995e-3); a0 = dft(t, d['v_src_V'], 1000, 0.0, 9.995e-3 - 0.995e-3)
    hs = [dft(t, d[col], 1000 * k, 0.0, 8.999e-3) for k in (2, 3, 4, 5)]
    f1 = dft(t, d[col], 1000, 0.0, 8.999e-3); thd = math.sqrt(sum(h * h for h in hs)) / f1
    p(f'06 CE gain |vout/vEMF| ({tag})', f1 / dft(t, d['v_src_V'], 1000, 0.0, 8.999e-3)); p(f'06 THD 2..5 ({tag})', 100 * thd, '%')
_, d = load('06-'); p('06 collector DC mean (V) [t=0 value]', d['v_coll_V'][0]); p('06 base DC [t=0]', d['v_base_V'][0])
_, d = load('07-'); v = d['vin_V']; o = d['v_out_V']
p('07 vout at vin=0', o[0]); p('07 vout at vin=5', o[-1]); p('07 vin where vout=2.5 (switch point)', first_cross(v, [x - 2.5 for x in o], 0)); p('07 vin at vout=4.9 (Vt-ish)', first_cross(v, [x - 4.9 for x in o], 0))
p('07 vout at vin=3', interp(v, o, 3)); p('07 id at vin=3 (mA)', 1e3 * interp(v, d['i_d_A'], 3))
_, d = load('08-'); t = d['time_s']; vd = d['v_drain_V']; il = d['i_load_A']
k = vd.index(max(vd)); p('08 drain peak V', vd[k]); p('08 drain peak at (us)', t[k] * 1e6); p('08 i_load max (mA)', 1e3 * max(il)); p('08 drain min V', min(vd))
p('08 drain at t=0.5 ms', interp(t, vd, 0.5e-3)); p('08 i_load at t=0.7 ms (mA)', 1e3 * interp(t, il, 0.7e-3))
_, d = load('09-'); t = d['time_s']; vc = d['v_cap_V']; k = vc.index(max(vc)); p('09 RLC Vpk V (TR-03: 13.509)', vc[k]); p('09 peak time ms (TR-03: 1.0472)', t[k] * 1e3); p('09 overshoot % (TR-03: 35.092)', (vc[k] - 10) / 10 * 100)
_, d = load('10-'); f = d['freq_Hz']; m = d['mag_dB']; ph = d['phase_deg']
p('10 mag at 10 Hz dB', m[0]); p('10 -3 dB frequency Hz', math.exp(interp(m, [math.log(x) for x in f], -3.0103))); p('10 mag at 1125.395 Hz', interp([math.log(x) for x in f], m, math.log(1125.395)))
p('10 phase at 1125.395 Hz', interp([math.log(x) for x in f], ph, math.log(1125.395))); p('10 mag at 10 kHz', interp([math.log(x) for x in f], m, math.log(1e4)))
_, d = load('11-'); t = d['time_s']; v = d['v_out_V']; c = crossings(t, v, 0.0, True); c = [x for x in c if x > 25e-3]
p('11 Wien f (last cycles) Hz', (len(c) - 1) / (c[-1] - c[0])); p('11 f0 ideal 1/(2 pi RC)', 1 / (2 * math.pi * 1e4 * 1e-8)); p('11 amplitude peak V (last 5 ms)', max(x for a, x in zip(t, v) if a > 35e-3))
_, d = load('12-'); m, mx, mn, rp = stats(d['v_out_V']); p('12 buck vout mean V', m); p('12 vout ripple Vpp', rp); i = d['i_L_A']; p('12 i_L mean A', sum(i) / len(i)); p('12 i_L ripple Apk-pk', max(i) - min(i)); p('12 v_sw max', max(d['v_sw_V'])); p('12 v_sw min', min(d['v_sw_V']))
_, d = load('13-'); t = d['time_s']; v = d['v_c1_V']; c = crossings(t, v, 4.5, True); c = [x for x in c if x > 3e-3]
p('13 astable f Hz', (len(c) - 1) / (c[-1] - c[0])); p('13 analytic 1/(0.693 RB (C1+C2))', 1 / (0.693 * 47e3 * 20.5e-9)); p('13 v_c1 max V', max(v)); p('13 v_c1 min V', min(v)); p('13 v_b1 min V', min(d['v_b1_V']))
f = c; fall = [x for x in crossings(t, v, 4.5, False) if x > 3e-3]
p('13 first-cycle period count', len(c)); p('13 periods (ms)', 1e3 * (c[-1] - c[0]) / (len(c) - 1))
_, d = load('14-bridge-transformer'); m, mx, mn, rp = stats(d['v_out_V']); p('14 nominal mean V', m); p('14 ripple Vpp', rp); p('14 i_sec peak A', max(d['i_sec_A']))
_, d = load('15-'); v = d['vin_A_V']; o = d['v_out_V']
p('15 VOH (vin=0)', o[0]); p('15 VOL (vin=5)', o[-1]); p('15 vin where vout=2.5', first_cross(v, [x - 2.5 for x in o], 0)); p('15 vin at vout=VOH-0.1', first_cross(v, [x - (o[0] - 0.1) for x in o], 0)); p('15 vin at vout=VOL+0.1', first_cross(v, [x - (o[-1] + 0.1) for x in o], 0))
p('15 vP at vin=0', d['v_P_V'][0]); p('15 vP at vin=5', d['v_P_V'][-1]); p('15 vbase at vin=5', d['v_base_V'][-1]); p('15 vbase at vin=1.4', interp(v, d['v_base_V'], 1.4))
