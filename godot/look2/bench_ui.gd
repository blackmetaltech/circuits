class_name BenchUI
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
	if bench.mode != "title":
		_refresh_live(); queue_redraw()
		if bench.tool in ["wire", "red", "black", "probe"]: _place_tip()

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
	if DisplayServer.get_name() == "headless": return n   # no screen pixels to protect; the flows lay out at the design size
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

## ------------------------------------------------------------------------------------------------ instrument parts
## Round 3: the interface is made of bench objects. Faceplates are machined graphite with four screws and engraved labels,
## readings sit in recessed LCD windows, buttons are keycaps with depth, and the job is a paper repair ticket.

const PLATE := Color(0.135, 0.140, 0.150, 0.97)
const ENGR := Color(0.66, 0.69, 0.72)
const LCD_BG := Color(0.035, 0.050, 0.042)
const LCD_ON := Color(1.0, 0.70, 0.28)
const PAPER := Color(0.86, 0.83, 0.76)
const INK := Color(0.11, 0.10, 0.09)
const RED_INK := Color(0.66, 0.15, 0.10)
var f_hand: Font
var f_type: Font
var f_engr: FontVariation

func _fonts2() -> void:
	if f_engr: return
	f_hand = load("res://fonts/Kalam-Regular.ttf") if ResourceLoader.exists("res://fonts/Kalam-Regular.ttf") else f_sans
	f_type = load("res://fonts/ShareTechMono-Regular.ttf") if ResourceLoader.exists("res://fonts/ShareTechMono-Regular.ttf") else f_mono
	f_engr = FontVariation.new(); f_engr.base_font = f_semi; f_engr.spacing_glyph = 2

class Screws extends Control:
	func _draw() -> void:
		for c in [Vector2(-9, -7), Vector2(size.x + 9, -7), Vector2(-9, size.y + 7), Vector2(size.x + 9, size.y + 7)]:
			draw_circle(c, 4.5, Color(0.07, 0.07, 0.08)); draw_circle(c, 3.6, Color(0.42, 0.43, 0.45))
			draw_line(c + Vector2(-2.6, -1.2), c + Vector2(2.6, 1.2), Color(0.12, 0.12, 0.13), 1.4)

func _plate(pos: Vector2, title := "") -> VBoxContainer:
	_fonts2()
	var p := PanelContainer.new(); p.position = pos
	var sb := StyleBoxFlat.new(); sb.bg_color = PLATE
	for k in ["corner_radius_top_left", "corner_radius_top_right", "corner_radius_bottom_left", "corner_radius_bottom_right"]: sb.set(k, 4)
	sb.border_width_top = 1; sb.border_width_bottom = 3; sb.border_width_left = 1; sb.border_width_right = 1
	sb.border_color = Color(0.05, 0.05, 0.055); sb.shadow_color = Color(0, 0, 0, 0.5); sb.shadow_size = 12; sb.shadow_offset = Vector2(0, 5)
	sb.content_margin_left = 22; sb.content_margin_right = 22; sb.content_margin_top = 16; sb.content_margin_bottom = 16
	p.add_theme_stylebox_override("panel", sb)
	_root.add_child(p)
	var sc := Screws.new(); sc.mouse_filter = Control.MOUSE_FILTER_IGNORE; p.add_child(sc)
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 8); p.add_child(v)
	if title != "": _eng(v, title)
	return v

func _eng(parent: Node, text: String, size := 15) -> Label:
	var l := _lab(parent, text.to_upper(), size, ENGR, f_engr)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8)); l.add_theme_constant_override("shadow_offset_y", 1); l.add_theme_constant_override("shadow_offset_x", 0)
	return l

func _lcd(parent: Node, text: String, size := 22, col := LCD_ON) -> Label:
	var w := PanelContainer.new(); parent.add_child(w)
	var sb := StyleBoxFlat.new(); sb.bg_color = LCD_BG
	for k in ["corner_radius_top_left", "corner_radius_top_right", "corner_radius_bottom_left", "corner_radius_bottom_right"]: sb.set(k, 3)
	sb.border_width_top = 2; sb.border_width_left = 1; sb.border_width_right = 1; sb.border_width_bottom = 1; sb.border_color = Color(0.0, 0.0, 0.0)
	sb.content_margin_left = 12; sb.content_margin_right = 12; sb.content_margin_top = 6; sb.content_margin_bottom = 6
	w.add_theme_stylebox_override("panel", sb)
	var l := _lab(w, text, size, col, f_mono)
	l.add_theme_color_override("font_shadow_color", Color(col.r, col.g, col.b, 0.35)); l.add_theme_constant_override("shadow_outline_size", 4)
	return l

