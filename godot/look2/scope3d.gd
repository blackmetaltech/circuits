class_name Scope3D
extends Node3D
## Modern 2-channel digital bench scope, ~31 x 16 x 13 cm, real size. Faces +Z, origin on the desk under the middle.
## The screen is an 800x480 SubViewport drawn by Screen (below) from the engine's samples.

const W := 0.31
const H := 0.16
const D := 0.13
const FOOT := 0.008
const CY := FOOT + H * 0.5   ## body centre height
const Z0 := D * 0.5 + 0.002  ## front panel face
const SCREEN_C := Vector3(-0.062, CY + 0.008, Z0 + 0.0036)

var _screen: Screen
var _screen_quad: MeshInstance3D
var _probe: Node3D
var _tip := Vector3.ZERO   ## probe tip in the probe node's frame
var _powered := true

class Screen extends Control:
	const GX0 := 20.0
	const GY0 := 40.0
	const DIVW := 76.0
	const DIVH := 48.0
	var samples: Array = []
	var dt := 78e-6
	var vdiv := 5.0
	var tdiv := 0.002
	var band_lo := 0.0
	var band_hi := 0.0
	var band_on := false
	var status := "RUN"
	var lines: Array = []
	var powered := true
	var cap := false
	var cap_peak := 0.0
	var cap_limit := 0.0
	var cap_t := 0.0
	var _mono: Font
	var _ui: Font

	func _init() -> void:
		_mono = load(Instruments3D.FONT_MONO); _ui = load(Instruments3D.FONT_UI)

	func _gy() -> float: return GY0 + 6.0 * DIVH   ## ground level: 2 divisions above the bottom

	func _vy(v: float) -> float: return clampf(_gy() - v / vdiv * DIVH, GY0 - 2.0, GY0 + 8.0 * DIVH + 2.0)

	static func _fmt_t(t: float) -> String:
		if t >= 1.0: return "%.2f s/div" % t
		if t >= 1e-3: return "%.2f ms/div" % (t * 1e3)
		return "%.2f us/div" % (t * 1e6)

	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.012, 0.014, 0.016))
		if not powered: return
		# graticule: a faint blue-grey 10x8 grid with sub-ticks on the centre axes
		draw_rect(Rect2(GX0, GY0, 10 * DIVW, 8 * DIVH), Color(0.03, 0.04, 0.045))
		var gc := Color(0.30, 0.34, 0.37, 0.42)
		for i in 11:
			draw_line(Vector2(GX0 + i * DIVW, GY0), Vector2(GX0 + i * DIVW, GY0 + 8 * DIVH), Color(0.42, 0.46, 0.5, 0.7) if i == 5 else gc, 1.0)
		for j in 9:
			draw_line(Vector2(GX0, GY0 + j * DIVH), Vector2(GX0 + 10 * DIVW, GY0 + j * DIVH), Color(0.42, 0.46, 0.5, 0.7) if j == 4 else gc, 1.0)
		var tc := Color(0.55, 0.6, 0.64, 0.8)
		for i in 50:
			var x := GX0 + i * DIVW / 5.0
			draw_line(Vector2(x, GY0 + 4 * DIVH - 4), Vector2(x, GY0 + 4 * DIVH + 4), tc, 1.0)
		for j in 40:
			var y := GY0 + j * DIVH / 5.0
			draw_line(Vector2(GX0 + 5 * DIVW - 4, y), Vector2(GX0 + 5 * DIVW + 4, y), tc, 1.0)
		draw_rect(Rect2(GX0, GY0, 10 * DIVW, 8 * DIVH), Color(0.5, 0.55, 0.6, 0.8), false, 1.5)
		# target band
		if band_on:
			var ya := _vy(band_hi); var yb := _vy(band_lo)
			draw_rect(Rect2(GX0, ya, 10 * DIVW, yb - ya), Color(1.0, 0.68, 0.08, 0.17))
			draw_line(Vector2(GX0, ya), Vector2(GX0 + 10 * DIVW, ya), Color(1.0, 0.7, 0.1, 0.55), 1.5)
			draw_line(Vector2(GX0, yb), Vector2(GX0 + 10 * DIVW, yb), Color(1.0, 0.7, 0.1, 0.55), 1.5)
		# trace
		var pts := PackedVector2Array()
		for i in samples.size():
			var x := GX0 + float(i) * dt / tdiv * DIVW
			if x > GX0 + 10 * DIVW: break
			pts.append(Vector2(x, _vy(float(samples[i]))))
		if pts.size() > 1:
			var yel := Color(1.0, 0.87, 0.14)
			draw_polyline(pts, Color(yel.r, yel.g, yel.b, 0.10), 9.0, true)
			draw_polyline(pts, Color(yel.r, yel.g, yel.b, 0.24), 5.0, true)
			draw_polyline(pts, yel, 1.8, true)
		# ground marker
		var gy := _gy()
		draw_colored_polygon(PackedVector2Array([Vector2(GX0 - 16, gy - 7), Vector2(GX0 - 3, gy), Vector2(GX0 - 16, gy + 7)]), Color(1.0, 0.87, 0.14))
		draw_string(_mono, Vector2(GX0 - 14, gy + 5), "1", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.05, 0.05, 0.05))
		# off-scale capture
		if cap:
			var x := GX0 + cap_t * 10 * DIVW
			var red := Color(1.0, 0.2, 0.15)
			draw_line(Vector2(x, gy), Vector2(x, GY0 + 22), Color(red.r, red.g, red.b, 0.25), 9.0, true)
			draw_line(Vector2(x, gy), Vector2(x, GY0 + 22), Color(red.r, red.g, red.b, 0.5), 5.0, true)
			draw_line(Vector2(x, gy), Vector2(x, GY0 + 22), Color(1.0, 0.45, 0.38), 2.0, true)
			draw_colored_polygon(PackedVector2Array([Vector2(x, GY0 + 2), Vector2(x - 11, GY0 + 24), Vector2(x + 11, GY0 + 24)]), red)
			var txt := "%d V peak (off scale)   Vceo %d V" % [int(round(cap_peak)), int(round(cap_limit))]
			var tw := _mono.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 19).x
			var tx := x + 18 if x + 18 + tw < GX0 + 10 * DIVW - 4 else x - 18 - tw
			draw_string(_mono, Vector2(tx + 1, GY0 + 36), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 19, Color(0, 0, 0, 0.8))
			draw_string(_mono, Vector2(tx, GY0 + 35), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 19, Color(1.0, 0.32, 0.26))
		# top status bar
		draw_rect(Rect2(0, 0, 800, 31), Color(0.055, 0.065, 0.075))
		draw_line(Vector2(0, 31), Vector2(800, 31), Color(0.25, 0.28, 0.3), 1.0)
		var stopped := status.begins_with("STOP")
		var badge := Color(0.78, 0.16, 0.13) if stopped else (Color(0.16, 0.62, 0.28) if status.begins_with("RUN") else Color(0.85, 0.6, 0.12))
		var sw := _mono.get_string_size(status, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		draw_rect(Rect2(8, 5, sw + 16, 21), badge)
		draw_string(_mono, Vector2(16, 21), status, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.97, 0.97, 0.97))
		draw_string(_mono, Vector2(0, 21), _fmt_t(tdiv), HORIZONTAL_ALIGNMENT_CENTER, 800, 16, Color(0.82, 0.86, 0.88))
		draw_rect(Rect2(574, 5, 218, 21), Color(0.19, 0.17, 0.05))
		draw_string(_mono, Vector2(582, 21), "CH1 %.2f V/div" % vdiv, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.87, 0.14))
		# bottom measurement strip
		draw_rect(Rect2(0, 430, 800, 50), Color(0.055, 0.065, 0.075))
		draw_line(Vector2(0, 430), Vector2(800, 430), Color(0.25, 0.28, 0.3), 1.0)
		for i in mini(lines.size(), 4):
			var cx := 14.0 + i * 196.0
			draw_string(_mono, Vector2(cx, 462), str(lines[i]), HORIZONTAL_ALIGNMENT_LEFT, 190, 17, Color(0.96, 0.9, 0.55) if i % 2 == 0 else Color(0.8, 0.9, 0.95))

