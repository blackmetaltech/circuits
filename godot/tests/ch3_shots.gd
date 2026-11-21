extends Node
## Chapter 3 screenshot run (docs/screens/ch3): every ticket idle, mid-sweep, with its reference design locked, its designed failures (the loaded timer, the vented capacitor, the weak filter, the slow relay, the burnt coil), the exam slip and
## its debrief, the map and the notebook. Run through godot/tests/run_shots_ch3.sh (needs a display; one Godot process at a time). Each shot is <ticket>_<state>_<WxH>.png; the runner quantises them to 192 colours afterwards.
##   CB_SHOTS=ch3 CB_NOSAVE=1 CB_SHOT_DIR=<dir> godot --path godot --rendering-driver opengl3 --resolution 1920x1080
var sc: StallScene
var dir := ""
var tag := ""

func run(scene: StallScene) -> void:
	sc = scene; dir = OS.get_environment("CB_SHOT_DIR"); DirAccess.make_dir_recursive_absolute(dir)
	await _wait(1.0)
	tag = "%dx%d" % [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y]
	var only := OS.get_environment("CB_ONLY")
	var steps := ["s31", "s32", "s33", "s34", "maps"]
	for s in steps:
		if only != "" and not only.split(",").has(s): continue
		await call("_" + s)
	print("data frames ", Engine.get_frames_drawn())
	get_tree().quit()

func _wait(sec: float) -> void: await get_tree().create_timer(sec).timeout

func _shot(name: String) -> void:
	sc.window.t = 4.0
	await get_tree().process_frame
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png("%s/%s_%s.png" % [dir, name, tag]); print("shot ", name, "_", tag)

func _open(id: String) -> void:
	sc.backend.unlock_through(id); sc.start_ticket(id); sc.pages.show_page(""); await _wait(0.4)

func _w(a: Array, b: Array) -> void: sc.backend.add_wire(a, b)
func _item(partId: String, value, variant := "") -> Dictionary:
	for it in sc.backend.bin():
		if it.partId != partId: continue
		if value != null and absf(float(it.value) - float(value)) > 1e-12: continue
		if variant != "" and it.variant != variant: continue
		return it
	return {}

## wait until `cond` or `max` seconds (the sweeps are paced by the engine's frames: 100 of them, about three seconds of play)
func _until(cond: Callable, maxs: float) -> void:
	var t0 := Time.get_ticks_msec()
	while (Time.get_ticks_msec() - t0) < int(maxs * 1000.0) and not cond.call(): await get_tree().process_frame

func _s31() -> void:
	await _open("3-1"); await _wait(1.0); await _shot("3-1_idle")
	var bk = sc.backend
	# the loaded timer: 1 M + 1 u, forming, then complete and outside the tube, then the bench's verdict
	bk.place(_item("res-cf", 1e6, "0.25W"), 4, 2, 0); bk.place(_item("cap-el", 1e-6, "16V"), 14, 4, 1)
	_w([2, 2], [4, 2]); _w([8, 2], [14, 2]); _w([14, 2], [14, 4]); _w([14, 6], [14, 8])
	bk.set_probe("ch1", [14, 2]); bk.set_power(true)
	await _until(func(): return (bk.scope_view.trace.get("v", []) as Array).size() > 110, 12.0); await _shot("3-1_forming")
	await _until(func(): return bool(bk.scope_view.trace.get("complete", false)), 12.0); await _wait(0.5); await _shot("3-1_loaded")
	sc.run_bench(); await _wait(0.8); await _shot("3-1_loaded_fail")
	sc._scope_knob(1, 1); await _wait(2.5); await _shot("3-1_slow_knob")
	# the reference timer: LOCK and the customer's thanks
	await _open("3-1"); bk.build_ref("3-1"); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.4)
	bk.set_power(true)
	await _until(func(): return bk.locked, 14.0); await _wait(0.4); await _shot("3-1_ref")
	await _until(func(): return bk.passed, 8.0); await _wait(1.6); await _shot("3-1_passed")
	# a 6.3 V capacitor: the vent top swells, then pops
	await _open("3-1")
	bk.place(_item("res-cf", 10000, "0.25W"), 4, 2, 0); bk.place(_item("cap-el", 100e-6, "6.3V"), 14, 4, 1)
	_w([2, 2], [4, 2]); _w([8, 2], [14, 2]); _w([14, 2], [14, 4]); _w([14, 6], [14, 8])
	bk.set_probe("ch1", [14, 2]); bk.set_power(true)
	await _until(func(): return _max_bulge() > 0.6, 14.0); await _shot("3-1_swell")
	await _until(func(): return not bk.smoked.is_empty(), 14.0); await _wait(0.5); await _shot("3-1_vent")
	# a reversed capacitor
	await _open("3-1")
	bk.place(_item("res-cf", 10000, "0.25W"), 4, 2, 0); bk.place(_item("cap-el", 100e-6, "16V"), 14, 8, 3)
	_w([2, 2], [4, 2]); _w([8, 2], [14, 2]); _w([14, 2], [14, 6]); await _wait(0.5); await _shot("3-1_reversed_wired")

