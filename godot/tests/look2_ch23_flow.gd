extends SceneTree
## LOOK2 chapters 2 and 3 on the bench (D-bench-ch23): 2-2 Cable Fault, 2-4 the slide-wire exam, 3-1 Flash Timer, 3-2 Debounce,
## 3-3 Relay Pull-in and 3-4 the capacitor exam, in campaign order, on the real engine and through the Workbench's own controls.
## Each ticket: it arrives in its case as the text says, every part on the board has a model of its own and is in view at views 1 and 5,
## the case opens on the board as it arrived, the bench fails it, the reference is built, the bench passes and pays. The null tickets
## (2-2, 2-4) are driven through the bench's own input path: press and drag on the slide wire, the wheel, the arrow keys, J, and the
## pad (A, the stick, RB, the right stick key). The exams are marked on the ticket after their prediction boxes are filled.
##   godot --headless --path godot -s res://tests/look2_ch23_flow.gd          (exit code 0 = green; needs godot/sidecar/bridge.mjs)
var wb: Workbench
var trap := ErrorTrap.new()
var fails := 0
var checks := 0
const BAD := ["real", "really", "reality", "realistic", "realism"]

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

func _step(sec: float) -> void:
	for i in int(sec / 0.05): wb.backend.step(0.05); await process_frame

func _plain(txt: String) -> bool:
	var low := txt.to_lower()
	for w in BAD:
		var rx := RegEx.new(); rx.compile("\\b%s\\b" % w)
		if rx.search(low) != null: return false
	return true

## the engine's frame part with this uid ({} when there is none)
func _fp(uid: String) -> Dictionary:
	for p in wb.backend.frame.get("parts", []): if str(p.uid) == uid: return p
	return {}

func _uA() -> float:
	for p in wb.backend.frame.get("parts", []): if p.has("galvo"): return float(p.galvo.get("uA", 0.0))
	return 0.0

func _part_val(uid: String) -> float:
	for p in wb.backend._all_parts: if str(p.uid) == uid and p.value != null: return float(p.value)
	return -1.0

func _part_text(uid: String) -> String:
	for p in wb.backend._all_parts: if str(p.uid) == uid: return "%s %s" % [str(p.partId), str(p.value)]
	return ""

## Every part on the board has a model of its own (not the labelled-box fallback) and stands inside the picture at views 1 and 5.
func _parts_read(id: String) -> void:
	var generic: Array = []; var off: Array = []
	for u in wb.parts3d:
		var n: Part3D = wb.parts3d[u]
		if n.generic: generic.append("%s %s" % [u, str(n.part.get("partId", ""))])
	ok(generic.is_empty(), "%s: no part is drawn as a plain box (%s)" % [id, str(generic)])
	for v in [1, 5]:
		wb.set_view(v, true); await _frames(4)
		var vs: Vector2 = wb.get_viewport().get_visible_rect().size
		for u in wb.parts3d:
			var n2: Part3D = wb.parts3d[u]
			var c: Vector3 = n2.to_global(n2._centre() + Vector3(0, 0.006, 0))
			var sp: Vector2 = wb.cam.unproject_position(c)
			if wb.cam.is_position_behind(c) or sp.x < 0 or sp.y < 0 or sp.x > vs.x or sp.y > vs.y: off.append("%s@view%d" % [u, v])
		ok(off.is_empty(), "%s: every part is in view at view %d (%s)" % [id, v, str(off)])
	wb.set_view(1, true); await _frames(4)

func _arrive(id: String, case_brand: String) -> void:
	print("== ", id)
	ok(wb.ticket_id == id and str(wb.backend.ticket.get("id", "")) == id, "%s is the open job" % id)
	ok(wb.case_closed(), "%s arrives in its closed case" % id)
	var al := wb.arrival_line()
	ok(al != "" and not al.begins_with("The device is on the bench") and _plain(al), "the arrival text says what the customer sees: %s" % al)
	ok(DeviceCase.device_of(id)[0] == case_brand, "%s has its own case (%s)" % [id, str(DeviceCase.device_of(id)[0])])
	ok(_plain(str(wb.backend.ticket.get("brief", ""))) and _plain(str(Workbench.OPEN_LINE.get(id, ""))), "no banned word in the brief or the open line")
	wb.open_case(); await _frames(5)
	ok(not wb.case_closed() and wb.note != "" and _plain(wb.note), "the case opens and says what is inside: %s" % wb.note)
	await _parts_read(id)

