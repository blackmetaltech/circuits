class_name PartArt3
extends RefCounted
## Chapter 3 "Charge" parts, drawn in code like every other part (PartArt, PartArt2): the electrolytic capacitor with its polarity stripe, its vent top that bulges as the voltage climbs and pops, the relay with a clicking
## armature, the charged capacitor with a level gauge, the exact (textbook) capacitor, the pull-up and the logic input, plus the two board decorations that sit on a bench-driven contact: the arcade button and the knife switch.
## Same contract as PartArt: local frame, origin = pin 1's pad, pitch `p` px per pad, `sh` = silhouette for the drop shadow. Nothing here computes a number: the bulge, the armature and the contact come from the engine.

const SS = preload("res://stall/stall_style.gd")
const SILVER := Color(0.78, 0.8, 0.84)
const SHADOW := Color(0, 0, 0, 0.38)

static func _c(c: Color, sh: bool) -> Color: return SHADOW if sh else c

static func _txt(ci: CanvasItem, s: String, at: Vector2, size_px: int, col: Color) -> void:
	ci.draw_string(ThemeDB.fallback_font, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size_px, col)

## An electrolytic capacitor: a can seen from above with the minus stripe on pin 2's side. `bulge` 0..1: the vent top domes up (a highlight, a swollen rim, the score lines open); `popped`: the top has torn open
## (four petals, a dark crater, brown electrolyte stains), `vent_t` seconds since the pop (the puff settles).
static func electrolytic(ci: CanvasItem, p: float, sh: bool, bulge: float, popped: bool, vent_t: float) -> void:
	PartArt._leads(ci, [Vector2(0, 0), Vector2(2, 0)], p, [Vector2(0.5, 0), Vector2(1.5, 0)])
	var c := Vector2(p, 0)
	var rad := p * (1.12 + 0.05 * bulge)
	PartArt._disc(ci, c, rad, _c(Color(0.08, 0.17, 0.4), sh))
	if sh: return
	if popped:
		# the sleeve blistered and darkened, electrolyte on the board around it, a crater where the vent was
		PartArt._disc(ci, c + Vector2(p * 0.05, p * 0.2), rad * 1.08, Color(0.2, 0.12, 0.05, 0.55))
		PartArt._disc(ci, c, rad, Color(0.05, 0.08, 0.17))
		PartArt._disc(ci, c, p * 0.9, Color(0.16, 0.15, 0.15))
		PartArt._disc(ci, c, p * 0.74, Color(0.05, 0.04, 0.04))
		for k in 4:   # four petals of torn aluminium folded back
			var a := float(k) * PI * 0.5 + 0.4
			var d := Vector2(cos(a), sin(a))
			var o := d.orthogonal()
			ci.draw_colored_polygon(PackedVector2Array([c + d * p * 0.1 + o * p * 0.05, c + d * p * 0.78 + o * p * 0.34, c + d * p * 0.96 - o * p * 0.04]), Color(0.55, 0.57, 0.6))
			ci.draw_line(c + d * p * 0.12, c + d * p * 0.9, Color(0.3, 0.3, 0.33), p * 0.04)
		ci.draw_arc(c, p * 0.84, 0.0, TAU, 28, Color(0.02, 0.02, 0.02), p * 0.1)
		var puff := clampf(1.0 - vent_t / 1.2, 0.0, 1.0)
		if puff > 0.0: ci.draw_circle(c + Vector2(0, -p * 0.3), p * (0.7 + 0.8 * (1.0 - puff)), Color(0.85, 0.85, 0.9, 0.25 * puff))
		return
	# the sleeve with a gloss strip, and the silver top
	ci.draw_arc(c, rad * 0.93, PI * 1.05, PI * 1.45, 10, Color(1, 1, 1, 0.16), p * 0.1)
	PartArt._disc(ci, c, p * (0.9 + 0.04 * bulge), Color(0.5, 0.52, 0.56))
	PartArt._disc(ci, c, p * (0.8 + 0.04 * bulge), Color(0.62, 0.64, 0.68).lerp(Color(0.72, 0.74, 0.78), bulge))
	if bulge > 0.05:   # the dome: a lit crescent and a ring where the top lifts off the rim
		ci.draw_arc(c + Vector2(-p * 0.06 * bulge, -p * 0.08 * bulge), p * 0.68, PI * 1.0, PI * 1.6, 12, Color(1, 1, 1, 0.35 + 0.4 * bulge), p * (0.1 + 0.08 * bulge))
		ci.draw_arc(c, p * (0.86 + 0.04 * bulge), 0.0, TAU, 28, Color(0.95, 0.9, 0.7, 0.3 * bulge), p * 0.05)
	var sc := Color(0.35, 0.37, 0.4).lerp(Color(0.12, 0.1, 0.1), bulge)
	var w := p * (0.06 + 0.07 * bulge)   # the vent score: a K cut that opens as the pressure builds
	ci.draw_line(c + Vector2(-p * 0.45, 0), c + Vector2(p * 0.45, 0), sc, w)
	ci.draw_line(c + Vector2(0, -p * 0.45), c + Vector2(0, p * 0.45), sc, w)
	# the polarity stripe on the "-" side (pin 2, +x) with its minus signs
	var pts := PackedVector2Array()
	for i in 9: var a := -0.75 + float(i) / 8.0 * 1.5; pts.append(c + Vector2(cos(a), sin(a)) * rad * 0.98)
	for i in 9: var a := 0.75 - float(i) / 8.0 * 1.5; pts.append(c + Vector2(cos(a), sin(a)) * rad * 0.83)
	ci.draw_colored_polygon(pts, Color(0.82, 0.88, 0.95))
	for k in 3:
		var yy := (float(k) - 1.0) * p * 0.3
		ci.draw_line(c + Vector2(rad * 0.88, yy) - Vector2(p * 0.07, 0), c + Vector2(rad * 0.88, yy) + Vector2(p * 0.07, 0), Color(0.1, 0.17, 0.4), p * 0.05)
	ci.draw_line(Vector2(p * 0.12, -p * 0.62), Vector2(p * 0.12, -p * 0.42), Color(0.9, 0.3, 0.25, 0.9), p * 0.045)   # a tiny + beside the + leg
	ci.draw_line(Vector2(p * 0.02, -p * 0.52), Vector2(p * 0.22, -p * 0.52), Color(0.9, 0.3, 0.25, 0.9), p * 0.045)

