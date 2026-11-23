class_name PartsLab
extends RefCounted
## LOOK2 chapters 2 and 3: the parts the tickets bring that the first look had no model for. Each builder takes the Part3D it
## fills (MeshKit conventions: pin 0 at the origin, pins on the footprint offsets, y up, +z towards the player) and stores the
## few nodes that move in `n.anim`. Presentation only: the jockey, the needle, the armature and the gauge are set from the
## engine's own numbers by Part3D.set_jockey / set_needle / set_relay / set_level.

const P := MeshKit.PITCH
const T := MeshKit.BOARD_T

static func _brass() -> StandardMaterial3D: return MeshKit.mat(Color(0.80, 0.60, 0.24), 0.3, 1.0)

static func _cyl(parent: Node3D, r: float, h: float, mat: Material, pos: Vector3, rot := Vector3.ZERO, seg := 24) -> MeshInstance3D:
	var c := CylinderMesh.new(); c.top_radius = r; c.bottom_radius = r; c.height = h; c.radial_segments = seg
	return MeshKit.add(parent, c, mat, pos, rot)

static func _box(parent: Node3D, size: Vector3, mat: Material, pos: Vector3, r := 0.0004) -> MeshInstance3D:
	return MeshKit.add(parent, MeshKit.rounded_box(size, r), mat, pos)

static func _post(n: Part3D, x: float, z: float, h := 0.0065, col := Color(0.80, 0.60, 0.24)) -> void:
	_cyl(n, 0.0027, h, MeshKit.mat(col, 0.3, 1.0), Vector3(x, h * 0.5 + 0.001, z))
	var slot := BoxMesh.new(); slot.size = Vector3(0.0032, 0.0005, 0.0006)
	MeshKit.add(n, slot, MeshKit.mat(Color(0.08, 0.08, 0.08), 0.7), Vector3(x, h + 0.0012, z))
	n._lead([Vector3(x, -T, z), Vector3(x, 0.002, z)])

## ------------------------------------------------------------------------------------------------ the metre bridge

## The 1 m slide wire (2-2, 2-4): a baseboard with a ruler, the taut wire between posts A and B, a brass rail over post J and the jockey
## that slides on it. The jockey is drawn at the engine's position (Part3D.set_jockey); a click or drag on the wire moves it.
static func slidewire(n: Part3D) -> void:
	var L := 20.0 * P
	# a thin ruler board under the wire only: the tickets run their own wires between the rail (row of J) and the wire (row of A and B)
	var wood := MeshKit.mat(Color(0.50, 0.34, 0.19), 0.72, 0.0, {"normal": 0.3})
	n._body(MeshKit.rounded_box(Vector3(L + 0.012, 0.0030, 0.0180), 0.0006), wood, Vector3(L * 0.5, 0.0015, 0.0045))
	var paper := MeshKit.mat(Color(0.93, 0.90, 0.80), 0.8, 0.0, {"normal": 0.0})
	_box(n, Vector3(L, 0.0006, 0.0062), paper, Vector3(L * 0.5, 0.0033, 0.0046), 0.0002)
	# ruler marks: every cm, longer every 5 cm, longest every 10 cm, from the wire's edge towards the player
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 101:
		var ln := 0.0034 if i % 10 == 0 else (0.0024 if i % 5 == 0 else 0.0014)
		var x0 := float(i) * L / 100.0 - 0.00018; var x1 := x0 + 0.00036
		var z0 := 0.0016; var z1 := z0 + ln; var y := 0.00365
		for v in [Vector3(x0, y, z0), Vector3(x0, y, z1), Vector3(x1, y, z1), Vector3(x0, y, z0), Vector3(x1, y, z1), Vector3(x1, y, z0)]:
			st.set_normal(Vector3.UP); st.add_vertex(v)
	MeshKit.add(n, st.commit(), MeshKit.mat(Color(0.08, 0.08, 0.08), 0.8, 0.0, {"normal": 0.0}))
	for k in [0, 20, 40, 60, 80, 100]:
		n._labels.append(MeshKit.label(n, str(k), 0.000034, Vector3(float(k) * L / 100.0, 0.0038, 0.0068), Color(0.08, 0.08, 0.08), true))
	_cyl(n, 0.0006, L, MeshKit.mat(Color(0.72, 0.72, 0.75), 0.25, 1.0, {"normal": 0.0}), Vector3(L * 0.5, 0.0050, 0.0), Vector3(0, 0, PI / 2), 10)   # the wire
	var rail := MeshKit.mat(Color(0.80, 0.60, 0.24), 0.3, 1.0)
	_box(n, Vector3(L - 0.012, 0.0020, 0.0024), rail, Vector3(L * 0.5, 0.0072, -2.0 * P), 0.0005)                                              # the rail over J
	for x in [0.006, L - 0.006]: _cyl(n, 0.0009, 0.0072, rail, Vector3(x, 0.0036, -2.0 * P), Vector3.ZERO, 8)
	_post(n, 0.0, 0.0, 0.0070); _post(n, L, 0.0, 0.0070); _post(n, L * 0.5, -2.0 * P, 0.0070)
	n._labels.append(MeshKit.label(n, "A", 0.00007, Vector3(0.0, 0.0036, 0.0104), Color(0.95, 0.93, 0.85), true))
	n._labels.append(MeshKit.label(n, "B", 0.00007, Vector3(L, 0.0036, 0.0104), Color(0.95, 0.93, 0.85), true))
	n._labels.append(MeshKit.label(n, "J", 0.00007, Vector3(L * 0.5, 0.0004, -2.0 * P - 0.0042), Color(0.95, 0.93, 0.85), true))
	# the readout plate on the front edge
	_box(n, Vector3(0.036, 0.0007, 0.0052), MeshKit.mat(Color(0.02, 0.03, 0.03), 0.4, 0.0, {"normal": 0.0}), Vector3(L * 0.5, 0.0033, 0.0112), 0.0003)
	var rd := MeshKit.label(n, "50.00 cm", 0.000048, Vector3(L * 0.5, 0.0038, 0.0112), Color(0.35, 1.0, 0.55), true)
	n.anim["readout"] = rd
	# the jockey: a brass bridge from the rail over the wire, a steel knife edge on the wire, a red knob
	var jock := Node3D.new(); n.add_child(jock); n.anim["jockey"] = jock
	var red := MeshKit.mat(Color(0.75, 0.10, 0.08), 0.45, 0.0, {"clearcoat": 0.3})
	_box(jock, Vector3(0.0046, 0.0022, 0.0116), rail, Vector3(0, 0.0112, -0.0052), 0.0005)
	_cyl(jock, 0.0017, 0.0058, rail, Vector3(0, 0.0084, 0.0), Vector3.ZERO, 16)
	_cyl(jock, 0.0040, 0.0050, red, Vector3(0, 0.0138, 0.0), Vector3.ZERO, 20)
	_box(jock, Vector3(0.0014, 0.0014, 0.0034), MeshKit.m("steel"), Vector3(0, 0.0054, 0.0), 0.0002)
	_box(jock, Vector3(0.0005, 0.0005, 0.0070), MeshKit.mat(Color(0.8, 0.05, 0.05), 0.5, 0.0, {"normal": 0.0}), Vector3(0, 0.0040, 0.0046), 0.0002)   # the cursor line across the ruler
	n.anim["len"] = L
	n.set_jockey(0.5)
	Instruments3D.hit(n, "slidewire", Vector3(L - 0.012, 0.014, 0.016), Vector3(L * 0.5, 0.0070, 0.0030))