## A keycap: a raised top, a dark skirt below (depth), a lit amber edge when the tool is in hand, the key legend engraved after the name.
func _key(parent: Node, text: String, cb: Callable, key := "", primary := false, active := false) -> Button:
	_fonts2()
	var b := Button.new(); b.focus_mode = Control.FOCUS_ALL
	b.text = text   # 0.6 (Sigrid): the shortcut is a small keycap inside the key, not a second word ("Power Space")
	b.add_theme_font_override("font", f_semi); b.add_theme_font_size_override("font_size", fs(18))
	var cap_w := 0.0
	var cap: PanelContainer = null
	if key != "":
		var ks := fs(13)
		cap = PanelContainer.new(); cap.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var csb := StyleBoxFlat.new(); csb.bg_color = Color(0, 0, 0, 0.22) if not primary else Color(0, 0, 0, 0.14)
		for k in ["corner_radius_top_left", "corner_radius_top_right", "corner_radius_bottom_left", "corner_radius_bottom_right"]: csb.set(k, 3)
		csb.border_width_top = 1; csb.border_width_left = 1; csb.border_width_right = 1; csb.border_width_bottom = 2
		csb.border_color = Color(0.55, 0.57, 0.60, 0.55) if not primary else Color(0.20, 0.14, 0.06, 0.6)
		csb.content_margin_left = 5; csb.content_margin_right = 5; csb.content_margin_top = 0; csb.content_margin_bottom = 1
		cap.add_theme_stylebox_override("panel", csb)
		var kl := Label.new(); kl.text = key; kl.add_theme_font_override("font", f_mono if f_mono else f_sans); kl.add_theme_font_size_override("font_size", ks)
		kl.add_theme_color_override("font_color", Color(0.62, 0.64, 0.67) if not primary else Color(0.22, 0.16, 0.08)); cap.add_child(kl)
		var fnt: Font = f_mono if f_mono else f_sans
		cap_w = fnt.get_string_size(key, HORIZONTAL_ALIGNMENT_LEFT, -1, ks).x + 12.0
		b.add_child(cap)
		cap.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
		cap.offset_left = -cap_w - 10.0; cap.offset_right = -10.0; cap.offset_top = -float(ks) * 0.7; cap.offset_bottom = float(ks) * 0.7
	var top := Color(0.86, 0.58, 0.18) if primary else (Color(0.25, 0.26, 0.28) if active else Color(0.20, 0.21, 0.23))
	for st in ["normal", "hover", "pressed", "focus", "disabled"]:
		var sb := StyleBoxFlat.new(); sb.bg_color = top
		if st == "hover": sb.bg_color = top.lightened(0.07)
		for k in ["corner_radius_top_left", "corner_radius_top_right", "corner_radius_bottom_left", "corner_radius_bottom_right"]: sb.set(k, 5)
		sb.border_width_top = 1; sb.border_width_left = 1; sb.border_width_right = 1
		sb.border_width_bottom = 1 if st == "pressed" else 5
		sb.border_color = top.darkened(0.55)
		if active and st != "pressed": sb.border_color = Color(0.91, 0.64, 0.24); sb.border_width_bottom = 4
		sb.content_margin_left = 14; sb.content_margin_right = 14 + (cap_w + 8.0 if cap_w > 0.0 else 0.0)
		sb.content_margin_top = 10 if st == "pressed" else 7; sb.content_margin_bottom = 6
		if st == "focus": sb.draw_center = false; sb.border_color = Color(1, 0.8, 0.4); sb.border_width_top = 2; sb.border_width_left = 2; sb.border_width_right = 2; sb.border_width_bottom = 2
		b.add_theme_stylebox_override(st, sb)
	var ink := Color(0.10, 0.08, 0.05) if primary else Color(0.88, 0.89, 0.90)
	b.add_theme_color_override("font_color", ink); b.add_theme_color_override("font_hover_color", ink); b.add_theme_color_override("font_pressed_color", ink); b.add_theme_color_override("font_focus_color", ink)
	b.pressed.connect(cb)
	parent.add_child(b)
	return b

## The repair ticket: a paper card, typed, with the customer's words in handwriting and a red stamp when the job passes.
func _paper(pos: Vector2, w: float) -> VBoxContainer:
	_fonts2()
	# 0.6: below 1280 px wide fs() raises every font to stay readable, so a 430 px paper wrapped into a tall column and ran off
	# the bottom. The paper widens with the font floor (up to 40 % of the canvas), then _fit_paper scales it to the space left.
	var grow := float(fs(17)) / 17.0
	w = minf(w * grow, maxf(w, get_viewport().get_visible_rect().size.x * 0.40))
	var p := PanelContainer.new(); p.position = pos; p.custom_minimum_size = Vector2(w, 0); p.rotation = deg_to_rad(-0.6)
	var sb := StyleBoxFlat.new(); sb.bg_color = PAPER
	for k in ["corner_radius_top_left", "corner_radius_top_right", "corner_radius_bottom_left", "corner_radius_bottom_right"]: sb.set(k, 2)
	sb.shadow_color = Color(0, 0, 0, 0.45); sb.shadow_size = 10; sb.shadow_offset = Vector2(3, 6)
	sb.border_width_top = 10; sb.border_color = RED_INK
	sb.content_margin_left = 22; sb.content_margin_right = 22; sb.content_margin_top = 14; sb.content_margin_bottom = 18
	p.add_theme_stylebox_override("panel", sb)
	_root.add_child(p)
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", 6); p.add_child(v)
	p.resized.connect(_fit_paper.bind(p))
	return v

## The paper never runs under the tool rail: if its laid-out height does not fit above the rail, it is scaled down to fit.
func _fit_paper(p: Control) -> void:
	if not is_instance_valid(p): return
	var room := _canvas_h() - p.position.y - _rail_h - 72.0
	var k := clampf(room / maxf(p.size.y, 1.0), 0.55, 1.0)
	p.pivot_offset = Vector2.ZERO
	if absf(p.scale.x - k) > 0.001: p.scale = Vector2(k, k)

## 0.6 (Tess skipped the wire notes: they stacked to six lines over the board): the ticket shows a note's first two sentences.
static func _two_sentences(t: String) -> String:
	var n := 0; var i := 0
	while i < t.length() - 1:
		if t[i] == "." and t[i + 1] == " ":
			n += 1
			if n == 2: return t.substr(0, i + 1)
		i += 1
	return t

func _ink(parent: Node, text: String, size := 19, col := INK, font: Font = null, wrap := true) -> Label:
	return _lab(parent, nb_units(text), size, col, font if font else f_type, wrap)

## A number keeps its unit on the same line: "2 %" never wraps as "2 / %" (Sigrid, 0.4.1 at 1280x800). The space after a digit
## becomes a no-break space when a unit follows (%, V, A, ohm, W, F, H, Hz, s with an SI prefix); "E1 and E2" is left alone.
static var _re_nb: RegEx
static func nb_units(text: String) -> String:
	if _re_nb == null: _re_nb = RegEx.create_from_string("(\\d) (?=(?:%|[kMmµun]?(?:Hz|ohm|V|A|Ω|W|F|H|s))(?![A-Za-z]))")
	return _re_nb.sub(text, "$1\u00a0", true)

class Stamp extends Control:
	var text := "PASSED"
	var font: Font
	func _draw() -> void:
		var c := Color(0.70, 0.13, 0.10, 0.78)
		draw_set_transform(size * 0.5, deg_to_rad(-12.0))
		var w := 210.0; var h := 62.0
		draw_rect(Rect2(-w * 0.5, -h * 0.5, w, h), c, false, 4.0)
		draw_rect(Rect2(-w * 0.5 + 6, -h * 0.5 + 6, w - 12, h - 12), c, false, 1.5)
		draw_string(font, Vector2(-w * 0.5, 13), text, HORIZONTAL_ALIGNMENT_CENTER, w, 36, c)

## ------------------------------------------------------------------------------------------------ layout

var _spec_vals := {}
var _status: Label
var _readout: Label
var _meter: Label
var _ctl_plate: Control

func _rebuild() -> void:
	if _root: _root.queue_free()
	_root = Control.new(); add_child(_root); _root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); _root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_spec_vals.clear(); _drawer_sig = ""; _status = null; _readout = null; _meter = null; _ctl_plate = null
	if bench.mode == "title": _title(); return
	if schem:
		var sv := SchematicView.new(); sv.bench = bench; sv.ui = self; _root.add_child(sv); sv.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); sv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_job_card()
	_tools()   # the parts tray is a sorting box on the bench and power/test are keys on the bench supply (phase C): no 2D panels

