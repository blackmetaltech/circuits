extends Control
## LOOK2 bench interface: a precise maker-tool language (dark anodised panels, Inter + JetBrains Mono, real units, one amber accent).
## Title, job card with live spec readings, parts drawer, tool strip, failure panel, status chips, and the schematic view (Tab).
## Sizes are for the 1920x1080 canvas (the project stretches canvas_items); body text 21 px stays >= 15 px at 1280x800.

const BG := Color(0.082, 0.090, 0.102, 0.93)
const BG2 := Color(0.115, 0.125, 0.140, 0.96)
const EDGE := Color(1, 1, 1, 0.07)
const TXT := Color(0.86, 0.88, 0.90)
const DIM := Color(0.56, 0.60, 0.65)
const AMBER := Color(0.91, 0.64, 0.24)
const OKC := Color(0.42, 0.74, 0.50)
const BAD := Color(0.86, 0.36, 0.30)

var bench   ## Workbench
var f_sans: Font
var f_semi: Font
var f_mono: Font
var schem := false
var _root: Control
var _drawer_box: VBoxContainer
var _drawer_sig := ""

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); mouse_filter = Control.MOUSE_FILTER_IGNORE
	f_sans = load("res://look2/assets/fonts/Inter-Regular.ttf"); f_semi = load("res://look2/assets/fonts/Inter-SemiBold.ttf"); f_mono = load("res://look2/assets/fonts/JetBrainsMono-Medium.ttf")
	var th := Theme.new(); th.default_font = f_sans; th.default_font_size = 21; theme = th
	bench.changed.connect(_rebuild)
	if OS.get_environment("CB_SCHEM") == "1": schem = true
	_rebuild()

func _process(_dt: float) -> void:
	if bench.mode != "title": _refresh_live(); queue_redraw()

func toggle_schematic() -> void: schem = not schem; _rebuild()

## ------------------------------------------------------------------------------------------------ helpers

func _panel(pos: Vector2, size: Vector2, accent := Color(0, 0, 0, 0)) -> PanelContainer:
	var p := PanelContainer.new(); p.position = pos; p.custom_minimum_size = size; p.size = size
	var sb := StyleBoxFlat.new(); sb.bg_color = BG; sb.corner_radius_top_left = 8; sb.corner_radius_top_right = 8; sb.corner_radius_bottom_left = 8; sb.corner_radius_bottom_right = 8
	sb.border_width_top = 1; sb.border_color = EDGE; sb.shadow_color = Color(0, 0, 0, 0.45); sb.shadow_size = 14; sb.shadow_offset = Vector2(0, 4)
	sb.content_margin_left = 20; sb.content_margin_right = 20; sb.content_margin_top = 16; sb.content_margin_bottom = 16
	if accent.a > 0: sb.border_width_left = 4; sb.border_color = accent
	p.add_theme_stylebox_override("panel", sb)
	_root.add_child(p)
	return p

## Canvas font size that lands at >= 16 real pixels in this window (the canvas stretches: at 1280x800 one canvas px is 0.67 px).
func fs(n: int) -> int:
	var vis := get_viewport().get_visible_rect().size
	var k := float(DisplayServer.window_get_size().x) / maxf(vis.x, 1.0)
	return maxi(n, int(ceil(16.0 / maxf(k, 0.1))))

func _lab(parent: Node, text: String, size := 21, col := TXT, font: Font = null, wrap := false) -> Label:
	var l := Label.new(); l.text = text; l.add_theme_font_size_override("font_size", fs(size)); l.add_theme_color_override("font_color", col)
	l.add_theme_font_override("font", font if font else f_sans)
	if wrap: l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(l)
	return l

