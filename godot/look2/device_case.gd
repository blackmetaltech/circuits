class_name DeviceCase
extends Node3D
## LOOK2: the customer's device around the ticket's board (presentation only): a moulded shell in the device's own colours that
## holds the board, a screwed lid with a vent grille, a moulded brand, a model plate, and a paper work-order tag beside it.
## States: "closed" (arrived, board hidden), "open" (lid set aside on the mat, board revealed), "handed" (lid back on, handed back).

signal state_changed(state: String)

var state := "closed"
var lid: Node3D
var tag: Node3D
var tag_string: Node3D
var _lid_closed := Transform3D()
var _lid_open := Transform3D()
var size := Vector3(0.16, 0.03, 0.12)

## ticket -> [brand moulded on the lid, model plate, shell colour, accent colour]
const DEVICES := {
	"1-1": ["LUMO", "POCKET TORCH  9 V PP3", Color(0.10, 0.10, 0.11), Color(0.95, 0.72, 0.12)],
	"1-2": ["RIDGE", "BIKE TAIL LIGHT  9 V", Color(0.20, 0.21, 0.23), Color(0.62, 0.08, 0.06)],
	"1-3": ["AQUATHERM", "AQUARIUM HEATER  12 V", Color(0.30, 0.42, 0.50), Color(0.70, 0.72, 0.74)],
	"1-4": ["ZIPPY", "TOY CAR PACK  9 V", Color(0.66, 0.27, 0.05), Color(0.10, 0.10, 0.11)],
	"1-5": ["EXAM", "KIRCHHOFF TEST RIG", Color(0.50, 0.52, 0.54), Color(0.12, 0.30, 0.62)],
	"2-1": ["KAYA WX", "WEATHER STATION  ADC 3.3 V", Color(0.60, 0.61, 0.58), Color(0.10, 0.36, 0.60)],
	"2-2": ["CABLECREW", "CABLE JUNCTION BOX  TEL", Color(0.34, 0.36, 0.33), Color(0.90, 0.45, 0.08)],
	"2-3": ["TOMO", "SENSOR MODULE  SEALED", Color(0.12, 0.13, 0.14), Color(0.90, 0.72, 0.10)],
	"2-4": ["EXAM", "POTENTIOMETER TEST RIG", Color(0.50, 0.52, 0.54), Color(0.12, 0.30, 0.62)],
	"3-1": ["SNAPLITE", "CAMERA FLASH  READY LIGHT", Color(0.08, 0.08, 0.09), Color(0.80, 0.80, 0.82)],
	"3-2": ["ARCADIA", "ARCADE BUTTON BOX  5 V", Color(0.50, 0.10, 0.45), Color(0.98, 0.82, 0.12)],
	"3-3": ["GREENLINE", "IRRIGATION CONTROLLER  24 V", Color(0.16, 0.36, 0.20), Color(0.92, 0.92, 0.88)],
	"3-4": ["EXAM", "CAPACITOR BANK TEST RIG", Color(0.50, 0.52, 0.54), Color(0.12, 0.30, 0.62)],
	"4-1": ["VOLTEX", "AC ADAPTER  230 V IN  12 V DC", Color(0.07, 0.07, 0.075), Color(0.85, 0.12, 0.08)],
	"4-2": ["HALCYON", "TABLE RADIO  5.1 V RAIL", Color(0.42, 0.26, 0.14), Color(0.86, 0.76, 0.52)],
	"4-3": ["LAYERLINE", "PRINTER CONTROLLER  15 V  5 V", Color(0.14, 0.15, 0.17), Color(0.95, 0.48, 0.10)],
	"4-4": ["BENCH", "OWN 3.3 V RAIL  LM317", Color(0.24, 0.30, 0.36), Color(0.88, 0.88, 0.84)],
	"4-5": ["EXAM", "ZENER REGULATOR TEST RIG", Color(0.50, 0.52, 0.54), Color(0.12, 0.30, 0.62)],
	"5-1": ["BREEZE", "DESK FAN  12 V  0.2 A", Color(0.60, 0.60, 0.57), Color(0.10, 0.52, 0.56)],
	"5-2": ["GLOWRAIL", "LED STRIP DRIVER  3.3 V LOGIC", Color(0.90, 0.90, 0.88), Color(0.55, 0.20, 0.75)],
	"5-3": ["ROBOCLUB", "LOGIC BOARD  5 V", Color(0.10, 0.30, 0.55), Color(0.95, 0.80, 0.15)],
	"5-4": ["JUNO MUSIC", "SYNTH PREAMP  9 V", Color(0.12, 0.12, 0.13), Color(0.90, 0.35, 0.45)],
	"5-5": ["EXAM", "AMPLIFIER TEST RIG", Color(0.50, 0.52, 0.54), Color(0.12, 0.30, 0.62)],
	"6-1": ["STREETAMP", "BUSKING MIC PREAMP  +-12 V", Color(0.55, 0.12, 0.10), Color(0.95, 0.85, 0.30)],
	"6-2": ["ACIDIX", "BENCH PH METER  INPUT STAGE", Color(0.88, 0.90, 0.92), Color(0.10, 0.45, 0.40)],
	"6-3": ["STUDIO NINE", "MIC PREAMP  40 dB  LM358", Color(0.16, 0.17, 0.20), Color(0.70, 0.72, 0.75)],
	"6-4": ["SONICLEAN", "ULTRASONIC CLEANER DRIVER  50 kHz", Color(0.20, 0.42, 0.62), Color(0.93, 0.93, 0.90)],
	"6-5": ["HATCHWELL", "INCUBATOR THERMOSTAT  5 V", Color(0.94, 0.88, 0.70), Color(0.75, 0.30, 0.12)],
	"6-6": ["BENCH", "OWN FUNCTION GENERATOR  RAMP STAGE", Color(0.24, 0.30, 0.36), Color(0.88, 0.88, 0.84)],
	"6-7": ["EXAM", "SUMMING AMPLIFIER TEST RIG", Color(0.50, 0.52, 0.54), Color(0.12, 0.30, 0.62)],
}
## 0.7 (CRITIQUE-0.6, Sigrid: "the testbed boards have no device shell"): the testbed's appliances, keyed "tb-<device id>".
const TESTBED := {
	"tb-torch": ["LUMO", "POCKET TORCH  9 V PP3", Color(0.10, 0.10, 0.11), Color(0.95, 0.72, 0.12)],
	"tb-station": ["KAYA WX", "WEATHER STATION  ADC 3.3 V", Color(0.60, 0.61, 0.58), Color(0.10, 0.36, 0.60)],
	"tb-fan": ["BREEZE", "DESK FAN  12 V  0.2 A", Color(0.60, 0.60, 0.57), Color(0.10, 0.52, 0.56)],
	"tb-charger": ["VOLTEX", "PHONE CHARGER  230 V IN  5 V", Color(0.93, 0.93, 0.91), Color(0.20, 0.45, 0.85)],
	"tb-dimmer": ["LUMINA", "LAMP DIMMER  12 V LED", Color(0.36, 0.25, 0.16), Color(0.92, 0.80, 0.55)],
	"tb-relay_timer": ["TIMEX-R", "RELAY TIMER  12 V  2 S", Color(0.18, 0.30, 0.22), Color(0.92, 0.60, 0.12)],
}

