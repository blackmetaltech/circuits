class_name StallStyle
extends RefCounted
## Palette (DESIGN §5.4) and small code-drawing helpers shared by every stall object. Fonts: Kalam (Wren's hand, OFL) for the notebook, chits and
## speech; Share Tech Mono (OFL) for the instrument LCD / VFD readouts. Both ship in godot/fonts with their OFL texts.

const WALNUT := Color("#3B2A20")
const MASK := Color("#14161A")
const GOLD := Color("#D4A74A")
const PHOS := Color("#7CFF6B")
const AMBER := Color("#FFB547")
const CYAN := Color("#38D6FF")
const SLATE := Color("#5B6573")
const MAGENTA := Color("#FF4FA3")
const SMOKE := Color("#8C96A3")
const PAPER := Color("#F3EAD3")
const INK := Color("#2B3A67")
const INK_RED := Color("#a3342b")
const BRASS := Color("#b8893a")

static var _hand: Font
static var _mono: Font
static var _ui: Font

static func hand() -> Font:
	if _hand == null: _hand = load("res://fonts/Kalam-Regular.ttf") as Font
	if _hand == null: _hand = ThemeDB.fallback_font
	return _hand

static func mono() -> Font:
	if _mono == null: _mono = load("res://fonts/ShareTechMono-Regular.ttf") as Font
	if _mono == null: _mono = ThemeDB.fallback_font
	return _mono

static func ui() -> Font:
	if _ui == null:
		var sf := SystemFont.new(); sf.font_names = PackedStringArray(["Inter", "Noto Sans", "DejaVu Sans"]); _ui = sf
	return _ui

## Draw text; `w` > 0 wraps (returns the number of lines drawn when wrapping).
## Handheld (1280x800 and smaller): the scene sets `min_font` so no text is drawn under ~16 screen px; `handheld` also widens touch targets.
static var min_font := 0
static var handheld := false

static func text(ci: CanvasItem, f: Font, s: String, pos: Vector2, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, w := -1.0) -> void:
	if not ci.has_meta(&"small_text"): size = maxi(size, min_font)
	if w > 0.0: ci.draw_multiline_string(f, pos, s, align, w, size, -1, col)
	else: ci.draw_string(f, pos, s, align, -1.0, size, col)

## A line of hand-written text with keyboard keys in it: anything in [square brackets] is a key cap drawn in the mono font ("Ctrl+Z" in Kalam reads as "Ctrl+2").
## Returns the x where the line ends. `col` is the text colour; the caps use the same colour for the legend and a faint plate behind it.
static func keyline(ci: CanvasItem, s: String, pos: Vector2, size: int, col: Color) -> float:
	var x := pos.x; var f := hand(); var m := mono()
	var ksize := maxi(size - 3, min_font)
	var parts := s.split("[")
	for i in parts.size():
		var seg: String = parts[i]
		if i > 0 and seg.contains("]"):
			var cut := seg.find("]")
			var key := seg.substr(0, cut); seg = seg.substr(cut + 1)
			var kw := m.get_string_size(key, HORIZONTAL_ALIGNMENT_LEFT, -1.0, ksize).x + 12.0
			var plate := Rect2(x + 1.0, pos.y - float(ksize) - 3.0, kw, float(ksize) + 9.0)
			rr(ci, plate, 4, Color(col.r, col.g, col.b, col.a * 0.35)); rr_line(ci, plate, 4, Color(col.r, col.g, col.b, minf(1.0, col.a * 1.4)), 1.2)
			text(ci, m, key, Vector2(x + 7.0, pos.y), ksize, Color(col.r, col.g, col.b, minf(1.0, col.a * 1.9)))
			x += kw + 4.0
		if seg != "":
			text(ci, f, seg, Vector2(x, pos.y), size, col); x += tw(f, seg, size)
	return x

static func tw(f: Font, s: String, size: int) -> float: return f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1.0, maxi(size, min_font)).x

static func wrapped_h(f: Font, s: String, size: int, w: float) -> float:
	return f.get_multiline_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, w, maxi(size, min_font)).y

static func glow(ci: CanvasItem, c: Vector2, r: float, col: Color) -> void:
	ci.draw_texture_rect(BenchView.glow(), Rect2(c - Vector2(r, r), Vector2(r, r) * 2.0), false, col)

static func rr(ci: CanvasItem, r: Rect2, rad: float, col: Color) -> void: PartArt.rrect(ci, r, rad, col)

