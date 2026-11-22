class_name MeshKit
extends RefCounted
## LOOK2 shared geometry and materials. Every 3D file in godot/look2/ builds on this.
##
## CONVENTIONS (all LOOK2 code follows them):
##   Units are metres. The board is drawn at 2x real scale: one engine pad pitch = PITCH (5 mm; a real perfboard is 2.54 mm),
##   so board parts are modelled at 2x their real size. Instruments, the fan, the desk and the room are real size.
##   Board local frame: pad (gx, gy) sits at (gx * PITCH, 0, gy * PITCH); +Y is up; y = 0 is the top copper of the board.
##   A board part is built with pin 0 at its local origin and its other pins at footprint offsets (fx, fy) -> (fx*PITCH, 0, fy*PITCH)
##   (footprints: NodeApi.FOOTPRINTS). The caller turns it with rotation.y = -rot * PI / 2 (engine quarter turns, clockwise on screen).
##   Leads end at y = -BOARD_T (through the board).

const PITCH := 0.005
const BOARD_T := 0.0016 * 2.0

static var _mats := {}
static var _noise_rough: Texture2D
static var _noise_nrm: Texture2D

## ------------------------------------------------------------------------------------------------ materials

## Shared micro-roughness noise (breaks the plastic CG look on every surface).
static func noise_rough() -> Texture2D:
	if _noise_rough == null:
		var n := FastNoiseLite.new(); n.frequency = 0.05; n.fractal_octaves = 4
		var t := NoiseTexture2D.new(); t.noise = n; t.width = 256; t.height = 256; t.seamless = true
		var ramp := Gradient.new(); ramp.set_color(0, Color(0.78, 0.78, 0.78)); ramp.set_color(1, Color(1.0, 1.0, 1.0))
		t.color_ramp = ramp   # the texture MULTIPLIES roughness: keep it in 0.78..1 or matte surfaces get mirror patches
		_noise_rough = t
	return _noise_rough

static func noise_normal() -> Texture2D:
	if _noise_nrm == null:
		var n := FastNoiseLite.new(); n.frequency = 0.08; n.fractal_octaves = 3
		var t := NoiseTexture2D.new(); t.noise = n; t.width = 256; t.height = 256; t.seamless = true; t.as_normal_map = true; t.bump_strength = 2.0
		_noise_nrm = t
	return _noise_nrm

## A PBR material. opts: emission (Color), emission_energy, clearcoat (0..1), normal (0..1 strength of the shared micro normal),
## rough_tex (bool: modulate roughness with noise), uv_scale (float), alpha (float < 1 = transparent), rim (0..1), aniso (0..1).
static func mat(albedo: Color, rough := 0.5, metal := 0.0, opts := {}) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = albedo; m.roughness = rough; m.metallic = metal
	m.metallic_specular = 0.5
	if opts.get("rough_tex", true):
		m.roughness_texture = noise_rough(); m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GRAYSCALE
	if float(opts.get("normal", 0.15)) > 0.0:
		m.normal_enabled = true; m.normal_texture = noise_normal(); m.normal_scale = float(opts.get("normal", 0.15))
	var uvs := float(opts.get("uv_scale", 1.0)); m.uv1_scale = Vector3(uvs, uvs, uvs); m.uv1_triplanar = bool(opts.get("triplanar", false))
	if opts.has("emission"):
		m.emission_enabled = true; m.emission = opts.emission; m.emission_energy_multiplier = float(opts.get("emission_energy", 1.0))
	if float(opts.get("clearcoat", 0.0)) > 0.0:
		m.clearcoat_enabled = true; m.clearcoat = float(opts.clearcoat); m.clearcoat_roughness = float(opts.get("clearcoat_rough", 0.15))
	if float(opts.get("alpha", 1.0)) < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.albedo_color.a = float(opts.alpha)
	if float(opts.get("rim", 0.0)) > 0.0:
		m.rim_enabled = true; m.rim = float(opts.rim)
	if float(opts.get("aniso", 0.0)) > 0.0:
		m.anisotropy_enabled = true; m.anisotropy = float(opts.aniso)
	return m

