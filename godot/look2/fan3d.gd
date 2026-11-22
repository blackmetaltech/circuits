class_name Fan3D
extends Node3D
## The device under repair: a small desk fan opened up. An 80 mm 12 V axial fan in a brushed-aluminium yoke on a weighted round base,
## front grille removed and lying beside it. Real size, facing +Z, origin on the desk under the base centre.

const FC := 0.112            ## fan centre height
const HALF := 0.040          ## 80 mm frame
const DEPTH := 0.025
const BORE := 0.0375
const R_HUB := 0.0158
const R_TIP := 0.0366
const MAX_REV := 14.0        ## visual rev/s at speed 1 (a real fan turns ~40; faster than this strobes at 60-144 fps, the blur disc carries the rest)
const TAU_S := 0.6           ## spin-up time constant, seconds

var _target := 0.0
var _spd := 0.0
var _rotor: Node3D
var _blade_mat: StandardMaterial3D
var _disc_mat: StandardMaterial3D
var _disc: MeshInstance3D
var _alpha_on := false
var _ends: Array = []

## Rounded-square outline (half side h, corner radius c): points in order, `n` per edge-run and `na` per corner arc.
static func _outline(h: float, c: float, n := 8, na := 6) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var corners := [Vector2(h - c, h - c), Vector2(-(h - c), h - c), Vector2(-(h - c), -(h - c)), Vector2(h - c, -(h - c))]
	for k in 4:
		var ctr: Vector2 = corners[k]
		var a0 := PI / 2.0 * k
		for j in na + 1:
			var a := a0 + (PI / 2.0) * float(j) / float(na)
			pts.append(ctr + Vector2(cos(a), sin(a)) * c)
	return pts

static func frame_mesh() -> ArrayMesh:
	var out := _outline(HALF, 0.008)
	var n := out.size()
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var zf := DEPTH * 0.5; var zb := -DEPTH * 0.5
	var inner := PackedVector2Array()
	for p in out: inner.append(p.normalized() * BORE)
	for i in n:
		var j := (i + 1) % n
		var o0 := out[i]; var o1 := out[j]; var i0 := inner[i]; var i1 := inner[j]
		# front annulus, back annulus, outer wall, bore wall
		for tri in [[Vector3(o0.x, o0.y, zf), Vector3(i0.x, i0.y, zf), Vector3(i1.x, i1.y, zf)], [Vector3(o0.x, o0.y, zf), Vector3(i1.x, i1.y, zf), Vector3(o1.x, o1.y, zf)]]:
			for v in tri: st.set_normal(Vector3.BACK); st.set_uv(Vector2(v.x, v.y)); st.add_vertex(v)
		for tri in [[Vector3(o0.x, o0.y, zb), Vector3(i1.x, i1.y, zb), Vector3(i0.x, i0.y, zb)], [Vector3(o0.x, o0.y, zb), Vector3(o1.x, o1.y, zb), Vector3(i1.x, i1.y, zb)]]:
			for v in tri: st.set_normal(Vector3.FORWARD); st.set_uv(Vector2(v.x, v.y)); st.add_vertex(v)
		var n0 := Vector3(o0.x, o0.y, 0).normalized(); var n1 := Vector3(o1.x, o1.y, 0).normalized()
		var e := (o1 - o0); var en := Vector3(e.y, -e.x, 0).normalized()
		if en.dot(Vector3(o0.x, o0.y, 0)) < 0: en = -en
		for k in [[o0, zf], [o0, zb], [o1, zb], [o0, zf], [o1, zb], [o1, zf]]:
			var q: Vector2 = k[0]; st.set_normal(en); st.set_uv(Vector2(q.x, k[1])); st.add_vertex(Vector3(q.x, q.y, k[1]))
		for k in [[i0, zf, 0], [i1, zb, 1], [i0, zb, 0], [i0, zf, 0], [i1, zf, 1], [i1, zb, 1]]:
			var q: Vector2 = k[0]; st.set_normal(-Vector3(q.x, q.y, 0).normalized()); st.set_uv(Vector2(q.x, k[1])); st.add_vertex(Vector3(q.x, q.y, k[1]))
	st.generate_tangents()
	return st.commit()

static func blade_mesh() -> ArrayMesh:
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES); st.set_smooth_group(0)
	var nu := 10; var nv := 4
	for i in nu + 1:
		for j in nv + 1:
			var u := float(i) / float(nu); var v := float(j) / float(nv)
			var r := lerpf(R_HUB - 0.0012, R_TIP, u)
			var hw := 0.20 + 0.10 * sin(PI * pow(u, 0.8)) - 0.05 * u
			var th := 0.65 * pow(u, 1.4) + (v - 0.5) * 2.0 * hw
			var tanp := lerpf(0.75, 0.30, u)
			var z := (v - 0.5) * 2.0 * hw * r * tanp
			st.set_uv(Vector2(u, v)); st.add_vertex(Vector3(cos(th) * r, sin(th) * r, z))
	for i in nu:
		for j in nv:
			var a := i * (nv + 1) + j
			for k in [a, a + 1, a + nv + 2, a, a + nv + 2, a + nv + 1]: st.add_index(k)
	st.generate_normals(); st.generate_tangents()
	return st.commit()

