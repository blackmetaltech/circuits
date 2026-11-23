class_name Psu3D
extends Node3D
## Linear bench supply, ~13 x 16 x 28 cm: dark anodised front panel, red 7-segment V and A displays, two knobs, binding posts, OUTPUT button.

const W := 0.13
const H := 0.152
const D := 0.28
const FOOT := 0.008
const CY := FOOT + H * 0.5
const Z0 := D * 0.5 - 0.002   ## front panel face

var _vpanel: Instruments3D.SegPanel
var _apanel: Instruments3D.SegPanel
var _led: MeshInstance3D
var _led_mat: StandardMaterial3D
var _led_light: OmniLight3D
var _posts: Array = []

func _make_panel() -> Instruments3D.SegPanel:
	var p := Instruments3D.SegPanel.new()
	p.ndig = 4; p.bg_col = Color(0.025, 0.004, 0.004); p.bg_col2 = p.bg_col
	p.on_col = Color(1.0, 0.16, 0.08); p.ghost_col = Color(0.35, 0.04, 0.02, 0.16); p.glow = true
	p.digit_area = Rect2(22, 20, 176, 88); p.shear = 0.1
	return p

func _init() -> void:
	var shell := MeshKit.mat(Color(0.11, 0.115, 0.125), 0.5, 0.4, {"normal": 0.1})
	MeshKit.add(self, MeshKit.rounded_box(Vector3(W, H, D - 0.006), 0.006, 3), shell, Vector3(0, CY, -0.003))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(W - 0.004, H - 0.004, 0.006), 0.003, 2), MeshKit.m("anodised"), Vector3(0, CY, D * 0.5 - 0.005))
	for fx in [-0.05, 0.05]:
		for fz in [-0.1, 0.1]:
			MeshKit.add(self, MeshKit.rounded_box(Vector3(0.026, FOOT, 0.026), 0.003, 2), MeshKit.m("rubber"), Vector3(fx, FOOT * 0.5, fz))
	for i in 14:
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.09, 0.0012, 0.0032), 0.0005, 1), MeshKit.m("black_plastic"), Vector3(0, CY + H * 0.5, -0.06 + i * 0.0085))
	# two displays
	for k in 2:
		var x := -0.031 if k == 0 else 0.031
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.056, 0.03, 0.003), 0.003, 2), MeshKit.m("black_epoxy"), Vector3(x, CY + 0.04, Z0 + 0.0))
		var p := _make_panel()
		if k == 0: _vpanel = p
		else: _apanel = p
		p.extras = [["V" if k == 0 else "A", Vector2(204, 106), 30, Color(1.0, 0.16, 0.08, 0.9), false]]
		p.size = Vector2(256, 128)
		Instruments3D.screen_quad(self, p, Vector2i(256, 128), Vector2(0.05, 0.025), Vector3(x, CY + 0.04, Z0 + 0.0016), 4.0, true)
		MeshKit.label(self, "VOLTS" if k == 0 else "AMPS", 0.00006, Vector3(x, CY + 0.0615, Z0 + 0.0001), Color(0.6, 0.62, 0.64), false, Vector3.ZERO)
	# knobs
	var cap := MeshKit.mat(Color(0.2, 0.21, 0.22), 0.3, 0.9, {"normal": 0.0, "rough_tex": false})
	for k in 2:
		var x := -0.032 if k == 0 else 0.032
		Instruments3D.knob(self, Vector3(x, CY - 0.0065, Z0), 0.0185, 0.02, MeshKit.m("anodised"), cap)
		MeshKit.label(self, "VOLTAGE" if k == 0 else "CURRENT", 0.00006, Vector3(x, CY - 0.0065 - 0.0255, Z0 + 0.0001), Color(0.6, 0.62, 0.64), false, Vector3.ZERO)
		if k == 0: Instruments3D.hit(self, "psu_volt", Vector3(0.04, 0.04, 0.03), Vector3(x, CY - 0.0065, Z0 + 0.01))   # wheel sets the volts
	# OUTPUT button with ring LED
	var bx := -0.043; var by := CY - 0.0525
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0205, 0.0125, 0.007), 0.0025, 2), MeshKit.mat(Color(0.07, 0.07, 0.075), 0.45, 0.0, {"normal": 0.0}), Vector3(bx, by, Z0 + 0.0035))
	_led_mat = MeshKit.mat(Color(0.05, 0.2, 0.08), 0.35, 0.0, {"emission": Color(0.1, 1.0, 0.25), "emission_energy": 0.0, "normal": 0.0, "rough_tex": false})
	var tm := TorusMesh.new(); tm.inner_radius = 0.0155; tm.outer_radius = 0.0172; tm.rings = 40; tm.ring_segments = 8
	_led = MeshKit.add(self, tm, _led_mat, Vector3(bx, by, Z0 + 0.0008), Vector3(PI / 2, 0, 0))
	_led_light = OmniLight3D.new(); _led_light.light_color = Color(0.2, 1.0, 0.35); _led_light.omni_range = 0.12; _led_light.light_energy = 0.0
	_led_light.position = Vector3(bx, by, Z0 + 0.02); add_child(_led_light)
	MeshKit.label(self, "OUTPUT", 0.00006, Vector3(bx, by - 0.0215, Z0 + 0.0001), Color(0.6, 0.62, 0.64), false, Vector3.ZERO)
	Instruments3D.hit(self, "psu_output", Vector3(0.036, 0.03, 0.02), Vector3(bx, by, Z0 + 0.008))
	# TEST key (phase C: the bench test lives on the supply, beside OUTPUT)
	var tx := -0.0205; var ty := CY - 0.0525   # between OUTPUT and the red post
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0185, 0.0110, 0.006), 0.0025, 2), MeshKit.mat(Color(0.62, 0.38, 0.08), 0.45, 0.0, {"normal": 0.0}), Vector3(tx, ty, Z0 + 0.003))
	MeshKit.label(self, "TEST", 0.00006, Vector3(tx, ty, Z0 + 0.0062), Color(0.08, 0.06, 0.03), false, Vector3.ZERO)
	Instruments3D.hit(self, "psu_test", Vector3(0.019, 0.014, 0.02), Vector3(tx, ty, Z0 + 0.008))
	# binding posts: red +, black - (COM), and a blue - for the second rail of a dual supply (chapter 6: +-12 V), shown only on those tickets
	for k in 3:
		var px := [0.0, 0.035, 0.052][k] as float
		var py := CY - 0.0525
		var grp := Node3D.new(); add_child(grp); _post_groups.append(grp)
		var col := MeshKit.mat([Color(0.55, 0.035, 0.03), Color(0.035, 0.035, 0.04), Color(0.05, 0.16, 0.48)][k] as Color, 0.4, 0.0, {"normal": 0.05})
		Instruments3D.cyl(grp, 0.0092, 0.004, MeshKit.m("steel"), Vector3(px, py, Z0 + 0.002), Vector3(PI / 2, 0, 0))
		Instruments3D.cyl(grp, 0.0075, 0.012, col, Vector3(px, py, Z0 + 0.006), Vector3(PI / 2, 0, 0))
		var kn := Node3D.new(); kn.position = Vector3(px, py, Z0 + 0.0125); kn.rotation.x = PI / 2; grp.add_child(kn)
		MeshKit.add(kn, Instruments3D.knurl_mesh(0.0076, 0.0085, 0.009, 18), col, Vector3(0, 0.0, 0))
		Instruments3D.cyl(kn, 0.0034, 0.0006, MeshKit.m("black_epoxy"), Vector3(0, 0.0046, 0), Vector3.ZERO, 16)
		var tip := Node3D.new(); tip.position = Vector3(0, 0.0052, 0); kn.add_child(tip)
		_posts.append(tip)
		var lab_col: Color = [Color(0.9, 0.3, 0.25), Color(0.8, 0.82, 0.85), Color(0.45, 0.62, 0.95)][k]
		_post_labels.append(MeshKit.label(grp, ["+", "−", "−"][k] as String, 0.00009, Vector3(px, py + 0.0135, Z0 + 0.0001), lab_col, false, Vector3.ZERO))
	set_dual(false)
	set_values(0.0, 0.0); set_output(false)

var _post_groups: Array = []
var _post_labels: Array = []
## Dual rails (chapter 6): the black post becomes COM and moves left, the blue post (the second rail's minus) shows at the right.
func set_dual(on: bool) -> void:
	(_post_groups[1] as Node3D).position.x = -0.009 if on else 0.0
	(_post_groups[2] as Node3D).visible = on
	(_post_labels[1] as Label3D).text = "COM" if on else "−"

func _fmt(v: float, dec: int) -> String:
	return ("%." + str(dec) + "f") % clampf(v, 0.0, 99.99 if dec == 2 else 9.999)

func set_values(volts: float, amps: float) -> void:
	_vpanel.text = _fmt(volts, 2); _apanel.text = _fmt(amps, 3)
	_vpanel.queue_redraw(); _apanel.queue_redraw()

func set_output(on: bool) -> void:
	_led_mat.emission_energy_multiplier = 3.0 if on else 0.0
	_led_mat.albedo_color = Color(0.1, 0.55, 0.2) if on else Color(0.05, 0.2, 0.08)

## World position of the front tip of a binding post (0 red, 1 black / COM, 2 blue: the second rail's minus).
func post_world(i: int) -> Vector3:
	return (_posts[clampi(i, 0, 2)] as Node3D).global_position