func _btn(parent: Node, text: String, cb: Callable, key := "", primary := false, active := false) -> Button:
	var b := Button.new(); b.text = text; b.focus_mode = Control.FOCUS_ALL
	b.add_theme_font_override("font", f_semi); b.add_theme_font_size_override("font_size", fs(19))
	for st in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = (AMBER if primary else (Color(0.22, 0.24, 0.27) if active else BG2))
		if st == "hover": sb.bg_color = sb.bg_color.lightened(0.08)
		if st == "pressed": sb.bg_color = sb.bg_color.darkened(0.1)
		if st == "focus": sb.draw_center = false; sb.border_width_bottom = 2; sb.border_width_top = 2; sb.border_width_left = 2; sb.border_width_right = 2; sb.border_color = AMBER
		sb.corner_radius_top_left = 6; sb.corner_radius_top_right = 6; sb.corner_radius_bottom_left = 6; sb.corner_radius_bottom_right = 6
		sb.border_width_top = maxi(sb.border_width_top, 1); if st != "focus": sb.border_color = Color(1, 1, 1, 0.08) if not active else AMBER
		if active and st != "focus": sb.border_width_bottom = 2
		sb.content_margin_left = 14; sb.content_margin_right = 14; sb.content_margin_top = 9; sb.content_margin_bottom = 9
		b.add_theme_stylebox_override(st, sb)
	b.add_theme_color_override("font_color", Color(0.08, 0.07, 0.05) if primary else TXT)
	b.add_theme_color_override("font_hover_color", Color(0.08, 0.07, 0.05) if primary else Color.WHITE)
	if key != "": b.text = "%s   %s" % [text, key]
	b.pressed.connect(cb)
	parent.add_child(b)
	return b

## ------------------------------------------------------------------------------------------------ layout

var _spec_vals := {}
var _status: Label
var _readout: Label

func _rebuild() -> void:
	if _root: _root.queue_free()
	_root = Control.new(); add_child(_root); _root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); _root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_spec_vals.clear(); _drawer_sig = ""
	if bench.mode == "title": _title(); return
	if schem:
		var sv := SchematicView.new(); sv.bench = bench; sv.ui = self; _root.add_child(sv); sv.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); sv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_job_card()
	if bench.view in [1, 5] or bench.tool == "place" or bench.mode == "free": _drawer()
	_tools()
	_status_chip()
	_failure()

func _title() -> void:
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 12); v.position = Vector2(110, 560); v.custom_minimum_size = Vector2(560, 0); _root.add_child(v)
	var wm := _lab(v, "CIRCUITS", 40, TXT, f_semi); wm.add_theme_constant_override("outline_size", 0)
	_lab(v, "An electronics workbench. Repair real devices, build circuits, and see why they work.", 22, DIM, f_sans, true)
	var gap := Control.new(); gap.custom_minimum_size = Vector2(0, 10); v.add_child(gap)
	var b1 := _btn(v, "Jobs: 5-1  Fan Driver", func(): bench.start_job(), "", true)
	_lab(v, "A 5 V microcontroller pin has to switch a 12 V desk fan.", 18, DIM)
	_btn(v, "Free bench", func(): bench.start_free())
	_lab(v, "Every part in the catalogue on an open board. Pause time and step it.", 18, DIM)
	b1.call_deferred("grab_focus")
	_lab(v, "Right drag orbits   Middle drag pans   Wheel zooms   1-4 views   Tab schematic", 16, DIM, f_mono)

