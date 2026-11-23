class_name IsoBox
extends Node3D
## LOOK2 4-1 (D-bench-ch45): the bench's isolation transformer, the grey box the safety card names. A steel case with a carry
## handle, a lit mains switch, a rating plate and an outlet; the board's L and N leads come out of the outlet. Presentation only:
## the engine owns the mains (ticketCard().mains: 230 V rms, 50 Hz, isolated).

const W := 0.100
const H := 0.072
const D := 0.085

func _init() -> void:
	var grey := MeshKit.mat(Color(0.52, 0.54, 0.55), 0.55, 0.35, {"normal": 0.25})
	MeshKit.add(self, MeshKit.rounded_box(Vector3(W, H, D), 0.004), grey, Vector3(0, H * 0.5, 0))
	# vents along the sides
	for sx in [-1, 1]:
		for k in 6:
			MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0010, 0.0030, 0.050), 0.0004), MeshKit.mat(Color(0.08, 0.08, 0.09), 0.8), Vector3(sx * (W * 0.5 + 0.0002), 0.018 + float(k) * 0.007, 0))
	# carry handle on top
	MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(PackedVector3Array([Vector3(-0.030, H, 0), Vector3(-0.030, H + 0.016, 0), Vector3(0.030, H + 0.016, 0), Vector3(0.030, H, 0)]), 0.006, 4), 0.0030, 10), MeshKit.m("black_plastic"))
	# front panel: a darker face with the plate, the switch and the outlet
	var zf := D * 0.5 + 0.0006
	MeshKit.add(self, MeshKit.rounded_box(Vector3(W - 0.008, H - 0.010, 0.0012), 0.002), MeshKit.mat(Color(0.20, 0.21, 0.22), 0.5, 0.2), Vector3(0, H * 0.5, zf))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.060, 0.016, 0.0008), 0.001), MeshKit.m("brushed_alu"), Vector3(-0.010, H - 0.017, zf + 0.0008))
	MeshKit.label(self, "ISOLATION TRANSFORMER", 0.00006, Vector3(-0.010, H - 0.013, zf + 0.0014), Color(0.08, 0.08, 0.08), false, Vector3.ZERO)
	MeshKit.label(self, "230 V  50 Hz  ISOLATED", 0.00005, Vector3(-0.010, H - 0.021, zf + 0.0014), Color(0.08, 0.08, 0.08), false, Vector3.ZERO)
	var lamp := MeshKit.mat(Color(0.2, 0.9, 0.3), 0.2, 0.0, {"emission": Color(0.2, 1.0, 0.35), "emission_energy": 1.5, "normal": 0.0})
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.014, 0.020, 0.006), 0.002), MeshKit.m("black_plastic"), Vector3(0.033, H - 0.020, zf + 0.002))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.010, 0.008, 0.004), 0.0015), lamp, Vector3(0.033, H - 0.016, zf + 0.004))
	# outlet: a round socket with two holes (the leads plug in here)
	var sock := CylinderMesh.new(); sock.top_radius = 0.016; sock.bottom_radius = 0.016; sock.height = 0.004; sock.radial_segments = 28
	MeshKit.add(self, sock, MeshKit.mat(Color(0.88, 0.87, 0.84), 0.55), Vector3(0, 0.024, zf + 0.002), Vector3(PI / 2, 0, 0))
	for i in 2:
		var hole := CylinderMesh.new(); hole.top_radius = 0.0024; hole.bottom_radius = 0.0024; hole.height = 0.0045; hole.radial_segments = 12
		MeshKit.add(self, hole, MeshKit.mat(Color(0.02, 0.02, 0.02), 0.9), _outlet_local(i) - Vector3(0, 0, 0.0005), Vector3(PI / 2, 0, 0))
	MeshKit.label(self, "OUTPUT 230 V", 0.00005, Vector3(0, 0.005, zf + 0.0010), Color(0.85, 0.86, 0.85), false, Vector3.ZERO)
	# rubber feet
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			var f := CylinderMesh.new(); f.top_radius = 0.005; f.bottom_radius = 0.006; f.height = 0.003
			MeshKit.add(self, f, MeshKit.m("rubber"), Vector3(sx * (W * 0.5 - 0.010), 0.0005, sz * (D * 0.5 - 0.010)))

func _outlet_local(i: int) -> Vector3: return Vector3(-0.0065 if i == 0 else 0.0065, 0.024, D * 0.5 + 0.0046)

## Where lead i (0 live, 1 neutral) leaves the outlet, in world space.
func outlet_world(i: int) -> Vector3: return to_global(_outlet_local(i) + Vector3(0, 0, 0.004))
