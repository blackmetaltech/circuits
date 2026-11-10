# GATE-A SPIKE: delete after Gate A (BUILD-PLAN GA-2)
class_name SpikeScope
extends CanvasLayer
## Live-frame round trip spike: requests `spikeFrame(k)` from the engine at 30 Hz through the shell's bridge, draws CH1 (out) and CH2 (inp)
## as phosphor traces, and prints timing stats. Settings: env CB_SPIKE / CB_SPIKE_K / CB_SPIKE_SECS / CB_SPIKE_THREAD, or the file
## user://spike.cfg ("scope=1", "k=333", "secs=60", "thread=0": one key=value per line). Env wins over the file.
## thread=0 (default): the request blocks the main thread exactly as the shell's bridge does (round trip shows up in render frame time).
## thread=1: the same request runs on a worker thread, so the render loop never waits for the engine.

const REQ_HZ := 30.0
const WIN := 600
var app: CbApp
var k := 333
var secs := 0.0
var threaded := false
var _t0 := 0.0
var _next_req := 0.0
var _inflight := false
var _reqs := 0
var _errs := 0
var _frames := 0
var _rt: Array = []       # last WIN round trips, ms
var _eng: Array = []      # last WIN engineMs
var _ft: Array = []       # last WIN render frame times, ms
var _rt_max := 0.0
var _eng_max := 0.0
var _sol: Array = []
var _ser: Array = []
var _ft_max := 0.0
var _last_print := 0.0
var _out := PackedFloat32Array()
var _inp := PackedFloat32Array()
var _sim_t := 0.0
var _vp: SubViewport
var _mesh: MeshInstance2D
var _fade: ColorRect
var _mat: ShaderMaterial
var _fade_mat: ShaderMaterial
var _grat: Control
var _hud: Label
var _rect := Rect2()
# worker thread
var _th: Thread
var _sem := Semaphore.new()
var _mx := Mutex.new()
var _done := false
var _res = null
var _res_rt := 0.0
var _quit := false

## Reads the settings; returns null when the spike is not requested.
static func config() -> Dictionary:
	var d := {"scope": "", "k": "333", "secs": "0", "thread": "0"}
	var f := FileAccess.open("user://spike.cfg", FileAccess.READ)
	if f != null:
		for line in f.get_as_text().split("\n"):
			var s := line.strip_edges()
			if s == "" or s.begins_with("#") or s.begins_with(";") or s.begins_with("["): continue
			var kv := s.split("=", true, 1)
			if kv.size() == 2: d[kv[0].strip_edges()] = kv[1].strip_edges().trim_prefix('"').trim_suffix('"')
	var env := {"scope": "CB_SPIKE", "k": "CB_SPIKE_K", "secs": "CB_SPIKE_SECS", "thread": "CB_SPIKE_THREAD"}
	for key in env:
		if OS.get_environment(env[key]) != "": d[key] = OS.get_environment(env[key])
	return d

static func enabled(c: Dictionary) -> bool:
	var s := str(c.get("scope", "")).to_lower()
	return s != "" and s != "0" and s != "false" and s != "off"

func setup(a: CbApp, c: Dictionary) -> void:
	app = a; layer = 50
	k = maxi(1, int(c.get("k", "333"))); secs = float(c.get("secs", "0")); threaded = int(c.get("thread", "0")) != 0
	var bg := ColorRect.new(); bg.color = Color(0.01, 0.02, 0.025); bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); add_child(bg)
	_vp = SubViewport.new(); _vp.size = _view_size(); _vp.render_target_clear_mode = SubViewport.CLEAR_MODE_ONCE
	_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS; _vp.transparent_bg = false; add_child(_vp)
	var sh: Shader = load("res://spike/phosphor.gdshader")
	_mat = ShaderMaterial.new(); _mat.shader = sh; _mat.set_shader_parameter("mode", 0)
	_fade_mat = ShaderMaterial.new(); _fade_mat.shader = sh; _fade_mat.set_shader_parameter("mode", 1)
	_fade = ColorRect.new(); _fade.size = Vector2(_vp.size); _fade.material = _fade_mat; _vp.add_child(_fade)
	_mesh = MeshInstance2D.new(); _mesh.material = _mat; _vp.add_child(_mesh)
	var tr := TextureRect.new(); tr.texture = _vp.get_texture(); tr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tr.stretch_mode = TextureRect.STRETCH_SCALE; tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; add_child(tr)
	_grat = Control.new(); _grat.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); _grat.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_grat.draw.connect(_draw_graticule); add_child(_grat)
	_hud = Label.new(); _hud.position = Vector2(30, 6); _hud.add_theme_font_size_override("font_size", 22)
	_hud.add_theme_color_override("font_color", Color(0.6, 0.75, 0.7)); add_child(_hud)
	_layout()
	get_window().size_changed.connect(_layout)
	_t0 = Time.get_ticks_msec() / 1000.0
	print("SPIKE start k=%d secs=%s thread=%s view=%s" % [k, str(secs), str(threaded), str(_view_size())])
	var r: Dictionary = app.b._req({"fn": "q", "name": "spikeBench", "args": []})
	if r.get("ok", false): print("SPIKEBENCH ", JSON.stringify(r.get("result")))
	else: print("SPIKEBENCH ", JSON.stringify({"error": str(r.get("error", "?"))}))
	if threaded:
		_th = Thread.new(); _th.start(_worker)
	_t0 = Time.get_ticks_msec() / 1000.0

