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
const EB = preload("res://stall/engine_bench.gd")
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
var _fling := 0.0                     ## shoebox scroll inertia after a swipe, rows per second
var handheld := false                 ## small physical window: 16 px text, 44 px touch targets (see _layout)
var scr_k := 1.0                      ## screen pixels per design pixel
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
var probe_jack := {"red": "", "black": ""}   ## a DMM lead resting on a supply terminal: which one ("red" = +, "black" = GND side)
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
var _bubble_passed := false
var _next_rect := Rect2()
var _ticket_ids: Array = ["1-1", "1-2", "1-3", "1-4", "1-5"]
var _flow_log: Array = []
var hover_wire := ""                 ## wid of the wire under the pointer (highlighted; right-click removes it)
var map_chapter := 1                 ## the chapter whose notebook page the map shows
const CONN_NAME := {"VP": "battery + (V+)", "GND": "GND", "IN": "IN", "OUT": "OUT", "BOX": "BOX terminal"}
const CODEX_AT := {"1-1": 0, "1-2": 1, "1-3": 3, "1-4": 4, "1-5": 6, "2-1": 9, "2-2": 11, "2-3": 10, "2-4": 13, "3-1": 16, "3-2": 20, "3-3": 21, "3-4": 15, "4-1": 27, "4-2": 29, "4-3": 30, "4-4": 31, "4-5": 29}   ## the notebook opens on the page that belongs to the ticket

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
	var eb = EB.new()
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
		"bench", "level":
			start_ticket(tk if tk != "" else "1-1")
			if OS.get_environment("CB_REF") == "1" and backend.ENGINE:   # QA hook: the ticket's reference design is already built (and its predictions entered)
				backend.build_ref(str(backend.ticket.id)); pages.show_page(""); _lay_key = ""
				if OS.get_environment("CB_POWER") == "1": backend.set_power(true)
		"map":
			if OS.get_environment("CB_CHAPTER") != "": map_chapter = int(OS.get_environment("CB_CHAPTER"))
			go_map()
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
	phase = "map"; window.dusk = 0.0
	if backend.ENGINE and not backend.ticket.is_empty() and str(backend.ticket.get("id", "")) != "" and OS.get_environment("CB_SCREEN") != "map": map_chapter = int(backend.ticket.get("chapter", map_chapter))
	_refresh_pages(); pages.show_page("map")

func start_ticket(id: String) -> void:
	if not backend.open_ticket(id):   # the engine keeps a ticket locked until the one before it is passed
		top.say("That ticket is still locked: pass the one before it first."); if phase != "bench": go_map()
		return
	top.toast_age = 99.0; top.toast_bench = false   # a message from the last ticket is not about this one
	phase = "bench"; window.dusk = 0.0; window.rain = id == "1-3" or id == "1-4" or id.begins_with("4-")   # rain on the awnings in chapter 4 (DESIGN §5.1)
	pages.codex_i = CODEX_AT.get(id, 0)   # the notebook opens on the page that belongs to this ticket
	map_chapter = int(id.substr(0, 1)) if id.length() > 1 and id.substr(0, 1).is_valid_int() else 1
	drag.clear(); probe_jack = {"red": "", "black": ""}; rot = 0; locked_at = -1.0; _lock_seq = -1.0
	_ticket_view()
	_chapter_view()
	bubble_until = t + 9.0; top.bubble = str(backend.ticket.ask); top.bubble_alpha = 0.0
	if not backend.ENGINE: dmm.set_mode("V"); backend.set_dial("V")
	_lay_key = ""; _sync(); pages.show_page("")
	props.notebook_flag = true
	if backend.ENGINE and backend.safety_pending(): pages.safety = backend.mains; pages.show_page("safety")   # a mains ticket opens with the safety card, before anything else
	elif backend.ENGINE and bool(backend.ticket.get("eb", false)) and not backend.predictions_done(): open_predict()

func _ticket_view() -> void:   # push the open ticket onto the instruments and props
	if backend.ticket.is_empty(): return
	props.mood = "idle"; props.customer = str(backend.ticket.customer); props.gadget = str(backend.ticket.gadget); props.bin_scroll = 0.0
	props.exam_fig = backend.ticket.figure if bool(backend.ticket.get("eb", false)) and backend.ticket.get("figure", null) is Dictionary else {}
	scope.sc = backend.ticket.scope; scope.locked = false
	var sp: Dictionary = backend.ticket.supply
	supply.kind = str(sp.kind) if sp.kind != "none" else "bench"
	supply.sources = sp.get("sources", [])
	supply.label = str(sp.label); supply.tired = sp.get("tired", false); supply.volts = float(sp.get("volts", sp.get("emf", 0.0)))
	supply.adjustable = bool(sp.get("adjustable", false)); supply.step_i = 0
	supply.sources_title = str(sp.get("title", "TEXTBOOK SOURCES  (ideal)")); supply.sources_note = str(sp.get("note", "wired by the ticket: just probe"))
	supply.conditions = backend.ticket.get("conditions", []) if backend.ENGINE else []
	supply.selectors = backend.selectors if backend.ENGINE else []
	if backend.ENGINE and not backend.mains.is_empty(): supply.isolation_text = str(backend.mains.get("isolation", "isolation transformer")); bench.keepout_text = str(backend.mains.get("keepOut", "HIGH VOLTAGE"))

## Props that depend on the open ticket's kind: the crew's slip of a ticket that asks for a worked-out number (2-2).
func _chapter_view() -> void:
	props.crew = {}
	var ans: Array = backend.ticket.get("answers", []) if backend.ENGINE else []
	if not ans.is_empty() and not bool(backend.ticket.get("eb", false)): props.crew = {"answers": ans}

func _refresh_pages() -> void:
	pages.cute = cute; pages.reduced = reduced; pages.sound = sound; pages.volume = volume; pages.wallet = wallet
	pages.tickets.clear()
	if backend.ENGINE:
		var pg: Dictionary = backend.progress(map_chapter)
		pages.tickets = pg.tickets; pages.wallet = int(pg.wallet); pages.wallet_text = str(pg.wallet_text)
		pages.map_chapter = map_chapter; pages.map_title = str(pg.title); pages.map_blurb = str(pg.blurb)
		pages.chapter_open = [true, _chapter_unlocked(2), _chapter_unlocked(3), _chapter_unlocked(4)]
		for tk in pg.tickets: done[str(tk.id)] = bool(tk.done)
		pages.coach_ticket = backend.ticket; return
	var prev_done := true
	for id in _ticket_ids:
		var tk: Dictionary = FixtureBench.TICKETS[id]
		var open: bool = prev_done or done.has(id) or OS.get_environment("CB_UNLOCK") == "1"
		pages.tickets.append({"id": id, "title": tk.title, "customer": tk.customer, "spec": tk.spec, "price": tk.price, "open": open, "done": done.get(id, false)})
		prev_done = done.get(id, false)
	pages.coach_ticket = backend.ticket

func _chapter_unlocked(ch: int) -> bool:
	for tk in backend.progress(ch).tickets: if str(tk.state) != "locked": return true
	return false

