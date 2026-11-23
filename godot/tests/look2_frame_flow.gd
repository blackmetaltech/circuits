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
	# 0.6 (Sigrid: the case was a quarter of the frame): view 2, the work view a job opens in, shows the open case at about 45 % of
	# the width, right of the paper ticket and above the tool rail, at 16:9, 16:10 and the 1078x800 window
	for t in ["1-1", "4-1"]:
		wb.backend.unlock_through(t); wb.start_job(t); for i in 5: await process_frame
		wb.open_case(); for i in 3: await process_frame
		ok(wb.view == 2, "%s: opening the case lands in the work view (view %d)" % [t, wb.view])
		for asp: float in [1920.0 / 1080.0, 1.6, 1078.0 / 800.0]:
			var wp: Array = wb.work_pose(asp)
			wb.tgt = wp[0]; wb.yaw = wp[1]; wb.pitch = wp[2]; wb.dist = wp[3]; wb.g_tgt = wb.tgt; wb.g_yaw = wb.yaw; wb.g_pitch = wb.pitch; wb.g_dist = wb.dist; wb._update_camera(1.0)
			var h := 1920.0 / asp
			var r := FrameCheck.rect(wb.cam, wb.case_node, asp)
			ok(r.size.x / 1920.0 > 0.38 and r.size.x / 1920.0 < 0.55, "%s %.2f: the case is %d %% of the width in the work view" % [t, asp, int(r.size.x / 19.2)])
			ok(r.position.x > TICKET.end.x and r.end.x <= 1920.0 + SLACK and r.end.y <= h - 100.0, "%s %.2f: the case is right of the ticket and above the rail (x %d-%d, y %d-%d)" % [t, asp, r.position.x, r.end.x, r.position.y, r.end.y])
	# 0.5 (Noor): with the wire tool, every connectable pad shows a ring, and the ground connector's tip says what it is
	wb.start_job("1-1"); for i in 5: await process_frame
	wb.open_case(); for i in 5: await process_frame
	wb.set_tool("wire"); for i in 2: await process_frame
	var nt: int = (wb.board.get("_targets") as Array).size()
	ok(nt >= 4, "the wire tool shows a ring on every pad an end can go to (%d)" % nt)
	var gtip := ""
	for c in wb.backend.bench_q.get("connectors", []): if str(c.get("role", "")) == "ground": gtip = wb.pad_tip(Vector2i(int(c.pad[0]), int(c.pad[1])))
	ok(gtip.contains("ground"), "the ground connector's tip says so (%s)" % gtip)
	wb.set_tool("select"); for i in 2: await process_frame
	ok((wb.board.get("_targets") as Array).is_empty(), "the rings go with the tool")
	var nb := BenchUI.nb_units("between 3.23 V and 3.37 V (3.3 V, 2 %), 10 kΩ, E1 and E2")
	ok(not nb.contains("2 %") and not nb.contains("3.3 V") and nb.contains("2\u00a0%") and nb.contains("10\u00a0kΩ") and nb.contains("E1 and"), "ticket numbers keep their units on one line: %s" % nb)
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