static func rr_line(ci: CanvasItem, r: Rect2, rad: float, col: Color, w := 2.0) -> void:
	rad = minf(rad, minf(r.size.x, r.size.y) * 0.5)
	var pts := PackedVector2Array()
	var cs := [[r.position + Vector2(rad, rad), PI], [r.position + Vector2(r.size.x - rad, rad), PI * 1.5],
		[r.position + r.size - Vector2(rad, rad), 0.0], [r.position + Vector2(rad, r.size.y - rad), PI * 0.5]]
	for c in cs:
		for i in 6: var a: float = c[1] + float(i) / 5.0 * PI * 0.5; pts.append(c[0] + Vector2(cos(a), sin(a)) * rad)
	pts.append(pts[0])
	ci.draw_polyline(pts, col, w, true)

## Soft drop shadow under a rounded rect (3 stacked, increasingly wide, faint layers).
static func shadow(ci: CanvasItem, r: Rect2, rad: float, off := Vector2(6, 9), a := 0.32) -> void:
	for i in 4:
		var g := float(i) * 3.5
		rr(ci, Rect2(r.position + off - Vector2(g, g), r.size + Vector2(g, g) * 2.0), rad + g, Color(0, 0, 0, a * 0.3))

static func vgrad(ci: CanvasItem, r: Rect2, top: Color, bot: Color, steps := 24) -> void:
	for i in steps:
		var k0 := float(i) / steps; var h := r.size.y / steps
		ci.draw_rect(Rect2(r.position.x, r.position.y + r.size.y * k0, r.size.x, h + 1.0), top.lerp(bot, k0), true)