func _max_bulge() -> float:
	var m := 0.0
	for u in sc.backend.model.get("cap_bulge", {}): m = maxf(m, float(sc.backend.model.cap_bulge[u]))
	return m

func _s32() -> void:
	await _open("3-2"); await _wait(1.0); await _shot("3-2_idle")
	var bk = sc.backend
	bk.place(_item("res-cf", 1000, "0.25W"), 4, 8, 0); bk.place(_item("cap-cer", 10e-9, "50V"), 14, 9, 1)
	_w([2, 8], [4, 8]); _w([8, 8], [14, 8]); _w([14, 8], [14, 9])
	bk.set_probe("ch1", [14, 8]); bk.set_power(true)
	await _until(func(): return bool(bk.scope_view.trace.get("complete", false)), 14.0); await _wait(0.5); await _shot("3-2_weak")
	sc.run_bench(); await _wait(0.8); await _shot("3-2_weak_fail")
	await _open("3-2"); bk.build_ref("3-2"); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.4)
	bk.set_power(true)
	await _until(func(): return (bk.scope_view.trace.get("v", []) as Array).size() > 60, 10.0); await _shot("3-2_pressed")
	await _until(func(): return bk.locked, 14.0); await _wait(0.4); await _shot("3-2_ref")

func _s33() -> void:
	await _open("3-3"); await _wait(1.0); await _shot("3-3_idle")
	var bk = sc.backend
	_w([2, 2], [16, 4]); bk.set_power(true)
	await _until(func(): return bool(bk.scope_view.trace.get("complete", false)), 10.0); await _wait(0.5); await _shot("3-3_slow")
	sc.run_bench(); await _wait(0.8); await _shot("3-3_slow_fail")
	await _open("3-3"); bk.build_ref("3-3"); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.4)
	bk.set_power(true)
	await _until(func(): return (bk.scope_view.trace.get("v", []) as Array).size() > 40, 10.0); await _shot("3-3_rising")
	await _until(func(): return bk.locked, 14.0); await _wait(0.4); await _shot("3-3_ref")
	await _open("3-3"); _w([2, 5], [16, 4]); bk.set_power(true)
	await _until(func(): return not bk.smoked.is_empty(), 30.0); await _wait(0.6); await _shot("3-3_hot")

func _s34() -> void:
	await _open("3-4"); await _wait(0.8); await _shot("3-4_slip")
	var bk = sc.backend
	sc.pages.show_page(""); await _wait(0.4); await _shot("3-4_idle")
	for fld in [["pq", 180.0], ["pu", 9.9], ["pv", 40.0], ["pl", 12.0]]: bk.predict(fld[0], fld[1])
	sc._ticket_view(); bk.build_ref("3-4"); bk.predict("pq", 185.0); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.5)
	bk.set_power(true); await _wait(1.0); await _shot("3-4_ref")
	sc.run_bench(); await _wait(1.8)
	for i in 4: await _wait(0.4)
	await _shot("3-4_debrief")

func _maps() -> void:
	sc.go_map(); await _wait(1.0); sc.map_chapter = 3; sc.go_map(); await _wait(1.0); await _shot("map3")
	sc.pages.codex_i = 16; sc.pages.show_page("notebook"); await _wait(0.8); await _shot("notebook3"); sc.pages.codex_i = 18; await _wait(0.5); await _shot("notebook3_probe"); sc.pages.show_page("")