func _init() -> void:
	var plastic := MeshKit.mat(Color(0.052, 0.054, 0.058), 0.5, 0.0, {"clearcoat": 0.2, "normal": 0.2})
	var alu := MeshKit.m("brushed_alu")
	var fan := Node3D.new(); fan.position = Vector3(0, FC, 0); add_child(fan)
	# frame, holes, motor, struts
	MeshKit.add(fan, frame_mesh(), plastic)
	for sx in [-1, 1]:
		for sy in [-1, 1]:
			var hp := Vector3(sx * 0.0355, sy * 0.0355, 0)
			Instruments3D.cyl(fan, 0.0021, DEPTH + 0.0004, MeshKit.m("black_epoxy"), hp, Vector3(PI / 2, 0, 0), 16)
			Instruments3D.cyl(fan, 0.0032, 0.0006, MeshKit.m("black_epoxy"), hp + Vector3(0, 0, DEPTH * 0.5), Vector3(PI / 2, 0, 0), 16)
	Instruments3D.cyl(fan, 0.0185, 0.014, MeshKit.mat(Color(0.09, 0.09, 0.1), 0.35, 0.6), Vector3(0, 0, -0.008), Vector3(PI / 2, 0, 0), 32)
	for k in 4:
		var a := PI / 4.0 + k * PI / 2.0
		var s := MeshKit.add(fan, MeshKit.rounded_box(Vector3(0.0215, 0.0042, 0.0034), 0.0008, 2), plastic, Vector3(cos(a), sin(a), 0) * 0.0285 + Vector3(0, 0, -0.0105))
		s.rotation.z = a
	# rotor: hub with sticker, seven blades
	_rotor = Node3D.new(); fan.add_child(_rotor)
	Instruments3D.cyl(_rotor, R_HUB, 0.014, plastic, Vector3(0, 0, 0.0005), Vector3(PI / 2, 0, 0), 40)
	Instruments3D.cyl(_rotor, R_HUB * 0.97, 0.0006, plastic, Vector3(0, 0, 0.0076), Vector3(PI / 2, 0, 0), 40)
	Instruments3D.cyl(_rotor, 0.0125, 0.0003, MeshKit.mat(Color(0.5, 0.5, 0.48), 0.6, 0.0, {"normal": 0.0}), Vector3(0, 0, 0.0081), Vector3(PI / 2, 0, 0), 32)
	var lb := MeshKit.label(_rotor, "12V 0.20A", 0.000046, Vector3(0, 0.0, 0.00835), Color(0.06, 0.06, 0.07), true, Vector3.ZERO)
	lb.shaded = false
	_blade_mat = MeshKit.mat(Color(0.05, 0.052, 0.058, 1.0), 0.38, 0.0, {"clearcoat": 0.35, "normal": 0.1})
	_blade_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var bmesh := blade_mesh()
	for k in 7:
		var b := MeshKit.add(_rotor, bmesh, _blade_mat); b.rotation.z = TAU * k / 7.0
	# motion-blur disc (fades in at speed)
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.40, 0.44, 0.9, 1.0]); g.colors = PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 0), Color(1, 1, 1, 0.65), Color(1, 1, 1, 0.8), Color(1, 1, 1, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL; gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 256; gt.height = 256
	var qm := QuadMesh.new(); qm.size = Vector2(R_TIP * 2.06, R_TIP * 2.06)
	_disc_mat = MeshKit.mat(Color(0.07, 0.075, 0.085, 0.0), 0.55, 0.0, {"normal": 0.0, "rough_tex": false})
	_disc_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; _disc_mat.albedo_texture = gt; _disc_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_disc = MeshKit.add(fan, qm, _disc_mat, Vector3(0, 0, 0.004)); _disc.visible = false; _disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# yoke: two arms, a cross bar, a stem; pivot screws
	for sx in [-1, 1]:
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0055, 0.082, 0.015), 0.0024, 3), alu, Vector3(sx * 0.0468, FC - 0.034, 0))
		var scr := Node3D.new(); scr.position = Vector3(sx * 0.0512, FC, 0); scr.rotation.z = -sx * PI / 2.0; add_child(scr)
		MeshKit.add(scr, Instruments3D.knurl_mesh(0.0048, 0.0055, 0.006, 20), MeshKit.m("anodised"))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0991, 0.0095, 0.015), 0.0035, 3), alu, Vector3(0, FC - 0.0745, 0))
	Instruments3D.cyl(self, 0.0072, 0.02, alu, Vector3(0, 0.034, 0), Vector3.ZERO, 28)
	# weighted base
	var cm := CylinderMesh.new(); cm.top_radius = 0.0555; cm.bottom_radius = 0.0585; cm.height = 0.022; cm.radial_segments = 64
	MeshKit.add(self, cm, Instruments3D.fit_uv(MeshKit.m("anodised"), 0.057, 0.022), Vector3(0, 0.012, 0))
	Instruments3D.cyl(self, 0.0552, 0.0015, alu, Vector3(0, 0.0235, 0), Vector3.ZERO, 64)
	Instruments3D.cyl(self, 0.0565, 0.002, MeshKit.m("rubber"), Vector3(0, 0.001, 0), Vector3.ZERO, 64)
	# leads (0 red, 1 black) from the back of the frame down to the desk, ends bare
	var wire_r := 0.0012
	var starts := [Vector3(0.012, FC - 0.036, -DEPTH * 0.5), Vector3(0.019, FC - 0.036, -DEPTH * 0.5)]
	var ends_xz := [Vector2(0.099, 0.10), Vector2(0.118, 0.108)]
	for i in 2:
		var s: Vector3 = starts[i]; var e: Vector2 = ends_xz[i]
		var path := PackedVector3Array([s, s + Vector3(0, 0, -0.018), Vector3(s.x + 0.002 * i, 0.062, -0.074 - 0.006 * i), Vector3(s.x + 0.004, wire_r, -0.088 - 0.006 * i), Vector3(0.078 + 0.012 * i, wire_r, -0.082 - 0.005 * i), Vector3(0.106 + 0.012 * i, wire_r, -0.02), Vector3(0.108 + 0.01 * i, wire_r, 0.05), Vector3(e.x, wire_r, e.y - 0.008), Vector3(e.x, wire_r, e.y)])
		var col := MeshKit.mat(Color(0.42, 0.025, 0.02) if i == 0 else Color(0.03, 0.03, 0.035), 0.5, 0.0, {"normal": 0.0, "rough_tex": false})
		MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(path, 0.022, 6), wire_r, 8), col)
		var tip := Vector3(e.x, wire_r, e.y)
		MeshKit.add(self, MeshKit.tube(PackedVector3Array([tip, tip + Vector3(0, 0, 0.007)]), wire_r * 0.62, 8), Instruments3D.plain(Color(0.86, 0.52, 0.34), 0.3))
		_ends.append(tip + Vector3(0, 0, 0.007))
	Instruments3D.hit(self, "fan", Vector3(0.1, 0.1, 0.04), Vector3(0, FC, 0))
	_build_grille()
	set_speed(0.0)

