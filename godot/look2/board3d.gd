class_name Board3D
extends Node3D
## LOOK2 perfboard: the engine's w x h pad grid as a green FR4 board with tinned pads (one MultiMesh), brass standoffs, silkscreen
## grid labels and labelled header posts for the ticket's connectors. MeshKit conventions (pad (gx, gy) -> (gx*P, 0, gy*P)).

const P := MeshKit.PITCH
const ROLE_COL := {"source": Color(0.78, 0.16, 0.12), "supply": Color(0.78, 0.16, 0.12), "ground": Color(0.12, 0.2, 0.42), "negrail": Color(0.10, 0.26, 0.62), "load": Color(0.85, 0.55, 0.12)}

var w := 24
var h := 16
var connectors: Array = []
var _hover: MeshInstance3D
var _marks: Array = []
var _ring_mesh: TorusMesh

func build(gw: int, gh: int, conns: Array) -> void:
	w = gw; h = gh; connectors = conns
	for c in get_children(): c.queue_free()
	var m := 2.0 * P
	var size := Vector3((w - 1) * P + 2 * m, MeshKit.BOARD_T, (h - 1) * P + 2 * m)
	var centre := Vector3((w - 1) * P * 0.5, -MeshKit.BOARD_T * 0.5, (h - 1) * P * 0.5)
	var fr4 := MeshKit.mat(Color(0.09, 0.25, 0.14), 0.32, 0.0, {"clearcoat": 0.35, "clearcoat_rough": 0.4, "normal": 0.25, "uv_scale": 30.0})
	var board := MeshKit.add(self, MeshKit.rounded_box(size, 0.0015, 2), fr4, centre)
	board.name = "fr4"
	# standoffs
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			var p := centre + Vector3(sx * (size.x * 0.5 - m * 0.5), 0, sz * (size.z * 0.5 - m * 0.5))
			var hole := CylinderMesh.new(); hole.top_radius = 0.0016; hole.bottom_radius = 0.0016; hole.height = MeshKit.BOARD_T * 1.05
			MeshKit.add(self, hole, MeshKit.m("gold"), p)
			var nut := CylinderMesh.new(); nut.top_radius = 0.0028; nut.bottom_radius = 0.0028; nut.height = 0.0012; nut.radial_segments = 6
			MeshKit.add(self, nut, MeshKit.m("gold"), p + Vector3(0, MeshKit.BOARD_T * 0.5 + 0.0006, 0))
			var st := CylinderMesh.new(); st.top_radius = 0.0025; st.bottom_radius = 0.0025; st.height = 0.012; st.radial_segments = 6
			MeshKit.add(self, st, MeshKit.m("gold"), p + Vector3(0, -0.006 - MeshKit.BOARD_T * 0.5, 0))
	# pads: tinned annular rings + dark holes (two MultiMeshes)
	var ring := CylinderMesh.new(); ring.top_radius = 0.00165; ring.bottom_radius = 0.00175; ring.height = 0.0003; ring.radial_segments = 14; ring.rings = 1
	var hole_m := CylinderMesh.new(); hole_m.top_radius = 0.0006; hole_m.bottom_radius = 0.0006; hole_m.height = 0.00034; hole_m.radial_segments = 10
	var pad_mat := MeshKit.mat(Color(0.82, 0.80, 0.74), 0.22, 1.0, {"normal": 0.35})
	for pass_i in 2:
		var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = ring if pass_i == 0 else hole_m
		mm.instance_count = w * h
		var i := 0
		for gy in h:
			for gx in w:
				mm.set_instance_transform(i, Transform3D(Basis(), Vector3(gx * P, 0.00012 + pass_i * 0.00004, gy * P))); i += 1
		var mmi := MultiMeshInstance3D.new(); mmi.multimesh = mm
		mmi.material_override = pad_mat if pass_i == 0 else MeshKit.mat(Color(0.01, 0.012, 0.01), 0.9, 0.0, {"normal": 0.0})
		add_child(mmi)
	# silkscreen: column numbers every 5, row letters
	var silk := Color(0.86, 0.88, 0.84, 0.85)
	for gx in range(0, w, 5): MeshKit.label(self, str(gx), 0.000045, Vector3(gx * P, 0.0001, -1.2 * P), silk, true)
	for gy in range(0, h, 2): MeshKit.label(self, char(65 + gy), 0.000045, Vector3(-1.2 * P, 0.0001, gy * P), silk, true)
	# connectors: gold header post + labelled silk tab
	for c in conns:
		var pad: Array = c.pad
		var p := pad_local(int(pad[0]), int(pad[1]))
		var post := MeshKit.rounded_box(Vector3(0.0013, 0.012, 0.0013), 0.0002)
		MeshKit.add(self, post, MeshKit.m("gold"), p + Vector3(0, 0.0065, 0))
		var base := MeshKit.rounded_box(Vector3(0.0045, 0.0035, 0.0045), 0.0005)
		MeshKit.add(self, base, MeshKit.m("black_plastic"), p + Vector3(0, 0.00175, 0))
		var col: Color = ROLE_COL.get(str(c.get("role", "")), Color(0.5, 0.5, 0.5))
		var tab := MeshKit.rounded_box(Vector3(0.019, 0.0002, 0.0075), 0.0003)   # 0.5: bigger, so the label reads in view 1
		var side := -1.0 if int(pad[0]) < w / 2 else 1.0
		# 0.6 (Tess): near the top edge the tab sat behind the pad, under a battery or a module: it goes in front of the pad there,
		# and it says which side of the supply it is (+ or -), not only the connector's id
		var front := int(pad[1]) <= 3
		var tp := p + Vector3(side * 0.0070, 0.0005, 0.0050 if front else -0.0046)   # above the pad rings (they showed through)
		MeshKit.add(self, tab, MeshKit.mat(col.darkened(0.35), 0.9, 0.0, {"normal": 0.0, "rough_tex": false}), tp)
		var role := str(c.get("role", ""))
		var txt := str(c.id) + (" +" if role in ["supply", "source"] else (" −" if role in ["ground", "negrail"] else ""))
		MeshKit.label(self, txt, 0.000068, tp + Vector3(0, 0.00025, 0), Color(0.97, 0.97, 0.95))
	_ring_mesh = TorusMesh.new(); _ring_mesh.inner_radius = 0.0018; _ring_mesh.outer_radius = 0.0026; _ring_mesh.rings = 24; _ring_mesh.ring_segments = 8
	_hover = MeshKit.add(self, _ring_mesh, _glow(Color(0.91, 0.64, 0.24)), Vector3.ZERO)
	_hover.visible = false; _hover.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _glow(c: Color) -> StandardMaterial3D:
	var g := MeshKit.mat(c, 0.4, 0.0, {"emission": c, "emission_energy": 2.5, "normal": 0.0, "rough_tex": false})
	g.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return g

