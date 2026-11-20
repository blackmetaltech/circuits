class_name StallPages
extends Control
## Paper overlays on top of the bench (the bench stays visible behind a scrim; nothing is a grey modal):
##   title     the neon NODE sign at dusk and hanging painted signs: Continue / New / Settings / Cute mode
##   map       the chapter as an open notebook page with the tickets pinned as paper chits
##   notebook  Wren's notebook: the coach steps for this ticket (left) and the Codex (right)
##   settings  a pinned card with chalk toggles
## It emits `act(id, arg)`; StallScene decides what happens.

const S = preload("res://stall/stall_style.gd")
signal act(id: String, arg: String)

var mode := ""
var t := 0.0
var open_t := 0.0
var cute := true
var reduced := false
var sound := true
var volume := 0.8
var has_save := false
var done: Dictionary = {}                 ## ticket id -> true
var wallet := 0
var wallet_text := ""                     ## the engine's formatted wallet ("$4.50"); empty = "%d coins"
var pred_fields: Array = []               ## exam slip: [{id, name, unit, text, done}]
var pred_focus := 0
var tickets: Array = []                   ## [{id,title,customer,spec,price,open,done}]
var coach_ticket: Dictionary = {}
var coach_steps: Array = []
var coach_cur := 0
var coach_done: Array = []                ## bool per step (for the ticks)
var coach_vis: Array = []                 ## false for conditional steps that do not apply now (e.g. the smoke note)
var tab := "coach"
var codex_i := 0
var mouse := Vector2.ZERO
var _buttons: Array = []
var _intro := 0.0
var _prev_mode := ""

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE; set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); set_process(true)

func show_page(m: String) -> void:
	if m != mode: open_t = 0.0
	if m == "title" and mode != "title": _intro = 0.0
	mode = m; mouse_filter = Control.MOUSE_FILTER_STOP if m != "" else Control.MOUSE_FILTER_IGNORE
	queue_redraw()

func _process(dt: float) -> void:
	t += dt; _intro += dt; open_t = minf(1.0, open_t + dt * 4.0)
	if mode != "": queue_redraw()

func _gui_input(e: InputEvent) -> void:
	if mode == "": return
	if e is InputEventMouseMotion: mouse = e.position
	if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT:
		for b in _buttons:
			if (b.rect as Rect2).has_point(e.position): act.emit(b.id, b.get("arg", "")); accept_event(); return
		if mode == "notebook" or mode == "settings": act.emit("close", "")
		accept_event()
	elif e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_RIGHT and mode != "title": act.emit("close", ""); accept_event()
	elif e is InputEventMouseButton and e.pressed and mode == "notebook" and (e.button_index == MOUSE_BUTTON_WHEEL_DOWN or e.button_index == MOUSE_BUTTON_WHEEL_UP):
		codex_i = clampi(codex_i + (1 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -1), 0, CoachData.CODEX.size() - 1); accept_event()

func _hov(r: Rect2) -> bool: return r.has_point(mouse)

func _btn(r: Rect2, id: String, arg := "") -> bool:
	_buttons.append({"rect": r, "id": id, "arg": arg}); return _hov(r)

func _draw() -> void:
	if mode == "": return
	_buttons.clear()
	var a := ease(open_t, 0.4)
	match mode:
		"title": _title()
		"map": _map(a)
		"notebook": _notebook(a)
		"settings": _settings(a)
		"predict": _predict(a)

## ------------------------------------------------------------------------------------------------------------------ title

