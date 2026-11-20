extends SceneTree
## Headless checks for the stall front end (fixture backend):
##   godot --headless --path godot -s res://tests/stall_flow.gd        (exit code 0 = all green)
## 1 scene objects exist  2 the old dashboard chrome is gone  3 drag a part from the shoebox onto pads  4 draw a wire pad to pad
## 5 the 1-1 failure smokes at once  6 a correct torch locks the band and the lock moment fires (coin tin, customer, chit)
var sc: StallScene
var fails := 0
var checks := 0

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1")
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	await _frames(6)
	sc.start_ticket("1-1")
	await _frames(6)
	print("-- scene objects")
	for n in ["window", "props", "supply", "scope", "dmm", "top", "pages", "bench", "tex"]: ok(sc.get(n) != null, "StallScene.%s exists" % n)
	for n in ["mug", "cat", "box", "notebook", "tin", "customer", "chit", "slip", "bubble"]: ok(sc.L.has(n), "layout has %s" % n)
	ok(sc.window.gear_rect().size.x > 0, "gear (settings) on the stall wall")
	ok(sc.supply.hit_rocker(SupplyView.ROCKER.get_center()), "power rocker is a physical switch")
	ok(str(sc.scope.sc.get("unit", "")) == "mA", "scope carries the ticket band")
	ok(sc.backend.bin().size() == 5, "1-1 shoebox: LED + 4 resistors")
	print("-- no old chrome")
	var bad: Array = []
	_walk(sc, bad)
	ok(bad.is_empty(), "no Button/Panel/Tab/Scroll/Label/Container nodes under the stall (%s)" % str(bad))
	ok(not _has_cb_shell(), "no CbApp shell in the tree")
	print("-- drag a part from the shoebox")
	var slots := StallProps.slots(sc.props.box_inner(), sc.props.items.size(), sc.props.bin_scroll)
	var led_c: Vector2 = (slots[0] as Rect2).get_center()
	sc._motion(led_c); sc._press(led_c)
	ok(sc.drag.get("kind", "") == "part", "pressing the LED slot picks the part up")
	var target := sc.pad_screen(Vector2(10, 2))
	sc._motion(target); await _frames(3)
	var gh: Dictionary = sc.bench.overlay.get("ghost", {})
	ok(not gh.is_empty() and bool(gh.ok), "a lead ghost follows the pointer and is valid over free pads")
	sc._release(target); await _frames(2)
	var leds: Array = sc.backend.parts.filter(func(p): return p.kind == "LED")
	ok(leds.size() == 1, "releasing over the board places the LED")
	ok(leds.size() == 1 and (leds[0].pins as Array)[0] == [9, 2] and (leds[0].pins as Array)[1] == [11, 2], "its leads snapped to pads (9,2)-(11,2)")
	sc._motion(led_c); sc._press(led_c); sc._motion(sc.pad_screen(Vector2(10, 2))); await _frames(3); sc._release(sc.pad_screen(Vector2(10, 2)))
	ok(sc.backend.parts.filter(func(p): return p.kind == "LED").size() == 1, "a taken pad refuses a second part")
	print("-- wires")
	var a := sc.pad_screen(Vector2(11, 2)); var b := sc.pad_screen(Vector2(15, 5))
	sc._motion(a); sc._press(a)
	ok(sc.drag.get("kind", "") == "wire", "pressing a pad starts a wire")
	sc._motion(b); await _frames(2); sc._release(b)
	ok(sc.backend.wires.size() == 1 and sc.backend.wires[0].a == [11, 2] and sc.backend.wires[0].b == [15, 5], "releasing on another pad draws the wire")
	var mid := sc.vp_to_screen(sc.bench.org + Vector2(15, 2) * sc.bench.p)
	ok(sc.wire_at(mid) == str(sc.backend.wires[0].wid), "the wire can be picked (right-click target)")
	sc._right(mid)
	ok(sc.backend.wires.is_empty(), "right-click deletes the wire")
	print("-- the 1-1 hook: LED straight on the battery")
	sc.start_ticket("1-1"); await _frames(3)
	_torch(-1)
	sc.backend.set_power(true)
	for i in 6: sc.backend.step(0.05)
	ok(not sc.backend.smoked.is_empty(), "the LED smokes at once (0.6 A against 30 mA)")
	ok(sc.backend.cond("smoked") and CoachData.current("1-1", sc.backend) == 0, "Wren's note switches to the smoke explanation")
	await _frames(4)
	ok(sc.props.mood == "wow", "the customer reacts")
	print("-- a correct torch locks the band")
	sc.start_ticket("1-1"); await _frames(3)
	_torch(3)
	sc.backend.set_power(true)
	for i in 80: sc.backend.step(0.05)
	var mA: float = sc.backend.scope_value()
	ok(mA > 14.0 and mA < 16.0, "470 ohm gives about 15 mA (%.2f mA)" % mA)
	ok(sc.backend.locked, "the trace sat in the band: LOCK")
	await create_timer(0.9).timeout
	ok(sc.done.get("1-1", false), "ticket marked done")
	ok(sc.wallet >= 12, "ka-ching: coins in the tin (%d)" % sc.wallet)
	ok(sc.props.mood == "joy", "the customer is happy")
	ok(sc.scope.locked, "the scope shows LOCK")
	print("-- pages")
	sc.go_title(); await _frames(3); ok(sc.pages.mode == "title", "title is the neon sign")
	sc.go_map(); await _frames(3); ok(sc.pages.mode == "map" and sc.pages.tickets.size() == 5, "chapter map pins 5 ticket chits")
	sc.start_ticket("1-3"); sc.pages.show_page("notebook"); await _frames(3); ok(sc.pages.mode == "notebook", "the notebook opens over the bench")
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)

func _torch(r_idx: int) -> void:
	var bk = sc.backend
	bk.place(bk.bin()[0], 11, 2, 2)
	if r_idx >= 0:
		bk.place(bk.bin()[r_idx], 18, 2, 2); bk.add_wire([19, 2], [18, 2]); bk.add_wire([14, 2], [11, 2])
	else: bk.add_wire([19, 2], [11, 2])
	bk.add_wire([9, 2], [9, 8]); bk.add_wire([9, 8], [19, 8])

func _walk(n: Node, bad: Array) -> void:
	for c in n.get_children():
		for cls in ["Button", "PanelContainer", "TabContainer", "TabBar", "ScrollContainer", "Label", "RichTextLabel", "BoxContainer", "GridContainer", "MenuBar", "ItemList", "Tree", "LineEdit"]:
			if c.is_class(cls): bad.append("%s:%s" % [c.name, cls])
		_walk(c, bad)

func _has_cb_shell() -> bool:
	var stack: Array = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		var s = n.get_script()
		if s != null and str(s.resource_path).contains("addons/cobanana/app.gd"): return true
		stack.append_array(n.get_children())
	return false
