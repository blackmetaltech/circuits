class_name Part3D
extends Node3D
## LOOK2 board components, procedural, at 2x real size (MeshKit conventions: pin 0 at the origin, pins along footprint offsets,
## the caller sets rotation.y = -rot * PI / 2). Presentation only: every state (heat, smoke, LED current) comes from the engine.

const P := MeshKit.PITCH
const BAND := [Color(0.02, 0.02, 0.02), Color(0.40, 0.20, 0.08), Color(0.80, 0.06, 0.05), Color(0.95, 0.42, 0.05), Color(0.95, 0.80, 0.08),
	Color(0.10, 0.55, 0.15), Color(0.10, 0.25, 0.75), Color(0.50, 0.15, 0.65), Color(0.45, 0.45, 0.45), Color(0.92, 0.92, 0.90)]
const GOLD := Color(0.83, 0.64, 0.28)
const SILVER := Color(0.75, 0.75, 0.78)
const LED_COL := {"red": Color(1.0, 0.08, 0.04), "green": Color(0.15, 1.0, 0.25), "yellow": Color(1.0, 0.75, 0.05), "blue": Color(0.1, 0.35, 1.0), "white": Color(0.95, 0.95, 1.0)}

var part: Dictionary = {}
var kind := ""
var footprint := ""
var body_meshes: Array = []        ## MeshInstance3D whose material takes heat / char
var _body_mats: Array = []         ## original materials (restored when not smoked)
var _labels: Array = []
var _led_mat: StandardMaterial3D
var _led_light: OmniLight3D
var _led_color := Color.RED
var _scorch: Decal
var _ghost := 0
var _heat := 0.0
var _smoked := false
var _crack: MeshInstance3D

static func make(p: Dictionary) -> Part3D:
	var n := Part3D.new()
	n.part = p
	n.kind = str(p.get("kind", ""))
	n.footprint = str(p.get("footprint", ""))
	if n.footprint == "": n.footprint = _fp_of(str(p.get("partId", "")))
	n.name = "part_%s" % str(p.get("uid", "x"))
	n._build()
	return n

static func _fp_of(pid: String) -> String:
	for row in NodeApi.PART_TABLE:
		if pid.begins_with(row[0]): return row[2]
	return ""

func pin_local(i: int) -> Vector3:
	var fp: Array = NodeApi.FOOTPRINTS.get(footprint, [[0, 0], [2, 0]])
	if i >= fp.size(): return Vector3.ZERO
	return Vector3(float(fp[i][0]) * P, 0, float(fp[i][1]) * P)

func pin_world(i: int) -> Vector3: return to_global(pin_local(i))

## ------------------------------------------------------------------------------------------------ build

func _build() -> void:
	var pid := str(part.get("partId", ""))
	match footprint:
		"axial2":
			if kind == "R" or pid.begins_with("res"): _resistor(pid)
			elif kind in ["D", "Z", "SCHOTTKY"] or pid.begins_with("1n") or pid.begins_with("bzx") or pid.begins_with("zener"): _diode(pid)
			elif pid == "cap-cer": _ceramic()
			else: _film_cap()
		"radial2":
			if kind == "LED" or pid.begins_with("led"): _led(pid)
			else: _electrolytic()
		"to92": _to92(pid)
		"to220": _to220(pid)
		"dip8": _dip8(pid)
		"pot3": _module(str(part.get("label", pid)), 4)
		_:
			if pid.begins_with("bat-pp3"): _pp3(pid)
			elif pid == "heater": _heater()
			elif pid == "ideal-vsource": _vsource()
			elif pid == "blackbox": _sealed()
			elif pid == "adc-in": _adc()
			elif footprint == "block2": _terminals()
			else: _module(str(part.get("label", pid)), 2)

func _body(mesh: Mesh, material: Material, pos := Vector3.ZERO, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshKit.add(self, mesh, material, pos, rot)
	body_meshes.append(mi); _body_mats.append(material)
	return mi

## A lead (tinned wire) from a to b with rounded bends: points list in local space.
func _lead(pts: Array, r := 0.00032) -> void:
	var pv := PackedVector3Array(pts)
	MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(pv, 0.0012, 3), r, 6), MeshKit.m("tin"))

