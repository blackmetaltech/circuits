class_name ExamFigure
extends RefCounted
## The hand-drawn circuit figure of an exam-bridge ticket (DESIGN §2.5: the exam bridge is the one place a schematic is allowed; everywhere else the
## bench is a real board). The engine owns the numbers (ticketCard().figure: sources with their volts and series resistors meeting at a named node,
## a load resistor to ground); this only draws them, in ink on the exam slip. Fixed 440 x 400 design space, scaled into the rect it is given.

const S = preload("res://stall/stall_style.gd")
const DESIGN := Vector2(440, 400)

## Draw `fig` (the engine's figure) into `r`. `ink` is the pen colour; `asks` are the unknowns to mark on the figure ("V(A)", "I(E2)").
static func draw(ci: CanvasItem, r: Rect2, fig: Dictionary, ink: Color, asks: Array = [], small := false) -> void:
	if fig.is_empty(): return
	if str(fig.get("kind", "node")) == "pot": _draw_pot(ci, r, fig, ink, asks, small); return
	if str(fig.get("kind", "node")) == "caps": _draw_caps(ci, r, fig, ink, asks, small); return
	if str(fig.get("kind", "node")) == "zener": _draw_zener(ci, r, fig, ink, asks, small); return
	if str(fig.get("kind", "node")) == "amp": _draw_amp(ci, r, fig, ink, asks, small); return
	if str(fig.get("kind", "node")) == "sum": _draw_sum(ci, r, fig, ink, asks, small); return
	var k := minf(r.size.x / DESIGN.x, r.size.y / DESIGN.y)
	var o := r.position + (r.size - DESIGN * k) * 0.5
	var P := func(x: float, y: float) -> Vector2: return o + Vector2(x, y) * k
	var w := maxf(1.6, 3.0 * k)
	var f := S.hand()
	var fs := int(maxf(9.0, (22.0 if not small else 36.0) * k))
	var srcs: Array = fig.get("sources", [])
	var node := str(fig.get("node", "A"))
	var load: Dictionary = fig.get("load", {})
	var na := Vector2(220, 190)      # the common node
	var rail_y := 350.0
	# ground rail and symbol
	_wire(ci, [P.call(70, rail_y), P.call(390, rail_y)], ink, w)
	for g in 3:
		var gy := rail_y + 14.0 + g * 9.0; var hw := 20.0 - g * 7.0
		ci.draw_line(P.call(220 - hw, gy), P.call(220 + hw, gy), ink, w)
	ci.draw_line(P.call(220, rail_y), P.call(220, rail_y + 8), ink, w)
	for i in mini(2, srcs.size()):
		var s: Dictionary = srcs[i]; var left := i == 0
		var bx := 70.0 if left else 390.0
		# source: minus end on the rail, plates, plus end up to the series resistor row
		_wire(ci, [P.call(bx, rail_y), P.call(bx, 300)], ink, w)
		ci.draw_line(P.call(bx - 11, 300), P.call(bx + 11, 300), ink, w * 1.8)    # short fat plate = minus
		ci.draw_line(P.call(bx - 20, 280), P.call(bx + 20, 280), ink, w)           # long thin plate = plus
		_wire(ci, [P.call(bx, 280), P.call(bx, na.y)], ink, w)
		S.text(ci, f, "+", P.call(bx + (-36 if left else 26), 288), int(fs * 1.1), ink)
		var lbl := ("%s V" % EngineBench._g(float(s.volts))) if small else ("%s = %s V" % [str(s.name), EngineBench._g(float(s.volts))])
		var lw := S.tw(f, lbl, fs) / maxf(k, 0.01)
		S.text(ci, f, lbl, P.call(bx + 12 if left else bx - 12 - lw, 337), fs, ink)
		# series resistor along the row into the node
		var x0 := 112.0 if left else 328.0; var x1 := 190.0 if left else 250.0
		var rr: Dictionary = s.get("r", {})
		_wire(ci, [P.call(bx, na.y), P.call(x0 if left else x0, na.y)], ink, w)
		_zig(ci, P.call(minf(x0, x1), na.y), P.call(maxf(x0, x1), na.y), 9.0 * k, ink, w)
		_wire(ci, [P.call(x1 if left else x1, na.y), P.call(na.x, na.y)], ink, w)
		var rl := ("%s Ω" % EngineBench._g(float(rr.get("ohm", 0)))) if small else ("%s = %s Ω" % [str(rr.get("name", "R")), EngineBench._g(float(rr.get("ohm", 0)))])
		S.text(ci, f, rl, P.call(minf(x0, x1) - 2, na.y - 22), fs, ink)
	# the load to ground
	_wire(ci, [P.call(na.x, na.y), P.call(na.x, 228)], ink, w)
	_zig(ci, P.call(na.x, 228), P.call(na.x, 318), 9.0 * k, ink, w)
	_wire(ci, [P.call(na.x, 318), P.call(na.x, rail_y)], ink, w)
	S.text(ci, f, ("%s Ω" % EngineBench._g(float(load.get("ohm", 0)))) if small else ("%s = %s Ω" % [str(load.get("name", "R")), EngineBench._g(float(load.get("ohm", 0)))]), P.call(na.x + 22, 278), fs, ink)
	# the common node: a solder dot, named
	ci.draw_circle(P.call(na.x, na.y), 6.0 * k + 1.0, ink)
	S.text(ci, f, node, P.call(na.x - 8, na.y - 38), int(fs * 1.7), S.INK_RED)
	# what the problem asks for, marked on the figure
	if not asks.is_empty() and not small:
		S.text(ci, f, "find:  " + "   ".join(asks), P.call(110, 40), fs, S.INK_RED)

