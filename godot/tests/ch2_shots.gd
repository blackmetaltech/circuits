extends Node
## Chapter 2 screenshot run (docs/screens/ch2): every ticket idle and with its reference design, the slips, the debrief, the map and the notebook, plus the failure verdicts of round C2-1.
## Run through godot/tests/run_shots_ch2.sh (needs a display; one Godot process at a time). Each shot is <ticket>_<state>_<WxH>.png; the script quantises them to 192 colours afterwards.
##   CB_SHOTS=ch2 CB_NOSAVE=1 CB_SHOT_DIR=<dir> godot --path godot --rendering-driver opengl3 --resolution 1920x1080
var sc: StallScene
var dir := ""
var tag := ""

func run(scene: StallScene) -> void:
	sc = scene; dir = OS.get_environment("CB_SHOT_DIR"); DirAccess.make_dir_recursive_absolute(dir)
	await _wait(1.0)
	tag = "%dx%d" % [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y]
	var only := OS.get_environment("CB_ONLY")
	var steps := ["s21", "s22", "s23", "s24", "maps"]
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
		if value != null and absf(float(it.value) - float(value)) > 1e-9: continue
		if variant != "" and it.variant != variant: continue
		return it
	return {}

func _s21() -> void:
	await _open("2-1"); await _wait(1.0); await _shot("2-1_idle")
	var bk = sc.backend
	# the floating bottom resistor: 1.8 k on top, a bottom resistor that reaches OUT but not GND, then the bench says exactly that
	bk.place(_item("res-cf", 1800, "0.25W"), 4, 2, 0); bk.place(_item("res-cf", 1200, "0.25W"), 8, 4, 1)
	_w([2, 2], [4, 2]); _w([8, 2], [14, 2]); _w([8, 4], [8, 2])
	bk.set_power(true); await _wait(0.8); sc.run_bench(); await _wait(0.6); await _shot("2-1_floating")
	_w([8, 8], [14, 8]); await _wait(0.5); await _shot("2-1_fixed_edit")   # the verdict is gone after the edit
	sc.run_bench(); await _wait(1.6)
	for i in 6: await _wait(0.4)
	await _shot("2-1_ref")

func _s22() -> void:
	await _open("2-2"); await _wait(1.0); await _shot("2-2_idle")
	var bk = sc.backend
	bk.build_ref("2-2"); sc.pages.show_page(""); sc._lay_key = ""; await _wait(0.6); await _shot("2-2_off")
	bk.set_power(true); bk.set_jockey(340.0); await _wait(1.2); await _shot("2-2_side")   # off the null: signed reading and the arrow
	bk.set_jockey(400.0); await _wait(1.2); await _shot("2-2_ref")
	sc.open_predict(); await _wait(0.5); await _shot("2-2_slip"); sc.pages.show_page("")
	bk.predict("dist", 133.0); await _wait(0.2); bk.predict("dist", 13374.9); sc.run_bench(); await _wait(0.8); await _shot("2-2_wrong")

func _s23() -> void:
	await _open("2-3"); await _wait(1.0); await _shot("2-3_idle")
	sc.backend.build_ref("2-3"); sc.pages.show_page(""); sc.backend.set_power(true); await _wait(2.0); await _shot("2-3_ref")

func _s24() -> void:
	await _open("2-4"); await _wait(1.0); await _shot("2-4_idle")
	sc.open_predict(); await _wait(0.5); await _shot("2-4_slip"); sc.pages.show_page("")
	var bk = sc.backend
	bk.predict("pgrad", 0.0205); bk.predict("pemf", 1.5); bk.predict("pr", 0.5)
	sc._ticket_view(); await _wait(0.5); await _shot("2-4_locked")   # the test cell's volts show once the predictions are in
	bk.build_ref("2-4"); bk.predict("pgrad", 0.0205); sc.pages.show_page(""); sc.backend.set_power(true); await _wait(1.5); await _shot("2-4_ref")
	sc.run_bench(); await _wait(1.6)
	for i in 4: await _wait(0.4)
	await _shot("2-4_debrief")

func _maps() -> void:
	sc.go_map(); await _wait(1.0); sc.map_chapter = 2; sc.go_map(); await _wait(1.0); await _shot("map2")
	sc.pages.show_page("notebook"); await _wait(0.8); await _shot("notebook2"); sc.pages.show_page("")