## Surface of revolution about the local X axis from a profile [[x, radius], ...].
static func lathe(profile: Array, sides := 20) -> ArrayMesh:
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in profile.size() - 1:
		var x0: float = profile[i][0]; var r0: float = profile[i][1]; var x1: float = profile[i + 1][0]; var r1: float = profile[i + 1][1]
		var slope := Vector2(x1 - x0, r1 - r0).normalized()
		for s in sides:
			var a0 := TAU * s / sides; var a1 := TAU * (s + 1) / sides
			var q := [[x0, r0, a0], [x0, r0, a1], [x1, r1, a1], [x1, r1, a0]]
			for k in [0, 1, 2, 0, 2, 3]:
				var e: Array = q[k]
				var ca := cos(float(e[2])); var sa := sin(float(e[2]))
				st.set_normal(Vector3(-slope.y, slope.x * ca, slope.x * sa).normalized())
				st.set_uv(Vector2(float(e[0]) * 40.0, float(e[2]) / TAU))
				st.add_vertex(Vector3(float(e[0]), float(e[1]) * ca, float(e[1]) * sa))
	st.generate_tangents()
	return st.commit()

func _axial_leads(y: float, half_body: float) -> void:
	var L := 4.0 * P
	_lead([Vector3(0, -MeshKit.BOARD_T, 0), Vector3(0, y, 0), Vector3(L * 0.5 - half_body, y, 0)])
	_lead([Vector3(L, -MeshKit.BOARD_T, 0), Vector3(L, y, 0), Vector3(L * 0.5 + half_body, y, 0)])

func _bands(value: float) -> Array:
	if value <= 0.0: return [0, 0, 0]
	var e := int(floor(log(value) / log(10.0)))
	var digits := int(round(value / pow(10.0, e - 1)))
	if digits >= 100: digits = 10; e += 1
	return [digits / 10, digits % 10, e - 1]

func _resistor(pid: String) -> void:
	var y := 0.0045
	var v := float(part.get("value", 0.0)) if part.get("value", null) != null else 0.0
	if pid == "res-ww5":   # 5 W wirewound: white ceramic block
		var bm := MeshKit.mat(Color(0.88, 0.87, 0.82), 0.85, 0.0, {"normal": 0.5})
		_body(MeshKit.rounded_box(Vector3(0.016, 0.009, 0.009), 0.0008), bm, Vector3(2 * P, 0.0065, 0))
		_axial_leads(0.003, 0.008)
		_labels.append(MeshKit.label(self, "5W %s" % NodeApi.format_value(v, "R").replace(" ", ""), 0.00004, Vector3(2 * P, 0.0111, 0), Color(0.15, 0.15, 0.15)))
		return
	var mf := pid == "res-mf"
	var col := Color(0.30, 0.52, 0.72) if mf else Color(0.80, 0.66, 0.46)
	var half := 0.0063
	var r := 0.0024
	var prof := [[-half, 0.0003], [-half + 0.0004, r * 0.9], [-half + 0.0015, r * 1.08], [-half + 0.003, r * 0.93], [half - 0.003, r * 0.93], [half - 0.0015, r * 1.08], [half - 0.0004, r * 0.9], [half, 0.0003]]
	_body(lathe(prof), MeshKit.mat(col, 0.55, 0.0, {"clearcoat": 0.35, "normal": 0.2}), Vector3(2 * P, y, 0))
	var b := _bands(v)
	var cols: Array = [BAND[clampi(b[0], 0, 9)], BAND[clampi(b[1], 0, 9)], (GOLD if b[2] == -1 else (SILVER if b[2] == -2 else BAND[clampi(b[2], 0, 9)])), GOLD]
	var xs := [-half + 0.0017, -half + 0.0036, -half + 0.0055, half - 0.0017]
	for i in 4:
		var rr := r * (1.1 if (i == 0 or i == 3) else 0.95)
		var band := CylinderMesh.new(); band.top_radius = rr; band.bottom_radius = rr; band.height = 0.0009; band.radial_segments = 20
		MeshKit.add(self, band, MeshKit.mat(cols[i], 0.5, 0.6 if cols[i] == GOLD else 0.0, {"clearcoat": 0.3}), Vector3(2 * P + xs[i], y, 0), Vector3(0, 0, PI / 2))
	_axial_leads(y, half)

