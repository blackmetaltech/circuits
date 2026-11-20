class_name PartArt2
extends RefCounted
## Chapter 2 "Divide & Measure" parts, drawn in code like every other part (PartArt): the ADC chip, the cable reel, the dry cell, the moving-coil galvanometer, the metre
## slide wire with its jockey, the sealed module, a resistance-box plug, the rheostat and the trimmer. Same contract as PartArt: local frame, origin = pin 1's pad,
## pitch `p` px per pad; `sh` = draw the drop shadow silhouette only. Nothing here computes a number: the needle, the jockey position and its reading come from the engine.

const SILVER := Color(0.78, 0.8, 0.84)
const SHADOW := Color(0, 0, 0, 0.38)

static func _c(c: Color, sh: bool) -> Color: return SHADOW if sh else c

static func _txt(ci: CanvasItem, s: String, at: Vector2, size_px: int, col: Color) -> void:
	ci.draw_string(ThemeDB.fallback_font, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size_px, col)

static func _terminal(ci: CanvasItem, c: Vector2, p: float) -> void:
	ci.draw_circle(c, p * 0.42, Color(0.55, 0.57, 0.6)); ci.draw_circle(c, p * 0.3, SILVER); ci.draw_circle(c, p * 0.12, Color(0.3, 0.3, 0.33))

