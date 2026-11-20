class_name StallScene
extends Control
## NODE's own interface: Wren's repair stall at night (docs/briefs/CH1-SOUL.md). No top bar, sidebar or tabs: money is the coin tin, the ticket is
## a chit on the scope bezel, the coach is Wren's notebook (a slip with a hand-drawn arrow), settings is the brass gear on the stall wall.
##
## Back to front: StallWindow (the lane) -> this node's own _draw (walnut bench, cutting mat) -> StallProps (mug, shoebox, Rezzy, notebook, coin
## tin, customer) -> the board (BenchView in a SubViewport shown through a 12-degree perspective shader) -> SupplyView / ScopeView / DmmView ->
## StallTop (cables, probes, chit, coach slip, bubble) -> StallPages (title, chapter map, notebook, settings).
##
## The scene talks to a backend with the FixtureBench method set. EngineBench (the real engine through the sidecar) is the default; FixtureBench
## (a local GDScript stand-in solver) is a test double selected with CB_FIXTURE=1, and the fallback if the sidecar cannot start.

const S = preload("res://stall/stall_style.gd")
const SAVE := "user://node_stall.cfg"
const TOP_SCALE := 0.88            ## perspective: the far (top) edge of the board is this fraction as wide as the near edge
const DEPTH := 0.94                ## vertical foreshortening of the board

var backend
var window: StallWindow
var props: StallProps
var supply: SupplyView
var scope: ScopeView
var dmm: DmmView
var top: StallTop
var pages: StallPages
var sfx: StallSfx
var vp: SubViewport
var tex: TextureRect
var bench: BenchView
var L: Dictionary = {}
var phone := false
var phase := "title"
var t := 0.0
var cute := true
var reduced := false
var sound := true
var volume := 0.8
var done: Dictionary = {}
var wallet := 0
var board_rect := Rect2()
var drag: Dictionary = {}
var hover := ""
var scope_open := false
var scope_t := 0.0
var rot := 0                          ## rotation of the part being placed
var locked_at := -1.0
var bubble_until := 0.0
var _slot_hover := -1
var _lay_key := ""
var _mouse := Vector2(-1, -1)
var _prev_cur := -1
var _smoke_mood_until := 0.0
var _lock_seq := -1.0
var _next_rect := Rect2()
var _ticket_ids: Array = ["1-1", "1-2", "1-3", "1-4", "1-5"]
var _flow_log: Array = []

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backend = _make_backend()
	backend.event.connect(_on_event)
	_load_save()
	window = StallWindow.new(); add_child(window)
	props = StallProps.new(); add_child(props)
	vp = SubViewport.new(); vp.transparent_bg = true; vp.disable_3d = true; vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS; vp.size = Vector2i(900, 560); add_child(vp)
	bench = BenchView.new(); bench.embedded = true; vp.add_child(bench)
	tex = TextureRect.new(); tex.texture = vp.get_texture(); tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; tex.stretch_mode = TextureRect.STRETCH_SCALE
	tex.mouse_filter = Control.MOUSE_FILTER_IGNORE; tex.material = _board_material(); add_child(tex)
	supply = SupplyView.new(); add_child(supply)
	scope = ScopeView.new(); add_child(scope)
	dmm = DmmView.new(); add_child(dmm)
	top = StallTop.new(); add_child(top)
	pages = StallPages.new(); add_child(pages); pages.act.connect(_on_page)
	sfx = StallSfx.new(); add_child(sfx)
	_apply_prefs()
	backend.open_ticket("1-1")
	resized.connect(func(): _lay_key = "")
	get_viewport().size_changed.connect(func(): _lay_key = "")
	_screen_env()

func _make_backend():
	if OS.get_environment("CB_FIXTURE") != "": return FixtureBench.new()
	var eb := EngineBench.new()
	if eb.started:
		add_child(eb.bridge)   # the sidecar lives and dies with the scene
		if not _nosave() and eb.has_save(): eb.load_game()
		return eb
	push_warning("The engine sidecar could not start (%s): using the fixture bench." % str(eb.bridge.last_error))
	return FixtureBench.new()

func _nosave() -> bool: return OS.has_environment("CB_NOSAVE") or (DisplayServer.get_name() == "headless" and OS.has_environment("CB_TEST"))

func _board_material() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = "shader_type canvas_item;\nuniform float top_scale = 0.88;\nvoid fragment() {\n\tfloat v = UV.y; float s = mix(top_scale, 1.0, v);\n\tfloat u = 0.5 + (UV.x - 0.5) / s;\n\tif (u < 0.0 || u > 1.0) { COLOR = vec4(0.0); }\n\telse { vec4 c = texture(TEXTURE, vec2(u, v)); c.rgb *= mix(0.8, 1.06, v); COLOR = c; }\n}\n"
	var m := ShaderMaterial.new(); m.shader = sh; m.set_shader_parameter("top_scale", TOP_SCALE); return m

func _screen_env() -> void:   # CB_SCREEN=title|map|bench ; CB_TICKET=1-3 (QA hooks, DESIGN §6.5)
	var scr := OS.get_environment("CB_SCREEN")
	var tk := OS.get_environment("CB_TICKET")
	if OS.get_environment("CB_UNLOCK") == "1":
		for id in _ticket_ids: done[id] = done.get(id, false)
		if backend.ENGINE and OS.get_environment("CB_SHOTS") == "": backend.unlock_through(tk if tk != "" and scr in ["bench", "level", "notebook"] else "1-5")   # play the earlier tickets with their reference designs
	match scr:
		"bench", "level": start_ticket(tk if tk != "" else "1-1")
		"map": go_map()
		"notebook": start_ticket(tk if tk != "" else "1-1"); pages.show_page("notebook")
		"settings": pages.show_page("settings")
		_: go_title()

## ------------------------------------------------------------------------------------------------------------------ flow

func go_title() -> void:
	phase = "title"; window.dusk = 1.0; window.rain = false
	if backend.ENGINE:
		backend.close_ticket(); backend.open_ticket("1-1"); _ticket_view()
		pages.has_save = backend.wallet_minor > 0 or backend.has_save()
	else: backend.open_ticket("1-1"); pages.has_save = not done.is_empty()
	_sync(); _refresh_pages(); pages.show_page("title")

