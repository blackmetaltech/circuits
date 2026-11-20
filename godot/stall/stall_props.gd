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
var bin_scroll := 0
var exam_fig: Dictionary = {}          ## exam ticket: the engine's figure, drawn small on the problem card that stays on the bench
var exam_open := true                  ## false once the predictions are in (the card then reads "your predictions are in")
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
	S.text(self, S.hand(), "tap: open the slip" if not exam_open else "tap to predict", q.position + Vector2(12, q.size.y - 12), 15, Color(S.INK, 0.8))
	if hv: S.rr_line(self, q.grow(3), 5, Color("#ffd98a", 0.9), 3.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw() -> void:
	if L.is_empty(): return
	_mug(); _box(); _cat(); _notebook(); _tin()
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

static func slots(inner: Rect2, n: int, scroll: int) -> Array:
	var out: Array = []
	var cols := 2; var cw := inner.size.x / cols; var rh := 86.0
	var rows_visible := int(inner.size.y / rh)
	for i in n:
		var k := i - scroll * cols
		if k < 0 or k >= rows_visible * cols: out.append(Rect2()); continue
		out.append(Rect2(inner.position.x + float(k % cols) * cw + 3, inner.position.y + float(k / cols) * rh + 3, cw - 6, rh - 6))
	return out

func box_inner() -> Rect2: return _r("box").grow(-22)

## How many rows of parts the shoebox shows at once, and how far it can scroll (one wheel notch or one arrow click = one row, always).
static func rows_visible(inner: Rect2) -> int: return maxi(1, int(inner.size.y / 86.0))
static func max_scroll(inner: Rect2, n: int) -> int: return maxi(0, (n + 1) / 2 - rows_visible(inner))
## The two scroll arrows (small tabs on the box's right edge); each is a Rect2 with zero size when there is nowhere to scroll that way.
static func arrows(inner: Rect2, n: int, scroll: int) -> Dictionary:
	var mx := max_scroll(inner, n)
	var up := Rect2(inner.end.x - 34, inner.position.y + 4, 30, 26) if scroll > 0 else Rect2()
	var dn := Rect2(inner.end.x - 34, inner.end.y - 30, 30, 26) if scroll < mx else Rect2()
	return {"up": up, "down": dn}

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

func _items(c: Vector2) -> void:
	var inner := box_inner(); var n := items.size()
	var sl := slots(inner, n, bin_scroll)
	var pp := 20.0
	for i in n:
		var cell: Rect2 = sl[i]
		if cell.size == Vector2.ZERO: continue
		var it: Dictionary = items[i]
		var a := 0.28 if i == hide_item else 1.0
		var hov := i == hover_item and i != hide_item
		if hov: S.rr(self, cell, 8, Color(1, 0.85, 0.5, 0.12))
		var pd := part_dict(it)
		var org := Vector2(cell.position.x + 16.0, cell.position.y + 24.0)
		if it.kind == "LED": org.x += 10.0
		if it.kind == "BAT": org.x -= 4.0; pp = 15.0
		else: pp = 20.0
		var mod := Color(1, 1, 1, a)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		# PartArt draws with its own colours; fade by drawing under a modulated canvas group via self_modulate is not per-draw, so lift alpha with a veil
		PartArt.draw(self, pd, org + (Vector2(0, -3.0) if hov else Vector2.ZERO), pp, {"lit": 0.0, "smoked": false})
		if a < 1.0: S.rr(self, cell, 8, Color(0.12, 0.09, 0.06, 0.7))
		var tag := Rect2(cell.position.x + 6, cell.end.y - 30, cell.size.x - 12, 26)
		S.paper(self, tag, 0.0 if i % 2 == 0 else 0.8, Color("#efe5c8"))
		var lab: String = it.label if it.tag == "" or it.kind == "BAT" else "%s  %s" % [it.label, it.tag]
		S.text(self, S.hand(), lab, Vector2(tag.position.x + 8, tag.position.y + 20), 17, S.INK)
		var pt: String = str(it.get("price_text", ""))
		if int(it.get("left", -1)) >= 0: pt = ("%s  x%d" % [pt, int(it.left)]).strip_edges()
		if pt != "": S.text(self, S.hand(), pt, Vector2(cell.end.x - 8 - S.tw(S.hand(), pt, 15), cell.position.y + 20), 15, Color("#e9dfc4", 0.75))
	_scroll_cues(inner, n)

## Scrolling you can see: a dark fade where more parts hide, an arrow tab you can click, and a thin track showing where you are.
func _scroll_cues(inner: Rect2, n: int) -> void:
	var mx := max_scroll(inner, n)
	if mx <= 0: return
	var ar := arrows(inner, n, bin_scroll)
	if bin_scroll > 0: S.vgrad(self, Rect2(inner.position, Vector2(inner.size.x, 34)), Color("#120c07", 0.92), Color("#120c07", 0.0), 6)
	if bin_scroll < mx: S.vgrad(self, Rect2(inner.position.x, inner.end.y - 34, inner.size.x, 34), Color("#120c07", 0.0), Color("#120c07", 0.92), 6)
	for k in ["up", "down"]:
		var rr: Rect2 = ar[k]
		if rr.size == Vector2.ZERO: continue
		var hv: bool = hover == "box_" + k
		S.rr(self, rr, 6, Color("#ffd98a", 0.95) if hv else Color("#e9dfc4", 0.85))
		var c := rr.get_center(); var d := -1.0 if k == "up" else 1.0
		draw_colored_polygon(PackedVector2Array([c + Vector2(-8, -4 * d), c + Vector2(8, -4 * d), c + Vector2(0, 5 * d)]), Color("#3a2a1a"))
	var tr := Rect2(inner.end.x - 5, inner.position.y + 36, 3, inner.size.y - 72)   # the track and the thumb
	draw_rect(tr, Color(1, 1, 1, 0.12), true)
	var th := maxf(18.0, tr.size.y * float(rows_visible(inner)) / float((n + 1) / 2))
	draw_rect(Rect2(tr.position.x, tr.position.y + (tr.size.y - th) * float(bin_scroll) / float(mx), tr.size.x, th), Color("#ffd98a", 0.8), true)

## ------------------------------------------------------------------------------------------------------------------ customer

func _customer() -> void:
	var r := _r("customer"); var c := r.get_center()
	var bob := sin(t * 1.6) * 3.0 + (sin(t * 9.0) * 4.0 if mood == "joy" else 0.0)
	c.y += bob
	var skin := Color("#e0a878"); var cloth := Color("#c9533d"); var hair := Color("#2a1a12")
	var kind := "kid"
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
		"cap":
			draw_arc(hc, 64, PI * 1.05, PI * 1.95, 20, Color("#2d6fb0"), 24.0); draw_rect(Rect2(hc.x - 28, hc.y - 34, 90, 12), Color("#245a92"), true)
		"beard": draw_arc(hc + Vector2(0, 8), 56, 0.15, PI - 0.15, 16, hair, 34.0); draw_arc(hc, 64, PI * 1.1, PI * 1.9, 16, hair, 12.0)
		"glasses": draw_arc(hc, 62, PI * 1.05, PI * 1.95, 16, hair, 22.0)
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
	var g := Vector2(58, 120)
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
		_:   # exam sheet
			S.paper(self, Rect2(g.x - 40, g.y - 76, 80, 100), -4.0, S.PAPER, false, Transform2D(0.0, Vector2(_cs, _cs), 0.0, _cc))
			S.text(self, S.hand(), "✓" if ok else "?", Vector2(g.x - 12, g.y - 20), 56, S.INK_RED if ok else S.INK)
