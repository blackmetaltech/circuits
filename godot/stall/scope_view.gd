class_name ScopeView
extends Control
## Wren's oscilloscope: an olive-enamel bench scope with a CRT bezel, knobs, a small VFD that lights LOCK, and a green P31 phosphor trace
## with persistence, bloom, scanlines and a vignette. Drawn in a fixed 600x440 design space; the stall scales the node. The target band is an
## amber ribbon that turns green when the engine says the trace is locked. It shows what the backend feeds it; it computes nothing.

const S = preload("res://stall/stall_style.gd")
const DESIGN := Vector2(600, 440)
const SCREEN := Rect2(34, 34, 340, 272)       ## graticule: 10 x 8 divisions of 34 px
const DIV := 34.0
const COLS := 340
const SWEEP := 2.6                            ## seconds per sweep

var sc: Dictionary = {}                       ## ticket scope: {unit, lo, hi, vdiv, label}
var value := 0.0                              ## the live quantity, in scope units
var live := false                             ## circuit powered (trace running)
var locked := false
var hold := 0.0                               ## 0..1 progress of the lock hold
var smoked := false
var attached := true                          ## CH1 is on the pad the band is measured at (engine: scope().target.clipped); false draws a flat baseline
var clip_name := ""                           ## the connector the amber arrow wants the clip on ("OUT", "A")
var slide := ""                               ## a null detector's side of balance: "left" / "right" (which way to slide the jockey) / "on"; drawn as an arrow with the signed reading
var reading := ""                             ## the engine's own gauge text for the VFD ("14.9551 mA"); empty = format `value`
var hover_knob := -1
var t := 0.0
var _vals := PackedFloat32Array()
var _stamp := PackedFloat32Array()
var _head := 0
var _acc := 0.0
var _glow: BenchView.Layer
var _glass: BenchView.Layer
var _warm := 0.0
var _lock_flash := 0.0
var _knob_ang := [0.6, -0.4, 0.2, 1.0]
var _ghost := PackedVector2Array()           ## the previous sweep, fading (the phosphor's persistence) after a restart
var _ghost_a := 0.0
var _prev_pts := PackedVector2Array()        ## the last frame's trace polyline, kept to become the ghost when the sweep starts again
var _prev_n := 0

func is_trace() -> bool: return str(sc.get("mode", "")) == "trace"

func _ready() -> void:
	set_meta(&"small_text", true)   # engraved decoration stays small on handheld (the readings are big already)
	custom_minimum_size = DESIGN; size = DESIGN
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vals.resize(COLS); _stamp.resize(COLS)
	for i in COLS: _stamp[i] = -99.0
	_glow = BenchView.Layer.new(_draw_glow, true); add_child(_glow)
	_glass = BenchView.Layer.new(_draw_glass); add_child(_glass)
	set_process(true)

func _y_of(v: float) -> float:
	return SCREEN.end.y - DIV - (v / (float(sc.get("vdiv", 4.0)) * float(sc.get("vmul", 1.0)))) * DIV

## Seconds the full screen spans (10 divisions) at the engine's time knob, and the x of a time on the screen.
func _span() -> float: return maxf(10.0 * float(sc.get("tpd", 0.2)), 1e-9)
func _x_of_t(tt: float) -> float: return SCREEN.position.x + clampf(tt / _span(), 0.0, 1.0) * SCREEN.size.x

static func tfmt(x: float) -> String:
	if x <= 0.0: return "0"
	if x < 1e-3: return "%s µs" % EngineBench._g(x * 1e6, 3)
	if x < 1.0: return "%s ms" % EngineBench._g(x * 1e3, 3)
	return "%s s" % EngineBench._g(x, 3)

func _process(dt: float) -> void:
	t += dt
	_warm = move_toward(_warm, 1.0 if live else 0.0, dt * 1.5)
	_lock_flash = maxf(0.0, _lock_flash - dt)
	_acc += dt
	if is_trace():
		var tv: Array = (sc.get("trace", {}) as Dictionary).get("v", [])
		if tv.size() + 3 < _prev_n and _prev_pts.size() > 3: _ghost = _prev_pts; _ghost_a = 0.55   # a new sweep: the old trace lingers and fades
		_prev_n = tv.size()
		_ghost_a = maxf(0.0, _ghost_a - dt * 0.6)
	var step := SWEEP / float(COLS)
	while _acc >= step:
		_acc -= step
		_vals[_head] = value if (live and attached) else 0.0
		_stamp[_head] = t
		_head = (_head + 1) % COLS
	queue_redraw(); _glow.queue_redraw(); _glass.queue_redraw()