func go_map() -> void:
	phase = "map"; window.dusk = 0.0; _refresh_pages(); pages.show_page("map")

func start_ticket(id: String) -> void:
	if not backend.open_ticket(id):   # the engine keeps a ticket locked until the one before it is passed
		top.say("That ticket is still locked: pass the one before it first."); if phase != "bench": go_map()
		return
	phase = "bench"; window.dusk = 0.0; window.rain = id == "1-3" or id == "1-4"
	drag.clear(); rot = 0; locked_at = -1.0; _lock_seq = -1.0; top.toast_age = 9.0
	_ticket_view()
	bubble_until = t + 9.0; top.bubble = str(backend.ticket.ask); top.bubble_alpha = 0.0
	if not backend.ENGINE: dmm.set_mode("V"); backend.set_dial("V")
	_lay_key = ""; _sync(); pages.show_page("")
	props.notebook_flag = true
	if backend.ENGINE and bool(backend.ticket.get("eb", false)) and not backend.predictions_done(): open_predict()

func _ticket_view() -> void:   # push the open ticket onto the instruments and props
	props.mood = "idle"; props.customer = str(backend.ticket.customer); props.gadget = str(backend.ticket.gadget); props.bin_scroll = 0
	scope.sc = backend.ticket.scope; scope.locked = false
	var sp: Dictionary = backend.ticket.supply
	supply.kind = str(sp.kind) if sp.kind != "none" else "bench"
	supply.label = str(sp.label); supply.tired = sp.get("tired", false); supply.volts = float(sp.get("volts", sp.get("emf", 0.0)))
	supply.conditions = backend.ticket.get("conditions", []) if backend.ENGINE else []

func _refresh_pages() -> void:
	pages.cute = cute; pages.reduced = reduced; pages.sound = sound; pages.volume = volume; pages.wallet = wallet
	pages.tickets.clear()
	if backend.ENGINE:
		var pg: Dictionary = backend.progress()
		pages.tickets = pg.tickets; pages.wallet = int(pg.wallet); pages.wallet_text = str(pg.wallet_text)
		for tk in pg.tickets: done[str(tk.id)] = bool(tk.done)
		pages.coach_ticket = backend.ticket; return
	var prev_done := true
	for id in _ticket_ids:
		var tk: Dictionary = FixtureBench.TICKETS[id]
		var open: bool = prev_done or done.has(id) or OS.get_environment("CB_UNLOCK") == "1"
		pages.tickets.append({"id": id, "title": tk.title, "customer": tk.customer, "spec": tk.spec, "price": tk.price, "open": open, "done": done.get(id, false)})
		prev_done = done.get(id, false)
	pages.coach_ticket = backend.ticket

func _on_page(id: String, arg: String) -> void:
	sfx.play("page" if id in ["close", "goto:map", "codex"] else "click", 0.7)
	match id:
		"continue", "goto:map": go_map()
		"new":
			done.clear(); wallet = 0
			if backend.ENGINE: backend.new_game(); if not _nosave(): backend.save_game()
			_save(); go_map()
		"pred_focus": pages.pred_focus = int(arg)
		"pred_submit": _submit_predictions()
		"pred_close": pages.show_page("")
		"settings": pages.show_page("settings")
		"cute", "toggle:cute": cute = not cute; _apply_prefs(); _save(); _refresh_pages()
		"toggle:reduced": reduced = not reduced; _apply_prefs(); _save(); _refresh_pages()
		"toggle:sound": sound = not sound; _apply_prefs(); _save(); _refresh_pages()
		"vol+": volume = clampf(volume + 0.1, 0.0, 1.0); _apply_prefs(); _save(); _refresh_pages()
		"vol-": volume = clampf(volume - 0.1, 0.0, 1.0); _apply_prefs(); _save(); _refresh_pages()
		"ticket": start_ticket(arg)
		"goto:title": go_title()
		"codex": pages.codex_i = int(arg)
		"close":
			if pages.mode == "settings" and phase == "title": pages.show_page("title")
			elif pages.mode == "settings" and phase == "map": pages.show_page("map")
			elif pages.mode == "notebook" or pages.mode == "settings": pages.show_page("")
		"notebook": pages.show_page("notebook")

func _apply_prefs() -> void:
	bench.cute = cute; bench.electron_flow = cute; bench.reduced_motion = reduced; props.cute = cute; window.reduced = reduced
	sfx.enabled = sound; sfx.volume = volume; pages.cute = cute; pages.reduced = reduced; pages.sound = sound; pages.volume = volume

func _load_save() -> void:
	var c := ConfigFile.new()
	if c.load(SAVE) != OK: return
	cute = bool(c.get_value("prefs", "cute", true)); reduced = bool(c.get_value("prefs", "reduced", false)); sound = bool(c.get_value("prefs", "sound", true)); volume = float(c.get_value("prefs", "volume", 0.8))
	wallet = int(c.get_value("progress", "wallet", 0))
	for id in c.get_value("progress", "done", []): done[str(id)] = true

func _save() -> void:
	if OS.has_environment("CB_NOSAVE") or DisplayServer.get_name() == "headless" and OS.has_environment("CB_TEST"): return
	var c := ConfigFile.new()
	c.set_value("prefs", "cute", cute); c.set_value("prefs", "reduced", reduced); c.set_value("prefs", "sound", sound); c.set_value("prefs", "volume", volume)
	c.set_value("progress", "wallet", wallet); c.set_value("progress", "done", done.keys())
	c.save(SAVE)

## ------------------------------------------------------------------------------------------------------------------ events from the bench