func _diode(pid: String) -> void:
	var y := 0.0035
	var glass := pid == "1n4148"
	var half := 0.0038 if glass else 0.0052
	var r := 0.0010 if glass else 0.0027
	var body := CylinderMesh.new(); body.top_radius = r; body.bottom_radius = r; body.height = half * 2; body.radial_segments = 20
	var bm: Material = MeshKit.mat(Color(0.85, 0.25, 0.12), 0.05, 0.0, {"alpha": 0.75, "rough_tex": false, "normal": 0.0}) if glass else MeshKit.m("black_epoxy")
	_body(body, bm, Vector3(2 * P, y, 0), Vector3(0, 0, PI / 2))
	var band := CylinderMesh.new(); band.top_radius = r * 1.02; band.bottom_radius = r * 1.02; band.height = half * 0.35; band.radial_segments = 20
	MeshKit.add(self, band, MeshKit.mat(Color(0.05, 0.05, 0.05) if glass else Color(0.72, 0.72, 0.74), 0.4), Vector3(2 * P + half * 0.62, y, 0), Vector3(0, 0, PI / 2))   # cathode band at the K pin (pin 1, +x)
	if not glass:
		_labels.append(MeshKit.label(self, "1N4007", 0.000032, Vector3(2 * P - 0.0008, y + r + 0.00005, 0), Color(0.55, 0.55, 0.57), true))
	_axial_leads(y, half)

func _ceramic() -> void:
	var y := 0.007
	var d := SphereMesh.new(); d.radius = 0.0035; d.height = 0.0024 * 2; d.radial_segments = 20; d.rings = 10
	_body(d, MeshKit.mat(Color(0.78, 0.45, 0.15), 0.45, 0.0, {"clearcoat": 0.4}), Vector3(2 * P, y, 0), Vector3(PI / 2, 0, 0))
	_lead([Vector3(0, -MeshKit.BOARD_T, 0), Vector3(0, 0.002, 0), Vector3(2 * P - 0.0015, y - 0.001, 0)])
	_lead([Vector3(4 * P, -MeshKit.BOARD_T, 0), Vector3(4 * P, 0.002, 0), Vector3(2 * P + 0.0015, y - 0.001, 0)])

func _film_cap() -> void:
	_body(MeshKit.rounded_box(Vector3(0.013, 0.010, 0.006), 0.001), MeshKit.mat(Color(0.30, 0.32, 0.36), 0.4, 0.0, {"clearcoat": 0.4}), Vector3(2 * P, 0.0065, 0))
	_labels.append(MeshKit.label(self, str(part.get("label", "")), 0.00004, Vector3(2 * P, 0.0116, 0)))
	_axial_leads(0.002, 0.0065)

func _led(pid: String) -> void:
	for k in LED_COL: if pid.contains(k): _led_color = LED_COL[k]
	var h := 0.011
	var cyl := CylinderMesh.new(); cyl.top_radius = 0.0050; cyl.bottom_radius = 0.0050; cyl.height = h - 0.005; cyl.radial_segments = 24
	_led_mat = MeshKit.mat(_led_color.lerp(Color.WHITE, 0.1), 0.08, 0.0, {"alpha": 0.72, "rough_tex": false, "normal": 0.0, "emission": _led_color, "emission_energy": 0.0, "clearcoat": 1.0})
	var base_y := 0.004
	_body(cyl, _led_mat, Vector3(P, base_y + (h - 0.005) * 0.5, 0))
	var dome := SphereMesh.new(); dome.radius = 0.005; dome.height = 0.01; dome.radial_segments = 24; dome.rings = 12; dome.is_hemisphere = true
	_body(dome, _led_mat, Vector3(P, base_y + h - 0.005, 0))
	var flange := CylinderMesh.new(); flange.top_radius = 0.0058; flange.bottom_radius = 0.0058; flange.height = 0.001; flange.radial_segments = 24
	_body(flange, _led_mat, Vector3(P, base_y + 0.0005, 0))
	var die := BoxMesh.new(); die.size = Vector3(0.0012, 0.0004, 0.0012)
	MeshKit.add(self, die, MeshKit.mat(Color(0.9, 0.9, 0.9), 0.3, 0.0, {"emission": _led_color, "emission_energy": 0.0}), Vector3(P, base_y + h - 0.006, 0))
	_lead([Vector3(0, -MeshKit.BOARD_T, 0), Vector3(0, base_y + 0.002, 0), Vector3(P - 0.0012, base_y + h - 0.006, 0)], 0.0003)
	_lead([Vector3(2 * P, -MeshKit.BOARD_T, 0), Vector3(2 * P, base_y + 0.002, 0), Vector3(P + 0.0012, base_y + h - 0.0065, 0)], 0.0003)
	_led_light = OmniLight3D.new(); _led_light.light_color = _led_color; _led_light.omni_range = 0.08; _led_light.light_energy = 0.0; _led_light.shadow_enabled = false
	_led_light.position = Vector3(P, base_y + h, 0); add_child(_led_light)