## ------------------------------------------------------------------------------------------------ the null detector

## A centre-zero panel meter seen from above: the dial on the top face, a needle that swings to the engine's `needle` (-1..+1 of full scale),
## the engine's microamps printed on the dial. Posts at the pins: red + (pin 0) and black.
static func galvo(n: Part3D) -> void:
	# a squat meter lying between its two posts, on the pin row: the tickets run their wires round it
	var cz := 0.0
	var cx := 3.0 * P
	n._body(MeshKit.rounded_box(Vector3(0.0215, 0.0110, 0.0165), 0.0016), MeshKit.mat(Color(0.08, 0.09, 0.10), 0.45, 0.0, {"clearcoat": 0.3}), Vector3(cx, 0.0060, cz))
	_cyl(n, 0.0079, 0.0008, MeshKit.m("anodised"), Vector3(cx, 0.0119, cz), Vector3.ZERO, 32)
	_cyl(n, 0.0072, 0.0006, MeshKit.mat(Color(0.94, 0.93, 0.86), 0.7, 0.0, {"normal": 0.0}), Vector3(cx, 0.0124, cz), Vector3.ZERO, 32)
	var piv := Vector3(cx, 0.0129, cz + 0.0036)
	for k in range(-5, 6):
		var ang := deg_to_rad(float(k) * 10.0)
		var ln := 0.0016 if k % 5 == 0 else 0.0010
		var tk := MeshKit.add(n, BoxMesh.new(), MeshKit.mat(Color(0.75, 0.05, 0.05) if k == 0 else Color(0.08, 0.08, 0.08), 0.6, 0.0, {"normal": 0.0}), Vector3.ZERO)
		(tk.mesh as BoxMesh).size = Vector3(0.00026, 0.0002, ln)
		tk.position = piv + Vector3(sin(ang) * 0.0058, 0.0, -cos(ang) * 0.0058)
		tk.rotation.y = -ang
	var needle := Node3D.new(); n.add_child(needle); needle.position = piv + Vector3(0, 0.0004, 0)
	var nb := BoxMesh.new(); nb.size = Vector3(0.00040, 0.00040, 0.0066)
	MeshKit.add(needle, nb, MeshKit.mat(Color(0.85, 0.07, 0.05), 0.4, 0.0, {"normal": 0.0}), Vector3(0, 0, -0.0033))
	_cyl(needle, 0.0011, 0.0008, MeshKit.m("steel"), Vector3.ZERO, Vector3.ZERO, 16)
	n.anim["needle"] = needle
	_cyl(n, 0.0072, 0.0003, MeshKit.mat(Color(0.9, 0.95, 1.0), 0.05, 0.0, {"alpha": 0.14, "normal": 0.0, "rough_tex": false}), Vector3(cx, 0.0134, cz), Vector3.ZERO, 32)
	n._labels.append(MeshKit.label(n, "G", 0.00006, Vector3(cx, 0.0136, cz - 0.0030), Color(0.08, 0.08, 0.08), true))
	var rd := MeshKit.label(n, "0.0 µA", 0.000030, Vector3(cx, 0.0136, cz + 0.0062), Color(0.08, 0.08, 0.08), true)
	n.anim["readout"] = rd
	_post(n, 0.0, 0.0, 0.0065, Color(0.80, 0.12, 0.08)); _post(n, 6.0 * P, 0.0, 0.0065, Color(0.08, 0.08, 0.08))
	n._labels.append(MeshKit.label(n, "+", 0.0001, Vector3(0.0, 0.0004, 0.0052), Color(0.95, 0.3, 0.2)))

