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
