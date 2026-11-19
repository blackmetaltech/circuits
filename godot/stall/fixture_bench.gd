class_name FixtureBench
extends RefCounted
## FIXTURE-DRIVEN bench backend (no engine needed). It owns a tiny board, a small nonlinear DC solver (MNA + Newton, the LED is a Shockley diode
## with Rs), a first-order thermal model and the chapter-1 ticket data (DESIGN §2.8, band numbers mirrored from the design doc), and it hands the
## view a model in exactly the NodeApi shape the engine will produce. When the engine's board actions land, EngineBench (same method set) replaces it;
## nothing in the view reads anything but the methods below. All numbers here are FIXTURE numbers: the engine owns the real ones.
##
## Interface used by StallScene (duck-typed, shared with EngineBench):
##   ticket, parts, wires, powered, locked, smoked (uid->true), model (NodeApi view model, refreshed on change), t
##   open_ticket(id), place(item, x, y, rot) -> {ok,msg,uid}, move_part(uid,x,y,rot), delete_part(uid), add_wire(a,b), delete_wire(wid),
##   set_power(on), set_probe(which, pad|null), set_dial(mode), step(dt), cond(id) -> bool, scope_value() -> float, dmm() -> {text, unit, mode}
signal event(name: String, data: Dictionary)

const AMBIENT := 25.0
const LOCK_HOLD := 1.2
const THERMAL_SPEED := 4.0
const LED_IMAX := 0.030
const LED_INSTANT := 0.090          ## I > 3 x IF,abs: the die cracks at once (DESIGN §3.9)
const RES_TFAIL := 230.0