func _build_grille() -> void:
	var g := Node3D.new(); g.position = Vector3(-0.118, 0.0012, 0.055); g.rotation = Vector3(-PI / 2, 0, 0.3); add_child(g)
	var wire := Instruments3D.plain(Color(0.62, 0.63, 0.64), 0.3)
	var r := 0.0006
	var sq := _outline(HALF, 0.008, 4, 5)
	var pts := PackedVector3Array()
	for p in sq: pts.append(Vector3(p.x, p.y, 0.0))
	pts.append(pts[0])
	MeshKit.add(g, MeshKit.tube(pts, r * 1.6, 6, false), wire)
	for rad in [0.011, 0.0185, 0.026, 0.0335]:
		var c := PackedVector3Array()
		for i in 49: c.append(Vector3(cos(TAU * i / 48.0), sin(TAU * i / 48.0), 0) * rad)
		MeshKit.add(g, MeshKit.tube(c, r, 5, false), wire)
	for k in 14:
		var a := TAU * k / 14.0
		MeshKit.add(g, MeshKit.tube(PackedVector3Array([Vector3(cos(a), sin(a), 0) * 0.0105, Vector3(cos(a), sin(a), 0) * 0.0338]), r, 5, false), wire)
	for k in 4:
		var a := PI / 4.0 + k * PI / 2.0
		MeshKit.add(g, MeshKit.tube(PackedVector3Array([Vector3(cos(a), sin(a), 0) * 0.034, Vector3(cos(a), sin(a), 0) * 0.0505]), r, 5, false), wire)
	Instruments3D.cyl(g, 0.0042, 0.0012, wire, Vector3(0, 0, 0.0), Vector3(PI / 2, 0, 0), 20)

func _process(delta: float) -> void:
	_spd += (_target - _spd) * (1.0 - exp(-delta / TAU_S))
	_rotor.rotation.z -= TAU * _spd * MAX_REV * delta
	_rotor.rotation.z = fmod(_rotor.rotation.z, TAU)
	var k := smoothstep(0.30, 0.80, _spd)
	var want_alpha := k > 0.01
	if want_alpha != _alpha_on:
		_alpha_on = want_alpha
		_blade_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA if want_alpha else BaseMaterial3D.TRANSPARENCY_DISABLED
		_disc.visible = want_alpha
	_blade_mat.albedo_color.a = lerpf(1.0, 0.6, k)
	_disc_mat.albedo_color.a = k * 0.55

## Normalised speed 0..1; the blades follow with inertia (time constant 0.6 s), up to 40 rev/s, blur disc fades in at speed.
func set_speed(norm: float) -> void:
	_target = clampf(norm, 0.0, 1.0)

## World position of the free end of a lead (0 red, 1 black): the bare copper tip.
func lead_end_world(i: int) -> Vector3:
	return to_global(_ends[clampi(i, 0, 1)])
