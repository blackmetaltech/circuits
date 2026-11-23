extends SceneTree
## 0.7 tool ladder (D-tools-07): after a paid job the ticket shows the next bench tools with their prices, greyed while the wallet is
## short; the testbed owns them all, so the scope's second clip goes on the board through the bench's own tool and draws its own trace.
var checks := 0
var fails := 0
var wb: Workbench

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_MUTE", "1")
	_run()

func _button(prefix: String) -> Button:
	for b in wb.find_children("*", "Button", true, false): if (b as Button).text.begins_with(prefix): return b
	return null

func _says(txt: String) -> bool:
	for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.replace(" ", " ").contains(txt): return true
	return false

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb); await _frames(20)
	wb.start_job("1-1"); await _frames(5)
	var t: Array = wb.tools()
	ok(t.size() == 3 and str(t[0].id) == "condition-dial" and str(t[1].id) == "thermal-camera" and str(t[2].id) == "scope-ch2", "three tools on the ladder, cheapest first (%s)" % str(t.map(func(x): return x.id)))
	ok(not wb.has_tool("scope-ch2") and not wb.has_tool("thermal-camera"), "a new game owns no tool")
	wb.open_case(); await _frames(5)
	wb.backend.build_ref("1-1"); await _frames(5)
	wb.run_test(); await _frames(30)
	ok(wb.backend.passed, "1-1's reference passes (%s)" % wb.note)
	wb.hand_back(); await _frames(10)
	wb.changed.emit(); await _frames(3)
	ok(_says("Bench tools."), "the handed-back ticket shows the tool shelf")
	var bd := _button("Buy the condition dial")
	var bc := _button("Buy the thermal camera")
	ok(bd != null and bd.text.contains("$15.00") and bd.disabled == (wb.backend.wallet_minor < 1500), "the dial: its price, greyed while the wallet is short (wallet %s)" % wb.backend.wallet_text)
	ok(bc != null and bc.text.contains("$30.00") and bc.disabled, "the camera: $30.00, greyed after one job (wallet %s)" % wb.backend.wallet_text)
	ok(_says("See it heat up before it burns"), "each tool says what it shows")
	var w0: int = wb.backend.wallet_minor
	wb.buy_tool("thermal-camera"); await _frames(3)
	ok(wb.backend.wallet_minor == w0 and not wb.has_tool("thermal-camera") and wb.note.contains("$30.00"), "buying without the money is refused with the price (%s)" % wb.note)
	ok(_button("Scope CH2") == null, "the rail has no CH2 key before it is bought")
	# the testbed has every tool: the second clip, through the bench's tool
	ok(Testbed.load_device(wb, "torch"), "the torch loads on the testbed")
	await _frames(5)
	ok(wb.has_tool("scope-ch2") and wb.has_tool("thermal-camera"), "the testbed owns every tool")
	wb.changed.emit(); await _frames(3)
	ok(_button("Scope CH2") != null, "the rail offers the scope's second clip (Shift+P)")
	wb.set_view(5, true); wb.toggle_power(); await _frames(5)
	var plus: Array = []
	for c in wb.backend.bench_q.get("connectors", []): if str(c.get("role", "")) != "ground" and plus.is_empty(): plus = c.pad
	ok(plus.size() == 2, "the torch board has a supply pad (%s)" % str(plus))
	var e := InputEventKey.new(); e.keycode = KEY_P; e.shift_pressed = true; e.pressed = true
	wb._unhandled_input(e); await _frames(2)
	ok(wb.tool == "probe2", "Shift+P picks the CH2 clip (tool %s)" % wb.tool)
	if plus.size() == 2:
		wb._left(true, wb.cam.unproject_position(wb.board.pad_world(int(plus[0]), int(plus[1])))); await _frames(2)
		ok(wb.backend.probes.get("ch2", null) != null, "the CH2 clip is on the board (%s)" % wb.note)
		await _frames(40)
		var v2: Array = wb.backend.scope2_q.get("v", [])
		ok(v2.size() > 10 and absf(float(v2[v2.size() - 1])) > 1.0, "CH2 samples the supply pad (%d samples, last %s V)" % [v2.size(), str(v2[-1]) if v2.size() > 0 else "-"])
		ok(wb.probe2_node != null and wb.probe2_node.visible, "the CH2 probe is drawn on the board")
		ok(wb.scope._screen.samples2.size() > 10, "the scope screen draws the CH2 trace")
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