func _on_event(name: String, data: Dictionary) -> void:
	_flow_log.append(name)
	match name:
		"placed": sfx.play("thunk"); props.mood = "hopeful" if props.mood == "idle" else props.mood
		"wired": sfx.play("zip")
		"power": sfx.play("click" if data.on else "clack")
		"deleted": sfx.play("page", 0.5)
		"smoked":
			sfx.play("crack" if data.kind == "LED" else "pop"); sfx.play("meow", 0.5)
			props.mood = "wow"; _smoke_mood_until = t + 4.0
			if str(data.get("text", "")) != "": top.say(str(data.text))   # the engine's explanation with the player's own numbers
			else: top.say("Pop. %.0f mA through a part rated for far less." % (absf(data.amps) * 1000.0) if data.kind == "LED" else "Pop. That resistor took %.2f W." % data.watts)
			scope.flash_lock()
		"lock": scope.flash_lock(); sfx.play("chime")   # the live band is held (the engine's LOCK)
		"paid": _lock_seq = 0.0                          # the formal bench passed: the customer pays
		"bench_failed":
			sfx.play("pop", 0.5); props.mood = "wow"; _smoke_mood_until = t + 3.0
			top.say(str(data.get("text", "The bench check failed.")))

func _finish_lock() -> void:
	locked_at = t
	props.mood = "joy"; top.bubble = str(backend.ticket.thanks); bubble_until = t + 14.0
	var price := int(backend.ticket.price)
	if backend.ENGINE:
		wallet = backend.wallet_minor; done[str(backend.ticket.id)] = true; _refresh_pages()
		if not _nosave(): backend.save_game()
	else:
		if not done.get(str(backend.ticket.id), false): wallet += price
		done[str(backend.ticket.id)] = true
	_save()
	props.fly_coin(scope.position + Vector2(300, 170) * scope.scale.x, 6)
	sfx.play("kaching"); props.tin_shake = 0.0

## ------------------------------------------------------------------------------------------------------------------ bench check and predictions (exam ticket)

## The formal bench check (the engine runs every condition; a pass pays, a fail explains with the player's own numbers).
func run_bench() -> void:
	if phase != "bench" or not backend.ENGINE or backend.ticket.is_empty(): return
	if bool(backend.ticket.get("eb", false)) and not backend.predictions_done():
		top.say("Predict first: enter your numbers on the exam slip, then bench it."); open_predict(); return
	if backend.parts.filter(func(p): return not p.fixed).is_empty(): top.say("Build something first."); return
	sfx.play("click", 0.8); backend.run_bench()

func open_predict() -> void:
	pages.pred_fields = []
	for pr in backend.ticket.get("predictions", []):
		pages.pred_fields.append({"id": str(pr.id), "name": str(pr.name), "unit": str(pr.unit), "text": "" if pr.get("entered", null) == null else EngineBench._g(float(pr.entered), 6), "done": pr.get("entered", null) != null})
	pages.pred_focus = 0; pages.show_page("predict")

func set_prediction(id: String, value: float) -> Dictionary:   # also what typing then Enter does
	var r: Dictionary = backend.predict(id, value)
	if not r.ok: top.say(str(r.msg))
	return r

func _submit_predictions() -> void:
	for f in pages.pred_fields:
		if str(f.text).strip_edges() == "": continue
		if not str(f.text).is_valid_float(): top.say("'%s' is not a number." % str(f.text)); return
		var r := set_prediction(str(f.id), float(str(f.text)))
		if r.ok: f.done = true
	if backend.predictions_done(): pages.show_page(""); sfx.play("page", 0.7); top.say("Predictions recorded. Now build it and probe node A.")

func _predict_key(e: InputEventKey) -> void:
	var f: Dictionary = pages.pred_fields[pages.pred_focus] if pages.pred_focus < pages.pred_fields.size() else {}
	match e.keycode:
		KEY_ESCAPE: pages.show_page("")
		KEY_TAB, KEY_DOWN: pages.pred_focus = (pages.pred_focus + 1) % maxi(1, pages.pred_fields.size())
		KEY_UP: pages.pred_focus = (pages.pred_focus + pages.pred_fields.size() - 1) % maxi(1, pages.pred_fields.size())
		KEY_ENTER, KEY_KP_ENTER: _submit_predictions()
		KEY_BACKSPACE: if not f.is_empty(): f.text = str(f.text).substr(0, str(f.text).length() - 1)
		_:
			if not f.is_empty() and e.unicode > 0:
				var ch := char(e.unicode)
				if ch in "0123456789.-+eE": f.text = str(f.text) + ch

## ------------------------------------------------------------------------------------------------------------------ layout

func _layout() -> void:
	var W := size.x; var H := size.y
	var dy := maxf(0.0, H - 1080.0)
	phone = W / maxf(H, 1.0) > 2.0
	var sill := 182.0 + dy * 0.05
	window.position = Vector2.ZERO; window.size = Vector2(W, sill)
	var rx := W - 640.0
	L.clear()
	L.sill = sill
	L.mug = Vector2(84, sill + 82); L.cat = Rect2(150, sill + 22, 200, 130)
	L.box = Rect2(26, sill + 176, 312, 470 + dy * 0.45)
	L.notebook = Rect2(30, 855 + dy, 262, 186)
	var sc_x := rx if not phone else lerpf(W - 96.0, rx, scope_t)
	scope.scale = Vector2.ONE; scope.position = Vector2(sc_x, 190.0 + dy * 0.05)
	var sup_x := rx; var dmm_x := rx + 340.0
	if phone: dmm_x = W - 96.0 - 270.0; sup_x = dmm_x - 340.0
	var low := 650.0 + dy * 0.6
	supply.scale = Vector2(0.8, 0.8); supply.position = Vector2(sup_x, low + 12.0)
	dmm.scale = Vector2(0.8, 0.8); dmm.position = Vector2(dmm_x, low)
	L.tin = Rect2(sup_x + 20.0, 880 + dy * 0.8, 124, 124)
	L.customer = Rect2(780, 765 + dy, 300, 270)
	L.bubble = Rect2(1060, 815 + dy, 250, 118)
	L.next = Rect2(1070, 945 + dy, 220, 50)
	L.chit = Rect2(sc_x + 404.0, 190.0 + dy * 0.05 + 258.0, 190, 172)
	L.slip = Rect2(318, 870 + dy, 420, 160)
	L.probe_rest = {"red": Vector2(dmm_x - 52, 968 + dy * 0.8), "black": Vector2(dmm_x - 112, 998 + dy * 0.8), "ch1": Vector2(sc_x - 22.0, 700.0 + dy * 0.6)}
	L.bench = Rect2(sup_x + 4.0, low + 160.0, 250.0, 60.0)
	var bx0 := 372.0; var bx1 := (rx - 44.0) if not phone else (sup_x - 30.0)
	var region := Rect2(bx0, sill + 38.0, bx1 - bx0, 800 + dy * 0.45 - sill - 38.0)
	board_rect = Rect2(region.position, Vector2(region.size.x, region.size.y * DEPTH))
	var vsz := Vector2i(maxi(64, int(board_rect.size.x)), maxi(64, int(board_rect.size.y / DEPTH)))
	if vp.size != vsz: vp.size = vsz
	tex.position = board_rect.position; tex.size = board_rect.size
	props.L = L; top.L = L
	window.gear_hover = hover == "gear"

