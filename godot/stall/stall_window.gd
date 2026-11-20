class_name StallWindow
extends Control
## The strip window at the top of the stall: Lantern Lane at night (or dusk on the title) through a wooden frame. Everything is drawn in code:
## sky, skyline with lit windows, a flickering neon sign, sagging cables with paper lanterns, rain awnings, a tram silhouette that passes now and
## then (with a lit window row, pantograph and headlight), rain-ready streaks and droplets on the glass. The gear (settings) sits on the wall at the left.

const S = preload("res://stall/stall_style.gd")
var t := 0.0
var dusk := 0.0                ## 0 = night, 1 = dusk (title)
var rain := false
var neon_on := true
var reduced := false
var tram_period := 31.0
var tram_phase := 0.12         ## where the tram starts in its cycle (screenshots: it is visible at t = 0)
var gear_hover := false
var _skyline: Array = []
var _built_w := 0.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(true)

func _process(dt: float) -> void:
	t += dt
	queue_redraw()

func gear_rect() -> Rect2: return Rect2(14, 14, 56, 56)

func _build(w: float, h: float) -> void:
	_built_w = w; _skyline.clear()
	var rng := RandomNumberGenerator.new(); rng.seed = 14
	for layer in 3:
		var x := -20.0; var row: Array = []
		while x < w + 40.0:
			var bw := rng.randf_range(70.0, 190.0) * (1.0 + 0.2 * layer)
			var bh := rng.randf_range(0.28, 0.62) * h * (1.0 - 0.18 * layer) + (0.0 if layer == 0 else 8.0)
			var wins: Array = []
			for i in int(bw / 22.0): for j in int(bh / 24.0):
				if rng.randf() < (0.42 - 0.07 * layer): wins.append([i, j, rng.randf() < 0.25, rng.randf_range(0.0, TAU)])
			row.append({"x": x, "w": bw, "h": bh, "wins": wins, "roof": rng.randi() % 3})
			x += bw + rng.randf_range(-6.0, 12.0)
		_skyline.append(row)