func flash_lock() -> void: _lock_flash = 1.2

func knob_centres() -> Array: return [Vector2(452, 52), Vector2(534, 52), Vector2(452, 116), Vector2(534, 116)]

func hit_knob(p: Vector2) -> int:
	var k := knob_centres()
	var reach := maxf(30.0, 24.0 / maxf(scale.x, 0.2)) if S.handheld else 30.0   # handheld: a 44+ screen px target whatever the scope's scale
	for i in k.size(): if p.distance_to(k[i]) < reach: return i
	return -1

func turn(i: int, d: float) -> void:
	if i >= 0: _knob_ang[i] += d * 0.5

## The VOLTS knob of a time trace: x1, x2, x5, x0.5 ... the vertical scale only (a picture of the same samples).
func volts_step(dir: int) -> void:
	var opts := [0.5, 1.0, 2.0, 5.0]
	var cur := float(sc.get("vmul", 1.0)); var i := 1
	for k in opts.size(): if is_equal_approx(float(opts[k]), cur): i = k
	sc["vmul"] = opts[clampi(i + dir, 0, opts.size() - 1)]
	_knob_ang[0] += float(dir) * 0.5

func _draw() -> void:
	var rr := Rect2(Vector2.ZERO, DESIGN)
	S.shadow(self, rr, 22, Vector2(10, 16), 0.5)
	S.rr(self, rr, 22, Color("#4e5348"))
	S.rr(self, rr.grow(-5), 19, Color("#6c7263"))
	S.vgrad(self, Rect2(8, 8, DESIGN.x - 16, 120), Color(1, 1, 1, 0.07), Color(1, 1, 1, 0.0), 8)
	for c in [Vector2(20, 20), Vector2(DESIGN.x - 20, 20), Vector2(20, DESIGN.y - 20), DESIGN - Vector2(20, 20)]: S.screw(self, c, 6.5, c.x * 0.03)
	# CRT bezel: a dark moulded frame around the glass
	var bez := Rect2(12, 12, 384, 318)
	S.rr(self, bez, 26, Color("#15171a")); S.rr(self, bez.grow(-6), 22, Color("#202328"))
	S.rr_line(self, bez.grow(-3), 24, Color(1, 1, 1, 0.08), 2.0)
	# glass: deep green-black, brighter centre (the tube's own light), then the graticule
	S.rr(self, SCREEN.grow(10), 20, Color("#030605"))
	S.rr(self, SCREEN.grow(4), 14, Color(0.03, 0.08, 0.05).lerp(Color(0.04, 0.12, 0.07), _warm))
	S.glow(self, SCREEN.get_center(), 250.0, Color(0.2, 0.9, 0.3, 0.07 + 0.05 * _warm))
	for i in range(0, 11):
		var x := SCREEN.position.x + i * DIV; var major := i % 5 == 0
		draw_line(Vector2(x, SCREEN.position.y), Vector2(x, SCREEN.end.y), Color(0.3, 0.75, 0.4, 0.22 if (i == 5 or i == 0 or i == 10) else 0.12), 1.0)
	for j in range(0, 9):
		var y := SCREEN.position.y + j * DIV
		draw_line(Vector2(SCREEN.position.x, y), Vector2(SCREEN.end.x, y), Color(0.3, 0.75, 0.4, 0.22 if j == 4 or j == 0 or j == 8 else 0.12), 1.0)
	for i in range(0, 50):   # minor ticks on the centre axes
		var x := SCREEN.position.x + i * DIV / 5.0
		draw_line(Vector2(x, SCREEN.position.y + 4 * DIV - 3), Vector2(x, SCREEN.position.y + 4 * DIV + 3), Color(0.3, 0.75, 0.4, 0.3), 1.0)
	for j in range(0, 40):
		var y := SCREEN.position.y + j * DIV / 5.0
		draw_line(Vector2(SCREEN.position.x + 5 * DIV - 3, y), Vector2(SCREEN.position.x + 5 * DIV + 3, y), Color(0.3, 0.75, 0.4, 0.3), 1.0)
	if is_trace(): _tube_back()
	else: _band_back()
	# ---- right panel: VFD, knobs, jack
	_panel()

