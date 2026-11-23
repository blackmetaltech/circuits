extends SceneTree
## 0.5: a repair swaps a value in place. 3-1 (a 22 uF timing capacitor) and 3-3 (a 560 ohm series resistor) arrive faulty;
## the wheel over the placed part, through the bench's own input path, steps its value until the bench test passes. Wires stay.
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

func _wheel_at(uid: String, up: bool) -> void:
	var n: Node3D = wb.parts3d.get(uid, null)
	var mp: Vector2 = wb.cam.unproject_position(n.global_position + Vector3(0, 0.004, 0))
	var mv := InputEventMouseMotion.new(); mv.position = wb.get_viewport().get_final_transform() * mp; Input.parse_input_event(mv); await process_frame
	for down in [true, false]:
		var e := InputEventMouseButton.new(); e.button_index = MOUSE_BUTTON_WHEEL_UP if up else MOUSE_BUTTON_WHEEL_DOWN; e.pressed = down
		e.position = wb.get_viewport().get_final_transform() * mp; Input.parse_input_event(e); await process_frame

func _says(txt: String) -> bool:
	for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.replace("\u00a0", " ").contains(txt): return true
	return false

func _part(pid: String) -> Dictionary:
	for p in wb.backend.parts: if str(p.partId) == pid and not bool(p.get("fixed", false)): return p
	return {}

func _repair(t: String, pid: String, target: float) -> void:
	wb.backend.unlock_through(t); wb.start_job(t); await _frames(5)
	wb.open_case(); wb.set_view(5, true); await _frames(30)
	var p := _part(pid)
	ok(not p.is_empty(), "%s arrives with its %s on the board" % [t, pid])
	if p.is_empty(): return
	var uid := str(p.uid); var v0 := float(p.value); var wires0: int = wb.backend.wires.size()
	var w0: int = wb.backend.wallet_minor
	if t == "3-1":
		# 0.5 stakes: the customer waits; a TEST of the board as it came in fails and takes $0.50 off the tip, and the ticket says so
		ok(_says("is waiting: a $2.00 tip"), "3-1: the ticket says the customer is waiting, with a $2.00 tip")
		if not wb.backend.powered: wb.toggle_power()
		await _frames(30); wb.run_test(); await _frames(30)
		ok(not wb.backend.passed and int(wb.backend.bench_q.get("tipLeft", -1)) == 150, "3-1: the failed test leaves a $1.50 tip (%d)" % int(wb.backend.bench_q.get("tipLeft", -1)))
		wb.changed.emit(); await _frames(3)
		ok(_says("is waiting: a $1.50 tip"), "3-1: the ticket shows the smaller tip")
	var up := target > v0
	for i in 40:
		if absf(float(_part(pid).value) - target) <= target * 0.001: break
		await _wheel_at(uid, up); await _frames(2)
	var v1 := float(_part(pid).value)
	ok(absf(v1 - target) <= target * 0.001, "%s: the wheel steps the %s from %s to %s in place" % [t, pid, str(v0), str(v1)])
	ok(str(_part(pid).uid) == uid and wb.backend.wires.size() == wires0, "%s: same part, same %d wires" % [t, wires0])
	if not wb.backend.powered: wb.toggle_power()
	await _frames(60)
	wb.run_test(); await _frames(40)
	ok(wb.backend.passed, "%s passes after the swap (%s)" % [t, wb.note.left(140)])
	var fee: int = int(wb.backend.ticket.get("price", 0))
	var tip := 150 if t == "3-1" else 200
	ok(wb.backend.wallet_minor - w0 >= fee + tip, "%s pays the fee and a %d-cent tip (wallet +%d)" % [t, tip, wb.backend.wallet_minor - w0])

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb); await _frames(20)
	wb.start_job("1-1"); await _frames(5)   # the first job starts the campaign (a new game), so unlocks set after it hold
	await _repair("3-1", "cap-el", 100e-6)
	await _repair("3-3", "res-cf", 200.0)
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