func _draw() -> void:
	var w := size.x; var h := size.y
	if h < 60.0: return
	if absf(_built_w - w) > 1.0 or _skyline.is_empty(): _build(w, h)
	var f := h / 190.0
	# ---- sky
	var top := Color("#0a1030").lerp(Color("#2a2f63"), dusk); var mid := Color("#222d62").lerp(Color("#a2477a"), dusk); var low := Color("#6a3f78").lerp(Color("#f0a45f"), dusk)
	S.vgrad(self, Rect2(0, 0, w, h * 0.55), top, mid, 14); S.vgrad(self, Rect2(0, h * 0.55, w, h * 0.45), mid, low, 12)
	var rng := RandomNumberGenerator.new(); rng.seed = 99
	if dusk < 0.7:
		for i in 38: draw_circle(Vector2(rng.randf() * w, rng.randf() * h * 0.38), rng.randf_range(0.6, 1.5), Color(1, 1, 0.9, (0.25 + 0.3 * sin(t * 1.3 + float(i))) * (1.0 - dusk)))
	# ---- skyline (far -> near)
	for layer in 3:
		var shade: Color = [Color("#38437a"), Color("#262e5c"), Color("#12163a")][layer].lerp(Color("#3a2a52"), dusk * (1.0 - 0.25 * layer))
		for b in _skyline[layer]:
			var base := h * (0.86 + 0.04 * layer)
			var r := Rect2(b.x, base - b.h, b.w, b.h + 4.0)
			draw_rect(r, shade, true)
			if b.roof == 1: draw_colored_polygon(PackedVector2Array([r.position + Vector2(-4, 0), r.position + Vector2(b.w * 0.5, -b.w * 0.14), r.position + Vector2(b.w + 4, 0)]), shade.darkened(0.1))
			elif b.roof == 2: draw_rect(Rect2(r.position.x + b.w * 0.6, r.position.y - 16.0 * f, 5, 16.0 * f), shade.lightened(0.05), true)   # chimney / antenna
			for wn in b.wins:
				var col := Color("#ffcf7a") if wn[2] else Color("#ffb04d")
				var fl := 0.8 + 0.2 * sin(t * 0.9 + wn[3])
				var wr := Rect2(r.position.x + 7.0 + wn[0] * 22.0, r.position.y + 8.0 + wn[1] * 24.0, 11.0, 14.0)
				if wr.end.x < r.end.x - 4 and wr.end.y < r.end.y - 4:
					draw_rect(wr, Color(col, (0.75 - 0.15 * layer) * fl), true)
					if layer == 0: S.glow(self, wr.get_center(), 18.0, Color(col, 0.10))
	S.vgrad(self, Rect2(0, h * 0.55, w, h * 0.45), Color(1.0, 0.55, 0.25, 0.0), Color(1.0, 0.55, 0.25, 0.20 * (1.0 - dusk * 0.5)), 10)   # street lamps' glow
	draw_circle(Vector2(w * 0.08, h * 0.30), 16.0 * f, Color(1.0, 0.96, 0.8, 0.85 * (1.0 - dusk))); draw_circle(Vector2(w * 0.08 + 6 * f, h * 0.30 - 3 * f), 14.0 * f, Color(0.16, 0.2, 0.42, 0.95 * (1.0 - dusk)))
	# ---- tram
	var ph := fposmod(t / tram_period + tram_phase, 1.0)
	if ph < 0.42:
		var k := ph / 0.42
		var tx := lerpf(-w * 0.35, w * 1.1, k); var ty := h * 0.93
		_tram(Vector2(tx, ty), f)
	# ---- neon signs on the near shopfronts
	_neon(Vector2(w * 0.66, h * 0.50), "REPAIR", S.MAGENTA, 0, 36.0 * f)
	_neon(Vector2(w * 0.30, h * 0.56), "TEA", S.CYAN, 1, 32.0 * f)
	_neon(Vector2(w * 0.865, h * 0.54), "NOODLE", Color("#ffb547"), 2, 30.0 * f)
	# ---- cables
	for i in 6:
		var y0 := h * (0.06 + 0.07 * i) + float(i % 3) * 3.0; var sag := 14.0 + 7.0 * (i % 4)
		var pts := PackedVector2Array()
		for j in 33:
			var u := float(j) / 32.0
			pts.append(Vector2(u * w, y0 + sin(u * PI) * sag * f + sin(u * 11.0 + float(i)) * 1.5))
		draw_polyline(pts, Color(0.02, 0.02, 0.04, 0.9), 2.2 + float(i % 2), true)
		if i % 2 == 0:   # lanterns hanging from the cable
			for q in 5:
				var u := (0.1 + 0.19 * q + 0.03 * i) as float
				var idx := int(u * 32.0)
				if idx >= pts.size(): continue
				var a := pts[idx]; var sw := sin(t * 1.2 + float(q) + float(i)) * 3.0
				draw_line(a, a + Vector2(sw, 16 * f), Color(0.05, 0.04, 0.05), 1.5)
				var lc := a + Vector2(sw, 28 * f); var lcol := Color("#e0432e") if (q + i) % 2 == 0 else Color("#ffb547")
				S.glow(self, lc, 38.0 * f, Color(lcol, 0.3 * (1.0 - 0.5 * dusk)))
				draw_circle(lc, 11.0 * f, lcol.darkened(0.15)); draw_circle(lc, 8.0 * f, lcol.lightened(0.25))
				draw_line(lc + Vector2(-5 * f, 0), lc + Vector2(5 * f, 0), lcol.darkened(0.4), 1.0)
	# ---- awnings (left and right), striped canvas with scalloped edges
	_awning(Rect2(w * 0.56, 0, w * 0.17, h * 0.13), Color("#7b2a3a"), f, true)
	_awning(Rect2(w * 0.80, 0, w * 0.2, h * 0.13), Color("#2c5d6b"), f, true)
	_awning(Rect2(w * 0.14, 0, w * 0.2, h * 0.13), Color("#8a6a2a"), f, true)
	# ---- rain
	if rain and not reduced:
		var rr := RandomNumberGenerator.new(); rr.seed = 3
		for i in 140:
			var x := rr.randf() * w; var sp := rr.randf_range(380.0, 640.0); var y := fposmod(rr.randf() * h + t * sp, h)
			draw_line(Vector2(x, y), Vector2(x - 4, y + 16), Color(0.7, 0.85, 1.0, 0.35), 1.2)
	# ---- the window frame, glass sheen and droplets
	_frame(w, h, f)

