extends SceneTree
const TIP := 200   ## 0.5: the waiting customer's tip for a pass on the first TEST (service:tip, D-tip-waiting)
## Chapter 1 end to end on the real engine, through the stall's UI layer (pointer drags for parts, wires and probes, a click on the rocker, the dial and the
## BENCH key, typed predictions). All five tickets are played to their reference designs and to LOCK, and the designed naive builds fail:
##   godot --headless --path godot -s res://tests/ch1_engine_flow.gd         (exit code 0 = all green; needs godot/sidecar/bridge.mjs)
## Time is the only thing not pointer-driven: the test advances the play clock with backend.step(dt) so the run is deterministic.
var sc: StallScene
var bk: EngineBench
var fails := 0
var checks := 0
var evlog: Array = []
var trap := ErrorTrap.new()
const STY = preload("res://stall/stall_style.gd")
const NO_ID := "\\b[pf]\\d+\\b"   # a part id (p1, f2) must never reach the player's eyes

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1"); OS.set_environment("CB_LAYOUT", "desktop")   # the checks are written for the desk (the headless window is not the design size)
	OS.add_logger(trap)
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else: fails += 1; print("  FAIL ", what)

static func S_TW(txt: String, size: int) -> float: return STY.tw(STY.hand(), txt, size)

func StallStyle_set_handheld(on: bool, mf: int) -> void:
	STY.handheld = on; STY.min_font = mf

func _no_id(s: String) -> bool:
	var re := RegEx.new(); re.compile(NO_ID)
	return re.search(s) == null

func _click_rect(r: Rect2) -> void:
	var p := r.get_center(); sc._motion(p); sc._press(p)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _clock(seconds: float, until := Callable()) -> void:   # advance the play clock; stop early when `until` is true
	var n := int(seconds / 0.05)
	for i in n:
		bk.step(0.05)
		if until.is_valid() and until.call(): return

## ---------------------------------------------------------------------------------------------------------------- UI helpers

func _slot(partId: String, value, variant := "") -> int:
	var items: Array = bk.bin()
	for i in items.size():
		var it: Dictionary = items[i]
		if it.partId != partId: continue
		if value != null and (it.value == null or absf(float(it.value) - float(value)) > 1e-9): continue
		if variant != "" and it.variant != variant: continue
		return i
	return -1

func _drag_part(partId: String, value, variant: String, x: int, y: int, r: int) -> bool:   # (x, y) = pin 1's pad, like the engine
	var idx := _slot(partId, value, variant)
	if idx < 0: return false
	var inner0: Rect2 = sc.props.box_inner()
	sc.props.bin_scroll = clampf(float(idx), 0.0, StallProps.max_scroll(inner0, sc.props.items.size()))   # the row to the top of the window, fully visible
	var slots := StallProps.slots(inner0, sc.props.items.size(), sc.props.bin_scroll)
	var rect: Rect2 = slots[idx]
	rect = rect.intersection(inner0)
	var c := rect.get_center()
	sc._motion(c); sc._press(c)
	sc.rot = r
	var pins: Array = bk.pins_of(sc.props.items[idx], 0, 0, r)
	var mid: Vector2 = (pins[0] + pins[1]) * 0.5
	var at := sc.pad_screen(Vector2(x, y) + mid)
	sc._motion(at); sc._board_overlay()
	var before := bk.parts.size()
	sc._release(at)
	return bk.parts.size() == before + 1

func _drag_wire(a: Array, b: Array) -> bool:
	var before := bk.wires.size()
	var pa := sc.pad_screen(Vector2(a[0], a[1])); var pb := sc.pad_screen(Vector2(b[0], b[1]))
	sc._motion(pa); sc._press(pa); sc._motion(pb); sc._release(pb)
	if bk.wires.size() != before + 1: print("   (wire %s -> %s not added: %s)" % [str(a), str(b), sc.top.toast])
	return bk.wires.size() == before + 1

func _drag_probe(which: String, pad: Array) -> void:
	var tip: Vector2 = sc._probe_tip(which)
	sc._motion(tip); sc._press(tip)
	var at := sc.pad_screen(Vector2(pad[0], pad[1]))
	sc._motion(at); sc._board_overlay(); sc._release(at)

func _rocker() -> void:
	var p: Vector2 = sc.supply.position + SupplyView.ROCKER.get_center() * sc.supply.scale.x
	sc._motion(p); sc._press(p)

func _bench_key() -> void:
	var p: Vector2 = (sc.L.bench as Rect2).get_center()
	sc._motion(p); sc._press(p)

func _dial_to(mode: String) -> void:   # click the right half of the dial until the knob points at `mode` (a frame between clicks: the dial redraws from the backend)
	for i in 5:
		if bk.dial == mode: return
		var p: Vector2 = sc.dmm.position + (DmmView.DIAL_C + Vector2(40, 0)) * sc.dmm.scale.x
		sc._motion(p); sc._press(p)
		await process_frame

func _drop_probe(which: String) -> void:   # pick a lead up and let go off the board: it comes off its pad
	var tip: Vector2 = sc._probe_tip(which)
	sc._motion(tip); sc._press(tip)
	sc._motion(Vector2(40, 40)); sc._release(Vector2(40, 40))

func _key(code: Key, uni := 0) -> void:
	var e := InputEventKey.new(); e.pressed = true; e.keycode = code; e.unicode = uni
	sc._unhandled_key_input(e)

func _ctrl_z() -> void:
	var e := InputEventKey.new(); e.pressed = true; e.keycode = KEY_Z; e.ctrl_pressed = true
	sc._unhandled_key_input(e)

func _type(s: String) -> void:
	for ch in s: _key(OS.find_keycode_from_string(ch) if ch != "." else KEY_PERIOD, ch.unicode_at(0))

func _build(id: String) -> bool:   # the level's reference design, dragged in by pointer
	var R: Dictionary = EngineBench.REFS[id]
	var good := true
	for p in R.parts: good = _drag_part(str(p[0]), p[1], str(p[2]), int(p[3]), int(p[4]), int(p[5])) and good
	for w in R.wires:
		var path: Array = w
		good = _drag_wire(path[0], path[path.size() - 1]) and good
	return good