func set_led(mA: float, bloom := 0.0) -> void:
	if _led_mat == null: return
	var k := clampf(mA / 20.0, 0.0, 1.5)
	_led_mat.emission_energy_multiplier = k * 3.2 + bloom * 1.0   # keeps the die colour; 6x washed it to a white blob
	if _led_light: _led_light.light_energy = k * 0.6

func _electrolytic() -> void:
	var c := float(part.get("value", 1e-4)) if part.get("value", null) != null else 1e-4
	var r := clampf(0.004 + 0.0012 * log(maxf(c * 1e6, 1.0)) / log(10.0), 0.004, 0.009)
	var h := r * 2.4
	var can := CylinderMesh.new(); can.top_radius = r; can.bottom_radius = r; can.height = h; can.radial_segments = 28
	var y0 := 0.0015
	_body(can, MeshKit.mat(Color(0.06, 0.09, 0.22), 0.35, 0.0, {"clearcoat": 0.6}), Vector3(P, y0 + h * 0.5, 0))
	var top := CylinderMesh.new(); top.top_radius = r * 0.86; top.bottom_radius = r * 0.86; top.height = 0.0003; top.radial_segments = 28
	MeshKit.add(self, top, MeshKit.m("brushed_alu"), Vector3(P, y0 + h + 0.00005, 0))
	for a in [0.0, PI / 2]:   # stamped K vent
		var g := BoxMesh.new(); g.size = Vector3(r * 1.4, 0.0002, 0.0003)
		MeshKit.add(self, g, MeshKit.mat(Color(0.4, 0.4, 0.42), 0.5, 1.0), Vector3(P, y0 + h + 0.0002, 0), Vector3(0, a + PI / 4, 0))
	# the minus stripe on the - leg side (pin 1, +x)
	var sm := MeshKit.mat(Color(0.75, 0.78, 0.85), 0.4, 0.0, {"clearcoat": 0.5})
	var bar := MeshKit.rounded_box(Vector3(0.0012, h * 0.9, r * 0.8), 0.0004)
	MeshKit.add(self, bar, sm, Vector3(P + r * 0.93, y0 + h * 0.5, 0))
	_labels.append(MeshKit.label(self, NodeApi.format_value(c, "CE").replace(" ", ""), 0.000035, Vector3(P - r - 0.00002, y0 + h * 0.55, 0), Color(0.8, 0.82, 0.86), false, Vector3(0, -PI / 2, PI / 2)))
	_lead([Vector3(0, -MeshKit.BOARD_T, 0), Vector3(0, y0, 0)])
	_lead([Vector3(2 * P, -MeshKit.BOARD_T, 0), Vector3(2 * P, y0, 0)])

func _to92(pid: String) -> void:
	var y0 := 0.006
	var h := 0.009
	# half-cylinder body: the flat face towards -z (the label side), the round back towards +z
	var cyl := CylinderMesh.new(); cyl.top_radius = 0.0047; cyl.bottom_radius = 0.0047; cyl.height = h; cyl.radial_segments = 32
	var bm := MeshKit.m("black_epoxy")
	var mi := _body(cyl, bm, Vector3(P, y0 + h * 0.5, 0.0004))
	mi.scale = Vector3(1.0, 1.0, 0.72)
	var face := MeshKit.rounded_box(Vector3(0.0094, h, 0.002), 0.0004)
	_body(face, bm, Vector3(P, y0 + h * 0.5, -0.0014))
	_labels.append(MeshKit.label(self, pid.to_upper(), 0.000030, Vector3(P, y0 + h * 0.62, -0.00245), Color(0.62, 0.62, 0.64), true, Vector3(0, PI, 0)))
	for i in 3:
		var x := float(i) * P
		_lead([Vector3(x, -MeshKit.BOARD_T, 0), Vector3(x, 0.002, 0), Vector3(P + (x - P) * 0.35, y0 + 0.0002, 0)], 0.00028)

