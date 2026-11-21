class_name BenchView
extends Control
## The bench world (M2-4, DESIGN §5): walnut bench -> matte-black perfboard with gold pads and a silkscreen grid -> wires and parts drawn in
## code -> living overlays (node-voltage tint, current dots, heat glow, LED bloom, smoke). It shows only what the engine says, read through
## NodeApi (the thin adapter that documents the query shapes). With no engine data it shows an empty board.
##
## Env hooks (screenshots / QA): CB_BOARD=<json path or fixture name> renders that board without the engine, CB_POWER=1 powers it
## (in engine mode it sends `power(true)` once), CB_SMOKEDEMO=led|res|cap forces that part to be smoked, CB_CAM=close|wide|full|<zoom>.
## The app tells the view how much of the right side a drawer covers (set_cover).

class Layer extends Control:
	var fn: Callable
	func _init(f: Callable, add := false) -> void:
		fn = f; mouse_filter = Control.MOUSE_FILTER_IGNORE; set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		if add:
			var mat := CanvasItemMaterial.new(); mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; material = mat
	func _draw() -> void: fn.call(self)

const SS = preload("res://stall/stall_style.gd")   ## handheld minimum text size lives here
const WALNUT := Color("#3B2A20")
const MASK := Color("#14161A")
const PAD_GOLD := Color("#D4A74A")
const SLATE := Color("#5B6573")
const AMBER := Color("#FFB547")
const CYAN := Color("#38D6FF")
const MAGENTA := Color("#FF4FA3")
const SMOKE_GREY := Color("#8C96A3")
var _spacing := 0.65
const DOT_SPACING := 0.65   # pads between current dots (density is fixed; speed carries the magnitude)
const FIXTURE_DEFAULT := "res://world/fixtures/led_9v.json"

static var _glow_tex: Texture2D

var app
var stall := ""
var lane := ""
var card: Dictionary = {}
var cover := 0.0
var blocked := false
var title_mode := false
var zoom := 1.0
var electron_flow := false
var show_ratings := true
var embedded := false           ## true inside the stall: no walnut or captions, no margins; StallScene owns the bench around it
var reduced_motion := false
var cute := false               ## Cute mode: electron critters for the current dots, LED faces; charm encodes physics

var model: Dictionary = {}
var source := "none"            ## "none" | "engine" | "fixture"
var t := 0.0
var p := 40.0                   ## pixels per pad (pitch)
var org := Vector2.ZERO         ## screen position of pad (0, 0)
var board_rect := Rect2()
var _dsign: Dictionary = {}
var _phase: Dictionary = {}     ## id -> dot phase (pad units), accumulated so a speed change never jumps the dots
var _smoke: Array = []          ## particles {pos, vel, age, life, r, seed}
var _emit: Dictionary = {}      ## uid -> emit accumulator
var _burst: Dictionary = {}     ## uid -> true once its pop has fired
var _vent_t: Dictionary = {}    ## uid -> seconds since a capacitor's vent popped (the puff settles)
var _click_t: Dictionary = {}   ## uid -> seconds since a relay's armature last changed state (the click)
var _relay_was: Dictionary = {} ## uid -> the armature's last state
var _bounce_t := 0.0            ## seconds since a bench contact last changed (the arcade button chatters for a moment)
var _contact_was: Dictionary = {}
var _layout_key := ""
var _parts_dirty := true
var _power_env := false
var _power_sent := false
var _smoke_demo := ""
var _smoke_demo_done := false
var _parts_layer: Layer
var _glow_layer: Layer
var _fx_layer: Layer
var _empty: Dictionary

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_empty = NodeApi.normalise({"board": {"w": 24, "h": 16}})
	_parts_layer = Layer.new(_draw_parts); add_child(_parts_layer)
	_glow_layer = Layer.new(_draw_glow, true); add_child(_glow_layer)
	_fx_layer = Layer.new(_draw_fx); add_child(_fx_layer)
	if embedded: mouse_filter = Control.MOUSE_FILTER_IGNORE
	_power_env = OS.get_environment("CB_POWER") == "1"
	_smoke_demo = OS.get_environment("CB_SMOKEDEMO").to_lower()
	var bp := OS.get_environment("CB_BOARD")
	if bp == "" and _smoke_demo != "": bp = FIXTURE_DEFAULT
	if bp != "":
		var mm := NodeApi.load_fixture(bp)
		if mm.is_empty(): push_warning("CB_BOARD: could not read %s" % bp)
		else: _set_model(mm, "fixture")
	set_process(true)

## Stall mode: the view lives in a SubViewport the size of the board area and shows the model the backend hands it.
func set_model(mm: Dictionary) -> void:
	if mm.is_empty(): return
	if not is_same(model, mm):
		model = mm; source = "fixture"; _parts_dirty = true; _relayout_if_needed()
		_restyle_if_needed()
func mark_dirty() -> void: _parts_dirty = true

## The board art (mask, silkscreen, brass connectors) is drawn by this control's own _draw, which Godot only re-runs on queue_redraw: a new ticket
## with the same board size but other connectors (1-4 -> 1-5) must repaint it, or the last ticket's rail stays on the bench.
var _art_key := ""
var art_repaints := 0             ## how many times a new ticket's board art asked for a repaint (the tests read it)
func art_signature(mm: Dictionary) -> String:
	var cs: Array = []
	for c in mm.get("connectors", []): cs.append("%s@%s,%s:%s" % [str(c.get("id", "")), str(c.pad.x), str(c.pad.y), str(c.get("role", ""))])
	return "%sx%s|%s" % [str(mm.get("w", 0)), str(mm.get("h", 0)), ",".join(cs)]
func _restyle_if_needed() -> void:
	var k := art_signature(_m())
	if k != _art_key: _art_key = k; art_repaints += 1; queue_redraw()
func _relayout_if_needed() -> void:
	var m := _m()
	var key := "%d,%d" % [m.w, m.h]
	if key != _model_dim: _model_dim = key; _relayout()
var _model_dim := ""

func set_cover(px: float) -> void: cover = px
func set_blocked(b: bool) -> void: blocked = b
func set_title(on: bool) -> void: title_mode = on

## CB_CAM for screenshots: "close", "wide", "full", or a zoom factor.
func set_camera(spec: String) -> void:
	match spec:
		"close": zoom = 1.3
		"wide": zoom = 0.8
		"full", "fit": zoom = 1.0
		"2x": zoom = 2.0
		"4x": zoom = 4.0
		_: if spec.is_valid_float(): zoom = clampf(float(spec), 0.4, 4.0)

func set_state(region_strings: Dictionary, ticket_card) -> void:
	stall = str(region_strings.get("stall", "")); lane = str(region_strings.get("lane", ""))
	card = ticket_card if ticket_card is Dictionary else {}
	if source != "fixture": refresh()
	queue_redraw()

## Re-read the engine's board and queries (the engine tells us when something changed; live frames call this too).
func refresh() -> void:
	if app == null or app.get("b") == null: return
	var mm := NodeApi.from_engine(app.b)
	if mm.is_empty():
		if source == "engine": model = {}; source = "none"; _parts_dirty = true
		return
	_set_model(mm, "engine")
	if _power_env and not _power_sent and not mm.powered:
		_power_sent = true; app.b.act("power", [true])

func _set_model(mm: Dictionary, src: String) -> void:
	model = mm; source = src; _parts_dirty = true; _relayout_if_needed(); _restyle_if_needed()
	if src == "fixture":
		model.powered = _power_env
	if _smoke_demo != "" and not _smoke_demo_done:
		var kind: String = {"led": "LED", "res": "R", "cap": "CE"}.get(_smoke_demo, _smoke_demo.to_upper())
		for pt in model.parts:
			if pt.kind == kind:
				model.smoked[pt.uid] = true; _smoke_demo_done = true
				for k in model.wire_i: model.wire_i[k] = 0.0   # the part is open now: no more dots
				for k in model.part_i: model.part_i[k] = 0.0
				model.powered = true
				break