const R_CF := {"partId": "res-cf", "w": 0.25, "tag": "¼ W"}
const TICKETS := {
	"1-1": {
		"id": "1-1", "title": "Torch", "customer": "Lio", "age": "10", "gadget": "torch", "price": 12,
		"brief": "Lio's torch is dead. Light the LED without burning it.", "ask": "My torch died.", "thanks": "It lights up! You fixed it!",
		"spec": "LED current 10 - 20 mA", "supply": {"label": "9 V PP3", "emf": 9.0, "r": 1.7, "kind": "pp3"},
		"board": {"w": 20, "h": 11, "connectors": [{"id": "IN", "pad": [19, 2], "role": "supply"}, {"id": "GND", "pad": [19, 8], "role": "ground"}], "fixed": []},
		"bin": [["led-red-5mm", null, "", "red LED"], ["res-cf", 100.0, "¼ W", ""], ["res-cf", 220.0, "¼ W", ""], ["res-cf", 470.0, "¼ W", ""], ["res-cf", 1000.0, "¼ W", ""]],
		"scope": {"q": "ledI", "unit": "mA", "lo": 10.0, "hi": 20.0, "vdiv": 4.0, "scale": 1000.0, "label": "LED I"},
	},
	"1-2": {
		"id": "1-2", "title": "Tail-light", "customer": "Ash", "age": "cyclist", "gadget": "taillight", "price": 18,
		"brief": "Ash needs three red LEDs on one 9 V battery, each 14 - 20 mA.", "ask": "Can you make my bike light brighter?", "thanks": "Now they see me coming!",
		"spec": "each LED 14 - 20 mA", "supply": {"label": "9 V PP3", "emf": 9.0, "r": 1.7, "kind": "pp3"},
		"board": {"w": 20, "h": 11, "connectors": [{"id": "IN", "pad": [19, 2], "role": "supply"}, {"id": "GND", "pad": [19, 8], "role": "ground"}], "fixed": []},
		"bin": [["led-red-5mm", null, "", "red LED"], ["led-red-5mm", null, "", "red LED"], ["led-red-5mm", null, "", "red LED"], ["res-cf", 100.0, "¼ W", ""],
			["res-cf", 120.0, "¼ W", ""], ["res-cf", 150.0, "¼ W", ""], ["res-cf", 180.0, "¼ W", ""], ["res-cf", 220.0, "¼ W", ""], ["res-cf", 470.0, "¼ W", ""]],
		"scope": {"q": "ledI", "unit": "mA", "lo": 14.0, "hi": 20.0, "vdiv": 4.0, "scale": 1000.0, "label": "LED I"},
	},
	"1-3": {
		"id": "1-3", "title": "Hot Resistor", "customer": "Mr. Brook", "age": "aquarium", "gadget": "heater", "price": 24,
		"brief": "Mr. Brook's 12 V aquarium heater (50 ohm, fixed on the board) wants 8 V, and no part may exceed its rating.",
		"ask": "The heater runs too hot for the fish.", "thanks": "The fish are comfortable again.",
		"spec": "load 8.0 V  +/- 0.35 V, nothing over rating", "supply": {"label": "12 V supply", "emf": 12.0, "r": 0.2, "kind": "bench"},
		"board": {"w": 20, "h": 11, "connectors": [{"id": "IN", "pad": [19, 2], "role": "supply"}, {"id": "GND", "pad": [19, 8], "role": "ground"}],
			"fixed": [{"uid": "load", "partId": "load-heater", "value": 50.0, "x": 14, "y": 2, "label": "50 Ω heater", "fixed": true, "pins": [[14, 2], [14, 8]], "kind": "LOAD"}]},
		"bin": [["res-cf", 22.0, "¼ W", ""], ["res-mf5", 22.0, "½ W", ""], ["res-1w", 22.0, "1 W", ""], ["res-cf", 27.0, "¼ W", ""], ["res-mf5", 47.0, "½ W", ""],
			["res-mf5", 47.0, "½ W", ""], ["res-1w", 47.0, "1 W", ""], ["res-cf", 51.0, "¼ W", ""], ["res-1w", 100.0, "1 W", ""]],
		"scope": {"q": "vLoad", "unit": "V", "lo": 7.65, "hi": 8.35, "vdiv": 2.0, "scale": 1.0, "label": "V LOAD"},
	},
	"1-4": {
		"id": "1-4", "title": "Tired Battery", "customer": "Bo", "age": "toy car", "gadget": "car", "price": 30,
		"brief": "Bo's toy-car battery is tired. Pick the load resistor that takes the most power out of it: at least 4.2 W.",
		"ask": "My car got slow.", "thanks": "Vroom! Fast again!",
		"spec": "power into the load >= 4.20 W", "supply": {"label": "tired 9 V pack", "emf": 9.0, "r": 4.7, "kind": "pp3", "tired": true},
		"board": {"w": 20, "h": 11, "connectors": [{"id": "IN", "pad": [19, 2], "role": "supply"}, {"id": "GND", "pad": [19, 8], "role": "ground"}], "fixed": []},
		"bin": [["res-1w", 3.3, "1 W", ""], ["res-ww5", 3.3, "5 W", ""], ["res-1w", 3.9, "1 W", ""], ["res-ww5", 3.9, "5 W", ""], ["res-ww5", 4.7, "5 W", ""],
			["res-1w", 5.6, "1 W", ""], ["res-ww5", 5.6, "5 W", ""], ["res-ww5", 6.8, "5 W", ""], ["res-ww5", 10.0, "5 W", ""]],
		"scope": {"q": "powerR", "unit": "W", "lo": 4.2, "hi": 6.0, "vdiv": 1.0, "scale": 1.0, "label": "P LOAD"},
	},
	"1-5": {
		"id": "1-5", "title": "Two Batteries", "customer": "Eb", "age": "exam", "gadget": "exam", "price": 20, "eb": true,
		"brief": "Exam bridge: E1 = 10 V with R1 = 2 ohm and E2 = 5 V with R2 = 3 ohm feed node A, with R3 = 6 ohm to ground. Predict V(A), then build and probe it.",
		"ask": "Predict first, then probe.", "thanks": "The numbers agree!",
		"spec": "V(A) = 6.667 V  +/- 0.1 %", "supply": {"label": "(textbook sources)", "emf": 0.0, "r": 1.0, "kind": "none"},
		"board": {"w": 22, "h": 12, "connectors": [{"id": "GND", "pad": [21, 9], "role": "ground"}], "fixed": []},
		"bin": [["bat-ideal", 10.0, "E1", "10 V"], ["bat-ideal", 5.0, "E2", "5 V"], ["res-cf", 2.0, "", ""], ["res-cf", 3.0, "", ""], ["res-cf", 6.0, "", ""]],
		"scope": {"q": "vR6", "unit": "V", "lo": 6.660, "hi": 6.674, "vdiv": 2.0, "scale": 1.0, "label": "V(A)"},
	},
}
const ORDER := ["1-1", "1-2", "1-3", "1-4", "1-5"]
const RATING_W := {"res-cf": 0.25, "res-mf5": 0.5, "res-1w": 1.0, "res-ww5": 5.0}

