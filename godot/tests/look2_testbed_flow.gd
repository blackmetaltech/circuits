extends SceneTree
## 0.5 testbed: load a known device on the free bench, probe it live, break it on purpose and see the engine's consequence;
## pause holds time, step moves it one frame. Three devices: the torch, the weather station input, the fan driver.
var checks := 0
var fails := 0
var wb: Workbench
var explore := OS.get_environment("CB_EXPLORE") == "1"

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_MUTE", "1")
	_run()

func _t() -> float: return float(wb.backend.frame.get("t", -1.0))

func _smoked_ids() -> Array:
	var out: Array = []
	for uid in wb.backend.smoked:
		for p in wb.backend.parts: if str(p.uid) == str(uid): out.append(str(p.partId))
	return out

func _power_and_run(n := 90) -> void:
	if not wb.backend.powered: wb.toggle_power()
	await _frames(n)

func _meter_out() -> String:
	wb.backend.set_dial("V"); wb.backend.set_probe("red", [14, 2]); wb.backend.set_probe("black", [14, 8]); await _frames(10)
	return wb.meter_text()

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb); await _frames(20)
	# torch
	ok(Testbed.load_device(wb, "torch"), "the torch loads on the free bench with its working board")
	ok(wb.mode == "free" and wb.testbed_device == "torch" and wb.backend.parts.size() >= 2, "free bench, device torch, %d parts" % wb.backend.parts.size())
	await _power_and_run()
	ok(_smoked_ids().is_empty(), "the working torch runs with nothing burnt")
	ok(Testbed.apply_break(wb, "bridge"), "break: a wire across the resistor")
	# 0.6: a break lands paused, so the burn happens in a frame the player steps into (it used to be over before Step)
	await _frames(20)
	ok(wb.testbed_paused and _smoked_ids().is_empty(), "the break lands with time stopped and the LED still whole (%s)" % str(_smoked_ids()))
	Testbed.step_once(wb); await _frames(3)
	ok(_smoked_ids().has("led-red-5mm"), "one Step runs the frame in which the LED burns (%s)" % str(_smoked_ids()))
	Testbed.set_running(wb, true)
	await _frames(120)
	if explore: print("EXPLORE torch bridge smoked=", _smoked_ids(), " note=", wb.note.left(120))
	ok(_smoked_ids().has("led-red-5mm"), "the LED straight on 9 V burns (%s)" % str(_smoked_ids()))
	ok(str(wb.last_failure.get("title", "")).contains("LED burnt") and str(wb.last_failure.get("text", "")) != "", "the card names the burn and the engine says why (%s)" % str(wb.last_failure.get("title", "")))
	Testbed.load_device(wb, "torch"); await _frames(5)
	ok(_smoked_ids().is_empty() and not wb.backend.powered, "Reset brings the working torch back, power off")
	Testbed.apply_break(wb, "small_r"); Testbed.set_running(wb, true); await _power_and_run(120)
	if explore: print("EXPLORE torch small_r smoked=", _smoked_ids())
	ok(_smoked_ids().has("led-red-5mm"), "47 ohm in place of 470: the LED burns too (%s)" % str(_smoked_ids()))
	# weather station
	ok(Testbed.load_device(wb, "station"), "the weather station input loads")
	await _power_and_run(30)
	var good := await _meter_out()
	Testbed.apply_break(wb, "unloaded"); Testbed.set_running(wb, true); await _frames(30)
	var low := await _meter_out()
	if explore: print("EXPLORE station good=", good, " unloaded=", low)
	ok(good.contains("3.3") or good.contains("3.2"), "working: the meter reads about 3.3 V at OUT (%s)" % good)
	ok(low.contains("2.7"), "the builder's divider: the meter reads 2.76 V with the ADC on it (%s)" % low)
	Testbed.load_device(wb, "station"); Testbed.apply_break(wb, "short_top"); Testbed.set_running(wb, true); await _power_and_run(30)
	var hi := await _meter_out()
	if explore: print("EXPLORE station short_top=", hi, " smoked=", _smoked_ids())
	ok(hi.begins_with("8") or hi.begins_with("9"), "top resistor shorted: OUT sees the supply (%s)" % hi)
	# fan driver: switching at 100 Hz
	ok(Testbed.load_device(wb, "fan"), "the fan driver loads")
	wb.backend.set_selector("pin", 2); await _power_and_run(90)
	ok(_smoked_ids().is_empty(), "the working fan driver switches with nothing burnt")
	Testbed.apply_break(wb, "no_diode"); Testbed.set_running(wb, true); await _frames(150)
	if explore: print("EXPLORE fan no_diode smoked=", _smoked_ids(), " note=", wb.note.left(120))
	ok(_smoked_ids().has("2n2222a"), "no flyback diode: the transistor burns (%s)" % str(_smoked_ids()))
	Testbed.load_device(wb, "torch"); await _frames(3)
	ok(wb.last_failure.is_empty() and wb.smoke_fx.is_empty(), "switching device clears the burn note and the smoke")
	ok(not bool(wb.scope.get("_screen").get("cap")), "and the scope's capture")
	# 0.6 (D-testbed-06): the phone charger stage, the lamp dimmer and the relay timer
	ok(Testbed.load_device(wb, "charger"), "the phone charger stage loads (4-1's board, safety card read)")
	ok(wb.backend.parts.filter(func(p): return str(p.partId) == "1n4007").size() == 4 and wb.backend.parts.any(func(p): return str(p.partId) == "cap-el"), "four diodes and the smoothing capacitor are on the board")
	await _power_and_run(60)
	ok(wb.backend.powered and _smoked_ids().is_empty(), "it runs on the mains with nothing burnt")
	Testbed.apply_break(wb, "no_cap"); Testbed.set_running(wb, true); await _frames(40)
	ok(not wb.backend.parts.any(func(p): return str(p.partId) == "cap-el"), "break: the smoothing capacitor comes out")
	ok(Testbed.load_device(wb, "dimmer"), "the lamp dimmer loads on 5-2's bench")
	ok(wb.note == "Lamp dimmer loaded. Space powers it.", "the note does not repeat the card: %s" % wb.note)
	var pot := ""
	for p in wb.backend.parts: if str(p.partId) == "pot-panel": pot = str(p.uid)
	ok(pot != "" and wb.backend.parts.any(func(p): return str(p.partId) == "tip120"), "the knob and the transistor are on the board")
	await _power_and_run(60)
	var i_dim: float = wb.backend.part_current("f1")
	wb.backend._act("setPot", [pot, 0.6]); await _frames(60)
	var i_full: float = wb.backend.part_current("f1")
	ok(i_full > i_dim + 0.05, "turning the knob up raises the strip current (%.3f A -> %.3f A)" % [i_dim, i_full])
	Testbed.apply_break(wb, "wiper_off"); Testbed.set_running(wb, true); await _frames(60)
	ok(wb.backend.part_current("f1") < 0.005, "wiper wire off: the strip goes dark (%.4f A)" % wb.backend.part_current("f1"))
	await _frames(2)
	ok(not wb.mcu.visible and wb.cables_root.get_child_count() == 8, "the dimmer's bench has only the supply's two leads, no microcontroller lead (%d cable meshes)" % wb.cables_root.get_child_count())
	ok(Testbed.load_device(wb, "relay_timer"), "the relay timer loads on 1-3's bench")
	await _power_and_run(10)
	var early: bool = bool(wb.backend.frame.get("parts", []).any(func(p): return p.has("relay") and bool(p.relay.get("operated", false))))
	for i in 120: wb.backend.step(0.05); await process_frame
	var late: bool = bool(wb.backend.frame.get("parts", []).any(func(p): return p.has("relay") and bool(p.relay.get("operated", false))))
	ok(not early and late and _smoked_ids().is_empty(), "the relay waits, then pulls in, and nothing burns (early %s, late %s, t %.2f s)" % [str(early), str(late), _t()])
	# a fresh board with the bigger capacitor (with the power off, the charged 220 uF has no path to discharge)
	Testbed.load_device(wb, "relay_timer"); Testbed.apply_break(wb, "big_c"); Testbed.set_running(wb, true)
	if not wb.backend.powered: wb.toggle_power()
	var tb0 := _t()
	for i in 400:
		if _t() - tb0 >= 2.5: break
		wb.backend.step(0.05); await process_frame
	var at2: bool = bool(wb.backend.frame.get("parts", []).any(func(p): return p.has("relay") and bool(p.relay.get("operated", false))))
	for i in 400:
		if _t() - tb0 >= 5.5: break
		wb.backend.step(0.05); await process_frame
	var at5: bool = bool(wb.backend.frame.get("parts", []).any(func(p): return p.has("relay") and bool(p.relay.get("operated", false))))
	ok(not at2 and at5, "break 470 uF: the relay is still out at 2.5 s and in by 5.5 s (Ravi: 4.22 s; out %s, in %s)" % [str(not at2), str(at5)])
	# pause and step
	Testbed.load_device(wb, "torch"); await _power_and_run(30)
	Testbed.set_running(wb, false); await _frames(2)
	var t0 := _t(); await _frames(20); var t1 := _t()
	ok(t0 >= 0.0 and absf(t1 - t0) < 1e-9, "paused: the simulation time holds (%.4f -> %.4f)" % [t0, t1])
	Testbed.step_once(wb); await _frames(2)
	var t2 := _t()
	ok(t2 > t1, "Step moves it one frame (%.4f -> %.4f)" % [t1, t2])
	await _frames(20)
	ok(absf(_t() - t2) < 1e-9, "and holds again after the step")
	Testbed.set_running(wb, true); await _frames(20)
	ok(_t() > t2, "Run lets time go on (%.4f)" % _t())
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