func _title() -> void:
	var w := size.x; var h := size.y
	draw_rect(Rect2(0, 0, w, h), Color(0.02, 0.02, 0.06, 0.2), true)
	S.vgrad(self, Rect2(0, h * 0.28, w, h * 0.72), Color(0.02, 0.01, 0.04, 0.0), Color(0.02, 0.01, 0.04, 0.62), 12)
	S.vgrad(self, Rect2(0, 0, w, h * 0.45), Color(0, 0, 0, 0.0), Color(0.05, 0.02, 0.1, 0.0), 2)
	# the neon sign, hung in front of the window: tubes in a frame, letters light up one by one, one flickers
	var cx := w * 0.5; var cy := h * 0.19
	var f := S.hand(); var fs := int(h * 0.19)
	var word := "NODE"; var cols := [S.PHOS, S.CYAN, S.MAGENTA, S.AMBER]
	var total := S.tw(f, word, fs); var x := cx - total * 0.5
	var board := Rect2(x - 70, cy - fs * 0.88, total + 140, fs * 1.38)
	draw_line(Vector2(board.position.x + 40, board.position.y), Vector2(board.position.x + 40, 0), Color(0.05, 0.05, 0.08), 4.0)
	draw_line(Vector2(board.end.x - 40, board.position.y), Vector2(board.end.x - 40, 0), Color(0.05, 0.05, 0.08), 4.0)
	S.shadow(self, board, 18, Vector2(0, 14), 0.5)
	S.rr(self, board, 16, Color(0.03, 0.03, 0.06, 0.96)); S.rr_line(self, board, 16, Color(0.28, 0.3, 0.4), 3.0)
	S.rr_line(self, board.grow(-12), 10, Color(S.CYAN, 0.28), 2.0)
	var lx := x
	for i in word.length():
		var ch := word[i]; var cw := S.tw(f, ch, fs)
		var on_t := 0.5 + float(i) * 0.55
		var k := 0.0
		if _intro > on_t:
			var since := _intro - on_t
			k = 1.0 if since > 0.9 else (0.25 + 0.75 * float(int(since * 22.0) % 2))
			if since > 0.9 and i == 2 and fposmod(t, 6.5) > 6.0: k = 0.3 + 0.7 * float(int(t * 26.0) % 2)   # the D stutters now and then
			k *= 0.95 + 0.05 * sin(t * 46.0 + i)
		else: k = 0.06
		var col: Color = cols[i]
		S.glow(self, Vector2(lx + cw * 0.5, cy - fs * 0.22), fs * 0.95, Color(col, 0.28 * k))
		for p in 3:
			draw_string_outline(f, Vector2(lx, cy + fs * 0.18), ch, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, [14, 8, 4][p], Color(col, [0.12, 0.25, 0.55][p] * k))
		draw_string(f, Vector2(lx, cy + fs * 0.18), ch, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, Color(col.lerp(Color.WHITE, 0.8), k))
		lx += cw
	# two lines under the sign: the stall's name, then the tagline with real air between them (the lines are sized from the font, not from guessed pixels)
	var l1 := "Stall 14  ·  Lantern Lane"; var l2 := "Every resistor is a promise about heat."
	var y1 := board.end.y + 20.0 + f.get_ascent(32)
	var y2 := y1 + f.get_descent(32) + 14.0 + f.get_ascent(22)
	var plate := Rect2(cx - S.tw(f, l1, 32) * 0.5 - 26.0, board.end.y + 10.0, S.tw(f, l1, 32) + 52.0, y2 + f.get_descent(22) + 14.0 - board.end.y - 10.0)
	S.rr(self, plate, 14, Color(0.03, 0.02, 0.05, 0.62))   # a dark plate so the two lines read over the perfboard
	S.text(self, f, l1, Vector2(cx - S.tw(f, l1, 32) * 0.5, y1), 32, Color(1, 0.9, 0.7, 0.9))
	S.text(self, f, l2, Vector2(cx - S.tw(f, l2, 22) * 0.5, y2), 22, Color(1, 0.9, 0.7, 0.6))
	# hanging painted signs
	var items: Array = []
	if has_save: items.append(["continue", "Continue", Color("#2f6b45")])
	items.append(["new", "New game", Color("#a24a2a")])
	items.append(["settings", "Settings", Color("#35597a")])
	items.append(["cute", "Cute mode:  %s" % ("on" if cute else "off"), Color("#8a4a78")])
	var sw := 420.0; var sh := 72.0; var gap := 34.0
	var y0 := h * 0.5
	for i in items.size():
		var it: Array = items[i]
		var sway := sin(t * 1.1 + float(i) * 1.7) * 0.012
		var r := Rect2(cx - sw * 0.5, y0 + float(i) * (sh + gap), sw, sh)
		var hv := _btn(r.grow(8), it[0])
		var c := r.get_center()
		draw_set_transform(Vector2(c.x, r.position.y - 40), sway, Vector2.ONE)
		var q := Rect2(Vector2(-sw * 0.5, 40), r.size)
		draw_line(Vector2(-sw * 0.4, 0), Vector2(-sw * 0.38, 44), Color("#c9b78a"), 3.0); draw_line(Vector2(sw * 0.4, 0), Vector2(sw * 0.38, 44), Color("#c9b78a"), 3.0)
		S.shadow(self, q, 8, Vector2(6, 10), 0.5)
		S.rr(self, q, 10, Color("#3b2a20").lerp(it[2], 0.25)); S.rr(self, q.grow(-4), 8, (it[2] as Color).darkened(0.2).lerp(Color("#3b2a20"), 0.25 if not hv else 0.0))
		for g in 6: draw_line(q.position + Vector2(10, 12 + g * 10), q.position + Vector2(q.size.x - 10, 12 + g * 10 + sin(float(g)) * 2.0), Color(0, 0, 0, 0.12), 1.5)
		S.text(self, f, it[1], q.position + Vector2(q.size.x * 0.5 - S.tw(f, it[1], 36) * 0.5, 50), 36, Color("#f6ecd0") if not hv else Color("#fff2b8"))
		S.pin(self, q.position + Vector2(18, 16), Color("#cfa13a")); S.pin(self, q.position + Vector2(q.size.x - 18, 16), Color("#cfa13a"))
		if hv: S.rr_line(self, q.grow(4), 12, Color("#ffd98a", 0.85), 3.0)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if cute:   # Rezzy peeks in from the corner so Cute mode says "yes" on the title too
		S.text(self, f, "~ Rezzy is on shift ~", Vector2(24, h - 24), 20, Color(1, 0.9, 0.7, 0.55))

