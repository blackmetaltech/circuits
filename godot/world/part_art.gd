class_name PartArt
extends RefCounted
## Parts drawn in code (DESIGN §5.1): top-down with a drop shadow and a specular strip. Every draw takes the pitch `p` (px per pad) and
## works in the part's local frame (origin = pad x,y; footprint axes), so rotation and flip are one canvas transform.
## `st` = {lit: 0..1 (LED light), smoked: bool, hot: 0..1}. No player-facing text is drawn here (labels live in the bench view).

const SILVER := Color(0.78, 0.8, 0.84)
const SHADOW := Color(0, 0, 0, 0.38)
const BAND := [Color("#16110e"), Color("#7a3b12"), Color("#d02a1c"), Color("#f08a1c"), Color("#f2d21b"), Color("#2e9a3a"), Color("#2a5ec8"),
	Color("#8a3fc0"), Color("#8c8f96"), Color("#f4f4f0")]
const GOLD := Color("#D4A74A")

static func band_color(i: int) -> Color:
	if i == -1: return GOLD
	if i == -2: return Color("#c8ccd2")
	return BAND[clampi(i, 0, 9)]

## Resistor colour code (4 bands): digits + multiplier, then gold tolerance.
static func bands(v: float) -> Array:
	if v <= 0.0: return [0, 0, 0]
	var e := 0; var m := v
	while m >= 10.0: m /= 10.0; e += 1
	while m < 1.0: m *= 10.0; e -= 1
	var two := int(round(m * 10.0))
	if two >= 100: two = 10; e += 1
	return [two / 10, two % 10, e - 1]

static func rrect(ci: CanvasItem, r: Rect2, rad: float, col: Color) -> void:
	rad = minf(rad, minf(r.size.x, r.size.y) * 0.49)   # (exactly half makes duplicate points and the triangulator refuses the polygon)
	var pts := PackedVector2Array()
	var corners := [[r.position + Vector2(rad, rad), PI], [r.position + Vector2(r.size.x - rad, rad), PI * 1.5],
		[r.position + r.size - Vector2(rad, rad), 0.0], [r.position + Vector2(rad, r.size.y - rad), PI * 0.5]]
	for c in corners:
		for i in 5:
			var a: float = c[1] + float(i) / 4.0 * PI * 0.5
			pts.append(c[0] + Vector2(cos(a), sin(a)) * rad)
	ci.draw_colored_polygon(pts, col)

static func _disc(ci: CanvasItem, c: Vector2, r: float, col: Color) -> void: ci.draw_circle(c, r, col)

static func _leads(ci: CanvasItem, pins: Array, p: float, to: Array = []) -> void:
	for i in pins.size():
		var a: Vector2 = pins[i] * p
		var b: Vector2 = to[i] * p if i < to.size() else a
		ci.draw_line(a, b, Color(0.3, 0.3, 0.33), p * 0.13)
		ci.draw_line(a, b, SILVER, p * 0.085)

## Draw one part. `o` is the screen position of its origin pad.
static func draw(ci: CanvasItem, part: Dictionary, o: Vector2, p: float, st: Dictionary) -> void:
	var rot := float(part.xf_rot) * PI * 0.5
	var sc := Vector2(-1.0 if part.xf_flip else 1.0, 1.0)
	for pass_i in 2:   # 0 = drop shadow (offset in screen space), 1 = the part
		var sh := pass_i == 0
		if sh: ci.draw_set_transform(o + Vector2(p * 0.10, p * 0.16), rot, sc)
		else: ci.draw_set_transform(o, rot, sc)
		_body(ci, part, p, st, sh)
		if not sh: _studs(ci, part, p)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

## A lead end stud on every pin pad, so the two leads of a part read as two connection points. LED legs are colour-coded: warm anode, cool cathode.
static func _studs(ci: CanvasItem, part: Dictionary, p: float) -> void:
	var kind := str(part.kind)
	if kind in ["BAT", "LOAD", "XFMR", "BRIDGE", "SW", "SLIDE", "GALVO", "BOXED"]: return
	var lp: Array = part.local_pins
	for i in lp.size():
		var c: Vector2 = lp[i] * p
		var ring := Color(0.85, 0.85, 0.88)
		if kind == "LED": ring = Color("#ff8a7a") if i == 0 else Color("#7fb2ff")
		ci.draw_circle(c, p * 0.2, Color(0.06, 0.06, 0.08)); ci.draw_circle(c, p * 0.16, ring); ci.draw_circle(c, p * 0.08, Color(0.25, 0.25, 0.28))

