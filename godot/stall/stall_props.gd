class_name StallProps
extends Control
## The things that live on Wren's bench, all drawn in code: tea mug (steaming), her notebook, Rezzy the cat (asleep, wakes when something is hot),
## the coin tin (the wallet), the open shoebox of parts (the bin), and the customer at the counter edge with their gadget.
## Layout rectangles come from StallScene (`L`); this node holds the animation state and only draws.

const S = preload("res://stall/stall_style.gd")

var L: Dictionary = {}          ## name -> Rect2 / Vector2 (set by the scene)
var t := 0.0
var cute := true
var hot := 0.0                  ## 0..1 hottest part
var smoked := false
var cat_look := Vector2(1, 0)   ## unit vector from Rezzy toward the hot thing
var wallet := 0
var wallet_text := ""           ## the wallet as the engine formats it ("$4.50"); empty = "%d coins"
var bench_state := "idle"       ## idle | ready | passed (the BENCH push button)
var bench_hover := false
var show_bench := false
var gadget := "torch"
var mood := "idle"              ## idle | hopeful | joy | wow (customer)
var customer := "Lio"
var items: Array = []           ## bin items: {partId, value, label, tag, kind, i}
var bin_scroll := 0.0             ## shoebox scroll, in rows (fractional while dragging)
var bin_drag := false             ## the tray is being dragged / flung: show the track
var exam_fig: Dictionary = {}          ## exam ticket: the engine's figure, drawn small on the problem card that stays on the bench
var exam_open := true                  ## false once the predictions are in (the card then reads "your predictions are in")
var exam_retry := false               ## the exam is stamped FIXED at under 3 stars: the slip says it can be sat again
var crew: Dictionary = {}              ## a ticket that asks for a worked-out number (2-2): {answers:[{id, name, unit, entered}]}, shown as the crew's slip on the bench
var all_items: Array = []       ## the whole shoebox (items is what the rating filter lets through)
var rating_filter := ""         ## "" = all, else a watt tag ("¼ W"): the shelf shows only parts with that rating
var hide_item := -1             ## the bin item being dragged
var hover_item := -1
var hover := ""                 ## notebook | tin | box | customer | cat
var notebook_flag := false      ## a fresh coach note is waiting (ribbon wiggles)
var coins: Array = []           ## flying coins {from, to, age, life}
var tin_shake := 0.0
var _awake := 0.0
var _blink := 0.0
var _item_cache: Dictionary = {}
var _cs := 1.0
var _cc := Vector2.ZERO

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE; set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); set_process(true)

func _process(dt: float) -> void:
	t += dt
	_sync_tray()
	var target := 1.0 if (hot > 0.35 or smoked) else 0.0
	_awake = move_toward(_awake, target, dt * (4.0 if target > _awake else 0.5))
	tin_shake = maxf(0.0, tin_shake - dt)
	var keep: Array = []
	for c in coins:
		c.age += dt
		if c.age < c.life: keep.append(c)
		else: tin_shake = 0.35
	coins = keep
	if fposmod(t, 4.3) < 0.12: _blink = 1.0
	_blink = maxf(0.0, _blink - dt * 8.0)
	queue_redraw()

func fly_coin(from: Vector2, count := 6) -> void:
	for i in count: coins.append({"from": from + Vector2(randf_range(-20, 20), randf_range(-10, 10)), "age": -float(i) * 0.09, "life": 0.9})

func _r(n: String) -> Rect2: return L.get(n, Rect2())