func _m() -> Dictionary: return model if not model.is_empty() else _empty

## -------------------------------------------------------------------------------------------------------------- layout

func _margins() -> Vector4:   # left, top, right, bottom of the free area (app bar, dock / phone rail, drawer cover)
	if embedded: return Vector4(4.0, -6.0, 4.0, 2.0)
	var bar := 66.0; var dock := 84.0; var left := 14.0; var bottom := 8.0
	if app != null:
		var bv = app.get("_bar_h"); var dv = app.get("_dock_h")
		if bv != null: bar = float(bv)
		if dv != null: dock = float(dv)
	if CbLayout.kind == "phone":
		left = 92.0 + 8.0; bottom = 6.0   # CbApp.RAIL_W
	else: bottom = dock + 8.0
	return Vector4(left, bar + 10.0, cover + 14.0, bottom)

func _relayout() -> void:
	var mg := _margins(); var m := _m()
	var top := mg.y + (30.0 if ((stall != "" or not card.is_empty()) and not embedded) else 0.0)
	var area := Rect2(mg.x, top, size.x - mg.x - mg.z, size.y - top - mg.w)
	var gw := float(m.w - 1) + 2.0 * 1.3 + 0.8; var gh := float(m.h - 1) + 2.0 * 1.3 + 0.8
	p = clampf(minf(area.size.x / gw, area.size.y / gh), 6.0, 56.0) * zoom
	org = area.get_center() - Vector2(m.w - 1, m.h - 1) * p * 0.5
	board_rect = Rect2(org - Vector2(1.3, 1.3) * p, Vector2(m.w - 1 + 2.6, m.h - 1 + 2.6) * p)
	_parts_dirty = true

func _px(pad: Vector2) -> Vector2: return org + pad * p

## -------------------------------------------------------------------------------------------------------------- frame

func _process(dt: float) -> void:
	t += dt
	var key := "%s|%s|%s|%s|%s" % [size, cover, zoom, CbLayout.kind, _margins()]
	if key != _layout_key: _layout_key = key; _relayout(); queue_redraw()
	var m := _m()
	var live: bool = m.powered
	var has_ac := false
	if live:
		for id in m.wire_i: _advance(id, float(m.wire_i[id]), m, dt)
		for id in m.part_i: _advance("p:" + str(id), float(m.part_i[id]), m, dt, str(id))
		has_ac = not m.ac_amp.is_empty()
	_smoke_step(dt, m)
	for pt in m.parts:   # the small clocks of the chapter-3 parts: a vent's puff, a relay's click, a contact's chatter
		var uid := str(pt.uid)
		if m.smoked.has(uid): _vent_t[uid] = float(_vent_t.get(uid, 0.0)) + dt
		else: _vent_t.erase(uid)
		var rl: Dictionary = m.get("relay", {}).get(uid, {})
		if not rl.is_empty():
			var op := bool(rl.get("operated", false))
			if _relay_was.has(uid) and _relay_was[uid] != op: _click_t[uid] = 0.0
			_relay_was[uid] = op; _click_t[uid] = float(_click_t.get(uid, 9.0)) + dt
	_bounce_t += dt
	for ct in m.get("contacts", []):
		if _contact_was.has(str(ct.id)) and _contact_was[str(ct.id)] != bool(ct.closed): _bounce_t = 0.0
		_contact_was[str(ct.id)] = bool(ct.closed)
	if _parts_dirty or has_ac:
		_parts_dirty = false; _parts_layer.queue_redraw()
	_glow_layer.queue_redraw(); _fx_layer.queue_redraw()

func _ac_wave() -> float: return sin(TAU * 0.6 * t)

func _advance(id: String, amps: float, m: Dictionary, dt: float, ac_key := "") -> void:
	var a := absf(amps)
	if a < 1e-9: return
	var speed := clampf(log(a / 1e-6) / log(10.0), 0.2, 6.0)   # pads/s, DESIGN §5.2
	var es: Dictionary = m.get("wire_speed", {}) if not id.begins_with("p:") else m.get("part_speed", {})
	var ek: String = id if not id.begins_with("p:") else ac_key
	if es.has(ek): speed = maxf(absf(float(es[ek])), 0.0)   # the engine's own dot speed (liveFrame speed) replaces the local formula
	var dir := signf(amps) * (-1.0 if electron_flow else 1.0)
	if m.ac.has(id if ac_key == "" else ac_key): dir *= _ac_wave()
	_phase[id] = float(_phase.get(id, 0.0)) + speed * dir * dt
	_dsign[id] = 1.0 if dir >= 0.0 else -1.0

## -------------------------------------------------------------------------------------------------------------- colours

static func volt_color(v: float, lo: float, hi: float) -> Color:
	if v >= 0.0:
		var k := v / maxf(hi, 0.001)
		if k <= 1.0: return SLATE.lerp(AMBER, k)
		return AMBER.lerp(MAGENTA, clampf((k - 1.0) / 0.5, 0.0, 1.0))
	return SLATE.lerp(CYAN, clampf(v / minf(lo, -0.001), 0.0, 1.0))

static func heat_color(k: float) -> Color:
	if k < 0.4: return Color("#7a1208").lerp(Color("#FF3B1F"), k / 0.4)
	if k < 0.75: return Color("#FF3B1F").lerp(Color("#FF9A2A"), (k - 0.4) / 0.35)
	return Color("#FF9A2A").lerp(Color("#FFF4D6"), (k - 0.75) / 0.25)

static func glow() -> Texture2D:
	if _glow_tex == null:
		var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.3, 1.0])
		g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.3), Color(1, 1, 1, 0.0)])
		var tx := GradientTexture2D.new(); tx.gradient = g; tx.fill = GradientTexture2D.FILL_RADIAL
		tx.fill_from = Vector2(0.5, 0.5); tx.fill_to = Vector2(1.0, 0.5); tx.width = 128; tx.height = 128
		_glow_tex = tx
	return _glow_tex

func _blob(ci: CanvasItem, c: Vector2, r: float, col: Color) -> void:
	ci.draw_texture_rect(glow(), Rect2(c - Vector2(r, r), Vector2(r, r) * 2.0), false, col)

func _node_v(pad: Vector2, m: Dictionary) -> float:
	if not m.powered: return 0.0
	var k := NodeApi.key(pad)
	var v: float = m.volts.get(k, 0.0)
	if m.ac_amp.has(k): v += float(m.ac_amp[k]) * _ac_wave()
	return v

func _node_color(pad: Vector2, m: Dictionary) -> Color:
	var nm: Dictionary = m.get("norm", {})
	if not nm.is_empty() and m.vlo >= 0.0 and nm.has(NodeApi.key(pad)): return SLATE.lerp(AMBER, clampf(float(nm[NodeApi.key(pad)]), 0.0, 1.0))   # the engine's tint scalar
	return volt_color(_node_v(pad, m), m.vlo, m.vhi)

func _txt(ci: CanvasItem, s: String, pos: Vector2, size_px: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, outline := true) -> void:
	var f := ThemeDB.fallback_font
	size_px = maxi(size_px, SS.min_font)
	if outline: ci.draw_string_outline(f, pos, s, align, -1.0, size_px, 4, Color(0.02, 0.02, 0.03, 0.9))
	ci.draw_string(f, pos, s, align, -1.0, size_px, col)

func _label_key(id: String) -> String:
	var k := "CONN_" + id
	var s := tr(k)
	return id if s == k else s

## -------------------------------------------------------------------------------------------------------------- base (bench + board)

