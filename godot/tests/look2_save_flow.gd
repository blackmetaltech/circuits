extends SceneTree
## LOOK2 save and continue: win 1-1 in the new look, hand it back, quit; a fresh Workbench opens 1-2 with the same wallet.
## Run with an isolated data dir:  XDG_DATA_HOME=$(mktemp -d) godot --headless --path godot -s res://tests/look2_save_flow.gd
var fails := 0
var checks := 0

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _initialize() -> void:
	_run()

func _run() -> void:
	var data := OS.get_environment("XDG_DATA_HOME")
	if data == "" or not data.begins_with("/tmp"):
		print("refusing to run without an XDG_DATA_HOME under /tmp (this test writes a real save)"); quit(2); return
	var wb := Workbench.new(); root.add_child(wb); await _frames(15)
	if wb.backend.has_save(): print("  (a save already exists in this data dir)")
	wb.start_job(); await _frames(10)
	ok(wb.ticket_id == "1-1", "a fresh save opens 1-1 (%s)" % wb.ticket_id)
	wb.open_case(); await _frames(3)
	wb.backend.build_ref("1-1"); wb.sync_board()
	wb.toggle_power()
	for i in 12: wb.backend.step(0.05); await process_frame
	wb.run_test(); await _frames(5)
	ok(wb.backend.passed, "1-1 passes")
	var wallet: int = wb.backend.wallet_minor
	wb.hand_back(); await _frames(3)
	wb.queue_free(); await _frames(5)
	var wb2 := Workbench.new(); root.add_child(wb2); await _frames(15)
	wb2.start_job(); await _frames(10)
	ok(wb2.ticket_id == "1-2", "after quitting, Jobs continues at 1-2 (%s)" % wb2.ticket_id)
	ok(wb2.backend.wallet_minor == wallet, "the wallet is kept (%d, %d)" % [wallet, wb2.backend.wallet_minor])
	wb2.queue_free(); await _frames(5)
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