func _board_poly(grow: float) -> PackedVector2Array:
	var r := board_rect.grow(grow); var ts := TOP_SCALE
	var cx := r.get_center().x
	return PackedVector2Array([Vector2(cx - r.size.x * 0.5 * ts, r.position.y), Vector2(cx + r.size.x * 0.5 * ts, r.position.y), Vector2(r.end.x, r.end.y), Vector2(r.position.x, r.end.y)])

func _draw() -> void:   # the bench itself: static, redrawn on resize only
	var W := size.x; var H := size.y; var sill := float(L.get("sill", 182.0))
	S.wood_grain(self, Rect2(0, sill, W, H - sill), S.WALNUT, 11)
	# the lamp pool: warm light on the working area, darker at the corners
	S.glow(self, Vector2(W * 0.38, H * 0.55), W * 0.55, Color(1.0, 0.78, 0.45, 0.14))
	S.vgrad(self, Rect2(0, sill, W, 34), Color(0, 0, 0, 0.55), Color(0, 0, 0, 0.0), 8)       # the sill's shadow on the bench
	# cutting mat under the board
	var mat := _board_poly(30.0)
	draw_colored_polygon(PackedVector2Array(Array(mat).map(func(p): return p + Vector2(8, 12))), Color(0, 0, 0, 0.4))
	draw_colored_polygon(mat, Color("#1d3a2b"))
	var mp := Array(mat)
	for i in 4: draw_line(mp[i], mp[(i + 1) % 4], Color("#2c5640"), 3.0)
	for gi in range(1, 20):   # printed mat grid, converging with the perspective
		var k := float(gi) / 20.0
		var a: Vector2 = mp[0].lerp(mp[1], k); var b: Vector2 = mp[3].lerp(mp[2], k)
		draw_line(a, b, Color(1, 1, 1, 0.07), 1.5)
	for gj in range(1, 12):
		var k := float(gj) / 12.0
		draw_line(mp[0].lerp(mp[3], k), mp[1].lerp(mp[2], k), Color(1, 1, 1, 0.07), 1.5)
	S.text(self, S.hand(), "STALL 14  ·  LANTERN LANE", Vector2(board_rect.position.x + 12, board_rect.position.y - 16), 18, Color(1, 1, 1, 0.22))
	# solder stains and flux marks, a burn ring, a screw
	var rng := RandomNumberGenerator.new(); rng.seed = 31
	for i in 22:
		var c := Vector2(rng.randf_range(20.0, W - 20.0), rng.randf_range(sill + 30.0, H - 20.0))
		var onboard := board_rect.grow(34).has_point(c)
		if onboard: continue
		var r := rng.randf_range(3.0, 9.0)
		draw_circle(c, r * 2.2, Color(0.35, 0.2, 0.05, 0.12)); draw_circle(c, r, Color(0.12, 0.09, 0.07, 0.55)); draw_circle(c + Vector2(-r * 0.3, -r * 0.3), r * 0.3, Color(0.8, 0.8, 0.85, 0.35))
	draw_arc(Vector2(W * 0.5 + 40, H - 150), 18, 0, TAU, 20, Color(0.1, 0.05, 0.03, 0.5), 5.0)
	# the front lip of the counter and its shadow
	S.vgrad(self, Rect2(0, H - 46, W, 46), Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.5), 8)
	draw_rect(Rect2(0, H - 6, W, 6), Color("#1d130d"), true)
	# the corner vignette
	S.vgrad(self, Rect2(0, H * 0.55, W, H * 0.45), Color(0, 0, 0, 0.0), Color(0, 0, 0, 0.22), 10)

## ------------------------------------------------------------------------------------------------------------------ geometry

func vp_to_screen(v: Vector2) -> Vector2:
	var vv := v.y / maxf(float(vp.size.y), 1.0); var s := lerpf(TOP_SCALE, 1.0, vv)
	return Vector2(board_rect.position.x + board_rect.size.x * (0.5 + (v.x / maxf(float(vp.size.x), 1.0) - 0.5) * s), board_rect.position.y + vv * board_rect.size.y)

func screen_to_vp(sp: Vector2) -> Vector2:
	var vv := (sp.y - board_rect.position.y) / maxf(board_rect.size.y, 1.0); var s := lerpf(TOP_SCALE, 1.0, vv)
	var u := 0.5 + ((sp.x - board_rect.position.x) / maxf(board_rect.size.x, 1.0) - 0.5) / s
	return Vector2(u * vp.size.x, vv * vp.size.y)

func pad_screen(pad: Vector2) -> Vector2: return vp_to_screen(bench.org + pad * bench.p)

func _bw() -> int: return int(backend.ticket.board.w)
func _bh() -> int: return int(backend.ticket.board.h)

## nearest pad to a screen point within `reach` (in pads); returns Vector2(-1,-1) when none
func pad_at(sp: Vector2, reach := 0.55) -> Vector2:
	var v := screen_to_vp(sp)
	var g := (v - bench.org) / bench.p
	var pad := Vector2(roundf(g.x), roundf(g.y))
	if pad.x < 0 or pad.y < 0 or pad.x > _bw() - 1 or pad.y > _bh() - 1: return Vector2(-1, -1)
	return pad if (g - pad).length() <= reach else Vector2(-1, -1)