func _on_page(id: String, arg: String) -> void:
	sfx.play("page" if id in ["close", "goto:map", "codex"] else "click", 0.7)
	match id:
		"continue", "goto:map": go_map()
		"new":
			done.clear(); wallet = 0
			if backend.ENGINE: backend.new_game(); if not _nosave(): backend.save_game()
			_save(); go_map()
		"pred_focus": pages.pred_focus = int(arg); pages.pred_sel = true
		"pred_submit": _submit_predictions()
		"pred_close": pages.show_page("")
		"pred_sign": _toggle_sign(int(arg))
		"safety_ok": backend.read_safety(); pages.show_page(""); top.say("Safety card read. The bench is yours; the red fence stays closed.")
		"debrief_close": pages.show_page("")
		"debrief_retry": retry_exam()
		"settings": pages.show_page("settings")
		"cute", "toggle:cute": cute = not cute; _apply_prefs(); _save(); _refresh_pages()
		"toggle:reduced": reduced = not reduced; _apply_prefs(); _save(); _refresh_pages()
		"toggle:sound": sound = not sound; _apply_prefs(); _save(); _refresh_pages()
		"vol+": volume = clampf(volume + 0.1, 0.0, 1.0); _apply_prefs(); _save(); _refresh_pages()
		"vol-": volume = clampf(volume - 0.1, 0.0, 1.0); _apply_prefs(); _save(); _refresh_pages()
		"ticket": start_ticket(arg)
		"goto:title": go_title()
		"codex": pages.codex_i = int(arg)
		"chapter": map_chapter = int(arg); _refresh_pages()
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
		"placed": top.edited(); sfx.play("thunk"); props.mood = "hopeful" if props.mood == "idle" else props.mood
		"wired": top.edited(); sfx.play("zip")
		"power":
			sfx.play("click" if data.on else "clack")
			if bool(data.get("auto", false)):
				if bool(data.on): top.say_quick("The power was off: I switched it on for the bench test.")
			elif not bool(data.on): top.say_quick("Power off.")   # a short word, so the rocker's state is never a guess
		"deleted":
			top.edited(); sfx.play("page", 0.5)
			if str(data.get("note", "")) != "": top.say(str(data.note))   # e.g. "p1 removed, and 2 wire(s) that were only held by its legs."
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
			top.say_bench(str(data.get("text", "The bench check failed.")))

func _finish_lock() -> void:
	locked_at = t
	props.mood = "joy"; top.bubble = str(backend.ticket.thanks); bubble_until = t + 14.0
	if backend.ENGINE and str(backend.last_result.get("thanks", "")) != "": top.bubble = str(backend.last_result.thanks)   # the customer quotes the value the engine measured
	var price := int(backend.ticket.get("price", 0))
	if backend.ENGINE:
		wallet = backend.wallet_minor; done[str(backend.ticket.id)] = true; _refresh_pages()
		if not _nosave(): backend.save_game()
	else:
		if not done.get(str(backend.ticket.id), false): wallet += price
		done[str(backend.ticket.id)] = true
	_save()
	props.fly_coin(scope.position + Vector2(300, 170) * scope.scale.x, 6)
	sfx.play("kaching"); props.tin_shake = 0.0
	if backend.ENGINE and bool(backend.ticket.get("eb", false)) and backend.last_result.get("debrief", null) is Dictionary:   # the exam is marked: predicted vs measured, the working
		pages.debrief = backend.last_result.debrief; pages.show_page("debrief")

## ------------------------------------------------------------------------------------------------------------------ bench check and predictions (exam ticket)

## The formal bench check (the engine runs every condition; a pass pays, a fail explains with the player's own numbers).
func run_bench() -> void:
	if phase != "bench" or not backend.ENGINE or backend.ticket.is_empty(): return
	if bool(backend.ticket.get("eb", false)) and not backend.predictions_done():
		top.say("Predict first: enter your numbers on the exam slip, then bench it."); open_predict(); return
	if backend.parts.filter(func(p): return not p.fixed).is_empty() and backend.wires.filter(func(w): return not bool(w.get("fixed", false))).is_empty(): top.say("Build something first."); return
	if not bool(backend.ticket.get("eb", false)) and not backend.answers_done() and not backend.ticket.get("answers", []).is_empty():
		top.say("Write your answer on the slip first, then bench it."); open_predict(); return
	var cleaned: int = backend.clean_stray()
	if cleaned > 0: top.say_quick("Took away %d stray wire end%s." % [cleaned, "" if cleaned == 1 else "s"])
	sfx.play("click", 0.8); backend.run_bench()

## "Try again for more stars": the exam forgets its predictions (the board stays), the FIXED stamp comes off and the predict slip opens.
func retry_exam() -> void:
	if not backend.ENGINE or not backend.retry_exam(): return
	pages.show_page(""); sfx.play("page", 0.7); props.mood = "idle"; open_predict()
	top.say("Write your predictions again, then bench it again.")

func open_predict() -> void:
	pages.pred_fields = []
	for pr in backend.ticket.get("predictions", []) + backend.ticket.get("answers", []):
		pages.pred_fields.append({"id": str(pr.id), "name": str(pr.name), "unit": str(pr.unit), "text": "" if pr.get("entered", null) == null else EB._g(float(pr.entered), 6), "done": pr.get("entered", null) != null})
	pages.pred_head = ("%s  \u00b7  predict first" % str(backend.ticket.get("title", "Exam"))) if bool(backend.ticket.get("eb", false)) else ("%s  \u00b7  the crew's slip" % str(backend.ticket.get("title", "Slip")))
	pages.star_rule = str(backend.ticket.get("star_rule", ""))
	pages.pred_focus = 0; pages.pred_sel = true; pages.show_page("predict")

func set_prediction(id: String, value: float) -> Dictionary:   # also what typing then Enter does
	var r: Dictionary = backend.predict(id, value)
	if not r.ok: top.say(str(r.msg))
	return r

func _toggle_sign(i: int) -> void:   # the on-screen +/- key of the predict slip
	if i < 0 or i >= pages.pred_fields.size(): return
	var f: Dictionary = pages.pred_fields[i]
	var tx := str(f.text); f.text = tx.substr(1) if tx.begins_with("-") else "-" + tx; f.done = false
	pages.pred_focus = i; pages.pred_sel = false

func _submit_predictions() -> void:
	for f in pages.pred_fields:
		if str(f.text).strip_edges() == "": continue
		if not str(f.text).is_valid_float(): top.say("'%s' is not a number." % str(f.text)); return
		var r := set_prediction(str(f.id), float(str(f.text)))
		if r.ok: f.done = true
	if backend.predictions_done() and backend.answers_done():
		pages.show_page(""); sfx.play("page", 0.7)
		top.say("Predictions recorded. Now build it and probe." if bool(backend.ticket.get("eb", false)) else "Answer written on the slip. Now bench it.")

## The character a number-field key types: its unicode, or (when the platform sends none) the digit / point / sign the keycode stands for.
static func _field_char(e: InputEventKey) -> String:
	if e.unicode > 0: return char(e.unicode)
	if e.keycode >= KEY_0 and e.keycode <= KEY_9: return char(int(e.keycode))
	if e.keycode >= KEY_KP_0 and e.keycode <= KEY_KP_9: return char(int(e.keycode) - int(KEY_KP_0) + 48)
	match e.keycode:
		KEY_PERIOD, KEY_KP_PERIOD: return "."
		KEY_MINUS, KEY_KP_SUBTRACT: return "-"
		KEY_PLUS, KEY_KP_ADD: return "+"
	return ""