## Views 3 (scope) and 4 (device) are for looking: the tray goes away and the ticket folds to its heading, so nothing covers them.
func _focus_view() -> bool: return bench.view in [3, 4] and bench.mode == "job"

## 0.6 (Sigrid: "a web-app modal over 65 % of the screen"): a narrow strip at the left, the bench behind it. Three ways in, one
## short line each; the rest (the showcase, the classic look, graphics, cute, sound) sits under Settings in the same strip.
var title_settings := false
func _title() -> void:
	_fonts2()
	var vs := get_viewport().get_visible_rect().size
	var v := _plate(Vector2.ZERO, "")
	var strip: PanelContainer = v.get_parent()
	strip.custom_minimum_size = Vector2(maxf(vs.x * 0.30, 460.0), vs.y); strip.size = strip.custom_minimum_size
	v.add_theme_constant_override("separation", 10)
	var top := Control.new(); top.custom_minimum_size = Vector2(0, vs.y * 0.06); v.add_child(top)
	_lab(v, "CIRCUITS", 44, TXT, f_engr)
	_lab(v, "A repair bench for electronics.", 19, Color(0.80, 0.82, 0.84), f_sans, true)
	var gap := Control.new(); gap.custom_minimum_size = Vector2(0, 14); v.add_child(gap)
	var dim := Color(0.70, 0.73, 0.76)
	var first: Button
	if not title_settings:
		first = _key(v, "Jobs", func(): bench.start_job(), "", true)
		_lab(v, "Repairs in six chapters, an exam at the end of each.", 17, dim, f_sans, true)
		_key(v, "Testbed", func(): Testbed.load_device(bench, "torch"))
		_lab(v, "Six devices to probe, break and step through.", 17, dim, f_sans, true)
		_key(v, "Free bench", func(): bench.start_free())
		_lab(v, "Any part, the supply, the scope and the meter.", 17, dim, f_sans, true)
		var fill := Control.new(); fill.size_flags_vertical = Control.SIZE_EXPAND_FILL; v.add_child(fill)
		_key(v, "Settings", func(): title_settings = true; _rebuild())
		_key(v, "Quit", func(): bench.get_tree().quit())
	else:
		_eng(v, "Settings", 17)
		first = _key(v, "Showcase: 5-1 Fan Driver", func(): bench.start_job("5-1"))
		_key(v, "Classic 2D look", func(): bench.get_parent().call("set_look", "classic") if bench.get_parent().has_method("set_look") else null)
		_lab(v, "Graphics", 17, dim, f_sans)
		var qrow := HFlowContainer.new(); qrow.add_theme_constant_override("h_separation", 8); qrow.add_theme_constant_override("v_separation", 6); v.add_child(qrow)
		for q in ["high", "medium", "low"]:
			var qq: String = q
			_key(qrow, qq.capitalize(), func(): bench.set_quality_saved(qq), "", false, bench.quality == qq)
		var row2 := HFlowContainer.new(); row2.add_theme_constant_override("h_separation", 8); row2.add_theme_constant_override("v_separation", 6); v.add_child(row2)
		_key(row2, "Cute on" if bench.cute else "Cute off", func(): bench.set_cute(not bench.cute), "", false, bench.cute)
		_key(row2, "Sound on" if bench.sfx.enabled else "Sound off", func(): bench.set_sound(not bench.sfx.enabled), "", false, bench.sfx.enabled)
		var fill2 := Control.new(); fill2.size_flags_vertical = Control.SIZE_EXPAND_FILL; v.add_child(fill2)
		_key(v, "Back", func(): title_settings = false; _rebuild())
	first.call_deferred("grab_focus")
	_lab(v, "v%s" % str(ProjectSettings.get_setting("application/config/version", "")), 15, Color(0.56, 0.60, 0.65), f_mono)

## 0.5 testbed: the loaded device, its breaks, time controls. Every button is an edit or an engine call the player could make by
## hand; the card only gathers them.
func _testbed_card() -> void:
	var d: Dictionary = Testbed.device(str(bench.testbed_device))
	var fv := _paper(Vector2(30, 26), 430)
	_ink(fv, "TESTBED", 17, RED_INK, f_type, false)
	_ink(fv, str(d.get("name", "")), 28, INK, f_semi, false)
	_ink(fv, str(d.get("what", "")), 17, INK, f_sans)
	var row := HFlowContainer.new(); row.add_theme_constant_override("h_separation", 8); row.add_theme_constant_override("v_separation", 6); fv.add_child(row)   # 0.6: six devices wrap on the paper
	for dv: Dictionary in Testbed.DEVICES:
		var id: String = dv.id
		_key(row, str(dv.name).get_slice(" ", 0) if str(dv.name).length() > 12 else str(dv.name), func(): Testbed.load_device(bench, id), "", false, id == str(bench.testbed_device))
	_ink(fv, "Break it on purpose:", 17, INK, f_semi, false)
	for k: Dictionary in d.get("breaks", []):
		var kid: String = k.id
		_key(fv, str(k.name), func(): Testbed.apply_break(bench, kid), "", false, false)
	var row2 := HBoxContainer.new(); row2.add_theme_constant_override("separation", 8); fv.add_child(row2)
	_key(row2, "Reset", func(): Testbed.load_device(bench, str(bench.testbed_device)), "", false, false)
	_key(row2, "Run" if bench.testbed_paused else "Pause", func(): Testbed.set_running(bench, bench.testbed_paused), "K", false, bench.testbed_paused)
	var st := _key(row2, "Step", func(): Testbed.step_once(bench), "L", false, false)
	st.disabled = not bench.testbed_paused
	if bench.note != "": _ink(fv, bench.note, 17, Color(0.14, 0.20, 0.42), f_sans)
	# 0.5 (Noor): a break that burns a part said nothing about the burn. The engine's own explanation shows here, as on a job.
	var f: Dictionary = bench.last_failure
	if not f.is_empty():
		_ink(fv, str(f.get("title", "")), 18, RED_INK, f_semi)
		if str(f.get("text", "")) != "": _ink(fv, str(f.get("text", "")), 17, INK, f_sans)