## The textbook capacitor: a tan box with two plates inside, legs to both pads (4 pads apart, like the other axial parts).
static func ideal_cap(ci: CanvasItem, p: float, sh: bool) -> void:
	PartArt._leads(ci, [Vector2(0, 0), Vector2(4, 0)], p, [Vector2(1.2, 0), Vector2(2.8, 0)])
	PartArt.rrect(ci, Rect2(1.1 * p, -0.62 * p, 1.8 * p, 1.24 * p), p * 0.22, _c(Color("#d8cba2"), sh))
	if sh: return
	PartArt.rrect(ci, Rect2(1.18 * p, -0.54 * p, 1.64 * p, 1.08 * p), p * 0.16, Color("#efe5c4"))
	var x := 2.0 * p
	for s in [-1.0, 1.0]:
		ci.draw_line(Vector2(x + s * p * 0.12, -p * 0.4), Vector2(x + s * p * 0.12, p * 0.4), Color(0.25, 0.28, 0.4), p * 0.09)
	ci.draw_line(Vector2(1.5 * p, 0), Vector2(x - p * 0.12, 0), Color(0.25, 0.28, 0.4), p * 0.05); ci.draw_line(Vector2(x + p * 0.12, 0), Vector2(2.5 * p, 0), Color(0.25, 0.28, 0.4), p * 0.05)
	ci.draw_line(Vector2(1.3 * p, -0.45 * p), Vector2(2.7 * p, -0.45 * p), Color(1, 1, 1, 0.5), p * 0.05)