static func _c(c: Color, sh: bool) -> Color: return SHADOW if sh else c

static func _body(ci: CanvasItem, part: Dictionary, p: float, st: Dictionary, sh: bool) -> void:
	var lp: Array = part.local_pins
	var smoked: bool = st.get("smoked", false)
	match str(part.kind):
		"R", "POT": _resistor(ci, part, p, sh, smoked, float(st.get("hot", 0.0)))
		"LED": _led(ci, p, sh, float(st.get("lit", 0.0)), smoked)
		"CE": _electrolytic(ci, p, sh, smoked)
		"C": _ceramic(ci, part, p, sh, smoked)
		"D": _diode(ci, p, sh, smoked)
		"NPN", "PNP": _bjt(ci, lp, p, sh, smoked)
		"XFMR": _xfmr(ci, p, sh)
		"BAT":
			if str(part.partId) == "cell-test": PartArt2.dry_cell(ci, lp, p, sh)
			else: _battery(ci, lp, p, sh)
		"BRIDGE": _bridge(ci, part, p, sh, smoked)
		"SW": _switch(ci, lp, p, sh, bool(part.on))
		"LOAD":
			match str(part.partId):
				"adc-in": PartArt2.adc_chip(ci, lp, p, sh)
				"cable-loop": PartArt2.cable_reel(ci, lp, p, sh)
				_: _load(ci, lp, p, sh, float(st.get("hot", 0.0)))
		"GALVO": PartArt2.galvo(ci, lp, p, sh, float(st.get("needle", 0.0)))
		"SLIDE": PartArt2.slide(ci, part, lp, p, sh)
		"BOXED": PartArt2.sealed(ci, lp, p, sh)
		_: _generic(ci, lp, p, sh)

static func _resistor(ci: CanvasItem, part: Dictionary, p: float, sh: bool, smoked: bool, hot := 0.0) -> void:
	match str(part.partId):
		"res-box": PartArt2.res_box(ci, p, sh); return
		"rheostat": PartArt2.rheostat(ci, p, sh); return
		"trimmer": PartArt2.trimmer(ci, part, p, sh); return
	var big: bool = str(part.partId).begins_with("res-ww")
	_leads(ci, [Vector2(0, 0), Vector2(4, 0)], p, [Vector2(1.0, 0), Vector2(3.0, 0)] if not big else [Vector2(0.6, 0), Vector2(3.4, 0)])
	var x0 := (0.9 if not big else 0.6) * p; var x1 := (3.1 if not big else 3.4) * p; var hh := (0.42 if not big else 0.62) * p
	var body := Color(0.84, 0.74, 0.5) if not big else Color(0.93, 0.9, 0.82)
	if hot > 0.05: body = body.lerp(Color(1.0, 0.45, 0.18).lerp(Color(1.0, 0.92, 0.7), maxf(0.0, hot - 0.6)), minf(1.0, hot * 1.1))
	if smoked: body = Color(0.07, 0.06, 0.06)
	rrect(ci, Rect2(x0, -hh, x1 - x0, hh * 2.0), p * 0.22, _c(body, sh))
	if sh: return
	ci.draw_line(Vector2(x0 + p * 0.2, -hh * 0.55), Vector2(x1 - p * 0.2, -hh * 0.55), Color(1, 1, 1, 0.22), p * 0.07)   # specular strip
	if smoked: return
	if big:   # wirewound: ceramic body with a printed value strip, end caps
		rrect(ci, Rect2(x0, -hh, p * 0.2, hh * 2.0), p * 0.08, Color(0.55, 0.56, 0.6))
		rrect(ci, Rect2(x1 - p * 0.2, -hh, p * 0.2, hh * 2.0), p * 0.08, Color(0.55, 0.56, 0.6))
		for k in 6: ci.draw_line(Vector2(x0 + p * (0.5 + k * 0.38), -hh * 0.5), Vector2(x0 + p * (0.5 + k * 0.38), hh * 0.5), Color(0.5, 0.35, 0.2, 0.55), p * 0.05)
		return
	var bd := bands(float(part.value) if part.value != null else 0.0)
	var xs := [1.22, 1.52, 1.82, 2.55]
	for i in 3: ci.draw_line(Vector2(xs[i] * p, -hh), Vector2(xs[i] * p, hh), band_color(bd[i]), p * 0.14)
	ci.draw_line(Vector2(xs[3] * p, -hh), Vector2(xs[3] * p, hh), GOLD, p * 0.14)