## 2-1: the weather station's ADC as a small black chip with pins along its long sides and a notch, legs to the two pads (the board turns it vertical).
static func adc_chip(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	var al: Vector2 = (b - a).normalized()
	PartArt._leads(ci, [lp[0], lp[1]], p, [lp[0] + al * 1.2, lp[1] - al * 1.2])
	var side := al.orthogonal()
	var h := (b - a).length() * 0.5 - p * 1.2; var w := p * 1.5
	ci.draw_colored_polygon(PackedVector2Array([mid - al * h - side * w, mid + al * h - side * w, mid + al * h + side * w, mid - al * h + side * w]), _c(Color(0.1, 0.1, 0.12), sh))
	if sh: return
	for k in 4:
		var u := (float(k) - 1.5) / 1.5 * h * 0.6
		for sg in [-1.0, 1.0]: ci.draw_line(mid + al * u + side * w * sg, mid + al * u + side * (w + p * 0.42) * sg, SILVER, p * 0.16)
	ci.draw_circle(mid - al * (h - p * 0.5) - side * (w - p * 0.5), p * 0.16, Color(0.4, 0.42, 0.46))
	ci.draw_line(mid - al * h * 0.98 + side * (w * 0.4), mid - al * h * 0.98 - side * (w * 0.4), Color(0.3, 0.3, 0.34), p * 0.12)
	ci.draw_line(mid - al * (h - p * 0.2) + side * w * 0.9, mid + al * (h - p * 0.2) + side * w * 0.9, Color(1, 1, 1, 0.1), p * 0.07)
	_txt(ci, "ADC", mid - side * w * 0.55 - al * p * 0.5, int(clampf(p * 0.42, 9.0, 20.0)), Color(0.75, 0.78, 0.85, 0.9))

## 2-2: the cable under the lane as a reel: coils of black cable on an orange drum, the two ends coming out to the legs.
static func cable_reel(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	var rad := (b - a).length() * 0.36
	var inward: Vector2 = ((b - a) * 0.5).normalized()
	PartArt._leads(ci, [lp[0], lp[1]], p, [lp[0] + inward * 1.1, lp[1] - inward * 1.1])
	ci.draw_circle(mid, rad, _c(Color(0.95, 0.5, 0.12), sh))
	if sh: return
	ci.draw_circle(mid, rad * 0.97, Color(0.12, 0.12, 0.13))
	for k in 5:
		ci.draw_arc(mid, rad * (0.9 - 0.14 * k), 0.0, TAU, 28, Color(0.26, 0.26, 0.29), p * 0.1)
		ci.draw_arc(mid, rad * (0.84 - 0.14 * k), 0.0, TAU, 28, Color(0.05, 0.05, 0.06), p * 0.06)
	ci.draw_circle(mid, rad * 0.22, Color(0.95, 0.5, 0.12)); ci.draw_circle(mid, rad * 0.08, Color(0.2, 0.1, 0.03))
	ci.draw_arc(mid, rad, PI * 1.1, PI * 1.5, 12, Color(1, 0.8, 0.5, 0.55), p * 0.1)

## 2-4: the cell under test, a dry cell with its + cap on the pin-1 side.
static func dry_cell(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p
	var r := Rect2(a.x + p * 0.6, -p * 1.1, (b.x - a.x) - p * 1.2, p * 2.2)
	PartArt.rrect(ci, Rect2(a.x - p * 0.2, -p * 0.4, p * 0.9, p * 0.8), p * 0.12, _c(SILVER.darkened(0.1), sh))
	PartArt.rrect(ci, r, p * 0.4, _c(Color("#2f6f7f"), sh))
	if sh: return
	PartArt.rrect(ci, Rect2(r.position.x, r.position.y + r.size.y * 0.35, r.size.x, r.size.y * 0.3), 0.0, Color("#f0e9c8"))
	_txt(ci, "TEST CELL", Vector2(r.position.x + p * 0.5, r.position.y + r.size.y * 0.62), int(clampf(p * 0.5, 9.0, 22.0)), Color(0.15, 0.1, 0.05))
	ci.draw_line(r.position + Vector2(p * 0.4, p * 0.3), Vector2(r.end.x - p * 0.4, r.position.y + p * 0.3), Color(1, 1, 1, 0.22), p * 0.08)
	_terminal(ci, a, p); _terminal(ci, b, p)
	ci.draw_line(a + Vector2(-p * 0.1, p * 0.75), a + Vector2(p * 0.1, p * 0.75), Color(0.95, 0.3, 0.25), p * 0.07)
	ci.draw_line(a + Vector2(0, p * 0.65), a + Vector2(0, p * 0.85), Color(0.95, 0.3, 0.25), p * 0.07)
	ci.draw_line(b + Vector2(-p * 0.12, p * 0.75), b + Vector2(p * 0.12, p * 0.75), Color(0.6, 0.7, 0.85), p * 0.07)

## 2-2 / 2-4: the moving-coil galvanometer. A round dial in a case between its two terminals, a zero at the top centre and a needle that swings with the engine's `needle`
## (-1.15 .. 1.15 of the 50 microamp full scale).
static func galvo(ci: CanvasItem, lp: Array, p: float, sh: bool, needle: float) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	PartArt._leads(ci, lp, p, [lp[0] + Vector2(0.8, 0), lp[1] - Vector2(0.8, 0)])
	var cs := Rect2(a.x + p * 0.7, -p * 1.7, (b.x - a.x) - p * 1.4, p * 3.3)
	PartArt.rrect(ci, cs, p * 0.3, _c(Color("#2d4036"), sh))
	if sh: return
	PartArt.rrect(ci, cs.grow(-p * 0.1), p * 0.24, Color("#3b5547"))
	var c := Vector2(mid.x, cs.position.y + p * 1.35); var rd := minf(cs.size.x * 0.44, p * 1.25)
	ci.draw_circle(c, rd + p * 0.14, Color("#c5a24f")); ci.draw_circle(c, rd, Color("#f3ecd2"))
	var fs := int(clampf(p * 0.3, 8.0, 15.0))
	for k in range(-5, 6):
		var ang := -PI * 0.5 + float(k) / 5.0 * deg_to_rad(52.0)
		var d := Vector2(cos(ang), sin(ang))
		ci.draw_line(c + d * rd * (0.78 if k % 5 != 0 else 0.68), c + d * rd * 0.92, Color(0.2, 0.14, 0.08), p * (0.05 if k % 5 != 0 else 0.09))
	_txt(ci, "0", c + Vector2(-p * 0.1, -rd * 0.42), fs, Color(0.2, 0.14, 0.08))
	_txt(ci, "µ50 µA", c + Vector2(-rd * 0.48, rd * 0.5), fs, Color(0.2, 0.14, 0.08, 0.85))
	var pv := c + Vector2(0, rd * 0.62)
	var na := -PI * 0.5 + clampf(needle, -1.15, 1.15) * deg_to_rad(52.0)
	var tip := pv + Vector2(cos(na), sin(na)) * rd * 1.28
	ci.draw_line(pv + Vector2(1.5, 2.0), tip + Vector2(1.5, 2.0), Color(0, 0, 0, 0.25), p * 0.08)
	ci.draw_line(pv, tip, Color(0.7, 0.1, 0.08), p * 0.07)
	ci.draw_circle(pv, p * 0.13, Color(0.15, 0.15, 0.17))
	ci.draw_arc(c, rd, PI * 1.1, PI * 1.5, 10, Color(1, 1, 1, 0.35), p * 0.07)
	for i in 2:
		var tc := Vector2(cs.position.x + p * (0.5 if i == 0 else cs.size.x / p - 0.5), cs.end.y - p * 0.38)
		ci.draw_circle(tc, p * 0.3, Color(0.1, 0.1, 0.12)); ci.draw_circle(tc, p * 0.22, Color("#b2261c") if i == 0 else Color("#1a1a1c")); ci.draw_circle(tc, p * 0.1, Color("#d0b25a"))

## The metre slide wire (fixed on the bench): wooden board, a metre rule under a resistance wire, brass binding posts at A and B, the sliding jockey (a brass block with a knife
## edge, led by a flexible wire to the J post). `part.pos` (0..1 from end A) places the jockey; `part.pos_text` is the engine's reading ("40.00 cm").
static func slide(ci: CanvasItem, part: Dictionary, lp: Array, p: float, sh: bool) -> void:
	var A: Vector2 = lp[0] * p; var J: Vector2 = lp[1] * p; var B: Vector2 = lp[2] * p
	var board := Rect2(A.x - p * 1.0, -p * 1.0, (B.x - A.x) + p * 2.0, p * 3.1)
	PartArt.rrect(ci, board, p * 0.3, _c(Color("#b9874a"), sh))
	if sh: return
	PartArt.rrect(ci, board.grow(-p * 0.1), p * 0.24, Color("#d3a56a"))
	for k in 7: ci.draw_line(board.position + Vector2(p * 0.3, p * (0.3 + 0.4 * k)), Vector2(board.end.x - p * 0.3, board.position.y + p * (0.3 + 0.4 * k) + sin(float(k)) * 2.0), Color(0.45, 0.28, 0.1, 0.16), p * 0.04)
	var rule := Rect2(A.x, p * 0.55, B.x - A.x, p * 1.35)
	PartArt.rrect(ci, rule, p * 0.08, Color("#f4efd8"))
	var fs := int(clampf(p * 0.34, 9.0, 16.0))
	for k in 101:
		if k % 2 == 1 and k % 5 != 0: continue
		var x := A.x + (B.x - A.x) * float(k) / 100.0
		var tl := p * (0.5 if k % 10 == 0 else (0.34 if k % 5 == 0 else 0.18))
		ci.draw_line(Vector2(x, rule.position.y), Vector2(x, rule.position.y + tl), Color(0.15, 0.1, 0.05), p * (0.05 if k % 10 != 0 else 0.08))
	for k in 11: _txt(ci, str(k * 10), Vector2(A.x + (B.x - A.x) * float(k) / 10.0 - fs * (0.3 if k < 10 else 0.6), rule.position.y + p * 0.98), fs, Color(0.15, 0.1, 0.05))
	_txt(ci, "cm", Vector2(A.x + (B.x - A.x) * 0.5 - fs * 0.6, rule.end.y - p * 0.14), fs, Color(0.15, 0.1, 0.05, 0.8))
	ci.draw_line(A + Vector2(0, p * 0.04), B + Vector2(0, p * 0.04), Color(0, 0, 0, 0.3), p * 0.14)
	ci.draw_line(A, B, Color("#9d8b6b"), p * 0.12)
	ci.draw_line(A + Vector2(0, -p * 0.03), B + Vector2(0, -p * 0.03), Color(1, 0.95, 0.8, 0.5), p * 0.04)
	for pt in [A, B, J]:
		ci.draw_circle(pt + Vector2(p * 0.05, p * 0.08), p * 0.4, Color(0, 0, 0, 0.35)); ci.draw_circle(pt, p * 0.38, Color(0.55, 0.4, 0.14)); ci.draw_circle(pt, p * 0.3, Color("#d4a74a")); ci.draw_circle(pt, p * 0.12, Color(0.3, 0.22, 0.08))
	var t := clampf(float(part.get("pos", 0.5)) if part.get("pos", null) != null else 0.5, 0.0, 1.0)
	var jx := A.x + (B.x - A.x) * t
	var top := Vector2(jx, -p * 0.62)
	var mid := Vector2((jx + J.x) * 0.5, minf(top.y, J.y) - p * 0.7)
	var lead := PackedVector2Array()
	for k in 13:
		var u := float(k) / 12.0
		lead.append(top.lerp(mid, u).lerp(mid.lerp(J, u), u))
	ci.draw_polyline(lead, Color(0.5, 0.15, 0.1), p * 0.09, true)
	var body := Rect2(jx - p * 0.3, -p * 0.62, p * 0.6, p * 0.5)
	PartArt.rrect(ci, Rect2(body.position + Vector2(p * 0.06, p * 0.1), body.size), p * 0.1, Color(0, 0, 0, 0.35))
	PartArt.rrect(ci, body, p * 0.1, Color("#c9a24a"))
	ci.draw_colored_polygon(PackedVector2Array([Vector2(jx - p * 0.22, -p * 0.14), Vector2(jx + p * 0.22, -p * 0.14), Vector2(jx, p * 0.02)]), Color("#e9e1c0"))
	ci.draw_line(Vector2(jx, -p * 0.14), Vector2(jx, p * 0.55), Color("#c0392b", 0.8), p * 0.04)
	ci.draw_line(Vector2(body.position.x + p * 0.08, body.position.y + p * 0.08), Vector2(body.end.x - p * 0.08, body.position.y + p * 0.08), Color(1, 1, 1, 0.4), p * 0.05)
	# the jockey keys under the rule: [-] [step] [+] (the scene hit-tests the same numbers: StallScene.NUDGE_X / NUDGE_Y)
	var keys := [["-", 6.0, 8.6], ["", 8.8, 11.4], ["+", 11.6, 14.2]]
	PartArt.rrect(ci, Rect2(p * 5.8, p * 2.15, p * 8.6, p * 1.65), p * 0.25, Color(0.1, 0.09, 0.08, 0.55))
	for k in keys:
		var kr := Rect2(p * float(k[1]), p * 2.3, p * (float(k[2]) - float(k[1])), p * 1.3)
		PartArt.rrect(ci, kr, p * 0.2, Color("#1b1d21")); PartArt.rrect(ci, kr.grow(-p * 0.07), p * 0.16, Color("#383c44"))
		var lab := str(k[0]) if str(k[0]) != "" else str(part.get("step_text", "step"))
		var f2 := int(clampf(p * (0.9 if str(k[0]) != "" else 0.38), 10.0, 40.0))
		var tw2 := ThemeDB.fallback_font.get_string_size(lab, HORIZONTAL_ALIGNMENT_LEFT, -1.0, f2).x
		_txt(ci, lab, kr.get_center() + Vector2(-tw2 * 0.5, f2 * 0.33), f2, Color("#ffd98a"))
	var txt := str(part.get("pos_text", ""))
	if txt != "":
		var tw := ThemeDB.fallback_font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs + 3).x
		var chip := Rect2(Vector2(clampf(jx - tw * 0.5 - 5.0, A.x, B.x - tw - 10.0), p * 1.95), Vector2(tw + 10.0, fs + 9.0))
		PartArt.rrect(ci, chip, 6.0, Color(0.05, 0.06, 0.08, 0.88))
		_txt(ci, txt, chip.position + Vector2(5.0, fs + 3.0), fs + 3, Color("#ffd98a"))

## 2-3: the sealed module, a black potted block with a paper seal and a question mark; its two terminals are the legs.
static func sealed(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p
	var x0 := minf(a.x, b.x); var x1 := maxf(a.x, b.x)
	var r := Rect2(x0 + p * 0.8, -p * 1.5, (x1 - x0) - p * 1.6, p * 3.0)
	var al: Vector2 = (lp[1] - lp[0]).normalized()
	PartArt._leads(ci, lp, p, [lp[0] + al * 0.9, lp[1] - al * 0.9])
	PartArt.rrect(ci, r, p * 0.18, _c(Color("#101114"), sh))
	if sh: return
	PartArt.rrect(ci, r.grow(-p * 0.1), p * 0.14, Color("#1b1d22"))
	for k in 6: ci.draw_line(r.position + Vector2(p * 0.25, p * (0.4 + 0.45 * k)), Vector2(r.end.x - p * 0.25, r.position.y + p * (0.4 + 0.45 * k)), Color(1, 1, 1, 0.035), p * 0.05)
	var seal := Rect2(r.get_center() - Vector2(p * 0.95, p * 0.5), Vector2(p * 1.9, p * 1.0))
	PartArt.rrect(ci, seal, p * 0.06, Color("#efe5c8"))
	_txt(ci, "SEALED", seal.position + Vector2(p * 0.18, p * 0.4), int(clampf(p * 0.4, 9.0, 18.0)), Color(0.55, 0.1, 0.08))
	_txt(ci, "?", seal.position + Vector2(p * 0.82, p * 0.88), int(clampf(p * 0.56, 11.0, 24.0)), Color(0.1, 0.1, 0.12))
	ci.draw_line(r.position + Vector2(p * 0.2, p * 0.2), Vector2(r.end.x - p * 0.2, r.position.y + p * 0.2), Color(1, 1, 1, 0.1), p * 0.07)
	_terminal(ci, a, p); _terminal(ci, b, p)

## 2-2: a plug from a resistance box: an ebonite strip with two brass blocks and the plug pulled out; the value is on the label.
static func res_box(ci: CanvasItem, p: float, sh: bool) -> void:
	PartArt._leads(ci, [Vector2(0, 0), Vector2(4, 0)], p, [Vector2(0.7, 0), Vector2(3.3, 0)])
	var r := Rect2(0.7 * p, -0.78 * p, 2.6 * p, 1.56 * p)
	PartArt.rrect(ci, r, p * 0.12, _c(Color("#1c1a19"), sh))
	if sh: return
	PartArt.rrect(ci, r.grow(-p * 0.06), p * 0.1, Color("#2a2725"))
	for k in 2: PartArt.rrect(ci, Rect2(r.position.x + p * (0.18 + k * 1.5), r.position.y + p * 0.18, p * 0.9, p * 0.62), p * 0.06, Color("#c9a24a"))
	ci.draw_circle(Vector2(r.position.x + p * 1.3, r.position.y + p * 0.49), p * 0.2, Color("#8f6d22"))
	ci.draw_circle(Vector2(r.position.x + p * 1.3, r.position.y + p * 0.49), p * 0.12, Color("#2a1f08"))
	_txt(ci, "BOX", Vector2(r.position.x + p * 0.2, r.end.y - p * 0.18), int(clampf(p * 0.36, 8.0, 15.0)), Color(0.85, 0.8, 0.65, 0.8))
	ci.draw_line(r.position + Vector2(p * 0.2, p * 0.1), Vector2(r.end.x - p * 0.2, r.position.y + p * 0.1), Color(1, 1, 1, 0.12), p * 0.05)

## 2-4: the rheostat: a ceramic tube wound with resistance wire and a brass slider on a bar above it.
static func rheostat(ci: CanvasItem, p: float, sh: bool) -> void:
	PartArt._leads(ci, [Vector2(0, 0), Vector2(4, 0)], p, [Vector2(0.55, 0), Vector2(3.45, 0)])
	var r := Rect2(0.55 * p, -0.55 * p, 2.9 * p, 1.1 * p)
	PartArt.rrect(ci, r, p * 0.3, _c(Color("#d8cbb0"), sh))
	if sh: return
	for k in 15: ci.draw_line(Vector2(r.position.x + p * (0.35 + k * 0.155), r.position.y + p * 0.08), Vector2(r.position.x + p * (0.35 + k * 0.155) + p * 0.05, r.end.y - p * 0.08), Color(0.45, 0.2, 0.1), p * 0.07)
	ci.draw_line(Vector2(r.position.x, -p * 0.95), Vector2(r.end.x, -p * 0.95), Color("#9aa0a8"), p * 0.1)
	PartArt.rrect(ci, Rect2(r.position.x + p * 1.4, -p * 1.12, p * 0.5, p * 0.7), p * 0.08, Color("#c9a24a"))
	ci.draw_line(Vector2(r.position.x + p * 1.65, -p * 0.45), Vector2(r.position.x + p * 1.65, -p * 0.12), Color("#c9a24a"), p * 0.07)
	ci.draw_line(r.position + Vector2(p * 0.3, p * 0.15), Vector2(r.end.x - p * 0.3, r.position.y + p * 0.15), Color(1, 1, 1, 0.3), p * 0.05)

## 2-3: a blue cermet trimmer with a brass screw; the slot turns with the setting (value / 1 k).
static func trimmer(ci: CanvasItem, part: Dictionary, p: float, sh: bool) -> void:
	PartArt._leads(ci, [Vector2(0, 0), Vector2(4, 0)], p, [Vector2(1.1, 0), Vector2(2.9, 0)])
	var r := Rect2(1.0 * p, -0.9 * p, 2.0 * p, 1.8 * p)
	PartArt.rrect(ci, r, p * 0.14, _c(Color("#2b61b8"), sh))
	if sh: return
	PartArt.rrect(ci, r.grow(-p * 0.08), p * 0.1, Color("#3a73cf"))
	var c := r.get_center() + Vector2(p * 0.05, 0)
	ci.draw_circle(c, p * 0.62, Color("#c8ccd2")); ci.draw_circle(c, p * 0.5, Color("#e3c070"))
	var ang := (float(part.value) / 1000.0 if part.get("value", null) != null else 0.5) * PI * 1.6 - 0.4
	ci.draw_line(c - Vector2(cos(ang), sin(ang)) * p * 0.42, c + Vector2(cos(ang), sin(ang)) * p * 0.42, Color(0.18, 0.12, 0.04), p * 0.12)
	ci.draw_line(r.position + Vector2(p * 0.2, p * 0.16), Vector2(r.end.x - p * 0.2, r.position.y + p * 0.16), Color(1, 1, 1, 0.22), p * 0.06)