## Ticket 3-4 card (b): a capacitor that arrives charged, a squat blue can on two studs with a level gauge on its side showing how full it is (`level` 0..1, from the engine's voltage) and a lightning tick.
static func charged_cap(ci: CanvasItem, lp: Array, p: float, sh: bool, level: float) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	var al := (b - a).normalized(); var side := al.orthogonal()
	var len := (b - a).length()
	PartArt._leads(ci, [lp[0], lp[1]], p, [lp[0] + al * 0.9, lp[1] - al * 0.9])
	var h := len * 0.5 - p * 0.9; var w := p * 1.25
	var pts := PackedVector2Array([mid - al * h - side * w, mid + al * h - side * w, mid + al * h + side * w, mid - al * h + side * w])
	ci.draw_colored_polygon(pts, _c(Color("#173a78"), sh))
	if sh: return
	ci.draw_colored_polygon(PackedVector2Array([mid - al * (h - p * 0.12) - side * (w - p * 0.12), mid + al * (h - p * 0.12) - side * (w - p * 0.12), mid + al * (h - p * 0.12) + side * (w - p * 0.12), mid - al * (h - p * 0.12) + side * (w - p * 0.12)]), Color("#1f4c9c"))
	# the level gauge: a dark slot along the can with a bright fill from the minus end toward the plus end
	var g0 := mid - al * (h - p * 0.5) + side * (w - p * 0.45); var g1 := mid + al * (h - p * 0.5) + side * (w - p * 0.45)
	ci.draw_line(g1, g0, Color(0.02, 0.05, 0.12), p * 0.34)
	ci.draw_line(g1, g1.lerp(g0, clampf(level, 0.0, 1.0)), Color("#ffd24a").lerp(Color("#ff8a3a"), 1.0 - clampf(level, 0.0, 1.0)), p * 0.22)
	ci.draw_line(mid - al * (h - p * 0.2) - side * (w - p * 0.3), mid + al * (h - p * 0.2) - side * (w - p * 0.3), Color(1, 1, 1, 0.18), p * 0.07)
	_txt(ci, "4 µF", mid - al * (h * 0.5) - side * (w * 0.7) - Vector2(0, -p * 0.3), int(clampf(p * 0.5, 9.0, 22.0)), Color(0.9, 0.93, 1.0, 0.95))
	_txt(ci, "+", a + al * p * 0.2 - side * p * 0.2 + Vector2(p * 0.2, -p * 0.15), int(clampf(p * 0.6, 11.0, 26.0)), Color(1, 0.75, 0.6))

## The relay: a clear-lidded block, a copper coil on its bobbin, a hinged armature with a contact tip. `operated`: the armature is pulled in (the engine's RLY state); `glow` 0..1 coil warmth from the current.
## Local pins: C1 (0,0), C2 (0,4), COM (4,0), NO (4,2), NC (4,4).
static func relay(ci: CanvasItem, p: float, sh: bool, operated: bool, glow: float, click_t: float) -> void:
	PartArt._leads(ci, [Vector2(0, 0), Vector2(0, 4), Vector2(4, 0), Vector2(4, 2), Vector2(4, 4)], p, [Vector2(0.9, 0), Vector2(0.9, 4), Vector2(3.1, 0), Vector2(3.1, 2), Vector2(3.1, 4)])
	var r := Rect2(0.8 * p, -0.7 * p, 2.4 * p, 5.4 * p)
	PartArt.rrect(ci, r, p * 0.16, _c(Color("#2a5f9e"), sh))
	if sh: return
	PartArt.rrect(ci, r.grow(-p * 0.14), p * 0.1, Color(0.62, 0.8, 0.95, 0.42))   # the clear lid
	# the coil: a copper-wound bobbin down the left half
	var cx := 1.55 * p
	PartArt.rrect(ci, Rect2(cx - p * 0.42, p * 0.15, p * 0.84, p * 3.7), p * 0.08, Color("#6b4a1e"))
	for k in 20:
		var y := p * (0.28 + 0.17 * float(k))
		ci.draw_line(Vector2(cx - p * 0.4, y), Vector2(cx + p * 0.4, y + p * 0.05), Color("#c47a2a").lerp(Color("#ffb060"), glow), p * 0.1)
	if glow > 0.05: ci.draw_rect(Rect2(cx - p * 0.5, p * 0.1, p * 1.0, p * 3.8), Color(1.0, 0.55, 0.2, 0.14 * glow), true)
	# the armature: hinged at the COM end, its tip swings from the NC side to the NO side when pulled in
	var hinge := Vector2(2.7 * p, 0.1 * p)
	var tip_open := Vector2(2.75 * p, 3.9 * p); var tip_shut := Vector2(2.75 * p, 2.0 * p)
	var tip := tip_shut if operated else tip_open
	var jolt := clampf(1.0 - click_t / 0.12, 0.0, 1.0)
	tip += Vector2(sin(click_t * 90.0) * p * 0.07 * jolt, 0)
	ci.draw_line(hinge, tip, Color(0.7, 0.72, 0.76), p * 0.18); ci.draw_line(hinge + Vector2(-p * 0.04, 0), tip + Vector2(-p * 0.04, 0), Color(0.92, 0.93, 0.96), p * 0.05)
	ci.draw_circle(hinge, p * 0.15, Color(0.4, 0.42, 0.46))
	ci.draw_circle(tip, p * 0.16, Color("#d9b24a"))
	for yy in [2.0, 3.9]: ci.draw_circle(Vector2(2.75 * p, yy * p), p * 0.12, Color(0.45, 0.46, 0.5))   # the NO and NC contact points
	ci.draw_line(r.position + Vector2(p * 0.25, p * 0.2), Vector2(r.end.x - p * 0.25, r.position.y + p * 0.2), Color(1, 1, 1, 0.28), p * 0.07)