## Chapter 3: the amber target is a tube in time and voltage (the engine's `scope().trace.tube`): an amber ribbon around the ideal curve, or the allowed windows a signal has to stay in. It turns green when the engine says LOCK.
func _tube_back() -> void:
	var tr: Dictionary = sc.get("trace", {}) as Dictionary
	var tube: Dictionary = tr.get("tube", {}) as Dictionary
	if tube.is_empty() or bool(sc.get("hidden", false)): return
	var col := S.PHOS if locked else S.AMBER
	var a := 0.26 + (0.2 * _lock_flash if locked else 0.04 * (0.5 + 0.5 * sin(t * 3.0)))
	var clip := SCREEN
	if str(tube.get("kind", "")) == "exp":
		var lo: Array = tube.get("lo", []); var hi: Array = tube.get("hi", [])
		var n := mini(lo.size(), hi.size())
		if n < 2: return
		var top := PackedVector2Array(); var bot := PackedVector2Array()
		for k in n:
			var x := SCREEN.position.x + float(k) / float(n - 1) * SCREEN.size.x
			top.append(Vector2(x, clampf(_y_of(float(hi[k])), clip.position.y, clip.end.y))); bot.append(Vector2(x, clampf(_y_of(float(lo[k])), clip.position.y, clip.end.y)))
		var poly := PackedVector2Array(top)
		for k in range(n - 1, -1, -1): poly.append(bot[k])
		draw_colored_polygon(poly, Color(col, a))
		draw_polyline(top, Color(col, 0.9), 2.2, true); draw_polyline(bot, Color(col, 0.9), 2.2, true)
		var m := n - 1   # the target value at the end of the sweep, marked on the right edge
		draw_line(Vector2(SCREEN.end.x - 6.0, bot[m].y), Vector2(SCREEN.end.x - 6.0, top[m].y), Color(col, 0.9), 2.5)
	else:
		for w in tube.get("windows", []):
			var x0 := _x_of_t(float(w.t0)); var x1 := _x_of_t(float(w.t1))
			if x1 - x0 < 1.0: continue
			var y1 := clampf(_y_of(float(w.hi)), clip.position.y, clip.end.y); var y0 := clampf(_y_of(float(w.lo)), clip.position.y, clip.end.y)
			if y0 - y1 < 3.0: continue
			draw_rect(Rect2(x0, y1, x1 - x0, y0 - y1), Color(col, a), true)
			for yy in [y1, y0]:
				if yy > clip.position.y + 1.0 and yy < clip.end.y - 1.0: draw_line(Vector2(x0, yy), Vector2(x1, yy), Color(col, 0.75), 1.5)
			draw_line(Vector2(x0, y1), Vector2(x0, y0), Color(col, 0.5), 1.0); draw_line(Vector2(x1, y1), Vector2(x1, y0), Color(col, 0.5), 1.0)
	# the axes: time along the bottom, the zero level on the left
	var fs := 11
	for i in [0, 5, 10]:
		var lab := tfmt(float(i) / 10.0 * _span())
		var x := SCREEN.position.x + float(i) * DIV
		S.text(self, S.mono(), lab, Vector2(clampf(x - S.tw(S.mono(), lab, fs) * 0.5, SCREEN.position.x + 2.0, SCREEN.end.x - S.tw(S.mono(), lab, fs) - 2.0), SCREEN.end.y - 4.0), fs, Color(0.55, 1.0, 0.65, 0.55))
	S.text(self, S.mono(), "0", Vector2(SCREEN.position.x + 4.0, _y_of(0.0) - 3.0), fs, Color(0.55, 1.0, 0.65, 0.55))