static func device_of(ticket_id: String) -> Array:
	if TESTBED.has(ticket_id): return TESTBED[ticket_id]
	return DEVICES.get(ticket_id, ["SERVICE", "DEVICE UNDER REPAIR", Color(0.18, 0.19, 0.20), Color(0.91, 0.64, 0.24)])

## inner: the board's footprint (x, z size) in metres; the shell is built around it with walls, its floor under the standoffs.
func build(inner: Vector2, ticket_id: String, title: String, customer: String) -> void:
	size = Vector3(inner.x + 0.03, 0.034, inner.y + 0.03)
	var dev := device_of(ticket_id)
	var shell := MeshKit.mat(dev[2], 0.42, 0.0, {"normal": 0.15, "clearcoat": 0.25})
	var accent := MeshKit.mat(dev[3], 0.35, 0.0, {"clearcoat": 0.3})
	var t := 0.004
	MeshKit.add(self, MeshKit.rounded_box(Vector3(size.x, t, size.z), 0.0015), shell, Vector3(0, -0.0145, 0))
	for sx in [-1, 1]: MeshKit.add(self, MeshKit.rounded_box(Vector3(t, size.y, size.z), 0.0015), shell, Vector3(sx * (size.x - t) * 0.5, size.y * 0.5 - 0.0165, 0))
	for sz in [-1, 1]: MeshKit.add(self, MeshKit.rounded_box(Vector3(size.x, size.y, t), 0.0015), shell, Vector3(0, size.y * 0.5 - 0.0165, sz * (size.z - t) * 0.5))
	for sx in [-1, 1]:   # screw bosses in the corners
		for sz in [-1, 1]:
			var b := CylinderMesh.new(); b.top_radius = 0.004; b.bottom_radius = 0.0045; b.height = size.y - 0.004
			MeshKit.add(self, b, shell, Vector3(sx * (size.x * 0.5 - 0.008), size.y * 0.5 - 0.0165, sz * (size.z * 0.5 - 0.008)))
	for sz in [-1, 1]:   # an accent band moulded round the rim
		MeshKit.add(self, MeshKit.rounded_box(Vector3(size.x + 0.0016, 0.004, 0.0016), 0.0006), accent, Vector3(0, size.y - 0.0165 - 0.004, sz * size.z * 0.5))
	for sx in [-1, 1]:
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0016, 0.004, size.z + 0.0016), 0.0006), accent, Vector3(sx * size.x * 0.5, size.y - 0.0165 - 0.004, 0))
	# cable grommet towards the fan and the supply
	var g := TorusMesh.new(); g.inner_radius = 0.003; g.outer_radius = 0.006
	MeshKit.add(self, g, MeshKit.m("rubber"), Vector3(size.x * 0.25, 0.006, -size.z * 0.5 - 0.001), Vector3(PI / 2, 0, 0))
	# lid: vent slots, four screws, a model plate
	lid = Node3D.new(); add_child(lid)
	MeshKit.add(lid, MeshKit.rounded_box(Vector3(size.x + 0.002, 0.005, size.z + 0.002), 0.002), shell)
	for i in 9:
		MeshKit.add(lid, MeshKit.rounded_box(Vector3(0.05, 0.0012, 0.003), 0.0006), MeshKit.mat(Color(0.03, 0.03, 0.035), 0.9), Vector3(-size.x * 0.22, 0.0021, -0.03 + i * 0.0075))
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			var sc := CylinderMesh.new(); sc.top_radius = 0.0022; sc.bottom_radius = 0.0022; sc.height = 0.001
			MeshKit.add(lid, sc, MeshKit.m("steel"), Vector3(sx * (size.x * 0.5 - 0.008), 0.0028, sz * (size.z * 0.5 - 0.008)))
	MeshKit.label(lid, str(dev[0]), 0.00016, Vector3(-size.x * 0.22, 0.0029, size.z * 0.5 - 0.016), Color(dev[2]).lightened(0.12) if Color(dev[2]).get_luminance() < 0.5 else Color(dev[2]).darkened(0.18), true)
	MeshKit.add(lid, MeshKit.rounded_box(Vector3(0.056, 0.0006, 0.024), 0.0008), MeshKit.mat(Color(0.52, 0.53, 0.55), 0.6, 0.8), Vector3(size.x * 0.22, 0.0027, 0.02))
	MeshKit.add(lid, MeshKit.rounded_box(Vector3(0.056, 0.0007, 0.005), 0.0004), accent, Vector3(size.x * 0.22, 0.0028, 0.0105))
	MeshKit.label(lid, str(dev[1]), 0.00006, Vector3(size.x * 0.22, 0.0032, 0.018), Color(0.10, 0.10, 0.11), true)
	MeshKit.label(lid, "SERVICE: REMOVE 4 SCREWS", 0.000042, Vector3(size.x * 0.22, 0.0032, 0.026), Color(0.25, 0.25, 0.27), true)
	_lid_props(ticket_id, accent, shell)
	_lid_closed = Transform3D(Basis(), Vector3(0, size.y - 0.0165 + 0.0025, 0))
	_lid_open = Transform3D(Basis(Vector3.UP, deg_to_rad(14.0)).rotated(Vector3.FORWARD, deg_to_rad(0.0)), Vector3(size.x + 0.055, -0.014, size.z * 0.75))
	lid.transform = _lid_closed
	# paper work-order tag on the mat at the case's front-left corner, tied to it with string; matte, not white, so the lamp does not blow it out
	tag = Node3D.new(); add_child(tag)
	tag.position = Vector3(-size.x * 0.5 - 0.040, -0.0155, size.z * 0.5 - 0.012); tag.rotation.y = deg_to_rad(-8.0)
	MeshKit.add(tag, MeshKit.rounded_box(Vector3(0.066, 0.0006, 0.040), 0.001), MeshKit.mat(Color(0.62, 0.54, 0.36), 0.96, 0.0, {"normal": 0.5}))
	MeshKit.add(tag, MeshKit.rounded_box(Vector3(0.066, 0.0007, 0.008), 0.0005), MeshKit.mat(Color(0.62, 0.16, 0.10), 0.9), Vector3(0, 0.0001, -0.016))
	var hole := TorusMesh.new(); hole.inner_radius = 0.0018; hole.outer_radius = 0.0028
	MeshKit.add(tag, hole, MeshKit.mat(Color(0.75, 0.6, 0.3), 0.4, 1.0), Vector3(0.027, 0.0005, -0.016))
	MeshKit.label(tag, "REPAIR  %s" % ticket_id, 0.00007, Vector3(-0.004, 0.0006, -0.016), Color(0.95, 0.92, 0.85), true)
	MeshKit.label(tag, title, 0.00013, Vector3(0.0, 0.0006, -0.001), Color(0.04, 0.04, 0.04), true)
	MeshKit.label(tag, "from %s" % customer, 0.00009, Vector3(0.0, 0.0006, 0.011), Color(0.10, 0.10, 0.10), true)
	var a0 := tag.position + Vector3(0.027, 0.001, -0.016).rotated(Vector3.UP, tag.rotation.y)
	var str_pts := PackedVector3Array([a0, Vector3(-size.x * 0.5 - 0.006, -0.012, size.z * 0.5 - 0.02), Vector3(-size.x * 0.5 + 0.002, 0.004, size.z * 0.5 - 0.012)])
	tag_string = MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(str_pts, 0.01), 0.0004, 5), MeshKit.mat(Color(0.7, 0.66, 0.55), 0.9))

