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
	"2-3": ["TOMO", "SENSOR MODULE  SEALED", Color(0.12, 0.13, 0.14), Color(0.90, 0.72, 0.10)],
	"5-1": ["BREEZE", "DESK FAN  12 V  0.2 A", Color(0.60, 0.60, 0.57), Color(0.10, 0.52, 0.56)],
}
static func device_of(ticket_id: String) -> Array:
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