func _init() -> void:
	var body := MeshKit.mat(Color(0.115, 0.12, 0.128), 0.5, 0.0, {"normal": 0.12})
	MeshKit.add(self, MeshKit.rounded_box(Vector3(W, H, D), 0.007, 3), body, Vector3(0, CY, 0))
	# rear shell step and top vent slots: a slightly smaller darker block makes the back read as a real case
	MeshKit.add(self, MeshKit.rounded_box(Vector3(W - 0.02, H - 0.02, 0.03), 0.006, 2), MeshKit.m("black_plastic"), Vector3(0, CY, -D * 0.5 - 0.008))
	for i in 9:
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.018, 0.0012, 0.0022), 0.0005, 1), MeshKit.m("black_plastic"), Vector3(-0.115 + i * 0.0285, CY + H * 0.5 + 0.0, -0.01))
	# dark anodised front plate
	MeshKit.add(self, MeshKit.rounded_box(Vector3(W - 0.006, H - 0.006, 0.004), 0.003, 2), MeshKit.m("anodised"), Vector3(0, CY, D * 0.5))
	# feet
	for fx in [-0.125, 0.125]:
		for fz in [-0.04, 0.04]:
			MeshKit.add(self, MeshKit.rounded_box(Vector3(0.032, FOOT, 0.022), 0.003, 2), MeshKit.m("rubber"), Vector3(fx, FOOT * 0.5, fz))
	# screen: bezel, emissive quad, glass
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.168, 0.106, 0.0026), 0.0035, 2), MeshKit.m("black_epoxy"), Vector3(SCREEN_C.x, SCREEN_C.y, Z0 + 0.0008))
	var scr := Screen.new()
	_screen = scr
	_screen_quad = Instruments3D.screen_quad(self, scr, Vector2i(800, 480), Vector2(0.15, 0.09), SCREEN_C, 1.5, true)
	MeshKit.label(self, "7\" DIGITAL", 0.00007, Vector3(SCREEN_C.x - 0.062, SCREEN_C.y - 0.0605, Z0 + 0.0001), Color(0.55, 0.57, 0.6), false, Vector3.ZERO)
	_build_controls()
	_build_probe()
	set_samples([], 78e-6, 5.0, 0.002)

