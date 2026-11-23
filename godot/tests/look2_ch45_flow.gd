extends SceneTree
## LOOK2 chapters 4 and 5 on the bench (D-bench-ch45): 4-1 Wall Wart (mains: the safety card first), 4-2 Zener Shunt, 4-3 Hot
## Regulator (the thermal camera), 4-4 your own 3.3 V rail, 4-5 the Zener exam, 5-1 Fan Driver, 5-2 the LED strip gate, 5-3 a NAND
## from parts, 5-4 the synth preamp and 5-5 the amplifier exam, in campaign order, on the engine and through the Workbench's controls.
## Each ticket: it arrives in its own case as the text says, every part on the board has a model of its own and is in view at views
## 1 and 5, no device stands between the camera and an instrument's display, the bench fails the board as it came, the reference
## build passes and pays, it goes back to the customer and Next job opens the next ticket. 4-1 refuses power and the bench until the
## safety card on the ticket is read. Selectors are keys on the rail. The exams are marked on the ticket after their boxes are filled.
##   godot --headless --path godot -s res://tests/look2_ch45_flow.gd          (exit code 0 = green; needs godot/sidecar/bridge.mjs)
var wb: Workbench
var trap := ErrorTrap.new()
var fails := 0
var checks := 0
const BAD := ["real", "really", "reality", "realistic", "realism"]
const ORDER := ["4-1", "4-2", "4-3", "4-4", "4-5", "5-1", "5-2", "5-3", "5-4", "5-5"]
const BRAND := {"4-1": "VOLTEX", "4-2": "HALCYON", "4-3": "LAYERLINE", "4-4": "BENCH", "4-5": "EXAM", "5-1": "BREEZE", "5-2": "GLOWRAIL", "5-3": "ROBOCLUB", "5-4": "JUNO MUSIC", "5-5": "EXAM"}

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

func _button(prefix: String) -> Button:
	for b in wb.find_children("*", "Button", true, false): if (b as Button).text.begins_with(prefix) and (b as Button).is_visible_in_tree(): return b
	return null

func _label(text: String) -> bool:
	for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text == text and (lb as Label).is_visible_in_tree(): return true
	return false

## Every part on the board has a model of its own (not the labelled-box fallback) and stands inside the picture at views 1 and 5.
func _parts_read(id: String, when: String) -> void:
	var generic: Array = []; var off: Array = []
	for u in wb.parts3d:
		var n: Part3D = wb.parts3d[u]
		if n.generic: generic.append("%s %s" % [u, str(n.part.get("partId", ""))])
	ok(generic.is_empty(), "%s %s: no part is drawn as a plain box (%s)" % [id, when, str(generic)])
	for v in [1, 5]:
		wb.set_view(v, true); await _frames(4)
		var vs: Vector2 = wb.get_viewport().get_visible_rect().size
		for u in wb.parts3d:
			var n2: Part3D = wb.parts3d[u]
			var c: Vector3 = n2.to_global(n2._centre() + Vector3(0, 0.006, 0))
			var sp: Vector2 = wb.cam.unproject_position(c)
			if wb.cam.is_position_behind(c) or sp.x < 0 or sp.y < 0 or sp.x > vs.x or sp.y > vs.y: off.append("%s@view%d" % [u, v])
		ok(off.is_empty(), "%s %s: every part is in view at view %d (%s)" % [id, when, v, str(off)])
	wb.set_view(1, true); await _frames(4)