## A pencil-ish wire through points: straight segments with a hair of hand wobble that is the same every frame.
static func _wire(ci: CanvasItem, pts: Array, ink: Color, w: float) -> void:
	for i in pts.size() - 1:
		var a: Vector2 = pts[i]; var b: Vector2 = pts[i + 1]
		var mid := (a + b) * 0.5 + (b - a).orthogonal().normalized() * sin(a.x * 0.11 + a.y * 0.07) * 1.2
		ci.draw_polyline(PackedVector2Array([a, mid, b]), ink, w, true)

## A resistor zigzag from a to b (any axis), amplitude `amp`.
static func _zig(ci: CanvasItem, a: Vector2, b: Vector2, amp: float, ink: Color, w: float) -> void:
	var d := b - a; var n := 6; var side := d.orthogonal().normalized() * amp
	var pts := PackedVector2Array([a])
	for i in n:
		var u := (float(i) + 0.5) / float(n)
		pts.append(a + d * u + side * (1.0 if i % 2 == 0 else -1.0))
	pts.append(b)
	ci.draw_polyline(pts, ink, w, true)

## The 2-4 figure, the way a textbook draws a slide-wire potentiometer: the wire AB with its jockey J, the driver cell and rheostat in the main loop below, the cell under test,
## its shunt and a galvanometer G in the loop above. All numbers are the engine's (figure.pot).
static func _draw_pot(ci: CanvasItem, r: Rect2, fig: Dictionary, ink: Color, asks: Array, small: bool) -> void:
	var pot: Dictionary = fig.get("pot", {})
	var k := minf(r.size.x / DESIGN.x, r.size.y / DESIGN.y)
	var o := r.position + (r.size - DESIGN * k) * 0.5
	var P := func(x: float, y: float) -> Vector2: return o + Vector2(x, y) * k
	var w := maxf(1.6, 3.0 * k)
	var f := S.hand()
	var fs := int(maxf(9.0, (20.0 if not small else 30.0) * k))
	var ay := 250.0
	# the slide wire AB: a thick line with its ends named, the jockey arrow coming down onto it
	ci.draw_line(P.call(70, ay), P.call(370, ay), ink, w * 2.4)
	S.text(ci, f, "A", P.call(50, ay + 8), int(fs * 1.6), S.INK_RED); S.text(ci, f, "B", P.call(378, ay + 8), int(fs * 1.6), S.INK_RED)
	if not small: S.text(ci, f, "%s cm, %s \u03a9" % [EngineBench._g(float(pot.get("wireCm", 100))), EngineBench._g(float(pot.get("wireOhm", 10)))], P.call(150, ay + 34), fs, ink)
	# main loop below: A down, the driver cell, the rheostat, up to B
	_wire(ci, [P.call(70, ay), P.call(70, 330), P.call(110, 330)], ink, w)
	_cell(ci, P.call(110, 330), k, ink, w)
	_wire(ci, [P.call(124, 330), P.call(170, 330)], ink, w)
	_zig(ci, P.call(170, 330), P.call(260, 330), 9.0 * k, ink, w)
	_wire(ci, [P.call(260, 330), P.call(370, 330), P.call(370, ay)], ink, w)
	S.text(ci, f, "%s V" % EngineBench._g(float(pot.get("driverV", 4))), P.call(96, 360), fs, ink)
	S.text(ci, f, "%s \u03a9" % EngineBench._g(float(pot.get("rheostat", 10))), P.call(190, 360), fs, ink)
	# the loop above: A up, the cell under test (with its shunt over it), the galvanometer, over to the jockey and down onto the wire
	_wire(ci, [P.call(70, ay), P.call(70, 150), P.call(110, 150)], ink, w)
	_cell(ci, P.call(110, 150), k, ink, w)
	_wire(ci, [P.call(124, 150), P.call(190, 150)], ink, w)
	ci.draw_arc(P.call(214, 150), 24.0 * k, 0.0, TAU, 24, ink, w); S.text(ci, f, "G", P.call(205, 160), int(fs * 1.4), ink)
	_wire(ci, [P.call(238, 150), P.call(290, 150), P.call(290, ay - 8)], ink, w)
	ci.draw_colored_polygon(PackedVector2Array([P.call(290, ay - 2), P.call(283, ay - 18), P.call(297, ay - 18)]), ink)
	S.text(ci, f, "J", P.call(298, 196), int(fs * 1.4), S.INK_RED)
	_wire(ci, [P.call(70, 150), P.call(70, 98), P.call(116, 98)], ink, w)
	_zig(ci, P.call(116, 98), P.call(176, 98), 8.0 * k, ink, w)
	_wire(ci, [P.call(176, 98), P.call(190, 98), P.call(190, 150)], ink, w)
	S.text(ci, f, "%s \u03a9 (shunt)" % EngineBench._g(float(pot.get("shunt", 4.5))), P.call(100, 78), fs, ink)
	if not small:
		S.text(ci, f, "open: %s cm" % EngineBench._g(float(pot.get("l1Cm", 75)), 4), P.call(304, 176), fs, Color(ink, 0.9))
		S.text(ci, f, "shunt: %s cm" % EngineBench._g(float(pot.get("l2Cm", 67.5)), 4), P.call(304, 202), fs, Color(ink, 0.9))
		if not asks.is_empty(): S.text(ci, f, "find:  " + "   ".join(asks), P.call(70, 30), fs, S.INK_RED)

