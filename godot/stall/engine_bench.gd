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
	"2-1": {"gadget": "station", "ask": "My weather station reads nonsense.", "thanks": "My station reads true."},
	"2-2": {"gadget": "cable", "ask": "Where do we dig?", "thanks": "Found it, right at your mark!"},
	"2-3": {"gadget": "module", "ask": "Nobody makes this box any more.", "thanks": "Drop-in. It behaves just like the old one."},
	"2-4": {"gadget": "exam", "ask": "Predict first, then probe.", "thanks": "The numbers agree!"},
	"3-1": {"gadget": "flash", "ask": "The flash says ready far too soon.", "thanks": "Ready on the dot! One second."},
	"3-2": {"gadget": "arcade", "ask": "My button counts one press as ten.", "thanks": "One press, one press. The game is fair again."},
	"3-3": {"gadget": "relay", "ask": "My relay does not click.", "thanks": "Click, right on time. The valves are in step."},
	"3-4": {"gadget": "exam", "ask": "Predict first, then probe.", "thanks": "The numbers agree!"},
	"4-1": {"gadget": "wallwart", "ask": "My adapter hums and the radio crackles.", "thanks": "Quiet at last. Thank you!"},
	"4-2": {"gadget": "radio", "ask": "My radio needs a steady 5 volts.", "thanks": "Clear as a bell, rain or shine."},
	"4-3": {"gadget": "printer", "ask": "The regulator is cooking my printer board.", "thanks": "Cool and steady. Print away."},
	"4-4": {"gadget": "bench", "ask": "A 3.3 V supply for your own bench.", "thanks": "3.3 volts, steady at every load."},
	"4-5": {"gadget": "exam", "ask": "Predict first, then probe.", "thanks": "The numbers agree!"},
	"5-1": {"gadget": "fan", "ask": "My pin cannot run this fan.", "thanks": "The fan spins and the pin stays cool."},
	"5-2": {"gadget": "strip", "ask": "My strip stays dark on 3.3 volts.", "thanks": "The strip glows, whichever FET batch."},
	"5-3": {"gadget": "gate", "ask": "We need a NAND and have no chips.", "thanks": "A NAND from loose parts. Now we can build anything."},
	"5-4": {"gadget": "synth", "ask": "My synth is too quiet.", "thanks": "Ten times louder and clean."},
	"5-5": {"gadget": "exam", "ask": "Predict first, then probe.", "thanks": "The numbers agree!"},
}
const CHAPTER_TICKETS := {1: ["1-1", "1-2", "1-3", "1-4", "1-5"], 2: ["2-1", "2-2", "2-3", "2-4"], 3: ["3-1", "3-2", "3-3", "3-4"], 4: ["4-1", "4-2", "4-3", "4-4", "4-5"], 5: ["5-1", "5-2", "5-3", "5-4", "5-5"]}
const ALL_TICKETS := ["1-1", "1-2", "1-3", "1-4", "1-5", "2-1", "2-2", "2-3", "2-4", "3-1", "3-2", "3-3", "3-4", "4-1", "4-2", "4-3", "4-4", "4-5", "5-1", "5-2", "5-3", "5-4", "5-5"]
## The parts of chapter 2 that read better with a word under the value in the shoebox (presentation only).
const PART_TAG := {"res-box": "box plug", "trimmer": "trimmer", "rheostat": "rheostat", "cap-cer": "ceramic", "cap-ideal": "exact", "1n4148": "diode", "zener-6v-ideal": "ideal Zener"}
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
var arrived_burnt := {}   ## uid -> true: burnt when the ticket opened (a repair's customer damage)
var selectors: Array = []                 ## the ticket's live switches [{id, label, options:[text], index}] (chapter 4: mains tolerance, load)
var mains: Dictionary = {}                ## ticketCard().mains: the safety card, the ribbon, the keep-out and isolation words (empty off a mains ticket)
var camera := false                       ## the thermal camera overlay (chapter 4)
var camera_ok := false                    ## the ticket offers it
var _coach_max := 0                       ## the furthest coach step reached on this attempt (a step number that falls back is said out loud)

func _init(b = null) -> void:
	bridge = b if b != null else CbBridge.new()
	started = bridge.start() if b == null else true
	if started: refresh_wallet()

func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:   # (the live worker holds a reference to this object: the owner stops it first, stop_live_worker)
		if bridge != null and bridge.has_method("stop"): bridge.stop()

func _act(name: String, args: Array = []) -> Dictionary:
	_epoch += 1   # an edit or a switch makes any frame the live worker is computing stale
	return bridge.act(name, args)

## ------------------------------------------------------------------------------------------------------------------ live worker
## 0.6: the live simulation ran on the main thread, so 5-1's switching fan driver held each frame for 23-28 ms (the 4090 drew it in
## about 4). With `async_live` (the 3D bench sets it) a worker thread asks the engine for the next frames while the main thread
## renders; the result is applied one rendered frame later. Calls into the sidecar are serialised by the bridge's own mutex; a frame
## computed before a later edit is dropped (the epoch). The classic stall keeps the synchronous path.
var async_live := false
var _epoch := 0
var _thr: Thread
var _sem: Semaphore
var _lmx := Mutex.new()
var _job := {}        ## {n, epoch} posted to the worker
var _done := {}       ## {epoch, frame, scope, dmm, game} from the worker
var _busy := false
var _quit := false

func _live_worker() -> void:
	while true:
		_sem.wait()
		_lmx.lock(); var job := _job.duplicate(); var q := _quit; _lmx.unlock()
		if q: return
		var r: Dictionary = bridge._req({"fn": "act", "name": "advance", "args": [int(job.n)]})
		var f: Dictionary = bridge._req({"fn": "q", "name": "liveFrame", "args": []})
		var sc: Dictionary = bridge._req({"fn": "q", "name": "scope", "args": [1]})
		var d: Dictionary = bridge._req({"fn": "q", "name": "dmm", "args": []})
		_lmx.lock()
		_done = {"epoch": int(job.epoch), "game": r.get("game", null), "frame": f.get("result", {}), "scope": sc.get("result", {}), "dmm": d.get("result", {})}
		_busy = false
		_lmx.unlock()

func stop_live_worker() -> void:
	if _thr == null: return
	_lmx.lock(); _quit = true; _lmx.unlock(); _sem.post(); _thr.wait_to_finish(); _thr = null