func _job_card() -> void:
	var t: Dictionary = bench.backend.ticket
	if bench.mode == "free" and str(bench.testbed_device) != "":
		_testbed_card(); return
	if bench.mode == "free":
		var fv := _paper(Vector2(30, 26), 430)
		_ink(fv, "FREE BENCH", 17, RED_INK, f_type, false)
		_ink(fv, "Open testbed", 28, INK, f_semi, false)
		_ink(fv, "Pick any part from the sorting box. OUTPUT on the bench supply powers the board. The drawer tab shows more parts.", 17, INK, f_sans)
		var row := HBoxContainer.new(); row.add_theme_constant_override("separation", 8); fv.add_child(row)
		for i in 3:
			var slot := i + 1
			_key(row, "Save %d" % slot, func(): bench.save_build(slot), "", false, false)
		var row2 := HBoxContainer.new(); row2.add_theme_constant_override("separation", 8); fv.add_child(row2)
		for i in 3:
			var slot := i + 1
			var k := _key(row2, "Load %d" % slot, func(): bench.load_build(slot), "", false, false)
			k.disabled = not bench.has_build(slot)
		if bench.note != "": _ink(fv, bench.note, 17, Color(0.14, 0.20, 0.42), f_sans)
		return
	var v := _paper(Vector2(30, 26), 430)
	var head := HBoxContainer.new(); v.add_child(head)
	var h1 := _ink(head, "REPAIR TICKET  %s" % str(t.get("id", "")), 17, RED_INK, f_type, false); h1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_ink(head, str(t.get("price_text", "")), 17, INK, f_type, false)
	_ink(v, str(t.get("title", "")), 28, INK, f_semi, false)
	if _focus_view():
		if not bench.last_failure.is_empty(): _ink(v, str(bench.last_failure.get("title", "")), 18, RED_INK, f_semi)
		_ink(v, "Key 2 returns to the work view.", 15, Color(0.30, 0.28, 0.25), f_sans)
		return
	if bool(t.get("eb", false)) and not bench.case_closed():
		# an exam is a textbook problem: the paper must say the network to predict (Noor could not tell what to build)
		_ink(v, str(t.get("brief", "")).replace(" Predict first, then build and probe.", ""), 17, INK, f_sans)
	else:
		_ink(v, "%s: \"%s\"" % [str(t.get("customer", "")), str(t.get("ask", ""))], 21, Color(0.14, 0.20, 0.42), f_hand)
	if bench.case_closed() and not bench.handed:
		_ink(v, bench.arrival_line(), 18, INK, f_sans)
		_key(v, "Open the case", func(): bench.open_case(), "O", true)
		return
	if bench.handed:
		_ink(v, "Collected by %s. Paid %s." % [str(t.get("customer", "")), bench.paid_text()], 19, INK, f_sans)
		var st := Stamp.new(); st.font = f_engr; st.custom_minimum_size = Vector2(0, 90); st.mouse_filter = Control.MOUSE_FILTER_IGNORE; v.add_child(st)
		_key(v, "Next job", func(): bench.next_job(), "", true)
		_tool_shelf(v)
		return
	if bench.backend.safety_pending():
		_safety_card(v); return
	var short := _canvas_h() < 1000.0   # 1280x800 and smaller: the ticket must stop above the bench panels
	if bench.backend.passed:
		# the way out first, where it can never sit under the bench panels (Noor: hidden behind Bench Control at 1280x800)
		var st2 := Stamp.new(); st2.font = f_engr; st2.custom_minimum_size = Vector2(0, 56 if short else 80); st2.mouse_filter = Control.MOUSE_FILTER_IGNORE; v.add_child(st2)
		_key(v, "Close up and hand back", func(): bench.hand_back(), "H", true)
		_marked(v)
	var sep := ColorRect.new(); sep.color = Color(0.3, 0.27, 0.22, 0.5); sep.custom_minimum_size = Vector2(0, 2); v.add_child(sep)   # 2 px: 1 px broke into dashes at 1280x800
	var pred_ids := {}
	for pr in t.get("predictions", []) + t.get("answers", []): pred_ids[str(pr.id)] = true
	for s in t.get("specs", []):
		if pred_ids.has(str(s.get("id", ""))): continue   # predictions have their own boxes on the slip below
		var row := HBoxContainer.new(); row.add_theme_constant_override("separation", 10); v.add_child(row)
		var mark := _ink(row, "[ ]", 18, INK, f_type, false)
		var nm := _ink(row, _short(str(s.get("id", "")), str(s.get("name", ""))), 18, INK, f_sans, true); nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var val := _ink(row, "—", 19, INK, f_type, false)
		_spec_vals[str(s.id)] = [mark, val]
	if str(t.get("on_board", "")) != "": _ink(v, str(t.on_board), 18, INK, f_sans)   # 0.7 (Leo): the key values of the fixed parts, at spec size
	# 0.6 (D-money-06): build cost is a score, scored with the stars; it never leaves the wallet, so it is not on the money line
	_ink(v, "Pays %s. Build cost %s." % [str(t.get("pay_text", "")).trim_prefix("fee "), str(bench.backend.last_result.get("costText", "$0.00"))], 17, Color(0.30, 0.28, 0.25), f_sans)
	_ink(v, "Burnt parts %s   Wallet %s" % [bench.burn_cost_text(), bench.backend.wallet_text], 17, Color(0.30, 0.28, 0.25), f_sans)
	if bool(bench.backend.bench_q.get("waiting", false)) and not bench.backend.passed:
		# 0.5 stakes: the customer is waiting at the counter; each failed TEST takes some of the tip (0.6: a share of the fee; none on 1-1)
		var left := int(bench.backend.bench_q.get("tipLeft", 0)); var who := str(t.get("customer", "The customer"))
		var step := int(bench.backend.bench_q.get("tipStep", 0))
		var line := "%s is still waiting. The tip is gone; the fee is not." % who
		if left > 0 and step == 0: line = "%s is waiting: a %s tip. \"First job? Take your time.\"" % [who, str(bench.backend.bench_q.get("tipLeftText", ""))]
		elif left > 0: line = "%s is waiting: a %s tip if the next test passes. Each failed test takes %s off." % [who, str(bench.backend.bench_q.get("tipLeftText", "")), str(bench.backend.bench_q.get("tipStepText", ""))]
		_ink(v, line, 15, Color(0.16, 0.36, 0.52) if left > 0 else RED_INK, f_sans)
	_dial_row(v)
	if int(bench.backend.bench_q.get("burnCost", 0)) > 0:
		# a burn is a rush order: say what it costs, on the ticket, the moment it happens
		_ink(v, "Each burnt part is a rush order: the part plus %s courier, out of your pay." % str(bench.backend.bench_q.get("rushFeeText", "")), 15, RED_INK, f_sans)
	_predict_slip(v, t)
	var f: Dictionary = bench.last_failure
	if not f.is_empty() and not bench.backend.passed:
		var sep2 := ColorRect.new(); sep2.color = RED_INK; sep2.custom_minimum_size = Vector2(0, 2); v.add_child(sep2)
		_ink(v, str(f.get("title", "")), 20, RED_INK, f_semi)
		var full := str(f.get("text", ""))
		var cut := full.find(". ")
		_ink(v, full.substr(0, cut + 1) if cut > 0 and cut < full.length() - 2 else full, 17, INK, f_sans)   # the cause in one sentence; the scope shows the rest
		if cut > 0 and cut < full.length() - 2:
			# 0.7 (Mina, 1-3): the reason ran longer than the paper and pushed it over the parts box. Two sentences, the rest behind a key.
			var why := full.substr(cut + 2).strip_edges()
			var why_head := _two_sentences(why)
			_ink(v, "Why: " + (why if show_why or why_head.length() >= why.length() - 1 else why_head), 15, Color(0.30, 0.28, 0.25), f_sans)
			if why_head.length() < why.length() - 1: _key(v, "Less" if show_why else "More", func(): show_why = not show_why; _rebuild(), "", false, show_why)
		var burnt: bool = not bench.backend.smoked.is_empty() or not bench.backend.arrived_burnt.is_empty()
		if burnt and not short: _ink(v, "Right-click a burnt part to fit a fresh one. Its wires stay.", 15, Color(0.30, 0.28, 0.25), f_sans)   # 0.7 (Mina): only when a part burnt
	elif bench.note != "":
		_ink(v, _two_sentences(bench.note), 17, Color(0.14, 0.20, 0.42), f_sans)