func _to220(pid: String) -> void:
	var y0 := 0.004
	_body(MeshKit.rounded_box(Vector3(0.020, 0.018, 0.009), 0.0006), MeshKit.m("black_epoxy"), Vector3(2 * P, y0 + 0.009, 0.0))
	var tab := MeshKit.rounded_box(Vector3(0.020, 0.013, 0.0026), 0.0004)
	MeshKit.add(self, tab, MeshKit.m("tin"), Vector3(2 * P, y0 + 0.018 + 0.0055, 0.0032))
	var hole := CylinderMesh.new(); hole.top_radius = 0.0037; hole.bottom_radius = 0.0037; hole.height = 0.0028; hole.radial_segments = 20
	MeshKit.add(self, hole, MeshKit.mat(Color(0.01, 0.01, 0.01), 0.9), Vector3(2 * P, y0 + 0.018 + 0.0062, 0.0032), Vector3(PI / 2, 0, 0))
	_labels.append(MeshKit.label(self, pid.to_upper(), 0.00004, Vector3(2 * P, y0 + 0.010, -0.00455), Color(0.62, 0.62, 0.64), true, Vector3(0, PI, 0)))
	for i in 3:
		var x := float(i) * 2.0 * P
		_lead([Vector3(x, -MeshKit.BOARD_T, 0), Vector3(x, 0.002, 0), Vector3(2 * P + (x - 2 * P) * 0.25, y0 + 0.0005, 0)], 0.0005)

func _dip8(pid: String) -> void:
	var y0 := 0.0018
	var c := Vector3(1.5 * P, y0 + 0.0035, 1.5 * P)
	_body(MeshKit.rounded_box(Vector3(0.0128, 0.0068, 0.0196), 0.0006), MeshKit.m("black_epoxy"), c)
	var dimple := CylinderMesh.new(); dimple.top_radius = 0.0009; dimple.bottom_radius = 0.0009; dimple.height = 0.0002
	MeshKit.add(self, dimple, MeshKit.mat(Color(0.06, 0.06, 0.06), 0.8), c + Vector3(-0.0035, 0.0034, -0.0068))
	_labels.append(MeshKit.label(self, pid.to_upper(), 0.000045, c + Vector3(0, 0.00345, 0.001), Color(0.62, 0.62, 0.64), true, Vector3(-PI / 2, PI / 2, 0)))
	for o in NodeApi.FOOTPRINTS["dip8"]:
		var x := float(o[0]) * P; var z := float(o[1]) * P
		var inward := 0.0015 if o[0] == 0 else -0.0015
		_lead([Vector3(x, -MeshKit.BOARD_T, z), Vector3(x, 0.003, z), Vector3(x + inward, 0.0045, z)], 0.0004)

func _terminals() -> void:
	var tm := MeshKit.mat(Color(0.12, 0.42, 0.22), 0.5, 0.0)
	for i in 2:
		var x := float(i) * 6.0 * P
		_body(MeshKit.rounded_box(Vector3(0.010, 0.010, 0.0075), 0.0007), tm, Vector3(x, 0.005, 0))
		var screw := CylinderMesh.new(); screw.top_radius = 0.0018; screw.bottom_radius = 0.0018; screw.height = 0.001; screw.radial_segments = 16
		MeshKit.add(self, screw, MeshKit.m("steel"), Vector3(x, 0.0102, 0.0005))
		var slot := BoxMesh.new(); slot.size = Vector3(0.0028, 0.0004, 0.0005)
		MeshKit.add(self, slot, MeshKit.mat(Color(0.1, 0.1, 0.1), 0.6), Vector3(x, 0.0108, 0.0005))
		_lead([Vector3(x, -MeshKit.BOARD_T, 0), Vector3(x, 0.002, 0)])
	_labels.append(MeshKit.label(self, str(part.get("label", "")).to_upper(), 0.00005, Vector3(3 * P, 0.0003, 0.0065), Color(0.9, 0.9, 0.88)))