var ticket: Dictionary = {}
var parts: Array = []       ## [{uid, partId, value, label, kind, x, y, rot, flip, fixed, pins: [pad,..]}]  (view-model shaped; pins absolute)
var wires: Array = []       ## [{wid, a:[x,y], b:[x,y], path:[[x,y]..]}]
var probes := {"red": null, "black": null}
var dial := "V"             ## OFF | V | mA
var powered := false
var locked := false
var smoked := {}
var temps := {}
var t := 0.0
var power_time := 0.0
var hold := 0.0
var model: Dictionary = {}
var supply_i := 0.0
var dmm_used := false
var dmm_loaded := false
var thermal_speed := THERMAL_SPEED
var _uid := 1
var _wid := 1
var _v := {}                 ## pad key -> volts
var _ipart := {}             ## uid -> amps (pin1 -> pin2)
var _iwire := {}             ## wid -> amps
var _dirty := true

func _init() -> void:
	var ts := OS.get_environment("CB_THERMAL_SPEED")
	if ts != "": thermal_speed = clampf(float(ts), 1.0, 64.0)

## ------------------------------------------------------------------------------------------------------------------ tickets

func open_ticket(id: String) -> bool:
	if not TICKETS.has(id): return false
	ticket = (TICKETS[id] as Dictionary).duplicate(true)
	parts.clear(); wires.clear(); smoked.clear(); temps.clear(); _v.clear(); _ipart.clear(); _iwire.clear()
	powered = false; locked = false; hold = 0.0; t = 0.0; power_time = 0.0; probes = {"red": null, "black": null}; dial = "V"
	dmm_used = false; dmm_loaded = false; supply_i = 0.0
	for fp in ticket.board.fixed:
		var d: Dictionary = (fp as Dictionary).duplicate(true); d["rot"] = 0; d["flip"] = false
		parts.append(d); temps[d.uid] = AMBIENT
	_dirty = true; _refresh(); return true

func bin() -> Array:
	var out: Array = []
	var i := 0
	for e in ticket.get("bin", []):
		var pid: String = e[0]; var val = e[1]
		var kind := "LED" if pid.begins_with("led") else ("BAT" if pid.begins_with("bat") else "R")
		var label: String = e[3] if e[3] != "" else NodeApi.format_value(float(val), "R")
		out.append({"i": i, "partId": pid, "value": val, "tag": e[2], "label": label, "kind": kind})
		i += 1
	return out

## ------------------------------------------------------------------------------------------------------------------ board edits

static func pins_of(item: Dictionary, x: int, y: int, rot: int) -> Array:
	var pid: String = item.partId
	var fp: Array = [[0, 0], [2, 0]]
	if pid.begins_with("res-"): fp = [[0, 0], [4, 0]]
	elif pid.begins_with("bat-"): fp = [[0, 0], [6, 0]]
	var out: Array = []
	for o in fp: out.append(Vector2(x, y) + NodeApi._rot_off(Vector2(o[0], o[1]), rot, false))
	return out

func _occupied(skip_uid := "") -> Dictionary:
	var occ := {}
	for p in parts:
		if p.uid == skip_uid: continue
		var pn: Array = p.pins
		for q in pn: occ[_key(q)] = true
		if pn.size() == 2 and p.kind != "LOAD":   # the body lies between the pins
			var a := Vector2(pn[0][0], pn[0][1]); var b := Vector2(pn[1][0], pn[1][1]); var n := int(maxf(absf(b.x - a.x), absf(b.y - a.y)))
			for k in range(1, n): occ[NodeApi.key(a + (b - a) * (float(k) / float(n)))] = true
	for c in ticket.board.connectors: occ[NodeApi.key(Vector2(c.pad[0], c.pad[1]))] = true
	return occ

func can_place(item: Dictionary, x: int, y: int, rot: int, skip_uid := "") -> String:
	var pins := pins_of(item, x, y, rot)
	var occ := _occupied(skip_uid)
	for q in pins:
		if q.x < 0 or q.y < 0 or q.x > ticket.board.w - 1 or q.y > ticket.board.h - 1: return "That would hang off the board."
		if occ.has(NodeApi.key(q)): return "A pad there is already taken."
	var a: Vector2 = pins[0]; var b: Vector2 = pins[1]; var n := int(maxf(absf(b.x - a.x), absf(b.y - a.y)))
	for k in range(1, n):
		if occ.has(NodeApi.key(a + (b - a) * (float(k) / float(n)))): return "Something is in the way."
	return ""