## ------------------------------------------------------------------------------------------------------------------ chapter map

func _open_book(r: Rect2, a: float) -> void:
	if r.size.x < 200.0 or r.size.y < 200.0: return   # the window is mid-resize (the page has no room yet): nothing to draw this frame
	draw_rect(Rect2(0, 0, size.x, size.y), Color(0.03, 0.02, 0.03, 0.55 * a), true)
	S.shadow(self, r, 14, Vector2(10, 18), 0.6 * a)
	S.rr(self, r.grow(12), 16, Color("#26453c")); S.rr(self, r.grow(8), 14, Color("#2f5a4d"))
	var half := r.size.x * 0.5
	S.paper(self, Rect2(r.position, Vector2(half - 2, r.size.y)), 0.0, S.PAPER, true)
	S.paper(self, Rect2(r.position + Vector2(half + 2, 0), Vector2(half - 2, r.size.y)), 0.0, S.PAPER, true)
	S.vgrad(self, Rect2(r.position.x + half - 36, r.position.y, 36, r.size.y), Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.0), 1)
	for i in 14:   # the gutter shades toward the spine
		var k := float(i) / 14.0
		draw_rect(Rect2(r.position.x + half - 2 - 40 * (1 - k), r.position.y, 40.0 / 14.0 + 1, r.size.y), Color(0, 0, 0, 0.05 * k), true)
		draw_rect(Rect2(r.position.x + half + 2 + 40 * (1 - k) - 3, r.position.y, 40.0 / 14.0 + 1, r.size.y), Color(0, 0, 0, 0.05 * k), true)
	for i in 12:   # spiral rings
		var y := r.position.y + 40.0 + float(i) * (r.size.y - 80.0) / 11.0
		S.rr(self, Rect2(r.position.x + half - 14, y - 6, 28, 12), 6, Color("#9a9fa6")); draw_circle(Vector2(r.position.x + half - 8, y), 3, Color("#2a2d33")); draw_circle(Vector2(r.position.x + half + 8, y), 3, Color("#2a2d33"))

