class_name StallSfx
extends Node
## Procedural bench sounds (no asset files): relay click for the rocker, wood thunk for placing a part, wire zip, the resistor pop / LED crack,
## the band-lock chime, the cash-register ka-ching, a paper page turn, a CRT hum bed (pitch = mains 50 Hz). Silent on headless drivers.
## 0.5: noise layers sweep a low-pass from freq0 to freq1 (before, noise ignored them and every click was full-band hiss); each cue
## gets a short room tail; cues are normalised to a fixed peak; each play varies its pitch a little so repeats do not machine-gun.
## No human has listened to any of this yet: the levels are set by numbers (peak, length), not by ear.

const RATE := 22050
var enabled := true
var volume := 0.8
var _cues: Dictionary = {}
var _voices: Array[AudioStreamPlayer] = []
var _next := 0
var _jit := RandomNumberGenerator.new()
const JITTER := 0.04   ## +-4 % pitch per play
const PEAK := 0.7      ## every cue normalised to this peak (0.5: 8 voices together stay under clipping in practice)
const ROOM := [[0.023, 0.22], [0.037, 0.16], [0.061, 0.10]]   ## [delay s, gain]: a small bench room
const RECIPES := {   # [freq0, freq1, seconds, wave (sin|tri|sq|noise), volume, delay]
	"click": [[2200, 600, 0.03, "noise", 0.5, 0.0], [160, 90, 0.06, "sin", 0.5, 0.0], [1200, 800, 0.02, "sq", 0.2, 0.05]],
	"clack": [[1800, 500, 0.025, "noise", 0.45, 0.0], [140, 80, 0.07, "sin", 0.5, 0.0]],
	"thunk": [[180, 70, 0.11, "sin", 0.7, 0.0], [900, 300, 0.02, "noise", 0.3, 0.0]],
	"zip": [[600, 2400, 0.09, "tri", 0.2, 0.0], [3000, 500, 0.05, "noise", 0.2, 0.0]],
	"pop": [[400, 60, 0.12, "noise", 0.9, 0.0], [110, 40, 0.18, "sin", 0.8, 0.0], [3000, 800, 0.4, "noise", 0.12, 0.04]],
	"crack": [[2600, 300, 0.06, "noise", 0.9, 0.0], [1500, 200, 0.05, "sq", 0.3, 0.01], [3000, 600, 0.5, "noise", 0.1, 0.05]],
	"chime": [[1319, 1319, 0.5, "sin", 0.4, 0.0], [1760, 1760, 0.7, "sin", 0.3, 0.12], [2637, 2637, 0.9, "sin", 0.18, 0.12]],
	"kaching": [[3200, 3200, 0.04, "sq", 0.25, 0.0], [2093, 2093, 0.5, "sin", 0.35, 0.05], [3136, 3136, 0.6, "sin", 0.25, 0.05], [900, 300, 0.12, "noise", 0.3, 0.0]],
	"coin": [[3500, 3500, 0.08, "sin", 0.3, 0.0], [5200, 5200, 0.14, "sin", 0.25, 0.03]],
	"page": [[2500, 900, 0.18, "noise", 0.25, 0.0], [900, 400, 0.12, "noise", 0.15, 0.1]],
	"bad": [[220, 130, 0.22, "tri", 0.4, 0.0], [160, 90, 0.26, "tri", 0.35, 0.1]],
	"meow": [[500, 900, 0.14, "tri", 0.25, 0.0], [900, 450, 0.22, "tri", 0.25, 0.14]],
	"tick": [[1500, 900, 0.02, "sin", 0.2, 0.0]],
	"neon": [[100, 100, 0.12, "noise", 0.25, 0.0], [60, 60, 0.4, "sin", 0.15, 0.0]],
}

func _ready() -> void:
	_jit.randomize()
	for i in 8:
		var p := AudioStreamPlayer.new(); add_child(p); _voices.append(p)

func play(cue: String, vol_scale := 1.0) -> void:
	if not enabled or DisplayServer.get_name() == "headless": return
	if not _cues.has(cue): _cues[cue] = _make(RECIPES.get(cue, []))
	var p := _voices[_next]; _next = (_next + 1) % _voices.size()
	p.stream = _cues[cue]; p.volume_db = linear_to_db(clampf(volume * vol_scale, 0.001, 1.0))
	p.pitch_scale = 1.0 + _jit.randf_range(-JITTER, JITTER); p.play()

static func _make(parts: Array) -> AudioStreamWAV:
	var total := 0.0
	for r in parts: total = maxf(total, float(r[2]) + float(r[5]))
	var n := int((total + 0.12) * RATE) + 1   # room for the tail
	var buf := PackedFloat32Array(); buf.resize(n)
	var rng := RandomNumberGenerator.new(); rng.seed = 77
	for r in parts:
		var f0: float = r[0]; var f1: float = r[1]; var dur: float = r[2]; var amp: float = r[4]; var s0 := int(float(r[5]) * RATE)
		var cnt := int(dur * RATE); var ph := 0.0; var lp := 0.0
		for i in cnt:
			if s0 + i >= n: break
			var u := float(i) / float(cnt)
			var f := lerpf(f0, f1, u); ph += TAU * f / RATE
			var env := minf(1.0, float(i) / 60.0) * pow(1.0 - u, 1.6)
			var v := 0.0
			match str(r[3]):
				"sin": v = sin(ph)
				"tri": v = asin(sin(ph)) * 0.64
				"sq": v = 1.0 if sin(ph) >= 0.0 else -1.0
				_:
					# one-pole low-pass on white noise, cutoff sweeping f0 -> f1 (so a "click" is a click, not hiss)
					var a := 1.0 - exp(-TAU * f / RATE)
					lp += a * (rng.randf_range(-1.0, 1.0) - lp); v = lp * (1.0 + 2.5 * (1.0 - a))
			buf[s0 + i] += v * amp * env
	# room tail: a few early reflections of the dry cue
	var wet := buf.duplicate()
	for t: Array in ROOM:
		var d := int(float(t[0]) * RATE); var g: float = t[1]
		for i in range(n - 1, d - 1, -1): wet[i] += buf[i - d] * g
	buf = wet
	var pk := 0.0
	for x in buf: pk = maxf(pk, absf(x))
	if pk > 0.0:
		for i in n: buf[i] *= PEAK / pk
	var data := PackedByteArray(); data.resize(n * 2)
	for i in n: data.encode_s16(i * 2, int(clampf(buf[i], -1.0, 1.0) * 30000.0))
	var w := AudioStreamWAV.new(); w.format = AudioStreamWAV.FORMAT_16_BITS; w.mix_rate = RATE; w.stereo = false; w.data = data
	return w