func _job_card() -> void:
	var t: Dictionary = bench.backend.ticket
	var p := _panel(Vector2(28, 28), Vector2(470, 0))
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 8); p.add_child(v)
	if bench.mode == "free":
		_lab(v, "FREE BENCH", 16, AMBER, f_semi)
		_lab(v, "Open testbed", 30, TXT, f_semi)
		_lab(v, "Any part from the drawer, the supply, scope and meter. Space powers the bench. Pause time with the scope's RUN key, step it with the full stop key.", 18, DIM, f_sans, true)
		_lab(v, "Saving builds and opening known devices come in the next build.", 17, DIM, f_sans, true)
		return
	_lab(v, "WORK ORDER  %s" % str(t.get("id", "")), 16, AMBER, f_semi)
	_lab(v, str(t.get("title", "")), 30, TXT, f_semi)
	_lab(v, "Desk fan, from %s.  %s" % [str(t.get("customer", "")), str(t.get("ask", ""))], 18, DIM, f_sans, true)
	var sep := HSeparator.new(); v.add_child(sep)
	for s in t.get("specs", []):
		var row := HBoxContainer.new(); row.add_theme_constant_override("separation", 10); v.add_child(row)
		var mark := _lab(row, "○", 20, DIM, f_mono)
		var nm := _lab(row, _short(str(s.get("id", "")), str(s.get("name", ""))), 18, TXT); nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var val := _lab(row, "—", 20, TXT, f_mono)
		_spec_vals[str(s.id)] = [mark, val]
	_lab(v, "Pays %s.  Parts used: %s." % [str(t.get("pay_text", t.get("price_text", ""))).trim_prefix("fee "), str(bench.backend.last_result.get("costText", "$0.00"))], 17, DIM, f_sans, true)
	v.add_child(HSeparator.new())
	_status = _lab(v, "", 18, TXT, f_mono)
	_readout = _lab(v, "", 18, DIM, f_mono)
	var seg := HBoxContainer.new(); seg.add_theme_constant_override("separation", 4); v.add_child(seg)
	_lab(seg, "PIN", 16, DIM, f_semi).custom_minimum_size = Vector2(52, 0)
	var opts: Array = []
	for sl in bench.backend.selectors: if str(sl.id) == "pin": opts = sl.options
	for i in opts.size():
		var idx := i
		_btn(seg, str(opts[i]), func(): bench.set_pin(idx), "", false, bench.pin_mode() == str(opts[i]))

func _short(id: String, name: String) -> String:
	match id:
		"fanhi": return "Fan with pin high  ≥ 11.0 V"
		"fanlo": return "Fan with pin low  ≤ 0.5 V"
		"ipin": return "Pin current  ≤ 20 mA"
	return name

func _drawer() -> void:
	var p := _panel(Vector2(28, 420 if bench.mode == "job" else 330), Vector2(470, 470 if bench.mode == "job" else 560))
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 6); p.add_child(v)
	_lab(v, "PARTS DRAWER" if bench.mode == "job" else "CATALOGUE  (all parts)", 16, AMBER, f_semi)
	var sc := ScrollContainer.new(); sc.size_flags_vertical = Control.SIZE_EXPAND_FILL; sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; v.add_child(sc)
	_drawer_box = VBoxContainer.new(); _drawer_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL; _drawer_box.add_theme_constant_override("separation", 4); sc.add_child(_drawer_box)
	var last_kind := ""
	for it in bench.drawer():
		var kind := _kind_name(str(it.kind))
		if kind != last_kind:
			last_kind = kind
			_lab(_drawer_box, kind, 15, DIM, f_semi)
		var row := Button.new(); row.alignment = HORIZONTAL_ALIGNMENT_LEFT; row.focus_mode = Control.FOCUS_ALL
		row.text = "%s    %s" % [str(it.label), str(it.get("price_text", ""))]
		row.tooltip_text = str(it.get("tag", ""))
		row.add_theme_font_override("font", f_mono); row.add_theme_font_size_override("font_size", fs(18))
		var active: bool = bench.tool == "place" and bench.place_item.get("i", -1) == it.i and str(bench.place_item.get("partId", "")) == str(it.partId)
		for st in ["normal", "hover", "pressed", "focus"]:
			var sb := StyleBoxFlat.new(); sb.bg_color = Color(0.20, 0.17, 0.11) if active else (BG2 if st != "hover" else BG2.lightened(0.06))
			if st == "focus": sb.draw_center = false; sb.border_color = AMBER; sb.border_width_left = 2
			sb.content_margin_left = 12; sb.content_margin_top = 6; sb.content_margin_bottom = 6; sb.corner_radius_top_left = 4; sb.corner_radius_bottom_left = 4; sb.corner_radius_top_right = 4; sb.corner_radius_bottom_right = 4
			row.add_theme_stylebox_override(st, sb)
		row.add_theme_color_override("font_color", AMBER if active else TXT)
		var item: Dictionary = it
		row.pressed.connect(func(): bench.pick_part(item))
		_drawer_box.add_child(row)