func _map(a: float) -> void:
	var w := size.x; var h := size.y
	var r := Rect2(w * 0.5 - 880, h * 0.5 - 450 + (1.0 - a) * 30, 1760, 900)
	r = r.intersection(Rect2(20, 20, w - 40, h - 40))
	_open_book(r, a)
	var half := r.size.x * 0.5; var f := S.hand()
	var lp := r.position + Vector2(56, 70)
	S.text(self, f, "Chapter 1", lp, 28, S.INK_RED)
	S.text(self, f, "First Light", lp + Vector2(0, 64), 64, S.INK)
	var note := "Wren left me the stall, a scope, a shoebox and this notebook. Customers come to the counter with something dead. Fix it, don't burn it.\n\nPin a ticket, build, power on, and watch the band."
	S.text(self, f, note, lp + Vector2(0, 124), 24, Color(S.INK, 0.85), HORIZONTAL_ALIGNMENT_LEFT, half - 130)
	# a little doodled LED with rays
	var dc := r.position + Vector2(half * 0.5, r.size.y - 190)
	draw_arc(dc, 40, PI, TAU, 16, Color(S.INK, 0.8), 3.0); draw_line(dc + Vector2(-40, 0), dc + Vector2(40, 0), Color(S.INK, 0.8), 3.0)
	draw_line(dc + Vector2(-14, 0), dc + Vector2(-14, 56), Color(S.INK, 0.8), 3.0); draw_line(dc + Vector2(14, 0), dc + Vector2(14, 44), Color(S.INK, 0.8), 3.0)
	for i in 5: var ang := PI * (1.15 + 0.175 * i); draw_line(dc + Vector2(cos(ang), sin(ang)) * 56, dc + Vector2(cos(ang), sin(ang)) * 80, Color(S.AMBER.darkened(0.1)), 4.0)
	S.text(self, f, ("in the tin:  %s" % wallet_text) if wallet_text != "" else ("coins in the tin:  %d" % wallet), r.position + Vector2(56, r.size.y - 60), 28, S.INK)
	# the chits, pinned on the right page
	var rp := Rect2(r.position.x + half + 30, r.position.y + 40, half - 60, r.size.y - 80)
	S.text(self, f, "tickets on the spike", rp.position + Vector2(10, 30), 26, Color(S.INK, 0.7))
	var cw := rp.size.x * 0.46; var ch := 208.0
	for i in tickets.size():
		var tk: Dictionary = tickets[i]
		var col := i % 2; var row := i / 2
		var pos := rp.position + Vector2(10 + col * (cw + 22) + (i % 3) * 5, 56 + row * (ch + 30) + (col * 14))
		var cr := Rect2(pos, Vector2(cw, ch))
		var open: bool = tk.open
		var hv := _btn(cr, "ticket", str(tk.id)) if open else false
		var lift := -6.0 if hv else 0.0
		var rot: float = [-2.4, 1.8, -1.2, 2.6, -2.0][i % 5]
		var tint := Color("#fff5d6") if open else Color("#d9d2bd")
		S.paper(self, Rect2(cr.position + Vector2(0, lift), cr.size), rot, tint)
		draw_set_transform(cr.get_center() + Vector2(0, lift), deg_to_rad(rot), Vector2.ONE)
		var q := Rect2(-cr.size * 0.5, cr.size)
		S.pin(self, q.position + Vector2(q.size.x * 0.5, 12), Color("#d23a2e") if open else Color("#7a7f86"))
		S.text(self, f, "%s%s" % [str(tk.id), "  EB" if str(tk.id) == "1-5" else ""], q.position + Vector2(14, 48), 18, S.INK_RED)
		var tsz := 32   # a long title shrinks to fit the chit instead of running into the corner tags
		while tsz > 18 and S.tw(f, str(tk.title), tsz) > q.size.x - 28.0: tsz -= 2
		S.text(self, f, str(tk.title), q.position + Vector2(14, 84), tsz, S.INK if open else Color(S.INK, 0.5))
		S.text(self, f, "for %s" % str(tk.customer), q.position + Vector2(14, 112), 20, Color(S.INK, 0.8 if open else 0.4))
		S.text(self, f, str(tk.spec), q.position + Vector2(14, 136), 17, Color(S.INK, 0.9 if open else 0.4), HORIZONTAL_ALIGNMENT_LEFT, q.size.x - 26)
		var pay := str(tk.get("pay_text", ""))
		if open and pay != "": S.text(self, f, pay, q.position + Vector2(14, q.size.y - 12), 14, Color(S.INK, 0.6))
		var fee: String = str(tk.get("price_text", "")) if str(tk.get("price_text", "")) != "" else "%d coins" % int(tk.price)
		S.text(self, f, fee, q.position + Vector2(q.size.x - 20 - S.tw(f, fee, 17), 48), 17, Color(S.INK, 0.7))
		if int(tk.get("stars", 0)) > 0 or tk.done:
			var smax := int(tk.get("stars_max", 2)); var got := int(tk.get("stars", 0))
			S.text(self, f, "*".repeat(got) + ".".repeat(maxi(0, smax - got)), q.position + Vector2(118, 52), 30, S.INK_RED)
		if tk.done and hv: S.text(self, f, "tap to replay: better stars, lower cost", q.position + Vector2(14, q.size.y - 32), 15, S.INK_RED)
		elif tk.done and str(tk.get("best_text", "")) != "": S.text(self, f, str(tk.best_text), q.position + Vector2(14, q.size.y - 32), 15, Color(S.INK, 0.7))
		if tk.done:
			draw_set_transform(cr.get_center() + Vector2(cr.size.x * 0.27, cr.size.y * 0.02), deg_to_rad(-12), Vector2.ONE)
			S.rr_line(self, Rect2(-52, -20, 104, 40), 6, Color(0.1, 0.55, 0.2, 0.9), 3.5); S.text(self, f, "FIXED", Vector2(-36, 10), 26, Color(0.1, 0.55, 0.2, 0.9))
		elif not open:
			S.text(self, f, "locked", q.position + Vector2(q.size.x - 20 - S.tw(f, "locked", 18), 112), 18, Color(S.INK, 0.45))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		if hv: S.rr_line(self, Rect2(cr.position + Vector2(-3, lift - 3), cr.size + Vector2(6, 6)), 4, Color("#ffd98a", 0.85), 3.0)
	# back to the title
	var br := Rect2(r.end.x - 230, r.end.y - 62, 190, 44)
	var bh := _btn(br, "goto:title")
	S.text(self, f, "<  back to the sign", br.position + Vector2(0, 30), 22, S.INK if bh else Color(S.INK, 0.6))