static func _led(ci: CanvasItem, p: float, sh: bool, lit: float, smoked: bool) -> void:
	# two legs you can see: the long anode leg (A +, warm) on the left, the short cathode leg (K -, cool) on the right, a smaller dome between them
	var c := Vector2(p, 0)
	var rd := p * 0.58
	if not sh:
		ci.draw_line(Vector2(0, 0), Vector2(p * 0.46, 0), Color(0.3, 0.3, 0.33), p * 0.16); ci.draw_line(Vector2(0, 0), Vector2(p * 0.46, 0), SILVER, p * 0.11)   # A leg: long, runs from its pad to the dome
		ci.draw_line(Vector2(p * 2.0, 0), Vector2(p * 1.58, 0), Color(0.3, 0.3, 0.33), p * 0.16); ci.draw_line(Vector2(p * 2.0, 0), Vector2(p * 1.58, 0), SILVER, p * 0.11)   # K leg
	_disc(ci, c, rd * 1.1, _c(Color(0.55, 0.09, 0.09, 0.9), sh))
	if sh: return
	var dome := Color(0.42, 0.04, 0.05).lerp(Color(1.0, 0.3, 0.22), lit)
	if smoked: dome = Color(0.1, 0.07, 0.07)
	_disc(ci, c, rd, dome)
	if lit > 0.0 and not smoked: _disc(ci, c, rd * 0.5, Color(1, 0.72, 0.6, 0.35 + 0.5 * lit))
	ci.draw_circle(c + Vector2(-rd * 0.36, -rd * 0.36), rd * 0.17, Color(1, 1, 1, 0.42 if not smoked else 0.1))
	ci.draw_line(c + Vector2(rd * 1.02, -rd * 0.62), c + Vector2(rd * 1.02, rd * 0.62), Color(0.95, 0.82, 0.8, 0.9), p * 0.1)   # the flat side of the rim = cathode
	if smoked:   # a crack across the dome
		ci.draw_polyline(PackedVector2Array([c + Vector2(-rd * 0.7, -rd * 0.6), c + Vector2(-rd * 0.1, -rd * 0.05), c + Vector2(rd * 0.25, -rd * 0.35), c + Vector2(rd * 0.65, rd * 0.35)]), Color(0.7, 0.7, 0.72), p * 0.06)

static func _electrolytic(ci: CanvasItem, p: float, sh: bool, smoked: bool) -> void:
	_leads(ci, [Vector2(0, 0), Vector2(2, 0)], p, [Vector2(0.5, 0), Vector2(1.5, 0)])
	var c := Vector2(p, 0)
	_disc(ci, c, p * 1.12, _c(Color(0.08, 0.17, 0.4), sh))
	if sh: return
	_disc(ci, c, p * 0.9, Color(0.5, 0.52, 0.56) if not smoked else Color(0.1, 0.1, 0.1))
	_disc(ci, c, p * 0.8, Color(0.62, 0.64, 0.68) if not smoked else Color(0.13, 0.12, 0.12))
	ci.draw_line(c + Vector2(-p * 0.45, 0), c + Vector2(p * 0.45, 0), Color(0.35, 0.37, 0.4), p * 0.06)   # vent score
	ci.draw_line(c + Vector2(0, -p * 0.45), c + Vector2(0, p * 0.45), Color(0.35, 0.37, 0.4), p * 0.06)
	var pts := PackedVector2Array()   # polarity stripe on the "-" side (pin 2, +x)
	for i in 9: var a := -0.75 + float(i) / 8.0 * 1.5; pts.append(c + Vector2(cos(a), sin(a)) * p * 1.1)
	for i in 9: var a := 0.75 - float(i) / 8.0 * 1.5; pts.append(c + Vector2(cos(a), sin(a)) * p * 0.93)
	ci.draw_colored_polygon(pts, Color(0.82, 0.88, 0.95))
	ci.draw_line(c + Vector2(p * 0.96, -p * 0.12), c + Vector2(p * 1.04, -p * 0.12), Color(0.1, 0.17, 0.4), p * 0.05)
	if smoked: ci.draw_arc(c, p * 0.82, 0.0, TAU, 24, Color(0.02, 0.02, 0.02), p * 0.12)