## The 10 k pull-up as a fat chip resistor lying between its two pads (the board turns it vertical).
static func pullup(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	var al := (b - a).normalized(); var side := al.orthogonal()
	PartArt._leads(ci, [lp[0], lp[1]], p, [lp[0] + al * 1.6, lp[1] - al * 1.6])
	var h := (b - a).length() * 0.5 - p * 1.6; var w := p * 0.8
	ci.draw_colored_polygon(PackedVector2Array([mid - al * h - side * w, mid + al * h - side * w, mid + al * h + side * w, mid - al * h + side * w]), _c(Color("#2d2f36"), sh))
	if sh: return
	for sg in [-1.0, 1.0]: ci.draw_colored_polygon(PackedVector2Array([mid + al * sg * h - side * w, mid + al * sg * (h - p * 0.4) - side * w, mid + al * sg * (h - p * 0.4) + side * w, mid + al * sg * h + side * w]), Color("#b9bcc4"))
	_txt(ci, "10k", mid - side * p * 0.1 - al * p * 0.45, int(clampf(p * 0.45, 9.0, 20.0)), Color(0.85, 0.88, 0.95, 0.95))

## The logic input: a little DIP chip, pin 1 and its notch toward pad 1, "1M" printed on it.
static func logic_in(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	var al := (b - a).normalized(); var side := al.orthogonal()
	PartArt._leads(ci, [lp[0], lp[1]], p, [lp[0] + al * 1.3, lp[1] - al * 1.3])
	var h := (b - a).length() * 0.5 - p * 1.3; var w := p * 1.1
	ci.draw_colored_polygon(PackedVector2Array([mid - al * h - side * w, mid + al * h - side * w, mid + al * h + side * w, mid - al * h + side * w]), _c(Color(0.1, 0.1, 0.12), sh))
	if sh: return
	for k in 3:
		var u := (float(k) - 1.0) * h * 0.6
		for sg in [-1.0, 1.0]: ci.draw_line(mid + al * u + side * w * sg, mid + al * u + side * (w + p * 0.4) * sg, SILVER, p * 0.15)
	ci.draw_circle(mid - al * (h - p * 0.4) - side * (w - p * 0.4), p * 0.13, Color(0.4, 0.42, 0.46))
	_txt(ci, "LOGIC", mid - side * p * 0.9 - al * p * 0.2, int(clampf(p * 0.36, 8.0, 18.0)), Color(0.7, 0.74, 0.85, 0.9))

## A big arcade button standing on the board (drawn over the bench at the contact it stands for): housing, a red dome that goes down when the contact is closed; `shake` 0..1 chatter while it bounces.
static func arcade_button(ci: CanvasItem, c: Vector2, p: float, pressed: bool, shake: float) -> void:
	var r := p * 1.9
	ci.draw_circle(c + Vector2(p * 0.15, p * 0.3), r * 1.18, Color(0, 0, 0, 0.35))
	ci.draw_circle(c, r * 1.15, Color("#17181c")); ci.draw_circle(c, r * 1.02, Color("#2a2c33"))
	ci.draw_arc(c, r * 1.02, PI * 1.1, PI * 1.6, 12, Color(1, 1, 1, 0.25), p * 0.12)
	for k in 4:   # four mounting screws
		var a := PI * 0.25 + float(k) * PI * 0.5
		ci.draw_circle(c + Vector2(cos(a), sin(a)) * r * 1.0, p * 0.12, Color("#8d9097"))
	var off := Vector2(sin(shake * 40.0) * p * 0.06 * shake, p * 0.12 if pressed else 0.0)
	var dome := Color("#d8332a") if not pressed else Color("#a82019")
	ci.draw_circle(c + off + Vector2(0, p * 0.1), r * 0.86, Color("#7d1812") if not pressed else Color("#5e100c"))
	ci.draw_circle(c + off - Vector2(0, p * (0.12 if not pressed else 0.0)), r * 0.82, dome)
	ci.draw_circle(c + off - Vector2(r * 0.28, r * 0.3 - (0.0 if pressed else p * 0.1)), r * 0.22, Color(1, 1, 1, 0.45 if not pressed else 0.22))
	ci.draw_arc(c + off, r * 0.62, PI * 1.15, PI * 1.55, 8, Color(1, 0.8, 0.75, 0.4), p * 0.1)

## A knife switch between two pads (ticket 3-4's charge-sharing switch): two posts, a hinge at `a`, a blade that lies on the `b` clip when closed and stands up at an angle when open.
static func knife_switch(ci: CanvasItem, a: Vector2, b: Vector2, p: float, closed: bool) -> void:
	var al := (b - a).normalized(); var side := al.orthogonal()
	var base := PackedVector2Array([a - al * p * 0.9 - side * p * 0.9, b + al * p * 0.9 - side * p * 0.9, b + al * p * 0.9 + side * p * 0.9, a - al * p * 0.9 + side * p * 0.9])
	ci.draw_colored_polygon(PackedVector2Array(Array(base).map(func(v): return v + Vector2(p * 0.12, p * 0.2))), SHADOW)
	ci.draw_colored_polygon(base, Color("#4a2f1c"))
	ci.draw_line(a - al * p * 0.7 + side * p * 0.75, b + al * p * 0.7 + side * p * 0.75, Color(1, 1, 1, 0.12), p * 0.07)
	for e in [a, b]:   # the two brass posts
		ci.draw_circle(e, p * 0.5, Color("#b08a3a")); ci.draw_circle(e, p * 0.36, Color("#e1bd5a")); ci.draw_circle(e, p * 0.13, Color("#6b4f1c"))
	# the clip on the far post
	ci.draw_line(b - side * p * 0.34, b + side * p * 0.34, Color("#e1bd5a"), p * 0.16)
	var len := (b - a).length() - p * 0.3
	var ang := 0.0 if closed else 0.62
	var dir := (al * cos(ang) + side * -sin(ang)).normalized()
	var tipp := a + dir * len
	ci.draw_line(a, tipp, Color(0, 0, 0, 0.3), p * 0.3)
	ci.draw_line(a, tipp, Color("#9aa0a8"), p * 0.24); ci.draw_line(a - side * p * 0.04, tipp - side * p * 0.04, Color("#d9dde3"), p * 0.07)
	var knob := a + dir * len * 0.78
	ci.draw_circle(knob, p * 0.3, Color("#2a1a12")); ci.draw_circle(knob + Vector2(-p * 0.07, -p * 0.08), p * 0.1, Color(1, 1, 1, 0.3))
