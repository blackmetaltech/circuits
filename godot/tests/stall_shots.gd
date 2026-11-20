extends Node
## Screenshot run for the stall: builds each scene state through the backend API (the real engine by default; CB_FIXTURE=1 uses the stand-in), waits for the
## live effects to develop and saves a PNG per state. Every shot also prints the engine's numbers ("data ...") so the picture can be checked against them.
## Run through godot/tests/run_shots.sh (needs a display; one Godot process at a time).
##   CB_SHOTS=1 CB_SHOT_DIR=<dir> godot --path godot --rendering-driver opengl3 --resolution 1920x1080
var sc: StallScene
var dir := ""
var tag := ""
var eng := false

func run(scene: StallScene) -> void:
	sc = scene; dir = OS.get_environment("CB_SHOT_DIR"); DirAccess.make_dir_recursive_absolute(dir)
	eng = sc.backend.ENGINE
	await _wait(1.0)
	tag = "%dx%d" % [DisplayServer.window_get_size().x, DisplayServer.window_get_size().y]
	var only := OS.get_environment("CB_ONLY")
	# 1-1 first on a fresh game (the wallet is empty), then the title with its Continue sign, then the later tickets (their earlier tickets are played with their reference designs)
	var steps := ["bench_idle", "led_smoking", "lock", "title", "hot_resistor", "dmm_probing", "notebook", "cute", "map", "settings"]
	for s in steps:
		if only != "" and not only.split(",").has(s): continue
		await call("_s_" + s)
	print("data frames ", Engine.get_frames_drawn())
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
	_data(name)

## What the engine says right now, for checking the screenshot against.
func _data(name: String) -> void:
	var bk = sc.backend
	if not eng: return
	var parts: Array = []
	for p in bk.frame.get("parts", []):
		if str(p.uid) == "f1" and str(bk.part_by("f1").get("kind", "")) != "LOAD": continue
		parts.append("%s %s %.0fC %.3fW %s%s" % [p.uid, p.state, float(p.temp), float(p.power), "ratio %.2f" % float(p.ratio), (" " + str(p.led.mood) + " " + str(snappedf(float(p.led.mA), 0.01)) + "mA") if p.has("led") else ""])
	print("data ", name, " ticket=", bk.ticket.get("id", ""), " powered=", bk.powered, " lock=", bk.locked, " passed=", bk.passed, " scope=", bk.scope_view.get("text", ""), " (", snappedf(bk.scope_value(), 0.0001), " ",
		bk.scope_view.get("unit", ""), " band ", bk.scope_view.get("lo", 0), "-", bk.scope_view.get("hi", 0), ") dmm=", bk.dmm().get("text", ""), " ", bk.dmm().get("unit", ""), " wallet=", bk.wallet_text, " parts=", parts)

func _item(partId: String, value, variant := "") -> Dictionary:
	for it in sc.backend.bin():
		if it.partId != partId: continue
		if value != null and absf(float(it.value) - float(value)) > 1e-9: continue
		if variant != "" and it.variant != variant: continue
		return it
	return {}

func _w(a: Array, b: Array) -> void: sc.backend.add_wire(a, b)

func _build_torch(r_ohm := 470.0) -> void:   # R (ohm, 0 = none) in series with the LED between the battery's two pads
	var bk = sc.backend
	if eng:
		bk.place(_item("led-red-5mm", null), 8, 5, 0)
		if r_ohm > 0.0:
			bk.place(_item("res-cf", r_ohm), 2, 5, 0); _w([2, 2], [2, 5]); _w([6, 5], [8, 5])
		else: _w([2, 2], [8, 5])
		_w([10, 5], [8, 2])
		return
	bk.place(bk.bin()[0], 11, 2, 2)
	if r_ohm > 0.0:
		bk.place(bk.bin()[3], 18, 2, 2); _w([19, 2], [18, 2]); _w([14, 2], [11, 2])
	else: _w([19, 2], [11, 2])
	_w([9, 2], [9, 8]); _w([9, 8], [19, 8])

func _s_title() -> void:
	sc.go_title(); await _wait(4.6); await _shot("title")

func _s_bench_idle() -> void:
	sc.start_ticket("1-1"); await _wait(2.5); await _shot("bench_idle")