## ------------------------------------------------------------------------------------------------ cells and the rheostat

## A cell lying behind its two pads, + at pin 0: the 2 V driver of 2-2 (dark blue, yellow band) or the test cell of 2-4 (silver).
static func cell(n: Part3D, test: bool) -> void:
	var cz := 0.0
	var wrap := MeshKit.mat(Color(0.62, 0.66, 0.62) if test else Color(0.05, 0.09, 0.24), 0.35, 0.6 if test else 0.0, {"clearcoat": 0.4})
	n._body(_cylmesh(0.0066, 0.0210), wrap, Vector3(3.0 * P, 0.0078, cz), Vector3(0, 0, PI / 2))
	_cyl(n, 0.0025, 0.0030, MeshKit.m("steel"), Vector3(0.0045, 0.0078, cz), Vector3(0, 0, PI / 2), 16)              # the + nub
	_cyl(n, 0.0067, 0.0046, MeshKit.mat(Color(0.95, 0.75, 0.10) if not test else Color(0.10, 0.45, 0.20), 0.5, 0.0), Vector3(3.0 * P, 0.0078, cz), Vector3(0, 0, PI / 2))
	_cyl(n, 0.0065, 0.0012, MeshKit.m("steel"), Vector3(6.0 * P - 0.0046, 0.0078, cz), Vector3(0, 0, PI / 2), 20)     # the - end
	n._lead([Vector3(0, -T, 0), Vector3(0, 0.0035, 0), Vector3(0.0030, 0.0078, cz)])
	n._lead([Vector3(6.0 * P, -T, 0), Vector3(6.0 * P, 0.0035, 0), Vector3(6.0 * P - 0.0036, 0.0078, cz)])
	n._labels.append(MeshKit.label(n, "1.5 V" if test else "2 V", 0.00006, Vector3(3.0 * P, 0.0146, cz), Color(0.05, 0.05, 0.05) if test else Color(0.95, 0.95, 0.9), true))
	n._labels.append(MeshKit.label(n, "+", 0.0001, Vector3(0.0, 0.0004, 0.0050), Color(0.95, 0.3, 0.2)))
	n._labels.append(MeshKit.label(n, "−", 0.0001, Vector3(6.0 * P, 0.0004, 0.0050), Color(0.85, 0.85, 0.85)))

static func _cylmesh(r: float, h: float) -> CylinderMesh:
	var c := CylinderMesh.new(); c.top_radius = r; c.bottom_radius = r; c.height = h; c.radial_segments = 28
	return c

## A wirewound rheostat: a cream ceramic tube with a copper winding, a brass slider on a rail above it, a black knob.
static func rheostat(n: Part3D) -> void:
	var y := 0.0052
	var v := float(n.part.get("value", 0.0)) if n.part.get("value", null) != null else 0.0
	n._body(_cylmesh(0.0043, 0.0150), MeshKit.mat(Color(0.90, 0.86, 0.74), 0.8, 0.0, {"normal": 0.4}), Vector3(2.0 * P, y, 0), Vector3(0, 0, PI / 2))
	var cu := MeshKit.mat(Color(0.72, 0.38, 0.20), 0.35, 1.0)
	for i in 12: _cyl(n, 0.00455, 0.00065, cu, Vector3(2.0 * P - 0.0062 + float(i) * 0.00113, y, 0), Vector3(0, 0, PI / 2), 20)
	for s in [-1, 1]:
		_cyl(n, 0.0046, 0.0012, MeshKit.m("steel"), Vector3(2.0 * P + float(s) * 0.0078, y, 0), Vector3(0, 0, PI / 2), 20)
		_cyl(n, 0.0008, 0.0062, MeshKit.m("steel"), Vector3(2.0 * P + float(s) * 0.0078, y + 0.0031 + 0.0042, 0), Vector3.ZERO, 8)
	_box(n, Vector3(0.0170, 0.0012, 0.0016), MeshKit.m("steel"), Vector3(2.0 * P, y + 0.0070, 0), 0.0003)
	_box(n, Vector3(0.0036, 0.0046, 0.0032), _brass(), Vector3(2.0 * P + 0.0018, y + 0.0048, 0), 0.0006)
	_cyl(n, 0.0023, 0.0040, MeshKit.mat(Color(0.05, 0.05, 0.055), 0.5), Vector3(2.0 * P + 0.0018, y + 0.0098, 0), Vector3.ZERO, 16)
	n._labels.append(MeshKit.label(n, "RHEOSTAT %s" % NodeApi.format_value(v, "R").replace(" ", ""), 0.00004, Vector3(2.0 * P, 0.0003, 0.0078), Color(0.9, 0.9, 0.88)))
	n._axial_leads(y, 0.0086)