func _predict_key(e: InputEventKey) -> void:
	if e.echo and e.keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_ESCAPE, KEY_TAB, KEY_UP, KEY_DOWN]: return
	var f: Dictionary = pages.pred_fields[pages.pred_focus] if pages.pred_focus < pages.pred_fields.size() else {}
	match e.keycode:
		KEY_ESCAPE: pages.show_page("")
		KEY_TAB, KEY_DOWN: pages.pred_focus = (pages.pred_focus + 1) % maxi(1, pages.pred_fields.size()); pages.pred_sel = true
		KEY_UP: pages.pred_focus = (pages.pred_focus + pages.pred_fields.size() - 1) % maxi(1, pages.pred_fields.size()); pages.pred_sel = true
		KEY_ENTER, KEY_KP_ENTER: _submit_predictions()
		KEY_BACKSPACE:
			if not f.is_empty():
				f.text = "" if pages.pred_sel else str(f.text).substr(0, str(f.text).length() - 1); f.done = false
				pages.pred_sel = false
		_:
			var ch := _field_char(e)
			if not f.is_empty() and ch != "":
				if ch in "0123456789.-+eE":
					f.text = (ch if pages.pred_sel else str(f.text) + ch); f.done = false   # a selected field is replaced by the first key
					pages.pred_sel = false

## ------------------------------------------------------------------------------------------------------------------ chapter 2 controls

func _bump_supply(dir: float) -> void:
	var r: Dictionary = backend.set_supply(backend.supply_volts() + dir * supply.v_step())
	if not bool(r.ok) and str(r.msg) != "": top.say(str(r.msg))

## The slide wire's end pads A and B (grid coordinates) and its uid, {} when the ticket has none.
func _slide_geom() -> Dictionary:
	if not backend.ENGINE: return {}
	var sp: Dictionary = backend.slide_part()
	if sp.is_empty() or sp.pins.size() < 3: return {}
	return {"uid": str(sp.uid), "a": Vector2(sp.pins[0][0], sp.pins[0][1]), "b": Vector2(sp.pins[2][0], sp.pins[2][1])}

## Which part of the slide wire a screen point is on: "wire" (the wire and its rule: drag the jockey there), "minus" / "step" / "plus" (the nudge keys under the rule), or "".
## The keys sit on the grid under the rule (PartArt2.slide draws them from the same numbers), 1.15 pads tall: a finger-sized target on the handheld board.
const NUDGE_Y := [1.8, 3.8]                      ## the keys' HIT rows below the wire row, in pads (drawn 2.3 - 3.6): the hit area reaches up over the rule so a finger on the handheld (44 px) finds them
const NUDGE_X := {"minus": [6.0, 8.6], "step": [8.8, 11.4], "plus": [11.6, 14.2]}   ## from end A, in pads
func _slide_hit(sp: Vector2) -> String:
	var g := _slide_geom()
	if g.is_empty(): return ""
	var v: Vector2 = (screen_to_vp(sp) - bench.org) / bench.p
	var dx: float = v.x - g.a.x; var dy: float = v.y - g.a.y
	if dy >= NUDGE_Y[0] and dy <= NUDGE_Y[1]:
		for k in NUDGE_X: if dx >= NUDGE_X[k][0] - 0.1 and dx <= NUDGE_X[k][1] + 0.1: return k
		return ""
	if dx >= -0.3 and dx <= (g.b.x - g.a.x) + 0.3 and dy >= -1.0 and dy < NUDGE_Y[0]: return "wire"
	return ""

const END_REACH := 1.3                           ## pads from a slide-wire end A / B where a press belongs to the terminal (a wire), not to the jockey
func _jockey_to(sp: Vector2) -> void:
	var g := _slide_geom()
	if g.is_empty(): return
	var v: Vector2 = (screen_to_vp(sp) - bench.org) / bench.p
	var t: float = clampf((v.x - g.a.x) / maxf(g.b.x - g.a.x, 1.0), 0.0, 1.0)
	backend.set_jockey(snappedf(t * 1000.0, 0.1))

func _jockey_key(k: String) -> void:
	sfx.play("tick", 0.6)
	if k == "step": backend.cycle_jockey_step()
	else: _jockey_nudge(1.0 if k == "plus" else -1.0)

func _jockey_nudge(dir: float) -> void:
	if backend.slide_part().is_empty(): return
	backend.set_jockey(snappedf(backend.jockey_mm() + dir * backend.jockey_step_mm(), 0.1))

## ------------------------------------------------------------------------------------------------------------------ layout

func _layout() -> void:
	var W := size.x; var H := size.y
	# handheld: the window is much smaller than the 1920x1080 design (Steam Deck 1280x800): text and touch targets are sized in SCREEN pixels
	var k := float(get_window().size.x) / maxf(W, 1.0)
	var lay := OS.get_environment("CB_LAYOUT")   # handheld | desktop force a layout (tests, QA); otherwise it follows the window
	handheld = lay == "handheld" or (lay != "desktop" and k < 0.8)
	S.handheld = handheld; S.min_font = int(ceilf(16.0 / maxf(k, 0.3))) if handheld else 0; scr_k = k
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
	L.tin = Rect2(maxf(sup_x + 20.0, 1306.0), 880 + dy * 0.8, 124, 124)   # right of the exam / crew slip (1094..1290): the tin never covers it
	L.customer = Rect2(780, 765 + dy, 300, 270)
	L.bubble = Rect2(880, 678 + dy, 270, 112)   # above the customer's head (over the board's empty lower rows), never over the slip beside her
	L.next = Rect2(1306, 1000 + dy, 220, 50)
	L.exam = Rect2(1094, 816 + dy, 196, 224)   # the exam problem card (exam tickets) or the crew's slip (2-2): it stays on the bench after "later"
	L.chit = Rect2(sc_x + 404.0, 190.0 + dy * 0.05 + 266.0, 190, 186) if not handheld else Rect2(sc_x + 340.0, 190.0 + dy * 0.05 + 270.0, 270, 242)   # handheld: a bigger chit for 16 px text
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
	S.keyline(self, _hint_text(), Vector2(board_rect.position.x + 12, board_rect.end.y + 40), 17, Color(1, 1, 1, 0.34))
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

## The line under the board; keys are in [brackets] and drawn as key caps. Tickets with a slide wire add what the wire's parts do.
func _hint_text() -> String:
	var base := "drag a part in  ·  drag leg to leg to wire  ·  right-click removes  ·  [Ctrl+Z] undoes  ·  [R] turns"
	if backend != null and backend.ENGINE and scope.is_trace(): return "drag a part in  ·  drag leg to leg to wire  ·  right-click removes  ·  [Ctrl+Z] undoes  ·  [,] [.] set the sweep"
	if backend != null and backend.ENGINE and not backend.slide_part().is_empty(): return "drag from A, B, J to wire  ·  drag the jockey to slide  ·  [Ctrl+Z] undoes"
	return base

