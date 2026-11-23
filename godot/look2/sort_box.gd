class_name SortBox
extends Node3D
## The parts tray as a real object on the bench (phase C, Sigrid's top finding): a clear-lidded plastic sorting box with
## 2 x 4 compartments. Each compartment holds a sample of the part and a paper label (name, value, price) that stays readable
## at any distance. A click on a compartment picks the part; the wheel over it (or [ and ]) steps its value. The free bench
## has more families than compartments: the tab at the right edge pulls the next drawer.
## Hit ids: "tray:<slot>" and "tray_page".

const COLS := 2            ## across (x): the box stands beside the case, long side front to back
const ROWS := 4            ## front to back (z)
const CW := 0.046          ## compartment width (m)
const CD := 0.048          ## compartment depth
const WALL := 0.002
const H := 0.022
const SAMPLE_SCALE := 1.7  ## a sample is drawn a little larger than life so a 6 mm resistor reads at the bench distance

var slots: Array = []      ## [{fam, item, cell: Node3D}] for the visible page
var page := 0
var pages := 1
var _content: Node3D
var _labels: Array = []
var _rims: Array = []

var _shell_root: Node3D
var rows := ROWS

func _init() -> void:
	_shell_root = Node3D.new(); add_child(_shell_root)
	_content = Node3D.new(); add_child(_content)

## The box itself: as many rows as the families need (1 to ROWS), so a two-part ticket gets a small box, not six empty bins.
func _shell(n_rows: int) -> void:
	for c in _shell_root.get_children(): c.queue_free()
	var shell := MeshKit.mat(Color(0.16, 0.30, 0.36), 0.35, 0.0, {"normal": 0.1})   # blue-grey polypropylene
	var w := COLS * CW + WALL; var d := n_rows * CD + WALL
	MeshKit.add(_shell_root, MeshKit.rounded_box(Vector3(w + 0.006, 0.003, d + 0.006), 0.003, 2), shell, Vector3(0, 0.0015, 0))
	for c in COLS + 1:
		MeshKit.add(_shell_root, MeshKit.rounded_box(Vector3(WALL, H, d), 0.0006, 1), shell, Vector3(-w * 0.5 + c * CW + WALL * 0.5, H * 0.5, 0))
	for r in n_rows + 1:
		MeshKit.add(_shell_root, MeshKit.rounded_box(Vector3(w, H, WALL), 0.0006, 1), shell, Vector3(0, H * 0.5, -d * 0.5 + r * CD + WALL * 0.5))