## A cell symbol: a long thin plate (+, left) and a short fat plate (-, right), centred on `c` (the left plate sits at c, the right plate 14 design px to its right).
static func _cell(ci: CanvasItem, c: Vector2, k: float, ink: Color, w: float, vertical := false) -> void:
	if vertical:   # plates horizontal: the long (+) plate on top, the short fat (-) plate below it
		ci.draw_line(c + Vector2(-18.0 * k, 0), c + Vector2(18.0 * k, 0), ink, w); ci.draw_line(c + Vector2(-9.0 * k, 14.0 * k), c + Vector2(9.0 * k, 14.0 * k), ink, w * 1.9)
		return
	ci.draw_line(c + Vector2(0, -18.0 * k), c + Vector2(0, 18.0 * k), ink, w)
	ci.draw_line(c + Vector2(14.0 * k, -9.0 * k), c + Vector2(14.0 * k, 9.0 * k), ink, w * 1.9)

## The 3-4 figure, the way a textbook draws two capacitor cards: (a) a source across a capacitor in series with two in parallel; (b) a charged capacitor, a switch and an empty one.
## All numbers are the engine's (figure.caps, microfarads and volts).
static func _draw_caps(ci: CanvasItem, r: Rect2, fig: Dictionary, ink: Color, asks: Array, small: bool) -> void:
	var cp: Dictionary = fig.get("caps", {})
	var a: Dictionary = cp.get("a", {}); var b: Dictionary = cp.get("b", {})
	var k := minf(r.size.x / DESIGN.x, r.size.y / DESIGN.y)
	var o := r.position + (r.size - DESIGN * k) * 0.5
	var P := func(x: float, y: float) -> Vector2: return o + Vector2(x, y) * k
	var w := maxf(1.6, 3.0 * k)
	var f := S.hand()
	var fs := int(maxf(9.0, (20.0 if not small else 30.0) * k))
	var uf := func(x: float) -> String: return "%s \u00b5F" % EngineBench._g(float(x))
	# card (a): the source on the left, C1 along the top to the node M, then C2 and C3 side by side down to the ground rail
	S.text(ci, f, "(a)", P.call(8, 40), int(fs * 1.3), S.INK_RED)
	var ty := 56.0; var by := 168.0
	_wire(ci, [P.call(52, by), P.call(52, 118)], ink, w); _cell(ci, P.call(40, 108), k, ink, w, true)
	_wire(ci, [P.call(52, 92), P.call(52, ty), P.call(128, ty)], ink, w)
	_cap_h(ci, P.call(128, ty), k, ink, w); _wire(ci, [P.call(142, ty), P.call(214, ty)], ink, w)
	S.text(ci, f, uf.call(a.get("c1", 2)), P.call(102, ty - 26), fs, ink)
	S.text(ci, f, "%s V" % EngineBench._g(float(a.get("volts", 110))), P.call(66, 118), fs, ink)
	ci.draw_circle(P.call(214, ty), 5.0 * k + 1.0, ink); S.text(ci, f, "M", P.call(204, ty - 20), int(fs * 1.3), S.INK_RED)
	_wire(ci, [P.call(214, ty), P.call(330, ty)], ink, w)
	for i in 2:
		var x := 254.0 + float(i) * 76.0
		_wire(ci, [P.call(x, ty), P.call(x, 100)], ink, w); _cap_v(ci, P.call(x, 100), k, ink, w); _wire(ci, [P.call(x, 114), P.call(x, by)], ink, w)
		S.text(ci, f, uf.call(a.get("c2", 3) if i == 0 else a.get("c3", 6)), P.call(x + 12, 112), fs, ink)
	_wire(ci, [P.call(52, by), P.call(330, by)], ink, w)
	_gnd(ci, P.call(190, by), k, ink, w)
	# card (b): a charged capacitor, a switch, an empty one
	S.text(ci, f, "(b)", P.call(8, 232), int(fs * 1.3), S.INK_RED)
	var ty2 := 262.0; var by2 := 366.0
	_wire(ci, [P.call(86, by2), P.call(86, 322)], ink, w); _cap_v(ci, P.call(86, 308), k, ink, w); _wire(ci, [P.call(86, 294), P.call(86, ty2), P.call(160, ty2)], ink, w)
	S.text(ci, f, "+", P.call(96, 300), fs, ink)
	S.text(ci, f, "%s, %s V" % [uf.call(b.get("c1", 4)), EngineBench._g(float(b.get("v1", 100)))], P.call(14, 346), fs, ink)
	ci.draw_circle(P.call(160, ty2), 4.0 * k + 1.0, ink); ci.draw_circle(P.call(214, ty2), 4.0 * k + 1.0, ink)
	ci.draw_line(P.call(160, ty2), P.call(206, ty2 - 28.0), ink, w)   # the switch blade, open
	S.text(ci, f, "switch", P.call(150, ty2 - 36), fs, ink)
	_wire(ci, [P.call(214, ty2), P.call(300, ty2), P.call(300, 308)], ink, w); _cap_v(ci, P.call(300, 308), k, ink, w); _wire(ci, [P.call(300, 322), P.call(300, by2)], ink, w)
	S.text(ci, f, uf.call(b.get("c2", 6)), P.call(312, 330), fs, ink)
	_wire(ci, [P.call(86, by2), P.call(300, by2)], ink, w)
	_gnd(ci, P.call(193, by2), k, ink, w)
	if not asks.is_empty() and not small: S.text(ci, f, "find:  " + "   ".join(asks), P.call(70, 20), fs, S.INK_RED)