## 4-1 (D-bench-ch45): the engine's safety card on the paper ticket. Power and the bench stay off until its key is pressed
## (the engine's readSafety); the words are the engine's (ticketCard().mains).
func _safety_card(v: VBoxContainer) -> void:
	var m: Dictionary = bench.backend.mains
	var sep := ColorRect.new(); sep.color = RED_INK; sep.custom_minimum_size = Vector2(0, 2); v.add_child(sep)
	_ink(v, str(m.get("ribbon", "")).to_upper(), 14, RED_INK, f_type)
	_ink(v, str(m.get("title", "")), 21, RED_INK, f_semi)
	for ln in m.get("lines", []): _ink(v, str(ln), 15, INK, f_sans)
	var k := _key(v, str(m.get("button", "I have read it")), func(): bench.read_safety(), "", true)
	k.call_deferred("grab_focus")
	if bench.note != "" and bench.note.begins_with("Read the safety card"): _ink(v, bench.note, 16, RED_INK, f_sans)

## 0.6 condition dial: on a ticket the bench tests in more than one condition, the paper offers the dial (bought once with the
## wallet) and, once owned, one key per condition for the live bench. The formal TEST still runs every condition.
## 0.7 tool ladder (D-tools-07, Dagny): after a job is paid, the next tools on the shelf, with what each one shows and its price.
## Too little money: the key is greyed and still says the price.
func _tool_shelf(v: VBoxContainer) -> void:
	var left: Array = bench.tools().filter(func(t): return not bool(t.owned))
	if left.is_empty(): return
	_ink(v, "Bench tools. Wallet %s." % bench.backend.wallet_text, 17, INK, f_semi)
	for t in left.slice(0, 2):
		var id := str(t.id)
		var k := _key(v, "Buy the %s  %s" % [str(t.name).to_lower(), str(t.priceText)], func(): bench.buy_tool(id), "", false, false)
		k.disabled = bench.backend.wallet_minor < int(t.price)
		_ink(v, str(t.what), 15, Color(0.30, 0.28, 0.25), f_sans)

func _dial_row(v: VBoxContainer) -> void:
	var d = bench.backend.bench_q.get("dial", null)
	if not (d is Dictionary) or (d.get("conds", []) as Array).size() < 2 or bench.backend.passed: return
	if not bool(d.get("owned", false)):
		var k := _key(v, "Buy the condition dial  %s" % str(d.get("priceText", "")), func(): bench.buy_dial(), "", false, false)
		k.disabled = int(d.get("wallet", 0)) < int(d.get("price", 0))
		_ink(v, "The test runs %d conditions. The dial runs the live bench in each, before you test." % (d.conds as Array).size(), 15, Color(0.30, 0.28, 0.25), f_sans)
		return
	var row := HFlowContainer.new(); row.add_theme_constant_override("h_separation", 8); row.add_theme_constant_override("v_separation", 6); v.add_child(row)
	_ink(row, "Live:", 17, INK, f_semi, false)
	var live := str(d.get("live", ""))
	for c in d.conds:
		var cid := str(c.id)
		_key(row, str(c.label), func(): bench.set_condition(cid), "", false, live == cid or (live == "" and cid == str(d.conds[0].id)))

## An exam, marked on the ticket (it lived only in the classic stall): your numbers against the bench, the stars, and the
## worked answer behind one key, so the ticket stays short until asked.
var show_working := false
var show_why := false   ## 0.7: the failure's full reason, folded to two sentences by default
func _marked(v: Control) -> void:
	var d = bench.backend.last_result.get("debrief", null)
	if not (d is Dictionary) or not bool(bench.backend.ticket.get("eb", false)): return
	_ink(v, "Marked", 18, RED_INK, f_semi)
	for row in d.get("rows", []):
		var okr: bool = bool(row.get("ok", false))
		_ink(v, "%s: you said %s, measured %s %s (%s%.1f %% off)" % [str(row.name).trim_prefix("Your prediction: "), EngineBench._g(float(row.entered), 4), EngineBench._g(float(row.truth), 4), str(row.unit), "+" if float(row.gapPct) > 0.0 else "", float(row.gapPct)], 15, Color(0.11, 0.45, 0.22) if okr else RED_INK, f_sans)
	if str(d.get("starsText", "")) != "": _ink(v, str(d.starsText), 15, INK, f_sans)
	_key(v, "Hide the working" if show_working else "Show the working", func(): show_working = not show_working; _rebuild(), "", false, show_working)
	if show_working:
		if str(d.get("equation", "")) != "": _ink(v, str(d.equation), 15, INK, f_type)
		for ln in d.get("working", []): _ink(v, str(ln), 15, INK, f_sans)
		if str(d.get("answer", "")) != "": _ink(v, str(d.answer), 17, Color(0.11, 0.45, 0.22), f_type)