## SI value text with 3 significant digits: 0.000072 V -> "72.0 µV", 0.0171478 A -> "17.1 mA".
static func si(v: float, unit: String) -> String:
	var a := absf(v)
	var pre := [[1e3, "k"], [1.0, ""], [1e-3, "m"], [1e-6, "µ"]]
	for e in pre:
		if a >= float(e[0]) * 0.9995 or e[1] == "µ":
			var x := v / float(e[0])
			var d := 2 if absf(x) < 10.0 else (1 if absf(x) < 100.0 else 0)
			return "%s %s%s" % [String.num(x, d), e[1], unit]
	return "%s %s" % [String.num(v, 3), unit]

func _kind_name(k: String) -> String:
	return {"R": "RESISTORS", "D": "DIODES", "NPN": "TRANSISTORS", "PNP": "TRANSISTORS", "DARLINGTON": "TRANSISTORS", "NMOS": "MOSFETS", "C": "CAPACITORS", "CE": "ELECTROLYTICS", "LED": "LEDS", "Z": "ZENERS", "REG": "REGULATORS", "OPAMP": "OP-AMPS", "L": "INDUCTORS"}.get(k, k)

func _tools() -> void:
	var p := _panel(Vector2(560, 980), Vector2(0, 0))
	var h := HBoxContainer.new(); h.add_theme_constant_override("separation", 8); p.add_child(h)
	_btn(h, "Select", func(): bench.set_tool("select"), "Esc", false, bench.tool == "select")
	_btn(h, "Wire", func(): bench.set_tool("wire"), "W", false, bench.tool == "wire")
	_btn(h, "Scope probe", func(): bench.set_tool("probe"), "P", false, bench.tool == "probe")
	_btn(h, "Meter leads", func(): bench.set_tool("red"), "M", false, bench.tool in ["red", "black"])
	_btn(h, ("Power off" if bench.backend.powered else "Power on"), func(): bench.toggle_power(), "Space", false, bench.backend.powered)
	if bench.mode == "job": _btn(h, "Run bench test", func(): bench.run_test(), "Enter", true)
	_btn(h, "Undo", func(): bench.undo(), "Ctrl+Z")
	_btn(h, "Schematic", func(): toggle_schematic(), "Tab", false, schem)
	_btn(h, "Menu", func(): bench.back_to_title())
	p.position.x = (1920 - p.get_combined_minimum_size().x) * 0.5

func _status_chip() -> void:
	var p := _panel(Vector2(1500, 28), Vector2(0, 0))
	var v := VBoxContainer.new(); p.add_child(v)
	if bench.mode == "free":
		_status = _lab(v, "", 18, TXT, f_mono)
	_lab(v, "1 work   2 bench   3 scope   4 device   5 wiring", 16, DIM, f_mono)
	p.position.x = 1892 - p.get_combined_minimum_size().x

func _failure() -> void:
	var f: Dictionary = bench.last_failure
	var txt: String = bench.note
	if f.is_empty() and txt == "": return
	var p := _panel(Vector2(560, 760), Vector2(800, 0), BAD if not f.is_empty() else AMBER)
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 8); p.add_child(v)
	if not f.is_empty():
		_lab(v, str(f.get("title", "")), 24, BAD.lightened(0.15), f_semi)
		_lab(v, str(f.get("text", "")), 19, TXT, f_sans, true)
		_lab(v, "Ctrl+Z swaps in a fresh part with the power off. Then change the circuit and try again.", 17, DIM, f_sans, true)
	else:
		_lab(v, txt, 19, TXT, f_sans, true)
	p.position.x = (1920 - 800) * 0.5 + 60