## The 4-5 figure: a source, Rs in series, the node M, and from M to ground a Zener (cathode up: the bar on the M side) in parallel with the load RL. All numbers are the engine's (figure.zener).
static func _draw_zener(ci: CanvasItem, r: Rect2, fig: Dictionary, ink: Color, asks: Array, small: bool) -> void:
	var z: Dictionary = fig.get("zener", {})
	var k := minf(r.size.x / DESIGN.x, r.size.y / DESIGN.y)
	var o := r.position + (r.size - DESIGN * k) * 0.5
	var P := func(x: float, y: float) -> Vector2: return o + Vector2(x, y) * k
	var w := maxf(1.6, 3.0 * k); var f := S.hand()
	var fs := int(maxf(9.0, (22.0 if not small else 32.0) * k))
	var ty := 120.0; var by := 330.0
	_wire(ci, [P.call(56, by), P.call(56, 232)], ink, w)
	ci.draw_line(P.call(44, 232), P.call(68, 232), ink, w * 1.8); ci.draw_line(P.call(36, 212), P.call(76, 212), ink, w)
	_wire(ci, [P.call(56, 212), P.call(56, ty), P.call(110, ty)], ink, w)
	S.text(ci, f, "%s V" % EngineBench._g(float(z.get("volts", 12))), P.call(68, 270), fs, ink)
	_zig(ci, P.call(110, ty), P.call(200, ty), 9.0 * k, ink, w)
	S.text(ci, f, "Rs = %s \u03a9" % EngineBench._g(float(z.get("rs", 300))), P.call(104, ty - 24), fs, ink)
	_wire(ci, [P.call(200, ty), P.call(340, ty)], ink, w)
	ci.draw_circle(P.call(240, ty), 6.0 * k + 1.0, ink); S.text(ci, f, "M pad", P.call(222, ty - 20), int(fs * 0.9), ink)   # the board's own pad name
	# the Zener from M down to the rail: a triangle pointing UP the page toward M's bar (current flows from the rail up to M in reverse: the bar on M's side)
	var zx := 240.0
	_wire(ci, [P.call(zx, ty), P.call(zx, 196)], ink, w)
	ci.draw_line(P.call(zx - 18, 196), P.call(zx + 18, 196), ink, w * 1.7); ci.draw_line(P.call(zx - 18, 196), P.call(zx - 26, 188), ink, w); ci.draw_line(P.call(zx + 18, 196), P.call(zx + 26, 204), ink, w)
	ci.draw_colored_polygon(PackedVector2Array([P.call(zx - 18, 236), P.call(zx + 18, 236), P.call(zx, 200)]), ink)
	_wire(ci, [P.call(zx, 236), P.call(zx, by)], ink, w)
	S.text(ci, f, "Zener %s V" % EngineBench._g(float(z.get("vz", 6))), P.call(zx - 132, 222), fs, ink)   # left of the Zener: the load column stands to its right
	S.text(ci, f, "Iz(min) %s mA" % EngineBench._g(float(z.get("izMin", 0.002)) * 1000.0), P.call(zx - 146, 248), int(fs * 0.85), ink)
	_wire(ci, [P.call(340, ty), P.call(340, 190)], ink, w); _zig(ci, P.call(340, 190), P.call(340, 280), 9.0 * k, ink, w); _wire(ci, [P.call(340, 280), P.call(340, by)], ink, w)
	S.text(ci, f, "RL =", P.call(352, 232), fs, ink); S.text(ci, f, "%s \u03a9" % EngineBench._g(float(z.get("rl", 1000))), P.call(352, 256), fs, ink)
	_wire(ci, [P.call(56, by), P.call(340, by)], ink, w); _gnd(ci, P.call(200, by), k, ink, w)
	if not asks.is_empty() and not small: S.text(ci, f, "find:  " + "   ".join(asks), P.call(40, 40), fs, S.INK_RED)

