extends SceneTree
## Every bench cue builds, is audible, never clips and stays short (0.5). No human has listened; this guards the numbers only.
var checks := 0
var fails := 0
func ok(cond: bool, what: String) -> void:
	checks += 1
	if not cond: fails += 1
	print(("  ok   " if cond else "  FAIL ") + what)
func _initialize() -> void:
	for cue: String in StallSfx.RECIPES:
		var w := StallSfx._make(StallSfx.RECIPES[cue])
		var n := w.data.size() / 2
		var pk := 0; var rms := 0.0
		for i in n:
			var v := absi(w.data.decode_s16(i * 2)); pk = maxi(pk, v); rms += float(v * v)
		rms = sqrt(rms / maxf(1.0, float(n))) / 32767.0
		var secs := float(n) / float(StallSfx.RATE)
		ok(pk < 32000 and pk > 16000, "%s peaks at %.2f of full scale (no clipping, audible)" % [cue, float(pk) / 32767.0])
		ok(rms > 0.01, "%s carries sound (rms %.3f)" % [cue, rms])
		ok(secs <= 1.2, "%s is short (%.2f s)" % [cue, secs])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