## Named shared materials (cached). Keys: copper, solder, tin, steel, brushed_alu, anodised, anodised_blue, black_epoxy, black_plastic,
## grey_plastic, fr4, fr4_dark, silk, rubber, glass, screen_glass, gold.
static func m(name: String) -> StandardMaterial3D:
	if _mats.has(name): return _mats[name]
	var r: StandardMaterial3D
	match name:
		"copper": r = mat(Color(0.86, 0.52, 0.34), 0.32, 1.0)
		"solder": r = mat(Color(0.78, 0.79, 0.80), 0.18, 1.0, {"normal": 0.3})
		"tin": r = mat(Color(0.80, 0.80, 0.78), 0.28, 1.0)
		"steel": r = mat(Color(0.62, 0.63, 0.64), 0.35, 1.0)
		"brushed_alu": r = mat(Color(0.75, 0.76, 0.78), 0.32, 1.0, {"aniso": 0.7})
		"anodised": r = mat(Color(0.075, 0.08, 0.09), 0.42, 0.85, {"normal": 0.08})
		"anodised_blue": r = mat(Color(0.08, 0.12, 0.20), 0.40, 0.85)
		"black_epoxy": r = mat(Color(0.035, 0.035, 0.038), 0.38, 0.0, {"clearcoat": 0.3})
		"black_plastic": r = mat(Color(0.03, 0.03, 0.032), 0.55, 0.0)
		"grey_plastic": r = mat(Color(0.22, 0.23, 0.24), 0.55, 0.0)
		"fr4": r = mat(Color(0.10, 0.28, 0.16), 0.30, 0.0, {"clearcoat": 0.6})
		"fr4_dark": r = mat(Color(0.05, 0.14, 0.08), 0.35, 0.0)
		"silk": r = mat(Color(0.92, 0.92, 0.88), 0.6, 0.0, {"normal": 0.0})
		"rubber": r = mat(Color(0.05, 0.05, 0.055), 0.85, 0.0, {"normal": 0.3})
		"glass": r = mat(Color(0.9, 0.95, 1.0), 0.03, 0.0, {"alpha": 0.25, "normal": 0.0, "rough_tex": false})
		"screen_glass": r = mat(Color(0.02, 0.02, 0.025), 0.05, 0.0, {"normal": 0.0, "rough_tex": false, "clearcoat": 1.0})
		"gold": r = mat(Color(1.0, 0.78, 0.38), 0.25, 1.0)
		_: r = mat(Color.MAGENTA, 0.5)
	_mats[name] = r
	return r

## ------------------------------------------------------------------------------------------------ geometry