func _draw() -> void:
	var m := _m()
	if not embedded: draw_rect(Rect2(Vector2.ZERO, size), WALNUT, true)
	var rng := RandomNumberGenerator.new(); rng.seed = 7
	var plank := 150.0
	for i in (0 if embedded else int(size.y / plank) + 2):   # planks with grain lines
		var y := float(i) * plank
		draw_rect(Rect2(0, y, size.x, plank - 2.0), WALNUT.lerp(Color("#4a3427"), rng.randf() * 0.55), true)
		draw_line(Vector2(0, y), Vector2(size.x, y), Color(0.05, 0.03, 0.02, 0.8), 2.0)
		for k in 9: 
			var gy := y + rng.randf_range(8.0, plank - 12.0); var gx := rng.randf_range(-100.0, size.x * 0.6)
			draw_line(Vector2(gx, gy), Vector2(gx + rng.randf_range(160.0, 520.0), gy + rng.randf_range(-3.0, 3.0)), Color(0.12, 0.07, 0.04, 0.35), 1.5)
	if stall != "" and not embedded: draw_string(ThemeDB.fallback_font, Vector2(_margins().x + 6.0, _margins().y + 20.0), stall, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 20, Color(0.95, 0.88, 0.75, 0.85))
	if not card.is_empty() and not embedded:
		var tx := str(card.get("title", ""))
		var sx := _margins().x + 6.0 + (ThemeDB.fallback_font.get_string_size(stall, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 20).x + 18.0 if stall != "" else 0.0)
		draw_string(ThemeDB.fallback_font, Vector2(sx, _margins().y + 20.0), tx, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 17, CbKit.ACC)
	var br := board_rect
	draw_rect(Rect2(br.position + Vector2(p * 0.25, p * 0.4), br.size), Color(0, 0, 0, 0.4), true)   # board drop shadow
	PartArt.rrect(self, br, p * 0.35, Color("#2a2d33"))                                                # edge bevel
	PartArt.rrect(self, br.grow(-p * 0.07), p * 0.3, MASK)
	for gx in range(0, m.w, 5):   # silkscreen grid every 5 pads
		draw_line(_px(Vector2(gx, 0)) + Vector2(0, -p * 0.9), _px(Vector2(gx, m.h - 1)) + Vector2(0, p * 0.9), Color(1, 1, 1, 0.055), 1.5)
	for gy in range(0, m.h, 5):
		draw_line(_px(Vector2(0, gy)) + Vector2(-p * 0.9, 0), _px(Vector2(m.w - 1, gy)) + Vector2(p * 0.9, 0), Color(1, 1, 1, 0.055), 1.5)
	var pr := p * 0.25; var hr := p * 0.1
	for y in m.h:
		for x in m.w:
			var c := org + Vector2(x, y) * p
			draw_circle(c, pr, Color(0.62, 0.47, 0.18)); draw_circle(c, pr * 0.9, PAD_GOLD); draw_circle(c, hr, Color(0.03, 0.03, 0.04))
	for cn in [br.position + Vector2(p * 0.45, p * 0.45), br.position + Vector2(br.size.x - p * 0.45, p * 0.45), br.position + Vector2(p * 0.45, br.size.y - p * 0.45), br.end - Vector2(p * 0.45, p * 0.45)]:
		draw_circle(cn, p * 0.24, Color("#2a2d33")); draw_circle(cn, p * 0.15, WALNUT.darkened(0.5))   # mounting holes
	for c in m.connectors: _connector(c, m)

func _connector(c: Dictionary, m: Dictionary) -> void:   # the brass edge connector with its engraved name
	var pos := _px(c.pad); var br := board_rect
	var left: bool = c.pad.x < float(m.w - 1) * 0.5
	var edge := br.position.x - p * 0.35 if left else br.end.x + p * 0.35
	var r: Rect2
	if left: r = Rect2(edge, pos.y - p * 0.5, pos.x - edge + p * 0.5, p)
	else: r = Rect2(pos.x - p * 0.5, pos.y - p * 0.5, edge - pos.x + p * 0.5, p)
	PartArt.rrect(self, Rect2(r.position + Vector2(p * 0.06, p * 0.1), r.size), p * 0.18, Color(0, 0, 0, 0.4))
	PartArt.rrect(self, r, p * 0.18, Color("#b8893a"))
	draw_line(r.position + Vector2(p * 0.1, p * 0.16), Vector2(r.end.x - p * 0.1, r.position.y + p * 0.16), Color(1, 0.9, 0.6, 0.45), p * 0.07)
	draw_circle(pos, p * 0.26, Color("#e3c070")); draw_circle(pos, p * 0.1, Color(0.05, 0.04, 0.03))
	# the name is engraved on the brass itself, big and dark, so which pad is GND and which is A (or IN / OUT) is never a guess
	var s := _label_key(c.id)
	var long := {"GND": "GND", "A": "A", "VP": "V+"}.get(str(c.id), s) as String
	var fs := maxi(int(clampf(p * 0.56, 14.0, 26.0)), SS.min_font)
	var f := ThemeDB.fallback_font
	var tw := f.get_string_size(long, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs).x
	var ink := Color(0.16, 0.1, 0.03, 0.95)
	var gy := pos.y + fs * 0.36
	var gnd: bool = str(c.id) == "GND" or str(c.get("role", "")) == "ground"
	var sym := p * 0.5 if gnd else 0.0   # a ground symbol sits before the word
	if left:
		var tx := pos.x - p * 0.55 - tw
		if gnd: tx = br.position.x + p * 0.1 + sym * 0.9   # a soldered wire may run along this bar: the name goes to its free left end
		draw_string(f, Vector2(tx, gy), long, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, ink)
		if gnd: _ground_symbol(self, Vector2(tx - sym * 0.85, pos.y), p * 0.3, ink)
	else:
		var tx2 := pos.x + p * (2.3 if str(c.get("role", "")) in ["supply", "ground", "rail"] and str(c.id) != "A" else 0.55) + sym
		draw_string(f, Vector2(tx2, gy), long, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, ink)
		if gnd: _ground_symbol(self, Vector2(tx2 - sym * 0.55, pos.y), p * 0.3, ink)
	if str(c.id) == "A":   # the junction pad of the exam: a bright ring says "wire the three resistors here"
		draw_arc(pos, p * 0.42, 0, TAU, 28, CYAN, maxf(2.0, p * 0.07))

static func _ground_symbol(ci: CanvasItem, c: Vector2, r: float, col: Color) -> void:
	ci.draw_line(c + Vector2(0, -r * 1.2), c + Vector2(0, -r * 0.3), col, maxf(2.0, r * 0.22))
	for k in 3:
		var hw := r * (1.0 - float(k) * 0.32)
		ci.draw_line(c + Vector2(-hw, -r * 0.3 + float(k) * r * 0.42), c + Vector2(hw, -r * 0.3 + float(k) * r * 0.42), col, maxf(2.0, r * 0.22))

## -------------------------------------------------------------------------------------------------------------- wires, parts, labels

func _along(pts: Array, s: float) -> Vector2:
	var acc := 0.0
	for i in pts.size() - 1:
		var l: float = pts[i].distance_to(pts[i + 1])
		if s <= acc + l: return pts[i].lerp(pts[i + 1], (s - acc) / maxf(l, 0.001))
		acc += l
	return pts[pts.size() - 1]

func _length(pts: Array) -> float:
	var l := 0.0
	for i in pts.size() - 1: l += pts[i].distance_to(pts[i + 1])
	return l

const WIRE_HUES := [Color("#d8514a"), Color("#e2a93a"), Color("#4fae6a"), Color("#4b8fd6"), Color("#b074d6"), Color("#d9d9cf")]

func _wire_index(wid: String) -> int: return int(wid.substr(1)) if wid.length() > 1 and wid.substr(1).is_valid_int() else wid.hash()

static func _edge_key(a: Vector2, b: Vector2) -> String:
	var lo := a; var hi := b
	if b.x < a.x or (b.x == a.x and b.y < a.y): lo = b; hi = a
	return "%d,%d>%d,%d" % [int(lo.x), int(lo.y), int(hi.x), int(hi.y)]