## ------------------------------------------------------------------------------------------------------------------ geometry

func vp_to_screen(v: Vector2) -> Vector2:
	var vv := v.y / maxf(float(vp.size.y), 1.0); var s := lerpf(TOP_SCALE, 1.0, vv)
	return Vector2(board_rect.position.x + board_rect.size.x * (0.5 + (v.x / maxf(float(vp.size.x), 1.0) - 0.5) * s), board_rect.position.y + vv * board_rect.size.y)

func screen_to_vp(sp: Vector2) -> Vector2:
	var vv := (sp.y - board_rect.position.y) / maxf(board_rect.size.y, 1.0); var s := lerpf(TOP_SCALE, 1.0, vv)
	var u := 0.5 + ((sp.x - board_rect.position.x) / maxf(board_rect.size.x, 1.0) - 0.5) / s
	return Vector2(u * vp.size.x, vv * vp.size.y)

func pad_screen(pad: Vector2) -> Vector2: return vp_to_screen(bench.org + pad * bench.p)

func _bw() -> int: return int(backend.ticket.get("board", {}).get("w", 24))
func _bh() -> int: return int(backend.ticket.get("board", {}).get("h", 16))

## nearest pad to a screen point within `reach` (in pads); returns Vector2(-1,-1) when none
func pad_at(sp: Vector2, reach := 0.55) -> Vector2:
	var v := screen_to_vp(sp)
	var g := (v - bench.org) / bench.p
	var pad := Vector2(roundf(g.x), roundf(g.y))
	if pad.x < 0 or pad.y < 0 or pad.x > _bw() - 1 or pad.y > _bh() - 1: return Vector2(-1, -1)
	return pad if (g - pad).length() <= reach else Vector2(-1, -1)

## What is under a screen point, for wiring: the nearest part leg or board connector within `pin_reach` pads, else the nearest empty pad within `pad_reach`.
## {kind: "pin" | "connector" | "pad" | "none", pad: Vector2, label: String}. Legs win over holes, so a wire dropped a pad off a leg still lands on the leg.
const WIRE_DROP_REACH := 1.35   # a wire dropped one pad off a leg (even with the board's perspective) still lands on the leg; a diagonal neighbour (1.41) does not
## A finger covers about two pads of a handheld screen: the leg reach grows there (the nearest leg still wins, so it never grabs a far one).
func drop_reach() -> float: return 1.9 if handheld else WIRE_DROP_REACH
func snap(sp: Vector2, pin_reach := WIRE_DROP_REACH, pad_reach := 0.7) -> Dictionary:
	var g := (screen_to_vp(sp) - bench.org) / bench.p
	var best := {"kind": "none", "pad": Vector2(-1, -1), "label": ""}
	var bd := pin_reach
	for c in _pin_index():
		var dd := g.distance_to(c.get("at", c.pad) as Vector2)   # a connector is also reached through its alligator clip (`at`)
		if dd <= bd: bd = dd; best = c
	if best.kind != "none": return best
	var pa := pad_at(sp, pad_reach)
	if pa.x >= 0: return {"kind": "pad", "pad": pa, "label": ""}
	return best

## Where a scope clip or DMM lead dropped at `sp` lands: a magnet. The nearest leg or connector within 1.7 pads (2.3 on a handheld) wins, else the hole within 0.9 pad; (-1, -1) when neither.
func _probe_drop_pad(sp: Vector2) -> Vector2:
	var sn := snap(sp, 2.3 if handheld else 1.7, 0.9)
	return sn.pad if sn.kind != "none" else Vector2(-1, -1)

## Every leg of every placed part and every board connector, with its name for the player.
func _pin_index() -> Array:
	var out: Array = []
	for pt in backend.parts:
		var labs: Array = pt.get("pin_labels", [])
		for i in pt.pins.size():
			var q: Vector2 = pt.pins[i] if pt.pins[i] is Vector2 else Vector2(pt.pins[i][0], pt.pins[i][1])
			out.append({"kind": "pin", "pad": q, "label": _leg_name(pt, i, str(labs[i]) if i < labs.size() else str(i + 1)), "uid": str(pt.uid)})
	for c in backend.ticket.get("board", {}).get("connectors", []):
		var q2 := Vector2(c.pad[0], c.pad[1])
		var dup := false
		for o in out: if (o.pad as Vector2) == q2: dup = true
		if not dup: out.append({"kind": "connector", "pad": q2, "label": str(CONN_NAME.get(str(c.id), str(c.id)))})
		if str(c.get("role", "")) in ["supply", "ground"]: out.append({"kind": "connector", "pad": q2, "at": q2 + Vector2(1.2, 0), "label": str(CONN_NAME.get(str(c.id), str(c.id)))})   # the clip sits 1.2 pads right of the pad
	return out

static func _leg_name(pt: Dictionary, i: int, lab: String) -> String:
	if str(pt.kind) == "LED": return "LED %s" % (lab.replace("-", "\u2212") + ("  (long leg)" if i == 0 else "  (flat side)"))
	return "%s  lead %s" % [str(pt.label), lab]

## The name of whatever sits on a pad (for the "wire joined" note).
func pad_label(pad: Vector2) -> String:
	for c in _pin_index(): if (c.pad as Vector2) == pad: return str(c.label)
	return "empty hole"

func _undo() -> void:
	if phase != "bench" or pages.mode != "" or not backend.ENGINE: return
	drag.clear(); top.edited()
	var r: Dictionary = backend.undo()
	if r.ok: sfx.play("page", 0.6); top.say(str(r.msg))
	else: top.say("Nothing to undo.")

func part_at(sp: Vector2) -> Dictionary:
	var v := screen_to_vp(sp)
	var m: Dictionary = backend.model
	for i in range(m.parts.size() - 1, -1, -1):
		var pt: Dictionary = m.parts[i]
		var pin_px: Array = pt.pins.map(func(q): return bench.org + q * bench.p)
		var b := PartArt.screen_bounds(pt, pin_px, bench.p)
		if b.has_point(v): return pt
	return {}

func _wire_fixed(wid: String) -> bool:
	for w in backend.wires: if str(w.wid) == wid: return bool(w.get("fixed", false))
	return false

func wire_at(sp: Vector2) -> String:
	var v := screen_to_vp(sp)
	for w in backend.wires:
		var pts: Array = w.path.map(func(q): return bench.org + Vector2(q[0], q[1]) * bench.p)
		for i in pts.size() - 1:
			var cp := Geometry2D.get_closest_point_to_segment(v, pts[i], pts[i + 1])
			if cp.distance_to(v) < bench.p * 0.34: return str(w.wid)
	return ""

func _probe_tip(which: String) -> Vector2:
	if drag.get("kind", "") == "probe" and drag.which == which: return drag.pos
	var pad = backend.probes.get(which, null)
	if pad != null:
		var jk := str(probe_jack.get(which, ""))
		if jk != "" and supply.has_jacks() and _jack_pad(jk) == Vector2(pad[0], pad[1]): return supply.position + supply.jack_pos(jk) * supply.scale.x
		return pad_screen(Vector2(pad[0], pad[1]))
	return L.probe_rest[which]

