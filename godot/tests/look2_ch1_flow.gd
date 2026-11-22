extends SceneTree
## LOOK2 chapter 1 end to end in the new look, on the real engine, through the Workbench's own controls (the methods its
## keys and buttons call): each repair arrives in its case, the case opens on the customer's faulty board, the bench fails
## it, the board is cleared and built to the reference, the bench passes and pays, the device is handed back, and "Next job"
## opens the next ticket. Then the free bench: place, power, save build 1, clear, load build 1.
##   godot --headless --path godot -s res://tests/look2_ch1_flow.gd         (exit code 0 = green; needs godot/sidecar/bridge.mjs)
var wb: Workbench
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
	var wallet0 := -1
	wb.start_job(); await _frames(10)
	for id in ["1-1", "1-2", "1-3", "1-4", "1-5"]:
		print("== ", id)
		ok(wb.ticket_id == id and str(wb.backend.ticket.get("id", "")) == id, "%s is the open job" % id)
		var repair: bool = id != "1-5"
		ok(wb.case_closed(), "the device arrives in its closed case")
		wb.open_case(); await _frames(5)
		ok(not wb.case_closed() and wb.note != "", "the case opens and says what is inside: %s" % wb.note)
		var faulty := 0
		for p in wb.backend._all_parts: if str(p.uid).begins_with("x"): faulty += 1
		var fw := 0
		for w in wb.backend.wires: if str(w.wid).begins_with("xw"): fw += 1
		ok((faulty + fw > 0) == repair, "the faulty board is on the bench (%d parts, %d wires)" % [faulty, fw])
		if repair:
			wb.toggle_power(); await _step(0.4)
			wb.run_test(); await _frames(3)
			ok(not wb.backend.passed, "the bench fails the device as it came in")
			if wb.backend.powered: wb.toggle_power()
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
		ok(wb.paid_text() != "nothing", "the pay is noted: %s" % wb.paid_text())
		if wallet0 >= 0: ok(wb.backend.wallet_minor > wallet0, "the wallet grows (%d -> %d)" % [wallet0, wb.backend.wallet_minor])
		wallet0 = wb.backend.wallet_minor
		wb.hand_back(); await _frames(5)
		ok(wb.handed and wb.case_node.state == "handed", "the device goes back to the customer")
		wb.next_job(); await _frames(10)
	ok(wb.mode == "title", "after the exam the bench goes back to the title")
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
	wb.back_to_title(); await _frames(5)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(wb._build_path(1)))
	ok(trap.count == 0, "zero script errors in the whole session (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