func _step_async(n: int) -> void:
	if _thr == null:
		_sem = Semaphore.new(); _thr = Thread.new(); _thr.start(_live_worker)
	_lmx.lock(); var got := _done; _done = {}; var busy := _busy; _lmx.unlock()
	if not got.is_empty() and int(got.epoch) == _epoch:
		if got.game != null: bridge.g = got.game
		bridge._cache.clear()
		frame = got.frame if got.frame is Dictionary else {}
		var sc = got.scope; scope_q = sc if sc is Dictionary else {}
		var d = got.dmm; dmm_q = d if d is Dictionary else {}
		_apply_live()
		_rebuild_model()
	if not busy:
		_lmx.lock(); _job = {"n": n, "epoch": _epoch}; _busy = true; _lmx.unlock()
		_sem.post()
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
	jockey_step_i = 1   # a new ticket starts at the 1 mm jockey step
	probes = {"red": null, "black": null, "ch1": null}; dial = "OFF"; dmm_used = false; dmm_loaded = false
	frame = {}; last_result = {}; _bench_key = ""; _smoke_seen.clear(); _coach_max = 0
	# a repair's parts that arrived burnt (0.4.0, Noor): the first frame that "sees" them smoked must not read as a fresh burn
	# ("LED burnt: too much current") of a circuit the player wired right. Filled before _load_ticket, whose first frame already
	# shows them. A part swapped for a fresh one leaves the set.
	arrived_burnt.clear()
	var bq = _q("board")   # the board query carries each part's smoked flag
	if bq is Dictionary: for p in bq.get("parts", []): if bool(p.get("smoked", false)): arrived_burnt[str(p.uid)] = true
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
func progress(chapter := 1) -> Dictionary:
	var m = _q("chapterMap", [chapter])
	var rows: Array = []
	if m is Dictionary:
		for tk in m.get("tickets", []):
			var st := str(tk.get("state", "locked"))
			rows.append({"id": str(tk.id), "title": str(tk.title), "customer": str(tk.customer), "spec": str(tk.get("spec", "")), "price": int(tk.get("fee", 0)),
				"price_text": str(tk.get("feeText", "")), "open": st != "locked", "done": st == "passed" or st == "done", "stars": int(tk.get("stars", 0)), "state": st,
				"pay_text": str(tk.get("payText", "")), "stars_max": int(tk.get("starsMax", 2)), "eb": bool(tk.get("eb", false)),
				"best_text": ("best cost %s" % str((tk.best as Dictionary).get("costText", ""))) if tk.get("best", null) is Dictionary else ""})
	return {"tickets": rows, "wallet": wallet_minor, "wallet_text": wallet_text, "stars": int((m as Dictionary).get("starsEarned", 0)) if m is Dictionary else 0, "chapter": chapter,
		"title": str((m as Dictionary).get("title", "")) if m is Dictionary else "", "blurb": str((m as Dictionary).get("blurb", "")) if m is Dictionary else "", "stars_total": int((m as Dictionary).get("starsTotal", 0)) if m is Dictionary else 0}

func _load_ticket() -> void:
	card = _q("ticketCard")
	mains = card.get("mains", {}) if card.get("mains", null) is Dictionary else {}   # (before the supply is described: a mains ticket's supply is the isolation transformer)
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
	ticket = {"id": id, "figure": card.get("figure", null), "pay_text": str(card.get("payText", "")), "star_rule": str(card.get("starRule", "")), "title": str(card.get("title", "")), "customer": str(card.get("customer", "")), "brief": str(card.get("brief", "")),
		"gadget": str(fl.get("gadget", "exam")), "ask": str(fl.get("ask", "")), "thanks": str(fl.get("thanks", "")),
		"price": int(card.get("fee", 0)), "price_text": str(card.get("feeText", "")), "eb": bool(card.get("eb", false)),
		"specs": card.get("specs", []), "targets": card.get("targets", []), "conditions": card.get("conditions", []), "predictions": card.get("predictions", []),
		"supply": supply, "board": {"w": int(bench_q.get("w", 24)), "h": int(bench_q.get("h", 16)), "connectors": conns}}
	_scope_setup(tg)
	ticket["spec_full"] = str(card.get("specShort", "")) if str(card.get("specShort", "")) != "" else _short_spec(tg)
	ticket["answers"] = card.get("answers", [])
	ticket["chapter"] = int(card.get("chapter", 1))
	ticket["scope"] = scope_view
	mains = card.get("mains", {}) if card.get("mains", null) is Dictionary else {}
	camera_ok = bool(card.get("camera", false)); camera = false
	ticket["mains"] = mains
	_exam_hide()
	_rebuild_model()