func place(item: Dictionary, x: int, y: int, rot := 0) -> Dictionary:
	var why := can_place(item, x, y, rot)
	if why != "": return {"ok": false, "msg": why}
	var uid := "u%d" % _uid; _uid += 1
	var pid: String = item.partId
	var d := {"uid": uid, "partId": pid, "value": item.value, "label": item.label, "tag": item.get("tag", ""), "x": x, "y": y, "rot": rot, "flip": false, "fixed": false, "variant": item.get("tag", "")}
	d["kind"] = item.kind
	d["pins"] = pins_of(item, x, y, rot).map(func(v): return [int(v.x), int(v.y)])
	parts.append(d); temps[uid] = AMBIENT
	_dirty = true; _refresh()
	event.emit("placed", {"uid": uid, "kind": item.kind})
	return {"ok": true, "msg": "", "uid": uid}

func part_by(uid: String) -> Dictionary:
	for p in parts: if p.uid == uid: return p
	return {}

func move_part(uid: String, x: int, y: int, rot: int) -> Dictionary:
	var p := part_by(uid)
	if p.is_empty() or p.fixed: return {"ok": false, "msg": "That part is soldered in."}
	var why := can_place(p, x, y, rot, uid)
	if why != "": return {"ok": false, "msg": why}
	var old: Array = p.pins.duplicate()
	var np: Array = pins_of(p, x, y, rot).map(func(v): return [int(v.x), int(v.y)])
	p.x = x; p.y = y; p.rot = rot; p.pins = np
	for w in wires:   # wires follow their pins
		for i in old.size():
			if w.a == old[i]: w.a = np[i]
			if w.b == old[i]: w.b = np[i]
		w.path = _route(w.a, w.b)
	_dirty = true; _refresh(); return {"ok": true, "msg": ""}

func delete_part(uid: String) -> void:
	var p := part_by(uid)
	if p.is_empty() or p.fixed: return
	for i in range(wires.size() - 1, -1, -1):   # wires that ended on its pins come off too
		var w: Dictionary = wires[i]
		if (p.pins as Array).has(w.a) or (p.pins as Array).has(w.b): wires.remove_at(i)
	parts.erase(p); smoked.erase(uid); temps.erase(uid)
	_dirty = true; _refresh(); event.emit("deleted", {"uid": uid})

static func _route(a: Array, b: Array) -> Array:
	if a[0] == b[0] or a[1] == b[1]: return [a, b]
	return [a, [b[0], a[1]], b]

func add_wire(a: Array, b: Array) -> Dictionary:
	if a == b: return {"ok": false, "msg": ""}
	var w: int = ticket.board.w; var h: int = ticket.board.h
	for q in [a, b]: if q[0] < 0 or q[1] < 0 or q[0] > w - 1 or q[1] > h - 1: return {"ok": false, "msg": "Wires go pad to pad."}
	for e in wires: if (e.a == a and e.b == b) or (e.a == b and e.b == a): return {"ok": false, "msg": "That wire is already there."}
	var wid := "w%d" % _wid; _wid += 1
	wires.append({"wid": wid, "a": a, "b": b, "path": _route(a, b)})
	_dirty = true; _refresh(); event.emit("wired", {"wid": wid})
	return {"ok": true, "msg": "", "wid": wid}

func delete_wire(wid: String) -> void:
	for i in wires.size(): if wires[i].wid == wid: wires.remove_at(i); break
	_dirty = true; _refresh()

func set_power(on: bool) -> void:
	if powered == on: return
	powered = on; power_time = 0.0; hold = 0.0
	_dirty = true; _refresh(); event.emit("power", {"on": on})

func set_probe(which: String, pad) -> void:
	probes[which] = pad; dmm_used = dmm_used or pad != null
	if probes.red != null and probes.black != null and dial == "V" and powered and supply_i > 0.0: dmm_loaded = true
	_refresh()

func set_dial(mode: String) -> void: dial = mode; _refresh()

## ------------------------------------------------------------------------------------------------------------------ solver

func _key(a) -> String: return "%d,%d" % [int(a[0]), int(a[1])]

func _find(par: Dictionary, k: String) -> String:
	while par[k] != k:
		par[k] = par[par[k]]; k = par[k]
	return k