func _band_back() -> void:
	if sc.is_empty() or bool(sc.get("hidden", false)): return
	var y1 := _y_of(float(sc.hi)); var y0 := _y_of(float(sc.lo))
	if y0 - y1 < 7.0: var m := (y0 + y1) * 0.5; y1 = m - 3.5; y0 = m + 3.5
	var col := S.PHOS if locked else S.AMBER
	var pulse := 0.5 + 0.5 * sin(t * 3.0)
	var a := 0.17 + (0.2 * _lock_flash if locked else 0.03 * pulse)
	draw_rect(Rect2(SCREEN.position.x, y1, SCREEN.size.x, y0 - y1), Color(col, a), true)
	draw_line(Vector2(SCREEN.position.x, y1), Vector2(SCREEN.end.x, y1), Color(col, 0.7), 1.5)
	draw_line(Vector2(SCREEN.position.x, y0), Vector2(SCREEN.end.x, y0), Color(col, 0.7), 1.5)
	if not locked:   # the hold ring fills along the top edge as the trace stays in the band
		draw_line(Vector2(SCREEN.position.x, y1 - 3), Vector2(SCREEN.position.x + SCREEN.size.x * hold, y1 - 3), Color(S.PHOS, 0.9), 2.5)

func _panel() -> void:
	var px := 412.0
	# VFD strip: dark glass with ghosted segments and the LOCK word
	var vfd := Rect2(px, 160, 170, 88)
	S.rr(self, vfd.grow(4), 10, Color("#14161a")); S.rr(self, vfd, 8, Color("#04090a"))
	var vc := Color("#7fffd4")
	var lk := Rect2(px + 10, 168, 86, 34)
	S.rr(self, lk, 6, Color(vc, 0.07 if not locked else 0.22))
	S.text(self, S.mono(), "LOCK", Vector2(px + 17, 194), 28, Color(vc, 0.12 if not locked else 1.0))
	if locked: S.glow(self, lk.get_center(), 90.0, Color(vc, 0.35 + 0.2 * _lock_flash))
	var lamp := Vector2(px + 140, 186)
	draw_circle(lamp, 9, Color(0.05, 0.12, 0.1)); draw_circle(lamp, 6.5, Color(vc, 0.15 if not locked else 1.0))
	var txt := sc.get("label", "") as String
	var unit := sc.get("unit", "") as String
	var trace_mode := is_trace()
	if trace_mode and live and attached:
		var trd: Dictionary = sc.get("trace", {}) as Dictionary
		txt = "SWEEP %d%%" % int(round(float(trd.get("progress", 0.0)) * 100.0)) if not bool(trd.get("complete", false)) else ("LOCKED" if locked else ("OUT OF TUBE" if not bool(trd.get("inTube", true)) else "SPEC NOT MET"))
	var rd := "--"
	if live and attached: rd = ("%s %s" % [_fmt(value), unit]) if reading == "" else reading
	elif live and clip_name != "": rd = "CLIP " + clip_name
	if live and attached and slide != "":
		txt = "<< slide left" if slide == "left" else (("slide right >>") if slide == "right" else ("NO BALANCE: check wiring" if slide == "dead" else "on balance"))
		S.text(self, S.mono(), String(txt), Vector2(px + 10, 222), 11 if slide == "dead" else 14, Color("#ff9d6a") if slide == "dead" else Color(vc, 0.95 if slide != "on" else 0.6))
	else: S.text(self, S.mono(), String(txt), Vector2(px + 10, 222), 14, Color(vc, 0.55))
	S.text(self, S.mono(), rd, Vector2(px + 10, 242), 20 if rd.length() < 11 else 15, Color(vc, 0.9 if (live and attached) else 0.3))
	if trace_mode:
		var hf := 1.35 if S.handheld else 1.0   # handheld: the sweep and volts settings are the ones a player reads, so they get bigger
		S.text(self, S.mono(), "%s/DIV" % tfmt(float(sc.get("tpd", 0.2))), Vector2(px + 84 - (14 if S.handheld else 0), 206), int(13 * hf), Color(vc, 0.85))
		S.text(self, S.mono(), "%s%s/DIV" % [_fmt(float(sc.get("vdiv", 4.0)) * float(sc.get("vmul", 1.0))), unit], Vector2(px + 98 + (6 if S.handheld else 0), 242 if S.handheld else 222), int(11 * hf), Color(vc, 0.6))
	else: S.text(self, S.mono(), "%s/DIV" % _fmt(float(sc.get("vdiv", 4.0))), Vector2(px + 98, 206), 12, Color(vc, 0.4))
	# knobs
	var kc := knob_centres(); var names := ["VOLTS", "TIME", "LEVEL", "FOCUS"]
	for i in kc.size():
		var hov := i == hover_knob
		if hov: S.glow(self, kc[i], 46.0, Color("#ffd98a", 0.16))
		S.knob(self, kc[i], 26.0 if i < 2 else 22.0, _knob_ang[i], Color("#26282c"), Color("#f1e7c9"))
		for k in 11:   # engraved scale
			var a := -2.4 + float(k) / 10.0 * 4.8 + 1.57 - 1.57
			var d := Vector2(cos(a - 1.57), sin(a - 1.57))
			draw_line(kc[i] + d * 34.0, kc[i] + d * 38.0, Color("#d9d3bd", 0.7), 1.2)
		var nm: String = names[i]
		# the setting itself is on the VFD ("200 ms/DIV"); on a handheld the knob carries only its name, big enough to read (about 12 screen px at this scale)
		if not S.handheld:
			if is_trace() and i == 1: nm = "TIME  %s" % tfmt(float(sc.get("tpd", 0.2)))
			elif is_trace() and i == 0: nm = "VOLTS  x%s" % _fmt(float(sc.get("vmul", 1.0)))
		var kfs := 19 if S.handheld else 12
		S.text(self, S.hand(), nm, kc[i] + Vector2(-S.tw(S.hand(), nm, kfs) * 0.5, 40 if not S.handheld else 44), kfs, Color("#e8e0c8"))
	# CH1 BNC and the power lamp
	var jc := Vector2(330, 414)
	draw_circle(jc, 17, Color("#9ea3a6")); draw_circle(jc, 12, Color("#53575b")); draw_circle(jc, 5, Color("#d0b25a")); draw_circle(jc, 2, Color.BLACK)
	S.text(self, S.hand(), "CH1", jc + Vector2(26, 5), 14, Color("#e8e0c8"))
	var pl := Vector2(24, 412)
	draw_circle(pl, 8, Color("#2a1210")); draw_circle(pl, 6, Color(1.0, 0.3, 0.2, 0.25 + 0.75 * _warm))
	if _warm > 0.5: S.glow(self, pl, 26.0, Color(1.0, 0.3, 0.2, 0.3))
	# brand plate under the tube
	var plate := Rect2(40, 358, 240, 44)
	S.rr(self, plate, 6, Color("#2d3028")); S.rr(self, plate.grow(-3), 4, Color("#c9c3a6"))
	S.text(self, S.hand(), "LANTERN  20 MHz", plate.position + Vector2(16, 29), 21, Color("#2a2a24"))
	S.text(self, S.hand(), "made for Stall 14", plate.position + Vector2(120, 41), 10, Color("#4a4639"))
	for i in 7: draw_line(Vector2(40, 336 + i * 3), Vector2(36 + 340, 336 + i * 3), Color(0, 0, 0, 0.32), 1.2)   # vent slots under the tube

