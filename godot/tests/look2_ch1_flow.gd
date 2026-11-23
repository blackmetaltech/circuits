extends SceneTree
## LOOK2 chapter 1 end to end in the new look, on the real engine, through the Workbench's own controls (the methods its
## keys and buttons call): each repair arrives in its case, the case opens on the customer's faulty board, the bench fails
## it, the board is cleared and built to the reference, the bench passes and pays, the device is handed back, and "Next job"
## opens the next ticket. Then the free bench: place, power, save build 1, clear, load build 1.
##   godot --headless --path godot -s res://tests/look2_ch1_flow.gd         (exit code 0 = green; needs godot/sidecar/bridge.mjs)
var wb: Workbench
const LevelBurnt := {"1-1": ["x1"], "1-4": ["x1"]}
var trap := ErrorTrap.new()
var fails := 0
var checks := 0

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1")
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

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb)
	await _frames(20)
	ok(wb.mode == "title", "the title is up")
	var names := []
	for b in wb.find_children("*", "Button", true, false): names.append((b as Button).text)
	ok(names.has("Quit") and names.has("High") and names.has("Low"), "the title has Quit and the graphics tiers (%s)" % str(names))
	var wallet0 := -1
	wb.start_job(); await _frames(10)
	for id in ["1-1", "1-2", "1-3", "1-4", "1-5", "2-1", "2-3"]:
		print("== ", id)
		ok(wb.ticket_id == id and str(wb.backend.ticket.get("id", "")) == id, "%s is the open job" % id)
		var repair: bool = id != "1-5" and id != "2-3"   # 2-3 is a replacement: the sealed box stays, the player builds its twin
		ok(wb.case_closed(), "the device arrives in its closed case")
		wb.open_case(); await _frames(5)
		ok(not wb.case_closed() and wb.note != "", "the case opens and says what is inside: %s" % wb.note)
		var faulty := 0
		for p in wb.backend._all_parts: if str(p.uid).begins_with("x"): faulty += 1
		var fw := 0
		for w in wb.backend.wires: if str(w.wid).begins_with("xw"): fw += 1
		ok((faulty + fw > 0) == repair, "the faulty board is on the bench (%d parts, %d wires)" % [faulty, fw])
		await _frames(3)
		for i in (LevelBurnt.get(id, []) as Array):
			var n = wb.parts3d.get(i, null)
			ok(n != null and n._smoked, "%s arrived burnt and is drawn charred (bench_q smoked: %s)" % [i, str((wb.backend.bench_q.get("parts", []) as Array).filter(func(q): return bool(q.get("smoked", false))).map(func(q): return q.uid))])
		if id == "1-1":
			# phase C: the tray is a sorting box on the bench and the bench test is a key on the supply (no 2D tray, no control plate)
			await _frames(3)
			ok(wb.sort_box.visible and wb.sort_box.slots.size() == 2, "the sorting box stands on the bench with the ticket's two parts (%d)" % wb.sort_box.slots.size())
			var texts := []
			for b in wb.find_children("*", "Button", true, false): texts.append((b as Button).text)
			ok(not texts.any(func(t): return str(t).begins_with("Bench test")) and wb.find_children("*", "ScrollContainer", true, false).is_empty(), "no 2D tray and no bench control plate on screen")
			wb._hit("tray:1"); await _frames(2)
			ok(wb.tool == "place" and str(wb.place_item.get("partId", "")) == str(wb.sort_box.slots[1].item.partId), "a click on a compartment picks its part (%s)" % str(wb.place_item.get("partId", "")))
			wb.set_tool("select")
		if repair:
			wb._hit("psu_output"); await _step(0.4)
			ok(wb.backend.powered, "OUTPUT on the bench supply powers the bench")
			if id == "1-1":
				# the torch's LED arrived burnt: the first powered frame must say so, not blame the player with a fresh burn (Noor, 0.4)
				await _frames(3)
				ok(str(wb.last_failure.get("title", "")).begins_with("This LED arrived burnt"), "an arrived-burnt part is named as the customer's damage: %s" % str(wb.last_failure.get("title", "")))
			wb._hit("psu_test"); await _frames(3)
			ok(not wb.backend.passed, "the bench fails the device as it came in")
			if wb.backend.powered: wb.toggle_power()
		if id == "1-5":
			# the exam: the paper ticket carries one box per prediction; the bench refuses until they are locked in
			wb.changed.emit(); await _frames(3)
			var boxes := wb.find_children("*", "LineEdit", true, false)
			ok(boxes.size() == 2, "the exam ticket has a box per prediction (%d)" % boxes.size())
			var says := false
			for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.replace("\u00a0", " ").contains("R3 = 6 ohm"): says = true   # numbers carry a no-break space before their unit (0.5)
			ok(says, "the exam ticket states the network to predict (R1, R2, R3, E1, E2)")
			wb.run_test(); await _frames(2)
			ok(not wb.backend.passed and wb.note.begins_with("Predict first"), "the bench asks for predictions first: %s" % wb.note)
			wb.lock_predictions([["pva", "abc"], ["pie2", "0.5"]]); await _frames(2)
			ok(not wb.backend.predictions_done() and wb.note.contains("not a number"), "a non-number is refused: %s" % wb.note)
			boxes = wb.find_children("*", "LineEdit", true, false)   # the ticket was rebuilt
			(boxes[0] as LineEdit).text = "6.667"; (boxes[1] as LineEdit).text = "0.5556"
			(boxes[1] as LineEdit).text_submitted.emit("0.5556"); await _frames(3)
			ok(wb.backend.predictions_done(), "Enter in a box locks the predictions in: %s" % wb.note)
		if id == "2-1":
			# phase C: chapter 2 on the bench; the station arrives with the unloaded divider and reads low
			ok(DeviceCase.device_of("2-1")[0] == "KAYA WX", "the weather station has its own case")
			if not wb.backend.powered: wb.toggle_power()
			await _step(0.6)
			wb.backend.set_dial("V"); wb.backend.set_probe("red", [14, 2]); wb.backend.set_probe("black", [14, 8]); await _step(0.2)
			ok(wb.meter_text().contains("2.7"), "the meter reads the loaded divider low (%s)" % wb.meter_text())
			# Cute mode (on by default): beads ride the wires that carry current, at the engine's speed; off, none
			await _frames(3)
			var beads := func() -> int:
				var n := 0
				for wid in wb.wires3d: for b in (wb.wires3d[wid] as Wire3D)._beads: if b.visible: n += 1
				return n
			ok(wb.cute and beads.call() > 0, "Cute mode puts current beads on the live wires (%d)" % beads.call())
			wb.set_cute(false); await _frames(2)
			ok(beads.call() == 0, "Cute off: no beads")
			wb.set_cute(true)
			wb.backend.set_probe("red", null); wb.backend.set_probe("black", null)
			if wb.backend.powered: wb.toggle_power()
		if id == "2-3":
			await _frames(3)
			var bb: Part3D = wb.parts3d.get("f1", null)
			ok(bb != null and bb.body_meshes.size() >= 1 and str(bb.part.get("partId", "")) == "blackbox", "the sealed box stands on the board as a module")
			var v0: float = wb.backend.supply_volts()
			ok(wb.supply_step(0.1) and is_equal_approx(wb.backend.supply_volts(), v0 + 0.1), "the VOLTAGE knob steps the supply 0.1 V (%.2f -> %.2f)" % [v0, wb.backend.supply_volts()])
			wb.supply_step(1.0); wb.supply_step(-0.01)
			ok(is_equal_approx(wb.backend.supply_volts(), v0 + 1.09), "Ctrl steps 1 V and Shift 0.01 V (%.2f V)" % wb.backend.supply_volts())
			ok(wb.hover_tip.begins_with("VOLTAGE"), "the tip line says the new setting: %s" % wb.hover_tip)
			wb.run_test(); await _frames(2)
			ok(not wb.backend.passed and str(wb.last_failure.get("text", "")).begins_with("Measure the sealed box first"), "the bench refuses the twin before the box has been metered: %s" % str(wb.last_failure.get("text", "")).left(70))
		if id == "1-5":
			# the tray arrows change the part in hand, not only the label (Noor placed a 6 ohm while the tile showed 2 ohm)
			var fam: Array = wb.drawer().filter(func(d): return str(d.partId) == "res-exact")
			wb.pick_part(fam[1]); await _frames(2)
			wb.tray_step("res-exact|ideal", fam, 2); await _frames(2)
			ok(float(wb.place_item.get("value", 0)) == float(fam[2].value), "stepping the tray changes the resistor in hand (%s ohm)" % str(wb.place_item.get("value")))
			wb.set_tool("select")
		ok(wb.backend.build_ref(id), "the reference build goes on (the old work is cleared first)")
		wb.sync_board(); await _frames(3)
		var left := 0
		for p in wb.backend._all_parts: if str(p.uid).begins_with("x"): left += 1
		ok(left == 0, "no part of the faulty board is left")
		if not wb.backend.powered: wb.toggle_power()
		await _step(0.6)
		# measure first (1-4 refuses the bench until the meter has been on the board): leads on the first two connectors
		var cs: Array = wb.backend.ticket.board.connectors
		wb.backend.set_dial("V"); wb.backend.set_probe("red", cs[0].pad); wb.backend.set_probe("black", cs[1].pad); await _step(0.2)
		wb.run_test(); await _frames(5)
		ok(wb.backend.passed, "the bench passes %s" % id)
		if id == "1-2":
			# 0.6: a series chain reads one current on all three LEDs, live, and the battery's current reads as a size (it showed
			# "-19.6 mA" and LEDs 2 and 3 carried the tired-battery test while LED 1 was live)
			var ls: Dictionary = wb.live_specs()
			ok(ls.has("led1") and ls.get("led1") == ls.get("led2") and ls.get("led2") == ls.get("led3"), "1-2: the three LEDs in series read the same live current (%s)" % str(ls))
			ok(ls.has("ibat") and not str(ls.ibat).begins_with("-") and wb.spec_text("ibat", -0.0196) == "19.6 mA", "1-2: the battery current reads as a size (%s, %s)" % [str(ls.get("ibat", "")), wb.spec_text("ibat", -0.0196)])
		if id == "2-1": ok(wb.spec_text("vout", 3.27) == "3.27 V", "the measured value carries the engine's unit (%s; it read \"3.27 W\")" % wb.spec_text("vout", 3.27))
		if id == "1-5":
			wb.changed.emit(); await _frames(3)
			var marked := false; var working_key: Button = null
			for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.contains("you said 6.667"): marked = true
			for b in wb.find_children("*", "Button", true, false): if (b as Button).text.begins_with("Show the working"): working_key = b
			ok(marked and working_key != null, "the exam is marked on the ticket: your numbers against the bench, and a key for the working")
			if working_key: working_key.pressed.emit(); await _frames(3)
			var answer := false
			for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.contains("6.67"): answer = true
			ok(answer and wb.ui.show_working, "the worked answer shows on request")
			wb.ui.show_working = false
		wb.changed.emit(); await _frames(3)
		var hb: Button = null
		for b in wb.find_children("*", "Button", true, false): if (b as Button).text.begins_with("Close up and hand back"): hb = b
		# the hand-back key comes before the spec rows on the paper ticket, so a tall ticket can never push it under the bench panels
		var first_spec := 99999
		if hb != null:
			var par := hb.get_parent()
			for i in par.get_child_count():
				var c := par.get_child(i)
				if c is HBoxContainer and c.get_child_count() >= 3 and str((c.get_child(0) as Label).text if c.get_child(0) is Label else "").begins_with("["): first_spec = mini(first_spec, i)
		ok(hb != null and hb.get_index() < first_spec, "the hand-back key sits above the spec rows on the ticket (key at %d, first spec at %d)" % [hb.get_index() if hb else -1, first_spec])
		if wallet0 >= 0: ok(wb.backend.wallet_minor > wallet0, "the wallet grows (%d -> %d)" % [wallet0, wb.backend.wallet_minor])
		wallet0 = wb.backend.wallet_minor
		wb.hand_back(); await _frames(5)
		ok(wb.handed and wb.case_node.state == "handed", "the device goes back to the customer")
		wb.next_job(); await _frames(10)
		if id == "2-1":
			# the bench campaign runs 2-1, 2-2, 2-3 (D-bench-ch23; look2_ch23_flow plays 2-2): this flow goes on to 2-3 by name
			ok(wb.ticket_id == "2-2", "'Next job' after 2-1 opens 2-2, the bench's next job (%s)" % wb.ticket_id)
			wb.start_job("2-3"); await _frames(10)
	ok(wb.ticket_id == "2-4", "'Next job' after 2-3 opens 2-4: chapter 2 goes on on the bench (%s)" % wb.ticket_id)
	wb.back_to_title(); await _frames(5)
	ok(wb.mode == "title", "back to the title")
	print("== free bench")
	wb.start_free(); await _frames(10)
	var item := {}
	for d in wb.drawer(): if str(d.partId) == "led-green-5mm": item = d; break
	ok(not item.is_empty(), "the free bench tray has every part (green LED found)")
	var before: int = wb.backend.parts.size()
	wb.backend.place(item, 4, 11, 0); wb.backend.place({"partId": "res-cf", "value": 1000, "variant": "0.25W", "kind": "R"}, 8, 11, 0)
	wb.backend.add_wire([4, 11], [3, 11])
	ok(wb.backend.parts.size() == before + 2, "two parts placed")
	wb.toggle_power(); await _step(0.3)
	ok(wb.backend.powered, "the free bench powers up")
	wb.backend.set_dial("V"); wb.backend.set_probe("red", [4, 11]); wb.backend.set_probe("black", [8, 11]); await _step(0.2)
	ok(wb.meter_text() != "" and not wb.meter_text().begins_with("off"), "the meter reads: %s" % wb.meter_text())
	wb.save_build(1); await _frames(2)
	ok(wb.has_build(1), "build 1 is saved")
	for p in wb.backend.parts.duplicate(): if not bool(p.get("fixed", false)): wb.backend.delete_part(str(p.uid))
	ok(wb.backend.parts.size() == before, "the board is cleared")
	wb.load_build(1); await _frames(3)
	ok(wb.backend.parts.size() == before + 2, "build 1 loads back: %s" % wb.note)
	# right-click on the middle of the resistor's body (not a leg) removes it
	wb.set_view(5, true); await _frames(3)
	wb.backend.add_wire([8, 11], [8, 14]); await _frames(2)   # a wire held only by the resistor's leg: it goes with the resistor
	var n_before: int = wb.backend.parts.size()
	var body_uid := ""
	for p in wb.backend.parts: if str(p.partId) == "res-cf": body_uid = str(p.uid)
	var body: Part3D = wb.parts3d.get(body_uid, null)
	var bm := body.body_meshes[0] as MeshInstance3D
	var ab: AABB = bm.global_transform * bm.get_aabb()
	var top: Vector3 = ab.get_center() + Vector3(0, ab.size.y * 0.5, 0)   # the top of the body, as the player sees it
	ok(top.y - wb.board.global_position.y > 0.002, "the resistor body stands above the board (%.4f m)" % (top.y - wb.board.global_position.y))
	wb._right_click(wb.cam.unproject_position(top))
	ok(wb.backend.parts.size() == n_before - 1 and wb.note.contains("removed"), "right-click on a part's body removes it: %s" % wb.note)
	ok(wb.note.contains("wire") and wb.note.contains("Ctrl+Z"), "and says which wires went with it (%s)" % wb.note)
	# click, then click draws a wire (Noor clicked twice and nothing happened; drag was the only way)
	var nw: int = wb.backend.wires.size()
	wb.set_tool("wire")
	var pa := wb.cam.unproject_position(wb.board.pad_world(12, 14)); var pb := wb.cam.unproject_position(wb.board.pad_world(16, 14))
	wb._left(true, pa); wb._left(false, pa); await _frames(2)
	ok(wb.note.begins_with("Wire from here"), "a click on a pad starts a wire and says how to end it: %s" % wb.note)
	wb._left(true, pb); wb._left(false, pb); await _frames(2)
	ok(wb.backend.wires.size() == nw + 1, "a second click on another pad ends it (%d -> %d wires)" % [nw, wb.backend.wires.size()])
	wb.set_tool("select")
	wb.back_to_title(); await _frames(5)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(wb._build_path(1)))
	ok(trap.count == 0, "zero script errors in the whole session (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