func _refresh_live() -> void:
	var b = bench.backend
	if _status and is_instance_valid(_status): _status.text = "POWER %s" % ("ON" if b.powered else "OFF")
	var fan_v: float = b.volt_at([16, 2]) - b.volt_at([22, 2])
	var ipin: float = float(b.scope_view.get("value", 0.0)) / 1000.0
	var has_i: bool = b.powered and str(b.scope_view.get("text", "")) != ""
	var pm: String = bench.pin_mode()
	if _readout and is_instance_valid(_readout): _readout.text = "Fan %s    Pin %s" % [(si(fan_v, "V") if pm != "100 Hz" else "switching") if b.powered else "--", si(ipin, "A") if has_i else "--"]
	var res: Dictionary = b.last_result
	var specs := {}
	for s in res.get("specs", []): specs[str(s.id)] = s
	var meas: Dictionary = res.get("measured", {})
	for id in _spec_vals:
		var mark: Label = _spec_vals[id][0]; var val: Label = _spec_vals[id][1]
		var live := ""
		if b.powered:
			if id == "fanhi" and bench.pin_mode() == "high": live = si(fan_v, "V")
			if id == "fanlo" and bench.pin_mode() == "low": live = si(fan_v, "V")
			if id == "ipin" and has_i: live = si(ipin, "A")
		if live == "" and meas.has(id): live = si(float(meas[id]), "A" if id == "ipin" else "V")
		val.text = live if live != "" else "—"
		if specs.has(id):
			var ok: bool = bool(specs[id].get("pass", false))
			mark.text = "●" ; mark.add_theme_color_override("font_color", OKC if ok else BAD)
		else:
			mark.text = "○"; mark.add_theme_color_override("font_color", DIM)

## ------------------------------------------------------------------------------------------------ schematic