## Exam tickets: predict first. One field per prediction on the paper ticket; "Lock in" sends them to the engine, and the band
## and the test cell's volts stay hidden until every one is in (Noor could not find where to answer 1-5).
func _predict_slip(v: Control, t: Dictionary) -> void:
	var preds: Array = t.get("predictions", []) + t.get("answers", [])
	if preds.is_empty(): return
	var open := false
	for pr in preds: if pr.get("entered", null) == null: open = true
	var sepp := ColorRect.new(); sepp.color = Color(0.3, 0.27, 0.22, 0.5); sepp.custom_minimum_size = Vector2(0, 2); v.add_child(sepp)
	if not open:
		for pr in preds: _ink(v, "%s: %s %s" % [str(pr.name).trim_prefix("Your prediction: "), str(pr.entered), str(pr.get("unit", ""))], 16, Color(0.14, 0.20, 0.42), f_hand)
		return
	_ink(v, "Predict first: work it out, write it here, then build.", 18, RED_INK, f_semi)
	var fields: Array = []
	for pr in preds:
		_ink(v, str(pr.name).trim_prefix("Your prediction: "), 16, INK, f_sans)
		var le := LineEdit.new(); le.placeholder_text = "a number in %s" % str(pr.get("unit", "")) if str(pr.get("unit", "")) != "" else "a number"
		le.add_theme_font_override("font", f_type); le.add_theme_font_size_override("font_size", fs(18))
		le.add_theme_color_override("font_color", INK); le.add_theme_color_override("font_placeholder_color", Color(0.38, 0.35, 0.31))
		var sb := StyleBoxFlat.new(); sb.bg_color = Color(1.0, 0.99, 0.95); sb.border_color = Color(0.25, 0.22, 0.18); sb.set_border_width_all(2); sb.set_content_margin_all(6)
		le.add_theme_stylebox_override("normal", sb); le.add_theme_stylebox_override("focus", sb)
		if pr.get("entered", null) != null: le.text = str(pr.entered)
		v.add_child(le); fields.append([str(pr.id), le])
	var lock := func() -> void: bench.lock_predictions(fields.map(func(fl): return [fl[0], (fl[1] as LineEdit).text]))
	for fl in fields: (fl[1] as LineEdit).text_submitted.connect(func(_tx): lock.call())
	_key(v, "Lock in", lock, "", true)
	if not fields.is_empty(): (fields[0][1] as LineEdit).call_deferred("grab_focus")

func _control_plate(pos: Vector2, above: Control) -> void:
	var cv := _plate(pos, "Bench control")
	var row := HBoxContainer.new(); row.add_theme_constant_override("separation", 10); cv.add_child(row)
	var lamp := Lamp.new(); lamp.on = bench.backend.powered; lamp.custom_minimum_size = Vector2(22, 22); lamp.size_flags_vertical = Control.SIZE_SHRINK_CENTER; row.add_child(lamp)
	_key(row, "Power", func(): bench.toggle_power(), "Space", false, bench.backend.powered)
	if bench.mode == "job": _key(row, "Bench test", func(): bench.run_test(), "Enter", true)
	for sl in bench.backend.selectors:
		var seg := HBoxContainer.new(); seg.add_theme_constant_override("separation", 4); cv.add_child(seg)
		_eng(seg, str(sl.get("label", sl.id)), 14).custom_minimum_size = Vector2(70, 0)
		var opts: Array = sl.options
		for i in opts.size():
			var idx := i; var sid := str(sl.id)
			_key(seg, str(opts[i]), func(): bench.set_selector(sid, idx), "", false, int(sl.get("index", 0)) == i)
	_readout = _lcd(cv, "", 20)
	_meter = _lcd(cv, "", 20, Color(0.62, 0.95, 0.66))
	var pc: Control = cv.get_parent()
	pc.position.y = _canvas_h() - 16.0 - pc.get_combined_minimum_size().y   # bottom left, beside the tool rail; never under the ticket's wrapped text
	_ctl_plate = pc

class Lamp extends Control:
	var on := false
	func _draw() -> void:
		var c := size * 0.5
		draw_circle(c, 10.0, Color(0.05, 0.05, 0.05))
		draw_circle(c, 7.5, Color(1.0, 0.25, 0.12) if on else Color(0.25, 0.08, 0.06))
		if on: draw_circle(c, 11.0, Color(1.0, 0.3, 0.1, 0.25))

func _short(id: String, name: String) -> String:
	match id:
		"fanhi": return "Fan with pin high  ≥ 11.0 V"
		"fanlo": return "Fan with pin low  ≤ 0.5 V"
		"ipin": return "Pin current  ≤ 20 mA"
	return name

var _fam_idx := {}          ## family key -> selected value index
var _tray_name: Label

