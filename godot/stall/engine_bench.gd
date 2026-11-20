class_name EngineBench
extends RefCounted
## The bench backend that drives the REAL engine (src/engine, docs/API-CH1.md) through the sidecar. Same method seam as FixtureBench (its header lists it),
## plus a few engine-only calls (run_bench, predict, coach_view, progress). Every number the stall shows is read from the engine's queries:
##   bench()       the board, parts, wires, instruments, status            liveFrame()  node volts, currents, speeds, temperatures, states, LED mood/bloom, smoke events
##   scope()       trace samples, amber band, LOCK, gauge value             dmm()        the LCD (V / mA / ohm)
##   ticketCard()  customer, brief, specs, shoebox with prices and ratings   coach()      Wren's steps with their anchors
##   wallet() chapterMap() benchResult()
## The only things decided here are presentation: which scope scale to draw the engine's band on, the arrow targets, and the line a customer says.
signal event(name: String, data: Dictionary)

const LOCK_HOLD := 1.2             ## seconds the engine's live LOCK must hold before the formal bench check runs by itself
const FRAME_DT := 1.0 / 30.0       ## the engine advances one frame per 1/30 s of play (API-CH1: advance 1..8 per tick)
const ENGINE := true

## What the customers say (presentation only; the region pack owns names).
const FLAVOUR := {
	"1-1": {"gadget": "torch", "ask": "My torch died.", "thanks": "It lights up! You fixed it!"},
	"1-2": {"gadget": "taillight", "ask": "Can you make my bike light brighter?", "thanks": "Now they see me coming!"},
	"1-3": {"gadget": "heater", "ask": "The heater runs too hot for the fish.", "thanks": "The fish are comfortable again."},
	"1-4": {"gadget": "car", "ask": "My car got slow.", "thanks": "Vroom! Fast again!"},
	"1-5": {"gadget": "exam", "ask": "Predict first, then probe.", "thanks": "The numbers agree!"},
}
const DIAL_ENGINE := {"OFF": "off", "V": "dcv", "mA": "dca", "Ω": "ohm"}
const DIAL_LABEL := {"off": "OFF", "dcv": "V", "dca": "mA", "ohm": "Ω"}

var bridge                          ## CbBridge (a Node: the scene adds it to the tree so the sidecar dies with the game)
var started := false
var ticket: Dictionary = {}         ## scene-facing ticket (see _load_ticket)
var card: Dictionary = {}           ## ticketCard()
var parts: Array = []               ## placed parts, scene shape {uid, partId, value, label, kind, x, y, rot, flip, fixed, variant, tag, pins:[[x,y],..]}
var wires: Array = []               ## [{wid, a, b, path}]
var probes := {"red": null, "black": null, "ch1": null}
var dial := "V"                     ## OFF | V | mA | Ω
var powered := false
var locked := false                 ## the engine's live LOCK (band held, powered, nothing smoked)
var passed := false                 ## the formal bench passed (the ticket is done and paid)
var smoked := {}
var temps := {}
var hold := 0.0
var t := 0.0
var model: Dictionary = {}
var dmm_used := false
var dmm_loaded := false
var thermal_speed := 1.0            ## unused: the engine owns thermal time (kept for the fixture seam)
var frame: Dictionary = {}          ## liveFrame()
var scope_q: Dictionary = {}        ## scope()
var dmm_q: Dictionary = {}          ## dmm()
var bench_q: Dictionary = {}        ## bench()
var last_result: Dictionary = {}    ## benchResult() after the last run
var dangling: Array = []            ## wire ends that touch no leg: [{wid, pad: [x, y]}] (bench().dangling)
var open_pins: Array = []           ## part legs with nothing wired to them
var undo_depth := 0
var last_note := ""                 ## the engine's sentence for the last edit (wire landing, removed wires, undo)
var wallet_minor := 0
var wallet_text := "$0.00"
var scope_view: Dictionary = {}     ## what ScopeView draws: {unit, lo, hi, vdiv, label, mode, clip_pad, clipped, value, text, attached}
var _hidden: Dictionary = {}        ## uid -> true: fixed supply parts drawn by the supply view instead of on the board
var _accum := 0.0
var _bench_key := ""
var _was_lock := false
var _all_parts: Array = []
var _smoke_seen := {}

func _init(b = null) -> void:
	bridge = b if b != null else CbBridge.new()
	started = bridge.start() if b == null else true
	if started: refresh_wallet()

func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE and bridge != null and bridge.has_method("stop"): bridge.stop()

func _act(name: String, args: Array = []) -> Dictionary: return bridge.act(name, args)
func _q(name: String, args: Array = []): return bridge.q(name, args)

## ------------------------------------------------------------------------------------------------------------------ tickets and progress

