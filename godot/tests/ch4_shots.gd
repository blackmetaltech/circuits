extends Node
## Chapter 4 screenshot run (docs/screens/ch4): the safety card, 4-1 idle with the keep-out and the isolation transformer, the reference locked (DC and AC coupled), mains high with no load, the naive builds (680 uF, 16 V, a reversed diode), 4-2 .. 4-4 with their
## references and designed failures, the thermal camera on the cycling regulator, the exam slip and its debrief, the map and the notebook. Run through godot/tests/run_shots_ch4.sh (needs a display; one Godot process at a time).
##   CB_SHOTS=ch4 CB_NOSAVE=1 CB_SHOT_DIR=<dir> godot --path godot --rendering-driver opengl3 --resolution 1920x1080
var sc: StallScene
var dir := ""
var tag := ""

func run(scene: StallScene) -> void:
	sc = scene; dir = OS.get_environment("CB_SHOT_DIR"); DirAccess.make_dir_recursive_absolute(dir)
	await _wait(1.0)
	tag = "%dx%d" % [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y]
	var only := OS.get_environment("CB_ONLY")
	var steps := ["s41", "s42", "s43", "s44", "s45", "maps"]
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

func _open(id: String, card := false) -> void:
	sc.backend.unlock_through(id); sc.start_ticket(id)
	if card: await _wait(0.4); return
	if sc.backend.safety_pending(): sc.backend.read_safety()
	sc.pages.show_page(""); await _wait(0.4)

func _w(a: Array, b: Array) -> void: sc.backend.add_wire(a, b)
func _item(partId: String, value, variant := "") -> Dictionary:
	for it in sc.backend.bin():
		if it.partId != partId: continue
		if value != null and absf(float(it.value) - float(value)) > 1e-12: continue
		if variant != "" and it.variant != variant: continue
		return it
	return {}

func _until(cond: Callable, maxs: float) -> void:
	var t0 := Time.get_ticks_msec()
	while (Time.get_ticks_msec() - t0) < int(maxs * 1000.0) and not cond.call(): await get_tree().process_frame

func _ref(id: String) -> void:
	sc.backend.build_ref(id); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.4)

func _s41() -> void:
	var bk = sc.backend
	await _open("4-1", true); sc.pages.safety_t = 7.0; await _wait(0.6); await _shot("4-1_safety")
	sc._on_page("safety_ok", ""); await _wait(0.8); await _shot("4-1_idle")
	await _ref("4-1"); bk.set_power(true)
	await _until(func(): return (bk.scope_view.trace.get("v", []) as Array).size() > 100, 12.0); await _shot("4-1_forming")
	await _until(func(): return bk.locked, 14.0); await _wait(0.4); await _shot("4-1_ref")
	bk.toggle_ac(); bk.set_volts_div(4); await _wait(0.6); await _shot("4-1_ac_ripple")
	bk.toggle_ac(); bk.set_volts_div(-4); bk.set_selector("mains", 2); bk.set_selector("load", 1)
	await _until(func(): return bool(bk.scope_view.trace.get("complete", false)), 12.0); await _wait(0.4); await _shot("4-1_nomload_high")
	await _until(func(): return bk.passed, 8.0); await _wait(0.1)
	await _open("4-1")
	bk.place(_item("1n4007", null, "DO41"), 14, 2, 0); bk.place(_item("1n4007", null, "DO41"), 14, 6, 0); bk.place(_item("1n4007", null, "DO41"), 18, 10, 2); bk.place(_item("1n4007", null, "DO41"), 18, 13, 2); bk.place(_item("cap-el", 680e-6, "25V"), 20, 6, 1)
	for w in EngineBench.REFS_CH4["4-1"].wires: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_probe("ch1", [22, 2]); bk.set_power(true)
	await _until(func(): return bool(bk.scope_view.trace.get("complete", false)), 12.0); await _wait(0.4)
	bk.toggle_ac(); bk.set_volts_div(4); await _wait(0.4); await _shot("4-1_680_ac")
	sc.run_bench(); await _wait(0.8); await _shot("4-1_680_fail")
	await _open("4-1")
	bk.place(_item("1n4007", null, "DO41"), 14, 2, 0); bk.place(_item("1n4007", null, "DO41"), 14, 6, 0); bk.place(_item("1n4007", null, "DO41"), 18, 10, 2); bk.place(_item("1n4007", null, "DO41"), 18, 13, 2); bk.place(_item("cap-el", 1000e-6, "16V"), 20, 6, 1)
	for w in EngineBench.REFS_CH4["4-1"].wires: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_probe("ch1", [22, 2]); bk.set_selector("mains", 2); bk.set_selector("load", 1); bk.set_power(true)
	await _until(func(): return bool(bk.scope_view.trace.get("complete", false)), 12.0); await _wait(0.4); await _shot("4-1_16v_live")
	sc.run_bench(); await _wait(0.8); await _shot("4-1_16v_fail")
	await _open("4-1")
	bk.place(_item("1n4007", null, "DO41"), 18, 2, 2); bk.place(_item("1n4007", null, "DO41"), 14, 6, 0); bk.place(_item("1n4007", null, "DO41"), 18, 10, 2); bk.place(_item("1n4007", null, "DO41"), 18, 13, 2); bk.place(_item("cap-el", 1000e-6, "25V"), 20, 6, 1)
	for w in EngineBench.REFS_CH4["4-1"].wires: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_power(true)
	await _until(func(): return not bk.smoked.is_empty(), 20.0); await _wait(0.6); await _shot("4-1_reversed_diode")