## The board connector a supply terminal is wired to: the + terminal reaches the supply connector (VP), the other the ground one.
func _jack_pad(jk: String) -> Vector2:
	for c in backend.ticket.get("board", {}).get("connectors", []):
		var gnd := str(c.get("role", "")) == "ground"
		if (jk == "black") == gnd and (gnd or str(c.get("role", "")) in ["rail", "supply", "source"]): return Vector2(c.pad[0], c.pad[1])
	return Vector2(-1, -1)

## Which supply terminal (if any) is under a screen point.
func _jack_at(sp: Vector2) -> String:
	if not Rect2(supply.position - Vector2(20, 20), supply.size * supply.scale.x + Vector2(40, 40)).has_point(sp): return ""
	var jk := supply.jack_at((sp - supply.position) / supply.scale.x)
	return jk if jk != "" and _jack_pad(jk).x >= 0.0 else ""

func _tip_hit(sp: Vector2) -> String:
	for w in (["red", "black", "ch1"] if backend.ENGINE else ["red", "black"]):
		var tip := _probe_tip(w)
		var cp := Geometry2D.get_closest_point_to_segment(sp, tip, tip + Vector2(52, -96))
		if cp.distance_to(sp) < (26.0 if not handheld else 36.0) or sp.distance_to(tip) < (42.0 if not handheld else 56.0): return w   # the metal tip is the natural place to grab: a generous disc around it
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
	if absf(_fling) > 0.05 and drag.get("kind", "") != "tray":
		props.bin_scroll = clampf(props.bin_scroll + _fling * dt, 0.0, StallProps.max_scroll(props.box_inner(), props.items.size()))
		_fling *= pow(0.04, dt)
	if phase == "bench" and pages.mode in ["", "notebook"]: backend.step(dt)
	_sync_views(dt)

## The hover readout ("30.9 mA 0.21 W") describes the board as it was when the pointer last moved: any edit (a part removed, undo, power) clears it and re-reads what is under the pointer now.
var _tag_key := ""
func _refresh_hover_tag() -> void:
	if not backend.ENGINE: return
	var k := "%s|%s|%s|%d|%d" % [backend._board_key(), backend.powered, backend.smoked.size(), backend.parts.size(), backend.wires.size()]
	if k == _tag_key: return
	_tag_key = k; top.tag = {}
	if drag.is_empty() and phase == "bench": _motion(_mouse)

func _sync() -> void:
	bench.set_model(backend.model); bench.mark_dirty()

