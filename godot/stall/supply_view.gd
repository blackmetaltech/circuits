class_name SupplyView
extends Control
## The power source with its physical rocker switch: a PP3 battery holder (black box, the battery, snap clip studs) or a small bench supply
## (grey box, red 7-segment display, knob, binding posts). The rocker really tilts, clicks and lights a lamp. Fixed 400x170 design space.

const S = preload("res://stall/stall_style.gd")
const DESIGN := Vector2(400, 170)
const ROCKER := Rect2(300, 40, 70, 100)

var kind := "pp3"
var label := "9 V PP3"
var tired := false
var sources: Array = []            ## exam tickets: the ideal textbook sources fixed on the board [{name, volts}], listed on the panel instead of a battery
var conditions: Array = []         ## the ticket's bench conditions (engine): [{id, set:[{target,key,value}], ambientC}], drawn as a tag when there are several
var on := false
var hover := false
var volts := 9.0
var amps := 0.0
var t := 0.0
var _tilt := 0.0

func _ready() -> void:
	set_meta(&"small_text", true)   # engraved decoration stays small on handheld (the readings are big already)
	custom_minimum_size = DESIGN; size = DESIGN; mouse_filter = Control.MOUSE_FILTER_IGNORE; set_process(true)

func _process(dt: float) -> void:
	t += dt
	_tilt = lerpf(_tilt, 1.0 if on else 0.0, 1.0 - exp(-dt * 22.0))
	queue_redraw()

func port(which: String) -> Vector2:
	if kind == "bench": return Vector2(60, 18) if which == "red" else Vector2(120, 18)
	return Vector2(52, 20) if which == "red" else Vector2(104, 20)

func hit_rocker(p: Vector2) -> bool: return ROCKER.grow(8).has_point(p)

## The terminals a meter lead can be dropped on (the snap studs of the holder, the binding posts of the bench supply): "red" is the + side, "black" the ground side.
var jack_glow := ""   ## which terminal a dragged lead is hovering near
func jack_pos(which: String) -> Vector2:
	if kind == "bench": return Vector2(60, 28) if which == "red" else Vector2(120, 28)
	return Vector2(52, 30) if which == "red" else Vector2(104, 30)
## Where the battery's own lettering sits (the big "9V" and the small label under it) and where the bench-test tag hangs: they must never overlap.
const CELL := Rect2(24, 54, 250, 92)
static func battery_text_rects() -> Array: return [Rect2(CELL.position + Vector2(22, 12), Vector2(72, 56)), Rect2(CELL.position + Vector2(22, 68), Vector2(84, 20))]
static func cond_tag_rect(rows: int) -> Rect2: return Rect2(134, 52, 152, 32 + rows * 24)
func has_jacks() -> bool: return kind != "sources"
## A generous target: 30 design pixels around the terminal ("" when none).
func jack_at(p: Vector2) -> String:
	if not has_jacks(): return ""
	var best := ""; var bd := 30.0
	for w in ["red", "black"]:
		var d := p.distance_to(jack_pos(w))
		if d <= bd: bd = d; best = w
	return best

func _draw() -> void:
	var rr := Rect2(0, 8, DESIGN.x, DESIGN.y - 14)
	S.shadow(self, rr, 18, Vector2(8, 12), 0.5)
	if kind == "bench": _bench(rr)
	elif kind == "sources": _sources(rr)
	else: _holder(rr)
	_rocker()