## ------------------------------------------------------------------------------------------------------------------ Wren's notebook

func _notebook(a: float) -> void:
	var w := size.x; var h := size.y
	var r := Rect2(w * 0.5 - 740, h * 0.5 - 410 + (1.0 - a) * 30, 1480, 820)
	r = r.intersection(Rect2(20, 20, w - 40, h - 40))
	_open_book(r, a * 0.8)
	var half := r.size.x * 0.5; var f := S.hand()
	# left page: this ticket's coach steps with ticks; the current one is circled
	var lp := r.position + Vector2(60, 66)
	var tk := coach_ticket
	S.text(self, f, "TICKET %s" % str(tk.get("id", "")), lp + Vector2(0, -6), 20, S.INK_RED)
	S.text(self, f, "%s,  for %s" % [str(tk.get("title", "")), str(tk.get("customer", ""))], lp + Vector2(0, 40), 44, S.INK)
	S.text(self, f, str(tk.get("brief", "")), lp + Vector2(0, 80), 22, Color(S.INK, 0.8), HORIZONTAL_ALIGNMENT_LEFT, half - 120)
	var y := lp.y + 190.0
	for i in coach_steps.size():
		var st: Dictionary = coach_steps[i]
		if st.get("target", "") == "none" or (i < coach_vis.size() and not coach_vis[i]): continue
		var txt := str(st.text); var fs := 22
		var hh := S.wrapped_h(f, txt, fs, half - 170) + 8.0
		if y + hh > r.end.y - 90: break
		var isd: bool = i < coach_done.size() and coach_done[i]
		var cur := i == coach_cur
		draw_rect(Rect2(lp.x - 8, y - 22, 5, hh), Color(S.AMBER, 0.0 if not cur else 0.9), true)
		var bx := Vector2(lp.x + 14, y - 6)
		draw_rect(Rect2(bx - Vector2(12, 12), Vector2(24, 24)), Color(S.INK, 0.12), true); S.rr_line(self, Rect2(bx - Vector2(12, 12), Vector2(24, 24)), 3, Color(S.INK, 0.8), 2.0)
		if isd: draw_polyline(PackedVector2Array([bx + Vector2(-8, 0), bx + Vector2(-2, 8), bx + Vector2(12, -12)]), S.INK_RED, 4.0, true)
		S.text(self, f, txt, Vector2(lp.x + 46, y), fs, Color(S.INK, 1.0 if cur else (0.5 if isd else 0.78)), HORIZONTAL_ALIGNMENT_LEFT, half - 170)
		y += hh + 14.0
	# right page: Codex
	var rp := r.position + Vector2(half + 60, 66)
	S.text(self, f, "CODEX", rp + Vector2(0, -6), 20, S.INK_RED)
	var e: Dictionary = CoachData.CODEX[clampi(codex_i, 0, CoachData.CODEX.size() - 1)]
	S.text(self, f, str(e.title), rp + Vector2(0, 46), 38, S.INK, HORIZONTAL_ALIGNMENT_LEFT, half - 120)
	var eq := Rect2(rp + Vector2(0, 100), Vector2(half - 120, 66))
	S.rr(self, eq, 6, Color(S.INK, 0.07)); S.rr_line(self, eq, 6, Color(S.INK, 0.35), 2.0)
	S.text(self, S.mono(), str(e.eq), eq.position + Vector2(24, 44), 36, S.INK)
	S.text(self, f, str(e.body), rp + Vector2(0, 214), 24, Color(S.INK, 0.9), HORIZONTAL_ALIGNMENT_LEFT, half - 120)
	for i in CoachData.CODEX.size():   # index tabs down the right edge
		var tr := Rect2(r.end.x - 22, r.position.y + 60 + i * 66, 44, 56)
		var hv := _btn(tr, "codex", str(i))
		var cur2 := i == codex_i
		S.rr(self, tr, 8, [Color("#d9663f"), Color("#e0b43f"), Color("#4f9a6a"), Color("#4a7fb5"), Color("#9a5fb0")][i % 5].lightened(0.1 if hv or cur2 else -0.1))
		S.text(self, f, str(i + 1), tr.position + Vector2(24, 36), 26, Color("#fff8e0"))
	# footer buttons, handwritten
	var fy := r.end.y - 58.0
	var items := [["close", "back to the bench", 0.0], ["goto:map", "ticket pages", 0.0], ["goto:title", "title", 0.0], ["settings", "settings", 0.0]]
	var x := r.position.x + 60.0
	for it in items:
		var wd := S.tw(f, it[1], 24) + 36.0
		var br := Rect2(x, fy - 26, wd, 42)
		var hv := _btn(br, it[0])
		S.rr(self, br, 20, Color(S.INK, 0.14 if hv else 0.06)); S.rr_line(self, br, 20, Color(S.INK, 0.7 if hv else 0.35), 2.0)
		S.text(self, f, it[1], br.position + Vector2(18, 29), 24, S.INK)
		x += wd + 16.0