func part_at(sp: Vector2) -> Dictionary:
	var v := screen_to_vp(sp)
	var m: Dictionary = backend.model
	for i in range(m.parts.size() - 1, -1, -1):
		var pt: Dictionary = m.parts[i]
		var pin_px: Array = pt.pins.map(func(q): return bench.org + q * bench.p)
		var b := PartArt.screen_bounds(pt, pin_px, bench.p)
		if b.has_point(v): return pt
	return {}

func wire_at(sp: Vector2) -> String:
	var v := screen_to_vp(sp)
	for w in backend.wires:
		var pts: Array = w.path.map(func(q): return bench.org + Vector2(q[0], q[1]) * bench.p)
		for i in pts.size() - 1:
			var cp := Geometry2D.get_closest_point_to_segment(v, pts[i], pts[i + 1])
			if cp.distance_to(v) < bench.p * 0.3: return str(w.wid)
	return ""

func _probe_tip(which: String) -> Vector2:
	if drag.get("kind", "") == "probe" and drag.which == which: return drag.pos
	var pad = backend.probes.get(which, null)
	if pad != null: return pad_screen(Vector2(pad[0], pad[1]))
	return L.probe_rest[which]

func _tip_hit(sp: Vector2) -> String:
	for w in (["red", "black", "ch1"] if backend.ENGINE else ["red", "black"]):
		var tip := _probe_tip(w)
		var cp := Geometry2D.get_closest_point_to_segment(sp, tip, tip + Vector2(52, -96))
		if cp.distance_to(sp) < 24.0: return w
	return ""

func _dmm_socket(which: String) -> Vector2: return dmm.position + dmm.socket_pos(which) * dmm.scale.x
func _supply_port(which: String) -> Vector2: return supply.position + supply.port(which) * supply.scale.x

## ------------------------------------------------------------------------------------------------------------------ frame

func _process(dt: float) -> void:
	t += dt
	var key := "%s|%s|%s" % [size, phone, scope_t > 0.99]
	if phone: scope_t = move_toward(scope_t, 1.0 if scope_open else 0.0, dt * 3.5)
	if key != _lay_key or phone:
		_lay_key = key; _layout(); queue_redraw()
	if phase == "bench" and pages.mode in ["", "notebook"]: backend.step(dt)
	_sync_views(dt)

func _sync() -> void:
	bench.set_model(backend.model); bench.mark_dirty()

func _sync_views(dt: float) -> void:
	if bench.model != backend.model: _sync()
	var bt: Dictionary = backend.ticket
	# scope / supply / dmm
	scope.value = backend.scope_value(); scope.live = backend.powered; scope.locked = backend.locked
	scope.hold = clampf(backend.hold / backend.LOCK_HOLD, 0.0, 1.0); scope.smoked = not backend.smoked.is_empty()
	scope.attached = bool(backend.scope_view.get("attached", true)); scope.clip_name = str(backend.scope_view.get("clip_name", "")); scope.reading = str(backend.scope_view.get("text", ""))
	supply.on = backend.powered; supply.hover = hover == "rocker"
	dmm.set_mode(backend.dial); dmm.reading = backend.dmm(); dmm.hover_dial = hover == "dial"
	# props
	props.hot = backend.hot_k(); props.smoked = not backend.smoked.is_empty(); props.wallet = (backend.wallet_minor / 100) if backend.ENGINE else wallet; props.wallet_text = backend.wallet_text if backend.ENGINE else ""
	props.bench_state = "passed" if backend.passed else ("ready" if backend.locked else "idle"); props.bench_hover = hover == "bench"; props.show_bench = backend.ENGINE
	props.items = backend.bin(); props.hide_item = int(drag.item) if drag.get("kind", "") == "part" else -1; props.hover_item = _slot_hover
	props.hover = hover if hover in ["notebook", "tin", "box", "cat", "customer"] else ""
	if props.mood == "wow" and t > _smoke_mood_until: props.mood = "idle" if not backend.locked else "joy"
	if props.smoked or props.hot > 0.35:
		var hp := _hottest_screen()
		if hp != Vector2.ZERO: props.cat_look = (hp - (L.cat as Rect2).get_center()).normalized()
	# lock moment: chime first, the register half a second later
	if _lock_seq >= 0.0:
		if _lock_seq == 0.0: scope.flash_lock(); sfx.play("chime")
		_lock_seq += dt
		if _lock_seq > 0.55: _lock_seq = -1.0; _finish_lock()
	# bubble
	top.bubble_alpha = move_toward(top.bubble_alpha, 1.0 if (t < bubble_until and phase == "bench" and pages.mode == "") else 0.0, dt * 3.0)
	# coach slip and arrow
	top.ticket = bt; top.locked = backend.passed
	top.peek = {}
	if phone and scope_t < 0.98:   # the scope drawer is folded: a peek strip keeps the trace and the LOCK lamp in view (tap it, or Tab, to open)
		var samples: Array = []
		for k in 48: samples.append(scope._vals[(scope._head + scope.COLS - 1 - (47 - k) * 3 + scope.COLS * 2) % scope.COLS])
		top.peek = {"rect": Rect2(size.x - 92.0, scope.position.y + 6.0, 86.0, 330.0), "locked": backend.locked, "live": backend.powered, "samples": samples, "sc": bt.scope, "id": str(bt.id), "alpha": 1.0 - scope_t}
	var cv: Dictionary = backend.coach_view()
	var steps: Array = cv.steps; var ci: int = cv.cur
	pages.coach_vis = steps.map(func(s): return s.shown)
	pages.coach_steps = steps; pages.coach_cur = ci; pages.coach_done = steps.map(func(s): return s.done)
	var in_play := phase == "bench" and pages.mode == ""
	if ci >= 0 and in_play and not backend.passed:
		var st: Dictionary = steps[ci]
		top.slip_text = str(st.text); var vis := 0; var tot := 0
		for k in steps.size():
			var sk: Dictionary = steps[k]
			if not sk.shown and k != ci: continue
			tot += 1
			if k <= ci: vis += 1
		top.slip_step = "Wren's note  %d / %d" % [vis, tot]
		_fit_slip()
		top.arrow_to = _target_pos(str(st.target)); top.show_arrow = top.arrow_to != Vector2.ZERO and not drag.has("kind")
	elif backend.passed and in_play:
		top.slip_text = "Fixed! Click here (or open the notebook) for the next ticket."; top.slip_step = "Wren's note"; _fit_slip(); top.show_arrow = true; top.arrow_to = (L.notebook as Rect2).get_center() + Vector2(0, -30)
	else: top.slip_text = ""; top.show_arrow = false
	top.visible = true
	# cables, probe leads, the scope's clip lead
	top.cables = []
	var cn: Array = bt.board.connectors
	if str(bt.supply.kind) != "none":
		for c in cn:
			if c.role in ["supply", "ground"]:
				var pad := Vector2(c.pad[0], c.pad[1]); var clip := pad_screen(pad) + Vector2(36, 0)
				var lane := 0.0 if c.role == "supply" else 1.0
				var pt := _supply_port("red" if c.role == "supply" else "black")
				var gx := board_rect.end.x + 22.0 + (scope.position.x - board_rect.end.x - 60.0) * 0.5 - 14.0 * lane   # the gap between the board and the scope
				var ty := board_rect.position.y + 10.0 + 12.0 * lane
				top.cables.append({"a": pt, "b": clip, "col": Color("#c8352a") if c.role == "supply" else Color("#202226"),
					"via": [Vector2(pt.x, pt.y + 26.0 + 10.0 * lane), Vector2(gx, pt.y + 26.0 + 10.0 * lane), Vector2(gx, ty), Vector2(clip.x, ty)]})
	top.leads = []
	for w in ["red", "black"]:
		var tip := _probe_tip(w)
		top.leads.append({"from": _dmm_socket(w), "tip": tip, "col": Color("#e0453a") if w == "red" else Color("#33363c"), "on_pad": backend.probes[w] != null or (drag.get("kind", "") == "probe" and drag.which == w and drag.get("snap", Vector2(-1, -1)).x >= 0), "hover": hover == "probe_" + w})
	var bnc := scope.position + Vector2(330, 414) * scope.scale.x
	if backend.ENGINE:   # the scope's CH1 clip is a real lead: drag its tip onto the pad to measure
		var ctip := _probe_tip("ch1")
		top.leads.append({"from": bnc, "tip": ctip, "col": Color("#5fcf55"), "on_pad": backend.probes.ch1 != null or (drag.get("kind", "") == "probe" and drag.which == "ch1" and drag.get("snap", Vector2(-1, -1)).x >= 0), "hover": hover == "probe_ch1"})
		top.scope_lead = {}
	else:
		var sp := Vector2(-1, -1); var bestd := 1e9
		for p in backend.parts:
			for q in p.pins:
				var ps := pad_screen(Vector2(q[0], q[1]))
				if ps.distance_to(bnc) < bestd: bestd = ps.distance_to(bnc); sp = ps
		top.scope_lead = {} if sp.x < 0 else {"from": bnc, "to": sp + Vector2(0, 10)}
	# the part icon that follows the pointer while it is off the board
	top.held = {}
	if drag.get("kind", "") == "part" and not board_rect.grow(20).has_point(_mouse):
		top.held = {"part": props.part_dict(props.items[drag.item]), "pos": _mouse, "p": 17.0}
	elif drag.get("kind", "") == "move" and not board_rect.grow(20).has_point(_mouse):
		top.held = {"part": props.part_dict(drag.part), "pos": _mouse, "p": 17.0}
	# the board overlay: ghost, wire in progress, hovered pad
	_board_overlay()
	supply.kind = supply.kind
	window.gear_hover = hover == "gear"
	window.neon_on = true
	mouse_default_cursor_shape = Control.CURSOR_DRAG if drag.has("kind") else (Control.CURSOR_POINTING_HAND if hover != "" else Control.CURSOR_ARROW)