## Screen polylines of every wire. Wires that run along the same pads are offset sideways (a fixed lane order by wire id), so two overlapping runs read as two wires.
func _wire_geom(m: Dictionary) -> Dictionary:
	var users := {}   # unit edge -> [wid]
	for w in m.wires:
		var path: Array = w.path
		for i in path.size() - 1:
			var a: Vector2 = path[i]; var b: Vector2 = path[i + 1]
			var d := (b - a); var n := int(maxf(absf(d.x), absf(d.y))); if n < 1: continue
			var st := d / float(n)
			for k in n:
				var ek := _edge_key(a + st * k, a + st * (k + 1))
				if not users.has(ek): users[ek] = []
				if not (users[ek] as Array).has(str(w.wid)): (users[ek] as Array).append(str(w.wid))
	var out := {}
	for w in m.wires:
		var path: Array = w.path
		if path.size() < 2: continue
		var pts := PackedVector2Array()
		pts.append(_px(path[0]))
		for i in path.size() - 1:
			var a: Vector2 = path[i]; var b: Vector2 = path[i + 1]
			var d := b - a
			var n := int(maxf(absf(d.x), absf(d.y))); if n < 1: continue
			var lane := 0.0
			var cnt := 1
			for k in n:   # the busiest unit edge of this run decides the spacing
				var ids: Array = users[_edge_key(a + d / float(n) * k, a + d / float(n) * (k + 1))]
				if ids.size() >= cnt:
					var ord := ids.duplicate(); ord.sort_custom(func(x, y): return _wire_index(str(x)) < _wire_index(str(y)))
					cnt = ids.size(); lane = float(ord.find(str(w.wid))) - float(cnt - 1) * 0.5
			var lo := a; var hi := b
			if b.x < a.x or (b.x == a.x and b.y < a.y): lo = b; hi = a
			var cd := (hi - lo).normalized()
			var nrm := Vector2(-cd.y, cd.x)
			var off := nrm * lane * p * 0.27 if cnt > 1 else Vector2.ZERO
			pts.append(_px(a) + off); pts.append(_px(b) + off)
		pts.append(_px(path[path.size() - 1]))
		out[str(w.wid)] = Array(pts)
	return out

func _draw_parts(ci: Control) -> void:
	var m := _m(); var live: bool = m.powered
	# node tint on the pads (a coloured ring + a dark collar)
	if live:
		for k in m.volts:
			var xy: PackedStringArray = k.split(",")
			var pad := Vector2(float(xy[0]), float(xy[1]))
			ci.draw_arc(_px(pad), p * 0.34, 0.0, TAU, 18, _node_color(pad, m), maxf(2.0, p * 0.09), true)
	# soot decals under smoked parts
	var bounds := {}
	for pt in m.parts:
		var pin_px: Array = pt.pins.map(func(v): return _px(v))
		bounds[pt.uid] = PartArt.screen_bounds(pt, pin_px, p)
		if m.smoked.has(pt.uid):
			var c: Vector2 = bounds[pt.uid].get_center()
			ci.draw_circle(c, bounds[pt.uid].size.length() * 0.38, Color(0, 0, 0, 0.28)); ci.draw_circle(c, bounds[pt.uid].size.length() * 0.24, Color(0, 0, 0, 0.35))
	# wires (insulated jumpers): unpowered they carry their own hue, powered they are tinted by node voltage. Runs that share a lane are fanned out side by side.
	var geo := _wire_geom(m)
	for wi in m.wires.size():
		var w: Dictionary = m.wires[wi]
		var pts: Array = geo.get(str(w.wid), [])
		if pts.size() < 2: continue
		var hue: Color = WIRE_HUES[_wire_index(str(w.wid)) % WIRE_HUES.size()]
		var col := _node_color(w.path[0], m)
		var base: Color = hue.darkened(0.1) if not live else hue.lerp(col, 0.78)
		var wd := p * 0.26
		var sh := PackedVector2Array(pts.map(func(v): return v + Vector2(p * 0.1, p * 0.16)))
		ci.draw_polyline(sh, Color(0, 0, 0, 0.35), wd * 1.05, true)
		var pa := PackedVector2Array(pts)
		ci.draw_polyline(pa, Color(0.03, 0.035, 0.04), wd * 1.12, true)
		for v in pts: ci.draw_circle(v, wd * 0.56, Color(0.03, 0.035, 0.04))
		ci.draw_polyline(pa, base.darkened(0.25), wd * 0.78, true)
		ci.draw_polyline(PackedVector2Array(pts.map(func(v): return v + Vector2(0, -p * 0.035))), base, wd * 0.5, true)
		ci.draw_polyline(PackedVector2Array(pts.map(func(v): return v + Vector2(0, -p * 0.06))), Color(1, 1, 1, 0.22), p * 0.035, true)
		for v in pts: ci.draw_circle(v, wd * 0.36, base)
		for e in [_px(w.path[0]), _px(w.path[w.path.size() - 1])]:   # solder blobs sit on the pads themselves
			ci.draw_circle(e, p * 0.25, Color(0.5, 0.52, 0.56)); ci.draw_circle(e, p * 0.21, Color(0.8, 0.82, 0.86)); ci.draw_circle(e + Vector2(-p * 0.07, -p * 0.07), p * 0.06, Color(1, 1, 1, 0.7))
	_draw_junctions(ci, m, geo)
	# parts
	for pt in m.parts:
		var i: float = absf(float(m.part_i.get(pt.uid, 0.0))) if live else 0.0
		var st := {"lit": _led_lit(pt.uid, i, m) if pt.kind == "LED" else 0.0, "smoked": m.smoked.has(pt.uid),
			"hot": _heat_k(pt.uid, m) if live else 0.0, "needle": float(m.get("galvo", {}).get(pt.uid, 0.0)) if live else 0.0,
			"bulge": float(m.get("cap_bulge", {}).get(pt.uid, 0.0)) if live else 0.0, "vent_t": float(_vent_t.get(pt.uid, 0.0)), "level": float(m.get("cap_level", {}).get(pt.uid, 1.0)) if live else 1.0,
			"operated": bool(m.get("relay", {}).get(pt.uid, {}).get("operated", false)) if live else false, "click_t": float(_click_t.get(pt.uid, 9.0)),
			"coil": clampf(float(m.get("relay", {}).get(pt.uid, {}).get("mA", 0.0)) / 60.0, 0.0, 1.5) if live else 0.0}
		PartArt.draw(ci, pt, _px(Vector2(pt.x, pt.y)), p, st)
	_draw_contacts(ci, m)
	for pr in m.probes: _probe(ci, pr)
	# labels and rating bars
	var fs := maxi(int(clampf(p * 0.42, 13.0, 24.0)), SS.min_font)
	for pt in m.parts:
		var b: Rect2 = bounds[pt.uid]
		var s: String = pt.label
		var wtx := ThemeDB.fallback_font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs).x
		var pos: Vector2
		if b.size.y > b.size.x * 1.4: pos = Vector2(b.end.x + 4.0, b.get_center().y + fs * 0.35)
		else: pos = Vector2(b.get_center().x - wtx * 0.5, b.position.y - 4.0)
		if pt.kind == "LED" and (pt.pin_labels as Array).size() == pt.pins.size() and pt.pins.size() == 2: _led_pin_tags(ci, pt)
		if show_ratings and live and m.ratings.has(pt.uid):
			var r: Dictionary = m.ratings[pt.uid]; var worst := 0.0
			for k in r: worst = maxf(worst, float(r[k]))
			var bw := minf(b.size.x, p * 2.4) * 0.8; var bp := Vector2(b.get_center().x - bw * 0.5, b.end.y + 2.0)
			ci.draw_rect(Rect2(bp, Vector2(bw, p * 0.13)), Color(0, 0, 0, 0.7))
			var rc := Color("#3fd47a") if worst < 0.7 else (AMBER if worst < 0.95 else Color("#ff4a3a"))
			ci.draw_rect(Rect2(bp, Vector2(bw * clampf(worst, 0.0, 1.0), p * 0.13)), rc)