func _led_params(pid: String) -> Dictionary: return {"n": 2.0, "is": 1.19e-17, "rs": 9.9}

func _solve() -> void:
	_v.clear(); _ipart.clear(); _iwire.clear(); supply_i = 0.0
	var par := {}
	for p in parts: for q in p.pins: par[_key(q)] = _key(q)
	for c in ticket.board.connectors: par[_key(c.pad)] = _key(c.pad)
	for w in wires: par[_key(w.a)] = _key(w.a); par[_key(w.b)] = _key(w.b)
	for w in wires: par[_find(par, _key(w.a))] = _find(par, _key(w.b))
	var gnd := ""
	var vin := ""
	for c in ticket.board.connectors:
		if c.id == "GND": gnd = _find(par, _key(c.pad))
		if c.id == "IN": vin = _find(par, _key(c.pad))
	var net_idx := {}; var n := 0
	for k in par:
		var r := _find(par, k)
		if r != gnd and not net_idx.has(r): net_idx[r] = n; n += 1
	_par = par; _gnd = gnd; _net_idx = net_idx
	var els: Array = []
	var leds: Array = []
	var src_on := powered
	var sup: Dictionary = ticket.supply
	if src_on and sup.kind != "none" and vin != "":
		els.append({"t": "S", "a": (-1 if vin == gnd else int(net_idx[vin])), "b": -1, "emf": float(sup.emf), "r": float(sup.r), "id": "supply"})
	for p in parts:
		if smoked.has(p.uid): continue
		var a: int = _ix(p.pins[0]); var b: int = _ix(p.pins[1])
		match str(p.kind):
			"R", "LOAD": els.append({"t": "R", "a": a, "b": b, "g": 1.0 / maxf(float(p.value), 1e-3), "uid": p.uid})
			"LED":
				var lp := _led_params(p.partId); leds.append({"a": a, "b": b, "k": n + leds.size(), "uid": p.uid, "n": lp.n, "is": lp.is, "rs": lp.rs})
				els.append({"t": "R", "a": a, "b": n + leds.size() - 1, "g": 1.0 / lp.rs, "uid": ""})
			"BAT":
				if src_on: els.append({"t": "S", "a": a, "b": b, "emf": float(p.value), "r": 0.001, "id": p.uid})
	var N := n + leds.size()
	var vv := PackedFloat64Array(); vv.resize(N)
	var vj_old := {}
	for led in leds: vj_old[led.uid] = 0.0
	for it in 120:
		var A: Array = []; for i in N: var row := PackedFloat64Array(); row.resize(N + 1); A.append(row)
		for i in N: A[i][i] += 1e-12   # gmin: floating nets stay solvable
		for e in els:
			if e.t == "R": _stamp_g(A, e.a, e.b, e.g)
			else:
				var g: float = 1.0 / e.r; _stamp_g(A, e.a, e.b, g)
				if e.a >= 0: A[e.a][N] += float(e.emf) * g
				if e.b >= 0: A[e.b][N] -= float(e.emf) * g
		for led in leds:
			var nvt: float = led.n * 0.02585
			var vj := _vd(vv, led.k) - _vd(vv, led.b)
			var vcrit: float = nvt * log(nvt / (sqrt(2.0) * led.is))
			vj = _pnjlim(vj, float(vj_old[led.uid]), nvt, vcrit); vj_old[led.uid] = vj
			var ex := exp(minf(vj / nvt, 80.0))
			var gd: float = led.is / nvt * ex + 1e-12; var idd: float = led.is * (ex - 1.0)
			var ieq := idd - gd * vj
			_stamp_g(A, led.k, led.b, gd)
			if led.k >= 0: A[led.k][N] -= ieq
			if led.b >= 0: A[led.b][N] += ieq
		var nv := _gauss(A, N)
		var dmax := 0.0
		for i in N: dmax = maxf(dmax, absf(nv[i] - vv[i]))
		vv = nv
		if dmax < 1e-7 and it > 1: break
	# results
	for k in par:
		var ni := -1 if _find(par, k) == gnd else int(net_idx[_find(par, k)])
		_v[k] = 0.0 if ni < 0 else vv[ni]
	var cin := {}   # pad key -> current from the wire network into parts (injection = -cin)
	for p in parts:
		var va: float = _v.get(_key(p.pins[0]), 0.0); var vb: float = _v.get(_key(p.pins[1]), 0.0)
		var i := 0.0
		if not smoked.has(p.uid):
			match str(p.kind):
				"R", "LOAD": i = (va - vb) / maxf(float(p.value), 1e-3)
				"LED":
					var led = leds.filter(func(l): return l.uid == p.uid)[0]
					var vj := vv[led.k] - (0.0 if led.b < 0 else vv[led.b]); var nvt: float = led.n * 0.02585
					i = led.is * (exp(minf(vj / nvt, 80.0)) - 1.0)
				"BAT": if src_on: i = -(float(p.value) - (va - vb)) / 0.001   # current out of the + pin (pin 1) into the circuit, negative "into part"
		_ipart[p.uid] = i
		_addc(cin, p.pins[0], i); _addc(cin, p.pins[1], -i)
	if src_on and sup.kind != "none" and vin != "":
		var inpad = null; var gpad = null
		for c in ticket.board.connectors:
			if c.id == "IN": inpad = c.pad
			if c.id == "GND": gpad = c.pad
		supply_i = (float(sup.emf) - (float(_v.get(_key(inpad), 0.0)) - float(_v.get(_key(gpad), 0.0)))) / maxf(float(sup.r), 1e-3)
		_addc(cin, inpad, -supply_i); _addc(cin, gpad, supply_i)
	# wire currents: spanning-tree accumulation of the injections inside each wire-connected component
	var adj := {}
	for w in wires:
		var ka := _key(w.a); var kb := _key(w.b)
		if not adj.has(ka): adj[ka] = []
		if not adj.has(kb): adj[kb] = []
		adj[ka].append([kb, w.wid, 1.0]); adj[kb].append([ka, w.wid, -1.0])
	var seen := {}
	for root in adj:
		if seen.has(root): continue
		var order: Array = [root]; var parent := {root: ["", "", 0.0]}; seen[root] = true
		var qi := 0
		while qi < order.size():
			var cur: String = order[qi]; qi += 1
			for ed in adj[cur]:
				if not seen.has(ed[0]): seen[ed[0]] = true; parent[ed[0]] = [cur, ed[1], ed[2]]; order.append(ed[0])
		var sub := {}
		for k in order: sub[k] = -float(cin.get(k, 0.0))
		for j in range(order.size() - 1, 0, -1):
			var k: String = order[j]; var pr: Array = parent[k]
			# current from parent to child = - (net injection of the child's subtree); sign +1 when the wire's a-end is the parent
			_iwire[pr[1]] = -sub[k] * float(pr[2])
			sub[pr[0]] += sub[k]
	_dirty = false