class SchematicView extends Control:
	var bench
	var ui
	const LINE := Color(0.72, 0.78, 0.84)
	const PART := Color(0.92, 0.94, 0.96)

	func _process(_d: float) -> void: queue_redraw()

	func _draw() -> void:
		var b = bench.backend
		if b.ticket.is_empty(): return
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.045, 0.05, 0.058, 0.97))
		var W: int = int(b.ticket.board.w); var H: int = int(b.ticket.board.h)
		var area := Rect2(560, 120, 1300, 820)
		var s := minf(area.size.x / (W + 1), area.size.y / (H + 1))
		var o := area.position + (area.size - Vector2(W - 1, H - 1) * s) * 0.5
		var P := func(q) -> Vector2: return o + Vector2(float(q[0]), float(q[1])) * s
		# faint dot grid
		for y in H:
			for x in W: draw_circle(o + Vector2(x, y) * s, 1.4, Color(1, 1, 1, 0.06))
		var deg := {}
		for w in b.wires:
			for i in (w.path as Array).size() - 1: draw_line(P.call(w.path[i]), P.call(w.path[i + 1]), LINE, 2.5, true)
			for e in [w.path[0], w.path[w.path.size() - 1]]: var k := "%d,%d" % [int(e[0]), int(e[1])]; deg[k] = int(deg.get(k, 0)) + 1
		for k in deg:
			if int(deg[k]) >= 2: var xy: PackedStringArray = str(k).split(","); draw_circle(o + Vector2(float(xy[0]), float(xy[1])) * s, 5.0, LINE)
		var font: Font = ui.f_mono
		for c in b.ticket.board.connectors:
			var p: Vector2 = P.call(c.pad)
			draw_circle(p, 8.0, Color(0.91, 0.64, 0.24)); draw_circle(p, 5.0, Color(0.045, 0.05, 0.058))
			var txt := str(c.id)
			if b.powered: txt += "  %s V" % EngineBench._g(b.volt_at(c.pad), 3)
			draw_string(font, p + Vector2(-20 if int(c.pad[0]) < W / 2 else 14, -14), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(0.91, 0.64, 0.24))
		for p in b.parts: _symbol(p, P, s, font)
		draw_string(ui.f_semi, Vector2(560, 100), "SCHEMATIC  (mirrors the board; node voltages when powered)", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(0.56, 0.6, 0.65))

	func _symbol(p: Dictionary, P: Callable, s: float, font: Font) -> void:
		var pins: Array = p.pins
		if pins.size() < 2: return
		var a: Vector2 = P.call(pins[0]); var c: Vector2 = P.call(pins[pins.size() - 1])
		var col := Color(0.95, 0.4, 0.3) if bench.backend.smoked.has(str(p.uid)) else PART
		var kind := str(p.kind)
		var mid := (a + c) * 0.5; var dir := (c - a).normalized(); var nrm := Vector2(-dir.y, dir.x)
		match kind:
			"R":
				var L := minf(a.distance_to(c) * 0.6, 3.0 * s)
				var p0 := mid - dir * L * 0.5
				draw_line(a, p0, col, 2.5); draw_line(mid + dir * L * 0.5, c, col, 2.5)
				var pts := PackedVector2Array([p0])
				for i in 6: pts.append(p0 + dir * L * (i + 0.5) / 6.0 + nrm * (8.0 if i % 2 == 0 else -8.0))
				pts.append(mid + dir * L * 0.5); draw_polyline(pts, col, 2.5, true)
			"D", "LED":
				var t0 := mid - dir * 10.0; var t1 := mid + dir * 10.0
				draw_line(a, t0, col, 2.5); draw_line(t1, c, col, 2.5)
				draw_colored_polygon(PackedVector2Array([t0 + nrm * 10, t0 - nrm * 10, t1]), col)
				draw_line(t1 + nrm * 11, t1 - nrm * 11, col, 3.0)
			"NPN", "PNP", "DARLINGTON":
				# standard symbol: base into a bar, collector and emitter diagonals, arrow on the emitter; leads run to the real pins
				var names: Array = p.get("pin_labels", [])
				var pin_of := {}
				for i in mini(names.size(), pins.size()): pin_of[str(names[i])] = P.call(pins[i])
				var cen := Vector2.ZERO
				for q in pins: cen += P.call(q)
				cen /= pins.size(); cen += Vector2(0, -1.4 * s)
				var r := 0.85 * s
				draw_arc(cen, r, 0, TAU, 48, col, 2.0, true)
				var bar_x := cen.x - r * 0.25
				draw_line(Vector2(bar_x, cen.y - r * 0.55), Vector2(bar_x, cen.y + r * 0.55), col, 3.0)
				var bt := Vector2(cen.x - r * 1.05, cen.y)
				draw_line(bt, Vector2(bar_x, cen.y), col, 2.2)
				var ct := Vector2(cen.x + r * 0.45, cen.y - r * 0.85); var et := Vector2(cen.x + r * 0.45, cen.y + r * 0.85)
				draw_line(Vector2(bar_x, cen.y - r * 0.25), ct, col, 2.2); draw_line(Vector2(bar_x, cen.y + r * 0.25), et, col, 2.2)
				var ed := (et - Vector2(bar_x, cen.y + r * 0.25)).normalized(); var en := Vector2(-ed.y, ed.x)
				var tip := et - ed * r * 0.12 if kind != "PNP" else Vector2(bar_x, cen.y + r * 0.25) + ed * r * 0.35
				var dirv := ed if kind != "PNP" else -ed
				draw_colored_polygon(PackedVector2Array([tip, tip - dirv * 9 + en * 5, tip - dirv * 9 - en * 5]), col)
				var term := {"B": bt, "C": ct, "E": et}
				for nm in term:
					if pin_of.has(nm):
						var pp: Vector2 = pin_of[nm]; var tt: Vector2 = term[nm]
						draw_polyline(PackedVector2Array([tt, Vector2(tt.x, pp.y) if nm != "B" else Vector2(pp.x, tt.y), pp]), Color(0.72, 0.78, 0.84), 2.0, true)
						draw_string(font, tt + Vector2(6 if nm != "B" else -18, -6 if nm == "C" else 18), nm, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.56, 0.6, 0.65))
			"MOTOR":
				draw_line(a, mid - dir * 22, col, 2.5); draw_line(mid + dir * 22, c, col, 2.5)
				draw_arc(mid, 22, 0, TAU, 40, col, 2.5, true)
				draw_string(font, mid + Vector2(-8, 8), "M", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, col)
			_:
				draw_line(a, c, col, 2.0)
				draw_rect(Rect2(mid - Vector2(16, 10), Vector2(32, 20)), col, false, 2.0)
		draw_string(font, mid + nrm * 26 + Vector2(-20, 6), str(p.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(0.56, 0.6, 0.65))