func _supply_info() -> Dictionary:
	var ins: Dictionary = bench_q.get("instruments", {})
	if not mains.is_empty(): return {"kind": "mains", "label": "isolation transformer", "volts": float(mains.get("vrms", 230.0)), "tired": false, "adjustable": false}
	var rails: Array = []
	for sd in card.get("supplies", []): if str(sd.get("kind", "")) == "bench" and sd.get("fixed", null) != null: rails.append({"name": "%s rail" % str(sd.plus), "volts": float(sd.fixed)})
	if rails.size() >= 2: return {"kind": "sources", "label": "bench rails", "volts": 0.0, "tired": false, "sources": rails, "title": "BENCH RAILS  (always on)", "note": "wire V12 or V24 to the coil"}
	var sup = ins.get("supply", null)
	if sup is Dictionary:
		var fixed = null
		for sd in card.get("supplies", []): if str(sd.get("kind", "")) == "bench" and sd.get("fixed", null) != null: fixed = float(sd.fixed)
		var vv := float(sup.v) if fixed == null else float(fixed)
		return {"kind": "bench", "label": "%s V supply" % String.num(vv, 2).trim_suffix(".0").trim_suffix(".00"), "volts": vv, "tired": false, "adjustable": str(card.get("id", "")) == "2-3"}
	for p in _all_parts:
		if str(p.partId).begins_with("bat-pp3"):
			var tired: bool = str(p.partId).ends_with("tired") or str(p.get("variant", "")) == "tired"
			return {"kind": "pp3", "label": "tired 9 V pack" if tired else "9 V PP3", "volts": 9.0, "tired": tired}
	var srcs: Array = []   # an exam ticket: ideal textbook sources fixed on the board (not a battery, not the bench supply); chapter 2 adds its lab cells. The engine (ticketCard().sources) owns the volts and hides the unknown cell.
	var lab := false
	var n_ideal := 0
	for sc in card.get("sources", []):
		var pid := str(sc.partId)
		var v = sc.get("volts", null)
		if pid == "ideal-vsource":
			n_ideal += 1
			srcs.append({"name": "driver" if str(card.get("id", "")) == "2-4" else "E%d" % n_ideal, "volts": v})
		elif pid == "cell-2v": srcs.append({"name": "cell", "volts": v}); lab = true
		elif pid == "cell-test": srcs.append({"name": "test", "volts": v}); lab = true
	if not srcs.is_empty():
		var cid := str(card.get("id", ""))
		return {"kind": "sources", "label": "lab cells" if lab else "textbook sources", "volts": 0.0, "tired": false, "sources": srcs,
			"title": ("ON THE BENCH" if lab else "TEXTBOOK SOURCES  (ideal)"), "note": ("wire the cell into the bridge" if cid == "2-2" else ("driver cell and the cell to test" if cid == "2-4" else ("card (b): the 4 µF is charged to 100 V" if cid == "3-4" else "wired by the ticket: just probe")))}
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
	if str(tg.get("mode", "")) == "trace":   # chapter 3: a time trace from power-on against an amber tube (all of it the engine's: scope().trace)
		var clip0 = tg.get("clip", null)
		scope_view = {"unit": str(tg.get("unit", "V")), "lo": 0.0, "hi": _n(tg.get("vdiv", 1.0)) * 7.0, "vdiv": _n(tg.get("vdiv", 1.0)), "label": str(tg.get("label", "")), "mode": "trace", "scale": _n(tg.get("scale", 1.0)),
			"clip_pad": (clip0.pad if clip0 is Dictionary else null), "clip_name": (str(clip0.connector) if clip0 is Dictionary else ""), "clipped": bool(tg.get("clipped", false)), "attached": bool(tg.get("clipped", false)),
			"value": 0.0, "text": "", "name": str(tg.get("name", "")), "nogauge": false, "hidden": false, "times": tg.get("times", []), "tpd": _n(tg.get("timePerDiv", 0.2)), "trace": {}, "sweep_text": "", "vmul": 1.0,
			"second": (tg.second as Dictionary).get("label", "") if tg.get("second", null) is Dictionary else "", "vdivs": tg.get("vdivs", []), "vdiv_i": 0, "ac_avail": bool(tg.get("ac", false)), "ac_on": false, "acBand": _n(tg.get("acBand", 1.0), 1.0)}
		return
	var mode := str(tg.get("mode", "gauge")); var unit := str(tg.get("unit", ""))
	var lo := _n(tg.get("lo", 0.0)); var hi := _n(tg.get("hi", 1.0))
	var ref := hi if (lo <= 0.0 or hi < lo * 20.0) else lo * 1.5
	var vdiv := _nice(ref * 1.3 / 6.0)
	if mode == "probe" and _n(scope_q.get("voltsPerDiv", 0.0)) > 0.0: vdiv = float(scope_q.voltsPerDiv) * _n(tg.get("scale", 1.0))
	var label: String = {"A": "CURRENT", "W": "POWER", "V": "VOLTS", "uA": "NEEDLE"}.get(str(tg.get("quantity", "")), "LEVEL")
	var clip = tg.get("clip", null)
	scope_view = {"unit": unit, "lo": lo, "hi": minf(hi, vdiv * 7.0), "vdiv": vdiv, "label": label, "mode": mode, "scale": _n(tg.get("scale", 1.0)),
		"clip_pad": (clip.pad if clip is Dictionary else null), "clip_name": (str(clip.connector) if clip is Dictionary else ""), "clipped": false, "attached": mode == "gauge",
		"value": 0.0, "text": "", "name": str(tg.get("name", "")), "nogauge": tg.is_empty(), "hidden": tg.is_empty()}

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
				elif kind == "REG" and str(fam.partId) == "lm7805":   # the four 7805s differ by their heatsink: the row says which one it is
					var sink := str(va.id).get_slice("-", 1) if str(va.id).contains("-") else ""
					label = "7805 bare" if sink == "" else "7805 +%s C/W" % sink
				var tag := _watt_tag(float(va.ratings.P)) if (kind == "R" and va.ratings.has("P") and str(va.id) != "ideal" and not PART_TAG.has(str(fam.partId))) else str(PART_TAG.get(str(fam.partId), ""))
				if kind == "CE": tag = _volt_tag(str(va.id))
				if kind == "METER": kind = "GALVO"
				var mx = fam.get("max", null)
				out.append({"i": i, "partId": str(fam.partId), "value": v, "variant": str(va.id), "tag": tag, "label": label, "kind": kind, "footprint": str(fam.footprint),
					"price": int(va.get("price", 0)), "price_text": str(va.get("priceText", "")) if int(va.get("price", 0)) > 0 else "",
					"left": (int(mx) - int(fam.get("placed", 0))) if mx != null else -1})
				i += 1
	return out

## JSON null -> default (float(null) is an error in GDScript)
static func _n(v, d := 0.0) -> float: return d if v == null else float(v)

## "16V" -> "16 V" (an electrolytic's voltage rating is its variant id)
static func _volt_tag(id: String) -> String: return id.replace("V", " V")

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

## Change a placed part's value in place: its legs and wires stay (0.5: a repair swaps a value, it does not rebuild the board).
## The engine snaps to the values the ticket's box stocks and refuses others.
func set_value(uid: String, v: float) -> Dictionary:
	var r := _act("setValue", [uid, v])
	if bool(r.get("ok", false)): _after_edit()
	return r

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

## Stray stubs left by failed drags: a wire shorter than a pad and a half with an end that touches no leg. Returns how many were taken away.
func clean_stray() -> int:
	var n := 0
	for d in dangling.duplicate():
		for w in wires:
			if str(w.wid) != str(d.wid) or bool(w.get("fixed", false)): continue
			var l := 0.0
			for i in (w.path as Array).size() - 1: l += Vector2((w.path[i][0] as int), (w.path[i][1] as int)).distance_to(Vector2((w.path[i + 1][0] as int), (w.path[i + 1][1] as int)))
			if l <= 1.5: delete_wire(str(w.wid)); n += 1
			break
	return n

## 0.6 (Tess): right-click on a burnt part fits a fresh one in the same holes, wires kept (removing it took its wires with it, and
## the bin's one LED could not go in while the burnt one sat on the board). Power goes off, as after Ctrl+Z.
func replace_burnt(uid: String) -> bool:
	if not smoked.has(uid) and not arrived_burnt.has(uid): return false
	var r := _act("replaceSmoked", [uid])
	if not r.get("ok", false): return false
	smoked.erase(uid); _smoke_seen.erase(uid); arrived_burnt.erase(uid); _after_edit()
	powered = false; frame = {}
	event.emit("power", {"on": false, "auto": true, "silent": true})
	last_note = "Fresh part in the same holes, wires kept. The power is off."
	return true

