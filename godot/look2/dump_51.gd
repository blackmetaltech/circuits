extends SceneTree
## Dev tool (LOOK2): dumps the real engine's 5-1 data to look2/fixtures/ so the 3D views can be built and checked against real shapes.
##   godot --headless --path godot -s res://look2/dump_51.gd
func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1")
	_run()

func _w(name: String, d) -> void:
	var f := FileAccess.open("res://look2/fixtures/%s.json" % name, FileAccess.WRITE)
	f.store_string(JSON.stringify(d, "  ")); f.close()

func _run() -> void:
	var b := EngineBench.new()
	var t0 := Time.get_ticks_msec()
	while not b.started and Time.get_ticks_msec() - t0 < 20000: await process_frame
	b.new_game(); b.unlock_through("5-1")
	b.open_ticket("5-1")
	_w("51_empty", {"card": b.card, "bench": b.bench_q, "ticket": b.ticket, "bin": b.bin(), "coach": b.coach_view()})
	b.build_ref("5-1"); b.set_probe("ch1", [16, 8])
	b.set_power(true)
	for i in 20: b.step(1.0 / 30.0)
	b.set_selector("pin", 2)
	for i in 12: b.step(1.0 / 30.0)
	_w("51_ref_pwm", {"scope_q": b.scope_q, "frame": b.frame, "passed": b.passed})
	b.set_selector("pin", 0)
	for i in 6: b.step(1.0 / 30.0)
	_w("51_ref_live", {"bench": b.bench_q, "frame": b.frame, "scope_q": b.scope_q, "scope_view": b.scope_view, "model": b.model, "dmm": b.dmm(), "result": b.last_result, "passed": b.passed})
	# the designed failure: no flyback diode
	b.set_power(false)
	for p in b.parts: if str(p.partId) == "1n4007": b.delete_part(str(p.uid))
	b.set_power(true)
	b.set_selector("pin", 2)
	var evs: Array = []
	b.event.connect(func(n, d): evs.append({"name": n, "data": d}))
	for i in 40: b.step(1.0 / 30.0)
	_w("51_noflyback", {"bench": b.bench_q, "frame": b.frame, "scope_q": b.scope_q, "scope_view": b.scope_view, "smoked": b.smoked, "events": evs, "coach": b.coach_view()})
	var r := b.run_bench()
	_w("51_noflyback_bench", {"run": r, "result": b.last_result})
	var sb := EngineBench.new(b.bridge)
	b._act("newGame", [1, "sandbox"])
	var ok := b.open_ticket("5-1")
	_w("sandbox", {"open": ok, "parts": b._q("parts", [false]), "bench": b.bench_q})
	print("DUMP OK")
	b.bridge.stop(); quit(0)