func _s_led_smoking() -> void:
	sc.start_ticket("1-1"); _build_torch(0.0); await _wait(0.5)
	sc.backend.set_power(true); await _wait(1.3); await _shot("led_smoking")

func _s_lock() -> void:
	sc.start_ticket("1-1"); _build_torch(470.0); await _wait(0.4)
	sc.backend.set_power(true)
	var t0 := Time.get_ticks_msec()
	while not sc.backend.passed and Time.get_ticks_msec() - t0 < 12000: await _wait(0.1)
	await _wait(1.05); await _shot("lock")

func _s_hot_resistor() -> void:
	var bk = sc.backend
	if eng: bk.unlock_through("1-3")
	sc.start_ticket("1-3")
	if eng:   # the naive build: 22 ohm 1/4 W (right voltage, 0.61 W in a 0.25 W part), CH1 clipped on OUT
		bk.place(_item("res-cf", 22, "0.25W"), 4, 2, 0); _w([2, 2], [4, 2]); _w([8, 2], [14, 2]); bk.set_probe("ch1", [14, 2])
	else:
		bk.thermal_speed = 10.0
		bk.place(bk.bin()[1], 17, 2, 2)   # 22 ohm 1/2 W
		_w([19, 2], [17, 2]); _w([13, 2], [9, 2]); _w([9, 8], [19, 8])
	await _wait(0.3); bk.set_power(true)
	var t0 := Time.get_ticks_msec()
	while bk.hot_k() < (0.8 if eng else 0.62) and bk.smoked.is_empty() and Time.get_ticks_msec() - t0 < 30000: await get_tree().process_frame
	if eng: bk.set_running(false)   # hold the engine's clock at the glowing moment (the resistor is "hot", not yet smoked)
	if not eng: bk.thermal_speed = 0.5
	await _wait(0.35); await _shot("hot_resistor")

func _s_dmm_probing() -> void:
	var bk = sc.backend
	if eng: bk.unlock_through("1-4")
	sc.start_ticket("1-4")
	if eng:   # the reference load (4.7 ohm 5 W); the DMM across the battery pads, dial on V
		bk.place(_item("res-ww5", 4.7, "5W"), 2, 5, 0); _w([2, 2], [2, 5]); _w([6, 5], [8, 2])
		await _wait(0.3); bk.set_power(true)
		bk.set_probe("red", [2, 2]); bk.set_probe("black", [8, 2])
	else:
		bk.place(bk.bin()[4], 18, 2, 2)   # 4.7 ohm 5 W
		_w([19, 2], [18, 2]); _w([14, 2], [14, 8]); _w([14, 8], [19, 8])
		await _wait(0.3); bk.set_power(true)
		bk.set_probe("red", [19, 2]); bk.set_probe("black", [19, 8]); bk.set_dial("V")
	await _wait(0.9 if eng else 2.2); await _shot("dmm_probing")

func _s_notebook() -> void:
	sc.start_ticket("1-1"); _build_torch(0.0); await _wait(0.3)
	sc.pages.show_page("notebook"); await _wait(0.8); await _shot("notebook")
	sc.pages.show_page("")

func _s_cute() -> void:
	sc.cute = true; sc._apply_prefs()
	sc.start_ticket("1-2")
	var bk = sc.backend
	if eng:   # three LEDs in series with 150 ohm: the reference tail-light
		bk.build_ref("1-2")
	else:
		bk.place(bk.bin()[0], 11, 2, 2); bk.place(bk.bin()[1], 11, 5, 2); bk.place(bk.bin()[2], 11, 8, 2); bk.place(bk.bin()[5], 18, 2, 2)
		_w([19, 2], [18, 2]); _w([14, 2], [11, 2]); _w([9, 2], [11, 5]); _w([9, 5], [11, 8]); _w([9, 8], [19, 8])
	await _wait(0.4); sc.backend.set_power(true); await _wait(2.6)
	await _shot("cute"); await _shot("cute_zoom", sc.board_rect.grow(10))

func _s_map() -> void:
	if not eng: sc.done["1-1"] = true; sc.wallet = 12
	sc.go_map(); await _wait(1.0); await _shot("map")

func _s_settings() -> void:
	sc.pages.show_page("settings"); await _wait(0.8); await _shot("settings"); sc.pages.show_page("")