## The 5-5 figure: the supply rail, RB to the base, RC to the collector (the M pad), the emitter to ground, with beta and VBE printed. All numbers are the engine's (figure.amp).
static func _draw_amp(ci: CanvasItem, r: Rect2, fig: Dictionary, ink: Color, asks: Array, small: bool) -> void:
	var a: Dictionary = fig.get("amp", {})
	var k := minf(r.size.x / DESIGN.x, r.size.y / DESIGN.y)
	var o := r.position + (r.size - DESIGN * k) * 0.5
	var P := func(x: float, y: float) -> Vector2: return o + Vector2(x, y) * k
	var w := maxf(1.6, 3.0 * k); var f := S.hand()
	var fs := int(maxf(9.0, (22.0 if not small else 32.0) * k))
	var kohm := func(v: float) -> String: return "%s k\u03a9" % EngineBench._g(v / 1000.0)
	_wire(ci, [P.call(60, 78), P.call(330, 78)], ink, w)
	S.text(ci, f, "VCC = %s V" % EngineBench._g(float(a.get("vcc", 12))), P.call(62, 58), fs, ink)
	# RB: from the rail down to the base lead
	_wire(ci, [P.call(130, 78), P.call(130, 120)], ink, w); _zig(ci, P.call(130, 120), P.call(130, 200), 9.0 * k, ink, w); _wire(ci, [P.call(130, 200), P.call(130, 236), P.call(178, 236)], ink, w)
	S.text(ci, f, "RB", P.call(70, 160), fs, ink); S.text(ci, f, kohm.call(float(a.get("rb", 565000))), P.call(60, 184), int(fs * 0.9), ink)
	# the transistor: a base bar, a collector lead up and an emitter lead down with its arrow
	ci.draw_line(P.call(178, 212), P.call(178, 260), ink, w * 1.8)
	_wire(ci, [P.call(178, 224), P.call(212, 200), P.call(212, 160)], ink, w)
	_wire(ci, [P.call(178, 248), P.call(212, 272), P.call(212, 330)], ink, w)
	ci.draw_colored_polygon(PackedVector2Array([P.call(212, 272), P.call(194, 268), P.call(202, 256)]), ink)
	# RC: from the rail to the collector; the M pad sits on the collector
	_wire(ci, [P.call(212, 78), P.call(212, 96)], ink, w); _zig(ci, P.call(212, 96), P.call(212, 150), 9.0 * k, ink, w); _wire(ci, [P.call(212, 150), P.call(212, 160)], ink, w)
	S.text(ci, f, "RC", P.call(236, 118), fs, ink); S.text(ci, f, kohm.call(float(a.get("rc", 3000))), P.call(236, 142), int(fs * 0.9), ink)
	ci.draw_circle(P.call(212, 180), 6.0 * k + 1.0, ink); S.text(ci, f, "M pad", P.call(228, 188), int(fs * 0.9), ink)
	_gnd(ci, P.call(212, 330), k, ink, w)
	S.text(ci, f, "\u03b2 = %s,  VBE = %s V" % [EngineBench._g(float(a.get("beta", 100))), EngineBench._g(float(a.get("vbe", 0.7)))], P.call(60, 384), int(fs * 0.9), ink)
	if not asks.is_empty() and not small: S.text(ci, f, "find:  " + "   ".join(asks), P.call(60, 22), fs, S.INK_RED)

