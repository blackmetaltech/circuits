extends Node
## CIRCUITS front end. The old shared dashboard shell (top bar, sidebar cards, bottom tabs) is gone from the main view: the whole interface is
## Wren's repair stall (godot/stall/). Env hooks: CB_SCREEN=title|map|bench|notebook|settings, CB_TICKET=1-3, CB_UNLOCK=1, CB_SHOTS=1 (screenshot run).
var scene: StallScene

func _ready() -> void:
	if OS.get_environment("CB_SMOKE") != "": OS.set_environment("CB_NOSAVE", "1")   # a smoke run never touches the player's save
	SaveMigrate.run_default()   # the game was called NODE: carry an old save folder over before anything reads user://
	RenderingServer.set_default_clear_color(Color("#120c08"))
	if OS.get_environment("CB_LOOK2_DEV") != "":   # LOOK2 dev scenes: CB_LOOK2_DEV=<name> runs res://look2/dev/<name>_test.gd
		add_child(load("res://look2/dev/%s_test.gd" % OS.get_environment("CB_LOOK2_DEV")).new()); _shot_hook(); return
	scene = StallScene.new(); add_child(scene)
	if OS.get_environment("CB_SHOTS") != "":
		var sh = load("res://tests/ch5_shots.gd" if OS.get_environment("CB_SHOTS") == "ch5" else "res://tests/ch4_shots.gd" if OS.get_environment("CB_SHOTS") == "ch4" else "res://tests/ch3_shots.gd" if OS.get_environment("CB_SHOTS") == "ch3" else ("res://tests/ch2_shots.gd" if OS.get_environment("CB_SHOTS") == "ch2" else "res://tests/stall_shots.gd")).new(); add_child(sh); sh.run(scene)
	if OS.get_environment("CB_SMOKE") != "": _smoke()
	_shot_hook()

func _shot_hook() -> void:
	if OS.get_environment("CB_SHOT") != "":   # one screenshot after CB_SHOT_AT seconds, then quit
		var at := float(OS.get_environment("CB_SHOT_AT")) if OS.get_environment("CB_SHOT_AT") != "" else 4.0
		get_tree().create_timer(at).timeout.connect(func(): get_viewport().get_texture().get_image().save_png(OS.get_environment("CB_SHOT")); get_tree().quit())

## CB_SMOKE=1 (the release build's headless check): the engine sidecar starts, the title shows, ticket 1-1 opens on the bench and the engine answers.
## Prints "SMOKE OK" and exits 0, or "SMOKE FAIL: why" and exits 1 (the release script and CI grep for these).
func _smoke() -> void:
	var stop_engine := func() -> void:   # the sidecar must not outlive the check (an orphan keeps a pipe open and a caller that waits on the output waits for ever)
		if scene.backend != null and scene.backend.bridge != null and scene.backend.bridge.has_method("stop"): scene.backend.bridge.stop()
	var fail := func(why: String) -> void:
		print("SMOKE FAIL: ", why); stop_engine.call(); get_tree().quit(1)
	get_tree().create_timer(90.0).timeout.connect(func() -> void: print("SMOKE FAIL: no result after 90 s"); stop_engine.call(); get_tree().quit(1))   # a hard stop: the check can never hang
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 30000:   # up to thirty SECONDS for the sidecar to come up (frames run unthrottled when headless: counting frames gave a busy machine no time at all)
		await get_tree().process_frame
		if scene.backend != null and scene.backend.ENGINE: break
	if scene.backend == null or not scene.backend.ENGINE: fail.call("the engine sidecar did not start"); return
	if scene.phase != "title": fail.call("the first screen is not the title (%s)" % scene.phase); return
	print("smoke: title up, engine running")
	scene.backend.new_game()
	scene.start_ticket("1-1")
	for i in 30: await get_tree().process_frame
	if scene.phase != "bench" or str(scene.backend.ticket.get("id", "")) != "1-1": fail.call("ticket 1-1 did not open"); return
	if scene.bench.model.is_empty() or int(scene.bench.model.get("w", 0)) <= 0: fail.call("the bench has no board"); return
	print("smoke: ticket 1-1 open on a %dx%d board" % [int(scene.bench.model.w), int(scene.bench.model.h)])
	print("SMOKE OK")
	stop_engine.call()
	get_tree().quit(0)