func _build_controls() -> void:
	var knob_body := MeshKit.m("anodised")
	var cap := MeshKit.mat(Color(0.18, 0.19, 0.2), 0.3, 0.9, {"normal": 0.0, "rough_tex": false})
	var kx := [0.053, 0.091, 0.129]
	var klab := ["VERT", "HORIZ", "TRIG"]
	for i in 3:
		Instruments3D.knob(self, Vector3(kx[i], CY + 0.043, Z0), 0.0105, 0.015, knob_body, cap)
		MeshKit.label(self, klab[i], 0.00007, Vector3(kx[i], CY + 0.043 + 0.0175, Z0 + 0.0001), Color(0.62, 0.64, 0.66), false, Vector3.ZERO)
	# button grid: two rows of four, plus a larger RUN/STOP
	var bm := MeshKit.mat(Color(0.05, 0.052, 0.056), 0.5, 0.0, {"normal": 0.0})
	var names := ["MEAS", "CURS", "ACQ", "MENU", "AUTO", "SINGLE", "MATH", "DISP"]
	for i in 8:
		var bx := 0.047 + float(i % 4) * 0.0215; var by := CY + 0.006 - float(i / 4) * 0.021
		MeshKit.add(self, MeshKit.rounded_box(Vector3(0.0165, 0.0095, 0.004), 0.0018, 2), bm, Vector3(bx, by, Z0 + 0.002))
		MeshKit.label(self, names[i], 0.000055, Vector3(bx, by - 0.0092, Z0 + 0.0001), Color(0.55, 0.57, 0.6), false, Vector3.ZERO)
	var run_m := MeshKit.mat(Color(0.08, 0.3, 0.13), 0.45, 0.0, {"emission": Color(0.1, 0.8, 0.25), "emission_energy": 0.35, "normal": 0.0})
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.022, 0.0135, 0.005), 0.0022, 2), run_m, Vector3(0.1335, CY + 0.006, Z0 + 0.0025))
	MeshKit.label(self, "RUN/STOP", 0.000055, Vector3(0.1335, CY + 0.006 - 0.0105, Z0 + 0.0001), Color(0.6, 0.62, 0.64), false, Vector3.ZERO)
	Instruments3D.hit(self, "scope_run", Vector3(0.026, 0.017, 0.012), Vector3(0.1335, CY + 0.006, Z0 + 0.004))
	# BNC inputs
	for k in 2:
		var bx := 0.070 + float(k) * 0.036; var by := CY - 0.052
		var p := Vector3(bx, by, Z0)
		Instruments3D.cyl(self, 0.0085, 0.012, Instruments3D.plain(Color(0.62, 0.63, 0.64), 0.3), p + Vector3(0, 0, 0.006), Vector3(PI / 2, 0, 0))
		Instruments3D.cyl(self, 0.0062, 0.0128, Instruments3D.plain(Color(0.03, 0.03, 0.032), 0.5, 0.0), p + Vector3(0, 0, 0.0064), Vector3(PI / 2, 0, 0))
		Instruments3D.cyl(self, 0.0013, 0.0135, Instruments3D.plain(Color(1.0, 0.78, 0.38), 0.25), p + Vector3(0, 0, 0.0068), Vector3(PI / 2, 0, 0), 12)
		for sx in [-1, 1]:
			Instruments3D.cyl(self, 0.0011, 0.004, Instruments3D.plain(Color(0.62, 0.63, 0.64), 0.3), p + Vector3(sx * 0.0085, 0, 0.007), Vector3(0, 0, PI / 2), 8)
		MeshKit.label(self, "CH%d" % (k + 1), 0.00007, Vector3(bx, by + 0.0125, Z0 + 0.0001), Color(1.0, 0.87, 0.2) if k == 0 else Color(0.3, 0.8, 0.95), false, Vector3.ZERO)
	MeshKit.label(self, "1MΩ 16pF", 0.00005, Vector3(0.088, CY - 0.0705, Z0 + 0.0001), Color(0.5, 0.52, 0.55), false, Vector3.ZERO)

