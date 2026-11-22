class_name Instruments3D
extends RefCounted
## LOOK2 bench instruments: shared helpers (click bodies, knurled knobs, seven-segment drawing, emissive screens).
## The instruments themselves live in scope3d.gd, dmm3d.gd, psu3d.gd, mcu3d.gd, fan3d.gd (Scope3D, Dmm3D, Psu3D, Mcu3D, Fan3D).
## All instruments face +Z, +Y up, origin on the desk under the middle of the instrument, metres, real size.

const FONT_MONO := "res://look2/assets/fonts/JetBrainsMono-Medium.ttf"
const FONT_UI := "res://look2/assets/fonts/Inter-SemiBold.ttf"

const SEGS := {"0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg",
	"9": "abcdfg", "-": "g", " ": "", "O": "abcdef", "L": "def", "F": "aefg", "E": "adefg", "r": "eg", "o": "cdeg", "A": "abcefg", "P": "abefg"}

## Plain metal / plastic for small round parts (the shared noise texture blotches on tiny UVs).
static func plain(albedo: Color, rough := 0.35, metal := 1.0) -> StandardMaterial3D:
	return MeshKit.mat(albedo, rough, metal, {"normal": 0.0, "rough_tex": false})

## A clickable part: StaticBody3D on collision layer 2 with meta "hit" = id and a box shape.
static func hit(parent: Node3D, id: String, size: Vector3, pos := Vector3.ZERO) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.name = "hit_" + id; b.collision_layer = 2; b.collision_mask = 0; b.set_meta("hit", id); b.position = pos
	var c := CollisionShape3D.new(); var s := BoxShape3D.new(); s.size = size; c.shape = s
	b.add_child(c); parent.add_child(b)
	return b

## Cylinder along Y (rotate to taste).
static func cyl(parent: Node3D, r: float, h: float, material: Material, pos := Vector3.ZERO, rot := Vector3.ZERO, seg := 32) -> MeshInstance3D:
	var cm := CylinderMesh.new(); cm.top_radius = r; cm.bottom_radius = r; cm.height = h; cm.radial_segments = seg; cm.rings = 1
	return MeshKit.add(parent, cm, fit_uv(material, r, h), pos, rot)

static var _fit := {}
## Cylinder UVs span 0..1 over the whole part, so the shared noise would blotch; a copy of the material with the UVs scaled to metres.
static func fit_uv(material: Material, r: float, h: float) -> Material:
	var sm := material as StandardMaterial3D
	if sm == null or not (sm.normal_enabled or sm.roughness_texture != null): return material
	var key := "%d_%d_%d" % [sm.get_instance_id(), int(r * 1e4), int(h * 1e4)]
	if not _fit.has(key):
		var d := sm.duplicate() as StandardMaterial3D
		d.uv1_scale = Vector3(maxf(TAU * r, 0.001) / 0.12, maxf(h, 0.001) / 0.12, 1.0)
		_fit[key] = d
	return _fit[key]

## Knurled knob body: flat-topped teeth around the rim, along Y, centred, closed top.
static func knurl_mesh(r_in: float, r_out: float, h: float, teeth := 36) -> ArrayMesh:
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts: Array = []
	for i in teeth:
		for k in 4:
			var a := TAU * (float(i) + float(k) * 0.25) / float(teeth)
			pts.append(Vector2(cos(a), sin(a)) * (r_out if k < 2 else r_in))
	var n := pts.size()
	var hy := h * 0.5
	for i in n:
		var p: Vector2 = pts[i]; var q: Vector2 = pts[(i + 1) % n]
		var e := q - p; var nrm := Vector3(e.y, 0, -e.x).normalized()
		if nrm.dot(Vector3(p.x, 0, p.y)) < 0: nrm = -nrm
		for v in [Vector3(p.x, -hy, p.y), Vector3(q.x, -hy, q.y), Vector3(q.x, hy, q.y), Vector3(p.x, -hy, p.y), Vector3(q.x, hy, q.y), Vector3(p.x, hy, p.y)]:
			st.set_normal(nrm); st.set_uv(Vector2(v.x, v.y)); st.add_vertex(v)
		for v in [Vector3(0, hy, 0), Vector3(q.x, hy, q.y), Vector3(p.x, hy, p.y)]:
			st.set_normal(Vector3.UP); st.set_uv(Vector2(v.x, v.z)); st.add_vertex(v)
	st.generate_tangents()
	return st.commit()

