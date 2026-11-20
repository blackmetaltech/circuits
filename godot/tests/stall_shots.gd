extends Node
## Screenshot run for the stall: builds each scene state with the backend API (fixture numbers), waits for the live effects to develop and saves a
## PNG per state. Run through godot/tests/run_shots.sh (needs a display; one Godot process at a time).
##   CB_SHOTS=1 CB_SHOT_DIR=<dir> godot --path godot --rendering-driver opengl3 --resolution 1920x1080
var sc: StallScene
var dir := ""
var tag := ""

func run(scene: StallScene) -> void:
	sc = scene; dir = OS.get_environment("CB_SHOT_DIR"); DirAccess.make_dir_recursive_absolute(dir)
	await _wait(1.0)
	tag = "%dx%d" % [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y]
	var only := OS.get_environment("CB_ONLY")
	var steps := ["title", "bench_idle", "led_smoking", "lock", "hot_resistor", "dmm_probing", "notebook", "cute", "map", "settings"]
	for s in steps:
		if only != "" and not only.split(",").has(s): continue
		await call("_s_" + s)
	get_tree().quit()

func _wait(sec: float) -> void: await get_tree().create_timer(sec).timeout

func _shot(name: String, crop := Rect2()) -> void:
	sc.window.t = 4.0   # the tram is crossing the lane in every shot
	await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	if crop.size != Vector2.ZERO:
		var r := Rect2i(crop)
		img = img.get_region(r); img.resize(r.size.x * 2, r.size.y * 2, Image.INTERPOLATE_LANCZOS)
	img.save_png("%s/%s_%s.png" % [dir, name, tag]); print("shot ", name, "_", tag)

func _item(idx: int) -> Dictionary: return sc.backend.bin()[idx]
func _place(idx: int, x: int, y: int, rot := 0) -> void: sc.backend.place(_item(idx), x, y, rot)
func _w(a: Array, b: Array) -> void: sc.backend.add_wire(a, b)

func _build_torch(r_idx := 3) -> void:   # IN -> R -> LED -> GND on ticket 1-1 (R is bin item r_idx, -1 = no resistor)
	_place(0, 11, 2, 2)
	if r_idx >= 0:
		_place(r_idx, 18, 2, 2); _w([19, 2], [18, 2]); _w([14, 2], [11, 2])
	else: _w([19, 2], [11, 2])
	_w([9, 2], [9, 8]); _w([9, 8], [19, 8])

func _s_title() -> void:
	sc.go_title(); await _wait(4.6); await _shot("title")

func _s_bench_idle() -> void:
	sc.start_ticket("1-1"); await _wait(2.5); await _shot("bench_idle")

func _s_led_smoking() -> void:
	sc.start_ticket("1-1"); _build_torch(-1); await _wait(0.5)
	sc.backend.set_power(true); await _wait(1.3); await _shot("led_smoking")

func _s_lock() -> void:
	sc.start_ticket("1-1"); _build_torch(3); await _wait(0.4)
	sc.backend.set_power(true)
	var t0 := Time.get_ticks_msec()
	while not sc.backend.locked and Time.get_ticks_msec() - t0 < 8000: await _wait(0.1)
	await _wait(1.05); await _shot("lock")

func _s_hot_resistor() -> void:
	sc.start_ticket("1-3")
	sc.backend.thermal_speed = 10.0
	sc.backend.place(sc.backend.bin()[1], 17, 2, 2)   # 22 ohm 1/2 W
	_w([19, 2], [17, 2]); _w([13, 2], [9, 2]); _w([9, 8], [19, 8])
	await _wait(0.3); sc.backend.set_power(true)
	var t0 := Time.get_ticks_msec()
	while sc.backend.hot_k() < 0.62 and Time.get_ticks_msec() - t0 < 12000: await _wait(0.1)
	sc.backend.thermal_speed = 0.5
	await _wait(0.4); await _shot("hot_resistor")

func _s_dmm_probing() -> void:
	sc.start_ticket("1-4")
	sc.backend.place(sc.backend.bin()[4], 18, 2, 2)   # 4.7 ohm 5 W
	_w([19, 2], [18, 2]); _w([14, 2], [14, 8]); _w([14, 8], [19, 8])
	await _wait(0.3); sc.backend.set_power(true)
	sc.backend.set_probe("red", [19, 2]); sc.backend.set_probe("black", [19, 8]); sc.backend.set_dial("V")
	await _wait(2.2); await _shot("dmm_probing")

func _s_notebook() -> void:
	sc.start_ticket("1-1"); _build_torch(-1); await _wait(0.3)
	sc.pages.show_page("notebook"); await _wait(0.8); await _shot("notebook")
	sc.pages.show_page("")

func _s_cute() -> void:
	sc.cute = true; sc._apply_prefs()
	sc.start_ticket("1-2")
	var bk = sc.backend   # three LEDs in series with 150 ohm: 19.7 mA each, in the 14-20 mA band
	bk.place(bk.bin()[0], 11, 2, 2); bk.place(bk.bin()[1], 11, 5, 2); bk.place(bk.bin()[2], 11, 8, 2); bk.place(bk.bin()[5], 18, 2, 2)
	_w([19, 2], [18, 2]); _w([14, 2], [11, 2]); _w([9, 2], [11, 5]); _w([9, 5], [11, 8]); _w([9, 8], [19, 8])
	await _wait(0.4); sc.backend.set_power(true); await _wait(2.6)
	await _shot("cute"); await _shot("cute_zoom", sc.board_rect.grow(10))

func _s_map() -> void:
	sc.done["1-1"] = true; sc.wallet = 12
	sc.go_map(); await _wait(1.0); await _shot("map")

func _s_settings() -> void:
	sc.pages.show_page("settings"); await _wait(0.8); await _shot("settings"); sc.pages.show_page("")
