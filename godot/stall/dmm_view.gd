class_name DmmView
extends Control
## The chunky yellow handheld DMM: rubber boot, LCD with ghost digits, a rotary dial that clicks between OFF / V / mA, and two sockets for the
## probe leads (the stall draws the leads and tips on top of the board so they can be dragged onto pads). Fixed 300x430 design space.

const S = preload("res://stall/stall_style.gd")
const DESIGN := Vector2(300, 430)
const DIAL_C := Vector2(150, 262)
const MODES := ["OFF", "V", "mA", "Ω"]
const MODE_ANG := {"OFF": -2.35, "V": -0.78, "mA": 0.78, "Ω": 2.35}

var mode := "V"
var reading := {"text": "", "unit": "", "mode": "OFF"}
var hover_dial := false
var t := 0.0
var _ang := -0.78
var _click := 0.0

func _ready() -> void:
	custom_minimum_size = DESIGN; size = DESIGN; mouse_filter = Control.MOUSE_FILTER_IGNORE; set_process(true)

func _process(dt: float) -> void:
	t += dt
	_ang = lerpf(_ang, MODE_ANG.get(mode, -2.35), 1.0 - exp(-dt * 16.0))
	_click = maxf(0.0, _click - dt)
	queue_redraw()

func set_mode(m: String) -> void:
	if m != mode: mode = m; _click = 0.18

func socket_pos(which: String) -> Vector2: return Vector2(112, 398) if which == "black" else Vector2(188, 398)

func hit_dial(p: Vector2) -> bool: return p.distance_to(DIAL_C) < 82.0

## Four digits and a decimal point on a fixed pitch, so 9.000 V, 5.320 V, 14.96 mA and 4.700 Ω all fit inside the glass; the ghost segments sit under exactly the same cells.
const LCD_PITCH := 40.0
const LCD_DOT := 16.0
const LCD_SIZE := 64
static func lcd_text(value: Variant, fallback: String) -> String:
	if value == null:
		return fallback if fallback.strip_edges() != "" else ""
	var x := absf(float(value))
	var e := int(floor(log(x) / log(10.0))) if x >= 1.0 else 0
	var dec := clampi(3 - e, 0, 3)
	var s := ("%." + str(dec) + "f") % x   # String.num would trim 9.000 to 9.0
	return ("-" if float(value) < 0.0 and float(s) != 0.0 else "") + s

func _lcd(lcd: Rect2, on: bool) -> void:
	var ink := Color(0.07, 0.09, 0.05, 0.92); var ghost := Color(0.15, 0.2, 0.1, 0.07 if on else 0.045)
	var txt := lcd_text(reading.get("value", null), str(reading.get("text", ""))) if on else ""
	var dashes := txt.begins_with("--") or (txt != "" and not txt.is_valid_float())
	var neg := txt.begins_with("-") and not dashes; var body := txt.substr(1) if neg else txt
	var cells := 4; var dot_at := 1   # the point sits after the first digit in the ghost; the live point is placed by the text
	var width := cells * LCD_PITCH + LCD_DOT
	var x0 := lcd.end.x - 18.0 - width; var base := lcd.position.y + 84.0
	# ghost segments: 8 8 8 8 with the point where the reading puts it
	var dp := body.find(".")
	var dot_after := (dp - 1) if dp > 0 else -1
	var x := x0
	for i in cells:
		S.text(self, S.mono(), "8", Vector2(x, base), LCD_SIZE, ghost)
		x += LCD_PITCH
		if i == dot_after: S.text(self, S.mono(), ".", Vector2(x - 2.0, base), LCD_SIZE, ghost); x += LCD_DOT
	if on and txt != "":
		x = x0
		var ci := 0
		if dashes:
			for i in cells: S.text(self, S.mono(), "-", Vector2(x0 + i * LCD_PITCH + 4.0, base), LCD_SIZE, ink)
		else:
			for ch in body:
				if ch == ".": S.text(self, S.mono(), ".", Vector2(x - 2.0, base), LCD_SIZE, ink); x += LCD_DOT; continue
				S.text(self, S.mono(), ch, Vector2(x, base), LCD_SIZE, ink); x += LCD_PITCH; ci += 1
		if neg: S.text(self, S.mono(), "-", Vector2(x0 - 24.0, base), LCD_SIZE, ink)
		S.text(self, S.mono(), "DC" if mode != "Ω" else "OHM", lcd.position + Vector2(10, 22), 14, ink)
		S.text(self, S.mono(), str(reading.get("unit", "")), lcd.position + Vector2(lcd.size.x - 44, 22), 18, ink)

