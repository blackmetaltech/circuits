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
	await _frames(120)
	if explore: print("EXPLORE torch bridge smoked=", _smoked_ids(), " note=", wb.note.left(120))
	ok(_smoked_ids().has("led-red-5mm"), "the LED straight on 9 V burns (%s)" % str(_smoked_ids()))
	ok(str(wb.last_failure.get("title", "")).contains("LED burnt") and str(wb.last_failure.get("text", "")) != "", "the card names the burn and the engine says why (%s)" % str(wb.last_failure.get("title", "")))
	Testbed.load_device(wb, "torch"); await _frames(5)
	ok(_smoked_ids().is_empty() and not wb.backend.powered, "Reset brings the working torch back, power off")
	Testbed.apply_break(wb, "small_r"); await _power_and_run(120)
	if explore: print("EXPLORE torch small_r smoked=", _smoked_ids())
	ok(_smoked_ids().has("led-red-5mm"), "47 ohm in place of 470: the LED burns too (%s)" % str(_smoked_ids()))
	# weather station
	ok(Testbed.load_device(wb, "station"), "the weather station input loads")
	await _power_and_run(30)
	var good := await _meter_out()
	Testbed.apply_break(wb, "unloaded"); await _frames(30)
	var low := await _meter_out()
	if explore: print("EXPLORE station good=", good, " unloaded=", low)
	ok(good.contains("3.3") or good.contains("3.2"), "working: the meter reads about 3.3 V at OUT (%s)" % good)
	ok(low.contains("2.7"), "the builder's divider: the meter reads 2.76 V with the ADC on it (%s)" % low)
	Testbed.load_device(wb, "station"); Testbed.apply_break(wb, "short_top"); await _power_and_run(30)
	var hi := await _meter_out()
	if explore: print("EXPLORE station short_top=", hi, " smoked=", _smoked_ids())
	ok(hi.begins_with("8") or hi.begins_with("9"), "top resistor shorted: OUT sees the supply (%s)" % hi)
	# fan driver: switching at 100 Hz
	ok(Testbed.load_device(wb, "fan"), "the fan driver loads")
	wb.backend.set_selector("pin", 2); await _power_and_run(90)
	ok(_smoked_ids().is_empty(), "the working fan driver switches with nothing burnt")
	Testbed.apply_break(wb, "no_diode"); await _frames(150)
	if explore: print("EXPLORE fan no_diode smoked=", _smoked_ids(), " note=", wb.note.left(120))
	ok(_smoked_ids().has("2n2222a"), "no flyback diode: the transistor burns (%s)" % str(_smoked_ids()))
	Testbed.load_device(wb, "torch"); await _frames(3)
	ok(wb.last_failure.is_empty() and wb.smoke_fx.is_empty(), "switching device clears the burn note and the smoke")
	ok(not bool(wb.scope.get("_screen").get("cap")), "and the scope's capture")
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