func delete_wire(wid: String) -> Dictionary:
	var r := _act("unwire", [wid]); _after_edit()
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", ""))}

## Take back the last edit (Ctrl+Z). The engine keeps the history (bench().undoDepth); returns its sentence.
func undo() -> Dictionary:
	if not smoked.is_empty():   # a burnt part blocks the bench: the first undo after a burn swaps in a fresh one (the history stays)
		var n := 0
		for uid in smoked.keys(): if _act("replaceSmoked", [str(uid)]).get("ok", false): n += 1; arrived_burnt.erase(str(uid))
		if n > 0:
			smoked.clear(); _smoke_seen.clear(); _after_edit()
			powered = false; frame = {}
			event.emit("power", {"on": false, "auto": true, "silent": true})
			last_note = "Fresh part in place of the burnt one, and the power is off: switch it on when you want to try again. Ctrl+Z again takes edits back."
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
	card = _q("ticketCard"); ticket["predictions"] = card.get("predictions", []); ticket["answers"] = card.get("answers", [])
	ticket["supply"] = _supply_info()   # the test cell's volts appear once the predictions are locked
	_bench_key = ""   # a new answer is a new reason to bench (the auto bench waits for it)
	_exam_hide()
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", ""))}

## Sit the exam again for more stars: the predictions and answers are forgotten (the engine keeps the board), the ticket is no longer stamped FIXED.
func retry_exam() -> bool:
	var r := _act("retryExam")
	if not r.get("ok", false): return false
	passed = false; hold = 0.0; last_result = {}; _bench_key = ""
	card = _q("ticketCard"); ticket["predictions"] = card.get("predictions", []); ticket["answers"] = card.get("answers", [])
	ticket["supply"] = _supply_info(); ticket["stars"] = 0
	_exam_hide(); _refresh_board(); _refresh_live(); _rebuild_model()
	return true

## Exam bridge: predict first. The target band (chit and scope) stays hidden until every prediction is locked in, or it gives the answer away.
func _exam_hide() -> void:
	var hide := bool(ticket.get("eb", false)) and not predictions_done()
	scope_view["hidden"] = hide or bool(scope_view.get("nogauge", false))
	ticket["spec"] = "predict first, then build" if hide else str(ticket.get("spec_full", ""))

func predictions_done() -> bool:
	for p in ticket.get("predictions", []): if p.get("entered", null) == null: return false
	return true

## Numbers worked out on the slip (2-2: the distance): every one entered.
func answers_done() -> bool:
	for a in ticket.get("answers", []): if a.get("entered", null) == null: return false
	return true

## The formal bench check. A pass pays the ticket (event "paid"); a fail raises "bench_failed" with the engine's explanation of the player's own numbers.
func run_bench() -> Dictionary:
	var r := _act("runBench", [true])
	if bool(r.get("autoPowered", false)):   # the power switch was off: the engine switched it on for the bench; the rocker, click and toast follow
		powered = true; hold = 0.0; _accum = 0.0; smoked.clear(); _smoke_seen.clear()
		_refresh_board(); _refresh_live(); _rebuild_model()
		event.emit("power", {"on": true, "auto": true})
	var res = _q("benchResult")
	last_result = res if res is Dictionary else {}
	var bq2 = _q("bench")   # 0.5: a failed TEST changes the waiting customer's tip; the ticket reads it from here
	if bq2 is Dictionary: bench_q = bq2
	_bench_key = _board_key()
	refresh_wallet()
	if r.get("ok", false) and bool(r.get("pass", false)):
		passed = true; ticket["stars"] = int(r.get("stars", 0))
		event.emit("paid", {"burnt": int(r.get("burnt", 0)), "pay": int(r.get("pay", 0)), "tip": int(r.get("tip", 0)), "tip_text": str(r.get("tipText", "")), "pay_text": str(last_result.get("payText", "")), "stars": int(r.get("stars", 0)), "result": last_result})
	else:
		var why := str(r.get("message", ""))
		var fl: Array = last_result.get("failures", [])
		var pre := "The power switch was off, so I switched it on for the test.  " if bool(r.get("autoPowered", false)) else ""
		if not fl.is_empty(): why = str((fl[0] as Dictionary).get("text", why))
		for p in last_result.get("predictions", []): if str(p.get("grade", "")) == "miss": why = "%s  (%s)" % [why, str(p.get("gradeText", ""))]
		event.emit("bench_failed", {"text": pre + why, "result": last_result})
	return r

func _board_key() -> String: return "%s|%d" % [str(bench_q.get("ticket", "")), int(bench_q.get("undoDepth", 0))]

func _after_edit() -> void:
	passed = false; hold = 0.0; locked = false; _was_lock = false
	if ENGINE and not (ticket.get("answers", []) as Array).is_empty():   # the slip's formula follows which side of C the plug R is wired on
		var cd = _q("ticketCard")
		if cd is Dictionary: ticket["answers"] = cd.get("answers", ticket.get("answers", []))
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
		wires.append({"wid": str(w.wid), "a": path[0], "b": path[path.size() - 1], "path": path, "fixed": bool(w.get("fixed", false))})
	selectors = bench_q.get("selectors", []) if bench_q.get("selectors", null) is Array else []
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
	elif pid == "blackbox": kind = "BOXED"
	elif kind == "MISC" or pid.begins_with("ideal-vsource"): kind = "BAT"
	elif kind == "METER": kind = "GALVO"
	elif kind == "SLIDEWIRE": kind = "SLIDE"
	elif kind == "Z" or kind == "SCHOTTKY": kind = "D"
	var pins: Array = []
	var pin_labels: Array = []
	for q in p.pins:
		pins.append([int(q.pad[0]), int(q.pad[1])])
		pin_labels.append(str(q.get("label", q.get("name", ""))))
	var label := str(p.get("valueText", ""))
	var variant := str(p.get("variant", ""))
	var tag := ""
	if kind == "R" and p.get("ratings", {}).has("P") and variant != "ideal" and not PART_TAG.has(pid): tag = _watt_tag(float(p.ratings.P))
	if kind == "CE": tag = _volt_tag(variant)
	if pid == "pullup-10k": label = "pull-up 10 k"
	elif pid == "logic-in": label = "logic in 1 M"
	elif pid == "cap-charged": label = "4 µF, 100 V"
	elif kind == "RELAY": label = "relay"
	elif pid == "load-cc": label = "load"
	elif kind == "XFMR": label = "12 V"
	elif kind == "REG": label = "7805" if pid == "lm7805" else "LM317"
	elif kind == "D" and pid == "1n4007": label = "1N4007"
	elif kind == "D" and pid == "1n4148": label = "1N4148"
	elif kind == "D" and (pid.begins_with("1n47") or pid.begins_with("bzx") or pid.begins_with("zener")): label = "Zener"
	elif kind == "LOAD": label = str(p.get("name", "Heater"))
	elif kind == "BOXED": label = "sealed box"
	elif kind == "GALVO": label = "galvanometer"
	elif kind == "SLIDE": label = ""
	elif pid == "cell-2v": label = "2 V cell"
	elif pid == "cell-test": label = "test cell"
	elif kind == "BAT" and (pid == "cell-2v" or pid == "cell-test"): pass
	elif kind == "BAT": label = (("E%s  %s V" % [str(p.uid).substr(1), _g(float(p.value))]) if pid.begins_with("ideal-vsource") else ("%s V" % _g(float(p.value)))) if p.get("value", null) != null else NodeApi.BAT_LABEL.get(pid, "9 V")
	elif (kind == "R" or kind == "CE") and tag != "" and (_multi_rating(pid) or kind == "CE"): label = "%s %s" % [label, tag]
	elif kind == "LED": label = "LED"
	return {"uid": str(p.uid), "partId": pid, "value": p.get("value", null), "label": label, "tag": tag, "kind": kind, "x": int(p.x), "y": int(p.y), "rot": int(p.rot),
		"flip": bool(p.get("flip", false)), "fixed": bool(p.get("fixed", false)), "variant": variant, "pins": pins, "pin_labels": pin_labels, "smoked": bool(p.get("smoked", false)), "name": str(p.get("name", "")),
		"pos": p.get("pos", null), "pos_text": ("%.2f cm" % (float(p.pos) * 100.0)) if kind == "SLIDE" and p.get("pos", null) != null else ("50.00 cm" if kind == "SLIDE" else ""),
		"step_text": "\u00b1%s mm" % _g(jockey_step_mm()) if kind == "SLIDE" else ""}

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
	var d = _q("dmm")
	dmm_q = d if d is Dictionary else {}
	_apply_live()