func _fmt(v: float) -> String: return EngineBench._g(v, 4)

## ---- additive layer: phosphor trace with persistence, bloom and the band's glow
## The sweep of a time trace (chapter 3): the engine's samples as a green phosphor line (a brighter head while it is still forming), the fading ghost of the last sweep, failing samples in red.
func _draw_trace(ci: Control) -> void:
	var trd: Dictionary = sc.get("trace", {}) as Dictionary
	var v: Array = trd.get("v", [])
	var tr := Color("#7CFF6B")
	if _ghost.size() > 1 and _ghost_a > 0.01:
		ci.draw_polyline(_ghost, Color(tr, 0.10 * _ghost_a), 7.0, true); ci.draw_polyline(_ghost, Color(0.8, 1.0, 0.75, 0.5 * _ghost_a), 1.6, true)
	if not live or not attached or v.is_empty() or _warm <= 0.0:
		_prev_pts = PackedVector2Array()
		if not live:   # idle: a dim baseline dot sweeping so the tube reads as on
			var x := SCREEN.position.x + fposmod(t / SWEEP, 1.0) * SCREEN.size.x
			S.glow(ci, Vector2(x, _y_of(0.0)), 14.0, Color(0.4, 1.0, 0.45, 0.35)); ci.draw_line(Vector2(SCREEN.position.x, _y_of(0.0)), Vector2(SCREEN.end.x, _y_of(0.0)), Color(tr, 0.05), 3.0)
		return
	var n := v.size()
	var pts := PackedVector2Array()
	for k in n: pts.append(Vector2(SCREEN.position.x + float(k) / 255.0 * SCREEN.size.x, clampf(_y_of(float(v[k])), SCREEN.position.y - 4.0, SCREEN.end.y + 4.0)))
	_prev_pts = pts
	var a := _warm
	if pts.size() > 1:
		ci.draw_polyline(pts, Color(tr, 0.10 * a), 10.0, true); ci.draw_polyline(pts, Color(tr, 0.22 * a), 5.0, true); ci.draw_polyline(pts, Color(0.8, 1.0, 0.75, 0.95 * a), 2.0, true)
		# failing samples (outside the tube) in red, where they are: the line itself turns red there
		var badk := {}
		for k in (trd.get("bad", []) as Array): badk[int(k)] = true
		for k in range(1, pts.size()):
			if badk.has(k) or badk.has(k - 1):
				ci.draw_line(pts[k - 1], pts[k], Color(1.0, 0.2, 0.15, 0.35 * a), 8.0); ci.draw_line(pts[k - 1], pts[k], Color(1.0, 0.45, 0.35, 0.95 * a), 2.6)
	var head := pts[pts.size() - 1]
	if n < 256: S.glow(ci, head, 28.0, Color(0.6, 1.0, 0.6, 0.65 * a))   # still forming: the beam's head
	else: S.glow(ci, head, 12.0, Color(0.6, 1.0, 0.6, 0.25 * a))
	_mark63(ci, trd)
	if not sc.is_empty() and not bool(sc.get("hidden", false)):
		var col := S.PHOS if locked else S.AMBER
		S.glow(ci, SCREEN.get_center(), 200.0, Color(col, 0.05 + (0.14 * _lock_flash if locked else 0.0)))
	if smoked: ci.draw_rect(SCREEN, Color(1.0, 0.1, 0.05, 0.06 + 0.04 * sin(t * 12.0)), true)