## the bench test as the player runs it (the Enter key's method)
func _bench() -> void:
	wb.run_test(); await _frames(5)

func _power(on: bool) -> void:
	if wb.backend.powered != on: wb.toggle_power()
	await _step(0.6)

## Where the slide wire is on screen at fraction t of its length (the point a press lands on).
func _wire_px(t: float) -> Vector2:
	var sw: Part3D = wb.parts3d.get("f3", null)
	return wb.cam.unproject_position(sw.to_global(Vector3(t * float(sw.anim.len), 0.0050, 0.0)))

func _mouse(button: int, down: bool, at: Vector2, mods := {}) -> void:
	var e := InputEventMouseButton.new(); e.button_index = button; e.pressed = down; e.position = at; e.global_position = at
	e.shift_pressed = bool(mods.get("shift", false)); e.ctrl_pressed = bool(mods.get("ctrl", false))
	wb._unhandled_input(e); await process_frame

func _motion(at: Vector2) -> void:
	var e := InputEventMouseMotion.new(); e.position = at; e.global_position = at; e.relative = Vector2(3, 0)
	wb._unhandled_input(e); await process_frame

func _key(kc: int, shift := false) -> void:
	var e := InputEventKey.new(); e.keycode = kc; e.physical_keycode = kc; e.pressed = true; e.shift_pressed = shift
	wb._unhandled_input(e); await process_frame

func _pad_btn(b: int) -> void:
	for down in [true, false]:
		var e := InputEventJoypadButton.new(); e.button_index = b; e.pressed = down; e.device = 0
		Input.parse_input_event(e); await process_frame

## Finds the balance with the bench's own controls and the needle alone: presses along the wire to bracket it, then the wheel (1 mm),
## then J and the arrow keys (0.1 mm). Returns the jockey position in mm.
func _find_null(id: String) -> float:
	var best_t := 0.5; var best := 1e9
	for i in range(1, 10):
		var t := float(i) / 10.0
		await _mouse(MOUSE_BUTTON_LEFT, true, _wire_px(t)); await _mouse(MOUSE_BUTTON_LEFT, false, _wire_px(t))
		await _step(0.15)
		if absf(_uA()) < best: best = absf(_uA()); best_t = t
	# bracket: bisect with presses between the two best tenths
	var lo := maxf(best_t - 0.1, 0.0); var hi := minf(best_t + 0.1, 1.0)
	await _mouse(MOUSE_BUTTON_LEFT, true, _wire_px(lo)); await _mouse(MOUSE_BUTTON_LEFT, false, _wire_px(lo)); await _step(0.15)
	var u_lo := _uA()
	for k in 7:
		var mid := (lo + hi) * 0.5
		await _mouse(MOUSE_BUTTON_LEFT, true, _wire_px(mid)); await _mouse(MOUSE_BUTTON_LEFT, false, _wire_px(mid)); await _step(0.15)
		if (_uA() > 0.0) == (u_lo > 0.0): lo = mid
		else: hi = mid
	# the wheel over the wire (1 mm a notch), then the fine step (J, arrows 0.1 mm)
	var over := _wire_px(float(wb.backend.jockey_mm()) / 1000.0)
	var dir := 1.0
	for i in 12:
		var u0 := absf(_uA())
		if u0 < 10.0: break
		await _mouse(MOUSE_BUTTON_WHEEL_UP if dir > 0 else MOUSE_BUTTON_WHEEL_DOWN, true, over); await _step(0.15)
		if absf(_uA()) > u0: dir = -dir
	await _key(KEY_J); await _frames(1)   # 1 mm -> 0.1 mm
	ok(is_equal_approx(wb.backend.jockey_step_mm(), 0.1), "J changes the jockey step to 0.1 mm (%s)" % str(wb.backend.jockey_step_mm()))
	dir = 1.0
	for i in 30:
		var u1 := absf(_uA())
		if u1 < 6.0: break
		await _key(KEY_RIGHT if dir > 0 else KEY_LEFT); await _step(0.15)
		if absf(_uA()) > u1: dir = -dir
	return wb.backend.jockey_mm()