static func _ceramic(ci: CanvasItem, part: Dictionary, p: float, sh: bool, smoked: bool) -> void:
	_leads(ci, [Vector2(0, 0), Vector2(4, 0)], p, [Vector2(1.3, 0), Vector2(2.7, 0)])
	var film: bool = str(part.partId).begins_with("cap-x")
	var col := Color(0.93, 0.62, 0.16) if not film else Color(0.78, 0.2, 0.16)
	if smoked: col = Color(0.08, 0.07, 0.07)
	var r := Rect2(1.2 * p, -0.58 * p, 1.6 * p, 1.16 * p) if not film else Rect2(0.9 * p, -0.72 * p, 2.2 * p, 1.44 * p)
	rrect(ci, r, p * 0.3 if not film else p * 0.12, _c(col, sh))
	if not sh: ci.draw_line(r.position + Vector2(p * 0.2, p * 0.2), r.position + Vector2(r.size.x - p * 0.2, p * 0.2), Color(1, 1, 1, 0.25), p * 0.07)

static func _diode(ci: CanvasItem, p: float, sh: bool, smoked: bool) -> void:
	_leads(ci, [Vector2(0, 0), Vector2(4, 0)], p, [Vector2(1.1, 0), Vector2(2.9, 0)])
	rrect(ci, Rect2(1.05 * p, -0.34 * p, 1.9 * p, 0.68 * p), p * 0.15, _c(Color(0.09, 0.09, 0.1) if not smoked else Color(0.03, 0.03, 0.03), sh))
	if sh: return
	ci.draw_line(Vector2(2.6 * p, -0.34 * p), Vector2(2.6 * p, 0.34 * p), Color(0.82, 0.84, 0.88), p * 0.2)   # cathode band at pin 2
	ci.draw_line(Vector2(1.3 * p, -0.17 * p), Vector2(2.3 * p, -0.17 * p), Color(1, 1, 1, 0.16), p * 0.06)

static func _bjt(ci: CanvasItem, lp: Array, p: float, sh: bool, smoked: bool) -> void:
	_leads(ci, lp, p, lp.map(func(v): return v + Vector2(0, -0.4)))
	var cx: float = (lp[0].x + lp[lp.size() - 1].x) * 0.5 * p
	var r: float = (lp[lp.size() - 1].x - lp[0].x) * 0.5 * p + p * 0.6
	var base_y := -0.38 * p
	var pts := PackedVector2Array()
	for i in 17:
		var a := PI + float(i) / 16.0 * PI
		pts.append(Vector2(cx + cos(a) * r, base_y + sin(a) * r * 1.0))
	ci.draw_colored_polygon(pts, _c(Color(0.1, 0.1, 0.12) if not smoked else Color(0.03, 0.03, 0.03), sh))
	if sh: return
	ci.draw_arc(Vector2(cx, base_y), r * 0.78, PI * 1.15, PI * 1.55, 8, Color(1, 1, 1, 0.2), p * 0.07)
	ci.draw_line(Vector2(cx - r, base_y), Vector2(cx + r, base_y), Color(0.2, 0.2, 0.24), p * 0.06)