## A knurled knob lying on a panel facing +Z: base on the panel at `pos`, sticks out by h. Returns the node that turns (rotation.z).
static func knob(parent: Node3D, pos: Vector3, r: float, h: float, body: Material, cap: Material, pointer := Color(0.9, 0.9, 0.92)) -> Node3D:
	var root := Node3D.new(); root.position = pos + Vector3(0, 0, h * 0.5); parent.add_child(root)
	var inner := Node3D.new(); inner.rotation.x = PI / 2.0; root.add_child(inner)
	MeshKit.add(inner, knurl_mesh(r * 0.9, r, h, 36), body)
	cyl(inner, r * 0.74, 0.0008, cap, Vector3(0, h * 0.5 + 0.0003, 0), Vector3.ZERO, 40)
	var pm := MeshKit.mat(pointer, 0.5, 0.0, {"emission": pointer, "emission_energy": 0.25, "normal": 0.0})
	MeshKit.add(root, MeshKit.rounded_box(Vector3(0.0014, r * 0.5, 0.0006), 0.0003, 1), pm, Vector3(0, r * 0.45, h * 0.5 + 0.0007))
	return root

## A screen (energy > 0: self-lit; 0: reflective LCD): a SubViewport (size px) holding `content`, shown on an unlit-by-light quad. Returns the quad; vp is added under parent.
static func screen_quad(parent: Node3D, content: Control, px: Vector2i, size: Vector2, pos: Vector3, energy := 1.6, glass := true) -> MeshInstance3D:
	var vp := SubViewport.new(); vp.size = px; vp.disable_3d = true; vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS; vp.render_target_clear_mode = SubViewport.CLEAR_MODE_ALWAYS
	content.size = Vector2(px); vp.add_child(content); parent.add_child(vp)
	var qm := QuadMesh.new(); qm.size = size
	var m := StandardMaterial3D.new(); m.roughness = 0.35; m.metallic_specular = 0.6
	if energy > 0.0:   # self-lit screen
		m.albedo_color = Color(0, 0, 0); m.metallic_specular = 0.12
		m.emission_enabled = true; m.emission_texture = vp.get_texture(); m.emission_energy_multiplier = energy
	else:   # reflective LCD, lit by the room
		m.albedo_texture = vp.get_texture(); m.roughness = 0.28
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	var q := MeshKit.add(parent, qm, m, pos)
	q.set_meta("vp", vp)
	if glass:
		var gm := MeshKit.mat(Color(0.7, 0.8, 0.9, 0.07), 0.04, 0.0, {"alpha": 0.05, "normal": 0.0, "rough_tex": false})
		gm.metallic_specular = 0.8
		var g := MeshKit.add(parent, qm, gm, pos + Vector3(0, 0, 0.0007)); g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return q

## ---------------------------------------------------------------------------------------------- seven segments

static func _hexh(x0: float, x1: float, yc: float, t: float, shear: float, yb: float) -> PackedVector2Array:
	var p := PackedVector2Array([Vector2(x0, yc), Vector2(x0 + t * 0.5, yc - t * 0.5), Vector2(x1 - t * 0.5, yc - t * 0.5), Vector2(x1, yc), Vector2(x1 - t * 0.5, yc + t * 0.5), Vector2(x0 + t * 0.5, yc + t * 0.5)])
	for i in p.size(): p[i].x += (yb - p[i].y) * shear
	return p

static func _hexv(xc: float, y0: float, y1: float, t: float, shear: float, yb: float) -> PackedVector2Array:
	var p := PackedVector2Array([Vector2(xc, y0), Vector2(xc + t * 0.5, y0 + t * 0.5), Vector2(xc + t * 0.5, y1 - t * 0.5), Vector2(xc, y1), Vector2(xc - t * 0.5, y1 - t * 0.5), Vector2(xc - t * 0.5, y0 + t * 0.5)])
	for i in p.size(): p[i].x += (yb - p[i].y) * shear
	return p