var _par := {}
var _gnd := ""
var _net_idx := {}
func _ix(pad) -> int:   # -1 = ground
	var r := _find(_par, _key(pad)); return -1 if r == _gnd else int(_net_idx[r])
func _addc(cin: Dictionary, pad, amps: float) -> void: cin[_key(pad)] = float(cin.get(_key(pad), 0.0)) + amps

static func _vd(v: PackedFloat64Array, i: int) -> float: return 0.0 if i < 0 else v[i]

static func _stamp_g(A: Array, a: int, b: int, g: float) -> void:
	if a >= 0: A[a][a] += g
	if b >= 0: A[b][b] += g
	if a >= 0 and b >= 0: A[a][b] -= g; A[b][a] -= g

static func _pnjlim(vnew: float, vold: float, vt: float, vcrit: float) -> float:
	if vnew > vcrit and absf(vnew - vold) > 2.0 * vt:
		if vold > 0.0:
			var arg := 1.0 + (vnew - vold) / vt
			return vold + vt * log(arg) if arg > 0.0 else vcrit
		return vt * log(vnew / vt)
	return vnew

static func _gauss(A: Array, n: int) -> PackedFloat64Array:
	var x := PackedFloat64Array(); x.resize(n)
	if n == 0: return x
	for c in n:
		var piv := c; var best := absf(A[c][c])
		for r in range(c + 1, n): if absf(A[r][c]) > best: best = absf(A[r][c]); piv = r
		if best < 1e-30: continue
		if piv != c: var tmp = A[c]; A[c] = A[piv]; A[piv] = tmp
		for r in range(c + 1, n):
			var f: float = A[r][c] / A[c][c]
			if f == 0.0: continue
			for k in range(c, n + 1): A[r][k] -= f * A[c][k]
	for r in range(n - 1, -1, -1):
		var s: float = A[r][n]
		for k in range(r + 1, n): s -= A[r][k] * x[k]
		x[r] = s / A[r][r] if absf(A[r][r]) > 1e-30 else 0.0
	return x