## What is joined and what only passes: where two wires cross they are NOT joined, so the later wire hops over the earlier one (a gap in the lower wire, an arch on the upper);
## where two or more wire ends meet on one pad they ARE joined, shown as a bright solder dot. The engine's `crossings` / `joins` say where; this only draws.
func _draw_junctions(ci: Control, m: Dictionary, geo: Dictionary) -> void:
	var wd := p * 0.26
	for cx in m.get("crossings", []):
		var pad := Vector2(cx.pad[0], cx.pad[1]); var c := _px(pad)
		var hi := str(cx.b); var lo := str(cx.a)   # b (the later wire) hops over a
		var hue: Color = WIRE_HUES[_wire_index(hi) % WIRE_HUES.size()]
		# the direction of the upper wire at the crossing: the nearest segment of its drawn polyline
		var dir := Vector2.RIGHT
		var pts: Array = geo.get(hi, [])
		var best := 1e9
		for i in range(1, pts.size()):
			var a: Vector2 = pts[i - 1]; var b2: Vector2 = pts[i]
			var cp := Geometry2D.get_closest_point_to_segment(c, a, b2)
			if cp.distance_to(c) < best and (b2 - a).length() > 0.1: best = cp.distance_to(c); dir = (b2 - a).normalized()
		var nrm := Vector2(-dir.y, dir.x)
		# a dark gap in whatever lies beneath (the lower wire), then the arch of the upper one
		ci.draw_circle(c, wd * 0.95, Color(0.03, 0.035, 0.04, 0.9))
		var arch := PackedVector2Array()
		for k in range(0, 13):
			var f := float(k) / 12.0
			arch.append(c + dir * (f - 0.5) * p * 0.9 - nrm * sin(PI * f) * p * 0.3)
		ci.draw_polyline(arch, Color(0.03, 0.035, 0.04), wd * 1.15, true)
		ci.draw_polyline(arch, hue.darkened(0.15), wd * 0.62, true)
		ci.draw_polyline(arch, Color(1, 1, 1, 0.2), p * 0.04, true)
	for jn in m.get("joins", []):
		var e := _px(Vector2(jn.pad[0], jn.pad[1]))
		ci.draw_circle(e, p * 0.33, Color(0.18, 0.19, 0.22)); ci.draw_circle(e, p * 0.29, Color(0.86, 0.88, 0.92)); ci.draw_circle(e + Vector2(-p * 0.08, -p * 0.09), p * 0.08, Color(1, 1, 1, 0.85))
		ci.draw_arc(e, p * 0.37, 0.0, TAU, 20, Color("#ffd98a", 0.75), 1.6, true)

## "A +" on the long (anode) leg and "K -" on the flat (cathode) side, written beside each leg on the board.
func _led_pin_tags(ci: Control, pt: Dictionary) -> void:
	var fs := maxi(int(clampf(p * 0.5, 13.0, 20.0)), SS.min_font)
	var f := ThemeDB.fallback_font
	var mid := (_px(pt.pins[0]) + _px(pt.pins[1])) * 0.5
	for i in 2:
		var pp := _px(pt.pins[i]); var dir := (pp - mid).normalized()
		var raw := str(pt.pin_labels[i]).replace("-", "\u2212")
		var tw := f.get_string_size(raw, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs).x
		var box := Vector2(tw + 10.0, fs + 6.0)
		var c := pp + dir * (p * 0.62 + (box.x * 0.5 if absf(dir.x) > 0.5 else box.y * 0.5))   # beside the leg, away from the dome
		var r := Rect2(c - box * 0.5, box)
		var col := Color("#ff9d8c") if i == 0 else Color("#8fbfff")
		PartArt.rrect(ci, r, 6.0, Color(0.04, 0.05, 0.07, 0.88))
		ci.draw_string(f, r.position + Vector2(5.0, fs + 1.0), raw, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, col)

func _probe(ci: Control, pr: Dictionary) -> void:
	var tip := _px(pr.pad); var col := Color("#7CFF6B") if pr.ch == 1 else Color("#FFB547")
	var h := tip + Vector2(p * 1.1, -p * 1.7); var far := tip + Vector2(p * 2.6, -p * 4.4)
	ci.draw_line(tip + Vector2(p * 0.1, p * 0.12), far + Vector2(p * 0.1, p * 0.12), Color(0, 0, 0, 0.35), p * 0.3)
	ci.draw_line(tip, h, SILVER_STEEL, p * 0.1)
	ci.draw_line(h, far, col.darkened(0.45), p * 0.34)
	ci.draw_line(h, far, col, p * 0.24)
	ci.draw_circle(tip, p * 0.12, Color.WHITE)
	var s := tr("PROBE_CH%d" % pr.ch)
	_txt(ci, s, far + Vector2(p * 0.3, 0), maxi(int(clampf(p * 0.32, 9.0, 18.0)), SS.min_font), col)

const SILVER_STEEL := Color(0.8, 0.82, 0.86)

static func _led_k(i: float) -> float: return clampf(log(maxf(i, 1e-9) / 2e-5) / log(10.0) / 3.0, 0.0, 1.0)

## -------------------------------------------------------------------------------------------------------------- additive glow layer

func _led_color(part: Dictionary) -> Color:
	var id: String = part.partId
	if "grn" in id or "green" in id: return Color(0.3, 1.0, 0.4)
	if "blu" in id: return Color(0.35, 0.55, 1.0)
	if "yel" in id: return Color(1.0, 0.85, 0.2)
	if "wh" in id: return Color(1.0, 0.95, 0.85)
	return Color(1.0, 0.2, 0.12)

func _draw_glow(ci: Control) -> void:
	_critters.clear()
	var m := _m()
	if not m.powered: return
	# node halos on the pads
	for k in m.volts:
		var xy: PackedStringArray = k.split(",")
		var pad := Vector2(float(xy[0]), float(xy[1]))
		var c := _node_color(pad, m)
		_blob(ci, _px(pad), p * 0.62, Color(c.r, c.g, c.b, 0.34))
	var pp := {}
	for pt in m.parts: pp[pt.uid] = pt
	for pt in m.parts:
		var pin_px: Array = pt.pins.map(func(v): return _px(v))
		var b := PartArt.screen_bounds(pt, pin_px, p); var c := b.get_center()
		var smoked: bool = m.smoked.has(pt.uid)
		var hk := _heat_k(pt.uid, m)
		if hk > 0.02 and not smoked:   # heat glow: blackbody ramp over the body
			_blob(ci, c, maxf(b.size.x, b.size.y) * (0.75 + 0.45 * hk), Color(heat_color(hk), minf(1.0, hk * 0.95)))
		if pt.kind == "LED" and not smoked:   # bloom proportional to current (log)
			var k := _led_lit(pt.uid, absf(float(m.part_i.get(pt.uid, 0.0))), m)
			if k > 0.0:
				var lc := _led_color(pt); var lp: Vector2 = _px(Vector2(pt.x, pt.y) + NodeApi._rot_off(Vector2(1, 0), pt.rot, pt.flip))
				var flick := 1.0 + 0.02 * sin(t * 37.0)
				_blob(ci, lp, p * (5.0 + 2.0 * k), Color(lc, 0.16 * k * flick))
				_blob(ci, lp, p * (2.4 + 1.6 * k), Color(lc, 0.55 * k * flick))
				_blob(ci, lp, p * 1.1, Color(1.0, 0.8, 0.7, 0.8 * k))
	# current dots along wires ...
	var geo := _wire_geom(m)
	for w in m.wires:
		var amps: float = m.wire_i.get(w.wid, 0.0)
		if absf(amps) < 1e-9: continue
		var pts: Array = geo.get(str(w.wid), [])
		if pts.size() < 2: continue
		_dots(ci, pts, str(w.wid), _node_color(w.path[0], m), 1.0, not cute)
	# ... and through parts
	for pt in m.parts:
		var amps2: float = m.part_i.get(pt.uid, 0.0)
		if absf(amps2) < 1e-9 or pt.pins.size() != 2 or pt.kind == "BAT": continue
		var pts2: Array = [_px(pt.pins[0]), _px(pt.pins[1])]
		_dots(ci, pts2, "p:" + str(pt.uid), _node_color(pt.pins[0], m), 0.8, not cute)