## 0.6 (Dagny): the testbed is not a job: a gauge that holds in band must not run the host ticket's bench test and "pay".
var auto_bench := true

func _apply_live() -> void:
	_scope_update()
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
	var val := 0.0; var attached := true; var txt := ""; var slide := ""
	if str(sv.get("mode", "")) == "trace":
		var trc: Dictionary = scope_q.get("trace", {}) if scope_q.get("trace", null) is Dictionary else {}
		var tgt: Dictionary = tg if tg is Dictionary else {}
		sv["trace"] = trc; sv["tpd"] = _n(tgt.get("timePerDiv", sv.get("tpd", 0.2))); sv["times"] = tgt.get("times", sv.get("times", []))
		sv["attached"] = bool(sv.get("clipped", false)); sv["sweep_text"] = str(scope_q.get("sweepText", ""))
		var tv: Array = trc.get("v", [])
		if powered and not tv.is_empty() and bool(sv.attached): val = float(tv[tv.size() - 1])
		var gg = scope_q.get("gauge", null)
		sv["value"] = val; sv["text"] = str((gg as Dictionary).get("text", "")) if gg is Dictionary and powered and bool(sv.attached) else ""; sv["slide"] = ""
		scope_view = sv
		if not ticket.is_empty(): ticket["scope"] = sv
		return
	if str(sv.get("mode", "")) == "gauge":
		if gauge is Dictionary and gauge.get("value", null) != null and powered:
			val = float(gauge.value); txt = str(gauge.get("text", ""))
			if str(gauge.get("signedText", "")) != "": txt = str(gauge.signedText); slide = str(gauge.get("slide", ""))   # a null detector: signed, and which way to slide
	else:
		attached = bool(sv.get("clipped", false)) and bool(scope_q.get("attached", false))
		var v: Array = scope_q.get("v", [])
		if attached and powered and not v.is_empty(): val = float(v[v.size() - 1]) * _n(sv.get("scale", 1.0))
	sv["value"] = val; sv["attached"] = attached; sv["text"] = txt; sv["slide"] = slide
	scope_view = sv
	if not ticket.is_empty(): ticket["scope"] = sv

func scope_value() -> float: return _n(scope_view.get("value", 0.0))

## The scope's TIME knob (chapter 3): the next / previous time-per-division from the ticket's list. The engine restarts the sweep from power-on and re-draws the tube on the new scale.
func set_time_div(dir: int) -> Dictionary:
	var times: Array = scope_view.get("times", [])
	if times.is_empty(): return {"ok": false, "msg": ""}
	var cur := _n(scope_view.get("tpd", 0.2)); var best := 0
	for i in times.size(): if absf(log(float(times[i]) / cur)) < absf(log(float(times[best]) / cur)): best = i
	var nxt := clampi(best + dir, 0, times.size() - 1)
	if nxt == best: return {"ok": false, "msg": ""}
	var r := _act("setScope", [{"timePerDiv": float(times[nxt])}])
	if r.get("ok", false):
		_bench_key = ""; hold = 0.0
		_refresh_board(); _refresh_live(); _rebuild_model()
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", "")), "tpd": float(times[nxt])}

## Chapter 4: move one of the ticket's live switches (mains tolerance, load). The engine restarts the live circuit; the formal bench still runs every condition.
func set_selector(id: String, index: int) -> Dictionary:
	var r := _act("setSelector", [id, index])
	if r.get("ok", false):
		_bench_key = ""; hold = 0.0; locked = false; _was_lock = false
		_refresh_board(); _refresh_live(); _rebuild_model()
		ticket["supply"] = _supply_info()
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", ""))}

## The safety card of a mains ticket has been read (the engine unlocks power and the bench).
func read_safety() -> void:
	_act("readSafety"); card = _q("ticketCard"); mains = card.get("mains", {}) if card.get("mains", null) is Dictionary else {}; ticket["mains"] = mains
	_refresh_board(); _rebuild_model()

func safety_pending() -> bool: return not mains.is_empty() and not bool(mains.get("safetyRead", false))

## The scope's VOLTS knob when the ticket gives a list of settings (4-1: 5, 2, 1, 0.5, 0.2 V per division) and its AC coupling key.
func set_volts_div(dir: int) -> void:
	var vd: Array = scope_view.get("vdivs", [])
	if vd.is_empty(): return
	var i := clampi(int(scope_view.get("vdiv_i", 0)) + dir, 0, vd.size() - 1)
	scope_view["vdiv_i"] = i; scope_view["vdiv"] = float(vd[i]); scope_view["vmul"] = 1.0