## What makes each device look like itself on its lid: a camera flash has a lens ring and a flash window, the arcade box a big button and a
## joystick stub, the irrigation controller a status lamp and a valve dial, the junction box two cable glands. Exams stay plain.
func _lid_props(ticket_id: String, accent: Material, shell: Material) -> void:
	var y := 0.0030
	var dark := MeshKit.mat(Color(0.03, 0.03, 0.035), 0.5)
	match ticket_id:
		"3-1":
			var ring := CylinderMesh.new(); ring.top_radius = 0.016; ring.bottom_radius = 0.016; ring.height = 0.003; ring.radial_segments = 32
			MeshKit.add(lid, ring, MeshKit.m("anodised"), Vector3(-size.x * 0.22, y + 0.0010, -0.012))
			var glass := CylinderMesh.new(); glass.top_radius = 0.011; glass.bottom_radius = 0.011; glass.height = 0.0034; glass.radial_segments = 32
			MeshKit.add(lid, glass, MeshKit.mat(Color(0.05, 0.08, 0.16), 0.08, 0.0, {"clearcoat": 1.0, "normal": 0.0}), Vector3(-size.x * 0.22, y + 0.0012, -0.012))
			MeshKit.add(lid, MeshKit.rounded_box(Vector3(0.030, 0.0030, 0.016), 0.002), MeshKit.mat(Color(0.95, 0.93, 0.80), 0.2, 0.0, {"alpha": 0.9, "emission": Color(0.9, 0.85, 0.6), "emission_energy": 0.15}), Vector3(size.x * 0.22, y + 0.0010, -0.030))
		"3-2":
			var dome := SphereMesh.new(); dome.radius = 0.011; dome.height = 0.011; dome.is_hemisphere = true; dome.radial_segments = 24; dome.rings = 8
			MeshKit.add(lid, dome, MeshKit.mat(Color(0.86, 0.08, 0.06), 0.25, 0.0, {"clearcoat": 0.8}), Vector3(-size.x * 0.22, y + 0.0016, -0.014))
			var stub := CylinderMesh.new(); stub.top_radius = 0.0035; stub.bottom_radius = 0.0045; stub.height = 0.010; stub.radial_segments = 16
			MeshKit.add(lid, stub, dark, Vector3(size.x * 0.10, y + 0.005, -0.030))
			var ball := SphereMesh.new(); ball.radius = 0.0065; ball.height = 0.013; ball.radial_segments = 16; ball.rings = 8
			MeshKit.add(lid, ball, MeshKit.mat(Color(0.9, 0.1, 0.1), 0.3, 0.0, {"clearcoat": 0.5}), Vector3(size.x * 0.10, y + 0.011, -0.030))
		"3-3":
			var lamp := SphereMesh.new(); lamp.radius = 0.0045; lamp.height = 0.009; lamp.is_hemisphere = true; lamp.radial_segments = 16; lamp.rings = 6
			MeshKit.add(lid, lamp, MeshKit.mat(Color(0.15, 0.95, 0.30), 0.2, 0.0, {"emission": Color(0.1, 0.8, 0.2), "emission_energy": 0.4}), Vector3(-size.x * 0.30, y + 0.0014, -0.034))
			var dial := CylinderMesh.new(); dial.top_radius = 0.0105; dial.bottom_radius = 0.0105; dial.height = 0.004; dial.radial_segments = 28
			MeshKit.add(lid, dial, MeshKit.m("anodised"), Vector3(-size.x * 0.22, y + 0.0014, -0.010))
			MeshKit.add(lid, MeshKit.rounded_box(Vector3(0.0016, 0.0016, 0.0090), 0.0004), MeshKit.mat(Color(0.95, 0.95, 0.9), 0.4), Vector3(-size.x * 0.22, y + 0.0040, -0.0125), Vector3(0, deg_to_rad(35.0), 0))
		"2-2":
			for i in 2:
				var gl := CylinderMesh.new(); gl.top_radius = 0.0075; gl.bottom_radius = 0.0075; gl.height = 0.006; gl.radial_segments = 20
				MeshKit.add(lid, gl, dark, Vector3(-size.x * 0.30 + float(i) * 0.022, y + 0.0020, -0.030))
				var nut := CylinderMesh.new(); nut.top_radius = 0.0095; nut.bottom_radius = 0.0095; nut.height = 0.0022; nut.radial_segments = 6
				MeshKit.add(lid, nut, MeshKit.m("steel"), Vector3(-size.x * 0.30 + float(i) * 0.022, y + 0.0004, -0.030))

func set_state(s: String, animate := true) -> void:
	state = s
	if tag: tag.visible = s != "open"
	if tag_string: tag_string.visible = s != "open"   # the tag tells the arrival; on the bench the paper ticket says it (Dagny: two papers was clutter)
	var target := _lid_open if s == "open" else _lid_closed
	if not animate or not is_inside_tree():
		lid.transform = target
	else:
		var tw := create_tween(); tw.set_trans(Tween.TRANS_CUBIC); tw.set_ease(Tween.EASE_IN_OUT)
		var lift := Transform3D(lid.transform.basis, lid.transform.origin.lerp(target.origin, 0.5) + Vector3(0, 0.06, 0))
		tw.tween_property(lid, "transform", lift, 0.45)
		tw.tween_property(lid, "transform", target, 0.45)
	state_changed.emit(s)
