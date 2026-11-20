extends SceneTree
## The tester's session as a test (N2): boot -> title -> new game -> chapter map -> a ticket -> notebook -> settings -> title again, on the real engine,
## at the handheld window size 1280x800 and at 1920x1080, with ZERO script errors. The tester's game.log had 323 "Invalid access to property or key
## 'board' on a base object of type 'Dictionary'" and 2 'customer': a ticket dictionary that was empty while the title / notebook were up.
##   godot --headless --path godot -s res://tests/boot_flow.gd         (exit code 0 = green; needs godot/sidecar/bridge.mjs)
var sc: StallScene
var trap := ErrorTrap.new()
var fails := 0
var checks := 0

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_LAYOUT", "desktop")
	OS.add_logger(trap)
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _size(w: int, h: int) -> void:
	sc.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)   # a fixed desk size (a full-rect anchor would follow the headless window)
	sc.size = Vector2(w, h)
	await _frames(4)

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	await _frames(8)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start"); quit(2); return
	for res in [Vector2i(1280, 800), Vector2i(1920, 1080)]:
		print("== %dx%d" % [res.x, res.y])
		await _size(res.x, res.y)
		sc.go_title(); await _frames(30)
		ok(sc.pages.mode == "title" and sc.size == Vector2(res.x, res.y), "the title is up at %s" % str(sc.size))
		sc._on_page("new", ""); await _frames(10)
		ok(sc.pages.mode == "map", "New game opens the chapter map")
		await _frames(30)
		sc._on_page("ticket", "1-1"); await _frames(20)
		ok(sc.phase == "bench" and sc.backend.ticket.id == "1-1", "a ticket opens")
		sc._on_page("notebook", ""); await _frames(20)
		ok(sc.pages.mode == "notebook", "the notebook opens")
		ok(str(sc.pages.coach_ticket.get("id", "")) == "1-1", "its header is the open ticket (%s)" % str(sc.pages.coach_ticket.get("id", "")))
		sc._on_page("settings", ""); await _frames(10)
		sc._on_page("close", ""); await _frames(10)
		sc.go_title(); await _frames(20)
		# the counter with no ticket open at all: every frame of the scene must cope
		sc.backend.close_ticket(); await _frames(30)
		ok(sc.backend.ticket.is_empty(), "no ticket open")
		sc.go_map(); await _frames(30)
		sc.start_ticket("1-1"); await _frames(10)
	ok(trap.count == 0, "zero script errors in the whole session (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