## The part tray: a row of small 3D renders on a faceplate, each tile labelled with its name and value; arrows step values.
func _drawer() -> void:
	if bench.mode == "job" and (bench.case_closed() or bench.handed): return
	var fams: Array = bench.tray_families()
	var v := _plate(Vector2(560, 0), "")
	var pc: Control = v.get_parent()
	_tray_name = _eng(v, "Parts tray: pick one, click a pad.  R turns it.", 14)
	var sc := ScrollContainer.new(); sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; sc.custom_minimum_size = Vector2(minf(1240.0, fams.size() * 138.0 + 8.0), 70.0 + fs(15) * 2.9); v.add_child(sc)
	var row := HBoxContainer.new(); row.add_theme_constant_override("separation", 8); sc.add_child(row)
	for f in fams:
		var items: Array = f.items
		var key := str(items[0].partId) + "|" + str(items[0].variant)
		var idx: int = clampi(int(_fam_idx.get(key, _default_idx(items))), 0, items.size() - 1)
		var it: Dictionary = items[idx]
		var col := VBoxContainer.new(); col.add_theme_constant_override("separation", 0); row.add_child(col)
		var b := Button.new(); b.custom_minimum_size = Vector2(130, 70); b.focus_mode = Control.FOCUS_ALL
		b.icon = bench.part_icon(it); b.expand_icon = true; b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var active: bool = bench.tool == "place" and str(bench.place_item.get("partId", "")) == str(it.partId) and str(bench.place_item.get("value", "")) == str(it.value)
		for st in ["normal", "hover", "pressed", "focus"]:
			var sb := StyleBoxFlat.new(); sb.bg_color = Color(0.30, 0.24, 0.13) if active else (Color(0.07, 0.075, 0.08) if st != "hover" else Color(0.12, 0.125, 0.13))
			if st == "focus": sb.draw_center = false; sb.border_color = AMBER; sb.border_width_bottom = 2; sb.border_width_top = 2; sb.border_width_left = 2; sb.border_width_right = 2
			else: sb.border_width_top = 2; sb.border_color = Color(0, 0, 0)   # a recessed bin
			for k in ["corner_radius_top_left", "corner_radius_top_right", "corner_radius_bottom_left", "corner_radius_bottom_right"]: sb.set(k, 4)
			sb.content_margin_left = 4; sb.content_margin_right = 4; sb.content_margin_top = 2; sb.content_margin_bottom = 2
			b.add_theme_stylebox_override(st, sb)
		var desc := "%s   %s   %s" % [str(f.name), str(it.label).get_slice("  ", 0) if it.value != null else "", str(it.get("price_text", ""))]
		b.tooltip_text = desc
		b.mouse_entered.connect(func(): if is_instance_valid(_tray_name): _tray_name.text = desc.to_upper())
		b.focus_entered.connect(func(): if is_instance_valid(_tray_name): _tray_name.text = desc.to_upper())
		var pick: Dictionary = it
		b.pressed.connect(func(): bench.pick_part(pick))
		col.add_child(b)
		var tname := _tile_name(str(f.name), str(it.partId))
		var vr := str(it.get("variant", ""))
		if str(it.partId).begins_with("res") and vr.ends_with("W"): tname += " " + {"0.25W": "¼ W", "0.5W": "½ W"}.get(vr, vr.trim_suffix("W") + " W")   # two 47 Ω tiles were told apart only by the schematic
		var nm := _lab(col, tname, 15, TXT, f_semi); nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; nm.custom_minimum_size = Vector2(130, 0); nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART   # wraps instead of clipping ("esistor ¼ W")
		var under := HBoxContainer.new(); under.alignment = BoxContainer.ALIGNMENT_CENTER; col.add_child(under)
		var val_txt := str(it.label).get_slice("  ", 0).replace(" ", "") if it.value != null else str(it.get("price_text", ""))
		if items.size() > 1:
			var k2 := key; var n := items.size()
			var prev := Button.new(); prev.text = "‹"; prev.flat = true; prev.focus_mode = Control.FOCUS_NONE; prev.add_theme_font_size_override("font_size", fs(18))
			prev.pressed.connect(func(): _fam_step(k2, items, posmod(idx - 1, n)))
			var nx := Button.new(); nx.text = "›"; nx.flat = true; nx.focus_mode = Control.FOCUS_NONE; nx.add_theme_font_size_override("font_size", fs(18))
			nx.pressed.connect(func(): _fam_step(k2, items, posmod(idx + 1, n)))
			under.add_child(prev); _lab(under, val_txt, 15, AMBER, f_mono); under.add_child(nx)
		else:
			_lab(under, val_txt, 15, Color(0.70, 0.72, 0.75), f_mono)
	pc.position.x = (1920 - pc.get_combined_minimum_size().x) * 0.5
	pc.position.y = _canvas_h() - 118.0 - pc.get_combined_minimum_size().y

## The tray arrows step a family's value. If a part of that family is in hand, the part in hand changes too: the tile showed
## 2 Ω while a click placed the 6 Ω picked earlier (Noor, 1-5).
func _fam_step(k: String, items: Array, i: int) -> void:
	_fam_idx[k] = i
	var held: Dictionary = bench.place_item if bench.tool == "place" else {}
	if not held.is_empty() and str(held.get("partId", "")) == str(items[i].partId): bench.pick_part(items[i])
	_rebuild()

## A short tile name that fits under a 130 px tile: the part number for semiconductors, the family word otherwise.
func _tile_name(fam: String, pid: String) -> String:
	var up := pid.to_upper()
	for pre in ["2N", "1N", "BC", "TIP", "IRL", "IRF", "LM", "NE", "BZX"]:
		if up.begins_with(pre): return up.get_slice("-", 0)
	if pid.begins_with("led-"): return "LED " + pid.get_slice("-", 1)
	if pid.begins_with("res-ww"): return "Wirewound"
	if pid.begins_with("res-"): return "Resistor"
	if pid.begins_with("cap-el"): return "Electrolytic"
	if pid.begins_with("cap-"): return "Capacitor"
	return fam.get_slice(" ", 0).substr(0, 12)

func _default_idx(items: Array) -> int:
	for i in items.size(): if str(items[i].label).begins_with("220 "): return i
	return items.size() / 2

## SI value text with 3 significant digits: 0.000072 V -> "72.0 µV", 0.0171478 A -> "17.1 mA".
static func si(v: float, unit: String, extra := 0) -> String:
	var a := absf(v)
	for e in [[1e3, "k"], [1.0, ""], [1e-3, "m"], [1e-6, "µ"]]:
		if a >= float(e[0]) * 0.9995 or e[1] == "µ":
			var x := v / float(e[0])
			var d := (2 if absf(x) < 10.0 else (1 if absf(x) < 100.0 else 0)) + extra
			return "%s %s%s" % [String.num(x, d), e[1], unit]
	return "%s %s" % [String.num(v, 3 + extra), unit]

## The number a si() text stands for, in base units ("14 mA" -> 0.014).
static func si_value(t: String, unit: String) -> float:
	var parts := t.split(" ", false)
	if parts.is_empty(): return 0.0
	var u := parts[1] if parts.size() > 1 else unit
	var p := u.substr(0, maxi(0, u.length() - unit.length()))
	return float(parts[0]) * float({"k": 1e3, "": 1.0, "m": 1e-3, "µ": 1e-6}.get(p, 1.0))

func _canvas_h() -> float: return get_viewport().get_visible_rect().size.y

