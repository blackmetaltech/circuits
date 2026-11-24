extends SceneTree
## LOOK2 chapter 6, Op-Amp Alley, on the bench (0.7): 6-1 the busker's mic preamp (feedback on the + input), 6-2 the pH meter (an
## inverting stage loading a 100 k probe), 6-3 the studio preamp (one LM358 at gain 100), 6-4 the cleaner driver (an LM741), 6-5 the
## incubator thermostat (no hysteresis), 6-6 your own ramp generator (an integrator without Rf) and 6-7 the summing-amp exam, in campaign
## order, on the engine and through the Workbench's controls. Each ticket: it arrives in its own case as the text says, every part on the
## board has a model of its own and is in view at views 1 and 5, no device hides an instrument's display, the bench fails the board as it
## came, the reference build passes and pays with CH1 alone (no CH2 probe is ever clipped), the built board shows its signal on the scope
## inside the screen, it goes back to the customer and Next job opens the next ticket. The dual-rail tickets show a third (blue) post on
## the bench supply. Op-amp chips are DIP-8 bodies with a pin-1 dimple and their name.
##   godot --headless --path godot -s res://tests/look2_ch6_flow.gd          (exit code 0 = green; needs godot/sidecar/bridge.mjs)
var wb: Workbench
var trap := ErrorTrap.new()
var fails := 0
var checks := 0
const BAD := ["real", "really", "reality", "realistic", "realism"]
const ORDER := ["6-1", "6-2", "6-3", "6-4", "6-5", "6-6", "6-7"]
const BRAND := {"6-1": "STREETAMP", "6-2": "ACIDIX", "6-3": "STUDIO NINE", "6-4": "SONICLEAN", "6-5": "HATCHWELL", "6-6": "BENCH", "6-7": "EXAM"}
const DUAL := ["6-1", "6-2", "6-3", "6-4", "6-6", "6-7"]

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_MUTE", "1")
	OS.add_logger(trap)
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _step(sec: float) -> void:
	for i in int(sec / 0.05): wb.backend.step(0.05); await process_frame

func _plain(txt: String) -> bool:
	var low := txt.to_lower()
	for w in BAD:
		var rx := RegEx.new(); rx.compile("\\b%s\\b" % w)
		if rx.search(low) != null: return false
	return true

func _button(prefix: String) -> Button:
	for b in wb.find_children("*", "Button", true, false): if (b as Button).text.begins_with(prefix) and (b as Button).is_visible_in_tree(): return b
	return null

func _label(text: String) -> bool:
	for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text == text and (lb as Label).is_visible_in_tree(): return true
	return false

## Every part on the board has a model of its own (not the labelled-box fallback) and stands inside the picture at views 1 and 5.
func _parts_read(id: String, when: String) -> void:
	var generic: Array = []; var off: Array = []
	for u in wb.parts3d:
		var n: Part3D = wb.parts3d[u]
		if n.generic: generic.append("%s %s" % [u, str(n.part.get("partId", ""))])
	ok(generic.is_empty(), "%s %s: no part is drawn as a plain box (%s)" % [id, when, str(generic)])
	for v in [1, 5]:
		wb.set_view(v, true); await _frames(4)
		var vs: Vector2 = wb.get_viewport().get_visible_rect().size
		for u in wb.parts3d:
			var n2: Part3D = wb.parts3d[u]
			var c: Vector3 = n2.to_global(n2._centre() + Vector3(0, 0.006, 0))
			var sp: Vector2 = wb.cam.unproject_position(c)
			if wb.cam.is_position_behind(c) or sp.x < 0 or sp.y < 0 or sp.x > vs.x or sp.y > vs.y: off.append("%s@view%d" % [u, v])
		ok(off.is_empty(), "%s %s: every part is in view at view %d (%s)" % [id, when, v, str(off)])
	wb.set_view(1, true); await _frames(4)