## Click on the dial: the half of the dial you hit picks the next / previous position.
func dial_click(p: Vector2) -> String:
	var i := MODES.find(mode)
	var d := p.x - DIAL_C.x
	i = clampi(i + (1 if d >= 0.0 else -1), 0, MODES.size() - 1)
	if i == MODES.find(mode): i = (i + 1) % MODES.size() if d >= 0.0 else MODES.size() - 1
	return MODES[i]

func _draw() -> void:
	var rr := Rect2(Vector2.ZERO, DESIGN)
	S.shadow(self, rr, 36, Vector2(10, 16), 0.5)
	S.rr(self, rr, 38, Color("#1c1d20"))                                   # rubber boot
	S.rr(self, rr.grow(-3), 36, Color("#2a2b30"))
	var body := Rect2(16, 16, 268, 398)
	S.rr(self, body, 26, Color("#d9a91c")); S.rr(self, body.grow(-4), 23, Color("#f4c731"))
	S.vgrad(self, Rect2(22, 20, 256, 90), Color(1, 1, 1, 0.22), Color(1, 1, 1, 0.0), 8)
	for c in [Vector2(34, 34), Vector2(266, 34), Vector2(34, 396), Vector2(266, 396)]: S.screw(self, c, 6.0, c.x * 0.02)
	# LCD
	var lcd := Rect2(40, 44, 220, 100)
	S.rr(self, lcd.grow(7), 10, Color("#25262a")); S.rr(self, lcd, 6, Color("#a7b88e"))
	S.vgrad(self, lcd, Color(1, 1, 1, 0.14), Color(0, 0, 0, 0.12), 8)
	var on := mode != "OFF"
	_lcd(lcd, on)
	# dial: a fat knurled knob with labelled positions around it
	var labs := {"OFF": "OFF", "V": "V", "mA": "mA", "Ω": "Ω"}
	for m in MODES:
		var a: float = MODE_ANG[m]; var d := Vector2(cos(a - 1.57), sin(a - 1.57)) * Vector2(1, 1)
		var pos := DIAL_C + Vector2(sin(a), -cos(a)) * 106.0
		var col := Color("#26211a") if m != mode else Color("#7a1810")
		S.text(self, S.hand(), labs[m], pos + Vector2(-S.tw(S.hand(), labs[m], 18) * 0.5, 6), 18, col)
		draw_line(DIAL_C + Vector2(sin(a), -cos(a)) * 86.0, DIAL_C + Vector2(sin(a), -cos(a)) * 94.0, col, 3.0)
	S.glow(self, DIAL_C, 100.0, Color(1, 1, 1, 0.12 if hover_dial else 0.0))
	draw_circle(DIAL_C + Vector2(6, 10), 72, Color(0, 0, 0, 0.35))
	draw_circle(DIAL_C, 74, Color("#16171a"))
	for i in 36:
		var a := float(i) / 36.0 * TAU
		draw_line(DIAL_C + Vector2(cos(a), sin(a)) * 66, DIAL_C + Vector2(cos(a), sin(a)) * 74, Color("#3a3c42"), 4.0)
	draw_circle(DIAL_C, 64, Color("#27292e")); draw_circle(DIAL_C + Vector2(-6, -8), 48, Color("#30333a"))
	var a2 := _ang + (sin(_click * 40.0) * 0.03 if _click > 0.0 else 0.0)
	var dir := Vector2(sin(a2), -cos(a2))
	draw_colored_polygon(PackedVector2Array([DIAL_C + dir * 62, DIAL_C + dir.orthogonal() * 9 + dir * 10, DIAL_C - dir.orthogonal() * 9 + dir * 10]), Color("#f1e7c9"))
	draw_circle(DIAL_C, 14, Color("#15161a"))
	# sockets
	for w in ["black", "red"]:
		var c := socket_pos(w); var col := Color("#1a1a1c") if w == "black" else Color("#b2261c")
		draw_circle(c, 24, Color("#17181b")); draw_circle(c, 20, col); draw_circle(c, 11, Color("#08080a")); draw_circle(c, 7, Color("#d0b25a"))
		S.text(self, S.hand(), "COM" if w == "black" else "V mA", c + Vector2(-S.tw(S.hand(), "COM" if w == "black" else "V mA", 14) * 0.5, 40), 14, Color("#3a2e10"))
	S.text(self, S.hand(), "BENCH-MATE", Vector2(150 - S.tw(S.hand(), "BENCH-MATE", 15) * 0.5, 168), 15, Color("#6a4f0c"))