## The tool rail: keycaps along the bottom edge, the view keys engraved at its end.
func _tools() -> void:
	if bench.handed: return
	var v := _plate(Vector2(560, 0), "")
	var pc: Control = v.get_parent()
	var h := HFlowContainer.new(); h.add_theme_constant_override("h_separation", 8); h.add_theme_constant_override("v_separation", 6); v.add_child(h)
	_key(h, "Power", func(): bench.toggle_power(), "Space", false, bench.backend.powered)
	if bench.mode == "job": _key(h, "Test", func(): bench.run_test(), "Enter", false)
	for sl in bench.backend.selectors:
		if str(sl.id) == "pin": continue   # the pin switch is on the microcontroller board (click it); not a rail key
		if bench.mode == "free" and not Testbed.device(str(bench.testbed_device)).get("board", "").is_empty(): continue   # Sigrid: 5-2's THRESHOLD keys showed on the dimmer
		var sll := _eng(h, str(sl.get("label", "")), 13); sll.size_flags_vertical = Control.SIZE_SHRINK_CENTER   # 4-1 has two: which keys are MAINS and which LOAD
		var opts: Array = sl.options
		for i in opts.size():
			var idx := i; var sid := str(sl.id)
			_key(h, str(opts[i]), func(): bench.set_selector(sid, idx), "", false, int(sl.get("index", 0)) == i)
	if bench.mode == "job" and bench.backend.camera_ok: _key(h, "Thermal", func(): bench.toggle_thermal(), "T", false, bench.thermal)
	_key(h, "Select", func(): bench.esc(), "Esc", false, bench.tool == "select")
	_key(h, "Wire", func(): bench.set_tool("wire"), "W", false, bench.tool == "wire")
	_key(h, "Scope probe", func(): bench.set_tool("probe"), "P", false, bench.tool == "probe")
	if bench.mode in ["job", "free"] and bench.has_tool("scope-ch2"): _key(h, "Scope CH2", func(): bench.set_tool("probe2"), "Shift+P", false, bench.tool == "probe2")
	_key(h, "Meter leads", func(): bench.set_tool("red"), "M", false, bench.tool in ["red", "black"])
	_key(h, "Undo", func(): bench.undo(), "Ctrl+Z")
	_key(h, "Schematic", func(): toggle_schematic(), "Tab", false, schem)
	_key(h, "Menu", func(): bench.back_to_title())
	var vk := _eng(h, "Views 1-5", 14); vk.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	# 0.6: below 1280 px wide the rail was wider than the canvas. Scaling it down (the first fix) made the text about 11 px at
	# 1078 wide (Sigrid), so it wraps to a second row instead. A flow container learns its height only after layout, so the rows
	# are counted here from the keys' own widths, and the plate is placed at once.
	var vw := get_viewport().get_visible_rect().size.x
	var pad_x := pc.get_combined_minimum_size().x - h.get_combined_minimum_size().x   # the plate's margins round the keys
	var avail := vw - 24.0 - pad_x
	var widths: Array = []; var row_h := 0.0
	for c in h.get_children():
		var ms: Vector2 = (c as Control).get_combined_minimum_size(); widths.append(ms.x); row_h = maxf(row_h, ms.y)
	var natural := 0.0
	for wd in widths: natural += float(wd) + 8.0
	natural -= 8.0
	var width := minf(natural, avail); var rows := 1; var x := 0.0
	for wd in widths:
		if x > 0.0 and x + float(wd) > width: rows += 1; x = 0.0
		x += float(wd) + 8.0
	h.custom_minimum_size = Vector2(width, rows * row_h + (rows - 1) * 6.0)
	pc.reset_size()
	var psz := pc.get_combined_minimum_size()
	pc.position = Vector2((vw - psz.x) * 0.5, _canvas_h() - 16.0 - psz.y)
	_rail_h = psz.y
	# the hover tip and the meter reading sit on their own plate above the rail: a long tip used to widen the rail past the
	# window and push Power and Test off the left edge at 1280 x 800 (phase C GPU shot of 2-3)
	var tip: String = bench.hover_tip
	if tip == "" and bench.backend.dial != "OFF": tip = "Meter  " + bench.meter_text()
	if tip == "" and bench.thermal: tip = bench.thermal_text()
	var tv := _plate(Vector2.ZERO, "")
	_tip_plate = tv.get_parent()
	_tip_label = _eng(tv, tip, 13); _tip_label.add_theme_color_override("font_color", AMBER)   # 0.4.1: a small mirror; the meter's own face carries the reading
	if tip == bench.thermal_text() and bench.thermal: _tip_label.text = tip   # the thermal camera's line in normal case (Sigrid)
	(_tip_plate as Control).visible = tip != ""
	_place_tip()

var _tip_plate: Control
var _rail_h := 72.0
func _place_tip() -> void:
	if _tip_plate == null or not is_instance_valid(_tip_plate): return
	_tip_plate.reset_size()
	var sz := _tip_plate.get_combined_minimum_size()
	_tip_plate.position = Vector2((1920 - sz.x) * 0.5, _canvas_h() - 16.0 - _rail_h - 10.0 - sz.y)
	# 0.6 (Tess saw the pad name once, by accident: it sat at the bottom, far from where she looked): with a wire, lead or probe in
	# hand the name of the pad follows the cursor
	if bench.tool in ["wire", "red", "black", "probe"] and bench.hover_pad.x >= 0 and bench.hover_tip != "":
		var vr := get_viewport().get_visible_rect().size
		var mp := get_global_mouse_position() + Vector2(34, 30)
		_tip_plate.position = Vector2(clampf(mp.x, 8.0, vr.x - sz.x - 8.0), clampf(mp.y, 8.0, _canvas_h() - _rail_h - 24.0 - sz.y))

var _tip_label: Label
func _refresh_live() -> void:
	var b = bench.backend
	if _tip_label and is_instance_valid(_tip_label) and bench.hover_tip == "" and b.dial != "OFF":
		_tip_label.text = ("Meter  " + bench.meter_text()).to_upper(); _tip_plate.visible = true; _place_tip()
	elif _tip_label and is_instance_valid(_tip_label) and bench.hover_tip == "" and bench.thermal:
		_tip_label.text = bench.thermal_text(); _tip_plate.visible = true; _place_tip()
	if _status and is_instance_valid(_status): _status.text = "POWER %s" % ("ON" if b.powered else "OFF")
	if _readout and is_instance_valid(_readout): _readout.text = bench.readout_text()
	if _meter and is_instance_valid(_meter): _meter.text = "METER  " + bench.meter_text()
	var res: Dictionary = b.last_result
	var specs := {}
	for s in res.get("specs", []): specs[str(s.id)] = s
	var meas: Dictionary = res.get("measured", {})
	var live: Dictionary = bench.live_specs()
	for id in _spec_vals:
		var mark: Label = _spec_vals[id][0]; var val: Label = _spec_vals[id][1]
		var txt := str(live.get(id, ""))
		if txt == "" and meas.has(id): txt = bench.spec_text(id, float(meas[id]))
		val.text = txt if txt != "" else "—"
		if specs.has(id):
			var ok: bool = bool(specs[id].get("pass", false))
			# 0.7 (Mina, 1-3): a row whose words include "rating" also stands for the unnamed ratings check; it showed a green tick on a test that failed on a part's power
			var row_name: String = ""
			for s2 in bench.backend.ticket.get("specs", []): if str(s2.id) == id: row_name = str(s2.get("name", "")).to_lower()
			if row_name.contains("rating"):
				for sid in specs: if (str(specs[sid].get("kind", "")) == "rating" or str(sid) == "ratings") and not bool(specs[sid].get("pass", true)): ok = false
			mark.text = "[✓]" if ok else "[✗]"; mark.add_theme_color_override("font_color", Color(0.12, 0.45, 0.20) if ok else RED_INK)
		else:
			mark.text = "[ ]"; mark.add_theme_color_override("font_color", INK)

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