func _sync_views(dt: float) -> void:
	if bench.model != backend.model: _sync()
	_refresh_hover_tag()
	var bt: Dictionary = backend.ticket
	# scope / supply / dmm
	scope.value = backend.scope_value(); scope.live = backend.powered; scope.locked = backend.locked
	scope.hold = clampf(backend.hold / backend.LOCK_HOLD, 0.0, 1.0); scope.smoked = not backend.smoked.is_empty()
	scope.attached = bool(backend.scope_view.get("attached", true)); scope.clip_name = str(backend.scope_view.get("clip_name", "")); scope.reading = str(backend.scope_view.get("text", "")); scope.slide = str(backend.scope_view.get("slide", ""))
	supply.on = backend.powered; supply.hover = hover == "rocker"
	if backend.ENGINE:
		supply.selectors = backend.selectors   # the live switches follow the engine's positions
		top.cam_rect = Rect2(board_rect.end.x - 214.0, board_rect.position.y - 44.0, 200.0, 36.0) if backend.camera_ok and phase == "bench" else Rect2()
		top.cam_on = backend.camera
	if supply.adjustable: supply.volts = backend.supply_volts()
	if drag.get("kind", "") != "probe": supply.jack_glow = ""
	dmm.set_mode(backend.dial); dmm.reading = backend.dmm(); dmm.hover_dial = hover == "dial"
	# props
	props.hot = backend.hot_k(); props.smoked = not backend.smoked.is_empty(); props.wallet = (backend.wallet_minor / 100) if backend.ENGINE else wallet; props.wallet_text = backend.wallet_text if backend.ENGINE else ""
	props.bench_state = "passed" if backend.passed else ("ready" if backend.locked else "idle"); props.bench_hover = hover == "bench"; props.show_bench = backend.ENGINE
	props.set_items(backend.bin()); props.hide_item = int(drag.item) if drag.get("kind", "") == "part" else -1; props.hover_item = _slot_hover
	props.hover = hover if hover in ["notebook", "tin", "box", "cat", "customer", "exam"] else ""
	props.exam_open = backend.ENGINE and not backend.predictions_done()
	props.exam_retry = backend.ENGINE and backend.passed and bool(backend.last_result.get("retry", false))
	if not props.crew.is_empty(): props.crew = {"answers": backend.ticket.get("answers", [])}
	# joy (the smile, the working gadget) belongs to a PASSED bench only; a held live band is just "let's see"
	if props.mood == "wow" and t > _smoke_mood_until: props.mood = "joy" if backend.passed else ("hopeful" if backend.locked else "idle")
	elif props.mood == "joy" and not backend.passed and _lock_seq < 0.0: props.mood = "hopeful"
	if props.smoked or props.hot > 0.35:
		var hp := _hottest_screen()
		if hp != Vector2.ZERO: props.cat_look = (hp - (L.cat as Rect2).get_center()).normalized()
	# lock moment: chime first, the register half a second later
	if _lock_seq >= 0.0:
		if _lock_seq == 0.0: scope.flash_lock(); sfx.play("chime")
		_lock_seq += dt
		if _lock_seq > 0.55: _lock_seq = -1.0; _finish_lock()
	# the customer's line follows the passed state: the ask until the bench passes, the thanks (quoting the measured value) after it
	if backend.ENGINE and backend.passed != _bubble_passed and not bt.is_empty():
		_bubble_passed = backend.passed
		if phase == "bench":
			top.bubble = (str(backend.last_result.get("thanks", "")) if str(backend.last_result.get("thanks", "")) != "" else str(bt.thanks)) if backend.passed else str(bt.ask)
			bubble_until = t + (14.0 if backend.passed else 6.0)
	# bubble
	top.bubble_alpha = move_toward(top.bubble_alpha, 1.0 if (t < bubble_until and phase == "bench" and pages.mode == "" and props.exam_fig.is_empty()) else 0.0, dt * 3.0)
	# coach slip and arrow
	top.ticket = bt; top.locked = backend.passed
	pages.coach_ticket = bt   # the notebook's page header is always the ticket that is open now
	top.peek = {}
	if phone and scope_t < 0.98:   # the scope drawer is folded: a peek strip keeps the trace and the LOCK lamp in view (tap it, or Tab, to open)
		var samples: Array = []
		for k in 48: samples.append(scope._vals[(scope._head + scope.COLS - 1 - (47 - k) * 3 + scope.COLS * 2) % scope.COLS])
		top.peek = {"rect": Rect2(size.x - 92.0, scope.position.y + 6.0, 86.0, 330.0), "locked": backend.locked, "live": backend.powered, "samples": samples, "sc": bt.get("scope", {}), "id": str(bt.get("id", "")), "alpha": 1.0 - scope_t}
	var cv: Dictionary = backend.coach_view()
	var steps: Array = cv.steps; var ci: int = cv.cur
	pages.coach_vis = steps.map(func(s): return s.shown)
	pages.coach_steps = steps; pages.coach_cur = ci; pages.coach_done = steps.map(func(s): return s.done); pages.coach_opt = steps.map(func(s): return s.get("optional", false))
	var in_play := phase == "bench" and pages.mode == ""
	if ci >= 0 and in_play and not backend.passed:
		var st: Dictionary = steps[ci]
		top.slip_text = str(st.text); var vis := 0; var tot := 0
		for k in steps.size():
			var sk: Dictionary = steps[k]
			if not sk.shown and k != ci: continue
			tot += 1
			if k <= ci: vis += 1
		if int(cv.get("step_total", -1)) > 0: vis = int(cv.step_no); tot = int(cv.step_total)   # the engine numbers the steps: the total never moves mid-ticket
		top.slip_step = "Wren's note  %d / %d" % [vis, tot] + ("  (back a step: you undid one)" if bool(cv.get("back", false)) else "")
		_fit_slip()
		top.arrow_to = _target_pos(str(st.target)); top.show_arrow = top.arrow_to != Vector2.ZERO and not drag.has("kind")
	elif backend.passed and in_play:
		top.slip_text = "Fixed! Click here (or open the notebook) for the next ticket."; top.slip_step = "Wren's note"; _fit_slip(); top.show_arrow = true; top.arrow_to = (L.notebook as Rect2).get_center() + Vector2(0, -30)
	else: top.slip_text = ""; top.show_arrow = false
	top.visible = true
	# cables, probe leads, the scope's clip lead
	top.cables = []
	var cn: Array = bt.board.connectors if bt.has("board") else []
	if bt.has("supply") and str(bt.supply.get("kind", "none")) in ["pp3", "bench"]:   # (exam sources are fixed on the board: no cables)
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
			for c in backend.ticket.get("board", {}).get("connectors", []): if c.id == "IN": return pad_screen(Vector2(c.pad[0], c.pad[1])) + Vector2(10, 0)
			return board_rect.get_center()
		"rocker": return supply.position + (SupplyView.ROCKER.get_center() + Vector2(0, -20)) * supply.scale.x
		"supplyv": return supply.position + Vector2(120, 70) * supply.scale.x
		"jockey":
			var sg := _slide_geom()
			if sg.is_empty(): return board_rect.get_center()
			return pad_screen(Vector2(lerpf(sg.a.x, sg.b.x, backend.jockey_mm() / 1000.0), sg.a.y - 0.3)) + Vector2(0, -6)
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
		var sn := snap(_mouse, drop_reach(), 0.7)
		var pinned: bool = sn.kind == "pin" or sn.kind == "connector"
		ov["wire"] = {"from": drag.pad, "to": v2, "target": sn.pad if sn.kind != "none" else Vector2(-1, -1),
			"label": str(sn.label) if pinned else ("empty hole: a wire ending here touches no leg" if sn.kind == "pad" else ""), "bad": sn.kind == "pad"}
	if not drag.has("kind"):
		var sn2 := snap(_mouse, 0.8, 0.5)
		if sn2.kind != "none" and hover == "board":
			ov["hover_pad"] = sn2.pad
			if sn2.kind == "pin" or sn2.kind == "connector": ov["hover_label"] = str(sn2.label)
		if hover_wire != "" and hover == "board" and not ov.has("hover_label"): ov["hover_wire"] = hover_wire
	elif drag.get("kind", "") == "probe":
		var jh := _jack_at(_mouse) if drag.which != "ch1" else ""
		supply.jack_glow = jh
		var sp := _probe_drop_pad(_mouse) if jh == "" else _jack_pad(jh)
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
	if not (e is InputEventKey) or not e.pressed: return
	if pages.mode == "predict": _predict_key(e); return   # typing in a field keeps every press, even one the OS flags as auto-repeat (fast "9.9" on some keyboards): a held digit repeats like any text field
	if e.echo: return
	match e.keycode:
		KEY_ENTER, KEY_KP_ENTER: if phase == "bench" and pages.mode == "": run_bench()
		KEY_P: if phase == "bench" and pages.mode == "" and backend.ENGINE and bool(backend.ticket.get("eb", false)): open_predict()
		KEY_SPACE: if phase == "bench" and pages.mode == "": backend.set_power(not backend.powered)
		KEY_Z: if e.ctrl_pressed or e.meta_pressed: _undo()
		KEY_U: _undo()
		KEY_R: rot = (rot + 1) % 4
		KEY_LEFT: if phase == "bench" and pages.mode == "": _jockey_nudge(-1.0)
		KEY_RIGHT: if phase == "bench" and pages.mode == "": _jockey_nudge(1.0)
		KEY_UP: if phase == "bench" and pages.mode == "" and supply.adjustable: _bump_supply(1.0)
		KEY_DOWN: if phase == "bench" and pages.mode == "" and supply.adjustable: _bump_supply(-1.0)
		KEY_ESCAPE:
			if pages.mode == "notebook" or pages.mode == "settings": _on_page("close", "")
			elif pages.mode == "predict": pages.show_page("")
			elif pages.mode == "debrief": pages.show_page("")
			elif pages.mode == "map": pages.show_page("title"); phase = "title"
		KEY_N: if phase == "bench" and pages.mode != "safety": pages.show_page("notebook" if pages.mode == "" else "")
		KEY_F1: if pages.mode != "safety": pages.show_page("settings")
		KEY_C: _on_page("toggle:cute", "")
		KEY_TAB: if phone: scope_open = not scope_open
		KEY_T: if phase == "bench" and pages.mode == "": _toggle_camera()
		KEY_A: if phase == "bench" and pages.mode == "" and scope.is_trace() and bool(scope.sc.get("ac_avail", false)): backend.toggle_ac(); top.say_quick("CH1 is %s coupled." % ("AC" if bool(scope.sc.get("ac_on", false)) else "DC"))
		KEY_COMMA: if phase == "bench" and pages.mode == "": _scope_knob(1, -1)
		KEY_PERIOD: if phase == "bench" and pages.mode == "": _scope_knob(1, 1)