## RC / LR tickets: a dashed level at 63.2 % of the final value (one time constant) and a time cursor where the trace crosses it, with its readout.
func _mark63(ci: Control, trd: Dictionary) -> void:
	var mk = trd.get("mark63", null)
	if not (mk is Dictionary): return
	var yl := _y_of(float(mk.level))
	if yl < SCREEN.position.y + 2.0 or yl > SCREEN.end.y - 2.0: return
	var cc := Color("#bfe9ff")
	var x := SCREEN.position.x
	while x < SCREEN.end.x:
		ci.draw_line(Vector2(x, yl), Vector2(minf(x + 9.0, SCREEN.end.x), yl), Color(cc, 0.75), 1.6); x += 16.0
	var lab := "63 %%  %s %s" % [_fmt(float(mk.level)), str(sc.get("unit", ""))]
	S.text(ci, S.mono(), lab, Vector2(SCREEN.end.x - S.tw(S.mono(), lab, 11) - 6.0, yl - 4.0), 11, Color(cc, 0.95))
	var tc = mk.get("t", null)
	if tc != null and (locked or bool(trd.get("complete", false))):
		var xc := _x_of_t(float(tc))
		var y := SCREEN.position.y
		while y < SCREEN.end.y:
			ci.draw_line(Vector2(xc, y), Vector2(xc, minf(y + 8.0, SCREEN.end.y)), Color(cc, 0.6), 1.4); y += 14.0
		ci.draw_circle(Vector2(xc, yl), 4.0, Color(cc, 0.95))
		var rd := "t = %s" % tfmt(float(tc))
		var rw := S.tw(S.mono(), rd, 12)
		S.text(ci, S.mono(), rd, Vector2(clampf(xc + 6.0, SCREEN.position.x + 2.0, SCREEN.end.x - rw - 4.0), SCREEN.end.y - 18.0), 12, Color(S.PHOS if locked else cc, 1.0))