## No device on the bench (the fan, the microcontroller, the isolation transformer, the customer's case and lid) stands between the
## work-view camera and an instrument's display (the bench supply's two, the scope's screen, the meter's LCD).
func _readings_clear(id: String) -> void:
	wb.set_view(1, true); await _frames(4)
	var devices := {"the fan": wb.fan, "the microcontroller": wb.mcu, "the isolation transformer": wb.iso_box, "the customer's case": wb.case_node}
	var boxes: Array = []
	for nm in devices:
		var d = devices[nm]
		if d == null or not (d as Node3D).is_visible_in_tree(): continue
		for mi in (d as Node).find_children("*", "MeshInstance3D", true, false):
			if not (mi as MeshInstance3D).is_visible_in_tree(): continue
			var bb: AABB = ((mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()).abs()
			if bb.size.x > 0.004 and bb.size.y > 0.004 and bb.size.z > 0.004: bb = bb.grow(-0.001)   # a box that only grazes the line of sight is not in the way
			if bb.has_volume(): boxes.append([bb, nm])
	var hidden: Array = []
	var eye: Vector3 = wb.cam.global_position
	var instruments := {"the bench supply": wb.psu, "the scope": wb.scope, "the meter": wb.dmm}
	for inm in instruments:
		var ins = instruments[inm]
		if ins == null or not (ins as Node3D).is_visible_in_tree(): continue
		for q in (ins as Node).find_children("*", "MeshInstance3D", true, false):
			if not (q as Node).has_meta("vp"): continue
			var at: Vector3 = (q as Node3D).global_position
			for b in boxes:
				if (b[0] as AABB).intersects_segment(eye, at): hidden.append("a display of %s behind %s" % [inm, b[1]]); break
	ok(hidden.is_empty(), "%s: no device hides an instrument's display at view 1 %s" % [id, str(hidden)])

func _arrive(id: String) -> void:
	print("== ", id)
	ok(wb.ticket_id == id and str(wb.backend.ticket.get("id", "")) == id and wb.mode == "job", "%s is the open job" % id)
	ok(wb.case_closed(), "%s arrives in its closed case" % id)
	var al := wb.arrival_line()
	ok(al != "" and not al.begins_with("The device is on the bench") and _plain(al), "the arrival text says what the customer sees: %s" % al)
	ok(DeviceCase.device_of(id)[0] == BRAND[id], "%s has its own case (%s)" % [id, str(DeviceCase.device_of(id)[0])])
	ok(_plain(str(wb.backend.ticket.get("brief", ""))) and _plain(str(Workbench.OPEN_LINE.get(id, ""))) and Workbench.OPEN_LINE.has(id), "an open line, and no banned word in it or the brief")
	wb.open_case(); await _frames(5)
	ok(not wb.case_closed() and wb.note != "" and _plain(wb.note), "the case opens and says what is inside: %s" % wb.note)
	await _parts_read(id, "as it came")
	await _readings_clear(id)

func _bench() -> void:
	wb.run_test(); await _frames(5)

func _power(on: bool) -> void:
	if wb.backend.powered != on: wb.toggle_power()
	await _step(0.6)

## Each selector of the ticket is a row of keys on the rail, under its own label, and a key moves the engine's selector.
func _selectors(id: String) -> void:
	wb.changed.emit(); await _frames(3)
	for sl in wb.backend.selectors:
		if str(sl.id) == "pin": continue
		var opts: Array = sl.options
		var all := _label(str(sl.label))
		for o in opts: all = all and _button(str(o)) != null
		ok(all, "%s: the %s selector is on the rail as keys %s" % [id, str(sl.label), str(opts)])
	if wb.backend.selectors.is_empty() or str(wb.backend.selectors[0].id) == "pin": return
	var s0: Dictionary = wb.backend.selectors[0]
	var i0 := int(s0.get("index", 0)); var i1 := (i0 + 1) % (s0.options as Array).size()
	var k := _button(str(s0.options[i1]))
	if k: k.pressed.emit(); await _frames(3)
	var now := -1
	for sl in wb.backend.selectors: if str(sl.id) == str(s0.id): now = int(sl.index)
	ok(now == i1, "%s: the %s key sets the engine's selector (%d -> %d)" % [id, str(s0.options[i1]), i0, now])
	var back := _button(str(s0.options[i0]))
	if back: back.pressed.emit(); await _frames(3)

func _exam_boxes(vals: Array) -> void:
	wb.changed.emit(); await _frames(3)
	var boxes := wb.find_children("*", "LineEdit", true, false)
	ok(boxes.size() == vals.size(), "the exam ticket has a box per prediction (%d)" % boxes.size())
	wb.run_test(); await _frames(2)
	ok(not wb.backend.passed and wb.note.begins_with("Predict first"), "the bench asks for predictions first: %s" % wb.note)
	boxes = wb.find_children("*", "LineEdit", true, false)
	for i in mini(boxes.size(), vals.size()): (boxes[i] as LineEdit).text = str(vals[i])
	if not boxes.is_empty(): (boxes[0] as LineEdit).text_submitted.emit(str((boxes[0] as LineEdit).text)); await _frames(3)
	ok(wb.backend.predictions_done(), "Enter in a box locks the predictions in: %s" % wb.note)

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb)
	await _frames(20)
	wb.start_job(); await _frames(10)   # the campaign starts here (a first start_job resets the unlocks)
	ok(Workbench.BENCH_JOBS.slice(13) == ORDER, "the bench campaign runs chapters 4 and 5 in the engine's order after 3-4")
	wb.backend.unlock_through("4-1")
	wb.start_job("4-1"); await _frames(10)
	ok(not wb._showcase, "4-1 from the campaign is a job, not the showcase")
	for id in ORDER:
		await _arrive(id)
		var eb := bool(wb.backend.ticket.get("eb", false))
		if id == "4-1":
			# ---------------------------------------------------------------- mains: the safety card first
			ok(wb.backend.ticket.supply.kind == "mains" and wb.iso_box != null and wb.iso_box.visible, "the supply is the isolation transformer, and it stands on the bench")
			ok(wb.board._keepout.size() == 1, "the mains side is a red keep-out square on the board")
			wb.changed.emit(); await _frames(3)
			var card := _button(str(wb.backend.mains.get("button", "I have read it")))
			ok(card != null and wb.backend.safety_pending(), "the safety card is on the ticket with its key")
			ok(_label(str(wb.backend.mains.get("title", ""))), "the card's title is on the paper")
			wb.toggle_power(); await _frames(2)
			ok(not wb.backend.powered and wb.note.begins_with("Read the safety card"), "power stays off until the card is read: %s" % wb.note)
			wb.run_test(); await _frames(2)
			ok(not wb.backend.passed and not wb.backend.powered and wb.backend.last_result.is_empty(), "and the bench test does not run")
			await _key_space()
			ok(not wb.backend.powered, "Space does not switch it on either")
			wb.changed.emit(); await _frames(3)
			card = _button(str(wb.backend.mains.get("button", "I have read it")))   # the ticket was rebuilt by the refusals above
			if card: card.pressed.emit()
			await _frames(3)
			ok(not wb.backend.safety_pending() and _button(str(wb.backend.mains.get("button", "I have read it"))) == null, "the key reads the card (the engine's readSafety) and the card leaves the ticket")
			await _power(true)
			ok(wb.backend.powered, "after the card the bench powers the board")
			await _power(false)
		await _selectors(id)
		if eb:
			var pv: Array = []
			var R: Dictionary = EngineBench.REFS_CH4.get(id, EngineBench.REFS_CH5.get(id, {}))
			for pr in wb.backend.ticket.predictions: pv.append(R.pred.get(str(pr.id), 1.0))
			await _exam_boxes(pv)
		await _bench()
		ok(not wb.backend.passed, "the bench fails %s as it came (%s)" % [id, str(wb.last_failure.get("title", wb.note)).left(70)])
		await _power(false)
		var w0: int = wb.backend.wallet_minor
		ok(wb.backend.build_ref(id), "%s: the reference build goes on" % id)
		wb.sync_board(); await _frames(4)
		await _parts_read(id, "built")
		await _power(true)
		if id == "4-3":
			# ---------------------------------------------------------------- the thermal camera
			await _step(1.0)
			var k := _button("Thermal")
			ok(k != null, "4-3: the rail has the thermal camera key")
			var e := InputEventKey.new(); e.keycode = KEY_T; e.physical_keycode = KEY_T; e.pressed = true
			wb._unhandled_input(e); await _step(0.3)
			var reg: Part3D = null
			for u in wb.parts3d: if str((wb.parts3d[u] as Part3D).part.get("partId", "")) == "lm7805": reg = wb.parts3d[u]
			var tc := float(wb.backend._frame_part(str(reg.part.uid)).get("temp", 0.0)) if reg else 0.0
			var mo: Material = (reg.body_meshes[0] as MeshInstance3D).material_override if reg else null
			ok(wb.thermal and mo is StandardMaterial3D and (mo as StandardMaterial3D).emission_enabled and (mo as StandardMaterial3D).emission.is_equal_approx(Part3D.thermal_colour(tc)), "T switches the camera on: the 7805 shows its engine temperature (%.0f C) in false colour" % tc)
			ok(tc > 45.0 and wb.thermal_text().contains("C"), "the camera reads the hottest part: %s" % wb.thermal_text())
			wb._unhandled_input(e); await _step(0.2)
			ok(not wb.thermal and (reg.body_meshes[0] as MeshInstance3D).material_override != mo, "T again switches it off and the parts look as before")
		if id == "5-2":
			await _step(0.6)
			var strip: Part3D = null
			for u in wb.parts3d: if (wb.parts3d[u] as Part3D).anim.has("strip"): strip = wb.parts3d[u]
			var lens := ((strip.anim.strip[0] as MeshInstance3D).get_active_material(0) as StandardMaterial3D) if strip else null
			ok(lens != null and lens.emission_energy_multiplier > 3.0, "5-2: with the gate on, the strip's LEDs light (%.2f)" % (lens.emission_energy_multiplier if lens else -1.0))
		await _bench()
		ok(wb.backend.passed, "the bench passes %s (%s)" % [id, wb.note.left(90)])
		ok(wb.backend.wallet_minor > w0, "%s pays (%d -> %d)" % [id, w0, wb.backend.wallet_minor])
		wb.changed.emit(); await _frames(3)
		if eb:
			var marked := false
			for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.contains("you said"): marked = true
			ok(marked, "%s: the exam is marked on the ticket" % id)
		wb.hand_back(); await _frames(5)
		ok(wb.handed and wb.case_node.state == "handed", "%s goes back to the customer" % id)
		var nb := _button("Next job")
		ok(nb != null, "the ticket offers Next job")
		nb.pressed.emit(); await _frames(10)
		var i := ORDER.find(id)
		if i + 1 < ORDER.size(): ok(wb.mode == "job" and wb.ticket_id == ORDER[i + 1], "Next job after %s opens %s (%s)" % [id, ORDER[i + 1], wb.ticket_id])
	ok(wb.mode == "title", "after 5-5, the last job, the bench goes back to the title")
	wb.changed.emit(); await _frames(3)
	var stale := false
	for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.contains("classic 2D stall"): stale = true
	ok(not stale, "the title no longer sends chapters 4 and 5 to the classic stall")
	# 0.6 (Sigrid): Jobs is on the title strip; the classic look is an option under Settings
	var jobs := _button("Jobs"); var st := _button("Settings")
	ok(jobs != null and jobs.text == "Jobs" and st != null, "the title strip offers Jobs and Settings")
	if st: st.pressed.emit()
	await _frames(3)
	ok(_button("Classic 2D look") != null, "the classic look is an option under Settings")
	# the 5-1 showcase from the title stands alone: it does not run on into 5-2 and does not keep its unlocks
	wb._campaign = false
	wb.start_job("5-1"); await _frames(10)
	ok(wb._showcase, "5-1 from the title is the showcase")
	wb.next_job(); await _frames(5)
	ok(wb.mode == "title" and not wb._campaign, "Next job from the showcase goes back to the title and forgets its unlocks")
	ok(trap.count == 0, "zero script errors in the whole session (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)

func _key_space() -> void:
	var e := InputEventKey.new(); e.keycode = KEY_SPACE; e.physical_keycode = KEY_SPACE; e.pressed = true
	wb._unhandled_input(e); await _frames(2)
