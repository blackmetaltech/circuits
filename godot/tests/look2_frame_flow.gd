extends SceneTree
## 0.4.1 (Sigrid's UI finding): the default view (view 1) frames the device, the scope, the bench supply, the meter and the
## sorting box at 16:9 (1920x1080) and 16:10 (1280x800), clear of the paper ticket (top left) and the tool rail (bottom).
## Bounds are each object's merged mesh AABB (cables excluded), projected without rendering: they over-cover a rotated body,
## so the frame edge allows SLACK px; the GPU shots in docs/readme are the visual check.
##   godot --headless --path godot -s res://tests/look2_frame_flow.gd
const SLACK := 60.0
const TICKET := Rect2(30, 26, 440, 300)     ## the paper ticket's footprint before it grows (canvas px)
var fails := 0
var checks := 0

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_MUTE", "1")
	var wb := Workbench.new(); root.add_child(wb)
	for i in 20: await process_frame
	for t in ["1-1", "2-1", "2-3"]:
		wb.backend.unlock_through(t); wb.start_job(t); for i in 5: await process_frame
		wb.open_case(); wb.set_view(1, true); for i in 5: await process_frame
		for asp: float in [1920.0 / 1080.0, 1.6]:
			wb.g_dist = Workbench.V1_DIST * (1.78 / asp); wb.dist = wb.g_dist; wb._update_camera(1.0)
			var h := 1920.0 / asp
			for nm in ["scope", "psu", "dmm", "case_node", "sort_box"]:
				var r := FrameCheck.rect(wb.cam, wb.get(nm), asp)
				var inside: bool = r.position.x >= -SLACK and r.position.y >= -SLACK and r.end.x <= 1920.0 + SLACK and r.end.y <= h - 100.0
				var clear: bool = not r.intersects(TICKET) or nm == "scope" and r.position.x > TICKET.end.x
				ok(inside and clear, "%s %.2f: %s at x %d-%d, y %d-%d (canvas %dx%d)" % [t, asp, nm, r.position.x, r.end.x, r.position.y, r.end.y, 1920, h])
			ok(Geometry2D.intersect_polygons(FrameCheck.footprint(wb.scope), FrameCheck.footprint(wb.psu)).is_empty(), "%s %.2f: the scope and the supply stand apart on the bench" % [t, asp])
			# 0.5 (Sigrid): the meter, leaning on its kickstand, covers none of the supply's controls
			var hull := FrameCheck.box_hull(wb.cam, wb.dmm.get("_tilt"), Vector3(0.096, 0.21, 0.04), Vector3(0, 0, -0.005), asp)
			for id in ["psu_output", "psu_test", "psu_volt"]:
				ok(not FrameCheck.hit_covered(wb.cam, wb.psu, id, hull, asp), "%s %.2f: the meter leaves %s in view" % [t, asp, id])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
