class_name Mcu3D
extends Node3D
## Small blue microcontroller dev board, unbranded, drawn at 2x real (~36 x 90 mm). Lies flat; origin on the desk under the board centre.

const BW := 0.036
const BL := 0.09
const BT := 0.0032
const BOT := 0.0028          ## board underside above the desk (header plastic)
const TOP := BOT + BT
const HP := 0.00508          ## header pitch at 2x
const NPIN := 15
const PIN_ROW_X := 0.0155
const PIN_IDX := 3           ## which right-hand header pin the lead leaves from

var _mode := "low"
var _powered := true
var _pin_mat: StandardMaterial3D
var _pwr_mat: StandardMaterial3D
var _pin_light: OmniLight3D
var _pwr_light: OmniLight3D
var _t := 0.0
var _pin_tip: Node3D

func _pin_z(i: int) -> float: return (float(i) - float(NPIN - 1) * 0.5) * HP

func _init() -> void:
	var blue := MeshKit.mat(Color(0.04, 0.16, 0.46), 0.3, 0.0, {"clearcoat": 0.7, "clearcoat_rough": 0.1, "normal": 0.04})
	MeshKit.add(self, MeshKit.rounded_box(Vector3(BW, BT, BL), 0.0016, 2), blue, Vector3(0, BOT + BT * 0.5, 0))
	# mounting holes
	for hx in [-0.0155, 0.0155]:
		for hz in [-0.0415, 0.0415]:
			Instruments3D.cyl(self, 0.0021, 0.0006, MeshKit.m("gold"), Vector3(hx, TOP + 0.0002, hz), Vector3.ZERO, 16)
			Instruments3D.cyl(self, 0.0012, 0.0008, MeshKit.m("black_epoxy"), Vector3(hx, TOP + 0.0003, hz), Vector3.ZERO, 12)
	# USB-C at the -Z end
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.018, 0.0066, 0.0148), 0.0028, 3), MeshKit.m("steel"), Vector3(0, TOP + 0.0033, -BL * 0.5 + 0.0058))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0145, 0.0026, 0.002), 0.0012, 2), MeshKit.m("black_epoxy"), Vector3(0, TOP + 0.0033, -BL * 0.5 - 0.0015))
	# QFP chip with legs
	var cz := 0.006
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0165, 0.0024, 0.0165), 0.0006, 2), MeshKit.m("black_epoxy"), Vector3(0, TOP + 0.0012, cz))
	Instruments3D.cyl(self, 0.0008, 0.0003, MeshKit.mat(Color(0.18, 0.18, 0.2), 0.4), Vector3(-0.005, TOP + 0.0025, cz + 0.005), Vector3.ZERO, 12)
	var legs := MultiMeshInstance3D.new(); var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
	var bm := BoxMesh.new(); bm.size = Vector3(0.0009, 0.0004, 0.0028); mm.mesh = bm
	mm.instance_count = 48
	var li := 0
	for side in 4:
		for k in 12:
			var o := (float(k) - 5.5) * 0.00128
			var tr := Transform3D(Basis(Vector3.UP, side * PI / 2.0), Vector3.ZERO)
			var off := tr.basis * Vector3(o, 0, 0.0095)
			mm.set_instance_transform(li, Transform3D(tr.basis, Vector3(off.x, TOP + 0.0004, cz + off.z))); li += 1
	legs.multimesh = mm; legs.material_override = MeshKit.m("tin"); add_child(legs)
	# pin headers: black plastic below, gold pins up through the board
	var pins := MultiMeshInstance3D.new(); var pm := MultiMesh.new(); pm.transform_format = MultiMesh.TRANSFORM_3D
	var pb := BoxMesh.new(); pb.size = Vector3(0.0013, 0.0092, 0.0013); pm.mesh = pb; pm.instance_count = NPIN * 2
	for r in 2:
		var sx := -1.0 if r == 0 else 1.0
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0052, 0.0026, HP * NPIN), 0.0004, 1), MeshKit.m("black_plastic"), Vector3(sx * PIN_ROW_X, BOT * 0.5 + 0.0003, 0))
		for i in NPIN:
			pm.set_instance_transform(r * NPIN + i, Transform3D(Basis.IDENTITY, Vector3(sx * PIN_ROW_X, TOP + 0.0092 * 0.5 - 0.0028 + 0.0016, _pin_z(i))))
	pins.multimesh = pm; pins.material_override = MeshKit.m("gold"); add_child(pins)
	_pin_tip = Node3D.new(); _pin_tip.position = Vector3(PIN_ROW_X, TOP + 0.008, _pin_z(PIN_IDX)); add_child(_pin_tip)
	Instruments3D.hit(self, "mcu_pin", Vector3(0.012, 0.014, 0.016), Vector3(PIN_ROW_X, TOP + 0.005, _pin_z(PIN_IDX)))
	# small parts: crystal, regulator, buttons, caps, resistors
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0088, 0.0028, 0.0042), 0.0012, 2), MeshKit.m("steel"), Vector3(0.0, TOP + 0.0014, 0.0285))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0085, 0.0028, 0.0075), 0.0004, 1), MeshKit.m("black_epoxy"), Vector3(-0.007, TOP + 0.0014, -0.022))
	for k in 2:
		var bx := -0.0085 if k == 0 else 0.0085
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0072, 0.0036, 0.0072), 0.0008, 2), MeshKit.m("black_plastic"), Vector3(bx, TOP + 0.0018, 0.0385))
		Instruments3D.cyl(self, 0.0021, 0.0014, MeshKit.m("steel"), Vector3(bx, TOP + 0.0043, 0.0385), Vector3.ZERO, 14)
	var tan := MeshKit.mat(Color(0.55, 0.42, 0.26), 0.4, 0.2, {"normal": 0.0})
	for p in [Vector3(0.0075, 0, -0.025), Vector3(0.0075, 0, -0.0195), Vector3(-0.011, 0, 0.022), Vector3(0.011, 0, 0.0145)]:
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0036, 0.0022, 0.0022), 0.0005, 1), tan, p + Vector3(0, TOP + 0.0011, 0))
	for p in [Vector3(-0.011, 0, 0.0145), Vector3(0.0105, 0, 0.022), Vector3(0.0045, 0, -0.0125)]:
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0034, 0.0014, 0.0017), 0.0003, 1), MeshKit.m("black_epoxy"), p + Vector3(0, TOP + 0.0007, 0))
	# LEDs
	_pwr_mat = MeshKit.mat(Color(0.05, 0.3, 0.1), 0.3, 0.0, {"emission": Color(0.15, 1.0, 0.3), "emission_energy": 3.0, "normal": 0.0, "rough_tex": false})
	_pin_mat = MeshKit.mat(Color(0.5, 0.2, 0.1), 0.3, 0.0, {"emission": Color(1.0, 0.45, 0.2), "emission_energy": 0.0, "normal": 0.0, "rough_tex": false})
	var lz := -0.0095
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0046, 0.0016, 0.0026), 0.0005, 1), _pwr_mat, Vector3(-0.0105, TOP + 0.0008, lz))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0046, 0.0016, 0.0026), 0.0005, 1), _pin_mat, Vector3(0.0105, TOP + 0.0008, lz))
	MeshKit.label(self, "PWR", 0.00005, Vector3(-0.0105, TOP + 0.0004, lz + 0.0032), MeshKit.m("silk").albedo_color, true, Vector3(-PI / 2, 0, 0))
	MeshKit.label(self, "PIN", 0.00005, Vector3(0.0105, TOP + 0.0004, lz + 0.0032), MeshKit.m("silk").albedo_color, true, Vector3(-PI / 2, 0, 0))
	MeshKit.label(self, "RST", 0.00004, Vector3(-0.0085, TOP + 0.0004, 0.0322), MeshKit.m("silk").albedo_color, true, Vector3(-PI / 2, 0, 0))
	MeshKit.label(self, "BOOT", 0.00004, Vector3(0.0085, TOP + 0.0004, 0.0322), MeshKit.m("silk").albedo_color, true, Vector3(-PI / 2, 0, 0))
	_pwr_light = OmniLight3D.new(); _pwr_light.light_color = Color(0.2, 1.0, 0.35); _pwr_light.omni_range = 0.06; _pwr_light.light_energy = 0.03
	_pwr_light.position = Vector3(-0.0105, TOP + 0.006, lz); add_child(_pwr_light)
	_pin_light = OmniLight3D.new(); _pin_light.light_color = Color(1.0, 0.5, 0.25); _pin_light.omni_range = 0.06; _pin_light.light_energy = 0.0
	_pin_light.position = Vector3(0.0105, TOP + 0.006, lz); add_child(_pin_light)
	set_pin_mode("low")

func _process(delta: float) -> void:
	_t += delta
	_apply()

func _apply() -> void:
	var b := 0.0
	if _powered:
		match _mode:
			"high": b = 1.0
			"100 Hz": b = 0.5 * (0.92 + 0.08 * sin(_t * 61.0))   ## a real 100 Hz blink is invisible: half brightness
	_pin_mat.emission_energy_multiplier = 3.2 * b
	_pin_mat.albedo_color = Color(0.5, 0.2, 0.1).lerp(Color(1.0, 0.55, 0.3), b)
	_pin_light.light_energy = 0.04 * b
	_pwr_mat.emission_energy_multiplier = 3.0 if _powered else 0.0
	_pwr_light.light_energy = 0.03 if _powered else 0.0

func set_pin_mode(mode: String) -> void:
	_mode = mode; _apply()

func set_powered(on: bool) -> void:
	_powered = on; _apply()

## World position of the header pin where a lead leaves (top of the pin).
func pin_world() -> Vector3:
	return _pin_tip.global_position