func _exam_boxes(vals: Array) -> void:
	wb.changed.emit(); await _frames(3)
	var boxes := wb.find_children("*", "LineEdit", true, false)
	ok(boxes.size() == vals.size(), "the exam ticket has a box per prediction (%d)" % boxes.size())
	wb.run_test(); await _frames(2)
	ok(not wb.backend.passed and wb.note.begins_with("Predict first"), "the bench asks for predictions first: %s" % wb.note)
	boxes = wb.find_children("*", "LineEdit", true, false)
	for i in mini(boxes.size(), vals.size()): (boxes[i] as LineEdit).text = str(vals[i])
	if not boxes.is_empty(): (boxes[0] as LineEdit).text_submitted.emit(str((boxes[0] as LineEdit).text)); await _frames(3)
	ok(wb.backend.predictions_done() and wb.backend.answers_done(), "Enter in a box locks the predictions in: %s" % wb.note)

func _pass_and_hand_back(id: String, exam := false) -> void:
	await _bench()
	ok(wb.backend.passed, "the bench passes %s (%s)" % [id, wb.note])
	wb.changed.emit(); await _frames(3)
	if exam:
		var marked := false; var working := false
		for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.contains("you said"): marked = true
		for b in wb.find_children("*", "Button", true, false): if (b as Button).text.begins_with("Show the working"): working = true
		ok(marked and working, "%s: the exam is marked on the ticket (your numbers against the bench) with a key for the working" % id)
	wb.hand_back(); await _frames(5)
	ok(wb.handed and wb.case_node.state == "handed", "%s goes back to the customer" % id)

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb)
	await _frames(20)
	wb.start_job(); await _frames(10)   # the campaign starts here (a first start_job resets the unlocks)
	var wallet0: int = wb.backend.wallet_minor
	wb.backend.unlock_through("2-2")
	wb.start_job("2-2"); await _frames(10)
	var order := ["2-2", "2-4", "3-1", "3-2", "3-3", "3-4"]
	ok(Workbench.BENCH_JOBS.slice(5, 13) == ["2-1", "2-2", "2-3", "2-4", "3-1", "3-2", "3-3", "3-4"], "the bench campaign runs chapters 2 and 3 in the engine's order")

	# ---------------------------------------------------------------- 2-2 Cable Fault: arrives as the shorted cable, a null to find
	await _arrive("2-2", "CABLECREW")
	var kinds := {}
	for p in wb.backend._all_parts: kinds[str(p.partId)] = true
	ok(kinds.has("cell-2v") and kinds.has("cable-loop") and kinds.has("slidewire-m") and wb.backend.ticket.get("answers", []).size() == 1, "the board is the cell, the cable loop and the slide wire, and the slip asks for a distance (%s)" % str(kinds.keys()))
	await _bench()
	ok(not wb.backend.passed, "the bench fails the board as it arrived (no bridge wired)")
	# the reference bridge (R = 5 ohm, galvanometer, wires) without its stored answer: the distance goes in through the slip's box below
	var R2: Dictionary = EngineBench.REFS_CH2["2-2"]
	var built := true
	for pp in R2.parts: built = bool(wb.backend.place({"partId": pp[0], "value": pp[1], "variant": pp[2], "kind": "R"}, pp[3], pp[4], pp[5]).ok) and built
	for ww in R2.wires: built = bool(wb.backend._act("addWire", [ww]).get("ok", false)) and built
	ok(built, "the bridge is built (R = 5 ohm, the galvanometer, seven wires)")
	wb.sync_board(); await _frames(4)
	var sw: Part3D = wb.parts3d.get("f3", null)
	ok(sw != null and sw.anim.has("jockey") and sw.anim.has("readout"), "the slide wire has a jockey and a readout")
	var g: Part3D = null
	for u in wb.parts3d: if (wb.parts3d[u] as Part3D).anim.has("needle"): g = wb.parts3d[u]
	ok(g != null, "the galvanometer has a needle")
	await _power(true)
	# the mouse: a press on the wire puts the jockey under the pointer; a drag follows it
	await _mouse(MOUSE_BUTTON_LEFT, true, _wire_px(0.25)); await _step(0.2)
	ok(absf(wb.backend.jockey_mm() - 250.0) < 6.0, "a press on the 25 cm mark puts the jockey there (%.1f mm)" % wb.backend.jockey_mm())
	ok(absf(sw.anim.jockey.position.x - wb.backend.jockey_mm() / 1000.0 * 0.1) < 0.0005, "the drawn jockey stands where the engine's jockey is")
	await _motion(_wire_px(0.30)); await _step(0.2)
	ok(absf(wb.backend.jockey_mm() - 300.0) < 6.0, "dragging with the button down moves it (%.1f mm)" % wb.backend.jockey_mm())
	await _mouse(MOUSE_BUTTON_LEFT, false, _wire_px(0.30))
	await _motion(_wire_px(0.60)); await _step(0.1)
	ok(absf(wb.backend.jockey_mm() - 300.0) < 6.0, "after the button is up the jockey stays")
	ok(absf(_uA()) > 50.0 and absf(g.anim.needle.rotation.y) > 0.3, "off the balance the needle is well over (%.0f uA, needle %.2f rad)" % [_uA(), g.anim.needle.rotation.y])
	# the pad on the slide wire (pad events only; the 2D overlay is hidden as in look2_pad_flow, a Panel rightly swallows clicks)
	wb.ui.visible = false
	wb.set_tool("select")
	await _frames(3)
	wb.pad.pos = _wire_px(0.5); wb.pad.active = true; await _frames(2)
	await _pad_btn(JOY_BUTTON_A); await _step(0.2)
	ok(absf(wb.backend.jockey_mm() - 500.0) < 6.0, "the pad's A on the wire puts the jockey under the cursor (%.1f mm)" % wb.backend.jockey_mm())
	var j0: float = wb.backend.jockey_mm()
	wb.pad.pos = _wire_px(j0 / 1000.0)
	await _pad_btn(JOY_BUTTON_RIGHT_SHOULDER); await _step(0.2)
	ok(absf(wb.backend.jockey_mm() - j0 - 1.0) < 0.06, "RB over the wire steps the jockey by the step in force (1 mm at the start) (%.1f -> %.1f mm)" % [j0, wb.backend.jockey_mm()])
	var j1: float = wb.backend.jockey_mm()
	await _pad_btn(JOY_BUTTON_RIGHT_STICK); await _frames(2)
	ok(is_equal_approx(wb.backend.jockey_step_mm(), 0.1), "the right stick key changes the step (1 -> %s mm)" % str(wb.backend.jockey_step_mm()))
	await _pad_btn(JOY_BUTTON_LEFT_SHOULDER); await _step(0.2)
	ok(absf(wb.backend.jockey_mm() - j1 + 0.1) < 0.06, "and LB steps the other way by it (%.1f -> %.1f mm)" % [j1, wb.backend.jockey_mm()])
	wb.ui.visible = true
	wb.backend.jockey_step_i = 1   # back to 1 mm for the hand search below
	var null_mm := await _find_null("2-2")
	ok(absf(_uA()) < 10.0 and absf(g.anim.needle.rotation.y) < 0.18, "the null is found by hand at %.1f mm: %.1f uA, the needle on zero" % [null_mm, _uA()])
	ok(absf(null_mm - 400.0) < 1.0, "the balance is at 40.0 cm for R = 5 ohm and the 7.5 ohm loop (%.1f mm)" % null_mm)
	# the exam slip's distance box (2-2's answer): X = 7.5 ohm at 0.1 ohm per metre = 75 m
	wb.changed.emit(); await _frames(3)
	var boxes := wb.find_children("*", "LineEdit", true, false)
	ok(boxes.size() == 1, "the slip has one box, for the distance (%d)" % boxes.size())
	await _bench()
	ok(not wb.backend.passed, "the bench refuses until the distance is written down: %s" % wb.note.left(60))
	boxes = wb.find_children("*", "LineEdit", true, false)
	(boxes[0] as LineEdit).text = "75"; (boxes[0] as LineEdit).text_submitted.emit("75"); await _frames(3)
	ok(wb.backend.answers_done(), "the distance is locked in")
	await _pass_and_hand_back("2-2")
	wb.next_job(); await _frames(10)
	ok(wb.ticket_id == "2-3", "'Next job' after 2-2 opens 2-3 (the ch1 flow plays it): %s" % wb.ticket_id)
	wb.start_job("2-4"); await _frames(10)

	# ---------------------------------------------------------------- 2-4 the exam: a potentiometer
	await _arrive("2-4", "EXAM")
	ok(bool(wb.backend.ticket.get("eb", false)), "2-4 is an exam (the exam presentation)")
	await _exam_boxes([0.02, 1.5, 0.5])
	ok(wb.backend.build_ref("2-4"), "the potentiometer is built")
	wb.sync_board(); await _frames(4)
	sw = wb.parts3d.get("f3", null)
	await _power(true)
	await _mouse(MOUSE_BUTTON_LEFT, true, _wire_px(0.5)); await _mouse(MOUSE_BUTTON_LEFT, false, _wire_px(0.5)); await _step(0.2)
	ok(absf(wb.backend.jockey_mm() - 500.0) < 6.0, "the jockey goes where it is pressed (%.1f mm)" % wb.backend.jockey_mm())
	ok(absf(_uA()) > 50.0, "far from the balance the galvanometer is well off zero (%.0f uA)" % _uA())
	var null_mm2 := await _find_null("2-4")
	ok(absf(_uA()) < 19.5 and absf(null_mm2 - 750.0) < 2.0, "the open-circuit balance is found by hand at %.1f mm (the 75.0 cm of the card): %.1f uA" % [null_mm2, _uA()])
	await _pass_and_hand_back("2-4", true)
	wb.next_job(); await _frames(10)

	# ---------------------------------------------------------------- 3-1 Flash Timer: arrives with a 22 uF timing capacitor
	await _arrive("3-1", "SNAPLITE")
	ok(is_equal_approx(_part_val("x1"), 10000.0) and is_equal_approx(_part_val("x2"), 22e-6) and _part_text("x2").begins_with("cap-el"), "the flash arrives with 10 k and 22 uF (%s, %s)" % [_part_text("x1"), _part_text("x2")])
	await _power(true)
	await _bench()
	var tc: float = float((wb.backend.last_result.get("measured", {}) as Dictionary).get("tcross", -1.0))
	ok(not wb.backend.passed and tc > 0.15 and tc < 0.3, "the bench fails it: the ready-light comes on at %.3f s, not 1 s" % tc)
	await _power(false)
	ok(wb.backend.build_ref("3-1"), "the repair (100 uF) goes on")
	wb.sync_board(); await _frames(3)
	await _power(true)
	await _pass_and_hand_back("3-1")
	wb.next_job(); await _frames(10)

	# ---------------------------------------------------------------- 3-2 Debounce: the bouncing button, no filter
	await _arrive("3-2", "ARCADIA")
	ok(wb.contacts3d.has("btn") and (wb.contacts3d["btn"] as Contact3D).kind == "button", "the arcade button stands on the board between SW and GND")
	await _power(true)
	var saw := {"down": false, "up": false}
	for i in 60:
		wb.backend.step(0.05); await process_frame
		var cl := false
		for ct in wb.backend.frame.get("contacts", []): if str(ct.id) == "btn": cl = bool(ct.closed)
		var dome: Node3D = (wb.contacts3d["btn"] as Contact3D)._dome
		if cl and dome.position.y < 0.0100: saw.down = true
		if not cl and dome.position.y > 0.0110: saw.up = true
	ok(saw.down and saw.up, "the dome goes down when the engine's contact closes and comes up when it opens")
	await _bench()
	ok(not wb.backend.passed, "the bench fails the button as it arrived (a burst of presses): %s" % str(wb.last_failure.get("title", "")))
	await _power(false)
	ok(wb.backend.build_ref("3-2"), "the filter (47 k and 330 nF) goes on")
	wb.sync_board(); await _frames(3)
	await _power(true)
	await _pass_and_hand_back("3-2")
	wb.next_job(); await _frames(10)

	# ---------------------------------------------------------------- 3-3 Relay Pull-in: arrives behind 560 ohm
	await _arrive("3-3", "GREENLINE")
	ok(_part_text("x1").begins_with("res-cf") and is_equal_approx(_part_val("x1"), 560.0), "the controller arrives with a 560 ohm series resistor (%s)" % _part_text("x1"))
	var rl: Part3D = null
	for u in wb.parts3d: if (wb.parts3d[u] as Part3D).anim.has("armature"): rl = wb.parts3d[u]
	ok(rl != null, "the relay has an armature")
	await _power(true)
	var mA := 0.0
	for p in wb.backend.frame.get("parts", []): if p.has("relay"): mA = float(p.relay.get("mA", 0.0))
	ok(mA > 25.0 and mA < 36.0 and rl.anim.armature.rotation.z > 0.0, "the coil gets %.1f mA, short of the 40 mA pull-in: the armature stays up" % mA)
	await _bench()
	ok(not wb.backend.passed, "the bench fails it: %s" % str(wb.last_failure.get("title", "")))
	await _power(false)
	ok(wb.backend.build_ref("3-3"), "the repair (200 ohm 1 W) goes on")
	wb.sync_board(); await _frames(3)
	await _power(true)
	ok(rl.anim.armature.rotation.z < 0.0, "with the repair the engine says it pulled in: the armature drops onto the contact")
	await _pass_and_hand_back("3-3")
	wb.next_job(); await _frames(10)

	# ---------------------------------------------------------------- 3-4 the exam: a capacitor bank
	await _arrive("3-4", "EXAM")
	ok(bool(wb.backend.ticket.get("eb", false)), "3-4 is an exam")
	ok(wb.contacts3d.has("sw") and (wb.contacts3d["sw"] as Contact3D).kind == "knife", "the knife switch stands between B and D")
	await _exam_boxes([180, 9.9, 40, 12])
	ok(wb.backend.build_ref("3-4"), "both cards are built")
	wb.sync_board(); await _frames(4)
	var cc: Part3D = null
	for u in wb.parts3d: if (wb.parts3d[u] as Part3D).anim.has("level"): cc = wb.parts3d[u]
	ok(cc != null and cc.anim.level.scale.x > 0.9, "the charged capacitor arrives full (%.2f)" % (cc.anim.level.scale.x if cc else -1.0))
	await _power(true)
	await _step(0.4)
	ok(cc.anim.level.scale.x < 0.8, "after the switch shares the charge the gauge shows about 40 %% (%.2f)" % cc.anim.level.scale.x)
	await _pass_and_hand_back("3-4", true)
	ok(wb.backend.wallet_minor > wallet0, "the wallet grew over the six jobs (%d -> %d)" % [wallet0, wb.backend.wallet_minor])
	wb.next_job(); await _frames(10)
	ok(wb.mode == "job" and wb.ticket_id == "4-1", "after 3-4, 'Next job' opens 4-1: chapter 4 is on the bench (look2_ch45_flow plays it) (%s)" % wb.ticket_id)
	ok(trap.count == 0, "zero script errors in the whole session (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