func open_ticket(id: String) -> bool:
	var prev := str(ticket.get("id", ""))
	_act("closeTicket")   # whatever the engine still has open (it may be one this side lost track of: a load, a failed open)
	var r := _act("openTicket", [id])
	if not r.get("ok", false):   # e.g. locked: keep the ticket that was open
		push_warning("openTicket %s: %s" % [id, r.get("message", "")])
		if prev != "" and _act("openTicket", [prev]).get("ok", false): _load_ticket()
		else: ticket = {}
		return false
	powered = false; locked = false; passed = false; smoked.clear(); temps.clear(); hold = 0.0; t = 0.0; _accum = 0.0; _was_lock = false
	probes = {"red": null, "black": null, "ch1": null}; dial = "OFF"; dmm_used = false; dmm_loaded = false
	frame = {}; last_result = {}; _bench_key = ""; _smoke_seen.clear()
	_load_ticket()
	return true

func close_ticket() -> void:
	_act("closeTicket")
	ticket = {}

func new_game() -> void:
	_act("newGame", [1]); ticket = {}; refresh_wallet()

func save_game() -> void: _act("save", ["main"])
func has_save() -> bool: return bool(_q("hasSave", ["main"]))
func load_game() -> bool:
	var r := _act("load", ["main"]); ticket = {}; refresh_wallet(); return bool(r.get("ok", false))

func refresh_wallet() -> void:
	var w = _q("wallet")
	if w is Dictionary: wallet_minor = int(w.get("minor", 0)); wallet_text = str(w.get("text", ""))

## Chapter map rows for the notebook page: [{id, title, customer, spec, price (minor), price_text, open, done, stars, state}].
func progress() -> Dictionary:
	var m = _q("chapterMap", [1])
	var rows: Array = []
	if m is Dictionary:
		for tk in m.get("tickets", []):
			var st := str(tk.get("state", "locked"))
			rows.append({"id": str(tk.id), "title": str(tk.title), "customer": str(tk.customer), "spec": str(tk.get("spec", "")), "price": int(tk.get("fee", 0)),
				"price_text": str(tk.get("feeText", "")), "open": st != "locked", "done": st == "passed" or st == "done", "stars": int(tk.get("stars", 0)), "state": st,
				"pay_text": str(tk.get("payText", "")), "stars_max": int(tk.get("starsMax", 2)),
				"best_text": ("best cost %s" % str((tk.best as Dictionary).get("costText", ""))) if tk.get("best", null) is Dictionary else ""})
	return {"tickets": rows, "wallet": wallet_minor, "wallet_text": wallet_text, "stars": int((m as Dictionary).get("starsEarned", 0)) if m is Dictionary else 0}

func _load_ticket() -> void:
	card = _q("ticketCard")
	_refresh_board()
	var sc = _q("scope", [1])
	scope_q = sc if sc is Dictionary else {}
	var id := str(card.get("id", ""))
	var fl: Dictionary = FLAVOUR.get(id, {})
	var tg: Dictionary = scope_q.get("target", {}) if scope_q.get("target", null) is Dictionary else {}
	var supply := _supply_info()
	var conns: Array = []
	for c in bench_q.get("connectors", []):
		var role := str(c.role)
		conns.append({"id": str(c.id), "pad": [int(c.pad[0]), int(c.pad[1])], "role": "supply" if role in ["rail", "source"] else ("ground" if role == "ground" else role)})
	ticket = {"id": id, "figure": card.get("figure", null), "pay_text": str(card.get("payText", "")), "title": str(card.get("title", "")), "customer": str(card.get("customer", "")), "brief": str(card.get("brief", "")),
		"gadget": str(fl.get("gadget", "exam")), "ask": str(fl.get("ask", "")), "thanks": str(fl.get("thanks", "")),
		"price": int(card.get("fee", 0)), "price_text": str(card.get("feeText", "")), "eb": bool(card.get("eb", false)),
		"specs": card.get("specs", []), "targets": card.get("targets", []), "conditions": card.get("conditions", []), "predictions": card.get("predictions", []),
		"supply": supply, "board": {"w": int(bench_q.get("w", 24)), "h": int(bench_q.get("h", 16)), "connectors": conns}}
	_scope_setup(tg)
	ticket["spec_full"] = _short_spec(tg)
	ticket["scope"] = scope_view
	_exam_hide()
	_rebuild_model()

func _supply_info() -> Dictionary:
	var ins: Dictionary = bench_q.get("instruments", {})
	var sup = ins.get("supply", null)
	if sup is Dictionary: return {"kind": "bench", "label": "%s V supply" % String.num(float(sup.v), 2).trim_suffix(".0").trim_suffix(".00"), "volts": float(sup.v), "tired": false}
	for p in _all_parts:
		if str(p.partId).begins_with("bat-pp3"):
			var tired: bool = str(p.partId).ends_with("tired") or str(p.get("variant", "")) == "tired"
			return {"kind": "pp3", "label": "tired 9 V pack" if tired else "9 V PP3", "volts": 9.0, "tired": tired}
	var srcs: Array = []   # an exam ticket: ideal textbook sources fixed on the board (not a battery, not the bench supply)
	for p in _all_parts:
		if str(p.partId).begins_with("ideal-vsource"): srcs.append({"name": "E%d" % (srcs.size() + 1), "volts": float(p.get("value", 0.0))})
	if not srcs.is_empty(): return {"kind": "sources", "label": "textbook sources", "volts": 0.0, "tired": false, "sources": srcs}
	return {"kind": "none", "label": "(textbook sources)", "volts": 0.0, "tired": false}