func toggle_ac() -> void:
	if bool(scope_view.get("ac_avail", false)): scope_view["ac_on"] = not bool(scope_view.get("ac_on", false))

## DmmView reading: {text, unit, mode} straight from the engine LCD.
func dmm() -> Dictionary:
	if dial == "OFF": return {"text": "", "unit": "", "mode": "OFF"}
	var unit := str(dial)
	if not bool(dmm_q.get("valid", false)): return {"text": "----", "unit": unit, "mode": dial, "note": str(dmm_q.get("note", ""))}
	var disp: Dictionary = dmm_q.get("display", {})
	var s := str(disp.get("text", "")); var sp := s.rfind(" ")
	# the unit is the text's own suffix ("-305 mV" -> "mV"): display.unit is the base unit and dropped the milli prefix ("-305 V")
	return {"text": s.substr(0, sp) if sp > 0 else s, "value": disp.get("value", null), "unit": s.substr(sp + 1) if sp > 0 else str(disp.get("unit", unit)), "mode": dial, "negative": bool(dmm_q.get("negative", false))}

## ------------------------------------------------------------------------------------------------------------------ chapter 2 controls

## The fixed slide wire of the open ticket ({} when there is none).
func slide_part() -> Dictionary:
	for p in parts: if str(p.kind) == "SLIDE": return p
	return {}

## Jockey position in mm from end A (0.1 mm steps are the engine's).
func jockey_mm() -> float:
	var sp := slide_part()
	return (float(sp.pos) * 1000.0) if not sp.is_empty() and sp.get("pos", null) != null else 500.0

var jockey_step_i := 1            ## the jockey keys move 10 mm, 1 mm or 0.1 mm per press
const JOCKEY_STEPS := [10.0, 1.0, 0.1]
func jockey_step_mm() -> float: return JOCKEY_STEPS[clampi(jockey_step_i, 0, 2)]
func cycle_jockey_step() -> void:
	jockey_step_i = (jockey_step_i + 1) % 3
	_refresh_board(); _rebuild_model()

func set_jockey(mm: float) -> Dictionary:
	var sp := slide_part()
	if sp.is_empty(): return {"ok": false, "msg": ""}
	var r := _act("setJockey", [str(sp.uid), clampf(mm, 0.0, 1000.0)])
	if r.get("ok", false):
		_bench_key = ""; passed = false; hold = 0.0
		_refresh_board(); _refresh_live(); _rebuild_model()
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", "")) if not r.get("ok", false) else ""}

## The bench supply's set voltage (engine: instruments.supply.v).
func supply_volts() -> float:
	var sup = bench_q.get("instruments", {}).get("supply", null)
	return float(sup.v) if sup is Dictionary else 0.0

func set_supply(v: float) -> Dictionary:
	var sup = bench_q.get("instruments", {}).get("supply", null)
	if not (sup is Dictionary): return {"ok": false, "msg": ""}
	var r := _act("setSupply", [snappedf(clampf(v, 0.0, 15.0), 0.01), float(sup.ilim)])
	if r.get("ok", false):
		_bench_key = ""; passed = false; hold = 0.0
		_refresh_board(); _refresh_live(); _rebuild_model()
	return {"ok": bool(r.get("ok", false)), "msg": str(r.get("message", "")) if not r.get("ok", false) else ""}

## ------------------------------------------------------------------------------------------------------------------ play loop

func step(dt: float) -> void:
	t += dt
	if not powered or ticket.is_empty(): return
	_accum += dt
	var n := int(_accum / FRAME_DT)
	if n < 1: return
	_accum = fposmod(_accum, FRAME_DT)
	if async_live: _step_async(mini(n, 8))
	else:
		_act("advance", [mini(n, 8)])
		_refresh_live(); _rebuild_model()
	if locked and not passed:
		hold += dt
		# the formal check runs by itself once LOCK has held and every part is still cool: a part that is warming is left to play out (glow, then smoke) in real time
		if auto_bench and hold >= LOCK_HOLD and not bool(ticket.get("eb", false)) and answers_done() and _bench_key != _board_key() and not _any_heating(): run_bench()
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
	event.emit("smoked", {"uid": uid, "kind": str(part_by(uid).get("kind", "R")), "amps": amps, "watts": _n(pp.get("power", 0.0)), "text": str(ev.get("text", "")), "fx": str(ev.get("kind", "smoke")), "arrived": arrived_burnt.has(uid)})   # it cannot burn twice; a swapped part has left the set

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
			steps.append({"id": str(s.id), "text": str(s.text), "target": _target_of(s.get("anchor", null)), "done": bool(s.get("done", false)), "shown": bool(s.get("shown", true)), "optional": bool(s.get("optional", false))})
			if bool(s.get("active", false)): cur = i
			i += 1
	var back := step_no > 0 and step_no < _coach_max
	_coach_max = maxi(_coach_max, step_no)
	return {"steps": steps, "cur": cur, "step_no": step_no, "step_total": step_total, "back": back}

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
		"jockey": return "jockey"
		"supplyv": return "supplyv"
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
	var heat := {}; var led := {}; var galvo := {}; var cap_bulge := {}; var cap_level := {}; var relay_m := {}; var reg_m := {}
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
		if p.has("galvo"): galvo[str(p.uid)] = float(p.galvo.get("needle", 0.0))
		if p.has("cap"):   # the vent top swells with the voltage (over the rating) or with a reverse voltage; the charged can's gauge shows how full it is (both are only a picture of the engine's volts)
			var cv := _n(p.cap.get("v", 0.0)); var vr := _n(p.cap.get("vrated", 0.0)); var vf := _n(p.cap.get("vfull", 0.0))
			cap_bulge[uid] = clampf(-cv / 3.0, 0.0, 1.0) if cv < -0.2 else (clampf((cv / vr - 0.85) / 0.35, 0.0, 1.0) if vr > 0.0 else 0.0)
			cap_level[uid] = clampf(cv / vf, 0.0, 1.0) if vf > 0.0 else 0.0
		if p.has("reg"): reg_m[uid] = {"off": bool(p.reg.get("off", false)), "tj": _n(p.reg.get("tj", 25.0))}
		if p.has("relay"): relay_m[uid] = {"operated": bool(p.relay.get("operated", false)), "mA": _n(p.relay.get("mA", 0.0))}
	for e in frame.get("events", []): smoked_l.append(str(e.part))
	var vmin := _n(frame.get("vmin", 0.0)); var vmax := _n(frame.get("vmax", 1.0))
	var raw := {"board": bd, "nodes": {"sets": sets, "range": [minf(vmin, 0.0), maxf(vmax, 0.5)]}, "currents": {"wires": cur_w, "parts": cur_p},
		"thermal": {"ambient": _n(frame.get("ambient", 25.0)), "temps": temps_m, "smoked": smoked_l}, "ratings": rat,
		"liveStatus": {"powered": powered and bool(frame.get("valid", false)), "status": str(frame.get("status", "ok")), "t": _n(frame.get("t", 0.0))}}
	var m := NodeApi.normalise(raw)
	var norm := {}
	for n in frame.get("nodes", []):
		for q in n.pads: norm["%d,%d" % [int(q[0]), int(q[1])]] = float(n.norm)
	m["crossings"] = bench_q.get("crossings", []); m["joins"] = bench_q.get("joins", []); m["marks"] = bench_q.get("marks", []); m["slots"] = bench_q.get("slots", []); m["dangling"] = dangling; m["norm"] = norm; m["wire_speed"] = spd_w; m["part_speed"] = spd_p; m["heat"] = heat; m["led"] = led; m["galvo"] = galvo; m["cap_bulge"] = cap_bulge; m["cap_level"] = cap_level; m["relay"] = relay_m; m["contacts"] = frame.get("contacts", []); m["keepout"] = bench_q.get("keepOut", []); m["regs"] = reg_m; m["camera"] = camera and camera_ok; m["mains"] = not mains.is_empty()
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
		"wires": [[[2, 2], [4, 2]], [[8, 2], [8, 6]], [[14, 2], [14, 4]], [[10, 4], [10, 6], [8, 6]], [[8, 6], [8, 7]], [[8, 11], [8, 12]]],   # the minus ends of E1 and E2 come pre-wired to the GND pad (fixed wires of the ticket)
		"clip": [8, 6], "pred": {"pva": 6.6667, "pie2": 0.5556}},
}

