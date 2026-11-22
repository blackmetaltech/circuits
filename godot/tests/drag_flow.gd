extends SceneTree
## A fast press-move-release drag (everything inside ONE frame, the press with no motion before it, the move one single coarse sample, the release at the target) must always
## place the part: from the shoebox to the board, in a direction that is mostly sideways and in one that is mostly vertical, and a vertical drag that stays inside the box still scrolls it.
##   godot --headless --path godot -s res://tests/drag_flow.gd        (needs godot/sidecar/bridge.mjs; exit code 0 = all green)
var sc: StallScene
var bk: EngineBench
var fails := 0
var checks := 0

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_LAYOUT", "desktop")
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _btn(p: Vector2, pressed: bool) -> InputEventMouseButton:
	var e := InputEventMouseButton.new(); e.button_index = MOUSE_BUTTON_LEFT; e.pressed = pressed; e.position = p; return e

func _mot(p: Vector2) -> InputEventMouseMotion:
	var e := InputEventMouseMotion.new(); e.position = p; return e

## Whole drag through _gui_input, no frame in between: press, ONE motion, release.
func _quick_drag(slot: int, at: Vector2) -> bool:
	var inner: Rect2 = sc.props.box_inner()
	var slots := StallProps.slots(inner, sc.props.items.size(), sc.props.bin_scroll)
	var c := ((slots[slot] as Rect2).intersection(inner)).get_center()
	var before := bk.parts.size()
	sc._gui_input(_btn(c, true)); sc._gui_input(_mot(at)); sc._gui_input(_btn(at, false))
	return bk.parts.size() == before + 1

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	sc.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT); sc.size = Vector2(1920, 1080)
	await _frames(6)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start (npx vite build -c vite.bridge.config.ts)"); quit(2); return
	bk = sc.backend
	bk.new_game(); bk.unlock_through("1-1"); sc.start_ticket("1-1"); bk.clear_fault(); sc.pages.show_page("")
	await _frames(4)
	print("== one-frame drags from the shoebox")
	var n: int = sc.props.items.size()
	ok(n >= 3, "the shoebox has rows (%d)" % n)
	# sideways: from the box to the board, mostly horizontal
	var t1 := sc.pad_screen(Vector2(6, 5))
	ok(_quick_drag(0, t1), "a one-frame drag, mostly sideways, places the part")
	# mostly vertical: a target on the board's left edge far above the row, so the single coarse sample is steeper than 1.2 : 1
	var inner: Rect2 = sc.props.box_inner()
	var slots := StallProps.slots(inner, n, sc.props.bin_scroll)
	var c3 := ((slots[3] as Rect2).intersection(inner)).get_center()
	var t2 := Vector2(inner.end.x + 70.0, c3.y - 330.0)
	ok(absf(t2.y - c3.y) > absf(t2.x - c3.x) * 1.2, "the vertical drag is steeper than 1.2 : 1 (%s from %s)" % [str(t2), str(c3)])
	sc._gui_input(_btn(c3, true)); sc._gui_input(_mot(t2))
	ok(str(sc.drag.get("kind", "")) == "part", "one steep sample out of the box lifts the part instead of scrolling the list (%s)" % str(sc.drag.get("kind", "")))
	sc._gui_input(_btn(t2, false)); sc.drag.clear()
	ok(_quick_drag(1, sc.pad_screen(Vector2(12, 9))), "a one-frame drag to another pad places the part")
	# a drag that stays inside the box and goes up and down only scrolls it, and places nothing
	var parts0 := bk.parts.size()
	var cc := ((slots[1] as Rect2).intersection(inner)).get_center()
	sc._gui_input(_btn(cc, true)); sc._gui_input(_mot(cc + Vector2(0, 40))); sc._gui_input(_btn(cc + Vector2(0, 40), false))
	ok(bk.parts.size() == parts0, "a short vertical drag inside the box places nothing")
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