func _where(sp: Vector2) -> String:
	if (window.gear_rect()).has_point(sp): return "gear"
	if _tip_hit(sp) != "": return "probe_" + _tip_hit(sp)
	if supply.hit_rocker((sp - supply.position) / supply.scale.x) and Rect2(supply.position, supply.size * supply.scale.x).has_point(sp): return "rocker"
	if not supply.selectors.is_empty() and Rect2(supply.position, supply.size * supply.scale.x).has_point(sp):
		var sk := supply.hit_sel((sp - supply.position) / supply.scale.x)
		if sk != "": return sk
	if top.cam_rect.size != Vector2.ZERO and top.cam_rect.has_point(sp): return "cam"
	if supply.adjustable and Rect2(supply.position, supply.size * supply.scale.x).has_point(sp):
		var vk := supply.hit_vadj((sp - supply.position) / supply.scale.x)
		if vk != "": return vk
	var dl := (sp - dmm.position) / dmm.scale.x
	if Rect2(dmm.position, dmm.size * dmm.scale.x).has_point(sp) and dmm.hit_dial(dl): return "dial"
	if phone and scope_t < 0.5 and Rect2(size.x - 96.0, scope.position.y, 96.0, 340.0).has_point(sp): return "peek"
	if Rect2(scope.position, scope.size * scope.scale.x).has_point(sp):
		var ik := scope.hit_knob((sp - scope.position) / scope.scale.x)
		return "knob%d" % ik if ik >= 0 else "scope"
	if backend.ENGINE and (L.bench as Rect2).has_point(sp): return "bench"
	if (not props.exam_fig.is_empty() or not props.crew.is_empty()) and (L.exam as Rect2).has_point(sp): return "exam"
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
	if hover == "box" and props.box_inner().has_point(sp):
		var sl := StallProps.slots(props.box_inner(), props.items.size(), props.bin_scroll)
		for i in sl.size(): if (sl[i] as Rect2).size != Vector2.ZERO and (sl[i] as Rect2).has_point(sp): _slot_hover = i
	if drag.get("kind", "") == "probe": drag.pos = sp
	elif drag.get("kind", "") == "jockey": _jockey_to(sp)
	elif drag.get("kind", "") == "tray": _tray_motion(sp)
	hover_wire = ""
	if drag.is_empty() and hover == "board" and snap(sp, 0.6, 0.0).kind == "none" and part_at(sp).is_empty():
		hover_wire = wire_at(sp)
	# hover readouts (the Learner tooltip): node voltage and part current, only while it means something
	top.tag = {}
	if hover_wire != "": top.tag = {"text": "soldered in place" if _wire_fixed(hover_wire) else "right-click to remove", "pos": sp}
	elif drag.is_empty() and hover == "board" and _slide_hit(sp) == "wire" and snap(sp, 0.6, 0.0).kind == "none": top.tag = {"text": "click along the wire or drag the jockey; drag from A, B or J to wire", "pos": sp}
	elif drag.is_empty() and hover == "board" and backend.powered:
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
		"exam":
			if backend.ENGINE and backend.passed and backend.last_result.get("debrief", null) is Dictionary: pages.debrief = backend.last_result.debrief; pages.show_page("debrief")
			else: open_predict()
			sfx.play("page", 0.6); return
		"next": go_map(); return
		"rocker": backend.set_power(not backend.powered); return
		"v-", "v+": _bump_supply(1.0 if hover == "v+" else -1.0); sfx.play("tick"); return
		"vstep": supply.step_i = (supply.step_i + 1) % 3; sfx.play("tick"); return
		"bench": run_bench(); return
		"cam": _toggle_camera(); return
		"dial":
			backend.set_dial(dmm.dial_click((sp - dmm.position) / dmm.scale.x)); sfx.play("tick"); return
		"scope": if phone: scope_open = not scope_open; return
		"peek": scope_open = not scope_open; return
		"knob0", "knob1": _scope_knob(int(hover.substr(4)), 1); return
		"knob2":
			if scope.is_trace() and bool(scope.sc.get("ac_avail", false)): backend.toggle_ac(); sfx.play("click", 0.6); top.say_quick("CH1 is %s coupled." % ("AC" if bool(scope.sc.get("ac_on", false)) else "DC"))
			return
	if hover.begins_with("sel:"):
		var pr := hover.split(":"); var sd: Dictionary = backend.selectors[int(pr[1])]
		var r: Dictionary = backend.set_selector(str(sd.id), int(pr[2]))
		if bool(r.get("ok", false)): supply.selectors = backend.selectors; sfx.play("click", 0.6); scope.live = backend.powered
		return
	if hover.begins_with("probe_"):
		var w := hover.substr(6); drag = {"kind": "probe", "which": w, "pos": sp}; backend.set_probe(w, null); probe_jack[w] = ""; return
	if hover == "box":
		var chip = props.chip_at(sp)
		if chip != null: props.rating_filter = str(chip); props.bin_scroll = 0.0; sfx.play("click", 0.5); return
		if props.box_inner().grow(4).has_point(sp):
			_fling = 0.0; rot = 0
			drag = {"kind": "tray", "item": _slot_hover, "start": sp, "scroll0": props.bin_scroll, "mode": "", "last": sp, "lt": t}
		return
	if hover == "board":
		var pd := part_at(sp)
		var pa := pad_at(sp, 0.5)
		var sn := snap(sp, 0.6 * (2.0 if handheld else 1.0), 0.5)   # a press near a leg or connector starts a wire from that leg (a fatter reach for a finger)
		if sn.kind == "pin" or sn.kind == "connector": drag = {"kind": "wire", "pad": sn.pad}; return
		var jk := _slide_hit(sp)
		if (pd.is_empty() or pd.fixed) and jk != "":   # the slide wire: its jockey keys, or the wire itself (drag the jockey to the pointer)
			if jk == "wire":
				var g := _slide_geom(); var v: Vector2 = (screen_to_vp(sp) - bench.org) / bench.p
				if v.x - g.a.x < END_REACH or g.b.x - v.x < END_REACH:   # a press at a wire end is the terminal: it makes a wire, never moves the jockey
					drag = {"kind": "wire", "pad": g.a if (v.x - g.a.x) < (g.b.x - v.x) else g.b}; return
				drag = {"kind": "jockey"}; _jockey_to(sp)   # a click along the wire puts the jockey there; a drag from the jockey (or the wire) slides it
			else: _jockey_key(jk)
			return
		if pa.x >= 0 and (pd.is_empty() or pd.fixed or _near_pin(pd, pa)): drag = {"kind": "wire", "pad": pa}; return
		if not pd.is_empty() and not pd.fixed:
			var leg := _leg_at(pd, sp)   # a press on the lead between a leg and the body wires from that leg; only the body itself drags the part
			if leg.x >= 0: drag = {"kind": "wire", "pad": leg}; return
			var full: Dictionary = backend.part_by(str(pd.uid)); rot = int(full.rot)
			drag = {"kind": "move", "item": -1, "uid": str(pd.uid), "part": {"partId": full.partId, "value": full.value, "kind": full.kind, "label": full.label, "tag": full.get("tag", "")}}
			return
		if pa.x >= 0: drag = {"kind": "wire", "pad": pa}

## The leg (pin pad) a press lands on when it is on a part's lead rather than its body, else Vector2(-1, -1). The body is the middle of the part along its legs
## (a resistor's tube, an LED's dome); everything between a body and its leg tip is lead, and a drag from there is always a wire.
func _leg_at(pd: Dictionary, sp: Vector2) -> Vector2:
	var pins: Array = pd.pins
	if pins.size() < 2: return Vector2(-1, -1)
	var g := (screen_to_vp(sp) - bench.org) / bench.p
	var c := Vector2.ZERO; var span := 0.0
	for q in pins: c += q as Vector2
	c /= float(pins.size())
	for a in pins: for b in pins: span = maxf(span, (a as Vector2).distance_to(b as Vector2))
	var body_r := maxf(0.45, span * 0.26)
	if g.distance_to(c) <= body_r: return Vector2(-1, -1)
	var best := Vector2(-1, -1); var bd := 1e9
	for q in pins:
		var dq := g.distance_to(q as Vector2)
		if dq < bd: bd = dq; best = q as Vector2
	return best