## ------------------------------------------------------------------------------------------------ chapter 3

## The textbook capacitor: a see-through tan box with two plates inside, the value on top.
static func ideal_cap(n: Part3D) -> void:
	n._body(MeshKit.rounded_box(Vector3(0.0140, 0.0100, 0.0066), 0.0012), MeshKit.mat(Color(0.80, 0.66, 0.42), 0.55, 0.0, {"alpha": 0.62, "normal": 0.0, "rough_tex": false}), Vector3(2.0 * P, 0.0065, 0))
	for s in [-1, 1]: _box(n, Vector3(0.0004, 0.0080, 0.0054), MeshKit.m("steel"), Vector3(2.0 * P + float(s) * 0.0019, 0.0065, 0), 0.0001)
	n._labels.append(MeshKit.label(n, str(n.part.get("label", "")), 0.00004, Vector3(2.0 * P, 0.0118, 0), Color(0.12, 0.10, 0.06), true))
	n._axial_leads(0.0065, 0.0070)

## 3-4 card (b): a squat blue can behind two brass studs, "4 µF 100 V" on its top and a charge gauge bar that follows the engine's volts.
static func charged_cap(n: Part3D) -> void:
	var cz := -0.0110
	n._body(_cylmesh(0.0105, 0.0160), MeshKit.mat(Color(0.08, 0.20, 0.55), 0.35, 0.0, {"clearcoat": 0.6}), Vector3(3.0 * P, 0.0090, cz))
	_cyl(n, 0.0085, 0.0004, MeshKit.m("brushed_alu"), Vector3(3.0 * P, 0.0172, cz), Vector3.ZERO, 28)
	n._labels.append(MeshKit.label(n, "4 µF", 0.00006, Vector3(3.0 * P, 0.0177, cz - 0.0030), Color(0.05, 0.05, 0.06), true))
	n._labels.append(MeshKit.label(n, "100 V", 0.00005, Vector3(3.0 * P, 0.0177, cz + 0.0008), Color(0.65, 0.05, 0.03), true))
	for i in 2:
		var x := float(i) * 6.0 * P
		_cyl(n, 0.0022, 0.0070, _brass(), Vector3(x, 0.0045, 0))
		n._lead([Vector3(x, -T, 0), Vector3(x, 0.002, 0)])
		var side := 1.0 if i == 0 else -1.0
		MeshKit.add(n, MeshKit.tube(MeshKit.round_corners(PackedVector3Array([Vector3(x, 0.0075, 0), Vector3(x + side * 0.0035, 0.0150, cz * 0.45), Vector3(3.0 * P - side * 0.0072, 0.0172, cz)]), 0.003, 3), 0.0008, 6), _brass())
	n._labels.append(MeshKit.label(n, "+", 0.0001, Vector3(0.0, 0.0004, 0.0050), Color(0.95, 0.3, 0.2)))
	# the charge gauge on the top plate: a dark slot with a green bar that fills from the left as the engine's volts rise
	_box(n, Vector3(0.0126, 0.0006, 0.0030), MeshKit.mat(Color(0.02, 0.02, 0.03), 0.4, 0.0, {"normal": 0.0}), Vector3(3.0 * P, 0.0176, cz + 0.0058), 0.0001)
	var root := Node3D.new(); n.add_child(root); root.position = Vector3(3.0 * P - 0.0060, 0.0180, cz + 0.0058)
	_box(root, Vector3(0.0120, 0.0004, 0.0022), MeshKit.mat(Color(0.30, 0.95, 0.45), 0.4, 0.0, {"emission": Color(0.2, 0.9, 0.4), "emission_energy": 1.2, "normal": 0.0}), Vector3(0.0060, 0, 0), 0.0001)
	n.anim["level"] = root
	n.set_level(1.0)