func _build_probe() -> void:
	_probe = Node3D.new(); _probe.position = Vector3(0.015, 0.0085, 0.175); _probe.rotation.y = 0.12; add_child(_probe)
	var grey := MeshKit.mat(Color(0.2, 0.21, 0.23), 0.5, 0.0, {"normal": 0.1})
	var dark := MeshKit.mat(Color(0.07, 0.07, 0.08), 0.6)
	Instruments3D.cyl(_probe, 0.0085, 0.085, grey, Vector3(0.0, 0, 0), Vector3(0, 0, PI / 2), 28)
	Instruments3D.cyl(_probe, 0.0058, 0.035, dark, Vector3(-0.058, 0, 0), Vector3(0, 0, PI / 2), 24)
	Instruments3D.cyl(_probe, 0.0089, 0.006, dark, Vector3(0.0, 0, 0), Vector3(0, 0, PI / 2), 28)
	Instruments3D.cyl(_probe, 0.0045, 0.012, dark, Vector3(0.0495, 0, 0), Vector3(0, 0, PI / 2), 20)
	Instruments3D.cyl(_probe, 0.0022, 0.02, MeshKit.m("steel"), Vector3(-0.085, 0, 0), Vector3(0, 0, PI / 2), 12)
	var hook := PackedVector3Array([Vector3(-0.094, 0, 0), Vector3(-0.1, 0.0015, 0), Vector3(-0.1055, 0.006, 0), Vector3(-0.103, 0.011, 0), Vector3(-0.0965, 0.0105, 0)])
	MeshKit.add(_probe, MeshKit.tube(MeshKit.round_corners(hook, 0.003, 3), 0.0009, 8), Instruments3D.plain(Color(0.62, 0.63, 0.64), 0.3))
	_tip = Vector3(-0.0965, 0.0105, 0)
	# ground lead + clip
	var gl := PackedVector3Array([Vector3(-0.04, -0.004, 0.006), Vector3(-0.045, -0.0075, 0.02), Vector3(-0.07, -0.0076, 0.04), Vector3(-0.10, -0.0076, 0.055)])
	MeshKit.add(_probe, MeshKit.tube(MeshKit.round_corners(gl, 0.01, 4), 0.0009, 8), dark)
	var clip := Node3D.new(); clip.position = Vector3(-0.115, -0.0045, 0.06); clip.rotation.y = 0.35; _probe.add_child(clip)
	MeshKit.add(clip, MeshKit.rounded_box(Vector3(0.026, 0.006, 0.011), 0.0025, 2), dark, Vector3(-0.002, 0, 0))
	MeshKit.add(clip, MeshKit.rounded_box(Vector3(0.016, 0.0016, 0.007), 0.0007, 1), MeshKit.m("steel"), Vector3(-0.0135, 0.0032, 0))
	MeshKit.add(clip, MeshKit.rounded_box(Vector3(0.016, 0.0016, 0.007), 0.0007, 1), MeshKit.m("steel"), Vector3(-0.0135, -0.0004, 0))
	# cable to CH1
	var bnc := Vector3(0.070, CY - 0.052, Z0 + 0.0128)
	var rear_w := _probe.position + _probe.transform.basis * Vector3(0.055, 0, 0)
	var cp := PackedVector3Array([bnc, bnc + Vector3(0, -0.004, 0.012), Vector3(0.085, 0.045, 0.1), Vector3(0.1, 0.010, 0.125), Vector3(0.105, 0.0035, 0.15), Vector3(0.1, 0.0035, 0.19), rear_w + Vector3(0.025, -0.005, 0.01), rear_w])
	MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(cp, 0.025, 6), 0.0017, 8), MeshKit.mat(Color(0.05, 0.05, 0.055), 0.6, 0.0, {"normal": 0.0, "rough_tex": false}))
	Instruments3D.hit(_probe, "scope_probe", Vector3(0.12, 0.03, 0.035), Vector3(-0.04, 0.005, 0.02))