static func _xfmr(ci: CanvasItem, p: float, sh: bool) -> void:
	_leads(ci, [Vector2(0, 0), Vector2(0, 4), Vector2(4, 0), Vector2(4, 4)], p, [Vector2(0.7, 0), Vector2(0.7, 4), Vector2(3.3, 0), Vector2(3.3, 4)])
	var r := Rect2(0.7 * p, -0.7 * p, 2.6 * p, 5.4 * p)
	rrect(ci, r, p * 0.12, _c(Color(0.3, 0.32, 0.36), sh))
	if sh: return
	for k in 14: ci.draw_line(Vector2(r.position.x + p * 0.08, r.position.y + p * (0.3 + k * 0.38)), Vector2(r.end.x - p * 0.08, r.position.y + p * (0.3 + k * 0.38)), Color(0.2, 0.21, 0.24, 0.6), p * 0.04)
	for side in 2:   # two copper bobbins in the core window
		var x := r.position.x + p * (0.22 if side == 0 else 1.34)
		rrect(ci, Rect2(x, p * -0.25, p * 1.04, p * 4.5), p * 0.1, Color(0.72, 0.38, 0.12))
		for k in 22: ci.draw_line(Vector2(x + p * 0.06, p * (-0.15 + k * 0.2)), Vector2(x + p * 0.98, p * (-0.15 + k * 0.2)), Color(0.45, 0.2, 0.06, 0.75), p * 0.035)
	ci.draw_line(r.position + Vector2(p * 0.2, p * 0.1), Vector2(r.end.x - p * 0.2, r.position.y + p * 0.1), Color(1, 1, 1, 0.14), p * 0.07)