func _holder(rr: Rect2) -> void:
	S.rr(self, rr, 18, Color("#0e0f12")); S.rr(self, rr.grow(-3), 16, Color("#1d1f24"))
	S.vgrad(self, Rect2(8, 12, 384, 40), Color(1, 1, 1, 0.07), Color(1, 1, 1, 0.0), 6)
	# the battery in its cradle
	var cell := Rect2(24, 54, 250, 92)
	S.rr(self, cell.grow(6), 10, Color("#0a0a0c"))
	S.rr(self, cell, 8, Color("#b79c4c") if not tired else Color("#8d8160"))
	S.rr(self, Rect2(cell.position, Vector2(cell.size.x * 0.72, cell.size.y)), 8, Color("#1f1f22"))   # black wrapper
	draw_rect(Rect2(cell.position.x + 8, cell.position.y + 16, 6, cell.size.y - 32), Color("#c9a84a"), true)
	S.text(self, S.mono(), "9V", cell.position + Vector2(24, 62), 54, Color("#e8dca4") if not tired else Color("#9a9078"))
	S.text(self, S.hand(), "PP3 alkaline" if not tired else "PP3 (tired)", cell.position + Vector2(24, 82), 14, Color("#b9ad7e"))
	if tired:   # a hand-written sticker on a tired cell
		S.paper(self, Rect2(cell.position.x + 150, cell.position.y + 20, 86, 44), -6.0)
		S.text(self, S.hand(), "tired!", Vector2(cell.position.x + 166, cell.position.y + 50), 20, S.INK_RED)
	if conditions.size() > 1: _cond_tag()
	for i in 2:   # snap studs on top
		var c := Vector2(52 + i * 52, 30)
		var col := Color("#b2261c") if i == 0 else Color("#1a1a1c")
		draw_circle(c, 17, Color("#0a0a0c")); draw_circle(c, 14, Color("#8d9097")); draw_circle(c, 9, col.lightened(0.1)); draw_circle(c + Vector2(-3, -3), 3, Color(1, 1, 1, 0.5))
	S.text(self, S.hand(), "+", Vector2(40, 54), 18, Color("#d98a80")); S.text(self, S.hand(), "-", Vector2(98, 54), 22, Color("#9aa0a8"))
	_jack_ring()

## The bench tests every condition (docs/API-CH1.md: ticketCard.conditions): a paper tag lists them with the engine's own numbers.
func _cond_tag() -> void:
	var rows: Array = []
	for c in conditions:
		var emf := -1.0; var r := -1.0
		for e in c.get("set", []):
			if str(e.key) == "emf": emf = float(e.value)
			elif str(e.key) == "r": r = float(e.value)
		rows.append("%s %s V / %s \u03a9" % [str(c.id), EngineBench._g(emf), EngineBench._g(r)] if emf >= 0.0 else str(c.id))
	# a tag tied to the cell, big enough to read at the supply's 0.8 scale (it hangs over the battery's blank half)
	var tag := cond_tag_rect(rows.size())   # clear of the battery's own "9V" and label on its left
	draw_line(Vector2(tag.position.x + 12, tag.position.y), Vector2(104, 34), Color("#c9b78a"), 2.5)   # its string, up to the minus stud
	S.paper(self, tag, 1.5, S.PAPER)
	S.text(self, S.hand(), "bench tests:", tag.position + Vector2(10, 21), 16, S.INK_RED)
	for i in rows.size(): S.text(self, S.hand(), rows[i], tag.position + Vector2(8, 44 + i * 24), 16, S.INK)

## The exam bench: two fixed ideal sources, named and with their volts. There is no knob and no one voltage, so no 0.0 V display.
func _sources(rr: Rect2) -> void:
	S.rr(self, rr, 14, Color("#3b3e44")); S.rr(self, rr.grow(-3), 12, Color("#585c64"))
	S.vgrad(self, Rect2(8, 12, 384, 50), Color(1, 1, 1, 0.12), Color(1, 1, 1, 0.0), 6)
	for c in [Vector2(14, 20), Vector2(386, 20), Vector2(14, 156), Vector2(386, 156)]: S.screw(self, c, 5.0, c.x * 0.1)
	S.text(self, S.hand(), "TEXTBOOK SOURCES  (ideal)", Vector2(26, 38), 17, Color("#d8d4c4"))
	for i in sources.size():
		var s: Dictionary = sources[i]
		var row := Rect2(26, 52 + i * 52, 250, 44)
		S.rr(self, row, 6, Color("#150604"))
		S.text(self, S.mono(), "%s" % str(s.name), row.position + Vector2(12, 33), 30, Color(1.0, 0.45, 0.3, 1.0 if on else 0.55))
		var vt := "%s V" % EngineBench._g(float(s.volts))
		S.text(self, S.mono(), vt, row.position + Vector2(row.size.x - 14 - S.tw(S.mono(), vt, 30), 33), 30, Color(1.0, 0.28, 0.15, 1.0 if on else 0.55))
		if on: S.glow(self, row.get_center(), 90.0, Color(1, 0.2, 0.1, 0.08))
	S.text(self, S.hand(), "wired by the ticket: just probe", Vector2(26, 158), 14, Color("#b8b4a4"))