func _view_size() -> Vector2i:
	var s := get_window().size
	return Vector2i(maxi(s.x, 64), maxi(s.y, 64))

func _layout() -> void:
	var s := _view_size()
	if _vp.size != s:
		_vp.size = s; _vp.render_target_clear_mode = SubViewport.CLEAR_MODE_ONCE
	_fade.size = Vector2(s)
	_rect = Rect2(Vector2(s) * Vector2(0.03, 0.06), Vector2(s) * Vector2(0.94, 0.88))
	_grat.queue_redraw()
	_rebuild()

func _draw_graticule() -> void:
	var r := _rect; var col := Color(0.25, 0.4, 0.35, 0.45); var fine := Color(0.25, 0.4, 0.35, 0.22)
	var scale := Vector2(_grat.size) / Vector2(_vp.size)
	r = Rect2(r.position * scale, r.size * scale)
	for i in range(11):
		var x := r.position.x + r.size.x * i / 10.0
		_grat.draw_line(Vector2(x, r.position.y), Vector2(x, r.end.y), col if i % 5 == 0 or i == 0 or i == 10 else fine, 1.5 if i % 5 == 0 else 1.0)
	for j in range(9):
		var y := r.position.y + r.size.y * j / 8.0
		_grat.draw_line(Vector2(r.position.x, y), Vector2(r.end.x, y), col if j == 4 or j == 0 or j == 8 else fine, 1.5 if j == 4 else 1.0)
	for i in range(50):    # minor ticks on the centre axes
		var x2 := r.position.x + r.size.x * i / 50.0; var yc := r.position.y + r.size.y * 0.5
		_grat.draw_line(Vector2(x2, yc - 5), Vector2(x2, yc + 5), col, 1.0)
	_grat.draw_rect(r, Color(0.4, 0.6, 0.5, 0.7), false, 2.0)

func _worker() -> void:
	while true:
		_sem.wait()
		if _quit: return
		var t0 := Time.get_ticks_usec()
		var r: Dictionary = app.b._req({"fn": "q", "name": "spikeFrame", "args": [k]})
		var rt := (Time.get_ticks_usec() - t0) / 1000.0
		_mx.lock(); _res = r; _res_rt = rt; _done = true; _mx.unlock()

func _request() -> void:
	_inflight = true
	if threaded: _sem.post(); return
	var t0 := Time.get_ticks_usec()
	var r: Dictionary = app.b._req({"fn": "q", "name": "spikeFrame", "args": [k]})
	_got(r, (Time.get_ticks_usec() - t0) / 1000.0)

func _got(r: Dictionary, rt: float) -> void:
	_inflight = false; _reqs += 1
	var res = r.get("result", null)
	if not r.get("ok", false) or typeof(res) != TYPE_DICTIONARY: _errs += 1; return
	_push(_rt, rt); _rt_max = maxf(_rt_max, rt)
	var e := float(res.get("engineMs", 0.0)); _push(_eng, e); _eng_max = maxf(_eng_max, e)
	_push(_sol, float(res.get("solveMs", 0.0))); _push(_ser, float(res.get("serMs", 0.0)))
	_sim_t = float(res.get("t", 0.0))
	_out = PackedFloat32Array(res.get("out", [])); _inp = PackedFloat32Array(res.get("inp", []))
	_rebuild()

func _push(a: Array, v: float) -> void:
	a.append(v)
	if a.size() > WIN: a.pop_front()

func _pt(a: Array, p: float) -> float:
	if a.is_empty(): return 0.0
	var s := a.duplicate(); s.sort()
	return float(s[mini(s.size() - 1, int(p * s.size()))])

