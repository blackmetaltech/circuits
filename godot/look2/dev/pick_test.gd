extends Node
## Dev check (CB_LOOK2_DEV=pick, on a real window): right-click on the drawn TOP of each faulty part of 1-2, sent through
## Input.parse_input_event in window pixels (the path a mouse takes, stretch transform included). Prints PICK lines.
var wb: Workbench

func _ready() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_L2_TICKET", "1-2")   # unlocks 1-2 on a fresh game
	wb = Workbench.new(); add_child(wb)
	var t0 := Time.get_ticks_msec()
	while not wb.backend.ENGINE and Time.get_ticks_msec() - t0 < 20000: await get_tree().process_frame
	wb.start_job("1-2"); for i in 20: await get_tree().process_frame
	wb.open_case(); for i in 40: await get_tree().process_frame
	var vp := get_viewport()
	for uid in ["x2", "x1", "x3"]:
		var n: Part3D = wb.parts3d.get(uid, null)
		if n == null: print("PICK no part ", uid); continue
		var bm := n.body_meshes[0] as MeshInstance3D
		var ab: AABB = bm.global_transform * bm.get_aabb()
		var top := ab.get_center() + Vector3(0, ab.size.y * 0.45, 0)
		var canvas_pt := wb.cam.unproject_position(top)
		var win_pt: Vector2 = vp.get_final_transform() * canvas_pt
		var before: int = wb.backend.parts.size()
		for pressed in [true, false]:
			var e := InputEventMouseButton.new(); e.button_index = MOUSE_BUTTON_RIGHT; e.pressed = pressed; e.position = win_pt; e.global_position = win_pt
			Input.parse_input_event(e); await get_tree().process_frame; await get_tree().process_frame
		for i in 5: await get_tree().process_frame
		print("PICK %s top at window %s: parts %d -> %d (%s)" % [uid, str(win_pt.round()), before, wb.backend.parts.size(), wb.note])
	print("PICK done")
