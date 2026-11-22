class_name DeviceCase
extends Node3D
## LOOK2: the customer's device around the ticket's board (presentation only). For 5-1 it is the desk fan's base: a dark grey
## plastic shell that holds the driver board, a screwed lid with a vent grille and a model plate, and a paper work-order tag.
## States: "closed" (arrived, board hidden), "open" (lid set aside on the mat, board revealed), "handed" (lid back on, handed back).

signal state_changed(state: String)

var state := "closed"
var lid: Node3D
var tag: Node3D
var _lid_closed := Transform3D()
var _lid_open := Transform3D()
var size := Vector3(0.16, 0.03, 0.12)

## inner: the board's footprint (x, z size) in metres; the shell is built around it with walls, its floor under the standoffs.
func build(inner: Vector2, ticket_id: String, title: String, customer: String) -> void:
	size = Vector3(inner.x + 0.03, 0.034, inner.y + 0.03)
	var shell := MeshKit.mat(Color(0.16, 0.165, 0.175), 0.5, 0.0, {"normal": 0.2, "clearcoat": 0.15})
	var t := 0.004
	MeshKit.add(self, MeshKit.rounded_box(Vector3(size.x, t, size.z), 0.0015), shell, Vector3(0, -0.0145, 0))
	for sx in [-1, 1]: MeshKit.add(self, MeshKit.rounded_box(Vector3(t, size.y, size.z), 0.0015), shell, Vector3(sx * (size.x - t) * 0.5, size.y * 0.5 - 0.0165, 0))
	for sz in [-1, 1]: MeshKit.add(self, MeshKit.rounded_box(Vector3(size.x, size.y, t), 0.0015), shell, Vector3(0, size.y * 0.5 - 0.0165, sz * (size.z - t) * 0.5))
	for sx in [-1, 1]:   # screw bosses in the corners
		for sz in [-1, 1]:
			var b := CylinderMesh.new(); b.top_radius = 0.004; b.bottom_radius = 0.0045; b.height = size.y - 0.004
			MeshKit.add(self, b, shell, Vector3(sx * (size.x * 0.5 - 0.008), size.y * 0.5 - 0.0165, sz * (size.z * 0.5 - 0.008)))
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
	MeshKit.add(lid, MeshKit.rounded_box(Vector3(0.05, 0.0006, 0.022), 0.0008), MeshKit.m("brushed_alu"), Vector3(size.x * 0.22, 0.0027, 0.02))
	MeshKit.label(lid, "DESK FAN  12 V  0.2 A", 0.00006, Vector3(size.x * 0.22, 0.0032, 0.016), Color(0.12, 0.12, 0.13), true)
	MeshKit.label(lid, "DRIVER BOARD INSIDE", 0.000045, Vector3(size.x * 0.22, 0.0032, 0.025), Color(0.12, 0.12, 0.13), true)
	_lid_closed = Transform3D(Basis(), Vector3(0, size.y - 0.0165 + 0.0025, 0))
	_lid_open = Transform3D(Basis(Vector3.UP, deg_to_rad(14.0)).rotated(Vector3.FORWARD, deg_to_rad(0.0)), Vector3(size.x + 0.055, -0.014, size.z * 0.75))
	lid.transform = _lid_closed
	# paper work-order tag tied to the shell with string
	tag = Node3D.new(); add_child(tag)
	tag.position = Vector3(size.x * 0.5 + 0.035, -0.0155, -0.03); tag.rotation.y = deg_to_rad(12.0)
	MeshKit.add(tag, MeshKit.rounded_box(Vector3(0.06, 0.0006, 0.034), 0.001), MeshKit.mat(Color(0.93, 0.90, 0.82), 0.85, 0.0, {"normal": 0.4}))
	var hole := TorusMesh.new(); hole.inner_radius = 0.0018; hole.outer_radius = 0.0028
	MeshKit.add(tag, hole, MeshKit.mat(Color(0.75, 0.6, 0.3), 0.4, 1.0), Vector3(-0.024, 0.0005, 0))
	MeshKit.label(tag, "WORK ORDER %s" % ticket_id, 0.00006, Vector3(0.004, 0.0004, -0.010), Color(0.55, 0.12, 0.08), true)
	MeshKit.label(tag, title, 0.00008, Vector3(0.004, 0.0004, 0.0), Color(0.1, 0.1, 0.1))
	MeshKit.label(tag, "from %s" % customer, 0.00005, Vector3(0.004, 0.0004, 0.009), Color(0.25, 0.25, 0.25))
	var str_pts := PackedVector3Array([tag.position + Vector3(-0.024, 0.001, 0.003), Vector3(size.x * 0.5 + 0.004, 0.0, -0.02), Vector3(size.x * 0.5 - 0.002, 0.006, -0.015)])
	MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(str_pts, 0.01), 0.0004, 5), MeshKit.mat(Color(0.8, 0.75, 0.62), 0.9))

func set_state(s: String, animate := true) -> void:
	state = s
	var target := _lid_open if s == "open" else _lid_closed
	if not animate or not is_inside_tree():
		lid.transform = target
	else:
		var tw := create_tween(); tw.set_trans(Tween.TRANS_CUBIC); tw.set_ease(Tween.EASE_IN_OUT)
		var lift := Transform3D(lid.transform.basis, lid.transform.origin.lerp(target.origin, 0.5) + Vector3(0, 0.06, 0))
		tw.tween_property(lid, "transform", lift, 0.45)
		tw.tween_property(lid, "transform", target, 0.45)
	state_changed.emit(s)