## A 9 V PP3 lying behind its two snap pads: the body, the snap cap, red and black leads into the pads.
func _pp3(pid: String) -> void:
	var tired := pid.ends_with("tired")
	var body := MeshKit.mat(Color(0.06, 0.06, 0.065), 0.4, 0.0, {"clearcoat": 0.5})
	var band := MeshKit.mat(Color(0.42, 0.33, 0.16) if not tired else Color(0.36, 0.34, 0.31), 0.5, 0.4, {"clearcoat": 0.2})   # muted brass: the old orange read as glowing
	var c := Vector3(3 * P, 0.0082, -0.010)
	_body(MeshKit.rounded_box(Vector3(0.036, 0.016, 0.022), 0.002), body, c)
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.024, 0.0162, 0.0222), 0.0018), band, c + Vector3(0.002, 0, 0))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.004, 0.012, 0.016), 0.001), MeshKit.m("black_plastic"), c + Vector3(-0.020, 0, 0))   # the snap
	_labels.append(MeshKit.label(self, "9V" if not tired else "9V  OLD", 0.00007, c + Vector3(0.002, 0.0083, 0), Color(0.08, 0.06, 0.04), true))
	for i in 2:
		var x := float(i) * 6.0 * P
		var lead := MeshKit.mat(Color(0.75, 0.10, 0.08) if i == 0 else Color(0.06, 0.06, 0.06), 0.5)
		MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(PackedVector3Array([c + Vector3(-0.022, -0.002, -0.003 + i * 0.006), Vector3(x - 0.002, 0.004, -0.008), Vector3(x, 0.0015, 0)]), 0.004, 3), 0.0008, 6), lead)
		_lead([Vector3(x, -MeshKit.BOARD_T, 0), Vector3(x, 0.0015, 0)])
	_labels.append(MeshKit.label(self, "+", 0.00008, Vector3(0, 0.0004, 0.0045), Color(0.9, 0.2, 0.15)))

## The aquarium heater: a glass tube with a nichrome coil on two posts; it glows with its own heat.
func _heater() -> void:
	var post := MeshKit.mat(Color(0.85, 0.84, 0.80), 0.8)
	for i in 2:
		var x := float(i) * 6.0 * P
		_body(MeshKit.rounded_box(Vector3(0.005, 0.008, 0.005), 0.0008), post, Vector3(x, 0.004, 0))
		_lead([Vector3(x, -MeshKit.BOARD_T, 0), Vector3(x, 0.002, 0)])
	var core := CylinderMesh.new(); core.top_radius = 0.0035; core.bottom_radius = 0.0035; core.height = 6 * P - 0.002
	_body(core, MeshKit.mat(Color(0.86, 0.83, 0.76), 0.85), Vector3(3 * P, 0.0095, 0), Vector3(0, 0, PI / 2))
	var coil := PackedVector3Array()
	for k in 140:
		var t := float(k) / 139.0
		coil.append(Vector3(0.0015 + t * (6 * P - 0.003), 0.0095 + sin(t * TAU * 18.0) * 0.0042, cos(t * TAU * 18.0) * 0.0042))
	_body(MeshKit.tube(coil, 0.00045, 5, false), MeshKit.mat(Color(0.55, 0.52, 0.48), 0.4, 0.9), Vector3.ZERO)
	var glass := CylinderMesh.new(); glass.top_radius = 0.0055; glass.bottom_radius = 0.0055; glass.height = 6 * P - 0.001
	MeshKit.add(self, glass, MeshKit.m("glass"), Vector3(3 * P, 0.0095, 0), Vector3(0, 0, PI / 2))
	_labels.append(MeshKit.label(self, "HEATER 50Ω", 0.00004, Vector3(3 * P, 0.0003, 0.0075), Color(0.9, 0.9, 0.88)))