## The 6-7 figure: three sources, each through its own resistor, into the op-amp's - input; Rf from OUT (the M pad) back to it; + to
## ground; the rails printed. All numbers are the engine's (figure.sources, figure.load = Rf, figure.sum.rails).
static func _draw_sum(ci: CanvasItem, r: Rect2, fig: Dictionary, ink: Color, asks: Array, small: bool) -> void:
	var k := minf(r.size.x / DESIGN.x, r.size.y / DESIGN.y)
	var o := r.position + (r.size - DESIGN * k) * 0.5
	var P := func(x: float, y: float) -> Vector2: return o + Vector2(x, y) * k
	var w := maxf(1.6, 3.0 * k); var f := S.hand()
	var fs := int(maxf(9.0, (20.0 if not small else 30.0) * k))
	var kohm := func(v: float) -> String: return "%s k\u03a9" % EngineBench._g(v / 1000.0)
	var srcs: Array = fig.get("sources", [])
	var rf: Dictionary = fig.get("load", {})
	var nx := 236.0; var ny := 220.0          # the - input node
	# the op-amp triangle: - at (256, 220), + at (256, 268), OUT at (340, 244)
	ci.draw_polyline(PackedVector2Array([P.call(256, 196), P.call(256, 292), P.call(340, 244), P.call(256, 196)]), ink, w)
	S.text(ci, f, "\u2212", P.call(262, 228), fs, ink); S.text(ci, f, "+", P.call(262, 276), fs, ink)
	_wire(ci, [P.call(nx, ny), P.call(256, ny)], ink, w)
	_wire(ci, [P.call(256, 268), P.call(236, 268), P.call(236, 300)], ink, w); _gnd(ci, P.call(236, 300), k, ink, w)
	_wire(ci, [P.call(340, 244), P.call(400, 244)], ink, w)
	ci.draw_circle(P.call(400, 244), 6.0 * k + 1.0, ink); S.text(ci, f, "M pad", P.call(370, 276), int(fs * 0.9), ink)
	# Rf over the top, from the node to OUT
	_wire(ci, [P.call(nx, ny), P.call(nx, 140), P.call(268, 140)], ink, w); _zig(ci, P.call(268, 140), P.call(340, 140), 9.0 * k, ink, w)
	_wire(ci, [P.call(340, 140), P.call(380, 140), P.call(380, 244)], ink, w)
	S.text(ci, f, "%s  %s" % [str(rf.get("name", "Rf")), kohm.call(float(rf.get("ohm", 10000)))], P.call(270, 122), int(fs * 0.9), ink)
	# the three inputs, one row each, all meeting at the node
	for i in mini(3, srcs.size()):
		var s: Dictionary = srcs[i]; var rr: Dictionary = s.get("r", {})
		var y := 160.0 + float(i) * 60.0
		S.text(ci, f, "%s = %s V" % [str(s.get("name", "V")), EngineBench._g(float(s.get("volts", 0)))], P.call(20, y + 7), int(fs * 0.9), ink)
		ci.draw_circle(P.call(110, y), 4.0 * k + 1.0, ink)
		_wire(ci, [P.call(110, y), P.call(130, y)], ink, w); _zig(ci, P.call(130, y), P.call(200, y), 9.0 * k, ink, w)
		_wire(ci, [P.call(200, y), P.call(nx, y), P.call(nx, ny)], ink, w)
		S.text(ci, f, "%s  %s" % [str(rr.get("name", "R")), kohm.call(float(rr.get("ohm", 0)))], P.call(128, y - 14), int(fs * 0.8), ink)
	ci.draw_circle(P.call(nx, ny), 5.0 * k + 1.0, ink)
	var sm: Dictionary = fig.get("sum", {})
	S.text(ci, f, "rails \u00b1%s V" % EngineBench._g(float(sm.get("rails", 15))), P.call(270, 360), int(fs * 0.9), ink)
	if not asks.is_empty() and not small: S.text(ci, f, "find:  " + "   ".join(asks), P.call(20, 40), fs, S.INK_RED)