func _fit_slip() -> void:
	var w := 440.0
	var h := 58.0 + S.wrapped_h(S.hand(), top.slip_text, 21, w - 40.0) + 26.0
	var dy := maxf(0.0, size.y - 1080.0)
	L["slip"] = Rect2(312, 1038.0 + dy - h, w, h)

func _hottest_screen() -> Vector2:
	var best := 0.0; var out := Vector2.ZERO
	if backend.ENGINE:
		var heat: Dictionary = backend.model.get("heat", {})
		for p in backend.parts:
			var k := float(heat.get(p.uid, 0.0)) + (2.0 if backend.smoked.has(p.uid) else 0.0)
			if k > best and k > 0.3: best = k; out = pad_screen((Vector2(p.pins[0][0], p.pins[0][1]) + Vector2(p.pins[1][0], p.pins[1][1])) * 0.5)
		return out
	for p in backend.parts:
		var k := float(backend.temps.get(p.uid, 25.0)) + (200.0 if backend.smoked.has(p.uid) else 0.0)
		if k > best and k > 60.0:
			best = k; out = pad_screen((Vector2(p.pins[0][0], p.pins[0][1]) + Vector2(p.pins[1][0], p.pins[1][1])) * 0.5)
	return out

func _target_pos(name: String) -> Vector2:
	if name.begins_with("box:"):   # a particular part in the shoebox: the first slot of that part id
		var pid := name.substr(4)
		var slb := StallProps.slots(props.box_inner(), props.items.size(), props.bin_scroll)
		for i in props.items.size():
			if str(props.items[i].partId) == pid and i < slb.size() and (slb[i] as Rect2).size != Vector2.ZERO: return (slb[i] as Rect2).get_center()
		return (L.box as Rect2).get_center()
	if name.begins_with("pad:") and name.contains(","):
		var xy := name.substr(4).split(",")
		return pad_screen(Vector2(int(xy[0]), int(xy[1]))) + Vector2(10, 0)
	match name:
		"clip": return _probe_tip("ch1") if backend.ENGINE else scope.position + Vector2(220, 170) * scope.scale.x
		"bench": return (L.bench as Rect2).get_center() + Vector2(0, -26)
		"chit": return (L.chit as Rect2).get_center()
		"box":
			var sl := StallProps.slots(props.box_inner(), props.items.size(), props.bin_scroll)
			return (sl[0] as Rect2).get_center() if sl.size() > 0 and (sl[0] as Rect2).size != Vector2.ZERO else (L.box as Rect2).get_center()
		"board": return board_rect.get_center()
		"pad:IN":
			for c in backend.ticket.board.connectors: if c.id == "IN": return pad_screen(Vector2(c.pad[0], c.pad[1])) + Vector2(10, 0)
			return board_rect.get_center()
		"rocker": return supply.position + (SupplyView.ROCKER.get_center() + Vector2(0, -20)) * supply.scale.x
		"scope": return scope.position + Vector2(220, 170) * scope.scale.x
		"dmm": return dmm.position + Vector2(150, 210) * dmm.scale.x
		"customer": return (L.customer as Rect2).get_center() + Vector2(0, -90)
		"notebook": return (L.notebook as Rect2).get_center()
	return Vector2.ZERO