func _short_spec(tg: Dictionary) -> String:
	if tg.is_empty(): return ""
	var u := str(tg.get("unit", "")); var lo := _n(tg.get("lo", 0.0)); var hi := _n(tg.get("hi", 0.0))
	if hi >= lo * 50.0 and hi > 100.0: return ">= %s %s" % [_g(lo), u]
	return "%s - %s %s" % [_g(lo), _g(hi), u]

## x with `n` significant digits and no trailing zeros ("%g" is not a GDScript format): 14.9551 -> "14.96", 0.5556 -> "0.5556", 4.2 -> "4.2"
static func _g(x: float, n := 4) -> String:
	if x == 0.0 or is_nan(x) or is_inf(x): return "0" if x == 0.0 else str(x)
	var e := int(floor(log(absf(x)) / log(10.0)))
	var r := snappedf(x, pow(10.0, float(e - n + 1)))
	var s := String.num(r, maxi(0, n - 1 - e))
	if s.contains("."): s = s.rstrip("0").rstrip(".")
	return s

## The engine's band is in display units; pick the scope's vertical scale so the band sits in view (the engine gives volts/div for voltage probes).
func _scope_setup(tg: Dictionary) -> void:
	var mode := str(tg.get("mode", "gauge")); var unit := str(tg.get("unit", ""))
	var lo := _n(tg.get("lo", 0.0)); var hi := _n(tg.get("hi", 1.0))
	var ref := hi if hi < lo * 20.0 else lo * 1.5
	var vdiv := _nice(ref * 1.3 / 6.0)
	if mode == "probe" and _n(scope_q.get("voltsPerDiv", 0.0)) > 0.0: vdiv = float(scope_q.voltsPerDiv) * _n(tg.get("scale", 1.0))
	var label: String = {"A": "CURRENT", "W": "POWER", "V": "VOLTS"}.get(str(tg.get("quantity", "")), "LEVEL")
	var clip = tg.get("clip", null)
	scope_view = {"unit": unit, "lo": lo, "hi": minf(hi, vdiv * 7.0), "vdiv": vdiv, "label": label, "mode": mode, "scale": _n(tg.get("scale", 1.0)),
		"clip_pad": (clip.pad if clip is Dictionary else null), "clip_name": (str(clip.connector) if clip is Dictionary else ""), "clipped": false, "attached": mode == "gauge",
		"value": 0.0, "text": "", "name": str(tg.get("name", ""))}

static func _nice(x: float) -> float:
	if x <= 0.0: return 1.0
	var e := pow(10.0, floor(log(x) / log(10.0))); var m := x / e
	var n := 1.0 if m <= 1.0 else (2.0 if m <= 2.0 else (2.5 if m <= 2.5 else (5.0 if m <= 5.0 else 10.0)))
	return n * e

## ------------------------------------------------------------------------------------------------------------------ the shoebox

func bin() -> Array:
	var out: Array = []
	var i := 0
	for fam in card.get("shoebox", []):
		var vals: Array = fam.values if fam.get("values", null) is Array else [null]
		for v in vals:
			for va in fam.variants:
				var kind := str(fam.kind)
				var label := str(fam.name)
				if v != null: label = NodeApi.format_value(float(v), "R" if kind == "R" else kind)
				elif kind == "LED": label = "red LED"
				var tag := _watt_tag(float(va.ratings.P)) if (kind == "R" and va.ratings.has("P") and str(va.id) != "ideal") else ""
				var mx = fam.get("max", null)
				out.append({"i": i, "partId": str(fam.partId), "value": v, "variant": str(va.id), "tag": tag, "label": label, "kind": kind, "footprint": str(fam.footprint),
					"price": int(va.get("price", 0)), "price_text": str(va.get("priceText", "")) if int(va.get("price", 0)) > 0 else "",
					"left": (int(mx) - int(fam.get("placed", 0))) if mx != null else -1})
				i += 1
	return out

## JSON null -> default (float(null) is an error in GDScript)
static func _n(v, d := 0.0) -> float: return d if v == null else float(v)

static func _watt_tag(p: float) -> String:
	if absf(p - 1.0 / 6.0) < 0.005: return "⅙ W"
	if absf(p - 0.25) < 0.001: return "¼ W"
	if absf(p - 0.5) < 0.001: return "½ W"
	return "%s W" % _g(p)

## ------------------------------------------------------------------------------------------------------------------ board edits

## Pin pads of a shoebox item dropped at (x, y) (pin 1) with `rot`; the footprint table mirrors src/sim/board/footprints.ts.
func pins_of(item: Dictionary, x: int, y: int, rot: int) -> Array:
	var fp: Array = NodeApi.FOOTPRINTS.get(str(item.get("footprint", "")), [[0, 0], [2, 0]])
	var out: Array = []
	for o in fp: out.append(Vector2(x, y) + NodeApi._rot_off(Vector2(o[0], o[1]), rot, false))
	return out