## The relay (3-3): a clear lid over the coil and a brass armature that drops onto the NO contact when the engine says it pulled in.
## Pins: C1 (0,0), C2 (0,4), COM (4,0), NO (4,2), NC (4,4).
static func relay(n: Part3D) -> void:
	n._body(MeshKit.rounded_box(Vector3(0.026, 0.0035, 0.026), 0.0006), MeshKit.mat(Color(0.10, 0.12, 0.30), 0.5), Vector3(2.0 * P, 0.0025, 2.0 * P))
	MeshKit.add(n, MeshKit.rounded_box(Vector3(0.0260, 0.0125, 0.0260), 0.0012), MeshKit.mat(Color(0.35, 0.55, 0.9), 0.1, 0.0, {"alpha": 0.30, "normal": 0.0, "rough_tex": false, "clearcoat": 1.0}), Vector3(2.0 * P, 0.0105, 2.0 * P))
	_cyl(n, 0.0050, 0.0120, MeshKit.mat(Color(0.78, 0.42, 0.20), 0.4, 0.9), Vector3(0.0050, 0.0085, 2.0 * P), Vector3(PI / 2, 0, 0), 20)   # the copper coil
	_cyl(n, 0.0017, 0.0150, MeshKit.m("steel"), Vector3(0.0050, 0.0085, 2.0 * P), Vector3(PI / 2, 0, 0), 12)
	var arm := Node3D.new(); n.add_child(arm); arm.position = Vector3(0.0050, 0.0140, 2.0 * P)
	_box(arm, Vector3(0.0150, 0.0006, 0.0046), _brass(), Vector3(0.0075, 0, 0), 0.0002)
	_cyl(arm, 0.0010, 0.0010, MeshKit.m("tin"), Vector3(0.0150, -0.0006, 0), Vector3.ZERO, 12)   # the contact tip
	n.anim["armature"] = arm
	_cyl(n, 0.0013, 0.0014, MeshKit.m("tin"), Vector3(0.0200, 0.0112, 2.0 * P), Vector3.ZERO, 12)   # NO contact
	_cyl(n, 0.0013, 0.0014, MeshKit.m("tin"), Vector3(0.0200, 0.0172, 2.0 * P), Vector3.ZERO, 12)   # NC contact
	for pin in NodeApi.FOOTPRINTS["relay5"]:
		n._lead([Vector3(float(pin[0]) * P, -T, float(pin[1]) * P), Vector3(float(pin[0]) * P, 0.0025, float(pin[1]) * P)], 0.0004)
	n._labels.append(MeshKit.label(n, "RELAY 12 V", 0.00005, Vector3(2.0 * P, 0.0170, 0.0045), Color(0.05, 0.05, 0.08), true))
	n._labels.append(MeshKit.label(n, "5 A", 0.00004, Vector3(2.0 * P, 0.0170, 0.0190), Color(0.05, 0.05, 0.08), true))
	for q in [["C1", -0.0060, 0.0], ["C2", -0.0060, 4.0 * P], ["COM", 0.0290, 0.0], ["NO", 0.0285, 2.0 * P], ["NC", 0.0285, 4.0 * P]]:
		n._labels.append(MeshKit.label(n, str(q[0]), 0.00004, Vector3(float(q[1]), 0.0003, float(q[2])), Color(0.9, 0.9, 0.88)))
	n.set_relay(false, 0.0)

## 3-2: the 10 kΩ pull-up, a fat chip resistor lying between its two pads.
static func pullup(n: Part3D) -> void:
	n._body(MeshKit.rounded_box(Vector3(0.0170, 0.0045, 0.0066), 0.0007), MeshKit.mat(Color(0.10, 0.10, 0.12), 0.6), Vector3(3.0 * P, 0.0035, 0))
	for s in [-1, 1]: _box(n, Vector3(0.0030, 0.0048, 0.0069), MeshKit.m("tin"), Vector3(3.0 * P + float(s) * 0.0070, 0.0035, 0), 0.0006)
	n._labels.append(MeshKit.label(n, "PULL-UP 10 kΩ", 0.000028, Vector3(3.0 * P, 0.0061, 0), Color(0.9, 0.9, 0.86), true))
	for i in 2: n._lead([Vector3(float(i) * 6.0 * P, -T, 0), Vector3(float(i) * 6.0 * P, 0.0015, 0), Vector3(3.0 * P + (-0.0085 if i == 0 else 0.0085), 0.0035, 0)])

## 3-2: the logic input, a little chip with its notch at pin 1 and "1 MΩ" printed on it.
static func logic_in(n: Part3D) -> void:
	n._body(MeshKit.rounded_box(Vector3(0.0170, 0.0035, 0.0090), 0.0006), MeshKit.m("black_epoxy"), Vector3(3.0 * P, 0.0045, 0))
	for i in 4:
		for s in [-1, 1]: _box(n, Vector3(0.0009, 0.0004, 0.0025), MeshKit.m("tin"), Vector3(3.0 * P - 0.0062 + float(i) * 0.0041, 0.0032, float(s) * 0.0055), 0.0001)
	_cyl(n, 0.0007, 0.0002, MeshKit.mat(Color(0.2, 0.2, 0.22), 0.6), Vector3(3.0 * P - 0.0070, 0.0064, -0.0028), Vector3.ZERO, 10)
	n._labels.append(MeshKit.label(n, "LOGIC IN", 0.000030, Vector3(3.0 * P, 0.0064, -0.0010), Color(0.7, 0.7, 0.72), true))
	n._labels.append(MeshKit.label(n, "1 MΩ", 0.000030, Vector3(3.0 * P, 0.0064, 0.0021), Color(0.7, 0.7, 0.72), true))
	for i in 2: n._lead([Vector3(float(i) * 6.0 * P, -T, 0), Vector3(float(i) * 6.0 * P, 0.002, 0), Vector3(3.0 * P + (-0.0085 if i == 0 else 0.0085), 0.0045, 0)])