## The exam problem card: it stays on the bench after "later", with the figure on it. Tap it (or press P) to open the predict slip again.
func _exam_card() -> void:
	var r := _r("exam")
	if exam_fig.is_empty() and not crew.is_empty() and r.size != Vector2.ZERO: _crew_slip(r); return
	if exam_fig.is_empty() or r.size == Vector2.ZERO: return
	var c := r.get_center(); var hv: bool = hover == "exam"
	var lift := -6.0 if hv else 0.0
	S.shadow(self, Rect2(r.position + Vector2(0, lift), r.size), 6, Vector2(6, 9), 0.4)
	S.paper(self, Rect2(r.position + Vector2(0, lift), r.size), 2.0, Color("#fbf6e4"))
	draw_set_transform(c + Vector2(0, lift), deg_to_rad(2.0), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.pin(self, q.position + Vector2(q.size.x * 0.5, 11), Color("#3a6fb0"))
	S.text(self, S.hand(), "EXAM SLIP", q.position + Vector2(12, 36), 16, S.INK_RED)
	ExamFigure.draw(self, Rect2(q.position + Vector2(6, 42), Vector2(q.size.x - 12, q.size.y - 82)), exam_fig, S.INK, [], true)
	S.text(self, S.hand(), "tap: marks, try again" if exam_retry else ("tap: open the slip" if not exam_open else "tap to predict"), q.position + Vector2(12, q.size.y - 12), 15, Color(S.INK_RED if exam_retry else S.INK, 0.8))
	if hv: S.rr_line(self, q.grow(3), 5, Color("#ffd98a", 0.9), 3.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

## The crew's slip (2-2): the foreman's note with the line the player fills in. Tap it (or press P) to write the distance.
func _crew_slip(r: Rect2) -> void:
	var c := r.get_center(); var hv: bool = hover == "exam"
	var lift := -6.0 if hv else 0.0
	S.shadow(self, Rect2(r.position + Vector2(0, lift), r.size), 6, Vector2(6, 9), 0.4)
	S.paper(self, Rect2(r.position + Vector2(0, lift), r.size), -2.0, Color("#f7f0d6"))
	draw_set_transform(c + Vector2(0, lift), deg_to_rad(-2.0), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.pin(self, q.position + Vector2(q.size.x * 0.5, 11), Color("#c9533d"))
	S.text(self, S.hand(), "CREW'S SLIP", q.position + Vector2(12, 36), 16, S.INK_RED)
	S.text(self, S.hand(), "Where do we dig?", q.position + Vector2(12, 66), 18, S.INK)
	var a: Dictionary = (crew.answers as Array)[0] if (crew.get("answers", []) as Array).size() > 0 else {}
	var entered = a.get("entered", null)
	var line := Rect2(q.position.x + 12, q.position.y + 96, q.size.x - 24, 44)
	S.rr(self, line, 6, Color(S.INK, 0.07)); S.rr_line(self, line, 6, Color(S.INK, 0.5 if entered != null else 0.3), 2.0)
	var txt: String = "%s m" % EngineBench._g(float(entered), 6) if entered != null else "___ m"
	S.text(self, S.mono(), txt, line.position + Vector2(10, 32), 26, S.INK)
	var fml := str(a.get("formula", "X = R (100 - l) / l"))   # the engine's formula follows which side of the junction C the plug R is wired on
	if S.handheld:   # 16 screen px text is too wide for two fixed lines: one wrapped note, and the slip itself is the tap target
		S.text(self, S.hand(), fml, Vector2(q.position.x + 12, q.position.y + 162), 16, Color(S.INK, 0.8), HORIZONTAL_ALIGNMENT_LEFT, q.size.x - 24)
	else:
		S.text(self, S.hand(), fml + ",", q.position + Vector2(12, 166), 16, Color(S.INK, 0.8))
		S.text(self, S.hand(), "then 0.1 ohm per metre", q.position + Vector2(12, 186), 16, Color(S.INK, 0.8))
		S.text(self, S.hand(), "tap: write the distance" if entered == null else "tap: change it", q.position + Vector2(12, q.size.y - 10), 15, Color(S.INK, 0.8))
	if hv: S.rr_line(self, q.grow(3), 5, Color("#ffd98a", 0.9), 3.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw() -> void:
	if L.is_empty(): return
	_mug(); _box(); _chips(); _cat(); _notebook(); _tin()
	if show_bench: _bench_button()
	_customer()
	_exam_card()
	for c in coins:
		if c.age < 0.0: continue
		var k: float = c.age / c.life
		var to := _r("tin").get_center()
		var p: Vector2 = c.from.lerp(to, k * k * (3.0 - 2.0 * k)) + Vector2(0, -sin(k * PI) * 160.0)
		S.glow(self, p, 26.0, Color(1, 0.85, 0.3, 0.35))
		_coin(p, 13.0, 0.4 + 0.6 * absf(cos(k * 14.0)))

## ------------------------------------------------------------------------------------------------------------------ mug

func _mug() -> void:
	var c: Vector2 = L.get("mug", Vector2(90, 250)); var r := 46.0
	draw_circle(c + Vector2(8, 12), r + 4, Color(0, 0, 0, 0.35))
	S.rr(self, Rect2(c.x + r - 8, c.y - 14, 34, 28), 12, Color("#d9d1bd")); S.rr(self, Rect2(c.x + r + 2, c.y - 8, 20, 16), 8, Color("#2c1f17"))   # handle
	draw_circle(c, r, Color("#e8e0cc")); draw_circle(c, r - 4, Color("#cfc6b0"))
	draw_arc(c, r - 2, 0, TAU, 40, Color("#3d5d80"), 4.0)
	draw_circle(c, r - 10, Color("#5a2c10")); draw_circle(c + Vector2(-3, -4), r - 16, Color("#7d4118")); draw_circle(c + Vector2(-8, -10), r - 30, Color("#8f5222"))
	draw_arc(c, r - 14, 3.6, 5.0, 10, Color(1, 0.9, 0.7, 0.45), 3.0)
	if _awake < 0.99 or true:   # steam drifts up
		for i in 3:
			var ph := fposmod(t * 0.35 + float(i) * 0.33, 1.0)
			var pts := PackedVector2Array()
			for j in 12:
				var u := float(j) / 11.0
				pts.append(c + Vector2(sin(u * 5.0 + ph * 6.0 + float(i)) * 10.0 * u, -u * 62.0 - ph * 24.0 - 4.0))
			draw_polyline(pts, Color(1, 1, 1, 0.16 * (1.0 - ph)), 6.0 - 3.0 * ph, true)

## ------------------------------------------------------------------------------------------------------------------ notebook

func _notebook() -> void:
	var r := _r("notebook")
	var c := r.get_center()
	draw_set_transform(c, deg_to_rad(-5.0), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.shadow(self, q, 8, Vector2(8, 12), 0.5)
	for i in 4: draw_rect(Rect2(q.position + Vector2(5 + i, 6 + i), q.size - Vector2(0, 0)), Color("#e9dfc4").darkened(0.05 * i), true)   # page block edge
	S.rr(self, q, 8, Color("#26453c")); S.rr(self, q.grow(-5), 6, Color("#2f5a4d"))
	S.vgrad(self, q.grow(-5), Color(1, 1, 1, 0.08), Color(0, 0, 0, 0.12), 8)
	draw_rect(Rect2(q.position.x + 28, q.position.y, 10, q.size.y), Color("#1d352e"), true)    # spine groove
	draw_rect(Rect2(q.position.x + 24, q.position.y, 3, q.size.y), Color(1, 1, 1, 0.1), true)
	draw_rect(Rect2(q.end.x - 54, q.position.y, 11, q.size.y), Color("#8a2f27"), true)         # elastic band
	draw_rect(Rect2(q.end.x - 54, q.position.y, 3, q.size.y), Color(1, 1, 1, 0.15), true)
	for cc in [q.position, Vector2(q.end.x, q.position.y), Vector2(q.position.x, q.end.y), q.end]:
		draw_circle(cc + Vector2(signf(-cc.x) * 0.0, 0.0), 0.0, Color.BLACK)
	var lab := Rect2(q.position.x + 60, q.position.y + 28, 118, 76)
	S.paper(self, lab, 2.0, S.PAPER, false, Transform2D(deg_to_rad(-5.0), c))
	S.text(self, S.hand(), "Wren's", lab.position + Vector2(18, 32), 22, S.INK)
	S.text(self, S.hand(), "notebook", lab.position + Vector2(10, 58), 24, S.INK)
	if notebook_flag:   # a ribbon bookmark that wiggles when Wren has left a note
		var w := sin(t * 5.0) * 3.0
		draw_colored_polygon(PackedVector2Array([Vector2(q.end.x - 90 + w, q.end.y - 4), Vector2(q.end.x - 64 + w, q.end.y - 4), Vector2(q.end.x - 64 + w, q.end.y + 34), Vector2(q.end.x - 77 + w, q.end.y + 24), Vector2(q.end.x - 90 + w, q.end.y + 34)]), Color("#d23a2e"))
	if hover == "notebook": S.rr_line(self, q.grow(2), 8, Color("#ffd98a", 0.8), 3.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

## ------------------------------------------------------------------------------------------------------------------ Rezzy

func _cat() -> void:
	var r := _r("cat"); var c := r.get_center()
	var br := 1.0 + 0.018 * sin(t * (1.3 + 2.2 * _awake))
	var s := r.size.x / 200.0
	draw_set_transform(c, 0.0, Vector2(s, s))
	var fur := Color("#8a7d70"); var dark := Color("#4d443c"); var pale := Color("#d9cdbb")
	draw_set_transform(c + Vector2(6 * s, 12 * s), 0.0, Vector2(s, s))
	draw_circle(Vector2.ZERO, 0.0, Color.BLACK)
	_ellipse(Vector2(0, 0), Vector2(92, 56), Color(0, 0, 0, 0.35))
	draw_set_transform(c, 0.0, Vector2(s * br, s * br))
	# tail curls around the body, swishing when awake
	var sw := sin(t * (2.0 + 6.0 * _awake)) * (0.05 + 0.2 * _awake)
	var tail := PackedVector2Array()
	for i in 20:
		var u := float(i) / 19.0; var a := PI * (0.15 + 1.05 * u) + sw
		tail.append(Vector2(cos(a) * 82 * (1.0 + 0.1 * u), sin(a) * 56 * (1.0 + 0.1 * u)) + Vector2(0, 0))
	draw_polyline(tail, dark, 15.0, true); draw_polyline(tail, fur, 11.0, true)
	_ellipse(Vector2(0, 0), Vector2(84, 52), fur)                                   # body
	for i in 5:   # tabby stripes
		var x := -50.0 + float(i) * 25.0
		draw_arc(Vector2(x, 0), 22, 0.4, 2.7, 8, dark, 5.0)
	_ellipse(Vector2(-10, 14), Vector2(48, 22), fur.lightened(0.08))
	# head, toward the left; turns to look at the hot thing when awake
	var look := cat_look * 12.0 * _awake
	var hc := Vector2(-70, -4) + look * 0.5
	for sgn in [-1.0, 1.0]:   # ears
		var ear := PackedVector2Array([hc + Vector2(sgn * 8, -22), hc + Vector2(sgn * 28, -44 - 8 * _awake), hc + Vector2(sgn * 34, -12)])
		draw_colored_polygon(ear, dark); draw_colored_polygon(PackedVector2Array([hc + Vector2(sgn * 13, -22), hc + Vector2(sgn * 26, -38 - 7 * _awake), hc + Vector2(sgn * 29, -15)]), Color("#e8a0a0"))
	draw_circle(hc, 36, dark); draw_circle(hc, 33, fur)
	draw_circle(hc + Vector2(0, 14) + look * 0.3, 17, pale)
	for sgn in [-1.0, 1.0]:
		var ec := hc + Vector2(sgn * 15, -3) + look * 0.35
		if _awake < 0.3 or _blink > 0.5:   # closed: a happy curved line
			draw_arc(ec + Vector2(0, 2), 8, 0.2, PI - 0.2, 8, Color("#2a221c"), 3.0)
		else:
			var rad := 9.5 + 2.5 * _awake
			draw_circle(ec, rad, Color("#e8d46a")); draw_circle(ec + look * 0.35, rad * (0.4 if smoked else 0.55), Color("#15110c"))
			draw_circle(ec + Vector2(-2, -3), 2.3, Color(1, 1, 1, 0.9))
	draw_circle(hc + Vector2(0, 8) + look * 0.3, 4.0, Color("#d98a8a"))
	for sgn in [-1.0, 1.0]: draw_line(hc + Vector2(sgn * 8, 11), hc + Vector2(sgn * 34, 6 + sgn * 3), Color(1, 1, 1, 0.55), 1.3); draw_line(hc + Vector2(sgn * 8, 14), hc + Vector2(sgn * 33, 17), Color(1, 1, 1, 0.55), 1.3)
	# collar with a resistor-band tag: brown black red
	draw_arc(hc + Vector2(30, 6), 22, -1.0, 1.3, 10, Color("#b2261c"), 6.0)
	var tg := hc + Vector2(36, 28)
	S.rr(self, Rect2(tg - Vector2(14, 7), Vector2(28, 14)), 6, Color("#d9cdbb"))
	for i in 3: draw_rect(Rect2(tg.x - 9 + i * 7, tg.y - 7, 3.5, 14), [Color("#7a3b12"), Color("#16110e"), Color("#d02a1c")][i], true)
	# paws tucked in front
	_ellipse(Vector2(-44, 36), Vector2(20, 11), fur.lightened(0.12)); _ellipse(Vector2(-18, 41), Vector2(18, 10), fur.lightened(0.12))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if _awake < 0.3:   # zZ
		for i in 3:
			var u := fposmod(t * 0.45 + float(i) * 0.33, 1.0)
			S.text(self, S.hand(), "z", c + Vector2(-96 + u * 30, -50 - u * 50) * s, int((16 + 12 * u) * s), Color(0.85, 0.9, 1.0, 1.0 - u))
	else:
		var wob := sin(t * 20.0) * 2.0
		S.text(self, S.hand(), "!", c + Vector2(-98, -62 + wob) * s, int(34 * s), Color("#ffd98a", clampf(_awake * 1.2, 0, 1)))
	if hover == "cat": S.text(self, S.hand(), "Rezzy", c + Vector2(-30, 74) * s, 18, Color(1, 1, 1, 0.8))

func _ellipse(c: Vector2, rad: Vector2, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 36: var a := float(i) / 36.0 * TAU; pts.append(c + Vector2(cos(a) * rad.x, sin(a) * rad.y))
	draw_colored_polygon(pts, col)

## ------------------------------------------------------------------------------------------------------------------ coin tin

## The BENCH push button: a black plate with a big green key. It pulses when the band is locked, and stays lit once the bench passed.
func _bench_button() -> void:
	var r := _r("bench")
	if r.size == Vector2.ZERO: return
	S.shadow(self, r, 10, Vector2(6, 9), 0.5)
	S.rr(self, r, 10, Color("#14161a")); S.rr(self, r.grow(-3), 8, Color("#2a2d33"))
	var key := Rect2(r.position.x + 8, r.position.y + 8, 78, r.size.y - 16)
	var lit := bench_state != "idle"
	var pulse := 0.6 + 0.4 * sin(t * 6.0) if bench_state == "ready" else 1.0
	S.rr(self, key, 8, Color("#1c5a32").lerp(Color("#3fd47a"), (pulse if lit else 0.0) * 0.8))
	S.rr(self, key.grow(-4), 6, Color("#2e8a50").lerp(Color("#7bf0a4"), (pulse if lit else 0.0) * 0.7))
	if lit: S.glow(self, key.get_center(), 70.0, Color("#3fd47a", 0.3 * pulse))
	S.text(self, S.hand(), "GO", Vector2(key.position.x + 20, key.position.y + key.size.y * 0.66), 26, Color("#082612"))
	S.text(self, S.hand(), "BENCH TEST", Vector2(r.position.x + 96, r.position.y + 28), 22, Color("#e8e0c8"))
	S.text(self, S.hand(), "checks every condition" if bench_state != "passed" else "passed - paid", Vector2(r.position.x + 96, r.position.y + 49), 15, Color("#e8e0c8", 0.6))
	if bench_hover: S.rr_line(self, r.grow(2), 10, Color("#ffd98a", 0.85), 3.0)

func _coin(c: Vector2, r: float, squash := 1.0) -> void:
	_ellipse(c + Vector2(2, 2), Vector2(r, r * squash), Color(0, 0, 0, 0.35))
	_ellipse(c, Vector2(r, r * squash), Color("#a27a24")); _ellipse(c, Vector2(r * 0.86, r * 0.86 * squash), Color("#e5b94a"))
	draw_arc(c, r * 0.55, 0.3, 2.8, 8, Color("#9a6f1a"), 1.5)

func _tin() -> void:
	var r := _r("tin"); var c := r.get_center()
	var sh := Vector2(sin(tin_shake * 60.0) * 4.0 * minf(tin_shake * 4.0, 1.0), 0)
	c += sh
	var rad := r.size.x * 0.5
	draw_circle(c + Vector2(8, 12), rad + 3, Color(0, 0, 0, 0.35))
	draw_circle(c, rad, Color("#6e7378")); draw_circle(c, rad - 3, Color("#aeb3b8")); draw_circle(c, rad - 10, Color("#23262a"))
	# coins heaped inside: one little pile per 4 coins of wallet, capped
	var n := mini(wallet / 3, 22); var rng := RandomNumberGenerator.new(); rng.seed = 5
	for i in n:
		var a := rng.randf() * TAU; var d := rng.randf() * (rad - 28.0)
		_coin(c + Vector2(cos(a), sin(a)) * d, 13.0, rng.randf_range(0.55, 1.0))
	# the lid, tipped open against the back edge, with the painted label
	draw_arc(c, rad - 2, PI * 1.1, PI * 1.9, 20, Color("#d5d9dd"), 5.0)
	var tape := Rect2(c.x - rad * 0.8, c.y + rad * 0.55, rad * 1.6, 36)
	S.paper(self, tape, -3.0, Color("#e9dfae"))
	var s := wallet_text if wallet_text != "" else ("%d coins" % wallet if wallet != 1 else "1 coin")
	S.text(self, S.hand(), s, Vector2(c.x - S.tw(S.hand(), s, 20) * 0.5, tape.position.y + 26), 20, S.INK)
	if hover == "tin": draw_arc(c, rad + 3, 0, TAU, 40, Color("#ffd98a", 0.8), 3.0)

## ------------------------------------------------------------------------------------------------------------------ shoebox (the bin)

const ROW_H := 68.0               ## one shoebox row (design px): 45 screen px at 1920x1080
static func row_h() -> float: return ROW_H * 1.2 if S.handheld else ROW_H   ## handheld: 54 screen px, a finger-sized target with 16 px text

## The shoebox is a scrollable list: one row per part (value + watt rating on one line, price and stock under it). `scroll` is in ROWS and may be fractional
## (wheel, drag and touch scroll smoothly). A slot is Rect2() when it is entirely outside the visible window `inner`; a partly visible row is returned whole
## (the tray clips it), so hit tests must also check `inner.has_point`.
static func slots(inner: Rect2, n: int, scroll: float) -> Array:
	var out: Array = []
	for i in n:
		var rh := row_h(); var y := inner.position.y + (float(i) - scroll) * rh
		if y + rh <= inner.position.y or y >= inner.end.y: out.append(Rect2()); continue
		out.append(Rect2(inner.position.x + 2, y + 2, inner.size.x - 4, rh - 4))
	return out

## The visible window of the tray: the box's inside, above the front lip and its PARTS label.
func box_inner() -> Rect2:
	var r := _r("box").grow(-22)
	var top := chip_h() if not rating_tags().is_empty() else 0.0   # the rating chips sit in a row above the rows
	return Rect2(r.position + Vector2(0, top), Vector2(r.size.x, maxf(row_h(), r.size.y - 44.0 - top)))

## ---- the rating filter: chips (all / ¼ W / ½ W / 1 W / 5 W) above the rows, only when the shoebox holds more than one rating
const TAG_ORDER := ["¼ W", "½ W", "1 W", "5 W"]
static func chip_h() -> float: return 46.0 if S.handheld else 34.0
func rating_tags() -> Array:
	var seen := {}
	for it in all_items: if str(it.get("tag", "")) != "" and it.kind == "R": seen[str(it.tag)] = true
	if seen.size() < 2: return []
	var out: Array = []
	for t in TAG_ORDER: if seen.has(t): out.append(t)
	for t in seen: if not out.has(t): out.append(t)
	return out

## Feed the whole shoebox; `items` becomes what the active chip lets through (a stale chip that no longer exists is dropped).
func set_items(all: Array) -> void:
	all_items = all
	var tags := rating_tags()
	if rating_filter != "" and not tags.has(rating_filter): rating_filter = ""
	if rating_filter == "": items = all
	else: items = all.filter(func(it): return str(it.get("tag", "")) == rating_filter)

## Chip rectangles in screen space: [{tag, rect}] ("" = all).
func chip_rects() -> Array:
	var tags := rating_tags()
	if tags.is_empty(): return []
	var r := _r("box").grow(-22); var out: Array = []
	var x := r.position.x; var h := chip_h() - 6.0
	for t in [""] + tags:
		var lab: String = "all" if t == "" else str(t)
		var w := S.tw(S.hand(), lab, 20) + 22.0
		out.append({"tag": t, "rect": Rect2(x, r.position.y + 2.0, w, h)}); x += w + 6.0
	return out

func chip_at(sp: Vector2) -> Variant:
	for c in chip_rects(): if (c.rect as Rect2).grow(3).has_point(sp): return str(c.tag)
	return null

func _chips() -> void:
	for c in chip_rects():
		var on: bool = str(c.tag) == rating_filter
		var rc: Rect2 = c.rect
		S.rr(self, rc, rc.size.y * 0.5, Color("#ffd98a", 0.95) if on else Color(0.12, 0.09, 0.06, 0.85)); S.rr_line(self, rc, rc.size.y * 0.5, Color("#ffd98a", 0.7), 2.0)
		S.text(self, S.hand(), "all" if str(c.tag) == "" else str(c.tag), rc.position + Vector2(11, rc.size.y * 0.5 + 7), 20, S.INK if on else Color("#f6ecd0"))

## How many rows the shoebox shows at once and how far it can scroll (in rows; 0 when everything fits).
static func rows_visible(inner: Rect2) -> int: return maxi(1, int(inner.size.y / row_h()))
static func max_scroll(inner: Rect2, n: int) -> float: return maxf(0.0, float(n) - inner.size.y / row_h())
## The old paging tabs are gone (the box scrolls by drag, wheel and touch); kept so callers get two empty rects.
static func arrows(_inner: Rect2, _n: int, _scroll: float) -> Dictionary: return {"up": Rect2(), "down": Rect2()}

func _box() -> void:
	var r := _r("box"); var c := r.get_center()
	draw_set_transform(c, deg_to_rad(1.6), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.shadow(self, q, 6, Vector2(10, 14), 0.55)
	S.rr(self, q, 6, Color("#8d6a40")); S.rr(self, q.grow(-2), 5, Color("#c19a62"))
	for i in 20: draw_line(q.position + Vector2(4, 8 + i * q.size.y / 20.0), q.position + Vector2(q.size.x - 4, 8 + i * q.size.y / 20.0 + sin(float(i)) * 2.0), Color(0.4, 0.28, 0.12, 0.10), 1.5)   # corrugation
	var inn := q.grow(-18)
	S.rr(self, inn, 4, Color("#2b1f15")); S.vgrad(self, inn, Color("#18110b"), Color("#33251a"), 12)
	draw_rect(Rect2(inn.position, Vector2(inn.size.x, 14)), Color(0, 0, 0, 0.45), true)                # inside shadow of the back wall
	draw_rect(Rect2(inn.position, Vector2(12, inn.size.y)), Color(0, 0, 0, 0.3), true)
	# a few loose parts always visible in the dark gaps (resistor ends, a screw)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	_items(c)
	draw_set_transform(c, deg_to_rad(1.6), Vector2.ONE)
	# front lip and a hand-lettered label
	var lip := Rect2(q.position.x, q.end.y - 24, q.size.x, 24)
	S.rr(self, lip, 4, Color("#a98050")); draw_rect(Rect2(lip.position.x + 2, lip.position.y, lip.size.x - 4, 3), Color(1, 0.9, 0.7, 0.35), true)
	S.paper(self, Rect2(q.position.x + 60, q.end.y - 46, 130, 34), -1.5, S.PAPER, false, Transform2D(deg_to_rad(1.6), c))
	S.text(self, S.hand(), "PARTS", Vector2(q.position.x + 94, q.end.y - 22), 22, S.INK)
	# flaps
	draw_colored_polygon(PackedVector2Array([q.position, q.position + Vector2(40, 0), q.position + Vector2(0, 40)]), Color("#b58b55"))
	draw_colored_polygon(PackedVector2Array([Vector2(q.end.x, q.position.y), Vector2(q.end.x - 40, q.position.y), Vector2(q.end.x, q.position.y + 40)]), Color("#b58b55"))
	if hover == "box": S.rr_line(self, q.grow(2), 6, Color("#ffd98a", 0.8), 3.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func part_dict(it: Dictionary) -> Dictionary:
	var key := "%s|%s" % [it.partId, it.value]
	if not _item_cache.has(key):
		_item_cache[key] = NodeApi._norm_part({"uid": "bin", "partId": it.partId, "value": it.value, "kind": it.kind, "x": 0, "y": 0, "rot": 0, "flip": false, "label": it.label})
	return _item_cache[key]

func _items(_c: Vector2) -> void: pass   # the rows are drawn by the clipping tray child (_Tray), after the box

## A Control that clips to the shoebox window and draws its rows (a parent's _draw cannot be clipped to a sub-rectangle).
class _Tray extends Control:
	var props
	func _draw() -> void: if props != null: props._draw_rows(self)

var _tray: Control

func _sync_tray() -> void:
	if _tray == null:
		_tray = _Tray.new(); _tray.props = self; _tray.clip_contents = true; _tray.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(_tray)
	var inner := box_inner()
	_tray.position = inner.position; _tray.size = inner.size
	_tray.queue_redraw()

func _draw_rows(ci: Control) -> void:
	var inner := box_inner(); var n := items.size()
	var sl := slots(inner, n, bin_scroll)
	var off := -inner.position   # the tray child sits at the window's corner: draw in its local coordinates
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	for i in n:
		var g: Rect2 = sl[i]
		if g.size == Vector2.ZERO: continue
		var cell := Rect2(g.position + off, g.size)
		var it: Dictionary = items[i]
		var a := 0.28 if i == hide_item else 1.0
		var hov := i == hover_item and i != hide_item
		S.rr(ci, cell, 8, Color(1, 0.85, 0.5, 0.20) if hov else Color(1, 1, 1, 0.045))
		var pd := part_dict(it)
		var pp := 17.0 if it.kind != "BAT" else 13.0
		var org := Vector2(cell.position.x + 12.0, cell.position.y + cell.size.y * 0.5)
		if it.kind == "LED": org.x += 14.0
		PartArt.draw(ci, pd, org + (Vector2(0, -2.0) if hov else Vector2.ZERO), pp, {"lit": 0.0, "smoked": false})
		if a < 1.0: S.rr(ci, cell, 8, Color(0.12, 0.09, 0.06, 0.7))
		# the label: value and watt rating together on one line (never overlapping the price), price and stock under it; a name that is too wide steps down in size, then uses its short form
		var lx := cell.position.x + LABEL_X
		var tag := Rect2(lx - 6.0, cell.position.y + 5.0, cell.end.x - lx + 4.0, 33.0)
		var fit := label_fit(it, tag.size.x - 14.0)
		S.paper(ci, tag, 0.0, Color("#efe5c8"))
		S.text(ci, S.hand(), str(fit.text), Vector2(lx, tag.position.y + 25.0), int(fit.size), S.INK)
		var pt: String = str(it.get("price_text", ""))
		if int(it.get("left", -1)) >= 0: pt = ("%s   x%d left" % [pt, int(it.left)]).strip_edges()
		if pt != "": S.text(ci, S.hand(), pt, Vector2(lx, cell.end.y - 7.0), 18, Color("#e9dfc4", 0.9))
	_scroll_cues(ci, Rect2(Vector2.ZERO, inner.size), n)

const LABEL_X := 84.0
const LABEL_SIZE := 22
const LABEL_FLOOR := 18

## The text a shoebox row prints: the value and rating, stepped down from 22 px to 18 px, then the part's short name. {text, size, fits}. `avail` is the tag's text width.
func label_fit(it: Dictionary, avail: float) -> Dictionary:
	var lab: String = it.label if it.tag == "" or it.kind == "BAT" else "%s %s" % [it.label, it.tag]
	var f := S.hand()
	for cand in [lab, short_name(lab)]:
		var sz := LABEL_SIZE
		while sz >= LABEL_FLOOR:
			if S.tw(f, cand, sz) <= avail: return {"text": cand, "size": sz, "fits": true}
			sz -= 1
	var sh := short_name(lab)
	return {"text": sh, "size": LABEL_FLOOR, "fits": false}

## Short display names for parts whose catalogue name does not fit a shoebox row.
const SHORT := {
	"1N4148 signal diode diode": "1N4148 diode", "1N4007 rectifier diode": "1N4007 diode", "1N4733A Zener 5.1 V": "1N4733A 5.1 V",
	"BZX55C5V1 Zener 5.1 V": "BZX55C5V1", "Ideal Zener, 6 V ideal Zener": "Ideal Zener 6 V", "LM317 adjustable regulator": "LM317 adj. reg.",
}
static func short_name(s: String) -> String: return SHORT.get(s, s)

## The tin's rectangle and the coin total's tape (the tape hangs below the tin's centre).
func tin_rect_full() -> Rect2:
	var r := _r("tin"); return r.grow(3.0)
func tin_text_rect() -> Rect2:
	var r := _r("tin"); var c := r.get_center(); var rad := r.size.x * 0.5
	return Rect2(c.x - rad * 0.8, c.y + rad * 0.55, rad * 1.6, 36.0)

## Scrolling you can see: a dark fade where more parts hide and a track with a thumb on the right edge (drag the tray, use the wheel, or swipe).
func _scroll_cues(ci: Control, inner: Rect2, n: int) -> void:
	var mx := max_scroll(inner, n)
	if mx <= 0.0: return
	if bin_scroll > 0.02: S.vgrad(ci, Rect2(inner.position, Vector2(inner.size.x, 30)), Color("#120c07", 0.92), Color("#120c07", 0.0), 6)
	if bin_scroll < mx - 0.02: S.vgrad(ci, Rect2(inner.position.x, inner.end.y - 30, inner.size.x, 30), Color("#120c07", 0.0), Color("#120c07", 0.92), 6)
	var tr := Rect2(inner.end.x - 9, inner.position.y + 4, 6, inner.size.y - 8)   # the track and the thumb
	ci.draw_rect(tr, Color(1, 1, 1, 0.18), true)
	var th := maxf(34.0, tr.size.y * (inner.size.y / row_h()) / float(n))
	ci.draw_rect(Rect2(tr.position.x, tr.position.y + (tr.size.y - th) * bin_scroll / mx, tr.size.x, th), Color("#ffd98a", 0.95), true)
	if bin_scroll < mx - 0.02:   # a hint on the lower fade while there are more parts below
		var word := "more parts below"
		var plate := Rect2(inner.position.x + 4.0, inner.end.y - 31.0, inner.size.x - 18.0, 29.0)   # an opaque strip: the words never print over a part's own label
		S.rr(ci, plate, 8, Color("#120c07", 0.97)); S.rr_line(ci, plate, 8, Color("#ffd98a", 0.35), 1.2)
		S.text(ci, S.hand(), word, Vector2(plate.get_center().x - S.tw(S.hand(), word, 20) * 0.5, plate.end.y - 7.0), 20, Color("#ffd98a", 0.95))

## ------------------------------------------------------------------------------------------------------------------ customer

## The part of the customer that must stay readable: from the top of the head or hat to the bottom of the gadget in the hands, and the width of the shoulders.
static func customer_visible(r: Rect2) -> Rect2:
	var k := r.size.x / 280.0; var c := r.get_center()
	return Rect2(c.x - 120.0 * k, c.y - 92.0 * k, 240.0 * k, 216.0 * k)

func _customer() -> void:
	var r := _r("customer"); var c := r.get_center()
	var bob := sin(t * 1.6) * 3.0 + (sin(t * 9.0) * 4.0 if mood == "joy" else 0.0)
	c.y += bob
	var skin := Color("#e0a878"); var cloth := Color("#c9533d"); var hair := Color("#2a1a12")
	var kind := "kid"
	match gadget:
		"cable": cloth = Color("#e8892a"); hair = Color("#2a2420"); skin = Color("#c98e5e"); kind = "hardhat"
		"module": cloth = Color("#3a6f8f"); hair = Color("#14100d"); skin = Color("#b9784e"); kind = "glasses"
		"station": cloth = Color("#5a8f4a"); hair = Color("#6b3a1e"); skin = Color("#f0bf94")
		"flash": cloth = Color("#7a5cc0"); hair = Color("#2a1a12"); skin = Color("#e6b48a"); kind = "glasses"   # the camera shop
		"arcade": cloth = Color("#d63d7a"); hair = Color("#1f1612"); skin = Color("#d9a073"); kind = "cap"     # the arcade repairman
		"relay": cloth = Color("#3f8f5a"); hair = Color("#3a2a20"); skin = Color("#c98e5e"); kind = "straw"   # the greenhouse
		"fan": cloth = Color("#2f9a8f"); hair = Color("#2a1a12"); skin = Color("#d9a073"); kind = "glasses"     # the maker space
		"strip": cloth = Color("#c9a02f"); hair = Color("#1f1612"); skin = Color("#e6b48a"); kind = "cap"
		"gate": cloth = Color("#4a5bb5"); hair = Color("#3a2a20"); skin = Color("#c98e5e"); kind = "glasses"   # the robotics club
		"synth": cloth = Color("#a0457a"); hair = Color("#14100d"); skin = Color("#b9784e"); kind = "beard"     # the music shop
	match customer:
		"Ash": cloth = Color("#e8c431"); hair = Color("#3a2a20"); kind = "helmet"
		"Mr. Brook": cloth = Color("#4a6c7d"); hair = Color("#c9c9c9"); skin = Color("#c98e5e"); kind = "beard"
		"Bo": cloth = Color("#3f8f5a"); hair = Color("#6b3a1e"); skin = Color("#f0bf94"); kind = "cap"
		"Eb": cloth = Color("#6a4fa0"); hair = Color("#14100d"); skin = Color("#b9784e"); kind = "glasses"
	var s := r.size.x / 280.0
	_cs = s; _cc = c
	draw_set_transform(c, 0.0, Vector2(s, s))
	# shoulders and torso rising from the bottom edge, with a soft drop shadow
	_ellipse(Vector2(8, 150), Vector2(132, 40), Color(0, 0, 0, 0.3))
	var torso := PackedVector2Array([Vector2(-120, 190), Vector2(-104, 92), Vector2(-60, 58), Vector2(60, 58), Vector2(104, 92), Vector2(120, 190)])
	draw_colored_polygon(torso, cloth.darkened(0.25)); draw_colored_polygon(PackedVector2Array([Vector2(-114, 190), Vector2(-98, 96), Vector2(-56, 64), Vector2(56, 64), Vector2(98, 96), Vector2(114, 190)]), cloth)
	draw_line(Vector2(-20, 66), Vector2(0, 120), cloth.darkened(0.35), 3.0); draw_line(Vector2(20, 66), Vector2(0, 120), cloth.darkened(0.35), 3.0)   # collar
	draw_rect(Rect2(-20, 40, 40, 26), skin.darkened(0.1), true)                                                        # neck
	# head
	var hc := Vector2(0, -2)
	draw_circle(hc, 64, skin.darkened(0.12)); draw_circle(hc, 61, skin)
	draw_circle(hc + Vector2(-48, 4), 12, skin); draw_circle(hc + Vector2(48, 4), 12, skin)                            # ears
	match kind:
		"helmet": draw_arc(hc, 66, PI * 1.02, PI * 1.98, 20, Color("#e8c431"), 22.0); draw_arc(hc, 76, PI * 1.1, PI * 1.9, 20, Color("#b5970f"), 4.0)
		"hardhat":
			draw_arc(hc, 66, PI * 1.0, PI * 2.0, 20, Color("#f08a1c"), 26.0); draw_line(hc + Vector2(-80, -54), hc + Vector2(80, -54), Color("#d97712"), 9.0); draw_line(hc + Vector2(0, -80), hc + Vector2(0, -56), Color("#d97712"), 7.0)
			draw_arc(hc + Vector2(0, 44), 30, 0.25, PI - 0.25, 10, hair, 7.0)   # a moustache
		"cap":
			draw_arc(hc, 64, PI * 1.05, PI * 1.95, 20, Color("#2d6fb0"), 24.0); draw_rect(Rect2(hc.x - 28, hc.y - 34, 90, 12), Color("#245a92"), true)
		"beard": draw_arc(hc + Vector2(0, 8), 56, 0.15, PI - 0.15, 16, hair, 34.0); draw_arc(hc, 64, PI * 1.1, PI * 1.9, 16, hair, 12.0)
		"glasses": draw_arc(hc, 62, PI * 1.05, PI * 1.95, 16, hair, 22.0)
		"straw":
			draw_arc(hc, 62, PI * 1.05, PI * 1.95, 18, Color("#e6c46a"), 20.0); draw_line(hc + Vector2(-92, -52), hc + Vector2(92, -52), Color("#d4ae50"), 9.0)
			draw_line(hc + Vector2(-60, -62), hc + Vector2(60, -62), Color("#a6542c"), 5.0)
		_: draw_arc(hc, 62, PI * 1.05, PI * 1.95, 18, hair, 18.0); for i in 3: draw_line(hc + Vector2(-8 + i * 8, -60), hc + Vector2(-12 + i * 12, -78), hair, 6.0)
	# face by mood
	var ey := hc.y + 2.0
	for sgn in [-1.0, 1.0]:
		var e := Vector2(hc.x + sgn * 24, ey)
		if _blink > 0.5 and mood != "joy": draw_line(e + Vector2(-9, 0), e + Vector2(9, 0), Color("#2a1a12"), 3.0)
		elif mood == "joy": draw_arc(e + Vector2(0, 5), 10, PI + 0.3, TAU - 0.3, 8, Color("#2a1a12"), 4.0)
		else:
			draw_circle(e, 12 + (3 if mood == "wow" else 0), Color.WHITE); draw_circle(e + Vector2(0, 2 if mood == "hopeful" else 0), 6.5 + (1.5 if mood == "wow" else 0), Color("#2a1a12"))
			draw_circle(e + Vector2(-2, -3), 2.5, Color.WHITE)
			if mood == "idle": draw_line(e + Vector2(-12, -16 * 1.0 + 0.0), e + Vector2(12 * sgn * -1.0 * -1.0, -12), Color("#2a1a12"), 3.0)   # slightly sad brows
	if kind == "glasses": for sgn in [-1.0, 1.0]: draw_arc(Vector2(hc.x + sgn * 24, ey), 17, 0, TAU, 16, Color("#14100d"), 3.0)
	draw_circle(hc + Vector2(-38, 26), 9, Color(1, 0.4, 0.4, 0.28 if mood != "joy" else 0.5)); draw_circle(hc + Vector2(38, 26), 9, Color(1, 0.4, 0.4, 0.28 if mood != "joy" else 0.5))
	match mood:
		"idle": draw_arc(hc + Vector2(0, 46), 12, PI * 1.15, PI * 1.85, 8, Color("#7a3b2a"), 4.0)
		"hopeful": draw_line(hc + Vector2(-8, 36), hc + Vector2(8, 36), Color("#7a3b2a"), 4.0)
		"wow": draw_circle(hc + Vector2(0, 38), 8, Color("#5a1d16"))
		"joy":
			draw_arc(hc + Vector2(0, 26), 24, 0.3, PI - 0.3, 12, Color("#7a3b2a"), 4.0)
			draw_colored_polygon(PackedVector2Array([hc + Vector2(-18, 34), hc + Vector2(18, 34), hc + Vector2(0, 50)]), Color(0.45, 0.1, 0.1, 0.0))
	# arms up on the counter holding the gadget
	var g := Vector2(58, 100)   # the gadget is held high enough that the whole of it stays on screen
	for sgn in [-1.0, 1.0]:
		draw_line(Vector2(sgn * 92, 100), g + Vector2(sgn * 26, 6), cloth.darkened(0.15), 24.0, true); draw_circle(g + Vector2(sgn * 26, 6), 13, skin)
	_gadget(g)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _gadget(g: Vector2) -> void:
	var ok := mood == "joy"
	match gadget:
		"torch":
			S.rr(self, Rect2(g.x - 22, g.y - 52, 44, 76), 8, Color("#2f333a")); S.rr(self, Rect2(g.x - 30, g.y - 66, 60, 22), 8, Color("#47505b"))
			draw_circle(g + Vector2(0, -58), 20, Color("#cfd6dc") if not ok else Color("#fff6c8"))
			draw_rect(Rect2(g.x - 4, g.y - 26, 8, 28), Color("#d23a2e"), true)
			if ok:
				S.glow(self, g + Vector2(0, -90), 130.0, Color(1, 0.95, 0.6, 0.45))
				draw_colored_polygon(PackedVector2Array([g + Vector2(-16, -64), g + Vector2(16, -64), g + Vector2(78, -190), g + Vector2(-78, -190)]), Color(1, 0.95, 0.6, 0.18))
		"taillight":
			S.rr(self, Rect2(g.x - 44, g.y - 40, 88, 52), 10, Color("#222")); for i in 3: draw_circle(g + Vector2(-26 + i * 26, -14), 10, Color("#ff3b1f") if ok else Color("#5a1812"))
			if ok: S.glow(self, g + Vector2(0, -14), 110.0, Color(1, 0.2, 0.1, 0.5))
		"heater":
			S.rr(self, Rect2(g.x - 14, g.y - 90, 28, 110), 12, Color("#7fb8c4", 0.7)); for i in 6: draw_line(g + Vector2(-9, -78 + i * 16), g + Vector2(9, -72 + i * 16), Color("#e0743a") if ok else Color("#6a3a26"), 3.0)
			if ok: S.glow(self, g + Vector2(0, -40), 70.0, Color(1, 0.55, 0.2, 0.3))
		"car":
			S.rr(self, Rect2(g.x - 48, g.y - 34, 96, 34), 10, Color("#d23a2e")); S.rr(self, Rect2(g.x - 24, g.y - 56, 50, 28), 10, Color("#e8574a"))
			for sgn in [-1.0, 1.0]: draw_circle(g + Vector2(sgn * 30, 2), 12, Color("#14100d")); draw_circle(g + Vector2(sgn * 30, 2), 5, Color("#8b8f98"))
			if ok: draw_line(g + Vector2(-70, -10), g + Vector2(-100, -10), Color(1, 1, 1, 0.5), 3.0); draw_line(g + Vector2(-66, 4), g + Vector2(-110, 4), Color(1, 1, 1, 0.4), 3.0)
		"station":   # a weather station: mast, anemometer cups and a vane
			draw_line(g + Vector2(0, 20), g + Vector2(0, -96), Color("#8b8f98"), 6.0); S.rr(self, Rect2(g.x - 22, g.y - 40, 44, 34), 6, Color("#e8e8e0"))
			for sgn in [-1.0, 1.0]: draw_line(g + Vector2(0, -96), g + Vector2(sgn * 34, -96), Color("#8b8f98"), 4.0); draw_circle(g + Vector2(sgn * 34, -96), 8, Color("#d23a2e"))
			draw_colored_polygon(PackedVector2Array([g + Vector2(2, -76), g + Vector2(34, -70), g + Vector2(2, -64)]), Color("#3a6fb0"))
			if ok: S.glow(self, g + Vector2(0, -22), 60.0, Color(0.5, 1, 0.6, 0.35))
			S.text(self, S.mono(), "3.30" if ok else "?.??", g + Vector2(-20, -16), 15, Color("#1d7a3a") if ok else Color("#b3261e"))
		"cable":   # a reel of telephone cable with its end sticking out
			draw_circle(g + Vector2(0, -26), 38, Color("#f08a1c")); draw_circle(g + Vector2(0, -26), 31, Color("#1a1a1c")); draw_circle(g + Vector2(0, -26), 16, Color("#f08a1c")); draw_circle(g + Vector2(0, -26), 5, Color("#2a1a08"))
			for k in 3: draw_arc(g + Vector2(0, -26), 31 - k * 5, 0.0, TAU, 20, Color("#33343a"), 2.0)
			draw_line(g + Vector2(30, -8), g + Vector2(70, 6), Color("#1a1a1c"), 6.0)
			if ok: draw_line(g + Vector2(-48, -70), g + Vector2(-20, -50), Color("#d23a2e"), 6.0); S.text(self, S.hand(), "X", g + Vector2(-66, -72), 26, Color("#d23a2e"))
		"flash":   # a camera with a flash head: the ready lamp turns green when the timer is right
			S.rr(self, Rect2(g.x - 52, g.y - 52, 104, 60), 9, Color("#2a2c32")); S.rr(self, Rect2(g.x - 48, g.y - 48, 96, 20), 6, Color("#c9ced4"))
			draw_circle(g + Vector2(4, -20), 20, Color("#14161a")); draw_circle(g + Vector2(4, -20), 14, Color("#27406b")); draw_circle(g + Vector2(-2, -26), 4, Color(1, 1, 1, 0.5))
			S.rr(self, Rect2(g.x - 30, g.y - 74, 44, 24), 5, Color("#e8e8e0")); draw_circle(g + Vector2(-38, -34), 5, Color("#48d36b") if ok else Color("#6a1a14"))
			if ok: S.glow(self, g + Vector2(-8, -64), 90.0, Color(1, 0.97, 0.8, 0.55)); S.glow(self, g + Vector2(-38, -34), 22.0, Color(0.3, 1, 0.45, 0.6))
		"arcade":   # an arcade panel with the big button
			S.rr(self, Rect2(g.x - 52, g.y - 52, 104, 62), 8, Color("#1c1f4a")); draw_circle(g + Vector2(14, -22), 24, Color("#0c0d12")); draw_circle(g + Vector2(14, -24), 19, Color("#d8332a") if not ok else Color("#ff6a4a"))
			draw_circle(g + Vector2(8, -32), 5, Color(1, 1, 1, 0.45)); draw_circle(g + Vector2(-30, -22), 9, Color("#2a2c33")); draw_line(g + Vector2(-30, -22), g + Vector2(-30, -44), Color("#c9ced4"), 4.0); draw_circle(g + Vector2(-30, -46), 7, Color("#f0c24a"))
			S.text(self, S.mono(), "x1" if ok else "x10", g + Vector2(-44, 4), 14, Color("#7cff6b") if ok else Color("#ff7a5a"))
		"relay":   # a relay in a clear box: its tongue is closed when the job is right
			S.rr(self, Rect2(g.x - 40, g.y - 70, 80, 78), 8, Color("#2a5f9e")); S.rr(self, Rect2(g.x - 35, g.y - 65, 70, 68), 6, Color(0.62, 0.8, 0.95, 0.55))
			for i in 9: draw_line(g + Vector2(-30, -58 + i * 6), g + Vector2(-6, -56 + i * 6), Color("#c47a2a"), 3.5)
			draw_line(g + Vector2(30, -60), g + Vector2(16, -8 if not ok else -30), Color("#b8bcc4"), 5.0); draw_circle(g + Vector2(16, -8 if not ok else -30), 5, Color("#d9b24a"))
			if ok: S.glow(self, g + Vector2(-18, -30), 50.0, Color(1, 0.6, 0.25, 0.35))
		"wallwart":   # a plug-in adapter brick with its two pins; the lamp is green when the job is right
			S.rr(self, Rect2(g.x - 34, g.y - 66, 68, 62), 8, Color("#2a2c31")); draw_rect(Rect2(g.x - 14, g.y - 82, 6, 18), Color("#c9ced4"), true); draw_rect(Rect2(g.x + 8, g.y - 82, 6, 18), Color("#c9ced4"), true)
			S.text(self, S.mono(), "12V", g + Vector2(-18, -30), 16, Color("#cfd6dc")); draw_circle(g + Vector2(22, -50), 5, Color("#4ad06a") if ok else Color("#2a5a38"))
		"radio":   # a pocket radio: speaker grille, dial and an aerial
			S.rr(self, Rect2(g.x - 44, g.y - 56, 88, 54), 8, Color("#8a4a2a")); draw_line(g + Vector2(30, -56), g + Vector2(52, -92), Color("#c9ced4"), 3.0)
			for i in 5: draw_line(g + Vector2(-34, -46 + i * 7), g + Vector2(-8, -46 + i * 7), Color("#3a2014"), 3.0)
			draw_circle(g + Vector2(22, -28), 12, Color("#e8e0c8")); draw_line(g + Vector2(22, -28), g + Vector2(30, -36) if ok else g + Vector2(14, -34), Color("#d23a2e"), 3.0)
			if ok: for i in 3: draw_arc(g + Vector2(54, -86), 8.0 + i * 8.0, -0.9, 0.9, 8, Color(1, 1, 1, 0.5 - i * 0.12), 2.5)
		"printer":   # a boxy 3D printer: frame, nozzle and a little print
			draw_rect(Rect2(g.x - 40, g.y - 70, 6, 70), Color("#9aa0a8"), true); draw_rect(Rect2(g.x + 34, g.y - 70, 6, 70), Color("#9aa0a8"), true); draw_rect(Rect2(g.x - 40, g.y - 70, 80, 6), Color("#9aa0a8"), true)
			S.rr(self, Rect2(g.x - 12, g.y - 60, 24, 14), 3, Color("#d9663f")); draw_line(g + Vector2(0, -46), g + Vector2(0, -34), Color("#c9ced4"), 3.0)
			S.rr(self, Rect2(g.x - 36, g.y - 10, 72, 10), 2, Color("#3a3d44")); if ok: S.rr(self, Rect2(g.x - 14, g.y - 30, 28, 20), 2, Color("#5fb3d9"))
		"bench":   # a bench supply: a panel with its red readout
			S.rr(self, Rect2(g.x - 44, g.y - 54, 88, 50), 6, Color("#2e3238")); S.rr(self, Rect2(g.x - 36, g.y - 46, 50, 22), 3, Color("#150808")); S.text(self, S.mono(), "3.3", g + Vector2(-32, -29), 18, Color("#ff5a3a") if ok else Color("#6a2a20"))
			draw_circle(g + Vector2(28, -34), 6, Color("#e0453a")); draw_circle(g + Vector2(28, -14), 6, Color("#2a2d33"))
		"fan":   # a 12 V fan in a square frame: the blades turn when the job is right
			S.rr(self, Rect2(g.x - 40, g.y - 76, 80, 80), 8, Color("#23262c")); draw_circle(g + Vector2(0, -36), 33, Color("#14161a"))
			var ang := t * 9.0 if ok else 0.4
			for k in 4: var a := ang + k * PI * 0.5; draw_colored_polygon(PackedVector2Array([g + Vector2(0, -36), g + Vector2(0, -36) + Vector2(cos(a - 0.35), sin(a - 0.35)) * 30.0, g + Vector2(0, -36) + Vector2(cos(a + 0.35), sin(a + 0.35)) * 30.0]), Color("#5fb3d9") if ok else Color("#6f7c86"))
			draw_circle(g + Vector2(0, -36), 7, Color("#b8bcc4"))
			if ok: S.glow(self, g + Vector2(0, -36), 52.0, Color(0.5, 0.85, 1, 0.25))
		"strip":   # a coil of LED strip: warm dots, lit when the job is right
			S.rr(self, Rect2(g.x - 44, g.y - 44, 88, 26), 5, Color("#1d1f24"))
			for i in 8: draw_circle(g + Vector2(-36 + i * 10.5, -31), 4.2, Color("#ffd98a") if ok else Color("#6a5a3a"))
			S.rr(self, Rect2(g.x - 44, g.y - 14, 88, 22), 5, Color("#1d1f24"))
			for i in 8: draw_circle(g + Vector2(-36 + i * 10.5, -3), 4.2, Color("#ffd98a") if ok else Color("#6a5a3a"))
			if ok: S.glow(self, g + Vector2(0, -22), 80.0, Color(1, 0.85, 0.5, 0.35))
		"gate":   # a scrap of perfboard with a NAND symbol and the Y lamp
			S.rr(self, Rect2(g.x - 44, g.y - 62, 88, 66), 5, Color("#2d5a3c"))
			var gx := g + Vector2(-6, -30)
			draw_polyline(PackedVector2Array([gx + Vector2(-16, -16), gx + Vector2(0, -16), gx + Vector2(0, 16), gx + Vector2(-16, 16), gx + Vector2(-16, -16)]), Color("#efe5c8"), 3.0)
			draw_arc(gx + Vector2(0, 0), 16, -PI * 0.5, PI * 0.5, 10, Color("#efe5c8"), 3.0); draw_circle(gx + Vector2(20, 0), 4, Color("#efe5c8"))
			draw_circle(g + Vector2(30, -30), 6, Color("#ff5a3a") if ok else Color("#4a1f18"))
			S.text(self, S.mono(), "Y", g + Vector2(26, -14), 14, Color("#efe5c8"))
		"synth":   # a mini keyboard; a sine rides above it when the job is right
			S.rr(self, Rect2(g.x - 46, g.y - 40, 92, 44), 4, Color("#1b1c20"))
			for i in 8: S.rr(self, Rect2(g.x - 42 + i * 10.6, g.y - 34, 9.2, 34), 2, Color("#efe5c8"))
			for i in [0, 1, 3, 4, 5]: S.rr(self, Rect2(g.x - 36 + i * 10.6, g.y - 34, 6.2, 20), 1, Color("#14161a"))
			if ok:
				var pts := PackedVector2Array()
				for k in 24: pts.append(g + Vector2(-40 + k * 3.5, -54 + sin(k * 0.8 + t * 6.0) * 8.0))
				draw_polyline(pts, Color("#7cff6b"), 3.0, true)
		"module":   # a small sealed box with pins
			S.rr(self, Rect2(g.x - 40, g.y - 62, 80, 62), 6, Color("#14151a")); S.rr(self, Rect2(g.x - 30, g.y - 50, 60, 26), 3, Color("#efe5c8"))
			S.text(self, S.hand(), "SEALED", g + Vector2(-26, -30), 16, Color(0.55, 0.1, 0.08))
			for i in 4: draw_line(g + Vector2(-27 + i * 18, 0), g + Vector2(-27 + i * 18, 14), Color("#c9ced4"), 4.0)
			if ok: S.glow(self, g + Vector2(0, -30), 64.0, Color(0.5, 0.9, 1, 0.3))
		_:   # exam sheet
			S.paper(self, Rect2(g.x - 40, g.y - 76, 80, 100), -4.0, S.PAPER, false, Transform2D(0.0, Vector2(_cs, _cs), 0.0, _cc))
			S.text(self, S.hand(), "✓" if ok else "?", Vector2(g.x - 12, g.y - 20), 56, S.INK_RED if ok else S.INK)