func can_place(item: Dictionary, x: int, y: int, rot: int, skip_uid := "") -> String:
	if skip_uid != "":   # a move: the part's own pads are not "taken"
		for q in pins_of(item, x, y, rot):
			if q.x < 0 or q.y < 0 or q.x > int(ticket.get("board", {}).get("w", 24)) - 1 or q.y > int(ticket.get("board", {}).get("h", 16)) - 1: return "That would hang off the board."
		return ""
	var g = _q("ghost", [item.partId, x, y, rot, false])
	if g is Dictionary and not bool(g.get("ok", true)): return str(g.get("problem", "That does not fit there."))
	return ""

func place(item: Dictionary, x: int, y: int, rot := 0) -> Dictionary:
	var r := _act("placePart", [item.partId, item.value, item.variant, x, y, rot, false])
	if not r.get("ok", false): return {"ok": false, "msg": str(r.get("message", ""))}
	_after_edit(); event.emit("placed", {"uid": str(r.get("uid", "")), "kind": str(item.kind)})
	return {"ok": true, "msg": str(r.get("message", "")), "uid": str(r.get("uid", ""))}

func part_by(uid: String) -> Dictionary:
	for p in parts: if p.uid == uid: return p
	return {}

func move_part(uid: String, x: int, y: int, rot: int) -> Dictionary:
	var p := part_by(uid)
	if p.is_empty() or p.fixed: return {"ok": false, "msg": "That part is soldered in."}
	for i in 3:
		if int(part_by(uid).rot) == rot: break
		var rr := _act("rotatePart", [uid])
		if not rr.get("ok", false): return {"ok": false, "msg": str(rr.get("message", ""))}
		_refresh_board()
	var r := _act("movePart", [uid, x, y])
	_after_edit()
	return {"ok": r.get("ok", false), "msg": str(r.get("message", "")) if not r.get("ok", false) else ""}

func delete_part(uid: String) -> void:
	var p := part_by(uid)
	if p.is_empty() or p.fixed: return
	var r := _act("deletePart", [uid]); _after_edit()
	last_note = str(r.get("message", "")) if r.get("ok", false) else ""
	event.emit("deleted", {"uid": uid, "note": last_note, "wires": r.get("removedWires", [])})

func add_wire(a: Array, b: Array) -> Dictionary:
	if a == b: return {"ok": false, "msg": ""}
	var r := _act("wire", [a, b])
	if not r.get("ok", false): return {"ok": false, "msg": str(r.get("message", ""))}
	_after_edit()
	var landed: Array = r.get("landed", [])
	var dang: Array = r.get("dangling", [])
	last_note = str(r.get("message", ""))
	event.emit("wired", {"wid": str(r.get("wid", "")), "landed": landed, "dangling": dang, "note": last_note})
	return {"ok": true, "msg": "", "wid": str(r.get("wid", "")), "landed": landed, "dangling": dang, "note": last_note}

func delete_wire(wid: String) -> void:
	_act("unwire", [wid]); _after_edit()

## Take back the last edit (Ctrl+Z). The engine keeps the history (bench().undoDepth); returns its sentence.
func undo() -> Dictionary:
	if not smoked.is_empty():   # a burnt part blocks the bench: the first undo after a burn swaps in a fresh one (the history stays)
		var n := 0
		for uid in smoked.keys(): if _act("replaceSmoked", [str(uid)]).get("ok", false): n += 1
		if n > 0:
			smoked.clear(); _smoke_seen.clear(); _after_edit()
			last_note = "Fresh part in place of the burnt one. Ctrl+Z again takes edits back."
			return {"ok": true, "msg": last_note}
	var r := _act("undo")
	if r.get("ok", false):
		smoked.clear(); _smoke_seen.clear(); _after_edit()
		if powered: _refresh_live()
	last_note = str(r.get("message", ""))
	return {"ok": bool(r.get("ok", false)), "msg": last_note}

func set_power(on: bool) -> void:
	if powered == on: return
	var r := _act("power", [on])
	if not r.get("ok", false): return
	powered = on; hold = 0.0; locked = false; _was_lock = false; _accum = 0.0
	if not on: frame = {}
	smoked.clear(); passed = false
	_refresh_board(); _refresh_live(); _rebuild_model(); event.emit("power", {"on": on})

func set_running(on: bool) -> void: _act("setRunning", [on])

## which: "red" | "black" (DMM leads) | "ch1" (the scope clip). Returns the engine's answer so the scene can show a teaching refusal.
func set_probe(which: String, pad) -> Dictionary:
	var r: Dictionary
	if which == "ch1":
		r = _act("attachProbe", [1, pad]) if pad != null else _act("detachProbe", [1])
	else:
		r = _act("dmmLead", [which, pad])
	if r.get("ok", false): probes[which] = pad; _bench_key = ""   # something has been measured: a refused bench may try again by itself
	else: probes[which] = null
	dmm_used = dmm_used or (pad != null and which != "ch1")
	_refresh_board(); _refresh_live(); _rebuild_model()
	if which != "ch1" and probes.red != null and probes.black != null and dial == "V" and powered: dmm_loaded = true
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", "")) if not r.get("ok", false) else ""}