## 2-2: the buried cable's loop, a reel of black cable with its two tails soldered to the pads; "X = ?" is the unknown.
static func cable_reel(n: Part3D) -> void:
	var o := MeshKit.mat(Color(0.88, 0.45, 0.08), 0.5, 0.0, {"clearcoat": 0.2})
	n._body(_cylmesh(0.0105, 0.0066), MeshKit.mat(Color(0.03, 0.03, 0.035), 0.7, 0.0, {"normal": 0.4}), Vector3(3.0 * P, 0.0050, 0))
	for k in 4: _cyl(n, 0.01065, 0.0005, MeshKit.mat(Color(0.12, 0.12, 0.14), 0.6), Vector3(3.0 * P, 0.0029 + float(k) * 0.0013, 0), Vector3.ZERO, 28)
	for yy in [0.0014, 0.0087]: _cyl(n, 0.0118, 0.0008, o, Vector3(3.0 * P, yy, 0), Vector3.ZERO, 28)
	_cyl(n, 0.0030, 0.0090, MeshKit.m("steel"), Vector3(3.0 * P, 0.0050, 0), Vector3.ZERO, 14)
	n._labels.append(MeshKit.label(n, "CABLE", 0.00005, Vector3(3.0 * P, 0.0093, -0.0010), Color(0.05, 0.04, 0.03), true))
	n._labels.append(MeshKit.label(n, "X = ?", 0.00005, Vector3(3.0 * P, 0.0093, 0.0035), Color(0.05, 0.04, 0.03), true))
	for i in 2:
		var s := 1.0 if i == 0 else -1.0
		var x := float(i) * 6.0 * P
		MeshKit.add(n, MeshKit.tube(MeshKit.round_corners(PackedVector3Array([Vector3(x, -T, 0), Vector3(x, 0.0030, 0), Vector3(x + s * 0.0035, 0.0040, 0), Vector3(x + s * 0.0100, 0.0040, 0)]), 0.0020, 4), 0.0009, 6), MeshKit.m("rubber"))

## ------------------------------------------------------------------------------------------------ chapters 4 and 5 (D-bench-ch45)

## 4-1's mains transformer (xfmr4: primary P1 P2 on the left column, secondary S1 S2 on the right): a laminated EI core round a
## bobbin wound in yellow tape, a steel clamp frame with its feet on the board, the four pins under it. The primary side sits in
## the keep-out square on the board.
static func transformer(n: Part3D) -> void:
	var c := Vector3(2.0 * P, 0.0, 2.0 * P)
	var lam := MeshKit.mat(Color(0.30, 0.31, 0.33), 0.45, 0.9, {"normal": 0.5})
	var core := Vector3(0.0270, 0.0190, 0.0200)
	n._body(MeshKit.rounded_box(core, 0.0003), lam, c + Vector3(0, 0.0030 + core.y * 0.5, 0))
	for k in 9:   # the lamination edges on the two faces the camera sees
		var zz := -core.z * 0.5 + 0.0012 + float(k) * (core.z - 0.0024) / 8.0
		_box(n, Vector3(core.x + 0.0002, core.y - 0.0010, 0.00025), MeshKit.mat(Color(0.20, 0.21, 0.22), 0.5, 0.9), c + Vector3(0, 0.0030 + core.y * 0.5, zz), 0.00005)
	# the winding window: yellow tape over the coil, a paper label with the ratio
	var tape := MeshKit.mat(Color(0.93, 0.78, 0.18), 0.55, 0.0, {"clearcoat": 0.2})
	n._body(MeshKit.rounded_box(Vector3(0.0130, core.y + 0.0016, core.z + 0.0030), 0.0012), tape, c + Vector3(0, 0.0030 + core.y * 0.5, 0))
	_box(n, Vector3(0.0110, 0.0004, 0.0150), MeshKit.mat(Color(0.95, 0.94, 0.90), 0.8), c + Vector3(0, 0.0030 + core.y + 0.0010, 0), 0.0002)
	n._labels.append(MeshKit.label(n, "230 V", 0.000040, c + Vector3(0, 0.0030 + core.y + 0.0013, -0.0035), Color(0.08, 0.08, 0.08), true))
	n._labels.append(MeshKit.label(n, "12 V", 0.000040, c + Vector3(0, 0.0030 + core.y + 0.0013, 0.0035), Color(0.08, 0.08, 0.08), true))
	# the clamp frame and its feet
	var steel := MeshKit.m("steel")
	for sx in [-1, 1]:
		_box(n, Vector3(0.0008, core.y + 0.0020, core.z + 0.0040), steel, c + Vector3(sx * (core.x * 0.5 + 0.0004), 0.0030 + core.y * 0.5, 0), 0.0002)
		for sz in [-1, 1]: _box(n, Vector3(0.0040, 0.0006, 0.0030), steel, c + Vector3(sx * (core.x * 0.5 + 0.0018), 0.0003, sz * (core.z * 0.5 - 0.0010)), 0.0002)
	# the pins: tinned leads from the bobbin down into the four pads, red marks on the primary side
	for o in NodeApi.FOOTPRINTS["xfmr4"]:
		var x := float(o[0]) * P; var z := float(o[1]) * P
		n._lead([Vector3(x, -T, z), Vector3(x, 0.0030, z), Vector3(c.x + (x - c.x) * 0.45, 0.0040, z)], 0.0005)
		if o[0] == 0: _cyl(n, 0.0011, 0.0004, MeshKit.mat(Color(0.75, 0.12, 0.08), 0.5), Vector3(x, 0.0004, z), Vector3.ZERO, 12)

