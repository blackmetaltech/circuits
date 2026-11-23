## Phase C+ (0.4.1): where view 1 puts the instruments, at 16:9 and 16:10, without rendering. Each object's merged mesh AABB is
## projected through the bench camera (vertical FOV kept, as Godot does); returned in canvas pixels (1920 wide), with what overlaps
## the paper ticket (top left) and the tool rail (bottom). Used by tests/look2_frame_flow.gd and by hand when tuning the layout.
class_name FrameCheck

static func aabb_of(n: Node3D) -> AABB:
	var out := AABB(); var first := true
	for m in n.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if not mi.is_visible_in_tree() or mi.mesh == null: continue
		var b: AABB = mi.global_transform * mi.get_aabb()
		if b.get_longest_axis_size() > 0.36: continue   # cables and leads run across the bench: the instrument is its body
		if first: out = b; first = false
		else: out = out.merge(b)
	return out

## Canvas-pixel rect of `n` seen by `cam` at `aspect` (canvas is 1920 wide, 1920/aspect tall).
static func rect(cam: Camera3D, n: Node3D, aspect: float) -> Rect2:
	var b := aabb_of(n)
	var proj := Projection.create_perspective(cam.fov, aspect, cam.near, cam.far, false)
	var inv := cam.global_transform.affine_inverse()
	var w := 1920.0; var h := 1920.0 / aspect
	var lo := Vector2(INF, INF); var hi := Vector2(-INF, -INF)
	for i in 8:
		var p: Vector3 = inv * b.get_endpoint(i)
		var c: Vector4 = proj * Vector4(p.x, p.y, p.z, 1.0)
		if c.w <= 0.0: continue
		var ndc := Vector2(c.x / c.w, c.y / c.w)
		var px := Vector2((ndc.x * 0.5 + 0.5) * w, (0.5 - ndc.y * 0.5) * h)
		lo = lo.min(px); hi = hi.max(px)
	return Rect2(lo, hi - lo)

## Canvas-pixel position of a world point.
static func point(cam: Camera3D, world: Vector3, aspect: float) -> Vector2:
	var p: Vector3 = cam.global_transform.affine_inverse() * world
	var c: Vector4 = Projection.create_perspective(cam.fov, aspect, cam.near, cam.far, false) * Vector4(p.x, p.y, p.z, 1.0)
	var w := 1920.0; var h := 1920.0 / aspect
	return Vector2((c.x / c.w * 0.5 + 0.5) * w, (0.5 - c.y / c.w * 0.5) * h)

## Outline (convex hull, canvas px) of a box of `size` centred at `center` in node `n`'s local frame: a tilted body, not its AABB.
static func box_hull(cam: Camera3D, n: Node3D, size: Vector3, center: Vector3, aspect: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 8:
		var o := Vector3(size.x * (0.5 if i & 1 else -0.5), size.y * (0.5 if i & 2 else -0.5), size.z * (0.5 if i & 4 else -0.5))
		pts.append(point(cam, n.global_transform * (center + o), aspect))
	return Geometry2D.convex_hull(pts)

## Is the interactive hit `id` (an Instruments3D.hit box under `inst`) covered on screen by `hull`? Its centre and four face corners.
static func hit_covered(cam: Camera3D, inst: Node3D, id: String, hull: PackedVector2Array, aspect: float) -> bool:
	var b := inst.find_child("hit_" + id, true, false) as StaticBody3D
	if b == null: return true
	var s: Vector3 = ((b.get_child(0) as CollisionShape3D).shape as BoxShape3D).size
	# centre, four face corners, and the printed label under the control (OUTPUT, TEST, VOLTAGE sit about 2 cm below)
	for o: Vector3 in [Vector3.ZERO, Vector3(-s.x, -s.y, 0) * 0.5, Vector3(s.x, -s.y, 0) * 0.5, Vector3(-s.x, s.y, 0) * 0.5, Vector3(s.x, s.y, 0) * 0.5, Vector3(-s.x * 0.5, -s.y * 0.5 - 0.012, 0), Vector3(s.x * 0.5, -s.y * 0.5 - 0.012, 0)]:
		if Geometry2D.is_point_in_polygon(point(cam, b.global_transform * o, aspect), hull): return true
	return false

## Footprint of `n` on the bench (XZ polygon, metres): its cabinet, the largest mesh box in its own frame, turned with it.
## (Probes, leads and knobs hang off the cabinet and are not what two instruments would collide with.)
static func footprint(n: Node3D) -> PackedVector2Array:
	var inv := n.global_transform.affine_inverse()
	var out := AABB(); var best := -1.0
	for m in n.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if not mi.is_visible_in_tree() or mi.mesh == null: continue
		var b: AABB = (inv * mi.global_transform) * mi.get_aabb()
		if b.get_longest_axis_size() > 0.36: continue
		if b.get_volume() > best: best = b.get_volume(); out = b
	var poly := PackedVector2Array()
	for c: Vector2 in [Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)]:
		var w: Vector3 = n.global_transform * (out.position + Vector3(out.size.x * c.x, 0, out.size.z * c.y))
		poly.append(Vector2(w.x, w.z))
	return poly