func _neon(c: Vector2, word: String, col: Color, style: int, size: float) -> void:
	var fl := 1.0
	if neon_on:
		var ph := fposmod(t * 0.37 + float(style) * 0.31, 1.0)
		if ph > 0.93 and not reduced: fl = 0.25 + 0.75 * float(int(t * 24.0) % 2)
		fl *= 0.93 + 0.07 * sin(t * 50.0 + float(style))
	else: fl = 0.12
	var f := S.hand(); var fs := int(size)
	var tw := S.tw(f, word, fs)
	var board := Rect2(c - Vector2(tw * 0.5 + 14, size * 1.02), Vector2(tw + 28, size * 1.62))
	draw_rect(board, Color(0.02, 0.02, 0.05, 0.85), true); S.rr_line(self, board, 6.0, Color(0.25, 0.27, 0.35), 2.0)
	draw_line(Vector2(board.position.x + 10, board.position.y), Vector2(board.position.x + 10, -20), Color(0.05, 0.05, 0.08), 3.0)
	draw_line(Vector2(board.end.x - 10, board.position.y), Vector2(board.end.x - 10, -20), Color(0.05, 0.05, 0.08), 3.0)
	S.glow(self, board.get_center(), tw * 0.85, Color(col, 0.30 * fl))
	for pass_i in 3:
		var wd: int = [10, 6, 3][pass_i]
		draw_string_outline(f, c + Vector2(-tw * 0.5, size * 0.34), word, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, wd, Color(col, [0.10, 0.22, 0.5][pass_i] * fl))
	draw_string(f, c + Vector2(-tw * 0.5, size * 0.34), word, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, Color(col.lerp(Color.WHITE, 0.75), fl))

func _tram(p: Vector2, f: float) -> void:
	var bw := 360.0 * f; var bh := 66.0 * f
	var body := Rect2(p.x, p.y - bh - 10 * f, bw, bh)
	draw_line(Vector2(p.x - 200, 0), Vector2(p.x + bw + 200, 0), Color(0.03, 0.03, 0.05), 2.0)   # overhead wire
	draw_line(Vector2(p.x + bw * 0.55, 0), Vector2(p.x + bw * 0.5, body.position.y - 14 * f), Color(0.05, 0.05, 0.07), 3.0)   # pantograph
	draw_line(Vector2(p.x + bw * 0.5, body.position.y - 14 * f), Vector2(p.x + bw * 0.62, body.position.y), Color(0.05, 0.05, 0.07), 3.0)
	S.rr(self, body, 12 * f, Color("#3a3556")); S.rr(self, body.grow(-3), 10 * f, Color("#2a2640")); draw_rect(Rect2(body.position.x, body.end.y - 14 * f, bw, 14 * f), Color("#d9b24a"), true)
	for i in 9:
		var wr := Rect2(body.position.x + 20 * f + float(i) * 38 * f, body.position.y + 12 * f, 28 * f, 24 * f)
		draw_rect(wr, Color("#ffd98a"), true); S.glow(self, wr.get_center(), 34 * f, Color("#ffd98a", 0.22))
	draw_rect(Rect2(body.position.x, body.position.y + 4 * f, bw, 3 * f), Color("#c94b3b"), true)
	for wx in [0.1, 0.25, 0.75, 0.9]: draw_circle(Vector2(p.x + bw * wx, p.y - 6 * f), 8 * f, Color("#07080d"))
	S.glow(self, Vector2(p.x + bw, body.position.y + 40 * f), 80 * f, Color("#ffe9a8", 0.28))   # headlight