func pad_local(gx: int, gy: int) -> Vector3: return Vector3(gx * P, 0, gy * P)
func pad_world(gx: int, gy: int) -> Vector3: return to_global(pad_local(gx, gy))

func pad_at_world(p: Vector3) -> Vector2i:
	var l := to_local(p)
	var gx := int(round(l.x / P)); var gy := int(round(l.z / P))
	if gx < 0 or gy < 0 or gx >= w or gy >= h: return Vector2i(-1, -1)
	return Vector2i(gx, gy)

## 0.5 (Noor lost 20 minutes hunting the battery's ground lead): with a wire, meter or probe tool in hand, every pad that connects
## to something (a leg, a connector, a wire end) shows a dim ring, so the player sees where an end can go.
var _targets: Array[MeshInstance3D] = []
func set_targets(pads: Array) -> void:
	for m in _targets: if is_instance_valid(m): m.queue_free()
	_targets.clear()
	if _ring_mesh == null: return
	var mat := _glow(Color(0.55, 0.75, 0.95)); mat.albedo_color.a = 0.55
	mat.no_depth_test = true; mat.render_priority = 2   # 0.6: a ring shows through the part that stands over its pad (1-3's heater hid both)
	for pd in pads:
		var m := MeshKit.add(self, _ring_mesh, mat, pad_local(int(pd[0]), int(pd[1])) + Vector3(0, 0.0003, 0))
		m.scale = Vector3(0.8, 1.0, 0.8); m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; _targets.append(m)