## A capacitor symbol (two plates) centred at `c`: horizontal flow (plates vertical) or vertical flow (plates horizontal); `c` is the first plate's centre, the second plate sits 14 design px further along the flow.
static func _cap_h(ci: CanvasItem, c: Vector2, k: float, ink: Color, w: float) -> void:
	ci.draw_line(c + Vector2(0, -16.0 * k), c + Vector2(0, 16.0 * k), ink, w * 1.6); ci.draw_line(c + Vector2(14.0 * k, -16.0 * k), c + Vector2(14.0 * k, 16.0 * k), ink, w * 1.6)
static func _cap_v(ci: CanvasItem, c: Vector2, k: float, ink: Color, w: float) -> void:
	ci.draw_line(c + Vector2(-16.0 * k, 0), c + Vector2(16.0 * k, 0), ink, w * 1.6); ci.draw_line(c + Vector2(-16.0 * k, 14.0 * k), c + Vector2(16.0 * k, 14.0 * k), ink, w * 1.6)
static func _gnd(ci: CanvasItem, c: Vector2, k: float, ink: Color, w: float) -> void:
	ci.draw_line(c, c + Vector2(0, 8.0 * k), ink, w)
	for g in 3:
		var hw := (18.0 - float(g) * 6.0) * k
		ci.draw_line(c + Vector2(-hw, (8.0 + float(g) * 7.0) * k), c + Vector2(hw, (8.0 + float(g) * 7.0) * k), ink, w)