func _dots(ci: CanvasItem, pts: Array, id: String, tint: Color, scale: float, body := true) -> void:
	var total := _length(pts)
	var sp := (1.15 if cute else DOT_SPACING) * p
	var s := fposmod(float(_phase.get(id, 0.0)) * p, sp)
	var halo := Color(tint.lerp(Color.WHITE, 0.45), 0.5)
	while s <= total:
		var c := _along(pts, s)
		_blob(ci, c, p * (0.3 if not cute else 0.36) * scale, halo)
		if body and not cute: ci.draw_circle(c, p * 0.095 * scale, Color(1.0, 0.97, 0.82, 0.95))
		elif cute and not body:   # the critter itself is drawn in the opaque layer
			var tan := (_along(pts, s + 3.0) - c).normalized() * float(_dsign.get(id, 1.0))
			_critters.append([c, tan, scale, s])
		s += sp

## -------------------------------------------------------------------------------------------------------------- smoke

func _smoke_step(dt: float, m: Dictionary) -> void:
	for pt in m.parts:
		if not m.smoked.has(pt.uid): continue
		var pin_px: Array = pt.pins.map(func(v): return _px(v))
		var b := PartArt.screen_bounds(pt, pin_px, p); var c := b.get_center()
		if not _burst.has(pt.uid):   # the pop
			_burst[pt.uid] = true
			for i in 34: _spawn(c, 1.6)
		_emit[pt.uid] = float(_emit.get(pt.uid, 0.0)) + dt * 36.0
		while _emit[pt.uid] >= 1.0: _emit[pt.uid] -= 1.0; _spawn(c, 1.0)
	var keep: Array = []
	for q in _smoke:
		q.age += dt
		if q.age >= q.life: continue
		q.vel.x += sin(q.age * 2.4 + q.seed) * 55.0 * dt * (p / 40.0)   # curl
		q.pos += q.vel * dt
		keep.append(q)
	_smoke = keep

func _spawn(c: Vector2, power: float) -> void:
	var a := randf() * TAU; var sc := p / 40.0
	_smoke.append({"pos": c + Vector2(cos(a), sin(a)) * p * 0.3 * randf(), "vel": Vector2(randf_range(-14.0, 14.0) * power, -randf_range(34.0, 70.0) * power) * sc,
		"age": 0.0, "life": randf_range(1.8, 3.2), "r": p * randf_range(0.35, 0.6), "seed": randf() * TAU})

var _critters: Array = []
var overlay: Dictionary = {}   ## stall interaction overlay: {ghost:{part,ok,origin,pins}, wire:{from,to,target}, hover_pad}

## Part names ("120 \u03a9", "LED") are drawn on the top layer over a dark chip: a wire or its current dots running through a label never hides a digit.
func _draw_labels(ci: Control) -> void:
	var m := _m()
	var fs := maxi(int(clampf(p * 0.42, 13.0, 24.0)), SS.min_font)
	var f := ThemeDB.fallback_font
	for pt in m.parts:
		var pin_px: Array = pt.pins.map(func(v): return _px(v))
		var b: Rect2 = PartArt.screen_bounds(pt, pin_px, p)
		var s: String = pt.label
		if s == "": continue
		var wtx := f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs).x
		var pos: Vector2
		if b.size.y > b.size.x * 1.4: pos = Vector2(b.end.x + 4.0, b.get_center().y + fs * 0.35) if str(pt.kind) != "CE" else Vector2(b.position.x - 4.0 - wtx, b.get_center().y + fs * 0.35)   # a standing electrolytic is labelled on its left (the scope's lead runs down its right)
		else: pos = Vector2(b.get_center().x - wtx * 0.5, b.position.y - 4.0)
		PartArt.rrect(ci, Rect2(pos + Vector2(-4.0, -fs - 1.0), Vector2(wtx + 8.0, fs + 7.0)), 5.0, Color(0.03, 0.035, 0.05, 0.72))
		_txt(ci, s, pos, fs, Color(0.96, 0.95, 0.88))

## The bench-driven contacts the engine reports (liveFrame().contacts): ticket 3-2's arcade button stands on the board between the SW pad and GND (its dome goes down with the engine's contact), ticket 3-4's knife
## switch lies between the B and D pads. Pure decoration of what the engine says is closed.
func _draw_contacts(ci: CanvasItem, m: Dictionary) -> void:
	for ct in m.get("contacts", []):
		var pa := Vector2(-1, -1); var pb := Vector2(-1, -1)
		for c in m.connectors:
			if str(c.id) == str(ct.a): pa = c.pad
			if str(c.id) == str(ct.b): pb = c.pad
		if pa.x < 0 or pb.x < 0: continue
		var closed := bool(ct.closed)
		if str(ct.id) == "btn":
			var cen := Vector2(pa.x + 6.0, pa.y + 4.0)   # the button stands below and to the right of the SW pad, its leads run to the SW pad and to GND
			var cable := Color("#1a1b1f"); var w := p * 0.2
			var l1 := PackedVector2Array([_px(pa), _px(Vector2(pa.x, cen.y)), _px(cen + Vector2(-1.2, 0.0))])
			var l2 := PackedVector2Array([_px(cen + Vector2(1.2, 0.0)), _px(Vector2(cen.x + 3.0, cen.y)), _px(Vector2(cen.x + 3.0, pb.y)), _px(pb)])
			for l in [l1, l2]:
				ci.draw_polyline(l, Color(0, 0, 0, 0.35), w * 1.3, true); ci.draw_polyline(l, cable, w, true); ci.draw_polyline(l, Color(1, 1, 1, 0.12), w * 0.3, true)
			PartArt3.arcade_button(ci, _px(cen), p, closed, clampf(1.0 - _bounce_t / 0.35, 0.0, 1.0) if closed else 0.0)
		else:
			PartArt3.knife_switch(ci, _px(pa), _px(pb), p, closed)

## The engine's engraved board marks: the bridge terminals (A, B, J on the slide wire, C at the junction) as small brass tags, and the clear slots a part goes in (dashed outline, until filled).
func _draw_marks(ci: Control) -> void:
	var m := _m()
	var fs := maxi(int(clampf(p * 0.5, 14.0, 22.0)), SS.min_font)
	for sl in m.get("slots", []):
		if bool(sl.get("filled", false)): continue
		var a := _px(_pad_of(sl.a)); var b := _px(_pad_of(sl.b))
		var r := Rect2(Vector2(minf(a.x, b.x) - p * 0.7, minf(a.y, b.y) - p * 1.0), Vector2(absf(b.x - a.x) + p * 1.4, absf(b.y - a.y) + p * 2.0))
		var col := Color(1.0, 0.8, 0.35, 0.55)
		var pts := PackedVector2Array([r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y), r.position])
		for i in 4:
			var d := (pts[i + 1] - pts[i]); var n := int(d.length() / (p * 0.5))
			for k in range(0, n, 2): ci.draw_line(pts[i] + d * (float(k) / float(maxi(n, 1))), pts[i] + d * (float(k + 1) / float(maxi(n, 1))), col, maxf(1.5, p * 0.06))
		var tx := str(sl.get("text", "")); var w := ThemeDB.fallback_font.get_string_size(tx, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs).x
		_txt(ci, tx, Vector2(r.get_center().x - w * 0.5, r.end.y - p * 0.15), fs, Color(1.0, 0.85, 0.5, 0.8))
	for mk in m.get("marks", []):
		var c := _px(_pad_of(mk.pad)); var tx := str(mk.get("text", ""))
		var w := ThemeDB.fallback_font.get_string_size(tx, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs).x
		var chip := Rect2(c + Vector2(-w * 0.5 - 7.0, -p * 1.45), Vector2(w + 14.0, fs + 8.0))
		if tx == "J": chip.position = c + Vector2(p * 0.5, -p * 0.2 - float(fs))
		PartArt.rrect(ci, chip, 6.0, Color("#b8893a")); PartArt.rrect(ci, chip.grow(-2.0), 5.0, Color("#e3c070"))
		ci.draw_string(ThemeDB.fallback_font, chip.position + Vector2(7.0, fs + 1.0), tx, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, Color(0.16, 0.1, 0.03, 0.97))