func _board_overlay() -> void:
	var ov := {}
	if drag.get("kind", "") in ["part", "move"]:
		var item: Dictionary = props.items[drag.item] if drag.kind == "part" else drag.part
		var v := screen_to_vp(_mouse)
		if board_rect.grow(10).has_point(_mouse) and v.x >= 0:
			var pins: Array = backend.pins_of(item, 0, 0, rot)
			var mid: Vector2 = (pins[0] + pins[1]) * 0.5
			var g: Vector2 = (v - bench.org) / bench.p - mid
			var o := Vector2(roundf(g.x), roundf(g.y))
			var why: String = backend.can_place(item, int(o.x), int(o.y), rot, str(drag.get("uid", "")))
			ov["ghost"] = {"part": _ghost_part(item, o), "ok": why == "", "origin": o, "pins": backend.pins_of(item, int(o.x), int(o.y), rot)}
			drag["place"] = o; drag["why"] = why
		else: drag["place"] = Vector2(-9999, 0)
	elif drag.get("kind", "") == "wire":
		var v2 := screen_to_vp(_mouse)
		var tp := pad_at(_mouse, 0.7)
		ov["wire"] = {"from": drag.pad, "to": v2, "target": tp}
	if not drag.has("kind"):
		var hp := pad_at(_mouse, 0.5)
		if hp.x >= 0 and hover == "board": ov["hover_pad"] = hp
	elif drag.get("kind", "") == "probe":
		var sp := pad_at(_mouse, 0.8)
		drag["snap"] = sp
		if sp.x >= 0: ov["hover_pad"] = sp
	bench.overlay = ov

func _ghost_part(item: Dictionary, o: Vector2) -> Dictionary:
	return NodeApi._norm_part({"uid": "ghost", "partId": item.partId, "value": item.value, "kind": item.kind, "x": int(o.x), "y": int(o.y), "rot": rot, "flip": false, "label": item.label})

## ------------------------------------------------------------------------------------------------------------------ input

func _gui_input(e: InputEvent) -> void:
	if pages.mode != "" and pages.mode != "notebook": return
	if e is InputEventMouseMotion: _motion(e.position)
	elif e is InputEventMouseButton:
		_mouse = e.position
		if e.pressed:
			match e.button_index:
				MOUSE_BUTTON_LEFT: _press(e.position)
				MOUSE_BUTTON_RIGHT: _right(e.position)
				MOUSE_BUTTON_WHEEL_UP: _wheel(e.position, 1)
				MOUSE_BUTTON_WHEEL_DOWN: _wheel(e.position, -1)
		elif e.button_index == MOUSE_BUTTON_LEFT: _release(e.position)

func _unhandled_key_input(e: InputEvent) -> void:
	if not (e is InputEventKey) or not e.pressed or e.echo: return
	if pages.mode == "predict": _predict_key(e); return
	match e.keycode:
		KEY_ENTER, KEY_KP_ENTER: if phase == "bench" and pages.mode == "": run_bench()
		KEY_P: if phase == "bench" and pages.mode == "" and backend.ENGINE and bool(backend.ticket.get("eb", false)): open_predict()
		KEY_SPACE: if phase == "bench" and pages.mode == "": backend.set_power(not backend.powered)
		KEY_R: rot = (rot + 1) % 4
		KEY_ESCAPE:
			if pages.mode == "notebook" or pages.mode == "settings": _on_page("close", "")
			elif phase == "bench": pages.show_page("notebook")
			elif pages.mode == "map": pages.show_page("title"); phase = "title"
		KEY_N: if phase == "bench": pages.show_page("notebook" if pages.mode == "" else "")
		KEY_F1: pages.show_page("settings")
		KEY_C: _on_page("toggle:cute", "")
		KEY_TAB: if phone: scope_open = not scope_open

func _where(sp: Vector2) -> String:
	if (window.gear_rect()).has_point(sp): return "gear"
	if _tip_hit(sp) != "": return "probe_" + _tip_hit(sp)
	if supply.hit_rocker((sp - supply.position) / supply.scale.x) and Rect2(supply.position, supply.size * supply.scale.x).has_point(sp): return "rocker"
	var dl := (sp - dmm.position) / dmm.scale.x
	if Rect2(dmm.position, dmm.size * dmm.scale.x).has_point(sp) and dmm.hit_dial(dl): return "dial"
	if phone and scope_t < 0.5 and Rect2(size.x - 96.0, scope.position.y, 96.0, 340.0).has_point(sp): return "peek"
	if Rect2(scope.position, scope.size * scope.scale.x).has_point(sp):
		var ik := scope.hit_knob((sp - scope.position) / scope.scale.x)
		return "knob%d" % ik if ik >= 0 else "scope"
	if backend.ENGINE and (L.bench as Rect2).has_point(sp): return "bench"
	if (L.notebook as Rect2).has_point(sp): return "notebook"
	if (L.tin as Rect2).grow(6).has_point(sp): return "tin"
	if (L.cat as Rect2).has_point(sp): return "cat"
	if backend.locked and _next_rect.has_point(sp): return "next"
	if (L.box as Rect2).has_point(sp): return "box"
	if (L.customer as Rect2).has_point(sp): return "customer"
	if Rect2(top.slip_rect()).has_point(sp) and top.slip_text != "" and backend.locked: return "next"
	if board_rect.grow(6).has_point(sp): return "board"
	return ""