static func cable(ci: CanvasItem, a: Vector2, b: Vector2, sag: float, col: Color, w: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 21:
		var k := float(i) / 20.0
		pts.append(a.lerp(b, k) + Vector2(0, sin(k * PI) * sag))
	ci.draw_polyline(pts.duplicate(), Color(0, 0, 0, 0.35), w + 2.0, true)
	ci.draw_polyline(pts, col.darkened(0.35), w + 1.0, true)
	ci.draw_polyline(pts, col, w, true)
	return pts

## A hand-drawn arrow: a wobbly curve from `a` to `b` with an open arrowhead. `k` 0..1 draws it on progressively (the pen moving).
static func hand_arrow(ci: CanvasItem, a: Vector2, b: Vector2, col: Color, w := 4.0, k := 1.0, bend := 0.22) -> void:
	var d := b - a; var n := d.orthogonal().normalized()
	var pts := PackedVector2Array(); var steps := 28
	var mid := a + d * 0.5 + n * d.length() * bend
	for i in int(steps * k) + 1:
		var u := float(i) / steps
		var q := a.lerp(mid, u).lerp(mid.lerp(b, u), u)
		pts.append(q + n * sin(u * 17.0) * 1.6)
	if pts.size() < 2: return
	ci.draw_polyline(pts, Color(0, 0, 0, 0.22), w + 3.0, true)
	ci.draw_polyline(pts, col, w, true)
	if k >= 0.98:
		var tip := pts[pts.size() - 1]; var tan := (tip - pts[pts.size() - 3]).normalized()
		var wing := 20.0
		ci.draw_polyline(PackedVector2Array([tip - tan.rotated(0.5) * wing, tip, tip - tan.rotated(-0.55) * wing * 0.9]), col, w, true)

static func gear(ci: CanvasItem, c: Vector2, r: float, col: Color, hole: Color) -> void:
	var pts := PackedVector2Array()
	for i in 48:
		var a := float(i) / 48.0 * TAU
		var tooth := fmod(floorf(a / TAU * 16.0), 2.0) < 1.0
		var rad := r if tooth else r * 0.8
		pts.append(c + Vector2(cos(a), sin(a)) * rad)
	ci.draw_colored_polygon(pts, col)
	ci.draw_circle(c, r * 0.5, hole); ci.draw_arc(c, r * 0.5, 0, TAU, 24, col.darkened(0.3), 2.0)

## A paper chit / page: cream, slightly rotated about `r`'s centre, soft shadow, faint fibres and a curled bottom-right.
static func paper(ci: CanvasItem, r: Rect2, rot_deg := 0.0, tint := PAPER, lines := false, base := Transform2D.IDENTITY) -> void:
	var c := r.get_center()
	ci.draw_set_transform_matrix(base * Transform2D(deg_to_rad(rot_deg), c))
	var q := Rect2(-r.size * 0.5, r.size)
	shadow(ci, q, 3.0, Vector2(4, 6), 0.4)
	ci.draw_rect(q, tint, true)
	ci.draw_rect(Rect2(q.position, Vector2(q.size.x, 3)), tint.lightened(0.25), true)
	ci.draw_rect(Rect2(q.position + Vector2(0, q.size.y - 3), Vector2(q.size.x, 3)), tint.darkened(0.12), true)
	var rng := RandomNumberGenerator.new(); rng.seed = int(r.position.x * 7.0 + r.position.y * 13.0)
	for i in int(q.size.x * q.size.y / 2200.0): ci.draw_circle(q.position + Vector2(rng.randf() * q.size.x, rng.randf() * q.size.y), rng.randf_range(0.6, 1.4), Color(0.5, 0.4, 0.25, 0.08))
	if lines:
		var y := q.position.y + 54.0
		while y < q.end.y - 14.0: ci.draw_line(Vector2(q.position.x + 10, y), Vector2(q.end.x - 10, y), Color(0.3, 0.4, 0.7, 0.18), 1.5); y += 34.0
	ci.draw_colored_polygon(PackedVector2Array([q.end, q.end + Vector2(-18, 0), q.end + Vector2(0, -18)]), tint.darkened(0.2))
	ci.draw_set_transform_matrix(base)

static func pin(ci: CanvasItem, c: Vector2, col := Color("#d23a2e")) -> void:
	ci.draw_circle(c + Vector2(3, 4), 7.0, Color(0, 0, 0, 0.35))
	ci.draw_circle(c, 7.0, col.darkened(0.3)); ci.draw_circle(c + Vector2(-1, -1), 5.5, col); ci.draw_circle(c + Vector2(-2.5, -2.5), 1.8, Color(1, 1, 1, 0.8))

static func screw(ci: CanvasItem, c: Vector2, r: float, ang := 0.6) -> void:
	ci.draw_circle(c, r, Color("#2a2d33")); ci.draw_circle(c, r * 0.8, Color("#8b8f98"))
	var d := Vector2(cos(ang), sin(ang)) * r * 0.7
	ci.draw_line(c - d, c + d, Color("#33363c"), maxf(1.0, r * 0.22))

static func knob(ci: CanvasItem, c: Vector2, r: float, ang: float, body := Color("#2b2d32"), mark := Color("#f1e7c9")) -> void:
	ci.draw_circle(c + Vector2(r * 0.12, r * 0.2), r * 1.05, Color(0, 0, 0, 0.4))
	ci.draw_circle(c, r, body.darkened(0.35))
	for i in 24:   # knurled rim
		var a := float(i) / 24.0 * TAU
		ci.draw_line(c + Vector2(cos(a), sin(a)) * r * 0.9, c + Vector2(cos(a), sin(a)) * r, body.lightened(0.18), maxf(1.0, r * 0.07))
	ci.draw_circle(c, r * 0.86, body); ci.draw_circle(c + Vector2(-r * 0.1, -r * 0.14), r * 0.6, body.lightened(0.07))
	ci.draw_line(c + Vector2(cos(ang), sin(ang)) * r * 0.25, c + Vector2(cos(ang), sin(ang)) * r * 0.82, mark, maxf(2.0, r * 0.13))

static func wood_grain(ci: CanvasItem, r: Rect2, base: Color, seed_v: int, plank := 140.0, grain := Color(0.12, 0.07, 0.04, 0.32)) -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = seed_v
	var n := int(ceil(r.size.y / plank))
	for i in n:
		var y := r.position.y + float(i) * plank; var h := minf(plank, r.end.y - y)
		var col := base.lerp(Color("#4d382b"), rng.randf() * 0.5).lerp(Color("#2c1f17"), rng.randf() * 0.15)
		ci.draw_rect(Rect2(r.position.x, y, r.size.x, h), col, true)
		for k in 14:
			var gy := y + rng.randf_range(6.0, h - 8.0); var gx := r.position.x + rng.randf_range(-100.0, r.size.x * 0.8)
			var l := rng.randf_range(200.0, 700.0); var pts := PackedVector2Array()
			for j in 6: pts.append(Vector2(gx + l * float(j) / 5.0, gy + sin(float(j) * 0.9 + float(k)) * rng.randf_range(1.0, 3.5)))
			ci.draw_polyline(pts, grain, rng.randf_range(1.0, 2.2), true)
		for k in 3:   # knots
			if rng.randf() < 0.35:
				var kc := Vector2(r.position.x + rng.randf() * r.size.x, y + rng.randf_range(25.0, h - 25.0))
				for j in 4: ci.draw_arc(kc, 5.0 + float(j) * 4.0, 0, TAU, 20, grain, 1.6)
		ci.draw_rect(Rect2(r.position.x, y, r.size.x, 2.5), Color(0.03, 0.02, 0.015, 0.85), true)
		ci.draw_rect(Rect2(r.position.x, y + 2.5, r.size.x, 1.5), Color(1, 0.85, 0.6, 0.07), true)

static func fmt_money(c: int) -> String: return "%d" % c
