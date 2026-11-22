extends Node
## Chapter 4 screenshot run (docs/screens/ch4): the safety card, 4-1 idle with the keep-out and the isolation transformer, the reference locked (DC and AC coupled), mains high with no load, the naive builds (680 uF, 16 V, a reversed diode), 4-2 .. 4-4 with their
## references and designed failures, the thermal camera on the cycling regulator, the exam slip and its debrief, the map and the notebook. Run through godot/tests/run_shots_ch4.sh (needs a display; one Godot process at a time).
##   CB_SHOTS=ch5 CB_NOSAVE=1 CB_SHOT_DIR=<dir> godot --path godot --rendering-driver opengl3 --resolution 1920x1080
var sc: StallScene
var dir := ""
var tag := ""

func run(scene: StallScene) -> void:
	sc = scene; dir = OS.get_environment("CB_SHOT_DIR"); DirAccess.make_dir_recursive_absolute(dir)
	await _wait(1.0)
	tag = "%dx%d" % [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y]
	var only := OS.get_environment("CB_ONLY")
	var steps := ["s51", "s52", "s53", "s54", "s55", "maps"]
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

func _s51() -> void:
	var bk = sc.backend
	await _open("5-1"); await _wait(0.8); await _shot("5-1_idle")
	bk.place(_item("res-cf", 220, "0.25W"), 4, 7, 0); bk.place(_item("2n2222a", null, "TO92"), 14, 8, 0)
	for i in 5: var w: Array = EngineBench.REFS_CH5["5-1"].wires[i]; _w(w[0], w[w.size() - 1])
	bk.set_selector("pin", 2); bk.set_power(true)
	await _until(func(): return not bk.smoked.is_empty(), 20.0); await _wait(0.7); await _shot("5-1_no_diode_smoke")
	sc.run_bench(); await _wait(0.8); await _shot("5-1_no_diode_fail")
	await _open("5-1"); await _ref("5-1"); bk.set_selector("pin", 2); bk.set_power(true); await _wait(1.6); await _shot("5-1_ref_pwm")
	bk.set_selector("pin", 0)
	await _until(func(): return bk.locked, 8.0); await _wait(0.4); await _shot("5-1_ref_lock")
	await _open("5-1")
	bk.place(_item("res-cf", 8200, "0.25W"), 4, 7, 0); bk.place(_item("2n2222a", null, "TO92"), 14, 8, 0); bk.place(_item("1n4007", null, "DO41"), 10, 4, 0)
	for w in EngineBench.REFS_CH5["5-1"].wires: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_power(true); await _wait(1.0); sc.run_bench(); await _wait(0.8); await _shot("5-1_weak_base")

func _s52() -> void:
	var bk = sc.backend
	await _open("5-2"); await _wait(0.6); await _shot("5-2_idle")
	bk.place(_item("res-cf", 100, "0.25W"), 4, 8, 0); bk.place(_item("2n7000", null, "TO92"), 16, 8, 2)
	for w in [[[2, 8], [4, 8]], [[8, 8], [15, 8]], [[16, 8], [16, 14]], [[16, 14], [22, 14]], [[14, 8], [22, 4]]]: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_power(true); await _wait(3.0); await _shot("5-2_2n7000_hot")
	sc.run_bench(); await _wait(0.8); await _shot("5-2_2n7000_fail")
	await _open("5-2"); await _ref("5-2"); bk.set_selector("vth", 2); bk.set_power(true)
	await _until(func(): return bk.locked, 8.0); await _wait(0.4); await _shot("5-2_ref_max_vth")
	await _open("5-2")
	bk.place(_item("res-cf", 100, "0.25W"), 4, 8, 0); bk.place(_item("irlz44n", null, "TO220"), 12, 8, 0)
	for i in [0, 1, 2, 4, 5, 6, 7]: var w2: Array = EngineBench.REFS_CH5["5-2"].wires[i]; _w(w2[0], w2[w2.size() - 1])
	sc.run_bench(); await _wait(0.8); await _shot("5-2_no_pulldown_fail")

func _s53() -> void:
	var bk = sc.backend
	await _open("5-3"); await _wait(0.6); await _shot("5-3_idle")
	await _ref("5-3"); bk.set_power(true)
	await _until(func(): return bk.locked, 8.0); await _wait(0.4); await _shot("5-3_ref_high")
	bk.set_selector("a", 1); bk.set_selector("b", 1); await _wait(1.5); await _shot("5-3_ref_both_high")
	await _open("5-3")
	var ps: Array = EngineBench.REFS_CH5["5-3"].parts
	for i in ps.size(): bk.place(_item(str(ps[i][0]), (47e3 if i == 7 else ps[i][1]), str(ps[i][2])), int(ps[i][3]), int(ps[i][4]), int(ps[i][5]))
	for w in EngineBench.REFS_CH5["5-3"].wires: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_probe("ch1", [22, 6]); bk.set_power(true); await _wait(1.2); sc.run_bench(); await _wait(0.8); await _shot("5-3_weak_pullup_fail")

func _s54() -> void:
	var bk = sc.backend
	await _open("5-4"); await _wait(0.6); await _shot("5-4_idle")
	await _ref("5-4"); bk.set_power(true); await _wait(2.0); await _shot("5-4_ref_scope")
	bk.set_selector("beta", 2); await _wait(1.0); await _shot("5-4_ref_beta300")
	sc.run_bench(); await _wait(1.0); await _shot("5-4_ref_pass")
	await _open("5-4")
	var ps: Array = EngineBench.REFS_CH5["5-4"].parts
	for i in ps.size(): if i != 4: bk.place(_item(str(ps[i][0]), ps[i][1], str(ps[i][2])), int(ps[i][3]), int(ps[i][4]), int(ps[i][5]))
	for w in [[[2, 1], [8, 3]], [[8, 3], [12, 3]], [[8, 7], [8, 9]], [[8, 9], [12, 9]], [[6, 8], [8, 7]], [[2, 8], [4, 8]], [[12, 7], [12, 8]], [[12, 8], [14, 8]], [[16, 8], [22, 8]], [[12, 10], [22, 14]], [[8, 13], [22, 14]]]: _w((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	bk.set_probe("ch1", [22, 8]); bk.set_power(true); await _wait(2.0); sc.run_bench(); await _wait(0.8); await _shot("5-4_no_re_fail")

func _s55() -> void:
	var bk = sc.backend
	await _open("5-5"); sc.open_predict(); await _wait(0.8); await _shot("5-5_slip")
	sc.pages.show_page(""); await _wait(0.4); await _shot("5-5_idle")
	for fld in [["pib", 20.0], ["pic", 2.0], ["pvce", 6.0], ["pav", -232.0]]: bk.predict(fld[0], fld[1])
	sc._ticket_view(); bk.build_ref("5-5"); bk.predict("pav", -200.0); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.5)
	bk.set_power(true); await _wait(1.0); await _shot("5-5_ref")
	sc.run_bench(); await _wait(1.8)
	for i in 4: await _wait(0.4)
	await _shot("5-5_debrief")

func _maps() -> void:
	sc.go_map(); await _wait(1.0); sc.map_chapter = 5; sc.go_map(); await _wait(1.0); await _shot("map5")
	sc.pages.codex_i = 32; sc.pages.show_page("notebook"); await _wait(0.8); await _shot("notebook5_switch"); sc.pages.codex_i = 37; await _wait(0.5); await _shot("notebook5_amp"); sc.pages.show_page("")