const REFS_CH2 := {
	"2-1": {"parts": [["res-cf", 15000, "0.25W", 4, 2, 0], ["res-cf", 82000, "0.25W", 8, 4, 1]], "wires": [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[8, 4], [8, 2]], [[8, 8], [14, 8]]], "clip": [14, 2]},
	"2-2": {"parts": [["res-box", 5, "plug", 3, 5, 0], ["galvanometer", null, "100ohm", 13, 8, 0]],
		"wires": [[[2, 2], [2, 11]], [[22, 11], [22, 2]], [[3, 5], [3, 11], [2, 11]], [[7, 5], [11, 5]], [[17, 5], [20, 5], [20, 11], [22, 11]], [[11, 5], [11, 8], [13, 8]], [[19, 8], [19, 10], [12, 10], [12, 9]]],
		"jockey": 400.0, "pred": {"dist": 75.0}},
	"2-3": {"parts": [["res-cf", 1100, "0.25W", 4, 2, 0], ["res-cf", 33, "0.25W", 9, 2, 0]], "wires": [[[2, 2], [4, 2]], [[8, 2], [9, 2]], [[13, 2], [14, 2]]], "supply": 8.0, "leads": [[2, 12], [14, 8]]},
	"2-4": {"parts": [["rheostat", 10, "ideal", 6, 2, 0], ["galvanometer", null, "100ohm", 12, 7, 0]],
		"wires": [[[16, 2], [10, 2]], [[6, 2], [2, 2], [2, 11]], [[22, 11], [22, 2]], [[4, 5], [3, 5], [3, 11], [2, 11]], [[10, 5], [10, 7], [12, 7]], [[18, 7], [18, 10], [12, 10], [12, 9]]],
		"jockey": 750.0, "pred": {"pgrad": 0.02, "pemf": 1.5, "pr": 0.5}},
}

const REFS_CH3 := {
	"3-1": {"parts": [["cap-el", 100e-6, "16V", 14, 4, 1], ["res-cf", 10000, "0.25W", 4, 2, 0]], "wires": [[[2, 2], [4, 2]], [[8, 2], [14, 2]], [[14, 2], [14, 4]], [[14, 6], [14, 8]]], "clip": [14, 2]},
	"3-2": {"parts": [["res-cf", 47000, "0.25W", 4, 8, 0], ["cap-cer", 330e-9, "50V", 14, 9, 1]], "wires": [[[2, 8], [4, 8]], [[8, 8], [14, 8]], [[14, 8], [14, 9]]], "clip": [14, 8]},
	"3-3": {"parts": [["res-cf", 200, "1W", 6, 5, 0]], "wires": [[[2, 5], [6, 5]], [[10, 5], [12, 5], [12, 4]]]},
	"3-4": {"parts": [["cap-ideal", 2e-6, "ideal", 4, 2, 0], ["cap-ideal", 3e-6, "ideal", 8, 4, 1], ["cap-ideal", 6e-6, "ideal", 10, 4, 1], ["cap-ideal", 6e-6, "ideal", 20, 4, 1]],
		"wires": [[[2, 2], [4, 2]], [[8, 2], [8, 4]], [[8, 2], [10, 2], [10, 4]], [[8, 8], [8, 12], [10, 12]], [[10, 8], [10, 12]], [[20, 2], [20, 4]], [[20, 8], [20, 12], [10, 12]]],
		"pred": {"pq": 180.0, "pu": 9.9, "pv": 40.0, "pl": 12.0}},
}

const REFS_CH4 := {
	"4-1": {"parts": [["1n4007", null, "DO41", 14, 2, 0], ["1n4007", null, "DO41", 14, 6, 0], ["1n4007", null, "DO41", 18, 10, 2], ["1n4007", null, "DO41", 18, 13, 2], ["cap-el", 1000e-6, "25V", 20, 6, 1]],
		"wires": [[[12, 2], [14, 2]], [[12, 6], [14, 6]], [[18, 2], [20, 2]], [[20, 2], [22, 2]], [[18, 6], [18, 2]], [[12, 2], [11, 2], [11, 10], [14, 10]], [[12, 6], [12, 13], [14, 13]],
			[[18, 10], [18, 13]], [[18, 13], [18, 14], [22, 14]], [[20, 6], [20, 2]], [[20, 8], [20, 13], [18, 13]]], "clip": [22, 2]},
	"4-2": {"parts": [["res-cf", 180, "1W", 4, 2, 0], ["1n4733a", null, "DO41", 12, 8, 3]],
		"wires": [[[2, 2], [4, 2]], [[8, 2], [12, 2]], [[12, 2], [22, 2]], [[12, 4], [12, 2]], [[12, 8], [12, 14], [22, 14]]], "clip": [22, 2]},
	"4-3": {"parts": [["res-ww5", 10, "5W", 4, 2, 0], ["lm7805", null, "TO220-15", 10, 6, 0]],
		"wires": [[[2, 2], [4, 2]], [[8, 2], [10, 2], [10, 6]], [[12, 6], [12, 14], [22, 14]], [[14, 6], [14, 2], [22, 2]]], "clip": [22, 2]},
	"4-4": {"parts": [["lm317", null, "TO220", 10, 8, 0], ["res-cf", 240, "0.25W", 12, 12, 0], ["res-cf", 390, "0.25W", 4, 12, 0]],
		"wires": [[[2, 2], [14, 2], [14, 8]], [[12, 8], [12, 4], [20, 4], [20, 2], [22, 2]], [[10, 8], [8, 8], [8, 12]], [[10, 8], [10, 12], [12, 12]], [[16, 12], [16, 10], [12, 10], [12, 8]], [[4, 12], [4, 14], [22, 14]]], "clip": [22, 2]},
	"4-5": {"parts": [["res-exact", 300, "ideal", 4, 2, 0], ["zener-6v-ideal", null, "ideal", 12, 6, 3]],
		"wires": [[[2, 2], [4, 2]], [[8, 2], [10, 2]], [[10, 2], [12, 2]], [[12, 6], [12, 12], [10, 12]]], "pred": {"piz": 14.0, "prl": 333.33, "ppz": 120.0}},
}