func set_dial(mode: String) -> void:
	var r := _act("dmmDial", [DIAL_ENGINE.get(mode, "off")])
	if r.get("ok", false): dial = mode
	_refresh_live()

func predict(id: String, value: float) -> Dictionary:
	var r := _act("predict", [id, value])
	card = _q("ticketCard"); ticket["predictions"] = card.get("predictions", [])
	_exam_hide()
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", ""))}

## Exam bridge: predict first. The target band (chit and scope) stays hidden until every prediction is locked in, or it gives the answer away.
func _exam_hide() -> void:
	var hide := bool(ticket.get("eb", false)) and not predictions_done()
	scope_view["hidden"] = hide
	ticket["spec"] = "predict first, then build" if hide else str(ticket.get("spec_full", ""))

func predictions_done() -> bool:
	for p in ticket.get("predictions", []): if p.get("entered", null) == null: return false
	return true

## The formal bench check. A pass pays the ticket (event "paid"); a fail raises "bench_failed" with the engine's explanation of the player's own numbers.
func run_bench() -> Dictionary:
	var r := _act("runBench", [true])
	var res = _q("benchResult")
	last_result = res if res is Dictionary else {}
	_bench_key = _board_key()
	refresh_wallet()
	if r.get("ok", false) and bool(r.get("pass", false)):
		passed = true; ticket["stars"] = int(r.get("stars", 0))
		event.emit("paid", {"pay": int(r.get("pay", 0)), "pay_text": str(last_result.get("payText", "")), "stars": int(r.get("stars", 0)), "result": last_result})
	else:
		var why := str(r.get("message", ""))
		var fl: Array = last_result.get("failures", [])
		if not fl.is_empty(): why = str((fl[0] as Dictionary).get("text", why))
		for p in last_result.get("predictions", []): if str(p.get("grade", "")) == "miss": why = "%s  (%s)" % [why, str(p.get("gradeText", ""))]
		event.emit("bench_failed", {"text": why, "result": last_result})
	return r

func _board_key() -> String: return "%s|%d" % [str(bench_q.get("ticket", "")), int(bench_q.get("undoDepth", 0))]

func _after_edit() -> void:
	passed = false; hold = 0.0; locked = false; _was_lock = false
	_refresh_board(); _refresh_live(); _rebuild_model()

## ------------------------------------------------------------------------------------------------------------------ reading the engine

func _refresh_board() -> void:
	var b = _q("bench")
	bench_q = b if b is Dictionary else {}
	var sb = _q("shoebox")
	if sb is Array: card["shoebox"] = sb
	_all_parts = []; parts = []; _hidden.clear()
	for p in bench_q.get("parts", []):
		var d := _scene_part(p)
		_all_parts.append(d)
		if bool(p.get("fixed", false)) and str(p.partId).begins_with("bat-pp3"): _hidden[d.uid] = true; continue
		parts.append(d)
	dangling = []
	for d in bench_q.get("dangling", []): dangling.append({"wid": str(d.wid), "pad": [int(d.pad[0]), int(d.pad[1])]})
	open_pins = bench_q.get("openPins", [])
	undo_depth = int(bench_q.get("undoDepth", 0))
	wires = []
	for w in bench_q.get("wires", []):
		var path: Array = []
		for q in w.path: path.append([int(q[0]), int(q[1])])
		wires.append({"wid": str(w.wid), "a": path[0], "b": path[path.size() - 1], "path": path})
	var ins: Dictionary = bench_q.get("instruments", {})
	var sc: Dictionary = ins.get("scope", {}) if ins.get("scope", null) is Dictionary else {}
	probes.ch1 = null
	for pr in sc.get("probes", []): if int(pr.ch) == 1: probes.ch1 = [int(pr.pad[0]), int(pr.pad[1])]
	var dm: Dictionary = ins.get("dmm", {}) if ins.get("dmm", null) is Dictionary else {}
	probes.red = [int(dm.red[0]), int(dm.red[1])] if dm.get("red", null) is Array else null
	probes.black = [int(dm.black[0]), int(dm.black[1])] if dm.get("black", null) is Array else null
	dial = str(DIAL_LABEL.get(str(dm.get("mode", "off")), "OFF"))
	powered = bool(ins.get("powered", powered))

