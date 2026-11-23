class_name Contact3D
extends Node3D
## LOOK2 chapter 3: the two bench-driven contacts the engine reports as `contacts` in its live frame. They are board props between two
## pads, drawn closed or open as the engine says: 3-2's arcade button (a red dome that goes down, with a chatter while the contact
## bounces) and 3-4's knife switch (a blade that lies on its clip, or stands up). Presentation only.

const P := MeshKit.PITCH
var id := ""
var kind := ""
var _dome: Node3D
var _dome_at := Vector3.ZERO
var _blade: Node3D
var _closed := false
var _since := 9.0

## `pa`, `pb`: the two pads in board-local metres. The arcade button stands right and below the first pad, like the classic stall's.
func build(contact_id: String, pa: Vector3, pb: Vector3) -> void:
	id = contact_id
	if id == "btn": _button(pa, pb)
	else: _knife(pa, pb)

func _button(pa: Vector3, pb: Vector3) -> void:
	kind = "button"
	var cen := pa + Vector3(6.0 * P, 0, 4.0 * P)
	var black := MeshKit.mat(Color(0.05, 0.05, 0.055), 0.5, 0.0, {"clearcoat": 0.3})
	PartsLab._cyl(self, 0.0125, 0.0100, black, cen + Vector3(0, 0.0050, 0), Vector3.ZERO, 32)
	PartsLab._cyl(self, 0.0132, 0.0016, MeshKit.m("brushed_alu"), cen + Vector3(0, 0.0108, 0), Vector3.ZERO, 32)
	_dome = Node3D.new(); add_child(_dome); _dome_at = cen + Vector3(0, 0.0116, 0); _dome.position = _dome_at
	var red := MeshKit.mat(Color(0.85, 0.07, 0.06), 0.25, 0.0, {"clearcoat": 0.8, "emission": Color(0.6, 0.02, 0.02), "emission_energy": 0.3})
	PartsLab._cyl(_dome, 0.0100, 0.0040, red, Vector3(0, 0.0020, 0), Vector3.ZERO, 32)
	var cap := SphereMesh.new(); cap.radius = 0.0100; cap.height = 0.0070; cap.radial_segments = 32; cap.rings = 8; cap.is_hemisphere = true
	MeshKit.add(_dome, cap, red, Vector3(0, 0.0040, 0))
	# two leads: SW pad -> down the column, along to the housing; the housing -> along and up the GND column to its pad
	var a: Array = [pa + Vector3(0, 0.0020, 0), Vector3(pa.x, 0.0015, cen.z), cen + Vector3(-0.0125, 0.0030, 0)]
	var b: Array = [cen + Vector3(0.0125, 0.0030, 0), Vector3(cen.x + 3.0 * P, 0.0015, cen.z), Vector3(cen.x + 3.0 * P, 0.0015, pb.z), pb + Vector3(0, 0.0020, 0)]
	for pts in [a, b]:
		MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(PackedVector3Array(pts), 0.006, 4), 0.0011, 8), MeshKit.m("rubber"))
	var lb := MeshKit.label(self, "ARCADE", 0.00004, cen + Vector3(0, 0.0128, 0.0125), Color(0.9, 0.9, 0.88), true)
	lb.rotation = Vector3(-PI / 2, 0, 0)

func _knife(pa: Vector3, pb: Vector3) -> void:
	kind = "knife"
	var brass := PartsLab._brass()
	var span := pb.x - pa.x
	for q in [pa, pb]:
		PartsLab._cyl(self, 0.0030, 0.0070, brass, q + Vector3(0, 0.0035, 0), Vector3.ZERO, 16)
	PartsLab._box(self, Vector3(0.0050, 0.0030, 0.0070), brass, pb + Vector3(0, 0.0060, 0), 0.0006)   # the clip
	_blade = Node3D.new(); add_child(_blade); _blade.position = pa + Vector3(0, 0.0075, 0)
	PartsLab._box(_blade, Vector3(span - 0.002, 0.0012, 0.0036), MeshKit.m("steel"), Vector3((span - 0.002) * 0.5 + 0.001, 0, 0), 0.0003)
	PartsLab._box(_blade, Vector3(0.0070, 0.0070, 0.0060), MeshKit.mat(Color(0.75, 0.10, 0.08), 0.45, 0.0, {"clearcoat": 0.4}), Vector3(span - 0.0045, 0.0040, 0), 0.0012)   # the insulated handle
	var lb := MeshKit.label(self, "SWITCH", 0.00005, (pa + pb) * 0.5 + Vector3(0, 0.0004, 0.0075), Color(0.9, 0.9, 0.88), true)
	lb.rotation = Vector3(-PI / 2, 0, 0)
	set_closed(false)

## closed: the engine's contact state. The arcade button chatters for a moment after every change (its contact bounces).
func set_closed(closed: bool, dt := 0.0) -> void:
	if closed != _closed: _since = 0.0
	_closed = closed
	_since += dt
	if _dome:
		_dome.position.y = _dome_at.y - (0.0035 if closed else 0.0)
		var shake := clampf(1.0 - _since / 0.35, 0.0, 1.0) if closed else 0.0
		_dome.position.x = _dome_at.x + sin(_since * 90.0) * 0.0007 * shake
	if _blade: _blade.rotation.z = 0.0 if closed else deg_to_rad(48.0)