func _motion(sp: Vector2) -> void:
	_mouse = sp
	hover = _where(sp)
	_slot_hover = -1
	if hover == "box":
		var sl := StallProps.slots(props.box_inner(), props.items.size(), props.bin_scroll)
		for i in sl.size(): if (sl[i] as Rect2).size != Vector2.ZERO and (sl[i] as Rect2).has_point(sp): _slot_hover = i
	if drag.get("kind", "") == "probe": drag.pos = sp
	# hover readouts (the Learner tooltip): node voltage and part current, only while it means something
	top.tag = {}
	if drag.is_empty() and hover == "board" and backend.powered:
		var pd := part_at(sp)
		if not pd.is_empty() and (pd.kind == "LED" or pd.kind == "R"):
			var i: float = backend.part_current(str(pd.uid))
			top.tag = {"text": "%.1f mA" % (i * 1000.0) + ("  %.2f W" % backend.part_power(str(pd.uid)) if pd.kind == "R" else ""), "pos": sp}
		else:
			var pa := pad_at(sp, 0.5)
			if pa.x >= 0: top.tag = {"text": "%.2f V" % backend.volt_at([int(pa.x), int(pa.y)]), "pos": sp}

func _press(sp: Vector2) -> void:
	hover = _where(sp)
	match hover:
		"gear": pages.show_page("settings"); sfx.play("click", 0.6); return
		"notebook": pages.show_page("notebook"); props.notebook_flag = false; sfx.play("page"); return
		"tin": sfx.play("coin"); top.say("%d coins in the tin." % wallet); props.tin_shake = 0.3; return
		"cat": sfx.play("meow", 0.6); top.say("Rezzy is " + ("awake and worried." if props.hot > 0.35 else "asleep. Leave her be.")); return
		"customer": bubble_until = t + 6.0; return
		"next": go_map(); return
		"rocker": backend.set_power(not backend.powered); return
		"bench": run_bench(); return
		"dial":
			backend.set_dial(dmm.dial_click((sp - dmm.position) / dmm.scale.x)); sfx.play("tick"); return
		"scope": if phone: scope_open = not scope_open; return
		"peek": scope_open = not scope_open; return
	if hover.begins_with("probe_"):
		var w := hover.substr(6); drag = {"kind": "probe", "which": w, "pos": sp}; backend.set_probe(w, null); return
	if hover == "box":
		if _slot_hover >= 0: drag = {"kind": "part", "item": _slot_hover}; rot = 0; sfx.play("tick")
		return
	if hover == "board":
		var pd := part_at(sp)
		var pa := pad_at(sp, 0.5)
		if pa.x >= 0 and (pd.is_empty() or pd.fixed or _near_pin(pd, pa)): drag = {"kind": "wire", "pad": pa}; return
		if not pd.is_empty() and not pd.fixed:
			var full: Dictionary = backend.part_by(str(pd.uid)); rot = int(full.rot)
			drag = {"kind": "move", "item": -1, "uid": str(pd.uid), "part": {"partId": full.partId, "value": full.value, "kind": full.kind, "label": full.label, "tag": full.get("tag", "")}}
			return
		if pa.x >= 0: drag = {"kind": "wire", "pad": pa}

func _near_pin(pd: Dictionary, pa: Vector2) -> bool:
	for q in pd.pins: if (q as Vector2) == pa: return true
	return false

func _release(sp: Vector2) -> void:
	var d := drag; drag = {}
	if d.is_empty(): return
	match d.kind:
		"part":
			var o: Vector2 = d.get("place", Vector2(-9999, 0))
			if o.x > -9000 and d.get("why", "x") == "":
				var r: Dictionary = backend.place(props.items[d.item], int(o.x), int(o.y), rot)
				if not r.ok: top.say(str(r.msg))
			elif o.x > -9000: top.say(str(d.get("why", "")))
		"move":
			if (L.box as Rect2).has_point(sp): backend.delete_part(str(d.uid)); return
			var o2: Vector2 = d.get("place", Vector2(-9999, 0))
			if o2.x > -9000:
				var r2: Dictionary = backend.move_part(str(d.uid), int(o2.x), int(o2.y), rot)
				if not r2.ok: top.say(str(r2.msg))
		"wire":
			var tp := pad_at(sp, 0.7)
			if tp.x >= 0 and tp != d.pad:
				var r3: Dictionary = backend.add_wire([int(d.pad.x), int(d.pad.y)], [int(tp.x), int(tp.y)])
				if not r3.ok and str(r3.msg) != "": top.say(str(r3.msg))
			elif (L.box as Rect2).has_point(sp):   # dragged a wire end back to the box: take the wire off that pad
				for w in backend.wires.duplicate():
					if w.a == [int(d.pad.x), int(d.pad.y)] or w.b == [int(d.pad.x), int(d.pad.y)]: backend.delete_wire(w.wid); break
		"probe":
			var sn := pad_at(sp, 0.8)
			var pr = backend.set_probe(d.which, [int(sn.x), int(sn.y)] if sn.x >= 0 else null)
			if pr is Dictionary and not pr.ok and str(pr.msg) != "": top.say(str(pr.msg))
			elif sn.x >= 0: sfx.play("tick")

func _right(sp: Vector2) -> void:
	if not drag.is_empty(): drag = {}; return
	var pd := part_at(sp)
	if not pd.is_empty() and not pd.fixed: backend.delete_part(str(pd.uid)); return
	var wid := wire_at(sp)
	if wid != "": backend.delete_wire(wid)

func _wheel(sp: Vector2, dir: int) -> void:
	var h := _where(sp)
	if h == "box" or (L.box as Rect2).has_point(sp): props.bin_scroll = clampi(props.bin_scroll - dir, 0, maxi(0, (props.items.size() + 1) / 2 - 4))
	elif h == "dial": backend.set_dial(DmmView.MODES[clampi(DmmView.MODES.find(backend.dial) + dir, 0, DmmView.MODES.size() - 1)]); sfx.play("tick")
	elif h.begins_with("knob"): scope.turn(int(h.substr(4)), float(dir))
	elif drag.get("kind", "") in ["part", "move"] or h == "board": rot = (rot + (1 if dir > 0 else 3)) % 4