func _scene_part(p: Dictionary) -> Dictionary:
	var pid := str(p.partId); var kind := str(p.kind)
	if kind == "HEATER": kind = "LOAD"
	elif kind == "MISC" or pid.begins_with("ideal-vsource"): kind = "BAT"
	var pins: Array = []
	var pin_labels: Array = []
	for q in p.pins:
		pins.append([int(q.pad[0]), int(q.pad[1])])
		pin_labels.append(str(q.get("label", q.get("name", ""))))
	var label := str(p.get("valueText", ""))
	var variant := str(p.get("variant", ""))
	var tag := ""
	if kind == "R" and p.get("ratings", {}).has("P") and variant != "ideal": tag = _watt_tag(float(p.ratings.P))
	if kind == "LOAD": label = str(p.get("name", "Heater"))
	elif kind == "BAT": label = ("%s V" % _g(float(p.value))) if p.get("value", null) != null else NodeApi.BAT_LABEL.get(pid, "9 V")
	elif kind == "R" and tag != "" and _multi_rating(pid): label = "%s %s" % [label, tag]
	elif kind == "LED": label = "LED"
	return {"uid": str(p.uid), "partId": pid, "value": p.get("value", null), "label": label, "tag": tag, "kind": kind, "x": int(p.x), "y": int(p.y), "rot": int(p.rot),
		"flip": bool(p.get("flip", false)), "fixed": bool(p.get("fixed", false)), "variant": variant, "pins": pins, "pin_labels": pin_labels, "smoked": bool(p.get("smoked", false)), "name": str(p.get("name", ""))}

func _multi_rating(pid: String) -> bool:
	for fam in card.get("shoebox", []): if str(fam.partId) == pid and (fam.variants as Array).size() > 1: return true
	return false

func _refresh_live() -> void:
	if powered:
		var f = _q("liveFrame")
		frame = f if f is Dictionary else {}
	else: frame = {}
	var sc = _q("scope", [1])
	scope_q = sc if sc is Dictionary else {}
	_scope_update()
	var d = _q("dmm")
	dmm_q = d if d is Dictionary else {}
	temps.clear(); smoked.clear()
	for p in frame.get("parts", []):
		temps[str(p.uid)] = _n(p.get("temp", 25.0))
		if bool(p.get("smoked", false)): smoked[str(p.uid)] = true
	for e in frame.get("events", []): smoked[str(e.part)] = true
	for u in smoked.keys():   # the first time a part shows as smoked, fire the pop (whether the live run or a bench check killed it)
		if not _smoke_seen.has(u): _smoke_seen[u] = true; _emit_smoke(str(u))
	for u in _smoke_seen.keys(): if not smoked.has(u): _smoke_seen.erase(u)
	var lk := bool(scope_q.get("lock", false)) and powered
	if lk and not _was_lock: event.emit("lock", {})
	_was_lock = lk; locked = lk

func _scope_update() -> void:
	var tg = scope_q.get("target", null)
	var gauge = scope_q.get("gauge", null)
	var sv := scope_view
	if tg is Dictionary:
		var cl = tg.get("clip", null)
		sv["clipped"] = bool(tg.get("clipped", false))
		sv["clip_pad"] = cl.pad if cl is Dictionary else null
	var val := 0.0; var attached := true; var txt := ""
	if str(sv.get("mode", "")) == "gauge":
		if gauge is Dictionary and gauge.get("value", null) != null and powered: val = float(gauge.value); txt = str(gauge.get("text", ""))
	else:
		attached = bool(sv.get("clipped", false)) and bool(scope_q.get("attached", false))
		var v: Array = scope_q.get("v", [])
		if attached and powered and not v.is_empty(): val = float(v[v.size() - 1]) * _n(sv.get("scale", 1.0))
	sv["value"] = val; sv["attached"] = attached; sv["text"] = txt
	scope_view = sv
	if not ticket.is_empty(): ticket["scope"] = sv

func scope_value() -> float: return _n(scope_view.get("value", 0.0))

## DmmView reading: {text, unit, mode} straight from the engine LCD.
func dmm() -> Dictionary:
	if dial == "OFF": return {"text": "", "unit": "", "mode": "OFF"}
	var unit := str(dial)
	if not bool(dmm_q.get("valid", false)): return {"text": "----", "unit": unit, "mode": dial, "note": str(dmm_q.get("note", ""))}
	var disp: Dictionary = dmm_q.get("display", {})
	var s := str(disp.get("text", "")); var sp := s.rfind(" ")
	return {"text": s.substr(0, sp) if sp > 0 else s, "value": disp.get("value", null), "unit": str(disp.get("unit", unit)), "mode": dial, "negative": bool(dmm_q.get("negative", false))}

## ------------------------------------------------------------------------------------------------------------------ play loop

func step(dt: float) -> void:
	t += dt
	if not powered or ticket.is_empty(): return
	_accum += dt
	var n := int(_accum / FRAME_DT)
	if n < 1: return
	_accum = fposmod(_accum, FRAME_DT)
	_act("advance", [mini(n, 8)])
	_refresh_live(); _rebuild_model()
	if locked and not passed:
		hold += dt
		# the formal check runs by itself once LOCK has held and every part is still cool: a part that is warming is left to play out (glow, then smoke) in real time
		if hold >= LOCK_HOLD and not bool(ticket.get("eb", false)) and _bench_key != _board_key() and not _any_heating(): run_bench()
	elif not locked: hold = 0.0