const REFS_CH5 := {
	"5-1": {"parts": [["res-cf",220,"0.25W",4,7,0],["2n2222a",null,"TO92",14,8,0],["1n4007",null,"DO41",10,4,0]], "wires": [[[2,7],[4,7]],[[8,7],[15,7],[15,8]],[[14,8],[14,14],[22,14]],[[16,8],[16,6]],[[16,6],[22,6],[22,4]],[[10,4],[10,6],[16,6]],[[14,4],[14,2]]]},
	"5-2": {"parts": [["res-cf",100,"0.25W",4,8,0],["irlz44n",null,"TO220",12,8,0],["res-cf",100000,"0.25W",10,10,1]], "wires": [[[2,8],[4,8]],[[8,8],[10,8]],[[10,8],[12,8]],[[10,8],[10,10]],[[10,14],[16,14]],[[16,8],[16,14]],[[16,14],[22,14]],[[14,8],[14,6],[22,6],[22,4]]]},
	"5-3": {"parts": [["1n4148",null,"DO35",8,3,2],["1n4148",null,"DO35",8,6,2],["res-cf",4700,"0.25W",12,2,1],["1n4148",null,"DO35",12,8,0],["1n4148",null,"DO35",18,8,1],["res-cf",10000,"0.25W",13,12,0],["2n3904",null,"TO92",20,11,1],["res-cf",2200,"0.25W",20,5,1]], "wires": [[[2,3],[4,3]],[[2,6],[4,6]],[[8,3],[8,6]],[[8,6],[12,6]],[[12,6],[12,8]],[[16,8],[18,8]],[[18,12],[20,12]],[[17,12],[18,12]],[[13,12],[13,15],[22,15],[22,14]],[[2,1],[12,1],[12,2]],[[12,2],[20,2],[20,5]],[[20,9],[20,11]],[[20,9],[22,9],[22,6]],[[20,13],[20,14],[22,14]]], "clip": [22, 6]},
	"5-4": {"parts": [["res-cf",68000,"0.25W",8,3,1],["res-cf",10000,"0.25W",8,9,1],["2n3904",null,"TO92",12,8,1],["res-cf",4700,"0.25W",12,3,1],["res-cf",390,"0.25W",12,11,1],["cap-el",0.00001,"16V",6,8,2],["cap-el",0.00001,"16V",14,8,0]], "wires": [[[2,1],[8,1],[8,3]],[[8,3],[12,3]],[[8,7],[8,9]],[[8,9],[12,9]],[[6,8],[6,7],[8,7]],[[2,8],[4,8]],[[12,7],[12,8]],[[12,8],[14,8]],[[16,8],[22,8]],[[12,10],[12,11]],[[12,15],[22,15],[22,14]],[[8,13],[8,15],[12,15]]], "clip": [22, 8]},
	"5-5": {"parts": [["res-exact",565000,"ideal",4,4,0],["res-exact",3000,"ideal",11,2,1],["npn-textbook",null,"ideal",11,10,0]], "wires": [[[2,2],[2,4],[4,4]],[[2,2],[11,2]],[[8,4],[12,4],[12,10]],[[11,6],[11,8]],[[11,8],[11,10]],[[13,10],[13,14],[10,14]]], "pred": {"pib":20,"pic":2,"pvce":6,"pav":-232}},
}

## Build the reference design for the open ticket straight through the engine (no UI). Returns true when every step was accepted.
func build_ref(id: String) -> bool:
	var R: Dictionary = REFS.get(id, REFS_CH2.get(id, REFS_CH3.get(id, REFS_CH4.get(id, REFS_CH5.get(id, {})))))
	if R.is_empty(): return false
	var ok := true
	clear_fault()
	if R.has("pred"): for k in R.pred: ok = predict(str(k), float(R.pred[k])).ok and ok
	for p in R.parts: ok = bool(place({"partId": p[0], "value": p[1], "variant": p[2], "kind": "R"}, p[3], p[4], p[5]).ok) and ok
	for w in R.wires: ok = _act("addWire", [w]).get("ok", false) and ok
	if R.has("clip"): ok = bool(set_probe("ch1", R.clip).ok) and ok
	if R.has("jockey"): ok = bool(set_jockey(float(R.jockey)).ok) and ok
	if R.has("supply"): ok = bool(set_supply(float(R.supply)).ok) and ok
	if R.has("leads"): for k in 2: ok = bool(set_probe(["red", "black"][k], R.leads[k]).ok) and ok
	_after_edit()
	return ok

## Pass every ticket before `id` with its reference design (unlocks `id` for the screenshot run and the tests), leaving `id` closed.
## A repair ticket arrives with the customer's faulty board (parts x1.., wires xw..): take it apart, as the ref does.
func clear_fault() -> void:
	for w in wires.duplicate(): if str(w.wid).begins_with("xw"): _act("deleteWire", [str(w.wid)])
	for p in _all_parts.duplicate(): if str(p.uid).begins_with("x"): _act("deletePart", [str(p.uid)])
	_after_edit()

func unlock_through(id: String) -> void:
	for tk in ALL_TICKETS:
		if tk == id: break
		if not open_ticket(tk): continue
		if safety_pending(): read_safety()
		build_ref(tk); set_power(true)
		for i in 3: step(FRAME_DT * 1.01)
		_act("runBench")
	close_ticket(); refresh_wallet()