func _awning(r: Rect2, col: Color, f: float, scallop: bool) -> void:
	var stripes := 10; var sw := r.size.x / stripes
	var drop := r.size.y
	for i in stripes:
		var c := col if i % 2 == 0 else col.lightened(0.35).lerp(Color("#d9cdb6"), 0.25)
		var x := r.position.x + float(i) * sw
		draw_colored_polygon(PackedVector2Array([Vector2(x, r.position.y), Vector2(x + sw, r.position.y), Vector2(x + sw + 6, r.position.y + drop * 0.85), Vector2(x - 6, r.position.y + drop * 0.85)]), c.darkened(0.45))
		if scallop: draw_circle(Vector2(x + sw * 0.5, r.position.y + drop * 0.85), sw * 0.5 + 3, c.darkened(0.4))
		if rain and scallop and not reduced:   # drips off the scallops
			var dp := fposmod(t * 0.9 + float(i) * 0.37, 1.0)
			draw_line(Vector2(x + sw * 0.5, r.position.y + drop * 0.85 + sw * 0.5 + dp * 70 * f), Vector2(x + sw * 0.5, r.position.y + drop * 0.85 + sw * 0.5 + dp * 70 * f + 9), Color(0.75, 0.88, 1.0, 0.5), 2.0)
	draw_rect(Rect2(r.position.x - 6, r.position.y, r.size.x + 12, 6 * f), Color("#1b1218"), true)

func _frame(w: float, h: float, f: float) -> void:
	var wood := Color("#2a1b13"); var hi := Color("#4a3224")
	# side + top beams
	draw_rect(Rect2(0, 0, w, 8 * f), wood, true); draw_rect(Rect2(0, 0, 14 * f, h), wood, true); draw_rect(Rect2(w - 14 * f, 0, 14 * f, h), wood, true)
	draw_rect(Rect2(0, 8 * f, w, 2), hi, true)
	for x in [w * 0.5]: draw_rect(Rect2(x - 7 * f, 0, 14 * f, h), wood, true); draw_rect(Rect2(x - 7 * f, 0, 3, h), hi, true)
	# the sill: a plank with a lip, lit from the front
	var sill := Rect2(0, h - 26 * f, w, 26 * f)
	S.vgrad(self, sill, Color("#4e3626"), Color("#2c1d14"), 6)
	draw_rect(Rect2(0, h - 26 * f, w, 3), Color("#7a5a3e"), true)
	draw_rect(Rect2(0, h - 2, w, 2), Color(0, 0, 0, 0.6), true)
	# glass sheen (two diagonal soft bands) and condensation droplets
	for sx in [0.12, 0.62]:
		var x0: float = w * sx
		draw_colored_polygon(PackedVector2Array([Vector2(x0, 8 * f), Vector2(x0 + 90, 8 * f), Vector2(x0 + 30, h - 26 * f), Vector2(x0 - 60, h - 26 * f)]), Color(1, 1, 1, 0.035))
	var rng := RandomNumberGenerator.new(); rng.seed = 21
	for i in (46 if rain else 14):
		var c := Vector2(rng.randf() * w, rng.randf_range(12 * f, h - 34 * f)); var r := rng.randf_range(1.5, 3.4)
		draw_circle(c, r, Color(0.8, 0.9, 1.0, 0.16)); draw_circle(c + Vector2(-r * 0.3, -r * 0.3), r * 0.35, Color(1, 1, 1, 0.5))
	# gear: the settings handle, screwed to the wall frame
	var gc := gear_rect().get_center()
	S.glow(self, gc, 60, Color("#ffb547", 0.10 if not gear_hover else 0.3))
	S.gear(self, gc, 24.0, Color("#a9792f") if not gear_hover else Color("#e6b45a"), Color("#2a1b13"))
	# vignette so the strip sits behind the bench light
	S.vgrad(self, Rect2(0, 0, w, 22 * f), Color(0, 0, 0, 0.35), Color(0, 0, 0, 0.0), 6)
