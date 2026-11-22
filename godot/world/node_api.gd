class_name NodeApi
extends RefCounted
## Thin adapter between the engine's board/queries (DESIGN §8.3 / §8.5) and the bench view's view model.
## Nothing else in godot/world/ touches raw query results, so when the engine's exact signatures land only this file changes.
##
## EXPECTED QUERY RESULTS (plain JSON, SI units; every one is optional and a missing one reads as "nothing to show"):
##
##   board        {w, h, connectors:[{id, pad:[x,y], role}], parts:[Part], wires:[{wid, path:[[x,y],…]}],
##                 probes:[{ch:1|2, pad:[x,y]}]}                                  (DESIGN §8.3; src/sim/board/types.ts)
##     Part       {uid, partId, value:number|null, variant, x, y, rot:0..3, flip, fixed?, pos?,
##                 kind?  (catalogue PartKind: 'R','C','CE','D','LED','NPN','PNP','XFMR','MISC'… derived from partId when absent),
##                 label? (text for the part: "9 V", "1N4007"; derived from the catalogue/partId when absent),
##                 pins?  (absolute pads [[x,y],…] in PartDef.pins order; derived from the footprint table below when absent),
##                 pinNames? ([String]) , on? (switches)}
##   nodes        {sets:[{v:volts, pads:[[x,y],…], ac?:amplitude volts}], range?:[lo, hi]}   (voltage per pad set; range = ticket supply range)
##   currents     {wires:{wid: amps}, parts:{uid: amps}, ac?:[wid|uid,…]}           sign: + = path[0] -> path[last] (wires) / pin 1 -> pin 2 (parts)
##   thermal      {ambient?:°C, temps:{uid: °C}, smoked?:[uid]}
##   ratings      {uid: {p?, i?, v?}}                                               ratios 0..1+ (P/Prated, I/Imax, V/Vmax)
##   liveStatus   {powered, status:'ok'|'float'|'noconv'|'loop', t?, frame?, smoked?:[uid]}
##
## A fixture file (godot/world/fixtures/*.json) is simply {"board":…, "nodes":…, "currents":…, "thermal":…, "ratings":…, "liveStatus":…}.

const QUERIES := ["board", "nodes", "currents", "thermal", "ratings", "liveStatus"]

## Mirror of src/sim/board/footprints.ts (pitch units, before rotation / flip).
const FOOTPRINTS := {
	"axial2": [[0, 0], [4, 0]], "radial2": [[0, 0], [2, 0]], "to92": [[0, 0], [1, 0], [2, 0]], "to220": [[0, 0], [2, 0], [4, 0]],
	"dip8": [[0, 0], [0, 1], [0, 2], [0, 3], [3, 3], [3, 2], [3, 1], [3, 0]], "pot3": [[0, 0], [2, 0], [4, 0]],
	"xfmr4": [[0, 0], [0, 4], [4, 0], [4, 4]], "relay5": [[0, 0], [0, 4], [4, 0], [4, 2], [4, 4]], "block2": [[0, 0], [6, 0]],
	"slide3": [[0, 0], [10, -2], [20, 0]],
}
## partId prefix -> [kind, footprint]. First match wins. Only used when the board JSON lacks `kind` / `pins`.
const PART_TABLE := [
	["led-strip", "LOAD", "block2"], ["amp-load", "LOAD", "block2"], ["fan-", "MOTOR", "block2"], ["irlz", "NMOS", "to220"], ["irf", "NMOS", "to220"], ["2n7000", "NMOS", "to92"], ["npn-", "NPN", "to92"],
	["cap-charged", "C", "block2"], ["cap-ideal", "C", "axial2"],
	["res-", "R", "axial2"], ["pot-", "POT", "pot3"], ["led-", "LED", "radial2"], ["cap-el", "CE", "radial2"], ["cap-", "C", "axial2"],
	["1n", "D", "axial2"], ["bzx", "D", "axial2"], ["bridge", "BRIDGE", ""], ["xfmr", "XFMR", "xfmr4"], ["2n3906", "PNP", "to92"],
	["2n", "NPN", "to92"], ["bc", "NPN", "to92"], ["tip", "NPN", "to220"], ["bat-", "BAT", "block2"], ["sw-", "SW", ""], ["fuse", "FUSE", "block2"],
	["inst-probe", "PROBE", ""], ["lm7805", "REG", "to220"], ["lm317", "REG", "to220"], ["load-cc", "LOAD", "block2"], ["zener-", "D", "axial2"],
	["rheostat", "R", "axial2"], ["trimmer", "R", "axial2"], ["galvanometer", "GALVO", "block2"], ["slidewire", "SLIDE", "slide3"], ["blackbox", "BOXED", "block2"],
	["adc-in", "LOAD", "block2"], ["cable-loop", "LOAD", "block2"], ["pullup-", "LOAD", "block2"], ["logic-in", "LOAD", "block2"], ["relay-", "RELAY", "relay5"], ["cell-", "BAT", "block2"],
]
const BAT_LABEL := {"bat-pp3": "9 V", "bat-pp3-tired": "9 V", "bat-aa": "1.5 V", "bat-cr2032": "3 V"}

