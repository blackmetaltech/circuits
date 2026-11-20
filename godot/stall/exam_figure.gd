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