func _start(id: String) -> void:
	sc.size = Vector2(1920, 1080)   # the desk the checks are written for (something in the headless window resets it)
	sc.start_ticket(id); bk.clear_fault()
	await _frames(4)
	evlog.clear()

## ---------------------------------------------------------------------------------------------------------------- run

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	sc.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT); sc.size = Vector2(1920, 1080)   # a known desk (the headless window default is not, and a full-rect anchor would follow it)
	await _frames(6)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start (build it: npx vite build -c vite.bridge.config.ts)"); quit(2); return
	bk = sc.backend
	bk.event.connect(func(n, _d): evlog.append(n))
	var wallet0: int = bk.wallet_minor
	print("== a novice's first bench (1-1): legs, snapping, dangling ends, undo, plain words")
	await _start("1-1")
	ok(_drag_part("led-red-5mm", null, "5mm", 8, 5, 0), "the LED is placed by pointer")
	var led0: Dictionary = bk.parts.filter(func(p): return p.kind == "LED")[0]
	ok(led0.pin_labels == ["A +", "K -"], "the LED legs carry their polarity names from the engine: %s" % str(led0.pin_labels))
	var pa := sc.pad_screen(Vector2(8, 5)); sc._motion(pa); sc._board_overlay()
	ok(str(sc.bench.overlay.get("hover_label", "")).contains("A +") and sc.bench.overlay.has("hover_pad"), "hovering the long leg highlights the pin and names it: %s" % str(sc.bench.overlay.get("hover_label", "")))
	# a wire dropped ONE PAD OFF the leg snaps to the leg and says which pin it landed on
	var from_px := sc.pad_screen(Vector2(2, 2)); var off_px := sc.pad_screen(Vector2(7, 5))
	sc._motion(from_px); sc._press(from_px); sc._motion(off_px); sc._board_overlay()
	var ovw: Dictionary = sc.bench.overlay.get("wire", {})
	ok(ovw.get("target", Vector2(-1, -1)) == Vector2(8, 5) and str(ovw.get("label", "")).contains("A +") and not bool(ovw.get("bad", true)), "while dragging, the wire end shows the leg it would land on: %s" % str(ovw.get("label", "")))
	sc._release(off_px)
	ok(bk.wires.size() == 1 and bk.wires[0].b == [8, 5], "a wire dropped one pad off the A leg snaps to the A leg (%s)" % str(bk.wires[0].b if bk.wires.size() > 0 else "none"))
	ok(bk.dangling.is_empty() and sc.top.toast.contains("A +"), "it is not dangling, and the toast names the pin: %s" % sc.top.toast)
	# hover a wire: highlighted, with the removal hint
	var w1: Dictionary = bk.wires[0]
	var wm := sc.vp_to_screen(sc.bench.org + (Vector2(w1.path[0][0], w1.path[0][1]) + Vector2(w1.path[1][0], w1.path[1][1])) * 0.5 * sc.bench.p)
	sc._motion(wm); sc._board_overlay()
	ok(sc.hover_wire == str(w1.wid) and str(sc.top.tag.get("text", "")).contains("right-click to remove") and str(sc.bench.overlay.get("hover_wire", "")) == str(w1.wid), "hovering a wire highlights it and says right-click to remove")
	# a wire that ends on an empty hole far from any leg is flagged
	ok(_drag_wire([8, 2], [14, 10]), "a second wire is dragged to an empty hole")
	ok(bk.dangling.size() == 1 and bk.dangling[0].pad == [14, 10], "the engine reports that end as dangling")
	await _frames(2)
	ok(sc.top.toast.contains("isn't touching a part's leg") and not sc.top.toast.contains("14,10") and sc.bench.model.dangling.size() == 1, "a dangling end marker is shown and the toast says so: %s" % sc.top.toast)
	_ctrl_z()
	ok(bk.wires.size() == 1 and bk.dangling.is_empty(), "Ctrl+Z takes the dangling wire back")
	# the other leg, one pad off as well
	ok(_drag_wire([8, 2], [11, 5]), "the GND wire is dropped one pad off the K leg")
	ok(bk.wires.size() == 2 and bk.wires[1].b == [10, 5] and bk.dangling.is_empty(), "it snapped to the K leg")
	# deleting the LED takes the wires its legs held (and Ctrl+Z puts everything back)
	sc._right(sc.pad_screen(Vector2(9, 5)))
	ok(bk.part_by("p1").is_empty() and bk.wires.is_empty(), "right-click on the LED removes it and the two wires only its legs held")
	ok(sc.top.toast.contains("2 wires") and not sc.top.toast.contains("(s)"), "the toast says so: %s" % sc.top.toast)
	_ctrl_z()
	ok(not bk.part_by("p1").is_empty() and bk.wires.size() == 2, "Ctrl+Z brings the LED and both wires back")
	# the naive build: the LED straight across the battery cracks at once, with the numbers in mA
	_rocker(); _clock(0.5)
	ok(bk.smoked.size() == 1, "the LED across the battery smokes at once")
	ok(str(bk.frame.events[0].text).begins_with("Burned: too much current,") and str(bk.frame.events[0].text).contains("mA vs 30 mA max"), "engine note: %s" % str(bk.frame.events[0].text).left(70))
	var b1: String = str(bk.frame.events[0].text)
	ok(b1.contains("voltage law") and not b1.contains("470") and not b1.contains("R = ") and _no_id(b1), "FIRST burn: the cause and KVL, no 470, no part id")
	var cvb: Dictionary = bk.coach_view()
	ok(str(cvb.steps[cvb.cur].text).contains("burned") and not str(cvb.steps[cvb.cur].text).to_lower().contains("clip"), "the coach says the LED burned (%s)" % str(cvb.steps[cvb.cur].text).left(50))
	ok(sc.top.toast.begins_with("Burned: too much current"), "the toast shows the engine's burned note")
	ok(bk.model.led["p1"].mood == "cracked", "the cute-mode LED face is cracked")
	_ctrl_z()
	ok(bk.smoked.is_empty() and sc.top.toast.contains("Fresh part"), "Ctrl+Z after a burn swaps in a fresh LED (%s)" % sc.top.toast)
	ok(not bk.powered and sc.top.toast.contains("power is off"), "and the power is off, so nothing re-burns by itself")
	var cvu: Dictionary = bk.coach_view()
	ok(str(cvu.steps[cvu.cur].id) == "undo-smoke" and str(cvu.steps[cvu.cur].target) == "box:res-cf", "after the burn and the undo the coach points at the resistor, not the power switch (%s)" % str(cvu.steps[cvu.cur].id))
	_clock(1.0); evlog.clear(); _clock(1.0)
	ok(bk.smoked.is_empty() and not evlog.has("smoked") and not str(sc.top.toast).contains("Burned again"), "no 'Burned again' fires while the power is off (%s)" % sc.top.toast.left(30))
	bk.set_power(true); _clock(0.5)   # burn it again: the SECOND burn gets the worked formula
	ok(bk.smoked.size() == 1 and str(bk.frame.events[0].text).contains("Burned again") and str(bk.frame.events[0].text).contains("R = (9 V - 2") and _no_id(str(bk.frame.events[0].text)), "SECOND burn: the worked formula (%s)" % str(bk.frame.events[0].text).left(60))
	_ctrl_z()
	await _start("1-1")
	_drag_part("led-red-5mm", null, "5mm", 8, 5, 0)
	sc.run_bench()
	ok(evlog.has("bench_failed") and sc.top.toast.contains("No current through the LED") and sc.top.toast.contains("0 mA") and sc.top.toast.contains("10 to 20 mA"), "the bench failure is plain words with units: %s" % sc.top.toast.left(120))
	ok(sc.top.toast.contains("backwards") and not sc.top.toast.contains("i(p1)"), "and offers the likely cause")
	await _start("1-1")
	# cute mode: the LED face follows the engine's current (sleepy at 0, happy in spec)
	ok(_build("1-1"), "the reference torch is built")
	var m0: Dictionary = bk.model.led.get("p2", {})
	ok(str(m0.get("mood", "sleepy")) == "sleepy", "unpowered: the LED face is sleepy")
	_rocker(); _clock(0.6)
	ok(str(bk.model.led["p2"].mood) == "happy" and bk.model.led["p2"].mA > 14.0, "powered at 15 mA: the face is happy (engine mood)")

	print("== 1-1 Torch")
	await _start("1-1")
	ok(sc.pages.mode == "", "the bench is open, no modal over it")
	_drag_part("led-red-5mm", null, "5mm", 8, 5, 0)
	_drag_wire([2, 2], [8, 5]); _drag_wire([10, 5], [8, 2])
	var cv: Dictionary = bk.coach_view()
	ok(str(cv.steps[cv.cur].id) == "power-on", "after LED + wires Wren says: power on (engine coach)")
	_rocker()
	ok(bk.powered, "the rocker powers the bench")
	_clock(0.5)
	ok(bk.smoked.size() == 1 and evlog.has("smoked"), "NAIVE: the LED straight on the 9 V battery smokes on the first frame")
	var pf: Dictionary = bk._frame_part("p1")
	ok(str(bk.frame.events[0].kind) == "crack" and pf.led.mood == "cracked", "crack event and a cracked LED face, both from the engine")
	ok(bk.model.led["p1"].mood == "cracked", "the view model hands the face the engine's mood")
	await _frames(3)
	ok(sc.props.mood == "wow", "the customer reacts to the smoke")
	cv = bk.coach_view()
	ok(str(cv.steps[cv.cur].id) == "undo-smoke" and str(cv.steps[cv.cur].target) == "box:res-cf", "the arrow points at the resistor in the shoebox")
	# take the burnt LED off (right-click), then build the reference torch
	sc._right(sc.pad_screen(Vector2(9, 5)))
	ok(bk.part_by("p1").is_empty(), "right-click removes the burnt LED")
	sc.start_ticket("1-1"); bk.clear_fault(); await _frames(3); evlog.clear()
	ok(_build("1-1"), "the reference torch (470 ohm + LED) is built by pointer")
	_rocker()
	_clock(0.6)
	var mA: float = bk.scope_value()
	ok(mA > 14.9 and mA < 15.0, "the scope reads the engine's 14.96 mA (%.3f)" % mA)
	ok(bk.locked and sc.scope.sc.lo == 10.0 and sc.scope.sc.hi == 20.0, "LOCK in the engine's 10 - 20 mA band")
	var lm: Dictionary = bk.model.led["p2"]
	ok(lm.mood == "happy" and lm.bloom > 0.5, "the LED face is happy at 15 mA (engine mood, bloom %.2f)" % lm.bloom)
	_clock(4.0, func(): return bk.passed)
	ok(bk.passed and evlog.has("paid"), "holding LOCK runs the bench and the customer pays")
	await create_timer(0.9).timeout
	ok(sc.props.mood == "joy" and sc.done.get("1-1", false), "Lio is happy; 1-1 is fixed")
	ok(bk.wallet_minor == wallet0 + 500 + TIP and bk.wallet_text == "$7.00", "the coin tin shows the engine wallet: the $5.00 fee and the waiting customer's $2.00 first-test tip (%s)" % bk.wallet_text)

	print("== 1-2 Tail-light (fresh AND tired battery)")
	await _start("1-2")
	var conds: Array = bk.ticket.conditions
	ok(conds.size() == 2 and str(conds[0].id) == "fresh" and str(conds[1].id) == "tired", "the ticket carries both battery conditions: fresh and tired")
	ok(sc.supply.conditions.size() == 2, "the battery holder shows the bench-test tag")
	var tagr: Rect2 = SupplyView.cond_tag_rect(2)
	var overlap := false
	for tr in SupplyView.battery_text_rects(): if (tr as Rect2).intersects(tagr): overlap = true
	ok(not overlap, "1-2: the bench-test note does not sit on the battery's label or its 9V")
	_drag_part("led-red-5mm", null, "5mm", 8, 5, 0); _drag_wire([2, 2], [8, 5]); _drag_wire([10, 5], [8, 2])
	_rocker(); _clock(0.5)
	var cv2: Dictionary = bk.coach_view()
	ok(bk.smoked.size() == 1 and str(cv2.steps[cv2.cur].id) == "burned" and str(cv2.steps[cv2.cur].text).begins_with("The LED burned") and _no_id(str(cv2.steps[cv2.cur].text)), "1-2: a burnt LED -> the coach says so, not 'clip the meter' (%s)" % str(cv2.steps[cv2.cur].text).left(40))
	await _start("1-2")
	# naive: 180 ohm passes the live (fresh) band but the bench's tired battery fails it
	var R2: Dictionary = EngineBench.REFS["1-2"]
	_drag_part("res-cf", 180, "0.25W", 2, 5, 0)
	for k in 3: _drag_part("led-red-5mm", null, "5mm", [8, 14, 18][k], 5, 0)
	for w in R2.wires: _drag_wire((w as Array)[0], (w as Array)[(w as Array).size() - 1])
	_rocker()
	_clock(5.0, func(): return evlog.has("bench_failed"))
	ok(bk.locked and not bk.passed and evlog.has("bench_failed"), "NAIVE: 180 ohm locks live (fresh) but fails the bench on the tired battery")
	ok(bk.last_result.failures.size() > 0, "the engine explains the failure (%s)" % str(bk.last_result.failures[0].text).left(60))
	await _start("1-2")
	ok(_build("1-2"), "the reference tail-light (150 ohm + 3 LEDs in series) is built by pointer")
	_rocker()
	_clock(6.0, func(): return bk.passed)
	var g2: float = bk.scope_value()
	ok(bk.passed and g2 >= 14.0 and g2 <= 20.0, "LOCK and a bench pass at %.2f mA (14 - 20)" % g2)
	ok(bk.wallet_minor == wallet0 + 500 + TIP + 700 + TIP, "paid 7.00 and the $2.00 first-test tip (%s)" % bk.wallet_text)
	await create_timer(0.7).timeout

	print("== 1-3 Hot Resistor")
	await _start("1-3")
	var tg: Dictionary = bk.scope_q.target
	ok(tg.lo == 7.85 and tg.hi == 8.4, "the band is the engine's 7.85 - 8.40 V (no widened fixture band)")
	ok(sc.scope.sc.mode == "probe", "the scope measures a node voltage: it needs the CH1 clip")
	# naive: 22 ohm 1/4 W
	_drag_part("res-cf", 22, "0.25W", 4, 2, 0)
	_drag_wire([2, 2], [4, 2]); _drag_wire([8, 2], [14, 2])
	_rocker()
	_clock(0.5); await _frames(2)
	ok(not sc.scope.attached, "unclipped: the trace sits on the baseline and the VFD asks for the clip")
	_drag_probe("ch1", [14, 2])
	ok(bk.probes.ch1 == [14, 2], "dragging the CH1 clip onto the OUT pad attaches the probe")
	_clock(0.4); await _frames(2)
	ok(sc.scope.attached and absf(bk.scope_value() - 8.3333) < 0.01, "the clipped trace reads the engine's 8.333 V")
	ok(float(bk.model.ambient) == 50.0, "the frame's ambient is the warm hood, 50 C")
	var seen := {"hot": false}
	_clock(30.0, func():
		if bk.hot_k() > 0.3 and bk.smoked.is_empty(): seen.hot = true
		return not bk.smoked.is_empty())
	ok(seen.hot, "the 1/4 W resistor glows (warm / hot state from the engine) before it goes")
	ok(bk.smoked.size() == 1 and evlog.has("smoked"), "NAIVE: 22 ohm 1/4 W smokes after thermal time (0.61 W in 0.25 W) %s %s" % [str(bk.smoked.keys()), str(evlog)])
	ok(str(bk.frame.events[0].kind) == "smoke" and str(bk.frame.events[0].text).contains("rated"), "the smoke explanation names the rating")
	ok(str(bk.frame.events[0].text).begins_with("The 22 \u03a9 \u00bc W resistor") and _no_id(str(bk.frame.events[0].text)), "and the part by name, not by id: %s" % str(bk.frame.events[0].text).left(34))
	# the shoebox is a scrollable box: wheel, drag and swipe scroll it; rows are readable and finger-sized; labels never overlap
	var inner: Rect2 = sc.props.box_inner(); var nitems: int = sc.props.items.size(); var mx: float = StallProps.max_scroll(inner, nitems)
	print("   (desk %s, box %s, inner %s)" % [str(sc.size), str(sc.L.box), str(inner)])
	ok(mx > 0.0 and sc.props.bin_scroll == 0.0, "1-3 shoebox: %d parts, %.1f rows hidden, scrolled to the top" % [nitems, mx])
	ok(StallProps.arrows(inner, nitems, 0.0).down.size == Vector2.ZERO, "there are no paging tabs: the box scrolls itself")
	var bc: Vector2 = (sc.L.box as Rect2).get_center()
	sc._motion(bc); sc._wheel(bc, -1); sc._wheel(bc, -1)
	ok(is_equal_approx(sc.props.bin_scroll, 2.0 * StallScene.WHEEL_ROWS), "two wheel notches scroll %s rows (%s)" % [str(2.0 * StallScene.WHEEL_ROWS), str(sc.props.bin_scroll)])
	for k in 30: sc._wheel(bc, -1)
	ok(is_equal_approx(sc.props.bin_scroll, mx), "it stops at the last row (%s)" % str(sc.props.bin_scroll))
	for k in 30: sc._wheel(bc, 1)
	ok(sc.props.bin_scroll == 0.0, "and back to the top")
	# a vertical drag on the box scrolls it (touch / mouse drag); it never lifts a part
	var pdn: Vector2 = inner.position + Vector2(60, 90)
	sc._motion(pdn); sc._press(pdn); sc._motion(pdn + Vector2(0, -50)); sc._motion(pdn + Vector2(0, -140)); sc._release(pdn + Vector2(0, -140))
	ok(sc.props.bin_scroll > 1.2 and sc.drag.is_empty() and bk.parts.filter(func(p): return not p.fixed).size() <= 1, "dragging up on the box scrolls it (%.2f rows) and lifts nothing" % sc.props.bin_scroll)
	sc._fling = 0.0; sc.props.bin_scroll = 0.0
	# a sideways drag from a row lifts that part (the old behaviour)
	sc._motion(pdn); sc._press(pdn); sc._motion(pdn + Vector2(60, 4)); sc._motion(pdn + Vector2(300, 10))
	ok(sc.drag.get("kind", "") == "part" and int(sc.drag.item) >= 0, "dragging sideways from a row picks that part up")
	sc._release(pdn + Vector2(300, 10)); sc.drag.clear()
	# labels: the value and the watt rating sit on one line; the price is on its own line under it, never over it
	var sl0: Array = StallProps.slots(inner, nitems, 0.0)
	var r0: Rect2 = sl0[0]
	ok(r0.size.y >= StallProps.ROW_H - 4.0 and r0.size.x > 200.0, "a tray row is %dx%d design px (finger sized)" % [int(r0.size.x), int(r0.size.y)])
	var lab0: String = sc.props.items[0].label + " " + sc.props.items[0].tag
	ok(lab0.contains("Ω") and lab0.contains("W") and S_TW(lab0, 22) < r0.size.x - 100.0 - 8.0, "'%s' fits its label paper (%d < %d)" % [lab0, int(S_TW(lab0, 22)), int(r0.size.x - 108.0)])
	# handheld: the minimum text is 16 screen px and the rows grow
	StallStyle_set_handheld(true, 24)
	var r0h: Rect2 = StallProps.slots(sc.props.box_inner(), nitems, 0.0)[0]
	ok(r0h.size.y * 0.667 >= 44.0 and S_TW("22", 8) >= S_TW("22", 24) - 0.01, "handheld: a row is at least 44 screen px tall (%.0f) and 8 px text is raised to the 24 design px minimum" % (r0h.size.y * 0.667))
	StallStyle_set_handheld(false, 0)
	sc.props.bin_scroll = 0.0
	await _frames(3)
	ok(sc.props.hot > 0.5 or sc.props.smoked, "Rezzy is awake")
	# the Omega mode on the DMM: heater in parallel with what the zeroed supply leaves
	await _start("1-3")
	ok(_build("1-3"), "the reference (22 ohm 1 W) is built by pointer")
	_drag_probe("red", [14, 2]); _drag_probe("black", [14, 8])
	ok(bk.dial == "V" and bk.probes.red == [14, 2], "placing the first lead turns the DMM dial to V")
	await _dial_to("Ω")
	_clock(0.3)
	var ohm: Dictionary = bk.dmm()
	ok(bk.dial == "Ω" and ohm.unit == "Ω" and float(ohm.text) > 14.0 and float(ohm.text) < 16.5, "DMM in ohm mode reads the engine's resistance across the heater: %s %s" % [ohm.text, ohm.unit])
	await _dial_to("V")
	_rocker()
	_drag_probe("ch1", [14, 2])
	_clock(0.4)
	ok(bk.dmm().text.begins_with("8.3"), "DMM volts across the heater: %s V" % bk.dmm().text)
	_clock(6.0, func(): return bk.passed)
	ok(bk.passed, "22 ohm 1 W locks 8.33 V and passes the bench")
	ok(bk.last_result.stars == 1 and bk.last_result.metrics.cost == 7, "Ref A earns 1 star at 7 c: the cheaper Ref B has the cost par")
	# the ammeter: the DMM between its leads across the series resistor reads the heater current (0.1 ohm burden)
	_drag_probe("red", [4, 2]); _drag_probe("black", [8, 2])
	await _dial_to("mA")
	_clock(0.3)
	var am: Dictionary = bk.dmm()
	ok(am.unit == "mA" and am.text.is_valid_float() and float(am.text) > 230.0 and float(am.text) < 245.0, "DMM in mA mode across the resistor reads the engine's current: %s mA" % am.text)
	await create_timer(0.7).timeout

	print("== 1-4 Tired Battery")
	await _start("1-4")
	ok(bk.ticket.supply.tired and sc.supply.tired, "the battery holder wears the 'tired' sticker (the engine's tired PP3)")
	ok(_build("1-4"), "the load is built")
	evlog.clear(); _bench_key()
	ok(evlog.has("bench_failed") and not bk.passed and sc.top.toast.begins_with("Measure it first"), "1-4: the bench refuses until the pack has been measured (%s)" % sc.top.toast.left(40))
	await _start("1-4")
	_rocker()
	_drag_probe("red", [2, 2]); _drag_probe("black", [8, 2])
	_clock(0.3)
	var oc: Dictionary = bk.dmm()
	ok(oc.unit == "V" and float(oc.text) > 8.9 and float(oc.text) < 9.1, "open-circuit voltage on the DMM: %s V" % oc.text)
	_rocker()
	_drop_probe("red"); _drop_probe("black")
	ok(bk.probes.red == null and bk.probes.black == null, "dropping a lead off the board takes it off its pad")
	ok(_build("1-4"), "the reference load (4.7 ohm 5 W) is built by pointer")
	_rocker()
	_drag_probe("red", [2, 2]); _drag_probe("black", [8, 2])
	_clock(0.3)
	var lv: Dictionary = bk.dmm()
	ok(float(lv.text) > 4.4 and float(lv.text) < 4.6, "loaded terminal voltage sags to %s V" % lv.text)
	_clock(6.0, func(): return bk.passed)
	ok(bk.passed and bk.scope_value() >= 4.2, "LOCK at %.2f W (at least 4.2) and a bench pass" % bk.scope_value())
	await create_timer(0.7).timeout

	print("== 1-5 EB Two Batteries (predict first)")
	await _start("1-5")
	ok(sc.pages.mode == "predict" and sc.pages.pred_fields.size() == 2, "the exam slip asks for V(A) and I(E2) before building")
	var fig: Dictionary = bk.ticket.get("figure", {}) if bk.ticket.get("figure", null) is Dictionary else {}
	ok(fig.get("node", "") == "A" and fig.sources.size() == 2 and float(fig.sources[0].volts) == 10.0 and float(fig.sources[1].r.ohm) == 3.0 and float(fig.load.ohm) == 6.0, "the engine hands over the exam figure: E1 10 V + R1 2, E2 5 V + R2 3, R3 6 to ground, node A")
	ok(not sc.props.exam_fig.is_empty() and str(bk.ticket.pay_text).contains("per new star"), "the problem card is on the bench, and the chit explains the payout (%s)" % str(bk.ticket.pay_text))
	ok(sc.supply.kind == "sources" and sc.supply.sources.size() == 2 and sc.supply.label == "textbook sources", "the supply panel lists the two ideal sources (not a single-battery 0.0 V display)")
	ok(sc.pages.coach_ticket.get("id", "") == "1-5", "the notebook header is this ticket, 1-5 (%s)" % str(sc.pages.coach_ticket.get("id", "")))
	_type("6.6667"); _key(KEY_TAB); _type("0.5556")
	ok(sc.pages.pred_fields[0].text == "6.6667" and sc.pages.pred_fields[1].text == "0.5556", "digits typed into the slip fields")
	_key(KEY_ENTER)
	ok(sc.pages.mode == "" and bk.predictions_done(), "Enter locks both predictions into the engine")
	ok(_build("1-5"), "the exam bridge (R1 2, R2 3, R3 6 ohm) is built by pointer")
	_rocker()
	_drag_probe("ch1", [8, 7])   # NOT the brass A pad: R3's top leg, which is node A as well
	_clock(0.4); await _frames(2)
	ok(sc.scope.attached and absf(bk.scope_value() - 6.6667) < 0.001, "a clip on R3's top leg is on node A: the scope reads %.4f V (it read 0 when only the exact connector pad counted)" % bk.scope_value())
	_drag_probe("red", [8, 6]); _drag_probe("black", [8, 12]); _clock(0.3)
	ok(bk.dmm().text.begins_with("6.66") or bk.dmm().text.begins_with("6.67"), "the DMM across A and GND reads %s V" % bk.dmm().text)
	_drag_probe("ch1", [8, 6])
	_clock(0.4); await _frames(2)
	ok(sc.scope.attached and absf(bk.scope_value() - 6.6667) < 0.001, "V(A) on the scope: %.4f V" % bk.scope_value())
	ok(str(sc.supply.label) == "textbook sources" and not (sc.supply.kind == "bench"), "the supply panel never claims a 0.0 V bench supply on 1-5")
	ok(bk.locked, "LOCK on the 0.1 % band")
	_bench_key()
	ok(bk.passed and bk.last_result.stars == 3, "the BENCH key checks the predictions and the build: 3 stars (%s)" % str(bk.last_result.predictions.map(func(p): return p.gradeText)))
	await create_timer(0.7).timeout
	# a missing prediction refuses the bench
	await _start("1-5")
	_key(KEY_ESCAPE)
	ok(_build("1-5"), "second go: build before predicting")
	_rocker(); _drag_probe("ch1", [8, 6]); _clock(0.3)
	_bench_key()
	ok(not bk.passed and sc.pages.mode == "predict", "the bench refuses until the predictions are in, and the slip opens again")
	_key(KEY_ESCAPE)
	ok(sc.pages.mode == "", "'later' closes the slip")
	_click_rect(sc.L.exam)
	ok(sc.pages.mode == "predict", "the exam slip on the bench reopens it after 'later'")
	_key(KEY_ESCAPE)

	print("== N3: battery jacks, lead tips, power word, LCD digits, the customer's face, the student's 1-5")
	await _start("1-4")
	ok(DmmView.lcd_text(9.0, "") == "9.000" and DmmView.lcd_text(5.32, "") == "5.320" and DmmView.lcd_text(14.96, "") == "14.96" and DmmView.lcd_text(4.7, "") == "4.700" and DmmView.lcd_text(-0.5, "") == "-0.500", "the LCD lays 9.000 / 5.320 / 14.96 / 4.700 / -0.500 on four digit cells")
	ok(DmmView.lcd_text(null, "----") == "----", "no reading shows dashes")
	var tip0: Vector2 = sc._probe_tip("red")
	ok(sc._tip_hit(tip0 + Vector2(-30, 20)) == "red" and sc._tip_hit(tip0) == "red", "a lead is grabbed by a generous disc around its tip, not only by its body")
	_rocker()
	await _frames(2)
	ok(bk.powered and sc.supply.on, "the rocker switches the pack on")
	_rocker()
	ok(not bk.powered and sc.top.toast.contains("Power off"), "switching off shows a short 'Power off' toast (%s)" % sc.top.toast)
	var jr: Vector2 = sc.supply.position + sc.supply.jack_pos("red") * sc.supply.scale.x
	var jb: Vector2 = sc.supply.position + sc.supply.jack_pos("black") * sc.supply.scale.x
	for pair in [["red", jr], ["black", jb]]:
		var tp: Vector2 = sc._probe_tip(str(pair[0])); sc._motion(tp); sc._press(tp)
		sc._motion(pair[1]); sc._board_overlay(); sc._release(pair[1])
	ok(bk.probes.red == [2, 2] and bk.probes.black == [8, 2], "the red lead on the battery's + jack reads the supply net, the black one on the - jack reads GND (%s %s)" % [str(bk.probes.red), str(bk.probes.black)])
	ok(sc._probe_tip("red").distance_to(jr) < 1.0 and sc._probe_tip("black").distance_to(jb) < 1.0, "and the lead tips rest on the jacks")
	_rocker(); _clock(0.3)
	var ocv: Dictionary = bk.dmm()
	ok(ocv.unit == "V" and float(ocv.text) > 8.9 and float(ocv.text) < 9.1 and DmmView.lcd_text(ocv.get("value", null), str(ocv.text)) == "9.000", "open-circuit volts through the jacks: %s V, LCD %s" % [ocv.text, DmmView.lcd_text(ocv.get("value", null), "")])
	var cv14: Dictionary = bk.coach_view()
	ok(not str(cv14.steps[0].text).contains("terminals") or str(cv14.steps[0].text).contains("metal tips"), "the 1-4 coach words match what the jacks accept")
	# the customer: no smile and no moving car until the bench has passed
	await _start("1-4")
	ok(_build("1-4"), "1-4: the reference load is built")
	_rocker(); _clock(8.0, func(): return evlog.has("bench_failed"))
	ok(bk.locked and not bk.passed and evlog.has("bench_failed"), "the live band locks, the bench says 'Measure it first' and does not pass")
	sc._smoke_mood_until = -1.0
	await _frames(4)
	ok(sc.props.mood != "joy" and sc.props.mood == "hopeful", "before the bench passes the customer wears the neutral 'let's see' face, not the smile (%s)" % sc.props.mood)
	for pair in [["red", jr], ["black", jb]]:
		var tp2: Vector2 = sc._probe_tip(str(pair[0])); sc._motion(tp2); sc._press(tp2)
		sc._motion(pair[1]); sc._board_overlay(); sc._release(pair[1])
	_clock(8.0, func(): return bk.passed)
	ok(bk.passed, "after measuring at the jacks the bench passes")
	await create_timer(0.9).timeout
	await _frames(3)
	ok(sc.props.mood == "joy", "the smile (and the car moving) arrive with the pass")
	# the student's 1-5: right circuit, but the return net never reaches the GND pad
	await _start("1-5")
	_type("6.6667"); _key(KEY_TAB); _type("0.5556"); _key(KEY_ENTER)
	var R5: Dictionary = EngineBench.REFS["1-5"]
	for p5 in R5.parts: _drag_part(str(p5[0]), p5[1], str(p5[2]), int(p5[3]), int(p5[4]), int(p5[5]))
	for w5 in R5.wires:
		var path5: Array = w5
		var last5: Array = path5[path5.size() - 1]
		if last5 == [8, 12]: last5 = [11, 13]   # the novice's return net: a few holes from the GND pad (a drop within reach of the GND clip would snap to it)
		ok(_drag_wire(path5[0], last5), "1-5 wire %s to %s" % [str(path5[0]), str(last5)])
	_rocker()
	var c15: Dictionary = bk.coach_view()
	ok(str(c15.steps[c15.cur].id) == "ground" or str(c15.steps[c15.cur].text).contains("GND"), "the coach says the circuit is not tied to GND (%s)" % str(c15.steps[c15.cur].text).left(50))
	_bench_key()
	var b5: String = str(bk.last_result.failures[0].text) if bk.last_result.failures.size() > 0 else ""
	ok(not bk.passed and b5 != "" and not b5.contains("0.0000"), "R3's return is not on the GND pad: the bench fails it in words, not '0.00005 V': %s" % b5.left(80))
	var tied := _drag_wire([8, 11], [8, 12])   # R3's bottom leg already has one wire (to the stray return hole): a second wire onto it, this time to the GND pad
	_bench_key()
	ok(tied, "R3's bottom leg (already wired) takes a second wire, to the GND pad")
	ok(bk.passed, "tied to GND, the same build passes, and the meter and the bench agree on A")

	print("== N4: the handheld round (power-off bench, leg drags, pads that take several wires, the exam's pre-wired GND)")
	await _start("1-1")
	ok(_build("1-1"), "N4: the reference torch is built")
	ok(not bk.powered, "N4: ... and the power switch is OFF")
	evlog.clear()
	sc.run_bench()
	ok(bk.powered and evlog.has("power") and bk.passed, "N4: GO with the power off switches it on by itself and the bench runs (powered=%s passed=%s)" % [str(bk.powered), str(bk.passed)])
	ok(sc.top.toast.to_lower().contains("power") or evlog.has("paid"), "N4: the click and the toast say so (%s)" % sc.top.toast.left(60))
	# a drag that starts on a part's lead (between its leg and its body) wires; it never moves or removes the part
	await _start("1-1")
	_drag_part("res-cf", 470, "0.25W", 2, 5, 0)
	var rp: Dictionary = bk.parts.filter(func(p): return p.kind == "R")[0]
	var lead_at := sc.pad_screen(Vector2(2.8, 5.0))
	ok(sc.snap(lead_at, 0.6, 0.5).kind != "pin" and not sc.part_at(lead_at).is_empty(), "N4: 2.8 pads along a resistor is its lead: not a leg snap, but inside the part's bounds")
	var wn0 := bk.wires.size()
	var dest := sc.pad_screen(Vector2(2, 9))
	sc._motion(lead_at); sc._press(lead_at); sc._motion(dest); sc._release(dest)
	var rp2: Dictionary = bk.parts.filter(func(p): return p.kind == "R")[0]
	ok(rp2.x == rp.x and rp2.y == rp.y and bk.wires.size() == wn0 + 1 and bk.wires[bk.wires.size() - 1].a == [2, 5], "N4: dragging from the lead draws a wire from that leg (part stays at %d,%d; wires %d)" % [rp2.x, rp2.y, bk.wires.size()])
	var lead2 := sc.pad_screen(Vector2(5.3, 5.0))   # the other lead
	var dest2 := sc.pad_screen(Vector2(7, 8))
	var wn1 := bk.wires.size()
	sc._motion(lead2); sc._press(lead2); sc._motion(dest2); sc._release(dest2)
	ok(bk.parts.filter(func(p): return p.kind == "R")[0].x == 2 and bk.wires.size() == wn1 + 1 and bk.wires[bk.wires.size() - 1].a == [6, 5], "N4: and from the far lead too")
	var body_at := sc.pad_screen(Vector2(4.0, 5.0))   # the body: this one moves the part
	var body_to := sc.pad_screen(Vector2(4.0, 10.0))
	var wn2 := bk.wires.size()
	sc._motion(body_at); sc._press(body_at); sc._motion(body_to); sc._board_overlay(); sc._release(body_to)
	ok(bk.parts.filter(func(p): return p.kind == "R")[0].y != 5 and bk.wires.size() == wn2, "N4: dragging the BODY moves the part")
	# the exam: the two batteries arrive tied to the GND pad; the player places R1 R2 R3 (3 parts, 6 wires)
	await _start("1-5")
	_key(KEY_ESCAPE)
	var fw: Array = bk.wires.filter(func(w): return bool(w.get("fixed", false)))
	ok(bk.wires.size() == 2 and fw.size() == 2, "N4: 1-5 opens with two wires already soldered (E1 and E2 minus ends to GND)")
	var fx: Vector2 = sc.vp_to_screen(sc.bench.org + Vector2(2, 10) * sc.bench.p)   # a point on E1's soldered wire (2,8)->(2,12)
	sc._motion(fx); sc._board_overlay()
	ok(sc.hover_wire != "" and str(sc.top.tag.get("text", "")).contains("soldered"), "N4: hovering it says it is soldered in place")
	sc._right(fx)
	ok(bk.wires.size() == 2 and sc.top.toast.contains("came with the ticket"), "N4: right-click cannot remove it (%s)" % sc.top.toast.left(50))
	var gp: Array = bk.ticket.board.connectors
	var has_a := false; var has_g := false
	for cc in gp: if cc.id == "A" and cc.pad == [8, 6]: has_a = true
	for cc in gp: if cc.id == "GND" and cc.pad == [8, 12]: has_g = true
	ok(has_a and has_g, "N4: the board carries a labelled A pad (8,6) and GND pad (8,12)")
	_drag_part("res-exact", 2, "ideal", 4, 2, 0); _drag_part("res-exact", 3, "ideal", 10, 4, 0); _drag_part("res-exact", 6, "ideal", 8, 7, 1)
	var wires_before := bk.wires.size()
	ok(_drag_wire([2, 2], [4, 2]) and _drag_wire([8, 2], [8, 6]) and _drag_wire([14, 2], [14, 4]) and _drag_wire([10, 4], [8, 6]), "N4: four wires, two of them onto the A pad")
	ok(_drag_wire([8, 7], [8, 6]), "N4: a THIRD wire onto the already wired A pad is accepted (pads take several wires)")
	ok(_drag_wire([8, 11], [8, 12]), "N4: R3's bottom to the GND pad")
	ok(bk.wires.size() == wires_before + 6 and bk.dangling.is_empty(), "N4: 3 parts and 6 wires of the player's own, nothing dangling (%d wires)" % (bk.wires.size() - wires_before))
	# a wire whose straight routes all run over legs and wires still gets there (the engine finds a hop-over route)
	ok(_drag_wire([2, 2], [8, 2]), "N4: a wire from E1+ to R1's far leg runs around R1 (no 'draw it in two steps')")
	_key(KEY_Z)
	# the notebook: one tap opens, Esc or the X closes, a click inside the book does not
	sc.pages.show_page("")
	_click_rect(sc.L.notebook)
	ok(sc.pages.mode == "notebook", "N4: one tap on the notebook opens it")
	var inside := Vector2(sc.size.x * 0.5, sc.size.y * 0.5)
	var evn := InputEventMouseButton.new(); evn.pressed = true; evn.button_index = MOUSE_BUTTON_LEFT; evn.position = inside
	await _frames(2); sc.pages._gui_input(evn)
	ok(sc.pages.mode == "notebook", "N4: a tap inside the open book does not close it")
	_key(KEY_ESCAPE)
	ok(sc.pages.mode == "", "N4: Esc closes it")
	_key(KEY_ESCAPE)
	ok(sc.pages.mode == "", "N4: and Esc on the bench does not open it again")

	print("== the chapter map")
	sc.go_map(); await _frames(3)
	var done_n := 0
	for tk in sc.pages.tickets: if tk.done: done_n += 1
	ok(done_n == 5 and sc.pages.wallet_text == bk.wallet_text, "the map shows five FIXED chits and the engine wallet (%s)" % sc.pages.wallet_text)
	var t11: Dictionary = sc.pages.tickets[0]
	ok(str(t11.pay_text) == "fee $3.00 + $1.00 per new star" and int(t11.stars_max) == 2, "a chit explains its payout: %s" % str(t11.pay_text))
	var w_before: int = bk.wallet_minor
	var btn := {}
	for b in sc.pages._buttons: if b.id == "ticket" and b.arg == "1-1": btn = b
	ok(not btn.is_empty(), "the FIXED 1-1 chit is a button")
	if not btn.is_empty():
		var ev := InputEventMouseButton.new(); ev.pressed = true; ev.button_index = MOUSE_BUTTON_LEFT; ev.position = (btn.rect as Rect2).get_center()
		sc.pages._gui_input(ev)
	await _frames(4)
	ok(sc.phase == "bench" and bk.ticket.id == "1-1" and bk.parts.filter(func(p): return not p.fixed and not str(p.uid).begins_with("x")).is_empty(), "clicking a FIXED chit reopens the ticket on a fresh board (the torch as it arrived, none of the player's build)")
	bk.clear_fault()
	ok(_build("1-1"), "replay: the torch is built again")
	_rocker(); _clock(6.0, func(): return bk.passed)
	ok(bk.passed and bk.wallet_minor == w_before, "replay: it passes again and pays nothing twice (wallet %s)" % bk.wallet_text)
	ok(StallTop.longest_lines <= 8, "no message needs more than two pages on a 1280x800 handheld (%d lines: %s)" % [StallTop.longest_lines, StallTop.longest.left(90)])
	ok(trap.count == 0, "zero script errors in the whole run (%d: %s)" % [trap.count, str(trap.lines.slice(0, 3))])
	print("\n%d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