## ------------------------------------------------------------------------------------------------------------------ thermal and events

func rating_w(p: Dictionary) -> float: return float(RATING_W.get(p.partId, 0.25))

func _power(p: Dictionary) -> float:
	var i: float = _ipart.get(p.uid, 0.0)
	match str(p.kind):
		"R": return i * i * float(p.value)
		"LED": return absf(i) * 2.0
	return 0.0

func step(dt: float) -> void:
	t += dt
	if powered: power_time += dt
	var changed := false
	for p in parts:
		if p.kind != "R" and p.kind != "LED": continue
		if smoked.has(p.uid): temps[p.uid] = lerpf(temps.get(p.uid, AMBIENT), AMBIENT, 1.0 - exp(-dt * 0.5)); continue
		var theta := 85.0 / rating_w(p) if p.kind == "R" else 1200.0
		var tau := 8.0 if (p.kind == "R" and rating_w(p) <= 0.25) else (40.0 if rating_w(p) >= 5.0 else (10.0 if p.kind == "LED" else 15.0))
		var tinf := AMBIENT + (_power(p) * theta if powered else 0.0)
		var T: float = temps.get(p.uid, AMBIENT)
		T += (tinf - T) * (1.0 - exp(-dt * thermal_speed / tau))
		temps[p.uid] = T
		var inst: bool = p.kind == "LED" and absf(_ipart.get(p.uid, 0.0)) > LED_INSTANT and powered
		var fail: bool = (p.kind == "R" and T > RES_TFAIL) or (p.kind == "LED" and T > 125.0) or inst
		if fail:
			smoked[p.uid] = true; changed = true
			event.emit("smoked", {"uid": p.uid, "kind": p.kind, "amps": _ipart.get(p.uid, 0.0), "watts": _power(p)})
	if changed: _dirty = true; _refresh()
	for p in parts:
		if model.has("temps"): model.temps[p.uid] = temps.get(p.uid, AMBIENT)
	# band lock
	if powered and not locked and in_band() and power_time > 0.4:
		hold += dt
		if hold >= LOCK_HOLD:
			locked = true; event.emit("lock", {"price": int(ticket.price)})
	elif not in_band(): hold = 0.0

func ratings_ok() -> bool:
	for p in parts:
		if smoked.has(p.uid): return false
		if p.kind == "R" and _power(p) > rating_w(p) * 1.0001: return false
		if p.kind == "LED" and absf(_ipart.get(p.uid, 0.0)) > LED_IMAX: return false
	return true

func values() -> Array:   # the scope quantity (one value per thing the spec covers), in display units
	var sc: Dictionary = ticket.scope; var out: Array = []
	if not powered: return out
	match str(sc.q):
		"ledI": for p in parts: if p.kind == "LED" and not smoked.has(p.uid): out.append(absf(_ipart.get(p.uid, 0.0)) * float(sc.scale))
		"vLoad": for p in parts: if p.kind == "LOAD": out.append(absf(_v.get(_key(p.pins[0]), 0.0) - _v.get(_key(p.pins[1]), 0.0)))
		"powerR":
			var tot := 0.0; var any := false
			for p in parts: if p.kind == "R" and not smoked.has(p.uid): tot += _power(p); any = true
			if any: out.append(tot)
		"vR6": for p in parts: if p.kind == "R" and is_equal_approx(float(p.value), 6.0) and not smoked.has(p.uid): out.append(absf(_v.get(_key(p.pins[0]), 0.0) - _v.get(_key(p.pins[1]), 0.0)))
	return out

func scope_value() -> float:
	var v := values(); return 0.0 if v.is_empty() else float(v[0])

func in_band() -> bool:
	var v := values()
	if v.is_empty() or not ratings_ok(): return false
	var sc: Dictionary = ticket.scope
	if str(sc.q) == "ledI" and ticket.id == "1-2" and v.size() < 3: return false
	for x in v: if x < float(sc.lo) or x > float(sc.hi): return false
	return true

func hot_k() -> float:
	var k := 0.0
	for p in parts: k = maxf(k, clampf((float(temps.get(p.uid, AMBIENT)) - 45.0) / 110.0, 0.0, 1.0))
	return 1.0 if not smoked.is_empty() else k

