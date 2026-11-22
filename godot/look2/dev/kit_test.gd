extends Node3D
## Dev: renders MeshKit shapes (CB_LOOK2_DEV=kit). Not shipped behaviour.
func _ready() -> void:
	var env := WorldEnvironment.new(); var e := Environment.new(); e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.1,0.1,0.12); e.ambient_light_color = Color(0.3,0.3,0.35); e.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.environment = e; add_child(env)
	var l := DirectionalLight3D.new(); l.rotation_degrees = Vector3(-45, 30, 0); l.shadow_enabled = true; add_child(l)
	var cam := Camera3D.new(); cam.position = Vector3(0, 0.12, 0.25); add_child(cam); cam.look_at(Vector3.ZERO)
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.1, 0.04, 0.06), 0.008, 4), MeshKit.m("anodised"), Vector3(-0.06, 0, 0))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.05, 0.05, 0.05), 0.012, 4), MeshKit.mat(Color(0.8,0.3,0.2), 0.4), Vector3(0.06, 0, 0))
	var pts := MeshKit.round_corners(PackedVector3Array([Vector3(-0.1,0.03,0.04), Vector3(0,0.03,0.04), Vector3(0,0.03,-0.04), Vector3(0.1,0.05,-0.04)]), 0.01)
	MeshKit.add(self, MeshKit.tube(pts, 0.003), MeshKit.mat(Color(0.9,0.1,0.1), 0.45))
	MeshKit.label(self, "2N2222A", 0.0002, Vector3(-0.06, 0.0201, 0))