## No device on the bench (the fan, the microcontroller, the isolation transformer, the customer's case and lid) stands between the
## work-view camera and an instrument's display (the bench supply's two, the scope's screen, the meter's LCD).
func _readings_clear(id: String) -> void:
	wb.set_view(1, true); await _frames(4)
	var devices := {"the fan": wb.fan, "the microcontroller": wb.mcu, "the isolation transformer": wb.iso_box, "the customer's case": wb.case_node}
	var boxes: Array = []
	for nm in devices:
		var d = devices[nm]
		if d == null or not (d as Node3D).is_visible_in_tree(): continue
		for mi in (d as Node).find_children("*", "MeshInstance3D", true, false):
			if not (mi as MeshInstance3D).is_visible_in_tree(): continue
			var bb: AABB = ((mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()).abs()
			if bb.size.x > 0.004 and bb.size.y > 0.004 and bb.size.z > 0.004: bb = bb.grow(-0.001)   # a box that only grazes the line of sight is not in the way
			if bb.has_volume(): boxes.append([bb, nm])
	var hidden: Array = []
	var eye: Vector3 = wb.cam.global_position
	var instruments := {"the bench supply": wb.psu, "the scope": wb.scope, "the meter": wb.dmm}
	for inm in instruments:
		var ins = instruments[inm]
		if ins == null or not (ins as Node3D).is_visible_in_tree(): continue
		for q in (ins as Node).find_children("*", "MeshInstance3D", true, false):
			if not (q as Node).has_meta("vp"): continue
			var at: Vector3 = (q as Node3D).global_position
			for b in boxes:
				if (b[0] as AABB).intersects_segment(eye, at): hidden.append("a display of %s behind %s" % [inm, b[1]]); break
	ok(hidden.is_empty(), "%s: no device hides an instrument's display at view 1 %s" % [id, str(hidden)])

func _arrive(id: String) -> void:
	print("== ", id)
	ok(wb.ticket_id == id and str(wb.backend.ticket.get("id", "")) == id and wb.mode == "job", "%s is the open job" % id)
	ok(wb.case_closed(), "%s arrives in its closed case" % id)
	var al := wb.arrival_line()
	ok(al != "" and not al.begins_with("The device is on the bench") and _plain(al), "the arrival text says what the customer sees: %s" % al)
	ok(DeviceCase.device_of(id)[0] == BRAND[id], "%s has its own case (%s)" % [id, str(DeviceCase.device_of(id)[0])])
	ok(_plain(str(wb.backend.ticket.get("brief", ""))) and _plain(str(Workbench.OPEN_LINE.get(id, ""))) and Workbench.OPEN_LINE.has(id), "an open line, and no banned word in it or the brief")
	wb.open_case(); await _frames(5)
	ok(not wb.case_closed() and wb.note != "" and _plain(wb.note), "the case opens and says what is inside: %s" % wb.note)
	await _parts_read(id, "as it came")
	await _readings_clear(id)

func _bench() -> void:
	wb.run_test(); await _frames(5)

func _power(on: bool) -> void:
	if wb.backend.powered != on: wb.toggle_power()
	await _step(0.6)

## Each selector of the ticket is a row of keys on the rail, under its own label, and a key moves the engine's selector.
func _selectors(id: String) -> void:
	wb.changed.emit(); await _frames(3)
	for sl in wb.backend.selectors:
		if str(sl.id) == "pin": continue
		var opts: Array = sl.options
		var all := _label(str(sl.label))
		for o in opts: all = all and _button(str(o)) != null
		ok(all, "%s: the %s selector is on the rail as keys %s" % [id, str(sl.label), str(opts)])
	if wb.backend.selectors.is_empty() or str(wb.backend.selectors[0].id) == "pin": return
	var s0: Dictionary = wb.backend.selectors[0]
	var i0 := int(s0.get("index", 0)); var i1 := (i0 + 1) % (s0.options as Array).size()
	var k := _button(str(s0.options[i1]))
	if k: k.pressed.emit(); await _frames(3)
	var now := -1
	for sl in wb.backend.selectors: if str(sl.id) == str(s0.id): now = int(sl.index)
	ok(now == i1, "%s: the %s key sets the engine's selector (%d -> %d)" % [id, str(s0.options[i1]), i0, now])
	var back := _button(str(s0.options[i0]))
	if back: back.pressed.emit(); await _frames(3)

func _exam_boxes(vals: Array) -> void:
	wb.changed.emit(); await _frames(3)
	var boxes := wb.find_children("*", "LineEdit", true, false)
	ok(boxes.size() == vals.size(), "the exam ticket has a box per prediction (%d)" % boxes.size())
	wb.run_test(); await _frames(2)
	ok(not wb.backend.passed and wb.note.begins_with("Predict first"), "the bench asks for predictions first: %s" % wb.note)
	boxes = wb.find_children("*", "LineEdit", true, false)
	for i in mini(boxes.size(), vals.size()): (boxes[i] as LineEdit).text = str(vals[i])
	if not boxes.is_empty(): (boxes[0] as LineEdit).text_submitted.emit(str((boxes[0] as LineEdit).text)); await _frames(3)
	ok(wb.backend.predictions_done(), "Enter in a box locks the predictions in: %s" % wb.note)

## The op-amp and comparator chips are DIP-8 bodies with the pin-1 dimple and their part name on top.
func _chips(id: String) -> void:
	var n := 0; var bad: Array = []
	for u in wb.parts3d:
		var p: Part3D = wb.parts3d[u]
		if p.footprint != "dip8": continue
		n += 1
		var named := false
		for lb in p._labels: if (lb as Label3D).text == str(p.part.get("partId", "")).to_upper(): named = true
		if not named or p.body_meshes.is_empty(): bad.append(u)
	ok(n >= 1 and bad.is_empty(), "%s: %d DIP-8 chip(s), each a chip body with its name (%s)" % [id, n, str(bad)])

## The built board shows its signal on CH1 inside the screen: samples, not all on the clamp at the top or bottom edge.
func _signal(id: String) -> void:
	await _step(1.2)
	var v: Array = wb.backend.scope_q.get("v", [])
	var vpd: Array = wb.backend.bench_q.get("instruments", {}).get("scope", {}).get("voltsPerDiv", [5.0, 5.0])
	var vd := float(vpd[0]); var inside := 0
	for x in v: if float(x) < 6.0 * vd and float(x) > -2.0 * vd: inside += 1
	ok(v.size() > 10 and inside >= int(v.size() * 0.9), "%s: CH1 shows the built board's signal on the screen (%d of %d samples inside, %s V/div)" % [id, inside, v.size(), str(vd)])
	ok(wb.backend.probes.get("ch2", null) == null, "%s: played on CH1 alone (CH2 not clipped)" % id)

func _run() -> void:
	wb = Workbench.new(); root.add_child(wb)
	await _frames(20)
	wb.changed.emit(); await _frames(3)
	ok(_label("Repairs in six chapters, an exam at the end of each."), "the title names the six chapters")
	wb.start_job(); await _frames(10)   # the campaign starts here (a first start_job resets the unlocks)
	ok(Workbench.BENCH_JOBS.slice(23) == ORDER, "the bench campaign runs chapter 6 in the engine's order after 5-5")
	wb.backend.unlock_through("5-5")
	wb.start_job("5-5"); await _frames(10)
	ok(wb.ticket_id == "5-5", "5-5 opens")
	wb.open_case(); await _frames(5)
	await _power(false)
	ok(wb.backend.build_ref("5-5"), "5-5: the reference build goes on")
	await _power(true); await _bench()
	ok(wb.backend.passed, "5-5 passes (%s)" % wb.note.left(60))
	wb.hand_back(); await _frames(5)
	var nb0 := _button("Next job")
	if nb0: nb0.pressed.emit()
	await _frames(10)
	ok(wb.mode == "job" and wb.ticket_id == "6-1", "Next job after 5-5 opens 6-1 (%s)" % wb.ticket_id)
	for id in ORDER:
		await _arrive(id)
		var eb := bool(wb.backend.ticket.get("eb", false))
		wb.changed.emit(); await _frames(3)
		var blue: Node3D = wb.psu._post_groups[2] if wb.psu else null
		ok(blue != null and blue.visible == (id in DUAL), "%s: the bench supply shows %s" % [id, "the blue -V post (dual rails)" if id in DUAL else "two posts (one rail)"])
		if not eb: await _chips(id)   # the exam rig arrives empty
		await _selectors(id)
		if eb:
			var pv: Array = []
			var R: Dictionary = EngineBench.REFS_CH6.get(id, {})
			for pr in wb.backend.ticket.predictions: pv.append(R.pred.get(str(pr.id), 1.0))
			await _exam_boxes(pv)
		await _bench()
		ok(not wb.backend.passed, "the bench fails %s as it came (%s)" % [id, str(wb.last_failure.get("title", wb.note)).left(70)])
		await _power(false)
		var w0: int = wb.backend.wallet_minor
		ok(wb.backend.build_ref(id), "%s: the reference build goes on" % id)
		wb.sync_board(); await _frames(4)
		await _parts_read(id, "built")
		await _chips(id)
		await _power(true)
		await _signal(id)
		await _bench()
		ok(wb.backend.passed, "the bench passes %s (%s)" % [id, wb.note.left(90)])
		ok(wb.backend.wallet_minor > w0, "%s pays (%d -> %d)" % [id, w0, wb.backend.wallet_minor])
		if id == "6-4":
			var thd_t: String = wb.spec_text("thd", float(wb.backend.last_result.get("measured", {}).get("thd", -1.0)))
			ok(thd_t.ends_with(" %") and not thd_t.contains("V"), "6-4: the distortion row reads in percent (%s; it read \"10.1 mV\")" % thd_t)
		wb.changed.emit(); await _frames(3)
		if eb:
			var marked := false
			for lb in wb.find_children("*", "Label", true, false): if (lb as Label).text.contains("you said"): marked = true
			ok(marked, "%s: the exam is marked on the ticket" % id)
		wb.hand_back(); await _frames(5)
		ok(wb.handed and wb.case_node.state == "handed", "%s goes back to the customer" % id)
		var nb := _button("Next job")
		ok(nb != null, "the ticket offers Next job")
		nb.pressed.emit(); await _frames(10)
		var i := ORDER.find(id)
		if i + 1 < ORDER.size(): ok(wb.mode == "job" and wb.ticket_id == ORDER[i + 1], "Next job after %s opens %s (%s)" % [id, ORDER[i + 1], wb.ticket_id])
	ok(wb.mode == "title", "after 6-7, the last job, the bench goes back to the title")
	ok(trap.count == 0, "zero script errors in the whole session (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)

func _key_space() -> void:
	var e := InputEventKey.new(); e.keycode = KEY_SPACE; e.physical_keycode = KEY_SPACE; e.pressed = true
	wb._unhandled_input(e); await _frames(2)