func led_current(uid: String) -> float: return absf(_ipart.get(uid, 0.0))

## ------------------------------------------------------------------------------------------------------------------ DMM and conditions

func dmm() -> Dictionary:
	if dial == "OFF": return {"text": "", "unit": "", "mode": "OFF"}
	var r = probes.red; var b = probes.black
	if r == null or b == null: return {"text": "----", "unit": "V" if dial == "V" else "mA", "mode": dial}
	if dial == "V":
		var v: float = _v.get(_key(r), 0.0) - _v.get(_key(b), 0.0)
		return {"text": _fmt(v, 3), "unit": "V", "mode": dial}
	var rk := _key(r); var bk := _key(b)   # mA: the current of a part whose two pins the probes bridge
	for p in parts:
		var pk: Array = p.pins.map(func(q): return _key(q))
		if pk.size() == 2 and ((pk[0] == rk and pk[1] == bk) or (pk[0] == bk and pk[1] == rk)):
			var i: float = _ipart.get(p.uid, 0.0) * (1.0 if pk[0] == rk else -1.0)
			return {"text": _fmt(i * 1000.0, 2), "unit": "mA", "mode": dial}
	for w in wires:
		if (_key(w.a) == rk and _key(w.b) == bk) or (_key(w.a) == bk and _key(w.b) == rk):
			return {"text": _fmt(_iwire.get(w.wid, 0.0) * 1000.0 * (1.0 if _key(w.a) == rk else -1.0), 2), "unit": "mA", "mode": dial}
	return {"text": "0.00", "unit": "mA", "mode": dial}

static func _fmt(x: float, d: int) -> String: return ("%." + str(d) + "f") % x

func cond(id: String) -> bool:
	var leds := parts.filter(func(p): return p.kind == "LED")
	var rs := parts.filter(func(p): return p.kind == "R")
	match id:
		"led_placed": return not leds.is_empty()
		"leds3": return leds.size() >= 3
		"r_placed": return not rs.is_empty()
		"powered": return powered
		"smoked": return not smoked.is_empty()
		"clean": return smoked.is_empty()
		"lit": return powered and (leds.any(func(p): return led_current(p.uid) > 0.002) or ticket.scope.q != "ledI")
		"dmm_used": return dmm_used
		"dmm_loaded": return dmm_loaded
		"locked": return locked
		"wired": return wires.size() >= 2
		"built": return wires.size() >= 4 and rs.size() >= 3 and parts.any(func(p): return p.kind == "BAT")
		"r_in_loop": return not rs.is_empty() and smoked.is_empty() and wires.size() >= 2
	return false

## ------------------------------------------------------------------------------------------------------------------ view model

func _refresh() -> void:
	if _dirty: _solve()
	var bd := {"w": ticket.board.w, "h": ticket.board.h, "connectors": ticket.board.connectors, "probes": [], "parts": [], "wires": []}
	for p in parts:
		var d := {"uid": p.uid, "partId": p.partId, "value": p.value, "label": p.label, "x": p.x, "y": p.y, "rot": p.rot, "flip": false, "fixed": p.fixed, "kind": p.kind, "pins": p.pins}
		bd.parts.append(d)
	for w in wires: bd.wires.append({"wid": w.wid, "path": w.path})
	var sets := {}
	for k in _v:
		var vk := snappedf(float(_v[k]), 0.0005)
		var key := "%f" % vk
		if not sets.has(key): sets[key] = {"v": vk, "pads": []}
		var xy: PackedStringArray = k.split(",")
		sets[key].pads.append([int(xy[0]), int(xy[1])])
	var hi := float(ticket.supply.emf)
	var raw := {"board": bd, "nodes": {"sets": sets.values(), "range": [-maxf(hi, 1.0), maxf(hi, 1.0)]},
		"currents": {"wires": _iwire.duplicate(), "parts": _ipart.duplicate()},
		"thermal": {"ambient": AMBIENT, "temps": temps.duplicate(), "smoked": smoked.keys()},
		"ratings": {}, "liveStatus": {"powered": powered, "status": "ok", "t": t}}
	for p in parts:
		if p.kind == "R": raw.ratings[p.uid] = {"p": _power(p) / rating_w(p)}
		elif p.kind == "LED": raw.ratings[p.uid] = {"i": absf(_ipart.get(p.uid, 0.0)) / LED_IMAX}
	model = NodeApi.normalise(raw)