## Ticket 2-3's sealed module: a potted black brick over its OUT and GND pads, a yellow "do not open" sticker; what is inside is only measured.
func _sealed() -> void:
	# the brick stands BEHIND its pin row and inside the two pads, so the OUT and GND pads stay open for the meter leads
	# (Dagny: legs under tall parts must be easy to hit) and the fixed ground wire up column 8 stays in sight
	var c := Vector3(3 * P, 0.0075, -0.0105)
	_body(MeshKit.rounded_box(Vector3(6 * P - 0.004, 0.013, 0.014), 0.0015), MeshKit.mat(Color(0.05, 0.05, 0.055), 0.75, 0.0), c)
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0105, 0.0004, 0.0095), 0.0003), MeshKit.mat(Color(0.93, 0.76, 0.12), 0.6), c + Vector3(0, 0.0066, 0))
	_labels.append(MeshKit.label(self, "SEALED", 0.000032, c + Vector3(0, 0.0071, -0.0018), Color(0.08, 0.06, 0.03), true))
	_labels.append(MeshKit.label(self, "DO NOT OPEN", 0.000022, c + Vector3(0, 0.0071, 0.0022), Color(0.08, 0.06, 0.03), true))
	_labels.append(MeshKit.label(self, "OUT", 0.00005, Vector3(0, 0.0004, 0.0055), Color(0.95, 0.3, 0.2)))
	_labels.append(MeshKit.label(self, "GND", 0.00005, Vector3(6 * P, 0.0004, 0.0055), Color(0.85, 0.85, 0.85)))
	for i in 2:
		var x := float(i) * 6.0 * P
		var xin := 0.0025 if i == 0 else 6.0 * P - 0.0025
		_lead([Vector3(x, -MeshKit.BOARD_T, 0), Vector3(x, 0.0025, 0), Vector3(xin, 0.004, -0.0035)], 0.0005)

## Ticket 2-1's ADC input: the weather station's sensor header, a blue stub board whose input is a fixed 10 kΩ to ground.
func _adc() -> void:
	_body(MeshKit.rounded_box(Vector3(6 * P + 0.004, 0.0016, 0.012), 0.0005), MeshKit.mat(Color(0.08, 0.20, 0.45), 0.5), Vector3(3 * P, 0.006, 0))
	_body(MeshKit.rounded_box(Vector3(0.008, 0.005, 0.006), 0.0005), MeshKit.m("black_plastic"), Vector3(3 * P, 0.0093, 0))
	_labels.append(MeshKit.label(self, "ADC  10 kΩ", 0.00004, Vector3(3 * P, 0.0072, 0.0042), Color(0.95, 0.95, 0.92), true))
	for i in 2:
		var x := float(i) * 6.0 * P
		_body(MeshKit.rounded_box(Vector3(0.0035, 0.006, 0.0035), 0.0004), MeshKit.m("black_plastic"), Vector3(x, 0.003, 0))
		_lead([Vector3(x, -MeshKit.BOARD_T, 0), Vector3(x, 0.0068, 0)])

## An exam-rig source: a grey module with its EMF printed and + and - marks over the pads.
func _vsource() -> void:
	_body(MeshKit.rounded_box(Vector3(6 * P + 0.006, 0.009, 0.012), 0.001), MeshKit.m("grey_plastic"), Vector3(3 * P, 0.0055, 0))
	_labels.append(MeshKit.label(self, str(part.get("label", "E")).to_upper(), 0.00006, Vector3(3 * P, 0.0102, 0), Color(0.95, 0.95, 0.92), true))
	_labels.append(MeshKit.label(self, "+", 0.0001, Vector3(0.002, 0.0102, 0), Color(0.95, 0.3, 0.2)))
	_labels.append(MeshKit.label(self, "−", 0.0001, Vector3(6 * P - 0.002, 0.0102, 0), Color(0.8, 0.8, 0.8)))
	for i in 2: _lead([Vector3(float(i) * 6.0 * P, -MeshKit.BOARD_T, 0), Vector3(float(i) * 6.0 * P, 0.002, 0)])

func _module(text: String, span: int) -> void:
	_body(MeshKit.rounded_box(Vector3(span * P + 0.006, 0.008, 0.010), 0.0008), MeshKit.m("black_plastic"), Vector3(span * P * 0.5, 0.005, 0))
	_labels.append(MeshKit.label(self, text, 0.00004, Vector3(span * P * 0.5, 0.0091, 0)))

## ------------------------------------------------------------------------------------------------ states

func set_heat(k: float) -> void:
	if _smoked or absf(k - _heat) < 0.01: return
	_heat = k
	for i in body_meshes.size():
		var mi: MeshInstance3D = body_meshes[i]
		if k <= 0.0: mi.material_override = _body_mats[i]; continue
		var m: StandardMaterial3D = (_body_mats[i] as StandardMaterial3D).duplicate()
		m.emission_enabled = true; m.emission = Color(1.0, 0.32, 0.05); m.emission_energy_multiplier = k * k * 4.0
		m.albedo_color = m.albedo_color.lerp(Color(0.12, 0.06, 0.03), k * 0.5)
		mi.material_override = m

## Tinned leads stay metal when a part burns.
func _is_lead(mi: MeshInstance3D) -> bool:
	var m := mi.get_active_material(0)
	return m != null and m == MeshKit.m("tin")