func _s42() -> void:
	var bk = sc.backend
	await _open("4-2"); await _wait(0.8); await _shot("4-2_idle")
	bk.place(_item("res-cf", 220, "1W"), 4, 2, 0); bk.place(_item("1n4733a", null, "DO41"), 12, 8, 3)
	for w in EngineBench.REFS_CH4["4-2"].wires: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_probe("ch1", [22, 2]); bk.set_power(true); await _wait(1.5); await _shot("4-2_drop")
	sc.run_bench(); await _wait(0.8); await _shot("4-2_drop_fail")
	await _open("4-2"); await _ref("4-2"); bk.set_power(true)
	await _until(func(): return bk.locked, 8.0); await _wait(0.4); await _shot("4-2_ref")
	bk.set_selector("input", 1); bk.set_selector("load", 1); await _wait(1.0); await _shot("4-2_ref_17v_noload")

func _s43() -> void:
	var bk = sc.backend
	await _open("4-3"); await _wait(0.6); await _shot("4-3_idle")
	bk.place(_item("lm7805", null, "TO220"), 10, 6, 0)
	_w([2, 2], [10, 6]); _w([12, 6], [22, 14]); _w([14, 6], [22, 2])
	bk.set_probe("ch1", [22, 2]); bk.set_power(true)
	await _until(func(): return bool(bk.scope_view.trace.get("complete", false)), 14.0); await _wait(0.4); await _shot("4-3_bare_cycling")
	bk.camera = true; bk._rebuild_model(); await _wait(0.6); await _shot("4-3_bare_camera")
	sc.run_bench(); await _wait(0.8); await _shot("4-3_bare_fail")
	await _open("4-3"); await _ref("4-3"); bk.set_power(true)
	await _until(func(): return bk.locked, 14.0); await _wait(0.6)
	bk.camera = true; bk._rebuild_model(); await _wait(0.5); await _shot("4-3_ref_camera")
	bk.camera = false; bk._rebuild_model(); await _wait(0.3); await _shot("4-3_ref")

func _s44() -> void:
	var bk = sc.backend
	await _open("4-4"); await _wait(0.6); await _shot("4-4_idle")
	bk.place(_item("lm317", null, "TO220"), 10, 8, 0); bk.place(_item("res-cf", 2400, "0.25W"), 12, 12, 0); bk.place(_item("res-cf", 3900, "0.25W"), 4, 12, 0)
	for w in EngineBench.REFS_CH4["4-4"].wires: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_probe("ch1", [22, 2]); bk.set_selector("load", 1); bk.set_power(true); await _wait(1.5); await _shot("4-4_noload_high")
	sc.run_bench(); await _wait(0.8); await _shot("4-4_noload_fail")
	await _open("4-4"); await _ref("4-4"); bk.set_power(true)
	await _until(func(): return bk.locked, 8.0); await _wait(0.4); await _shot("4-4_ref")

func _s45() -> void:
	var bk = sc.backend
	await _open("4-5"); sc.open_predict(); await _wait(0.8); await _shot("4-5_slip")
	sc.pages.show_page(""); await _wait(0.4); await _shot("4-5_idle")
	for fld in [["piz", 14.0], ["prl", 333.33], ["ppz", 120.0]]: bk.predict(fld[0], fld[1])
	sc._ticket_view(); bk.build_ref("4-5"); bk.predict("prl", 340.0); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.5)
	bk.set_power(true); await _wait(1.0); await _shot("4-5_ref")
	sc.run_bench(); await _wait(1.8)
	for i in 4: await _wait(0.4)
	await _shot("4-5_debrief")

func _maps() -> void:
	sc.go_map(); await _wait(1.0); sc.map_chapter = 4; sc.go_map(); await _wait(1.0); await _shot("map4")
	sc.pages.codex_i = 23; sc.pages.show_page("notebook"); await _wait(0.8); await _shot("notebook4_safety"); sc.pages.codex_i = 29; await _wait(0.5); await _shot("notebook4_zener"); sc.pages.show_page("")