func _any_heating() -> bool:
	for p in frame.get("parts", []): if str(p.get("state", "normal")) != "normal": return true
	return false

func _emit_smoke(uid: String) -> void:
	var ev := {}
	for e in frame.get("events", []): if str(e.part) == uid: ev = e
	var pp := _frame_part(uid)
	var amps := 0.0
	if pp.has("pins") and (pp.pins as Array).size() > 0: amps = absf(_n(pp.pins[0].get("i", 0.0)))
	event.emit("smoked", {"uid": uid, "kind": str(part_by(uid).get("kind", "R")), "amps": amps, "watts": _n(pp.get("power", 0.0)), "text": str(ev.get("text", "")), "fx": str(ev.get("kind", "smoke"))})

func _frame_part(uid: String) -> Dictionary:
	for p in frame.get("parts", []): if str(p.uid) == uid: return p
	return {}

func hot_k() -> float:
	var k := 0.0
	for p in frame.get("parts", []): k = maxf(k, _heat(p))
	return 1.0 if not smoked.is_empty() else k

## Heat glow from the engine's own thermal state: normal parts do not glow; warm and hot ride the temperature up the ramp.
func _heat(p: Dictionary) -> float:
	var st := str(p.get("state", "normal"))
	var k := clampf((_n(p.get("temp", 25.0)) - 45.0) / 110.0, 0.0, 1.0)
	match st:
		"normal": return 0.0
		"warm": return clampf(maxf(k, 0.35), 0.0, 0.7)
		"hot": return maxf(k, 0.8)
		"smoke": return 1.0
	return 0.0

func led_current(uid: String) -> float:
	var p := _frame_part(uid)
	return absf(float(p.led.i)) if p.has("led") else 0.0

func part_power(uid: String) -> float: return float(_frame_part(uid).get("power", 0.0))
func part_current(uid: String) -> float:
	var p := _frame_part(uid)
	return absf(float(p.pins[0].i)) if p.has("pins") and (p.pins as Array).size() > 0 else 0.0
## node voltage at a pad (hover tooltip)
func volt_at(pad: Array) -> float:
	for n in frame.get("nodes", []):
		for q in n.pads: if int(q[0]) == int(pad[0]) and int(q[1]) == int(pad[1]): return float(n.v)
	return 0.0

## ------------------------------------------------------------------------------------------------------------------ coach

## Wren's steps from the engine, mapped to the stall's arrow targets: {steps:[{text, target, done, shown, anchor}], cur}.
func coach_view() -> Dictionary:
	var c = _q("coach")
	var steps: Array = []; var cur := -1
	var step_no := -1; var step_total := -1
	if c is Dictionary: step_no = int(c.get("stepNo", -1)); step_total = int(c.get("stepTotal", -1))   # the engine numbers the steps: the total never changes mid-ticket
	if c is Dictionary:
		var i := 0
		for s in c.get("steps", []):
			steps.append({"id": str(s.id), "text": str(s.text), "target": _target_of(s.get("anchor", null)), "done": bool(s.get("done", false)), "shown": bool(s.get("shown", true))})
			if bool(s.get("active", false)): cur = i
			i += 1
	return {"steps": steps, "cur": cur, "step_no": step_no, "step_total": step_total}

func _target_of(a) -> String:
	if not (a is Dictionary): return "none"
	match str(a.get("target", "")):
		"bin": return "box:%s" % str(a.get("partId", ""))
		"part":
			var pad = a.get("pad", null)
			return "pad:%d,%d" % [int(pad[0]), int(pad[1])] if pad is Array else "board"
		"connector":
			var pad2 = a.get("pad", null)
			return "pad:%d,%d" % [int(pad2[0]), int(pad2[1])] if pad2 is Array else "board"
		"power": return "rocker"
		"scope": return "clip"
		"dmm": return "dmm"
		"bench": return "bench"
		"chit": return "chit"
		"notebook": return "notebook"
	return "board"

## ------------------------------------------------------------------------------------------------------------------ the view model (NodeApi shape + the engine's own speeds, heat, LED mood, tint)