func _draw_glow(ci: Control) -> void:
	if sc.is_empty(): return
	if is_trace(): _draw_trace(ci); return
	var tr := Color("#7CFF6B")
	if _warm > 0.0:
		var a := 0.0
		# the beam: columns oldest-first from the head; alpha decays with age (persistence)
		var prev := Vector2.ZERO; var have := false
		for k in COLS:
			var idx := (_head + k) % COLS
			var age := t - _stamp[idx]
			if age > 4.0 or _stamp[idx] < 0.0: have = false; continue
			var x := SCREEN.position.x + float(idx) / float(COLS - 1) * SCREEN.size.x
			var y := clampf(_y_of(_vals[idx]) + sin(float(idx) * 3.1 + t * 40.0) * 0.35, SCREEN.position.y - 4, SCREEN.end.y + 4)
			var p := Vector2(x, y)
			if have and (k > 0) and idx != 0:
				a = (0.28 + 0.72 * exp(-age / 0.7)) * _warm
				ci.draw_line(prev, p, Color(tr, 0.10 * a), 10.0)
				ci.draw_line(prev, p, Color(tr, 0.22 * a), 5.0)
				ci.draw_line(prev, p, Color(0.8, 1.0, 0.75, 0.95 * a), 2.0)
			prev = p; have = true
		var hx := SCREEN.position.x + float((_head + COLS - 1) % COLS) / float(COLS - 1) * SCREEN.size.x
		var hy := _y_of(_vals[(_head + COLS - 1) % COLS])
		S.glow(ci, Vector2(hx, clampf(hy, SCREEN.position.y, SCREEN.end.y)), 26.0, Color(0.6, 1.0, 0.6, 0.55 * _warm))
	if not live:   # CRT idle: a dim baseline dot slowly sweeping so the tube reads as on
		var x := SCREEN.position.x + fposmod(t / SWEEP, 1.0) * SCREEN.size.x
		S.glow(ci, Vector2(x, _y_of(0.0)), 14.0, Color(0.4, 1.0, 0.45, 0.35))
		ci.draw_line(Vector2(SCREEN.position.x, _y_of(0.0)), Vector2(SCREEN.end.x, _y_of(0.0)), Color(tr, 0.05), 3.0)
	if not sc.is_empty() and not bool(sc.get("hidden", false)):
		var y1 := _y_of(float(sc.hi)); var y0 := _y_of(float(sc.lo))
		var col := S.PHOS if locked else S.AMBER
		S.glow(ci, Vector2(SCREEN.get_center().x, (y0 + y1) * 0.5), 200.0, Color(col, 0.05 + (0.14 * _lock_flash if locked else 0.0)))
	if smoked and live:
		ci.draw_rect(SCREEN, Color(1.0, 0.1, 0.05, 0.06 + 0.04 * sin(t * 12.0)), true)   # failing samples flash red

## ---- opaque top layer: scanlines, vignette, glare and the glass edge
func _draw_glass(ci: Control) -> void:
	var r := SCREEN
	var y := r.position.y
	while y < r.end.y:
		ci.draw_line(Vector2(r.position.x, y), Vector2(r.end.x, y), Color(0, 0, 0, 0.20), 1.0); y += 3.0
	for i in 8:   # barrel vignette: darker toward the rounded corners
		var g := float(i) * 3.0
		S.rr_line(ci, r.grow(4 - g + 2), 14.0 + 4.0 * i, Color(0, 0, 0, 0.05 + 0.02 * (7 - i)), 5.0)
	S.rr_line(ci, r.grow(4), 14, Color(0, 0, 0, 0.9), 5.0)
	ci.draw_colored_polygon(PackedVector2Array([r.position + Vector2(14, 8), r.position + Vector2(150, 8), r.position + Vector2(60, 96), r.position + Vector2(10, 110)]), Color(1, 1, 1, 0.045))
	ci.draw_arc(r.position + Vector2(40, 36), 20, PI * 1.05, PI * 1.5, 8, Color(1, 1, 1, 0.12), 3.0)