func set_hover(gx: int, gy: int, on: bool, col := Color(0.91, 0.64, 0.24)) -> void:
	if _hover == null: return
	_hover.visible = on
	if on:
		_hover.position = pad_local(gx, gy) + Vector3(0, 0.0004, 0)
		(_hover.material_override as StandardMaterial3D).albedo_color = col; (_hover.material_override as StandardMaterial3D).emission = col

func set_marks(pads: Array, col := Color(0.4, 0.8, 1.0)) -> void:
	for m in _marks: m.queue_free()
	_marks.clear()
	for p in pads:
		var mi := MeshKit.add(self, _ring_mesh, _glow(col), pad_local(int(p[0]), int(p[1])) + Vector3(0, 0.0004, 0))
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_marks.append(mi)

## Board top surface plane in world space (for mouse picking).
func plane_world() -> Plane: return Plane(global_transform.basis.y.normalized(), global_position)

## 4-1 (D-bench-ch45): the engine's keep-out rectangles ({x, y, w, h} in pads) as a red hatched square on the board with the
## engine's words (ticketCard().mains.keepOut). The engine refuses any part or wire of the player's inside it.
var _keepout: Array = []
func set_keepout(rects: Array, text: String) -> void:
	for n in _keepout: if is_instance_valid(n): n.queue_free()
	_keepout.clear()
	var red := MeshKit.mat(Color(0.80, 0.10, 0.06), 0.6, 0.0, {"alpha": 0.30, "normal": 0.0, "rough_tex": false})
	var line := MeshKit.mat(Color(0.85, 0.12, 0.08), 0.6, 0.0, {"normal": 0.0, "rough_tex": false})
	for r in rects:
		var x0 := (float(r.x) - 0.5) * P; var z0 := (float(r.y) - 0.5) * P
		var sx := float(r.w) * P; var sz := float(r.h) * P
		var root := Node3D.new(); add_child(root); _keepout.append(root)
		MeshKit.add(root, MeshKit.rounded_box(Vector3(sx, 0.0002, sz), 0.0001), red, Vector3(x0 + sx * 0.5, 0.00035, z0 + sz * 0.5))
		for e in [[Vector3(sx, 0.0003, 0.0006), Vector3(x0 + sx * 0.5, 0.0004, z0)], [Vector3(sx, 0.0003, 0.0006), Vector3(x0 + sx * 0.5, 0.0004, z0 + sz)],
				[Vector3(0.0006, 0.0003, sz), Vector3(x0, 0.0004, z0 + sz * 0.5)], [Vector3(0.0006, 0.0003, sz), Vector3(x0 + sx, 0.0004, z0 + sz * 0.5)]]:
			MeshKit.add(root, MeshKit.rounded_box(e[0], 0.0001), line, e[1])
		# diagonal hatching, clipped to the square
		var step := 0.006
		var k := -sz
		while k < sx:
			var a := Vector2(maxf(k, 0.0), maxf(-k, 0.0)); var b := Vector2(minf(k + sz, sx), minf(sx - k, sz))
			if (b - a).length() > 0.002:
				var mid := (a + b) * 0.5; var len := (b - a).length()
				MeshKit.add(root, MeshKit.rounded_box(Vector3(len, 0.0002, 0.0004), 0.00005), line, Vector3(x0 + mid.x, 0.00045, z0 + mid.y), Vector3(0, -atan2(b.y - a.y, b.x - a.x), 0))
			k += step
		if text != "": MeshKit.label(root, text, 0.00005, Vector3(x0 + sx * 0.5, 0.0006, z0 + sz - 0.0030), Color(1.0, 0.92, 0.88), true)