## World position of the hook tip of the parked probe.
func probe_tip_world() -> Vector3:
	return _probe.to_global(_tip)

func set_samples(v: Array, dt: float, vdiv: float, tdiv: float) -> void:
	_screen.samples = v; _screen.dt = dt; _screen.vdiv = vdiv; _screen.tdiv = tdiv; _screen.queue_redraw()

func set_band(lo: float, hi: float, visible: bool) -> void:
	_screen.band_lo = lo; _screen.band_hi = hi; _screen.band_on = visible; _screen.queue_redraw()

func set_status(text: String) -> void:
	_screen.status = text; _screen.queue_redraw()

func set_measure(lines: Array) -> void:
	_screen.lines = lines; _screen.queue_redraw()

func set_powered(on: bool) -> void:
	_powered = on; _screen.powered = on; _screen.queue_redraw()
	(_screen_quad.material_override as StandardMaterial3D).emission_energy_multiplier = 1.5 if on else 0.0

## Freeze on a single capture: a red spike at x = t_frac rising off the top, labelled with the peak and the part's limit.
func show_capture(peak_v: float, limit_v: float, t_frac: float) -> void:
	_screen.cap = true; _screen.cap_peak = peak_v; _screen.cap_limit = limit_v; _screen.cap_t = clampf(t_frac, 0.0, 1.0)
	_screen.status = "STOP  SINGLE"; _screen.queue_redraw()

func clear_capture() -> void:
	_screen.cap = false; _screen.status = "RUN"; _screen.queue_redraw()