## ---------------------------------------------------------------------------------------------------------------- loading

static func load_fixture(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		var alt := "res://world/fixtures/%s.json" % path
		f = FileAccess.open(alt, FileAccess.READ)
		if f == null: return {}
	var j = JSON.parse_string(f.get_as_text())
	return normalise(j) if j is Dictionary else {}

## Pull every query the engine advertises and build the view model; {} when there is no board.
static func from_engine(bridge) -> Dictionary:
	if bridge == null: return {}
	var raw := {}
	for q in QUERIES:
		if _has_query(bridge, q):
			var r = bridge.q(q)
			if r != null: raw[q] = r
	if not raw.has("board") or not (raw.board is Dictionary): return {}
	return normalise(raw)

static func _has_query(bridge, name: String) -> bool:
	var qs = bridge.init_data.get("queries", null)
	if qs is Dictionary: return qs.has(name)
	if qs is Array:
		for e in qs:
			if e is String and e == name: return true
			if e is Dictionary and str(e.get("name", "")) == name: return true
	return false

## ---------------------------------------------------------------------------------------------------------- view model

static func _pad(a) -> Vector2: return Vector2(float(a[0]), float(a[1]))
static func key(p: Vector2) -> String: return "%d,%d" % [int(p.x), int(p.y)]

static func normalise(raw: Dictionary) -> Dictionary:
	var b: Dictionary = raw.get("board", {})
	var m := {"w": int(b.get("w", 24)), "h": int(b.get("h", 16)), "connectors": [], "parts": [], "wires": [], "probes": [],
		"volts": {}, "ac_amp": {}, "vlo": -9.0, "vhi": 9.0, "wire_i": {}, "part_i": {}, "ac": {}, "temps": {}, "smoked": {}, "ratings": {},
		"ambient": 25.0, "powered": false, "status": "ok", "t": 0.0}
	for c in b.get("connectors", []):
		m.connectors.append({"id": str(c.get("id", "")), "pad": _pad(c.pad), "role": str(c.get("role", ""))})
	for w in b.get("wires", []):
		var path: Array = []
		for a in w.get("path", []): path.append(_pad(a))
		m.wires.append({"wid": str(w.get("wid", "")), "path": path})
	for pr in b.get("probes", []):
		m.probes.append({"ch": int(pr.get("ch", 1)), "pad": _pad(pr.pad)})
	for p in b.get("parts", []): m.parts.append(_norm_part(p))
	var nd: Dictionary = raw.get("nodes", {})
	var hi := 0.0
	for s in nd.get("sets", []):
		var amp := float(s.get("ac", 0.0))
		for a in s.get("pads", []):
			var k := key(_pad(a))
			m.volts[k] = float(s.get("v", 0.0)); if amp != 0.0: m.ac_amp[k] = amp
		hi = maxf(hi, absf(float(s.get("v", 0.0))))
	var rg = nd.get("range", null)
	if rg is Array and rg.size() == 2: m.vlo = float(rg[0]); m.vhi = float(rg[1])
	else: m.vlo = -maxf(hi, 1.0); m.vhi = maxf(hi, 1.0)
	var cu: Dictionary = raw.get("currents", {})
	for k in cu.get("wires", {}): m.wire_i[str(k)] = float(cu.wires[k])
	for k in cu.get("parts", {}): m.part_i[str(k)] = float(cu.parts[k])
	for k in cu.get("ac", []): m.ac[str(k)] = true
	var th: Dictionary = raw.get("thermal", {})
	m.ambient = float(th.get("ambient", 25.0))
	for k in th.get("temps", {}): m.temps[str(k)] = float(th.temps[k])
	for u in th.get("smoked", []): m.smoked[str(u)] = true
	var rt: Dictionary = raw.get("ratings", {})
	for k in rt: m.ratings[str(k)] = rt[k]
	var ls: Dictionary = raw.get("liveStatus", {})
	m.powered = bool(ls.get("powered", false)); m.status = str(ls.get("status", "ok")); m.t = float(ls.get("t", 0.0))
	for u in ls.get("smoked", []): m.smoked[str(u)] = true
	return m

static func _norm_part(p: Dictionary) -> Dictionary:
	var pid := str(p.get("partId", ""))
	var kind := str(p.get("kind", "")); var fp := ""
	for row in PART_TABLE:
		if pid.begins_with(row[0]):
			if kind == "": kind = row[1]
			fp = row[2]; break
	if kind == "": kind = "BOX"
	var x := int(p.get("x", 0)); var y := int(p.get("y", 0)); var rot := int(p.get("rot", 0)); var flip := bool(p.get("flip", false))
	var pins: Array = []; var local_pins: Array = []
	var xf_rot := rot; var xf_flip := flip
	if p.has("pins"):
		for a in p.pins: pins.append(_pad(a))
	if fp != "" and FOOTPRINTS.has(fp):
		for o in FOOTPRINTS[fp]: local_pins.append(Vector2(o[0], o[1]))
		if pins.is_empty():
			for o in local_pins: pins.append(Vector2(x, y) + _rot_off(o, rot, flip))
	else:   # no table footprint: draw in board orientation from the absolute pins
		xf_rot = 0; xf_flip = false
		for a in pins: local_pins.append(a - Vector2(x, y))
	var val = p.get("value", null)
	var label := str(p.get("label", ""))
	if label == "" and not p.has("label"):
		if val != null: label = format_value(float(val), kind)
		elif BAT_LABEL.has(pid): label = BAT_LABEL[pid]
		else: label = pid.to_upper()
	return {"uid": str(p.get("uid", "")), "partId": pid, "kind": kind, "value": val, "label": label, "x": x, "y": y, "rot": rot, "flip": flip,
		"xf_rot": xf_rot, "xf_flip": xf_flip, "pins": pins, "local_pins": local_pins, "fixed": bool(p.get("fixed", false)),
		"pin_names": p.get("pinNames", []), "pin_labels": p.get("pin_labels", []), "on": bool(p.get("on", false)), "variant": str(p.get("variant", "")),
		"pos": p.get("pos", null), "pos_text": str(p.get("pos_text", "")), "step_text": str(p.get("step_text", ""))}

## Clockwise quarter turns on a y-down screen after an x-mirror (src/sim/board/grid.ts rotateOffset).
static func _rot_off(o: Vector2, rot: int, flip: bool) -> Vector2:
	var x := -o.x if flip else o.x; var y := o.y
	for i in rot:
		var nx := -y; y = x; x = nx
	return Vector2(x, y)

## SI-prefixed value text: 470 -> "470 Ω", 4700 -> "4.7 kΩ", 4.7e-6 -> "4.7 µF". Unit symbols are not translatable words.
static func format_value(v: float, kind: String) -> String:
	var unit := "Ω"
	match kind:
		"C", "CE": unit = "F"
		"L": unit = "H"
		"BAT": unit = "V"
	if v == 0.0: return "0 " + unit
	var pre := [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1.0, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]]
	for e in pre:
		if absf(v) >= e[0] * 0.9999:
			return "%s %s%s" % [_num(v / e[0]), e[1], unit]
	return "%s %s" % [String.num(v, 3), unit]

static func _num(x: float) -> String:
	var r := snappedf(x, 0.01)
	return str(int(r)) if is_equal_approx(r, round(r)) else String.num(r, 2)