func _rebuild_model() -> void:
	if ticket.is_empty(): model = {}; return
	var bd := {"w": ticket.board.w, "h": ticket.board.h, "connectors": ticket.board.connectors, "probes": [], "parts": [], "wires": []}
	for p in parts: bd.parts.append(p)
	for w in wires: bd.wires.append({"wid": w.wid, "path": w.path})
	if probes.ch1 != null: bd.probes.append({"ch": 1, "pad": probes.ch1})
	var sets: Array = []
	for n in frame.get("nodes", []): sets.append({"v": float(n.v), "pads": n.pads})
	var cur_w := {}; var cur_p := {}; var spd_w := {}; var spd_p := {}; var rat := {}; var temps_m := {}; var smoked_l: Array = []
	var heat := {}; var led := {}
	for w in frame.get("wires", []): cur_w[str(w.wid)] = float(w.i); spd_w[str(w.wid)] = float(w.speed)
	for p in frame.get("parts", []):
		var uid := str(p.uid)
		if _hidden.has(uid): continue
		var pins: Array = p.get("pins", [])
		if not pins.is_empty(): cur_p[uid] = float(pins[0].i); spd_p[uid] = float(pins[0].speed)
		temps_m[uid] = _n(p.get("temp", 25.0)); heat[uid] = _heat(p)
		if _n(p.get("rated", 0.0)) > 0.0 or _n(p.get("ratio", 0.0)) > 0.0: rat[uid] = {"p": _n(p.get("ratio", 0.0))}
		if bool(p.get("smoked", false)): smoked_l.append(uid)
		if p.has("led"): led[uid] = {"mood": str(p.led.get("mood", "sleepy")), "bloom": float(p.led.get("bloom", 0.0)), "mA": float(p.led.get("mA", 0.0))}
	for e in frame.get("events", []): smoked_l.append(str(e.part))
	var vmin := _n(frame.get("vmin", 0.0)); var vmax := _n(frame.get("vmax", 1.0))
	var raw := {"board": bd, "nodes": {"sets": sets, "range": [minf(vmin, 0.0), maxf(vmax, 0.5)]}, "currents": {"wires": cur_w, "parts": cur_p},
		"thermal": {"ambient": _n(frame.get("ambient", 25.0)), "temps": temps_m, "smoked": smoked_l}, "ratings": rat,
		"liveStatus": {"powered": powered and bool(frame.get("valid", false)), "status": str(frame.get("status", "ok")), "t": _n(frame.get("t", 0.0))}}
	var m := NodeApi.normalise(raw)
	var norm := {}
	for n in frame.get("nodes", []):
		for q in n.pads: norm["%d,%d" % [int(q[0]), int(q[1])]] = float(n.norm)
	m["dangling"] = dangling; m["norm"] = norm; m["wire_speed"] = spd_w; m["part_speed"] = spd_p; m["heat"] = heat; m["led"] = led
	model = m

## ------------------------------------------------------------------------------------------------------------------ test helpers

## Reference designs (the level files' `ref`), in engine coordinates. Used by tests and the screenshot run to play earlier tickets.
const REFS := {
	"1-1": {"parts": [["res-cf", 470, "0.25W", 2, 5, 0], ["led-red-5mm", null, "5mm", 8, 5, 0]], "wires": [[[2, 2], [2, 5]], [[6, 5], [8, 5]], [[10, 5], [10, 2], [8, 2]]]},
	"1-2": {"parts": [["res-cf", 150, "0.25W", 2, 5, 0], ["led-red-5mm", null, "5mm", 8, 5, 0], ["led-red-5mm", null, "5mm", 14, 5, 0], ["led-red-5mm", null, "5mm", 18, 5, 0]],
		"wires": [[[2, 2], [2, 5]], [[6, 5], [8, 5]], [[10, 5], [14, 5]], [[16, 5], [18, 5]], [[20, 5], [20, 2], [8, 2]]]},
	"1-3": {"parts": [["res-cf", 22, "1W", 4, 2, 0]], "wires": [[[2, 2], [4, 2]], [[8, 2], [14, 2]]], "clip": [14, 2]},
	"1-4": {"parts": [["res-ww5", 4.7, "5W", 2, 5, 0]], "wires": [[[2, 2], [2, 5]], [[6, 5], [6, 2], [8, 2]]]},
	"1-5": {"parts": [["res-exact", 2, "ideal", 4, 2, 0], ["res-exact", 3, "ideal", 10, 4, 0], ["res-exact", 6, "ideal", 8, 7, 1]],
		"wires": [[[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]], [[8, 6], [8, 7]], [[8, 11], [8, 12]], [[2, 8], [2, 12], [8, 12]], [[14, 8], [14, 12], [8, 12]]],
		"clip": [8, 6], "pred": {"pva": 6.6667, "pie2": 0.5556}},
}

## Build the reference design for the open ticket straight through the engine (no UI). Returns true when every step was accepted.
func build_ref(id: String) -> bool:
	var R: Dictionary = REFS.get(id, {})
	if R.is_empty(): return false
	var ok := true
	if R.has("pred"): for k in R.pred: ok = predict(str(k), float(R.pred[k])).ok and ok
	for p in R.parts: ok = bool(place({"partId": p[0], "value": p[1], "variant": p[2], "kind": "R"}, p[3], p[4], p[5]).ok) and ok
	for w in R.wires: ok = _act("addWire", [w]).get("ok", false) and ok
	if R.has("clip"): ok = bool(set_probe("ch1", R.clip).ok) and ok
	_after_edit()
	return ok

## Pass every ticket before `id` with its reference design (unlocks `id` for the screenshot run and the tests), leaving `id` closed.
func unlock_through(id: String) -> void:
	for tk in ["1-1", "1-2", "1-3", "1-4", "1-5"]:
		if tk == id: break
		if not open_ticket(tk): continue
		build_ref(tk); set_power(true)
		for i in 3: step(FRAME_DT * 1.01)
		_act("runBench")
	close_ticket(); refresh_wallet()