func set_smoked(on: bool) -> void:
	if on == _smoked: return
	_smoked = on
	var char_m := MeshKit.mat(Color(0.025, 0.02, 0.018), 0.98, 0.0, {"normal": 0.9})   # cold char: no glow (it read as a hot brown body)
	for i in body_meshes.size():
		(body_meshes[i] as MeshInstance3D).material_override = char_m if on else _body_mats[i]
	for c in get_children():   # colour bands, caps and bodies outside body_meshes char too (a burnt resistor kept its bands)
		if c is MeshInstance3D and not body_meshes.has(c) and c != _crack:
			var mi := c as MeshInstance3D
			if mi.mesh is ArrayMesh or mi.mesh is PrimitiveMesh:
				if _is_lead(mi): continue
				mi.material_override = char_m if on else null
	for l in _labels: (l as Label3D).visible = not on
	if on and _scorch == null:
		_scorch = Decal.new(); _scorch.size = Vector3(0.03, 0.02, 0.03)
		_scorch.texture_albedo = _scorch_tex(); _scorch.albedo_mix = 0.85
		_scorch.position = _centre() + Vector3(0, -0.002, 0)
		add_child(_scorch)
	if _scorch: _scorch.visible = on
	if on and footprint == "to92" and _crack == null:
		_crack = MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0004, 0.006, 0.006), 0.0001), MeshKit.mat(Color(0.9, 0.35, 0.05), 0.9, 0.0, {"emission": Color(1, 0.3, 0.02), "emission_energy": 2.0}), Vector3(P + 0.001, 0.011, 0.0))
	if _crack: _crack.visible = on

func _centre() -> Vector3:
	var fp: Array = NodeApi.FOOTPRINTS.get(footprint, [[0, 0], [2, 0]])
	var c := Vector3.ZERO
	for o in fp: c += Vector3(float(o[0]) * P, 0, float(o[1]) * P)
	return c / maxf(1.0, fp.size())

static var _scorch_cache: Texture2D
static func _scorch_tex() -> Texture2D:
	if _scorch_cache: return _scorch_cache
	var g := Gradient.new()
	g.set_color(0, Color(0.03, 0.02, 0.01, 0.95)); g.set_color(1, Color(0.2, 0.12, 0.05, 0.0))
	g.add_point(0.45, Color(0.07, 0.04, 0.02, 0.75))
	var t := GradientTexture2D.new(); t.gradient = g; t.fill = GradientTexture2D.FILL_RADIAL; t.fill_from = Vector2(0.5, 0.5); t.fill_to = Vector2(0.5, 0.0); t.width = 128; t.height = 128
	_scorch_cache = t
	return t

func set_ghost(state: int) -> void:
	_ghost = state
	var gm: StandardMaterial3D = null
	if state != 0:
		gm = MeshKit.mat(Color(0.55, 0.85, 1.0) if state == 1 else Color(1.0, 0.25, 0.2), 0.3, 0.0, {"alpha": 0.45, "emission": Color(0.3, 0.6, 0.9) if state == 1 else Color(0.9, 0.1, 0.05), "emission_energy": 0.6, "normal": 0.0})
	for c in _all_meshes(self):
		(c as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if state != 0 else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if state != 0: (c as MeshInstance3D).material_override = gm
	if state == 0:
		for i in body_meshes.size(): (body_meshes[i] as MeshInstance3D).material_override = _body_mats[i]

func set_highlight(on: bool) -> void:
	for mi in body_meshes:
		var m = (mi as MeshInstance3D).material_override
		if m is StandardMaterial3D and not _smoked and _ghost == 0:
			if on:
				var h: StandardMaterial3D = (m as StandardMaterial3D).duplicate(); h.rim_enabled = true; h.rim = 1.0; h.rim_tint = 0.0
				h.emission_enabled = true; h.emission = Color(0.91, 0.64, 0.24); h.emission_energy_multiplier = 0.08
				(mi as MeshInstance3D).material_override = h
			else:
				(mi as MeshInstance3D).material_override = _body_mats[body_meshes.find(mi)]

func _all_meshes(n: Node) -> Array:
	var out: Array = []
	for c in n.get_children():
		if c is MeshInstance3D: out.append(c)
		out.append_array(_all_meshes(c))
	return out