## ------------------------------------------------------------------------------------------------------------------ exam slip (predict before building)

func _predict(a: float) -> void:
	var w := size.x; var h := size.y; var f := S.hand()
	draw_rect(Rect2(0, 0, w, h), Color(0.02, 0.01, 0.02, 0.45 * a), true)
	var fig: Dictionary = coach_ticket.get("figure", {}) if coach_ticket.get("figure", null) is Dictionary else {}
	var wide := not fig.is_empty()
	var sz := Vector2(1000, 640) if wide else Vector2(720, 520)
	sz = Vector2(minf(sz.x, w - 24.0), minf(sz.y, h - 24.0))
	var r := Rect2(w * 0.5 - sz.x * 0.5, h * 0.5 - sz.y * 0.5 + (1.0 - a) * 24, sz.x, sz.y)
	S.paper(self, r, -0.8, S.PAPER)
	draw_set_transform(r.get_center(), deg_to_rad(-0.8), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.pin(self, q.position + Vector2(q.size.x * 0.5, 16))
	S.text(self, f, "%s  \u00b7  predict first" % str(coach_ticket.get("title", "Exam")), q.position + Vector2(36, 70), 40, S.INK)
	var col_w := (q.size.x * 0.46) if wide else (q.size.x - 72.0)
	# the problem, as printed on the exam card: its words, and (right) its figure
	S.text(self, f, str(coach_ticket.get("brief", "")), q.position + Vector2(36, 106), 19, Color(S.INK, 0.85), HORIZONTAL_ALIGNMENT_LEFT, col_w)
	if wide:
		var fr := Rect2(q.position.x + q.size.x * 0.52, q.position.y + 96, q.size.x * 0.44, q.size.y - 200.0)
		S.rr_line(self, fr, 6, Color(S.INK, 0.35), 2.0)
		S.text(self, f, "Fig. 1", fr.position + Vector2(10, 22), 16, Color(S.INK, 0.6))
		ExamFigure.draw(self, fr.grow(-10), fig, S.INK, ["V(%s)" % str(fig.get("node", "A")), "I(E2)"])
		S.text(self, f, "ideal sources, exact resistors", Vector2(fr.position.x + 10, fr.end.y - 8), 14, Color(S.INK, 0.5))
	var y := q.position.y + (q.size.y * 0.5 - 40.0 if wide else 200.0)
	for i in pred_fields.size():
		var pf: Dictionary = pred_fields[i]
		S.text(self, f, str(pf.name), Vector2(q.position.x + 36, y), 19, Color(S.INK, 0.85), HORIZONTAL_ALIGNMENT_LEFT, col_w)
		var lh := S.wrapped_h(f, str(pf.name), 19, col_w)
		var box := Rect2(q.position.x + 36, y + lh - 8, minf(320.0, col_w - 90.0), 50)
		var hv := _btn(Rect2(r.get_center() + box.position, box.size), "pred_focus", str(i))
		var cur := i == pred_focus
		S.rr(self, box, 8, Color(S.INK, 0.08)); S.rr_line(self, box, 8, Color(S.INK, 0.85 if cur else (0.5 if hv else 0.3)), 3.0 if cur else 2.0)
		var txt := str(pf.text)
		S.text(self, S.mono(), txt, box.position + Vector2(14, 36), 30, S.INK)
		if cur and fmod(t, 1.0) < 0.6: draw_rect(Rect2(box.position.x + 16 + S.tw(S.mono(), txt, 30), box.position.y + 10, 3, 30), S.INK, true)
		S.text(self, f, str(pf.unit), box.position + Vector2(box.size.x + 12, 36), 28, S.INK)
		if pf.get("done", false): S.text(self, f, "recorded", box.position + Vector2(box.size.x + 52, 36), 18, S.INK_RED)
		y += lh + 78.0
	var ok_r := Rect2(q.position.x + 36, q.end.y - 78, 200, 50)
	var oh := _btn(Rect2(r.get_center() + ok_r.position, ok_r.size), "pred_submit")
	S.rr(self, ok_r, 25, S.INK if oh else Color(S.INK, 0.85)); S.text(self, f, "lock in", ok_r.position + Vector2(46, 36), 30, S.PAPER)
	var cl := Rect2(q.position.x + 262, q.end.y - 78, 150, 50)
	var ch := _btn(Rect2(r.get_center() + cl.position, cl.size), "pred_close")
	S.rr_line(self, cl, 25, Color(S.INK, 0.7 if ch else 0.4), 2.0); S.text(self, f, "later", cl.position + Vector2(44, 36), 26, S.INK)
	var hint := "type digits, Tab switches line, Enter locks in.  \"later\" keeps this slip on the bench: tap it to reopen."
	S.text(self, f, hint, Vector2(q.position.x + 36, q.end.y - 12), 14, Color(S.INK, 0.55))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

## ------------------------------------------------------------------------------------------------------------------ settings

func _settings(a: float) -> void:
	var w := size.x; var h := size.y; var f := S.hand()
	draw_rect(Rect2(0, 0, w, h), Color(0.02, 0.01, 0.02, 0.5 * a), true)
	var r := Rect2(w * 0.5 - 330, h * 0.5 - 300 + (1.0 - a) * 24, 660, 600)
	S.paper(self, r, -1.0, S.PAPER)
	draw_set_transform(r.get_center(), deg_to_rad(-1.0), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.pin(self, q.position + Vector2(q.size.x * 0.5, 16))
	S.text(self, f, "Settings", q.position + Vector2(36, 80), 52, S.INK)
	var rows := [["cute", "Cute mode", cute, "critters for current, faces on LEDs, Rezzy reacts"], ["reduced", "Reduced motion", reduced, "less shimmer, rain and smoke"], ["sound", "Sound", sound, "relay click, chime, ka-ching"]]
	var y := q.position.y + 150.0
	for rw in rows:
		var rr := Rect2(q.position.x + 30, y - 34, q.size.x - 60, 74)
		var tr_abs := Rect2(r.get_center() + rr.position, rr.size)   # buttons live in screen space (rotation is tiny; the hit boxes are generous)
		var hv := _btn(tr_abs, "toggle:" + rw[0])
		S.text(self, f, rw[1], Vector2(rr.position.x + 10, y + 6), 32, S.INK)
		S.text(self, f, rw[3], Vector2(rr.position.x + 10, y + 34), 17, Color(S.INK, 0.6))
		var sw := Rect2(rr.end.x - 120, y - 16, 100, 44)
		S.rr(self, sw, 22, Color("#3f8f5a") if rw[2] else Color("#8a8d92")); draw_circle(Vector2(sw.end.x - 22 if rw[2] else sw.position.x + 22, sw.get_center().y), 17, Color("#f6ecd0"))
		S.text(self, f, "on" if rw[2] else "off", Vector2(sw.position.x + (14 if rw[2] else 52), sw.position.y + 31), 22, Color("#f6ecd0"))
		if hv: S.rr_line(self, rr, 10, Color(S.INK, 0.35), 2.0)
		y += 100.0
	var vr := Rect2(q.position.x + 40, y - 20, q.size.x - 80, 40)
	S.text(self, f, "Volume", vr.position + Vector2(0, 8), 28, S.INK)
	var bar := Rect2(vr.position.x + 150, vr.position.y + 6, 260, 14)
	S.rr(self, bar, 7, Color(S.INK, 0.2)); S.rr(self, Rect2(bar.position, Vector2(bar.size.x * volume, bar.size.y)), 7, S.INK)
	var mb := Rect2(r.get_center() + Vector2(vr.position.x + 440, vr.position.y), Vector2(44, 44)); var pb := Rect2(mb.position + Vector2(56, 0), Vector2(44, 44))
	_btn(mb, "vol-"); _btn(pb, "vol+")
	S.text(self, f, "-", vr.position + Vector2(452, 28), 40, S.INK); S.text(self, f, "+", vr.position + Vector2(504, 30), 40, S.INK)
	var done_r := Rect2(r.get_center() + Vector2(-80, q.end.y - 84), Vector2(160, 52))
	var dh := _btn(done_r, "close")
	S.rr(self, Rect2(Vector2(-80, q.end.y - 84), Vector2(160, 52)), 26, S.INK if dh else Color(S.INK, 0.85)); S.text(self, f, "done", Vector2(-34, q.end.y - 46), 32, S.PAPER)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