## The bench's electronic load (4-1 to 4-4: "Load, constant current"): a small module on a finned black heatsink, two screw
## terminals on its pins, a set-current trimmer and the words CC LOAD. It draws what the ticket's LOAD key says.
static func cc_load(n: Part3D) -> void:
	var L := 6.0 * P
	var sink := MeshKit.m("anodised")
	n._body(MeshKit.rounded_box(Vector3(L - 0.004, 0.0040, 0.0150), 0.0006), sink, Vector3(L * 0.5, 0.0030, -0.0010))
	for k in 7:   # fins
		var x := 0.0040 + float(k) * (L - 0.0080) / 6.0
		_box(n, Vector3(0.0010, 0.0080, 0.0150), sink, Vector3(x, 0.0090, -0.0010), 0.0002)
	_box(n, Vector3(L - 0.008, 0.0012, 0.0080), MeshKit.m("fr4"), Vector3(L * 0.5, 0.0056, 0.0080), 0.0003)   # the control board in front
	_cyl(n, 0.0018, 0.0020, MeshKit.mat(Color(0.12, 0.30, 0.70), 0.5), Vector3(L * 0.5, 0.0072, 0.0080), Vector3.ZERO, 16)   # set-current trimmer
	_box(n, Vector3(0.0022, 0.0003, 0.0004), MeshKit.mat(Color(0.9, 0.9, 0.9), 0.5), Vector3(L * 0.5, 0.0083, 0.0080), 0.0001)
	n._labels.append(MeshKit.label(n, "CC LOAD", 0.000040, Vector3(L * 0.5, 0.0064, 0.0112), Color(0.92, 0.92, 0.88), true))
	var tm := MeshKit.mat(Color(0.10, 0.36, 0.62), 0.5, 0.0)
	for i in 2:
		var x := float(i) * L
		_box(n, Vector3(0.0070, 0.0080, 0.0070), tm, Vector3(x, 0.0040, 0.0), 0.0006)
		_cyl(n, 0.0016, 0.0008, MeshKit.m("steel"), Vector3(x, 0.0084, 0.0), Vector3.ZERO, 14)
		_box(n, Vector3(0.0026, 0.0004, 0.0005), MeshKit.mat(Color(0.1, 0.1, 0.1), 0.6), Vector3(x, 0.0090, 0.0), 0.0001)
		n._lead([Vector3(x, -T, 0), Vector3(x, 0.0020, 0)])
	n._labels.append(MeshKit.label(n, "+", 0.00008, Vector3(0.0, 0.0004, -0.0060), Color(0.95, 0.35, 0.25), true))

## 5-1's fan connection: the fan's red and black leads come in over the board edge and are soldered into + and -, with a
## cable tie where they meet. The fan itself stands on the bench.
static func fan_leads(n: Part3D) -> void:
	var L := 6.0 * P
	var cols := [Color(0.75, 0.10, 0.08), Color(0.05, 0.05, 0.055)]
	for i in 2:
		var x := float(i) * L
		var m := MeshKit.mat(cols[i], 0.55, 0.0, {"clearcoat": 0.2})
		var pts := PackedVector3Array([Vector3(x, -T, 0), Vector3(x, 0.0025, 0), Vector3(x, 0.0035, -0.0040), Vector3(L * 0.5 + (float(i) - 0.5) * 0.0024, 0.0035, -0.0100), Vector3(L * 0.5 + (float(i) - 0.5) * 0.0024, 0.0035, -0.0220)])
		MeshKit.add(n, MeshKit.tube(MeshKit.round_corners(pts, 0.0030, 4), 0.0009, 8), m)
		n._body(MeshKit.rounded_box(Vector3(0.0034, 0.0022, 0.0034), 0.0008), MeshKit.m("solder"), Vector3(x, 0.0011, 0))
	_box(n, Vector3(0.0070, 0.0026, 0.0018), MeshKit.mat(Color(0.88, 0.88, 0.84), 0.6), Vector3(L * 0.5, 0.0035, -0.0130), 0.0004)   # cable tie
	n._labels.append(MeshKit.label(n, "FAN +", 0.000045, Vector3(0.0, 0.0003, 0.0060), Color(0.92, 0.92, 0.88), true))
	n._labels.append(MeshKit.label(n, "FAN -", 0.000045, Vector3(L, 0.0003, 0.0060), Color(0.92, 0.92, 0.88), true))