## A box with rounded edges and corners (radius r, seg segments per rounded edge), centred on the origin, analytic normals,
## per-face planar UVs in metres (so textures keep their scale). Sharp boxes read as cheap CG: use this for every hard-surface body.
static func rounded_box(size: Vector3, r: float, seg := 3) -> ArrayMesh:
	var h := size * 0.5
	r = minf(r, minf(h.x, minf(h.y, h.z)) * 0.999)
	var inner := h - Vector3(r, r, r)
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var faces := [[Vector3.RIGHT, Vector3.BACK, Vector3.UP], [Vector3.LEFT, Vector3.FORWARD, Vector3.UP], [Vector3.UP, Vector3.RIGHT, Vector3.BACK],
		[Vector3.DOWN, Vector3.RIGHT, Vector3.FORWARD], [Vector3.BACK, Vector3.LEFT, Vector3.UP], [Vector3.FORWARD, Vector3.RIGHT, Vector3.UP]]
	for f in faces:
		var n: Vector3 = f[0]; var u: Vector3 = f[1]; var v: Vector3 = f[2]
		var su := _axis_samples(seg, absf(u.dot(h)), r); var sv := _axis_samples(seg, absf(v.dot(h)), r)
		var grid: Array = []
		for j in sv.size():
			var row: Array = []
			for i in su.size():
				# point on the unit cube surface: n + u*a + v*b with a, b in [-1, 1] after the rounded-corner mapping
				var a: float = su[i]; var b: float = sv[j]
				var p := n + u * a + v * b
				var q := Vector3(p.x * h.x, p.y * h.y, p.z * h.z)
				var c := Vector3(clampf(q.x, -inner.x, inner.x), clampf(q.y, -inner.y, inner.y), clampf(q.z, -inner.z, inner.z))
				var d := q - c
				var nn := d.normalized() if d.length() > 1e-9 else n
				row.append([c + nn * r, nn])
			grid.append(row)
		for j in sv.size() - 1:
			for i in su.size() - 1:
				var quad := [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
				for k in [0, 1, 2, 0, 2, 3]:
					var vv: Array = quad[k]
					var pos: Vector3 = vv[0]
					st.set_normal(vv[1])
					st.set_uv(Vector2(pos.dot(u), -pos.dot(v)))
					st.add_vertex(pos)
	st.generate_tangents()
	var mesh := st.commit()
	return mesh

## Samples in [-1, 1] for one face axis of half-size hh with rounded radius r: uniform ANGLE steps over each rounded zone
## (t = r * tan(theta), theta 0..45 deg; the neighbouring face draws the other 45), one span across the flat middle.
static func _axis_samples(seg: int, hh: float, r: float) -> Array:
	var inner := hh - r
	var lo: Array = []
	for i in seg + 1:
		var th := (PI / 4.0) * float(seg - i) / float(seg)
		lo.append(-(inner + r * tan(th)) / hh)
	var out: Array = lo.duplicate()
	for i in range(lo.size() - 1, -1, -1): out.append(-float(lo[i]))
	return out

## A tube along a polyline (radius, sides), parallel-transport frames, closed caps optional, UV v along length in metres.
static func tube(pts: PackedVector3Array, radius: float, sides := 10, caps := true) -> ArrayMesh:
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	if pts.size() < 2: return ArrayMesh.new()
	var t0 := (pts[1] - pts[0]).normalized()
	var nrm := t0.cross(Vector3.UP)
	if nrm.length() < 0.1: nrm = t0.cross(Vector3.RIGHT)
	nrm = nrm.normalized()
	var rings: Array = []
	var dist := 0.0
	for i in pts.size():
		var tg: Vector3
		if i == 0: tg = (pts[1] - pts[0]).normalized()
		elif i == pts.size() - 1: tg = (pts[i] - pts[i - 1]).normalized()
		else: tg = ((pts[i] - pts[i - 1]).normalized() + (pts[i + 1] - pts[i]).normalized()).normalized()
		nrm = (nrm - tg * nrm.dot(tg)).normalized()
		var bin := tg.cross(nrm)
		if i > 0: dist += pts[i].distance_to(pts[i - 1])
		var ring: Array = []
		for s in sides + 1:
			var a := TAU * float(s) / float(sides)
			var dir := nrm * cos(a) + bin * sin(a)
			ring.append([pts[i] + dir * radius, dir, Vector2(float(s) / float(sides), dist / (TAU * radius))])
		rings.append(ring)
	for i in rings.size() - 1:
		for s in sides:
			var q := [rings[i][s], rings[i][s + 1], rings[i + 1][s + 1], rings[i + 1][s]]
			for k in [0, 2, 1, 0, 3, 2]:
				st.set_normal(q[k][1]); st.set_uv(q[k][2]); st.add_vertex(q[k][0])
	if caps:
		for e in [0, rings.size() - 1]:
			var c: Vector3 = pts[e]
			var dn: Vector3 = (pts[0] - pts[1]).normalized() if e == 0 else (pts[e] - pts[e - 1]).normalized()
			for s in sides:
				var a: Vector3 = rings[e][s][0]; var b: Vector3 = rings[e][s + 1][0]
				var tri := [c, b, a] if e == 0 else [c, a, b]
				for p in tri: st.set_normal(dn); st.set_uv(Vector2(0.5, 0.5)); st.add_vertex(p)
	st.generate_tangents()
	return st.commit()

## Round off a Manhattan polyline's corners (radius rad, steps per corner) so wires and leads bend like real wire.
static func round_corners(pts: PackedVector3Array, rad: float, steps := 4) -> PackedVector3Array:
	if pts.size() < 3: return pts
	var out := PackedVector3Array(); out.append(pts[0])
	for i in range(1, pts.size() - 1):
		var a := pts[i - 1]; var b := pts[i]; var c := pts[i + 1]
		var r := minf(rad, minf(a.distance_to(b), b.distance_to(c)) * 0.45)
		var p0 := b + (a - b).normalized() * r; var p2 := b + (c - b).normalized() * r
		for s in steps + 1:
			var t := float(s) / float(steps)
			out.append(p0.lerp(b, t).lerp(b.lerp(p2, t), t))
	out.append(pts[pts.size() - 1])
	return out

## A MeshInstance3D with a mesh and material, added to parent at pos. Shadows on.
static func add(parent: Node3D, mesh: Mesh, material: Material, pos := Vector3.ZERO, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = material; mi.position = pos; mi.rotation = rot
	parent.add_child(mi)
	return mi

## Engraved / printed text on a surface (Label3D, no billboard, lies on the plane facing +normal_dir).
static func label(parent: Node3D, text: String, px: float, pos: Vector3, color := Color(0.85, 0.86, 0.88), mono := false, rot := Vector3(-PI / 2, 0, 0)) -> Label3D:
	var l := Label3D.new(); l.text = text; l.pixel_size = px; l.position = pos; l.rotation = rot
	l.modulate = color; l.outline_size = 0; l.billboard = BaseMaterial3D.BILLBOARD_DISABLED; l.shaded = true; l.double_sided = false
	l.font = load("res://look2/assets/fonts/JetBrainsMono-Medium.ttf" if mono else "res://look2/assets/fonts/Inter-SemiBold.ttf")
	l.font_size = 64; l.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	parent.add_child(l)
	return l