static func _pad_of(a) -> Vector2: return Vector2(float(a[0]), float(a[1]))

func _draw_fx(ci: Control) -> void:
	if cute: _draw_cute(ci)
	_draw_marks(ci)
	_draw_labels(ci)
	_draw_dangling(ci, _m())
	if not overlay.is_empty(): _draw_overlay(ci)
	for q in _smoke:
		var k: float = q.age / q.life
		var a := 0.85 * pow(1.0 - k, 1.2) * minf(1.0, q.age * 6.0)
		var r: float = q.r * (1.0 + 2.6 * k)
		_blob(ci, q.pos, r, Color(0.55, 0.6, 0.67, a))


## -------------------------------------------------------------------------------------------------------------- Cute mode (charm encodes physics)

const CUTE_BODY := Color("#bff4ff")

func _draw_cute(ci: Control) -> void:
	var m := _m()
	for c in _critters:   # electron critters: one per dot, pace = log I (same phase the dots use), facing the way they walk
		_critter(ci, c[0], c[1], c[2], c[3])
	for pt in m.parts:
		if pt.kind != "LED": continue
		var cen := _px(Vector2(pt.x, pt.y) + NodeApi._rot_off(Vector2(1, 0), pt.rot, pt.flip))
		var ma := absf(float(m.part_i.get(pt.uid, 0.0))) * 1000.0 if m.powered else 0.0
		var lm: Dictionary = m.get("led", {}).get(pt.uid, {})
		if not lm.is_empty(): ma = float(lm.mA)   # engine LED: mood and bloom come with the frame
		_led_face(ci, cen, ma, m.smoked.has(pt.uid), pt.uid, str(lm.get("mood", "")))

func _critter(ci: CanvasItem, c: Vector2, dir: Vector2, sc: float, ph: float) -> void:
	var r := p * 0.27 * sc
	var bob := sin(ph * 0.35 + t * 9.0) * r * 0.14
	var c2 := c + Vector2(0, bob)
	ci.draw_circle(c2 + Vector2(r * 0.12, r * 0.45), r * 1.0, Color(0, 0, 0, 0.28))   # little shadow
	var foot := sin(ph * 0.35 + t * 9.0)
	ci.draw_circle(c2 + Vector2(-r * 0.45, r * 0.85 + foot * r * 0.18), r * 0.26, Color("#6ec5dc"))
	ci.draw_circle(c2 + Vector2(r * 0.45, r * 0.85 - foot * r * 0.18), r * 0.26, Color("#6ec5dc"))
	ci.draw_circle(c2, r, Color("#6ec5dc")); ci.draw_circle(c2 + Vector2(0, -r * 0.08), r * 0.88, CUTE_BODY)
	var side := Vector2(-dir.y, dir.x)
	var fc := c2 + dir * r * 0.38 + Vector2(0, -r * 0.05)
	for sgn in [-1.0, 1.0]:
		var e: Vector2 = fc + side * r * 0.3 * sgn
		ci.draw_circle(e, r * 0.2, Color.WHITE); ci.draw_circle(e + dir * r * 0.06, r * 0.11, Color(0.04, 0.06, 0.12))
	ci.draw_line(c2 - dir * r * 0.5 - Vector2(r * 0.22, 0), c2 - dir * r * 0.5 + Vector2(r * 0.22, 0), Color("#3b8aa3"), maxf(1.0, r * 0.16))   # the minus on its back: an electron

## Heat 0..1 for a part: the engine's own (liveFrame thermal state) when the model carries it, else the temperature ramp.
func _heat_k(uid: String, m: Dictionary) -> float:
	var h: Dictionary = m.get("heat", {})
	if not h.is_empty(): return float(h.get(uid, 0.0))
	return clampf((float(m.temps.get(uid, m.ambient)) - 45.0) / 110.0, 0.0, 1.0)

## LED glow 0..1: the engine's bloom (log current, 10 uA..30 mA) when present.
func _led_lit(uid: String, amps: float, m: Dictionary) -> float:
	var lm: Dictionary = m.get("led", {}).get(uid, {})
	return float(lm.bloom) if not lm.is_empty() else _led_k(amps)

func _led_face(ci: CanvasItem, cen: Vector2, ma: float, smoked: bool, uid: String, mood := "") -> void:
	var r := p * 0.6
	var ink := Color(0.09, 0.015, 0.02, 0.95) if ma > 3.0 else Color(0.95, 0.72, 0.72, 0.9)
	var w := maxf(1.5, p * 0.075)
	var ey := cen.y - r * 0.1; var ex := r * 0.34
	if smoked:   # cracked: X eyes, flat wobbly mouth
		ink = Color(0.75, 0.75, 0.78, 0.95)
		for sgn in [-1.0, 1.0]:
			var e := Vector2(cen.x + ex * sgn, ey)
			ci.draw_line(e + Vector2(-r * 0.13, -r * 0.13), e + Vector2(r * 0.13, r * 0.13), ink, w); ci.draw_line(e + Vector2(-r * 0.13, r * 0.13), e + Vector2(r * 0.13, -r * 0.13), ink, w)
		ci.draw_polyline(PackedVector2Array([cen + Vector2(-r * 0.3, r * 0.42), cen + Vector2(-r * 0.1, r * 0.34), cen + Vector2(r * 0.1, r * 0.44), cen + Vector2(r * 0.3, r * 0.36)]), ink, w)
		return
	if mood == "": mood = "sleepy" if ma < 2.0 else ("happy" if ma <= 20.0 else "sweating")
	if mood == "sleepy":   # sleepy: closed eyes, tiny mouth, drifting z
		for sgn in [-1.0, 1.0]: ci.draw_arc(Vector2(cen.x + ex * sgn, ey), r * 0.14, 0.15, PI - 0.15, 8, ink, w)
		ci.draw_circle(cen + Vector2(0, r * 0.4), r * 0.05, ink)
		if not reduced_motion:
			var zt := fposmod(t * 0.5 + float(uid.hash() % 7) * 0.13, 1.0)
			_txt(ci, "z", cen + Vector2(r * 0.7 + zt * r * 0.4, -r * 0.7 - zt * r * 0.8), int(clampf(p * 0.5, 10.0, 26.0)), Color(0.85, 0.9, 1.0, 1.0 - zt), HORIZONTAL_ALIGNMENT_LEFT, false)
	elif mood == "happy":   # happy: bright eyes and a smile that grows with the in-spec current
		var big := clampf((ma - 2.0) / 10.0, 0.0, 1.0)
		for sgn in [-1.0, 1.0]:
			var e := Vector2(cen.x + ex * sgn, ey)
			ci.draw_circle(e, r * 0.11, ink); ci.draw_circle(e + Vector2(-r * 0.03, -r * 0.04), r * 0.035, Color(1, 1, 1, 0.9))
		ci.draw_arc(cen + Vector2(0, r * 0.12), r * (0.28 + 0.1 * big), 0.35, PI - 0.35, 12, ink, w)
	else:   # sweating: worried brows, wobbly mouth, a sweat drop sliding down
		var panic := clampf((ma - 20.0) / 15.0, 0.0, 1.0)
		for sgn in [-1.0, 1.0]:
			var e := Vector2(cen.x + ex * sgn, ey)
			ci.draw_circle(e, r * (0.12 + 0.05 * panic), Color.WHITE); ci.draw_circle(e, r * 0.06, Color(0.05, 0.02, 0.02))
			ci.draw_line(e + Vector2(-r * 0.16 * sgn, -r * 0.2 * 1.0 - r * 0.06), e + Vector2(r * 0.12 * sgn, -r * 0.3), ink, w)
		var pts := PackedVector2Array()
		for i in 9: pts.append(cen + Vector2(-r * 0.3 + r * 0.075 * i, r * 0.42 + sin(t * 18.0 + i * 1.3) * r * 0.035))
		ci.draw_polyline(pts, ink, w)
		var dp := fposmod(t * 1.3, 1.0)
		var dc := cen + Vector2(r * 0.62, -r * 0.35 + dp * r * 0.8)
		ci.draw_circle(dc, r * 0.1, Color(0.6, 0.85, 1.0, 1.0 - dp * 0.7)); ci.draw_colored_polygon(PackedVector2Array([dc + Vector2(0, -r * 0.24), dc + Vector2(-r * 0.08, -r * 0.05), dc + Vector2(r * 0.08, -r * 0.05)]), Color(0.6, 0.85, 1.0, 1.0 - dp * 0.7))


