class_name Wire3D
extends Node3D
## LOOK2 jumper wire from the engine's Manhattan pad path: solid-core PVC insulated wire running just above the board with rounded
## bends, stripped tinned ends that dip into the end pads, and a solder fillet on each end. Fixed (ticket) wires are bare tinned bus wire.

const P := MeshKit.PITCH
const COLS := [Color(0.62, 0.07, 0.05), Color(0.04, 0.04, 0.045), Color(0.85, 0.66, 0.08), Color(0.08, 0.22, 0.55), Color(0.08, 0.42, 0.18), Color(0.85, 0.85, 0.82)]

var wid := ""
var _mi: MeshInstance3D
var _path_pts := PackedVector3Array()   ## the wire's centre line, for the Cute-mode current beads
var _cum: Array[float] = []
var _beads: Array[MeshInstance3D] = []
var _phase := 0.0
const BEAD_GAP := 3.0 * P                ## one bead every three pads
var _mat: StandardMaterial3D

static func palette(i: int) -> Color: return COLS[posmod(i, COLS.size())]

func build(path: Array, color: Color, fixed: bool, board: Board3D, lift := 0.0) -> void:
	for c in get_children(): c.queue_free()
	if path.size() < 2: return
	var y := 0.0016 + lift
	var pts := PackedVector3Array()
	for i in path.size():
		var q := board.pad_local(int(path[i][0]), int(path[i][1]))
		pts.append(q + Vector3(0, y, 0))
	# soft arc on long runs (slack): lift the middle of each long straight segment a little
	var soft := PackedVector3Array(); soft.append(pts[0])
	for i in range(1, pts.size()):
		var a := pts[i - 1]; var b := pts[i]
		var L := a.distance_to(b)
		if L > 6 * P and not fixed:
			for k in range(1, 6):
				var t := float(k) / 6.0
				soft.append(a.lerp(b, t) + Vector3(0, sin(t * PI) * minf(L * 0.04, 0.0022), 0))
		soft.append(b)
	var body := MeshKit.round_corners(soft, 0.0022, 4)
	var r := 0.0004 if fixed else 0.0007
	if fixed:
		_mat = MeshKit.m("tin")
	else:
		_mat = MeshKit.mat(color, 0.42, 0.0, {"clearcoat": 0.25, "normal": 0.1})
	# insulation stops short of the ends; tinned conductor dips into the pads
	var ins := body
	if not fixed and body.size() >= 2:
		ins = body.duplicate()
		ins[0] = body[0].move_toward(body[1], 0.0016)
		ins[ins.size() - 1] = body[body.size() - 1].move_toward(body[body.size() - 2], 0.0016)
	_mi = MeshKit.add(self, MeshKit.tube(ins, r, 10), _mat)
	_path_pts = body; _cum = [0.0]
	for i in range(1, body.size()): _cum.append(_cum[i - 1] + body[i - 1].distance_to(body[i]))
	_beads.clear()
	for e in [0, path.size() - 1]:
		var top := pts[e]
		var bot := top - Vector3(0, y + MeshKit.BOARD_T, 0)
		var into := top.move_toward(pts[1] if e == 0 else pts[e - 1], 0.0016)
		MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(PackedVector3Array([into, top, bot]), 0.0008, 3), 0.00035, 6), MeshKit.m("tin"))
		var fillet := CylinderMesh.new(); fillet.top_radius = 0.0004; fillet.bottom_radius = 0.0016; fillet.height = 0.0009; fillet.radial_segments = 14
		MeshKit.add(self, fillet, MeshKit.m("solder"), Vector3(top.x, 0.00045, top.z))

func set_highlight(on: bool) -> void:
	if _mi == null: return
	if on:
		var h: StandardMaterial3D = _mat.duplicate(); h.emission_enabled = true; h.emission = Color(0.91, 0.64, 0.24); h.emission_energy_multiplier = 0.6
		_mi.material_override = h
	else: _mi.material_override = _mat

## Cute mode (phase C, D-cute-bench): amber beads ride the wire at the engine's own dot speed (pads/s, `liveFrame` wires[].speed),
## in the direction of conventional current (the sign of i, path start to end). No current, no beads: a dead wire looks dead.
func set_flow(amps: float, speed_pads: float, dt: float, on: bool) -> void:
	var live := on and absf(amps) > 1e-9 and _cum.size() >= 2
	if not live:
		for b in _beads: b.visible = false
		return
	var total: float = _cum[_cum.size() - 1]
	var n := maxi(1, int(total / BEAD_GAP))
	if _beads.size() != n:
		for b in _beads: b.queue_free()
		_beads.clear()
		var sm := SphereMesh.new(); sm.radius = 0.0013; sm.height = 0.0026; sm.radial_segments = 10; sm.rings = 5
		var bm := MeshKit.mat(Color(1.0, 0.80, 0.30), 0.4, 0.0, {"emission": Color(1.0, 0.70, 0.20), "emission_energy": 1.2, "normal": 0.0, "rough_tex": false})
		for i in n: _beads.append(MeshKit.add(self, sm, bm, Vector3.ZERO))
	_phase = fposmod(_phase + signf(amps) * speed_pads * P * dt, BEAD_GAP)
	for i in n:
		var d := fposmod(_phase + i * total / n, total)
		_beads[i].position = _at(d) + Vector3(0, 0.0008, 0); _beads[i].visible = true

func _at(d: float) -> Vector3:
	for i in range(1, _cum.size()):
		if d <= _cum[i]:
			var seg: float = maxf(_cum[i] - _cum[i - 1], 1e-9)
			return _path_pts[i - 1].lerp(_path_pts[i], (d - _cum[i - 1]) / seg)
	return _path_pts[_path_pts.size() - 1]