## Lay the families out: `fams` from Workbench.tray_families(), `idx_of(fam) -> int` the value shown for each, `held` the item in hand.
func fill(fams: Array, idx_of: Callable, held: Dictionary) -> void:
	for c in _content.get_children(): c.queue_free()
	_labels.clear(); _rims.clear(); slots.clear()
	# 0.7 (Mina, 1-3): three boxes all read "47 Ω" while they held 1/4, 1/2 and 1 W parts. When the drawer holds a value in more
	# than one rating, each resistor tab names its rating too.
	var rated := {}
	for f in fams:
		var f0: Dictionary = (f.items as Array)[0]
		if str(f0.partId).begins_with("res"): rated[str(f0.variant)] = true
	_show_watts = rated.size() > 1
	var per := COLS * ROWS
	pages = maxi(1, int(ceil(float(fams.size()) / float(per))))
	page = clampi(page, 0, pages - 1)
	var shown := mini(per, fams.size() - page * per)
	rows = clampi(int(ceil(float(shown) / float(COLS))), 1, ROWS)   # 0.4.1 (Sigrid): no empty bins; a two-part ticket gets one row
	_shell(rows)
	var w := COLS * CW + WALL; var d := rows * CD + WALL
	for s in per:
		var fi := page * per + s
		if fi >= fams.size(): break
		var fam: Dictionary = fams[fi]
		var items: Array = fam.items
		var it: Dictionary = items[clampi(int(idx_of.call(fam)), 0, items.size() - 1)]
		var cx := -w * 0.5 + (s % COLS) * CW + CW * 0.5 + WALL * 0.5
		var cz := -d * 0.5 + (rows - 1 - s / COLS) * CD + CD * 0.5 + WALL * 0.5   # fill from the front row: nearest the hand, clear of the ticket
		var cell := Node3D.new(); cell.position = Vector3(cx, 0.003, cz); _content.add_child(cell)
		slots.append({"fam": fam, "item": it, "cell": cell})
		var sample := Part3D.make({"partId": it.partId, "kind": it.kind, "value": it.value, "variant": it.variant, "label": it.label, "footprint": it.footprint, "uid": "tray%d" % s})
		sample.scale = Vector3.ONE * SAMPLE_SCALE
		cell.add_child(sample)
		sample.position = -sample._centre() * SAMPLE_SCALE + Vector3(0, 0, -0.006)
		# the active compartment (the part in hand) gets an amber floor
		var active: bool = str(held.get("partId", "")) == str(it.partId) and str(held.get("value", "")) == str(it.value) and str(held.get("variant", "")) == str(it.variant)
		var floor_m := MeshKit.mat(Color(0.95, 0.62, 0.18) if active else Color(0.12, 0.22, 0.27), 0.6, 0.0, {"normal": 0.0, "emission": Color(0.95, 0.55, 0.12), "emission_energy": 0.6 if active else 0.0})
		_rims.append(MeshKit.add(cell, MeshKit.rounded_box(Vector3(CW - WALL * 1.5, 0.0008, CD - WALL * 1.5), 0.0006, 1), floor_m, Vector3(0, 0.0004, 0)))
		# 0.4.1 (Sigrid): a printed paper tab on the compartment's front wall, tilted up to the bench camera, instead of a label floating
		# beside the box. The value is large (7 mm: about 16 px cap at 1280x800 in view 1); the name and the price are on the hover tip
		# (0.5: a price line small enough to fit the tab was 8 px on screen, under the 16 px floor).
		var tab := Node3D.new(); tab.position = Vector3(0, H + 0.001, CD * 0.5 - WALL * 0.2); tab.rotation_degrees.x = -45.0; cell.add_child(tab)
		MeshKit.add(tab, MeshKit.rounded_box(Vector3(CW - WALL * 1.6, 0.0135, 0.0006), 0.0008, 1), MeshKit.mat(Color(0.93, 0.90, 0.80), 0.85, 0.0, {"normal": 0.0}), Vector3(0, 0.0, 0))
		var big := Label3D.new(); big.text = _tab_value(fam, it); big.font = load(Instruments3D.FONT_UI)
		big.font_size = 64; big.pixel_size = 0.00011; big.modulate = Color(0.08, 0.08, 0.09); big.outline_size = 0
		big.position = Vector3(0, 0.0022, 0.0005); big.double_sided = false; tab.add_child(big); _labels.append(big)
		if big.text.length() > 7: big.pixel_size = 0.00011 * 7.0 / float(big.text.length())   # a rating on the tab: shrink to fit its width
		Instruments3D.hit(cell, "tray:%d" % s, Vector3(CW - WALL, H, CD - WALL), Vector3(0, H * 0.5, 0))
	if pages > 1:
		var tab := Node3D.new(); tab.position = Vector3(0, 0, d * 0.5 + 0.016); _content.add_child(tab)
		MeshKit.add(tab, MeshKit.rounded_box(Vector3(w * 0.7, 0.012, 0.022), 0.002, 2), MeshKit.mat(Color(0.86, 0.80, 0.66), 0.9, 0.0), Vector3(0, 0.006, 0))
		var tl := Label3D.new(); tl.text = "drawer\n%d / %d" % [page + 1, pages]; tl.fixed_size = true; tl.pixel_size = 0.0009; tl.font_size = 20; tl.outline_size = 6
		tl.modulate = Color(0.96, 0.94, 0.88); tl.outline_modulate = Color(0.05, 0.05, 0.06); tl.font = load(Instruments3D.FONT_UI); tl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		tl.position = Vector3(0, 0.022, 0); tab.add_child(tl)
		Instruments3D.hit(tab, "tray_page", Vector3(w * 0.75, 0.02, 0.026), Vector3(0, 0.01, 0))

func _short_name(fam: Dictionary, it: Dictionary) -> String:
	var pid := str(it.partId); var up := pid.to_upper()
	for pre in ["2N", "1N", "BC", "TIP", "IRL", "IRF", "LM", "NE", "BZX", "TL", "MCP"]:
		if up.begins_with(pre): return up.get_slice("-", 0)
	if pid.begins_with("led-"): return "LED " + pid.get_slice("-", 1)
	if pid == "trimmer": return "Trimmer"
	var vr := str(it.get("variant", ""))
	if pid.begins_with("res"):
		var watt: String = {"0.25W": " ¼ W", "0.5W": " ½ W", "0.167W": ""}.get(vr, (" " + vr.trim_suffix("W") + " W") if vr.ends_with("W") else "")
		return ("Wirewound" if pid.begins_with("res-ww") else "Resistor") + watt
	var n := str(fam.get("name", pid))
	return n if n.length() <= 16 else n.substr(0, 15) + "."

## The tab's big line: the value for valued parts ("220 Ω"), else the short name ("LED red", "2N2222").
var _show_watts := false
func _tab_value(fam: Dictionary, it: Dictionary) -> String:
	if it.get("value", null) != null:
		var v := str(it.label).get_slice("  ", 0)
		var vr := str(it.get("variant", ""))
		if _show_watts and str(it.partId).begins_with("res") and vr.ends_with("W"):
			v += "  " + str({"0.25W": "¼ W", "0.5W": "½ W", "0.167W": "⅙ W"}.get(vr, vr.trim_suffix("W") + " W"))
		return v
	return _short_name(fam, it)

func _value_line(it: Dictionary, n: int) -> String:
	var v := str(it.label).get_slice("  ", 0) if it.get("value", null) != null else ""
	var price := str(it.get("price_text", ""))
	var s := ("%s  %s" % [v, price]).strip_edges()
	return ("‹ %s ›" % s) if n > 1 else s

## The slot under a hit id "tray:<n>", or -1.
static func slot_of(hit_id: String) -> int:
	return int(hit_id.get_slice(":", 1)) if hit_id.begins_with("tray:") else -1