## 5-2's 12 V LED strip: a length of white flex strip between its two solder pads, three 5050 LEDs and their resistor on it. The
## LEDs light with the strip current the engine reports (Part3D.set_strip).
static func led_strip(n: Part3D) -> void:
	var L := 6.0 * P
	n._body(MeshKit.rounded_box(Vector3(L + 0.0040, 0.0006, 0.0100), 0.0002), MeshKit.mat(Color(0.95, 0.95, 0.93), 0.5, 0.0, {"clearcoat": 0.3}), Vector3(L * 0.5, 0.0030, 0))
	_box(n, Vector3(L - 0.0020, 0.0002, 0.0010), MeshKit.m("copper"), Vector3(L * 0.5, 0.0034, -0.0036), 0.00005)
	_box(n, Vector3(L - 0.0020, 0.0002, 0.0010), MeshKit.m("copper"), Vector3(L * 0.5, 0.0034, 0.0036), 0.00005)
	var leds: Array = []
	for k in 3:
		var x := L * (0.2 + 0.25 * float(k))
		_box(n, Vector3(0.0050, 0.0014, 0.0050), MeshKit.mat(Color(0.96, 0.96, 0.94), 0.4), Vector3(x, 0.0040, 0), 0.0003)
		var lens := MeshKit.mat(Color(0.98, 0.95, 0.80), 0.15, 0.0, {"emission": Color(1.0, 0.92, 0.75), "emission_energy": 0.0, "normal": 0.0})
		leds.append(_cyl(n, 0.0019, 0.0004, lens, Vector3(x, 0.0048, 0), Vector3.ZERO, 16))
	_box(n, Vector3(0.0030, 0.0008, 0.0016), MeshKit.m("black_epoxy"), Vector3(L * 0.92, 0.0037, 0), 0.0002)   # the strip's own resistor
	n.anim["strip"] = leds
	for i in 2:
		var x := float(i) * L
		n._lead([Vector3(x, -T, 0), Vector3(x, 0.0032, 0)], 0.0005)
		_box(n, Vector3(0.0030, 0.0008, 0.0040), MeshKit.m("solder"), Vector3(x, 0.0036, 0), 0.0003)
	n._labels.append(MeshKit.label(n, "12V", 0.000040, Vector3(L * 0.55, 0.0035, 0.0040), Color(0.15, 0.15, 0.15), true))

## 5-4 and 6-4: the next stage's input (the synth's amplifier, the cleaner's piezo driver), a 6.35 mm jack on a small panel. The panel says
## "IN 47 k" (0.7: it said "AMP IN", wrong for 6-4's cleaner).
static func amp_input(n: Part3D) -> void:
	var L := 6.0 * P
	n._body(MeshKit.rounded_box(Vector3(L + 0.0040, 0.0016, 0.0130), 0.0005), MeshKit.m("brushed_alu"), Vector3(L * 0.5, 0.0060, 0))
	_cyl(n, 0.0060, 0.0050, MeshKit.m("black_plastic"), Vector3(L * 0.5, 0.0030, 0), Vector3.ZERO, 24)   # the jack body under the panel
	_cyl(n, 0.0048, 0.0020, MeshKit.m("steel"), Vector3(L * 0.5, 0.0077, 0), Vector3.ZERO, 6)            # the nut
	_cyl(n, 0.0036, 0.0030, MeshKit.mat(Color(0.82, 0.83, 0.85), 0.2, 1.0), Vector3(L * 0.5, 0.0083, 0), Vector3.ZERO, 24)
	_cyl(n, 0.0021, 0.0034, MeshKit.mat(Color(0.01, 0.01, 0.01), 0.9), Vector3(L * 0.5, 0.0085, 0), Vector3.ZERO, 20)   # the socket hole
	n._labels.append(MeshKit.label(n, "IN  47 k", 0.000040, Vector3(L * 0.5, 0.0069, 0.0052), Color(0.08, 0.08, 0.08), true))
	for i in 2:
		var x := float(i) * L
		n._lead([Vector3(x, -T, 0), Vector3(x, 0.0050, 0), Vector3(L * 0.5 + (x - L * 0.5) * 0.3, 0.0050, 0)], 0.0005)

## ------------------------------------------------------------------------------------------------ chapter 6 (0.7)

## 6-5: the incubator's NTC probe. A steel sleeve with the black thermistor bead at its tip lies along the footprint; two leads run
## from the sleeve's back into the two pads. The label says what it is: 10 k at 25 C.
static func ntc_probe(n: Part3D) -> void:
	var L := 6.0 * P
	var steel := MeshKit.mat(Color(0.74, 0.75, 0.77), 0.25, 1.0)
	n._body(MeshKit.tube(PackedVector3Array([Vector3(L * 0.22, 0.0062, 0.0050), Vector3(L * 0.86, 0.0062, 0.0050)]), 0.0026, 18), steel)
	var bead := SphereMesh.new(); bead.radius = 0.0030; bead.height = 0.0056
	MeshKit.add(n, bead, MeshKit.mat(Color(0.05, 0.05, 0.05), 0.35, 0.0, {"clearcoat": 0.6}), Vector3(L * 0.90, 0.0062, 0.0050))
	_cyl(n, 0.0031, 0.0040, MeshKit.m("black_plastic"), Vector3(L * 0.20, 0.0062, 0.0050), Vector3(0, 0, PI / 2), 18)   # the strain relief
	n._labels.append(MeshKit.label(n, "NTC 10 k", 0.000045, Vector3(L * 0.55, 0.0089, 0.0050), Color(0.10, 0.10, 0.11), true))
	for i in 2:
		var x := float(i) * L
		n._lead([Vector3(x, -T, 0), Vector3(x, 0.0040, 0), Vector3(L * 0.16, 0.0060, 0.0050)], 0.0005)
