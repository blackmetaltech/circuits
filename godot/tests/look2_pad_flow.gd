extends SceneTree
## Phase C gamepad pass on the bench: pad events only (as a controller sends them), on the real engine.
## The left stick moves the cursor ring, A over a sorting-box compartment picks its part, B drops it, RB over a compartment
## steps the value, X powers the bench, Y runs the bench test; on the title the pad is left to Godot's focus navigation.
##   godot --headless --path godot -s res://tests/look2_pad_flow.gd
var wb: Workbench
var trap := ErrorTrap.new()
var fails := 0
var checks := 0

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_MUTE", "1")
	OS.add_logger(trap)
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _btn(b: int) -> void:
	for down in [true, false]:
		var e := InputEventJoypadButton.new(); e.button_index = b; e.pressed = down; e.device = 0
		Input.parse_input_event(e); await process_frame

func _axis(a: int, v: float) -> void:
	var e := InputEventJoypadMotion.new(); e.axis = a; e.axis_value = v; e.device = 0
	Input.parse_input_event(e); await process_frame

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb)
	await _frames(20)
	ok(wb.mode == "title" and wb.pad != null, "the title is up and the pad cursor exists")
	await _btn(JOY_BUTTON_X)
	ok(not wb.backend.powered and not wb.pad.active, "on the title the pad does not drive the bench")
	wb.start_job("1-1"); await _frames(10)
	wb.open_case(); await _frames(5)
	var p0: Vector2 = wb.pad.pos
	await _axis(JOY_AXIS_LEFT_X, 1.0); await _frames(10); await _axis(JOY_AXIS_LEFT_X, 0.0)
	ok(wb.pad.active and wb.pad.pos.x > p0.x + 50, "the left stick moves the cursor ring (%.0f -> %.0f px)" % [p0.x, wb.pad.pos.x])
	# aim at the sorting box's first compartment
	var si := 0
	for i in wb.sort_box.slots.size(): if (wb.sort_box.slots[i].fam.items as Array).size() > 1: si = i
	var cell: Node3D = wb.sort_box.slots[si].cell
	wb.pad.pos = wb.cam.unproject_position(cell.global_position + Vector3(0, 0.011, 0))
	await _frames(2)
	# headless text metrics blow the paper ticket up to ~2000 x 2800 px over the whole bench (430 px wide on a real window), and a Panel
	# rightly swallows clicks: hide the 2D overlay for the bench clicks here; the GPU-window hand play covers the real layout
	wb.ui.visible = false
	await _btn(JOY_BUTTON_A); await _frames(2)
	ok(wb.tool == "place" and str(wb.place_item.get("partId", "")) == str(wb.sort_box.slots[si].item.partId), "A over a compartment picks its part (%s)" % str(wb.place_item.get("partId", "")))
	var v0 = wb.place_item.get("value", null)
	await _btn(JOY_BUTTON_RIGHT_SHOULDER); await _frames(2)
	ok(wb.place_item.get("value", null) != v0, "RB over the compartment steps the value in hand (%s -> %s)" % [str(v0), str(wb.place_item.get("value", null))])
	await _btn(JOY_BUTTON_B); await _frames(2)
	ok(wb.tool == "select", "B drops the part in hand")
	wb.ui.visible = true
	await _btn(JOY_BUTTON_DPAD_UP); await _frames(2)
	ok(wb.tool == "wire", "D-pad up takes the wire tool")
	await _btn(JOY_BUTTON_START); await _frames(2)
	ok(wb.tool == "select", "Start goes back to the select tool")
	var view0: int = wb.view
	await _btn(JOY_BUTTON_DPAD_RIGHT); await _frames(2)
	ok(wb.view != view0, "D-pad right changes the view (%d -> %d)" % [view0, wb.view])
	var yaw0: float = wb.g_yaw
	await _axis(JOY_AXIS_RIGHT_X, 1.0); await _frames(6); await _axis(JOY_AXIS_RIGHT_X, 0.0)
	ok(absf(wb.g_yaw - yaw0) > 0.01, "the right stick orbits the view")
	await _btn(JOY_BUTTON_X); await _frames(3)
	ok(wb.backend.powered, "X powers the bench")
	ok(wb.pad.last_rumble == "power", "power gives a short rumble (%s)" % wb.pad.last_rumble)
	# 0.5: over something it can act on, the ring slows down (aim), so a leg is hit first time
	wb.hover_tip = ""; wb.hover_pad = Vector2i(-1, -1)
	var pa0: Vector2 = wb.pad.pos; wb.pad.axes[JOY_AXIS_LEFT_X] = 1.0; wb.pad._process(0.05); var free_step: float = wb.pad.pos.x - pa0.x
	wb.pad.pos = pa0; wb.hover_tip = "a part"; wb.pad._process(0.05); var aim_step: float = wb.pad.pos.x - pa0.x
	wb.pad.axes[JOY_AXIS_LEFT_X] = 0.0; wb.hover_tip = ""
	ok(free_step > 0.0 and aim_step < free_step * 0.6, "the ring slows over a target (%.1f px vs %.1f px per step)" % [aim_step, free_step])
	await _btn(JOY_BUTTON_Y); await _frames(5)
	ok(not wb.backend.passed and not wb.last_failure.is_empty(), "Y runs the bench test (it fails the torch as it came in: %s)" % str(wb.last_failure.get("text", "")).left(60))
	wb.back_to_title(); await _frames(5)
	ok(trap.count == 0, "zero script errors (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