static func _battery(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p
	var r := Rect2(a.x - p * 0.9, -p * 1.45, (b.x - a.x) + p * 1.8, p * 2.9)
	rrect(ci, r, p * 0.3, _c(Color(0.13, 0.14, 0.17), sh))
	if sh: return
	rrect(ci, Rect2(r.position.x, r.position.y, r.size.x, r.size.y * 0.16), p * 0.2, Color(0.62, 0.45, 0.14))   # copper top band
	ci.draw_line(r.position + Vector2(p * 0.3, p * 1.2), Vector2(r.end.x - p * 0.3, r.position.y + p * 1.2), Color(1, 1, 1, 0.1), p * 0.07)
	for i in 2:   # snap terminals
		var c: Vector2 = a if i == 0 else b
		ci.draw_circle(c, p * 0.42, Color(0.55, 0.57, 0.6)); ci.draw_circle(c, p * 0.3, SILVER); ci.draw_circle(c, p * 0.12, Color(0.3, 0.3, 0.33))
	ci.draw_line(a + Vector2(-p * 0.1, p * 0.75), a + Vector2(p * 0.1, p * 0.75), Color(0.95, 0.3, 0.25), p * 0.07)   # + / - marks
	ci.draw_line(a + Vector2(0, p * 0.65), a + Vector2(0, p * 0.85), Color(0.95, 0.3, 0.25), p * 0.07)
	ci.draw_line(b + Vector2(-p * 0.12, p * 0.75), b + Vector2(p * 0.12, p * 0.75), Color(0.6, 0.7, 0.85), p * 0.07)

static func _bridge(ci: CanvasItem, part: Dictionary, p: float, sh: bool, smoked: bool) -> void:
	var lp: Array = part.local_pins
	var mn := Vector2(1e9, 1e9); var mx := Vector2(-1e9, -1e9)
	for v in lp: mn = mn.min(v); mx = mx.max(v)
	var r := Rect2(mn * p + Vector2(p * 0.45, p * 0.45) * (1 if mx.x - mn.x > 1 else 0), (mx - mn) * p - Vector2(p * 0.9, p * 0.9))
	if r.size.x < p or r.size.y < p: r = Rect2(mn * p - Vector2(p * 0.4, p * 0.4), (mx - mn) * p + Vector2(p * 0.8, p * 0.8))
	_leads(ci, lp, p, lp.map(func(v): return v + Vector2(signf(r.get_center().x / p - v.x) * 0.45, signf(r.get_center().y / p - v.y) * 0.45)))
	rrect(ci, r, p * 0.14, _c(Color(0.2, 0.21, 0.25) if not smoked else Color(0.03, 0.03, 0.03), sh))
	if sh: return
	ci.draw_rect(r.grow(-p * 0.12), Color(0.1, 0.1, 0.13) if not smoked else Color(0.02, 0.02, 0.02), true)
	ci.draw_colored_polygon(PackedVector2Array([r.position, r.position + Vector2(p * 0.55, 0), r.position + Vector2(0, p * 0.55)]), Color(0.3, 0.3, 0.34))   # chamfer / pin-1 corner
	ci.draw_line(r.position + Vector2(p * 0.2, p * 0.15), r.position + Vector2(r.size.x - p * 0.2, p * 0.15), Color(1, 1, 1, 0.16), p * 0.07)
	var names: Array = part.pin_names
	for i in mini(lp.size(), names.size()):   # engraved pin marks next to each pin
		var t: Vector2 = Vector2(lp[i].x, lp[i].y) * p + (r.get_center() - lp[i] * p).normalized() * p * 0.95
		ci.draw_string(ThemeDB.fallback_font, t + Vector2(-p * 0.12, p * 0.14), str(names[i]), HORIZONTAL_ALIGNMENT_LEFT, -1.0, int(clampf(p * 0.42, 9, 26)), Color(0.75, 0.78, 0.85))

static func _switch(ci: CanvasItem, lp: Array, p: float, sh: bool, on: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p
	var r := Rect2(a.x - p * 0.3, -p * 0.7, (b.x - a.x) + p * 0.6, p * 1.4)
	rrect(ci, r, p * 0.2, _c(Color(0.16, 0.17, 0.2), sh))
	if sh: return
	ci.draw_circle(a, p * 0.2, SILVER); ci.draw_circle(b, p * 0.2, SILVER)
	ci.draw_line(a, a.lerp(b, 0.97 if on else 0.7) + Vector2(0, 0 if on else -p * 0.6), Color(0.9, 0.35, 0.2), p * 0.22)

## The customer's fixed load (1-3 heater element): a ceramic block with a visible nichrome coil that glows with heat.
static func _load(ci: CanvasItem, lp: Array, p: float, sh: bool, hot: float) -> void:
	var mn := Vector2(1e9, 1e9); var mx := Vector2(-1e9, -1e9)
	for v in lp: mn = mn.min(v); mx = mx.max(v)
	_leads(ci, lp, p, [mn + Vector2(0, 0.5), mx - Vector2(0, 0.5)])
	var r := Rect2(mn * p + Vector2(-p * 0.75, p * 0.5), (mx - mn) * p + Vector2(p * 1.5, -p * 1.0))
	rrect(ci, r, p * 0.3, _c(Color(0.78, 0.74, 0.66), sh))
	if sh: return
	rrect(ci, r.grow(-p * 0.12), p * 0.22, Color(0.9, 0.87, 0.8))
	var cx := r.get_center().x; var n := 9
	for i in n:
		var y := r.position.y + p * 0.45 + (r.size.y - p * 0.9) * float(i) / float(n - 1)
		ci.draw_line(Vector2(cx - p * 0.5, y), Vector2(cx + p * 0.5, y + p * 0.12), Color(0.55, 0.2, 0.1).lerp(Color(1.0, 0.6, 0.2), hot), p * 0.09)
	ci.draw_line(Vector2(r.position.x + p * 0.15, r.position.y + p * 0.3), Vector2(r.position.x + p * 0.15, r.end.y - p * 0.3), Color(1, 1, 1, 0.3), p * 0.06)

static func _generic(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	if lp.is_empty(): return
	var mn := Vector2(1e9, 1e9); var mx := Vector2(-1e9, -1e9)
	for v in lp: mn = mn.min(v); mx = mx.max(v)
	_leads(ci, lp, p)
	rrect(ci, Rect2(mn * p - Vector2(p * 0.4, p * 0.6), (mx - mn) * p + Vector2(p * 0.8, p * 1.2)), p * 0.15, _c(Color(0.2, 0.22, 0.26), sh))

## Screen-space bounding box of a part's pins, padded by the body size (labels, glow, smoke anchor).
static func screen_bounds(part: Dictionary, pin_px: Array, p: float) -> Rect2:
	var mn := Vector2(1e9, 1e9); var mx := Vector2(-1e9, -1e9)
	for v in pin_px: mn = mn.min(v); mx = mx.max(v)
	var pad := p * (0.9 if str(part.kind) != "XFMR" else 0.8)
	if str(part.kind) in ["BAT", "GALVO", "BOXED"]: pad = p * 1.6
	if str(part.kind) == "SLIDE": pad = p * 1.2
	return Rect2(mn - Vector2(pad, pad), (mx - mn) + Vector2(pad, pad) * 2.0)
