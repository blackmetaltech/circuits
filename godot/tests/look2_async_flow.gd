extends SceneTree
## 0.6: the live simulation on a worker thread (EngineBench.async_live, on in a real window). 5-1 switching at 100 Hz: the engine's
## time moves on while the main thread keeps rendering, an edit drops the frame that was in flight, power off empties the frame,
## and the worker stops cleanly.
##   godot --headless --path godot -s res://tests/look2_async_flow.gd
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

func _t() -> float: return float(wb.backend.frame.get("t", -1.0))

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb); await _frames(10)
	wb.backend.async_live = true
	wb.start_job("5-1"); await _frames(5)
	wb.open_case(); await _frames(3)
	ok(wb.backend.build_ref("5-1"), "5-1's reference build goes on")
	wb.sync_board()
	wb.backend.set_selector("pin", 2)
	if not wb.backend.powered: wb.toggle_power()
	var t0 := -1.0
	var ms := 0
	for i in 90:
		var a := Time.get_ticks_usec(); wb.backend.step(1.0 / 30.0); ms = maxi(ms, Time.get_ticks_usec() - a)
		if t0 < 0.0 and _t() >= 0.0: t0 = _t()
		await _frames(1)
		OS.delay_msec(8)
	var t1 := _t()
	ok(t0 >= 0.0 and t1 > t0, "the engine's time moves on from the worker (%.4f -> %.4f s)" % [t0, t1])
	print("  main-thread step: worst %.2f ms" % (ms / 1000.0))
	ok(ms < 8000, "the main thread never waits for a whole simulation frame (worst %.2f ms)" % (ms / 1000.0))
	ok((wb.backend.frame.get("parts", []) as Array).size() > 0, "the bench draws from the worker's frames (%d parts)" % (wb.backend.frame.get("parts", []) as Array).size())
	wb.toggle_power(); await _frames(2)
	for i in 10: wb.backend.step(1.0 / 30.0); await _frames(1); OS.delay_msec(8)
	ok(wb.backend.frame.is_empty() or not wb.backend.powered, "power off: no frame from before the switch is applied")
	wb.backend.stop_live_worker()
	ok(wb.backend._thr == null, "the worker stops")
	ok(trap.count == 0, "no script errors (%s)" % str(trap.lines.slice(0, 3)))
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
