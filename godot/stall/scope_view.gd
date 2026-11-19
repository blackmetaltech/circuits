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

func _ready() -> void:
	custom_minimum_size = DESIGN; size = DESIGN
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vals.resize(COLS); _stamp.resize(COLS)
	for i in COLS: _stamp[i] = -99.0
	_glow = BenchView.Layer.new(_draw_glow, true); add_child(_glow)
	_glass = BenchView.Layer.new(_draw_glass); add_child(_glass)
	set_process(true)

func _y_of(v: float) -> float:
	return SCREEN.end.y - DIV - (v / float(sc.get("vdiv", 4.0))) * DIV

func _process(dt: float) -> void:
	t += dt
	_warm = move_toward(_warm, 1.0 if live else 0.0, dt * 1.5)
	_lock_flash = maxf(0.0, _lock_flash - dt)
	_acc += dt
	var step := SWEEP / float(COLS)
	while _acc >= step:
		_acc -= step
		_vals[_head] = value if live else 0.0
		_stamp[_head] = t
		_head = (_head + 1) % COLS
	queue_redraw(); _glow.queue_redraw(); _glass.queue_redraw()

func flash_lock() -> void: _lock_flash = 1.2

func knob_centres() -> Array: return [Vector2(452, 52), Vector2(534, 52), Vector2(452, 116), Vector2(534, 116)]

func hit_knob(p: Vector2) -> int:
	var k := knob_centres()
	for i in k.size(): if p.distance_to(k[i]) < 30.0: return i
	return -1

func turn(i: int, d: float) -> void:
	if i >= 0: _knob_ang[i] += d * 0.5

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
	_band_back()
	# ---- right panel: VFD, knobs, jack
	_panel()

func _band_back() -> void:
	if sc.is_empty(): return
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
	var rd := "%s %s" % [_fmt(value if live else 0.0), unit] if live else "--"
	S.text(self, S.mono(), String(txt), Vector2(px + 10, 222), 14, Color(vc, 0.55))
	S.text(self, S.mono(), rd, Vector2(px + 10, 242), 20, Color(vc, 0.9 if live else 0.3))
	S.text(self, S.mono(), "%s/DIV" % _fmt(float(sc.get("vdiv", 4.0))), Vector2(px + 98, 206), 12, Color(vc, 0.4))
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
		S.text(self, S.hand(), names[i], kc[i] + Vector2(-S.tw(S.hand(), names[i], 12) * 0.5, 40), 12, Color("#e8e0c8"))
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

func _fmt(v: float) -> String:
	var r := snappedf(v, 0.01)
	return ("%.1f" % v) if absf(v) >= 10.0 else ("%.2f" % v)

## ---- additive layer: phosphor trace with persistence, bloom and the band's glow
func _draw_glow(ci: Control) -> void:
	if sc.is_empty(): return
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
	if not sc.is_empty():
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