func _bench(rr: Rect2) -> void:
	S.rr(self, rr, 14, Color("#3b3e44")); S.rr(self, rr.grow(-3), 12, Color("#585c64"))
	S.vgrad(self, Rect2(8, 12, 384, 50), Color(1, 1, 1, 0.12), Color(1, 1, 1, 0.0), 6)
	for c in [Vector2(14, 20), Vector2(386, 20), Vector2(14, 156), Vector2(386, 156)]: S.screw(self, c, 5.0, c.x * 0.1)
	var disp := Rect2(160, 52, 120, 70)
	S.rr(self, disp.grow(4), 6, Color("#15161a")); S.rr(self, disp, 4, Color("#150604"))
	var txt := "%.1f" % (volts if on else 0.0)
	S.text(self, S.mono(), "88.8", disp.position + Vector2(10, 52), 52, Color(1, 0.2, 0.1, 0.10))
	S.text(self, S.mono(), txt, disp.position + Vector2(disp.size.x - 10 - S.tw(S.mono(), txt, 52), 52), 52, Color(1.0, 0.28, 0.15, 1.0 if on else 0.25))
	if on: S.glow(self, disp.get_center(), 100.0, Color(1, 0.2, 0.1, 0.16))
	S.text(self, S.hand(), "V", disp.position + Vector2(disp.size.x - 18, 66), 14, Color(1, 0.4, 0.3, 0.7))
	S.knob(self, Vector2(100, 112), 24.0, 0.9 if on else -0.4)
	S.text(self, S.hand(), label, Vector2(24, 158), 15, Color("#d8d4c4"))
	for i in 2:
		var c := Vector2(60 + i * 60, 28); var col := Color("#b2261c") if i == 0 else Color("#1a1a1c")
		draw_circle(c, 15, Color("#0a0a0c")); draw_circle(c, 12, col); draw_circle(c, 6, Color("#d0b25a"))
	_jack_ring()

func _jack_ring() -> void:
	if jack_glow == "": return
	var c := jack_pos(jack_glow)
	draw_arc(c, 24.0, 0, TAU, 32, Color("#ffd98a"), 3.0); draw_circle(c, 24.0, Color("#ffd98a", 0.18))

func _rocker() -> void:
	var r := ROCKER
	S.rr(self, r.grow(9), 10, Color("#0a0a0c")); S.rr(self, r.grow(5), 8, Color("#26282d"))
	if hover: S.glow(self, r.get_center(), 90.0, Color("#ffd98a", 0.12))
	# the rocker paddle: two faces shaded by tilt
	var up := _tilt
	var mid := r.get_center()
	var top_face := Color("#cf3b2e").lerp(Color("#7d1f18"), 1.0 - up) if true else Color.WHITE
	var bot_face := Color("#7d1f18").lerp(Color("#cf3b2e"), 1.0 - up)
	var split := mid.y + (up - 0.5) * 22.0
	S.rr(self, Rect2(r.position.x + 5, r.position.y + 5, r.size.x - 10, split - r.position.y - 5), 6, top_face.lerp(Color("#e8574a"), up * 0.4))
	S.rr(self, Rect2(r.position.x + 5, split, r.size.x - 10, r.end.y - split - 5), 6, bot_face.darkened(0.15 * up))
	draw_line(Vector2(r.position.x + 8, split), Vector2(r.end.x - 8, split), Color(0, 0, 0, 0.5), 2.0)
	draw_line(Vector2(r.position.x + 10, r.position.y + 12), Vector2(r.position.x + 10, split - 6), Color(1, 1, 1, 0.18), 2.0)
	# "I" and "O" printed on the paddle
	S.text(self, S.mono(), "I", Vector2(mid.x - 5, r.position.y + 36), 26, Color(1, 1, 1, 0.85 if on else 0.35))
	draw_arc(Vector2(mid.x, r.end.y - 28), 9, 0, TAU, 20, Color(1, 1, 1, 0.35 if on else 0.85), 3.0)
	# lamp above
	var lamp := Vector2(mid.x, r.position.y - 20)
	draw_circle(lamp, 8, Color("#220b08")); draw_circle(lamp, 6, Color(1, 0.35, 0.2, 1.0 if on else 0.18))
	if on: S.glow(self, lamp, 34.0, Color(1, 0.3, 0.15, 0.5))
	S.text(self, S.hand(), "POWER", Vector2(mid.x - 26, r.end.y + 22), 15, Color("#d8d4c4"))
	# the state in words, next to the lamp: ON in warm light, OFF dim, so the rocker never has to be decoded from its tilt
	var word := "ON" if on else "OFF"
	S.text(self, S.mono(), word, Vector2(lamp.x + 16, lamp.y + 8), 22, Color("#ffd98a") if on else Color("#8a8f98"))
