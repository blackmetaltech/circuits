class_name PartArt5
extends RefCounted
## Chapter 5 parts, drawn in code: the 12 V fan (a square frame, blades that turn with the winding current), the customer's LED strip (a dark bar of warm dots that light with the current) and the
## TO-220 power transistors (drawn by PartArt4.regulator's body, named on the plastic). Local frame, like the other part art: origin = pad (x, y), pitch `p`.

static func _c(c: Color, sh: bool) -> Color: return PartArt.SHADOW if sh else c

## The fan: a square housing between its two pads (6 pads apart along +x), a hub with four blades that rotate in proportion to the current `cur` (amps; 0.2 A is full speed), a little red + lead mark.
static func fan(ci: CanvasItem, lp: Array, p: float, sh: bool, cur: float, hot: float, smoked: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	PartArt._leads(ci, lp, p, [lp[0] + Vector2(1.0, 0), lp[1] - Vector2(1.0, 0)])
	var half := minf(p * 2.15, (b - a).length() * 0.5 - p * 0.9)
	var frame := Rect2(mid + Vector2(-half, -half), Vector2(half * 2.0, half * 2.0))
	PartArt.rrect(ci, frame, p * 0.3, _c(Color("#23262c") if not smoked else Color("#0a0a0a"), sh))
	if sh: return
	ci.draw_circle(mid, half * 0.88, Color("#14161a"))
	var spin := clampf(absf(cur) / 0.2, 0.0, 1.6)
	var ang := float(Time.get_ticks_msec()) * 0.001 * spin * 14.0
	for k in 4:
		var t := ang + float(k) * PI * 0.5
		ci.draw_colored_polygon(PackedVector2Array([mid, mid + Vector2(cos(t - 0.42), sin(t - 0.42)) * half * 0.84, mid + Vector2(cos(t + 0.42), sin(t + 0.42)) * half * 0.84]), Color("#5fb3d9").lerp(Color("#cfd6dc"), 0.25) if spin > 0.05 else Color("#6f7c86"))
	ci.draw_circle(mid, half * 0.2, Color("#b8bcc4"))
	for sx in [-1.0, 1.0]: for sy in [-1.0, 1.0]: ci.draw_circle(mid + Vector2(sx, sy) * half * 0.82, p * 0.1, Color("#0c0d10"))   # corner screws
	ci.draw_circle(a + Vector2(p * 0.9, -p * 0.45), p * 0.11, Color("#e0453a"))   # the + lead is red
	if hot > 0.2: ci.draw_circle(mid, half, Color(1.0, 0.5, 0.2, 0.12 * hot))

## The customer's strip: a dark bar with a row of warm dots, bright with the current (0.3 A is full).
static func strip(ci: CanvasItem, lp: Array, p: float, sh: bool, cur: float) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	PartArt._leads(ci, lp, p, [lp[0] + Vector2(1.0, 0), lp[1] - Vector2(1.0, 0)])
	var w := (b - a).length() - p * 2.0; var bar := Rect2(mid + Vector2(-w * 0.5, -p * 0.7), Vector2(w, p * 1.4))
	PartArt.rrect(ci, bar, p * 0.25, _c(Color("#1d1f24"), sh))
	if sh: return
	var k := clampf(absf(cur) / 0.3, 0.0, 1.3)
	var n := 8
	if k > 0.05: ci.draw_circle(mid, w * 0.55, Color(1.0, 0.85, 0.5, 0.12 * minf(k, 1.0)))
	for i in n:
		var c := bar.position + Vector2(bar.size.x * (float(i) + 0.5) / float(n), bar.size.y * 0.5)
		ci.draw_circle(c, p * 0.3, Color("#ffd98a").lerp(Color("#fff6d0"), clampf(k - 0.7, 0.0, 1.0)) if k > 0.05 else Color("#5a4f38"))
	PartArt3._txt(ci, "12 V", bar.position + Vector2(p * 0.15, bar.size.y + p * 0.55), int(clampf(p * 0.4, 9.0, 18.0)), Color(0.85, 0.85, 0.9, 0.7))