## Ribbon strip for one trace: two vertices per point, UV.y = -1 / +1 across the ribbon.
func _ribbon(vals: PackedFloat32Array, volts_per_div: float, col: Color, width: float, verts: PackedVector2Array, uvs: PackedVector2Array, cols: PackedColorArray, idx: PackedInt32Array) -> void:
	var n := vals.size()
	if n < 2: return
	var cy := _rect.position.y + _rect.size.y * 0.5; var ppd := _rect.size.y / 8.0
	var pts := PackedVector2Array(); pts.resize(n)
	for i in n: pts[i] = Vector2(_rect.position.x + _rect.size.x * i / float(n - 1), cy - vals[i] / volts_per_div * ppd)
	var base := verts.size()
	for i in n:
		var d := (pts[mini(i + 1, n - 1)] - pts[maxi(i - 1, 0)]); d = d.normalized() if d.length() > 0.0001 else Vector2.RIGHT
		var nr := Vector2(-d.y, d.x) * width * 0.5
		verts.append(pts[i] + nr); verts.append(pts[i] - nr)
		uvs.append(Vector2(0, -1)); uvs.append(Vector2(0, 1)); cols.append(col); cols.append(col)
	for i in n - 1:
		var a := base + i * 2
		idx.append_array(PackedInt32Array([a, a + 1, a + 2, a + 1, a + 3, a + 2]))

func _rebuild() -> void:
	if _mesh == null: return
	var verts := PackedVector2Array(); var uvs := PackedVector2Array(); var cols := PackedColorArray(); var idx := PackedInt32Array()
	var wpx := maxf(16.0, _rect.size.y / 45.0)
	_ribbon(_inp, 5.0, Color(0.2, 0.55, 0.45), wpx, verts, uvs, cols, idx)      # CH2, dimmer
	_ribbon(_out, 5.0, Color(0.35, 1.0, 0.4), wpx, verts, uvs, cols, idx)       # CH1, bright green phosphor
	if idx.is_empty(): return
	var arr := []; arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts; arr[Mesh.ARRAY_TEX_UV] = uvs; arr[Mesh.ARRAY_COLOR] = cols; arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new(); m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr); _mesh.mesh = m

func _process(delta: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0 - _t0
	_frames += 1
	if _frames > 2:
		var ms := delta * 1000.0; _push(_ft, ms); _ft_max = maxf(_ft_max, ms)
	var fa := 1.0 - pow(0.02, delta / 0.35)         # persistence: ~35 % of the trace left after 0.35 s * ln(.02)/ln(.5)...
	_fade_mat.set_shader_parameter("fade", fa); _mat.set_shader_parameter("gain", clampf(fa * 2.2, 0.05, 0.9))
	if threaded:
		_mx.lock(); var d := _done; var r = _res; var rt := _res_rt; _done = false; _mx.unlock()
		if d: _got(r, rt)
	if not _inflight and now >= _next_req:
		_next_req = maxf(_next_req + 1.0 / REQ_HZ, now - 1.0 / REQ_HZ)
		_request()
	if now - _last_print >= 10.0:
		_last_print = now; _print_stats(now)
	if _frames % 15 == 0 and _hud != null:
		_hud.text = "CH1 out 5 V/div   CH2 in 5 V/div   t_sim %.3f s   rt p50 %.1f ms   frame p95 %.1f ms" % [_sim_t, _pt(_rt, 0.5), _pt(_ft, 0.95)]
	if secs > 0.0 and now >= secs:
		_print_stats(now); _shutdown(); app.get_tree().quit()

func _print_stats(now: float) -> void:
	var f95 := _pt(_ft, 0.95)
	var d := {"elapsed_s": snappedf(now, 0.1), "k": k, "thread": threaded, "reqs": _reqs, "errs": _errs, "frames": _frames,
		"rt_ms": {"p50": snappedf(_pt(_rt, 0.5), 0.01), "p95": snappedf(_pt(_rt, 0.95), 0.01), "max": snappedf(_rt_max, 0.01)},
		"engine_ms": {"p50": snappedf(_pt(_eng, 0.5), 0.01), "p95": snappedf(_pt(_eng, 0.95), 0.01), "max": snappedf(_eng_max, 0.01)},
		"solve_ms": {"p50": snappedf(_pt(_sol, 0.5), 0.01), "p95": snappedf(_pt(_sol, 0.95), 0.01)},
		"ser_ms": {"p50": snappedf(_pt(_ser, 0.5), 0.01), "p95": snappedf(_pt(_ser, 0.95), 0.01)},
		"frame_ms": {"p50": snappedf(_pt(_ft, 0.5), 0.01), "p95": snappedf(f95, 0.01), "max": snappedf(_ft_max, 0.01)},
		"fps_p95": snappedf(1000.0 / f95, 0.1) if f95 > 0.0 else 0.0, "req_hz": snappedf(_reqs / maxf(now, 0.001), 0.1)}
	print("SPIKE ", JSON.stringify(d))

func _shutdown() -> void:
	if _th != null:
		_quit = true; _sem.post(); _th.wait_to_finish(); _th = null

func _exit_tree() -> void: _shutdown()