func _near_pin(pd: Dictionary, pa: Vector2) -> bool:
	for q in pd.pins: if (q as Vector2) == pa: return true
	return false

## A press in the shoebox: a mostly vertical drag scrolls the box (like a finger on a list); a sideways drag, or one that leaves the box, lifts the part under the press.
func _tray_motion(sp: Vector2) -> void:
	var dv: Vector2 = sp - (drag.start as Vector2)
	if drag.mode == "":
		if absf(dv.y) > 10.0 and absf(dv.y) > absf(dv.x) * 1.2: drag.mode = "scroll"
		elif int(drag.item) >= 0 and dv.length() > 14.0 and (absf(dv.x) >= absf(dv.y) * 0.8 or not props.box_inner().has_point(sp)): _tray_lift(); return
	if drag.mode == "scroll":
		var dt := maxf(t - float(drag.lt), 0.001)
		_fling = clampf((float(drag.last.y) - sp.y) / StallProps.row_h() / dt, -14.0, 14.0)
		drag.last = sp; drag.lt = t
		props.bin_scroll = clampf(float(drag.scroll0) - dv.y / StallProps.row_h(), 0.0, StallProps.max_scroll(props.box_inner(), props.items.size()))

func _tray_lift() -> void:
	var item := int(drag.item)
	drag = {"kind": "part", "item": item}; sfx.play("tick")   # (the rotation was reset when the box was pressed: R before the drag still counts)

func _release(sp: Vector2) -> void:
	if drag.get("kind", "") == "tray":
		if int(drag.item) >= 0 and drag.mode == "" and (sp - (drag.start as Vector2)).length() > 14.0: _tray_lift()
		elif drag.mode != "scroll": _fling = 0.0
	if drag.get("kind", "") in ["part", "move"]: _mouse = sp; _board_overlay()   # drop where the pointer is NOW, not where the last drawn frame saw it
	var d := drag; drag = {}
	if d.is_empty(): return
	match d.kind:
		"jockey": top.say_quick("Jockey at %s cm." % String.num(backend.jockey_mm() / 10.0, 2))
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
			var tgt := snap(sp, drop_reach(), 0.7)   # the end snaps to the nearest leg or connector within reach, else to the hole
			var tp: Vector2 = tgt.pad
			if tgt.kind == "pad" and tp.distance_to(d.pad) < 1.5: tgt = {"kind": "none", "pad": tp}   # a failed drag that went nowhere leaves no stray end behind
			if tgt.kind != "none" and tp != d.pad:
				var r3: Dictionary = backend.add_wire([int(d.pad.x), int(d.pad.y)], [int(tp.x), int(tp.y)])
				if not r3.ok and str(r3.msg) != "": top.say(str(r3.msg))
				elif r3.ok:
					var dang: Array = r3.get("dangling", [])
					if not dang.is_empty() or str(r3.get("note", "")).contains("do NOT touch"): top.say(str(r3.get("note", "")))   # the end touches no leg, or the wire only passes another one: the engine says so
					else: top.say_quick("Wire joined: %s  to  %s." % [pad_label(d.pad), pad_label(tp)])
			elif (L.box as Rect2).has_point(sp):   # dragged a wire end back to the box: take the wire off that pad
				for w in backend.wires.duplicate():
					if (w.a == [int(d.pad.x), int(d.pad.y)] or w.b == [int(d.pad.x), int(d.pad.y)]) and not bool(w.get("fixed", false)): backend.delete_wire(w.wid); break
		"probe":
			var jk := _jack_at(sp) if d.which != "ch1" else ""   # a lead dropped on a battery / supply terminal reads that net
			var sn := _jack_pad(jk) if jk != "" else _probe_drop_pad(sp)
			probe_jack[d.which] = jk
			var pr = backend.set_probe(d.which, [int(sn.x), int(sn.y)] if sn.x >= 0 else null)
			if pr is Dictionary and not pr.ok and str(pr.msg) != "": top.say(str(pr.msg))
			elif sn.x >= 0: sfx.play("tick")

## The scope's knobs of a time trace: TIME (knob 1) steps the sweep length (the engine restarts the sweep and redraws the tube), VOLTS (knob 0) the vertical scale; other knobs only turn.
## The thermal camera (chapter 4): a false-colour overlay with the degrees on every hot part (key T or the chip above the board).
func _toggle_camera() -> void:
	if not backend.ENGINE or not backend.camera_ok: return
	backend.camera = not backend.camera; backend._rebuild_model(); sfx.play("click", 0.6)
	top.say_quick("Thermal camera %s." % ("on: colours are the engine's temperatures" if backend.camera else "off"))

func _scope_knob(i: int, dir: int) -> void:
	scope.turn(i, float(dir))
	if not backend.ENGINE or not scope.is_trace(): return
	if i == 1:
		var r: Dictionary = backend.set_time_div(dir)
		if not bool(r.get("ok", false)) and dir > 0: r = backend.set_time_div(-99)   # past the longest sweep, round to the shortest
		if bool(r.get("ok", false)): sfx.play("tick"); top.say_quick("Sweep: %s per division." % ScopeView.tfmt(float(r.get("tpd", 0.0))))
	elif i == 0: scope.volts_step(dir); sfx.play("tick")

func _right(sp: Vector2) -> void:
	if not drag.is_empty(): drag = {}; return
	if _where(sp) == "knob1" or _where(sp) == "knob0": _scope_knob(int(_where(sp).substr(4)), -1); return
	var pd := part_at(sp)
	if not pd.is_empty() and not pd.fixed: backend.delete_part(str(pd.uid)); return
	var wid := wire_at(sp)
	if wid != "":
		var r = backend.delete_wire(wid)
		if r is Dictionary and not bool(r.get("ok", true)): top.say(str(r.get("msg", "")))

const WHEEL_ROWS := 2.5   # a wheel notch moves two and a half rows: fifteen parts are not a long drive
func _scroll_box(rows: float) -> void:   # a wheel notch is one row, never past the last row the box really has
	props.bin_scroll = clampf(props.bin_scroll + rows, 0.0, StallProps.max_scroll(props.box_inner(), props.items.size()))

func _wheel(sp: Vector2, dir: int) -> void:
	if S.handheld and top.toast_age < top.toast_dur and top.toast_rect.has_point(sp): top.toast_scroll = maxi(0, top.toast_scroll - dir); return   # the docked message card scrolls
	var h := _where(sp)
	if h == "box" or (L.box as Rect2).has_point(sp): _fling = 0.0; _scroll_box(-float(dir) * WHEEL_ROWS)
	elif h == "dial": backend.set_dial(DmmView.MODES[clampi(DmmView.MODES.find(backend.dial) + dir, 0, DmmView.MODES.size() - 1)]); sfx.play("tick")
	elif supply.adjustable and Rect2(supply.position, supply.size * supply.scale.x).has_point(sp): _bump_supply(float(dir))
	elif h == "board" and _slide_hit(sp) != "": _jockey_nudge(float(dir))
	elif h.begins_with("knob"): _scope_knob(int(h.substr(4)), dir)
	elif drag.get("kind", "") in ["part", "move"] or h == "board": rot = (rot + (1 if dir > 0 else 3)) % 4
