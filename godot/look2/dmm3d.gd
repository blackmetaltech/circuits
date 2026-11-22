class_name Dmm3D
extends Node3D
## Handheld multimeter, ~9 x 18 x 4 cm, dark grey body in a muted yellow rubber holster, leaning back on its kickstand.

const TILT := -28.0   ## degrees from upright (top leans back)
const MODES := {"OFF": -60.0, "V": -20.0, "mA": 20.0, "Ω": 60.0}
const DIAL_Y := -0.03

var _lcd: Instruments3D.SegPanel
var _dial: Node3D
var _tilt: Node3D
var _unit := ""
var _mode := "OFF"

func _init() -> void:
	_tilt = Node3D.new(); _tilt.position = Vector3(0, 0.097, 0); _tilt.rotation_degrees.x = TILT; add_child(_tilt)
	var yellow := MeshKit.mat(Color(0.64, 0.5, 0.11), 0.78, 0.0, {"normal": 0.35})
	var grey := MeshKit.mat(Color(0.17, 0.175, 0.185), 0.5, 0.0, {"normal": 0.12})
	# holster: rubber back and corner lips wrapping round the body
	MeshKit.add(_tilt, MeshKit.rounded_box(Vector3(0.096, 0.188, 0.034), 0.009, 3), yellow, Vector3(0, 0, -0.005))
	for sy in [-1, 1]:
		MeshKit.add(_tilt, MeshKit.rounded_box(Vector3(0.096, 0.022, 0.041), 0.009, 3), yellow, Vector3(0, sy * 0.083, -0.002))
	MeshKit.add(_tilt, MeshKit.rounded_box(Vector3(0.088, 0.172, 0.036), 0.007, 3), grey, Vector3(0, 0, 0.002))
	var z0 := 0.02
	# LCD window
	MeshKit.add(_tilt, MeshKit.rounded_box(Vector3(0.07, 0.036, 0.003), 0.003, 2), MeshKit.m("black_epoxy"), Vector3(0, 0.05, z0))
	var lcd := Instruments3D.SegPanel.new(); _lcd = lcd
	lcd.digit_area = Rect2(52, 28, 292, 150); lcd.ndig = 4; lcd.ghost_col = Color(0.05, 0.07, 0.05, 0.07)
	Instruments3D.screen_quad(_tilt, lcd, Vector2i(480, 220), Vector2(0.062, 0.0284), Vector3(0, 0.05, z0 + 0.0017), 0.0, true)
	# function buttons
	var bm := MeshKit.mat(Color(0.07, 0.07, 0.075), 0.55, 0.0, {"normal": 0.0})
	for i in 4:
		MeshKit.add(_tilt, MeshKit.rounded_box(Vector3(0.0155, 0.0085, 0.004), 0.0018, 2), bm, Vector3(-0.0285 + i * 0.019, 0.02, z0 + 0.0015))
	for i in 4:
		MeshKit.label(_tilt, ["HOLD", "RANGE", "REL", "Hz"][i], 0.000046, Vector3(-0.0285 + i * 0.019, 0.0135, z0 + 0.0001), Color(0.6, 0.62, 0.64), false, Vector3.ZERO)
	# dial: knurled disc, white pointer, mode marks
	var ring := MeshKit.mat(Color(0.1, 0.105, 0.11), 0.5, 0.0, {"normal": 0.1})
	_dial = Instruments3D.knob(_tilt, Vector3(0, DIAL_Y, z0), 0.0245, 0.013, ring, MeshKit.mat(Color(0.14, 0.145, 0.15), 0.4, 0.2, {"normal": 0.0, "rough_tex": false}), Color(0.95, 0.95, 0.9))
	for k in MODES:
		var a := deg_to_rad(float(MODES[k]))
		var p := Vector3(sin(a), cos(a), 0) * 0.0375 + Vector3(0, DIAL_Y, z0 + 0.0001)
		MeshKit.label(_tilt, k, 0.000062, p, Color(0.9, 0.9, 0.86), false, Vector3.ZERO)
		MeshKit.add(_tilt, MeshKit.rounded_box(Vector3(0.0012, 0.004, 0.0004), 0.0002, 1), MeshKit.m("silk"), Vector3(sin(a), cos(a), 0) * 0.0305 + Vector3(0, DIAL_Y, z0 + 0.0002), Vector3(0, 0, -a))
	Instruments3D.hit(_tilt, "dmm_dial", Vector3(0.056, 0.056, 0.03), Vector3(0, DIAL_Y, z0 + 0.006))
	# jacks
	for k in 2:
		var jx := -0.02 if k == 0 else 0.02
		var jm := MeshKit.mat(Color(0.75, 0.07, 0.06) if k == 0 else Color(0.04, 0.04, 0.045), 0.35, 0.0, {"normal": 0.0})
		Instruments3D.cyl(_tilt, 0.0068, 0.007, jm, Vector3(jx, -0.076, z0 + 0.0035), Vector3(PI / 2, 0, 0))
		Instruments3D.cyl(_tilt, 0.0036, 0.0074, MeshKit.m("black_epoxy"), Vector3(jx, -0.076, z0 + 0.0037), Vector3(PI / 2, 0, 0), 16)
		Instruments3D.cyl(_tilt, 0.0044, 0.0008, MeshKit.m("gold"), Vector3(jx, -0.076, z0 + 0.0074), Vector3(PI / 2, 0, 0), 16)
		MeshKit.label(_tilt, "V Ω mA" if k == 0 else "COM", 0.000055, Vector3(jx, -0.0645, z0 + 0.0001), Color(0.85, 0.85, 0.82), false, Vector3.ZERO)
	# kickstand, a flat plate swung out from near the top of the back to the desk
	var hinge := Transform3D(Basis(Vector3.RIGHT, deg_to_rad(TILT)), _tilt.position) * Vector3(0, 0.0, -0.025)
	var tip := Vector3(0, 0.002, hinge.z - 0.062)
	var d := tip - hinge
	var ks := MeshKit.add(self, MeshKit.rounded_box(Vector3(0.05, d.length(), 0.003), 0.0012, 2), MeshKit.m("black_plastic"), (hinge + tip) * 0.5)
	ks.rotation.x = atan2(d.z, d.y) + PI
	set_dial("OFF"); set_reading("", "", "OFF")

func set_reading(text: String, unit: String, mode: String) -> void:
	_unit = unit; _mode = mode
	_lcd.lit = mode != "OFF"
	_lcd.text = text
	_lcd.extras = []
	if mode != "OFF":
		_lcd.extras.append([unit, Vector2(368, 168), 74, Color(0.05, 0.07, 0.05), false])
		if mode == "V" or mode == "mA": _lcd.extras.append(["DC", Vector2(18, 26), 22, Color(0.05, 0.07, 0.05), false])
		_lcd.extras.append(["AUTO", Vector2(380, 26), 18, Color(0.05, 0.07, 0.05, 0.85), false])
	_lcd.queue_redraw()

func set_dial(mode: String) -> void:
	var a: float = MODES.get(mode, MODES["OFF"])
	_dial.rotation.z = -deg_to_rad(a)
