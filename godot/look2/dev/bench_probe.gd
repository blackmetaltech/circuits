extends SceneTree
## QA: put tickets on the 3D bench headless (CB_TICKETS=2-2,2-4,...), build each ref, power, test; report what the bench lacks.
func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_MUTE", "1")
	var wb := Workbench.new(); root.add_child(wb)
	for i in 20: await process_frame
	wb.start_job("1-1"); for i in 3: await process_frame   # starts the campaign (a first start_job would reset the unlocks)
	for t in OS.get_environment("CB_TICKETS").split(","):
		wb.backend.unlock_through(t); wb.start_job(t); for i in 5: await process_frame
		wb.open_case(); for i in 5: await process_frame
		var kinds := {}
		for p in wb.backend.parts: kinds[str(p.partId)] = true
		var fixed: Array = wb.backend.ticket.get("fixed", []) if wb.backend.ticket is Dictionary else []
		print("TICKET %s parts at open: %s" % [t, str(kinds.keys())])
		var no3d: Array = []
		for p in wb.board.get_children() if wb.board else []: pass
		wb.backend.build_ref(t); wb.sync_board(); for i in 5: await process_frame
		var kinds2 := {}
		for p in wb.backend.parts: kinds2[str(p.partId)] = true
		print("TICKET %s parts in ref: %s" % [t, str(kinds2.keys())])
		if not wb.backend.powered: wb.toggle_power()
		for i in 30: await process_frame
		wb.run_test(); for i in 30: await process_frame
		print("TICKET %s test: passed=%s note=%s" % [t, str(wb.backend.passed), wb.note.substr(0, 160)])
		print("TICKET %s ticket keys: %s" % [t, str((wb.backend.ticket as Dictionary).keys())])
	quit()