## A small dark label box beside a point (which pin the pointer is on, where a wire would land).
func _note(ci: CanvasItem, at: Vector2, text: String, col: Color) -> void:
	var fs := maxi(int(clampf(p * 0.42, 12.0, 18.0)), SS.min_font)
	var f := ThemeDB.fallback_font
	var tw := f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs).x
	var r := Rect2(at + Vector2(p * 0.55, -p * 1.15), Vector2(tw + 14.0, fs + 10.0))
	if r.end.x > size.x - 4.0: r.position.x = at.x - p * 0.55 - r.size.x
	if r.position.y < 2.0: r.position.y = at.y + p * 0.5
	PartArt.rrect(ci, r, 6.0, Color(0.06, 0.07, 0.09, 0.92)); PartArt.rrect(ci, r.grow(-1.5), 5.0, Color(0.1, 0.12, 0.14, 0.95))
	ci.draw_string(f, r.position + Vector2(7.0, fs + 3.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, fs, col)

## A wire end that touches no leg: a pulsing red ring with a cross, so it cannot be mistaken for a connection.
func _draw_dangling(ci: CanvasItem, m: Dictionary) -> void:
	for d in m.get("dangling", []):
		var c := _px(Vector2(d.pad[0], d.pad[1]))
		var k := 0.5 + 0.5 * sin(t * 5.0)
		ci.draw_arc(c, p * (0.42 + 0.06 * k), 0.0, TAU, 24, Color(1.0, 0.3, 0.25, 0.7 + 0.3 * k), maxf(2.0, p * 0.09), true)
		var r := p * 0.17
		ci.draw_line(c + Vector2(-r, -r), c + Vector2(r, r), Color(1.0, 0.3, 0.25), maxf(2.0, p * 0.08)); ci.draw_line(c + Vector2(-r, r), c + Vector2(r, -r), Color(1.0, 0.3, 0.25), maxf(2.0, p * 0.08))

## -------------------------------------------------------------------------------------------------------------- interaction overlay

func _draw_overlay(ci: Control) -> void:
	var m := _m()
	if overlay.has("hover_wire"):
		var hw: Array = _wire_geom(m).get(str(overlay.hover_wire), [])
		if hw.size() >= 2:
			ci.draw_polyline(PackedVector2Array(hw), Color(1.0, 0.85, 0.4, 0.5), p * 0.55, true)
			ci.draw_polyline(PackedVector2Array(hw), Color(1.0, 0.95, 0.75, 0.9), p * 0.09, true)
	if overlay.has("hover_pad"):
		var hp: Vector2 = overlay.hover_pad
		var pin_hit: bool = str(overlay.get("hover_label", "")) != ""
		ci.draw_arc(_px(hp), p * (0.5 if pin_hit else 0.42), 0.0, TAU, 20, Color(0.55, 1.0, 0.6, 0.95) if pin_hit else Color(1.0, 0.85, 0.5, 0.9), maxf(2.0, p * (0.1 if pin_hit else 0.07)), true)
		_blob(ci, _px(hp), p * (0.95 if pin_hit else 0.7), Color(0.55, 1.0, 0.6, 0.3) if pin_hit else Color(1.0, 0.85, 0.5, 0.18))
		if pin_hit: _note(ci, _px(hp), str(overlay.hover_label), Color(0.55, 1.0, 0.6))
	if overlay.has("ghost"):
		var g: Dictionary = overlay.ghost
		var ok: bool = g.ok; var col := Color(0.45, 1.0, 0.5) if ok else Color(1.0, 0.35, 0.3)
		var pd: Dictionary = g.part
		var o: Vector2 = g.origin
		PartArt.draw(ci, pd, _px(o), p, {"lit": 0.0, "smoked": false})
		var pins: Array = g.pins
		for q in pins:
			var c := _px(q)
			ci.draw_circle(c, p * 0.3, Color(col, 0.28)); ci.draw_arc(c, p * 0.3, 0.0, TAU, 16, col, maxf(2.0, p * 0.07), true)
		if pins.size() == 2:   # the lead ghost: a dashed line between the pins so the span reads before release
			var a := _px(pins[0]); var b := _px(pins[1]); var d := (b - a); var n := int(d.length() / (p * 0.35))
			for i in range(0, n, 2): ci.draw_line(a + d * (float(i) / n), a + d * (float(i + 1) / n), Color(col, 0.8), maxf(2.0, p * 0.07))
		var bnd := PartArt.screen_bounds(pd, pins.map(func(q): return _px(q)), p)
		PartArt.rrect(ci, bnd, p * 0.3, Color(col, 0.10))
	if overlay.has("wire"):
		var w: Dictionary = overlay.wire
		var a2 := _px(w.from); var b2: Vector2 = w.to
		var tg: Vector2 = w.get("target", Vector2(-1, -1))
		if tg.x >= 0:
			b2 = _px(tg)
			var bad: bool = bool(w.get("bad", false))
			var rc := Color(1.0, 0.45, 0.35, 0.95) if bad else Color(0.5, 1.0, 0.55, 0.95)
			ci.draw_arc(b2, p * 0.46, 0.0, TAU, 20, rc, maxf(2.0, p * 0.09), true)
			if not bad: _blob(ci, b2, p * 1.1, Color(rc, 0.28)); ci.draw_arc(b2, p * 0.7, 0.0, TAU, 24, Color(rc, 0.6), maxf(2.0, p * 0.06), true)   # the leg this end will land on glows
			if str(w.get("label", "")) != "": _note(ci, b2, str(w.label), rc)
		var mid := Vector2(b2.x, a2.y)
		var pts := PackedVector2Array([a2, mid, b2]) if (absf(a2.x - b2.x) > 1.0 and absf(a2.y - b2.y) > 1.0) else PackedVector2Array([a2, b2])
		ci.draw_polyline(pts, Color(0, 0, 0, 0.4), p * 0.3, true)
		ci.draw_polyline(pts, Color(0.95, 0.75, 0.3, 0.9), p * 0.16, true)
		ci.draw_circle(a2, p * 0.27, Color(0.8, 0.82, 0.86)); ci.draw_circle(a2 + Vector2(-p * 0.07, -p * 0.07), p * 0.07, Color(1, 1, 1, 0.7))