## One digit in rect r. ch is a key of SEGS; ghost draws the unlit segments faintly. glow draws a soft halo behind lit ones.
static func draw_digit(ci: CanvasItem, ch: String, r: Rect2, col: Color, ghost: Color, dot := false, glow := false, shear := 0.08) -> void:
	var t := r.size.x * 0.17
	var g := t * 0.12
	var x0 := r.position.x + t * 0.5; var x1 := r.end.x - t * 0.5
	var y0 := r.position.y + t * 0.5; var y1 := r.end.y - t * 0.5; var ym := (y0 + y1) * 0.5
	var yb := r.end.y
	var polys := {
		"a": _hexh(x0 + t * 0.6 + g, x1 - t * 0.6 - g, y0, t, shear, yb), "g": _hexh(x0 + t * 0.6 + g, x1 - t * 0.6 - g, ym, t, shear, yb),
		"d": _hexh(x0 + t * 0.6 + g, x1 - t * 0.6 - g, y1, t, shear, yb),
		"b": _hexv(x1, y0 + t * 0.6 + g, ym - t * 0.6 - g, t, shear, yb), "c": _hexv(x1, ym + t * 0.6 + g, y1 - t * 0.6 - g, t, shear, yb),
		"f": _hexv(x0, y0 + t * 0.6 + g, ym - t * 0.6 - g, t, shear, yb), "e": _hexv(x0, ym + t * 0.6 + g, y1 - t * 0.6 - g, t, shear, yb)}
	var on: String = SEGS.get(ch, "")
	for k in polys:
		var poly: PackedVector2Array = polys[k]
		if on.contains(k):
			if glow:
				var loop := poly.duplicate(); loop.append(poly[0])
				ci.draw_polyline(loop, Color(col.r, col.g, col.b, 0.22), t * 0.9, true)
			ci.draw_colored_polygon(poly, col)
		elif ghost.a > 0.0:
			ci.draw_colored_polygon(poly, ghost)
	var dp := Vector2(r.end.x + t * 0.75 + (yb - y1) * shear, y1 + t * 0.25)
	if dot:
		if glow: ci.draw_circle(dp, t * 0.9, Color(col.r, col.g, col.b, 0.22))
		ci.draw_circle(dp, t * 0.5, col)
	elif ghost.a > 0.0:
		ci.draw_circle(dp, t * 0.5, ghost)

## Parse "12.00", "-0.5", " 1.2" into digit chars + dot flags (dot[i] = a dot after digit i) + sign.
static func parse_seg(text: String) -> Dictionary:
	var ch: Array = []; var dots: Array = []; var neg := false
	for i in text.length():
		var c := text[i]
		if c == "." and ch.size() > 0: dots[ch.size() - 1] = true
		elif c == "-" and ch.is_empty(): neg = true
		elif c != ".":
			ch.append(c); dots.append(false)
	return {"ch": ch, "dots": dots, "neg": neg}

## Generic 4-digit seven-segment panel (DMM LCD, PSU displays).
class SegPanel extends Control:
	var text := ""
	var ndig := 4
	var on_col := Color(0.05, 0.07, 0.05)
	var ghost_col := Color(0, 0, 0, 0.06)
	var bg_col := Color(0.6, 0.68, 0.52)
	var bg_col2 := Color(0.66, 0.74, 0.58)
	var glow := false
	var lit := true
	var digit_area := Rect2(40, 30, 320, 150)
	var shear := 0.08
	var extras: Array = []   ## [text, Vector2 baseline pos, font size, Color, bool mono]
	var _fmono: Font
	var _fui: Font

	func _init() -> void:
		_fmono = load(Instruments3D.FONT_MONO); _fui = load(Instruments3D.FONT_UI)

	func _draw() -> void:
		var sz := size
		draw_rect(Rect2(Vector2.ZERO, sz), bg_col)
		draw_rect(Rect2(0, 0, sz.x, sz.y * 0.5), bg_col2 if bg_col2 != bg_col else bg_col)
		if not lit: return
		var gap := digit_area.size.x / float(ndig)
		var dw := gap * 0.68
		var p := Instruments3D.parse_seg(text)
		var chars: Array = p.ch; var dots: Array = p.dots
		var pad := ndig - chars.size()
		for i in ndig:
			var rect := Rect2(digit_area.position.x + gap * i, digit_area.position.y, dw, digit_area.size.y)
			var j := i - pad
			var c := " "; var d := false
			if j >= 0 and j < chars.size(): c = chars[j]; d = dots[j]
			Instruments3D.draw_digit(self, c, rect, on_col, ghost_col, d, glow, shear)
		if p.neg:
			var rr := Rect2(digit_area.position.x - gap * 0.62, digit_area.position.y, dw, digit_area.size.y)
			Instruments3D.draw_digit(self, "-", rr, on_col, Color(0, 0, 0, 0), false, glow, shear)
		for e in extras:
			var f: Font = _fmono if e[4] else _fui
			draw_string(f, e[1], e[0], HORIZONTAL_ALIGNMENT_LEFT, -1, e[2], e[3])
