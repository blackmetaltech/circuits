class_name Workbench
extends Node3D
## LOOK2 vertical slice: the tech wizard's workbench in 3D on top of the unchanged engine (EngineBench drives the sidecar exactly as
## the old stall did). Jobs: ticket 5-1 Fan Driver. Free bench: the engine's sandbox mode on the same bench.
## Env: CB_L2=title|job|free (start screen), CB_L2_REF=1 (reference build), CB_L2_NODIODE=1 (reference without the flyback diode),
## CB_POWER=1, CB_METER=rx,ry,bx,by, CB_PIN=0|1|2, CB_VIEW=1..4, CB_SCHEM=1, CB_QUALITY=high|medium|low, CB_FRAMETIME=<seconds> (prints FRAMETIME and quits).

signal changed

const P := MeshKit.PITCH
const TICKET := "5-1"   ## the chapter-5 showcase slice
## The bench campaign: all five chapters in the engine's order (D-bench-ch23, D-bench-ch45). The classic stall is an option.
const BENCH_JOBS := ["1-1", "1-2", "1-3", "1-4", "1-5", "2-1", "2-2", "2-3", "2-4", "3-1", "3-2", "3-3", "3-4",
	"4-1", "4-2", "4-3", "4-4", "4-5", "5-1", "5-2", "5-3", "5-4", "5-5"]
const CH1 := BENCH_JOBS   # old name, kept for the flows
var ticket_id := "1-1"

var backend: EngineBench
var sfx: StallSfx
var pad: PadCursor
var cute := true                     ## Cute mode (D-cute-bench): current beads on live wires; on by default, C or the title toggles it
var mode := "title"                  ## title | job | free
var quality := "high"
var board: Board3D
var board_root: Node3D
var parts3d := {}                    ## uid -> Part3D
var wires3d := {}                    ## wid -> Wire3D
var contacts3d := {}                 ## contact id -> Contact3D (3-2's arcade button, 3-4's knife switch)
var _jockey_drag := false
var _jockey_tip_ms := 0
var _sig_parts := ""
var _sig_wires := ""
var scope: Node3D
var dmm: Node3D
var psu: Node3D
var mcu: Node3D
var fan: Node3D
var cam: Camera3D
var cam_attr: CameraAttributesPractical
var env: Environment
var ui: Control                      ## BenchUI
var lamp: SpotLight3D
var probe_node: Node3D
var probe_cable: MeshInstance3D
var meter_leads := {}
var cables_root: Node3D
var smoke_fx: Array = []
var capture_until := 0.0
var last_failure := {}              ## {title, text, hint} shown in the UI
var case_node: DeviceCase                ## the customer's device around the board (jobs only)
var handed := false
var tool := "select"                 ## select | place | wire | probe | red | black
var place_item: Dictionary = {}
var place_rot := 0
var ghost: Part3D
var wire_from := Vector2i(-1, -1)
var _wire_click := false              ## the wire's first end was a click (not a drag): the next click on another pad ends it
var wire_preview: MeshInstance3D
var hover_pad := Vector2i(-1, -1)
var testbed_device := ""   ## 0.5: the free bench's loaded device (Testbed.DEVICES id), "" for an open board
var testbed_paused := false
var thermal := false                 ## chapter 4's thermal camera is on (T): parts in false colour from the engine's temperatures
var _showcase := false               ## 5-1 opened from the title as the showcase (it unlocks tickets the player has not reached)
var iso_box: Node3D                  ## 4-1's isolation transformer on the bench (mains tickets only)
var note := ""
var paused := false
var _ft: Array = []
var _ft_t := 0.0

# camera rig
var tgt := Vector3.ZERO
var yaw := 0.0
var pitch := -0.9
var dist := 0.5
var g_tgt := Vector3.ZERO
var g_yaw := 0.0
var g_pitch := -0.9
var g_dist := 0.5
var view := 2
var _drag := ""
var _last_mouse := Vector2.ZERO

func _ready() -> void:
	quality = _pick_quality()
	_env()
	_room()
	_camera()
	board_root = Node3D.new(); board_root.name = "board_root"; add_child(board_root)
	cables_root = Node3D.new(); add_child(cables_root)
	_instruments()
	sort_box = SortBox.new(); add_child(sort_box); sort_box.position = SORT_BOX_AT; sort_box.rotation_degrees.y = 6.0; sort_box.visible = false
	changed.connect(_refresh_tray)
	sfx = StallSfx.new(); add_child(sfx)   # phase C: the classic stall's procedural cues, on the bench's own events (no asset files; no human has listened yet)
	sfx.enabled = OS.get_environment("CB_MUTE") == "" and _load_sound_pref()
	var cfc := ConfigFile.new(); if cfc.load("user://look2.cfg") == OK: cute = bool(cfc.get_value("look", "cute", true))
	if OS.get_environment("CB_CUTE") != "": cute = OS.get_environment("CB_CUTE") == "1"
	ui = load("res://look2/bench_ui.gd").new(); ui.bench = self
	var cl := CanvasLayer.new(); cl.add_child(ui); add_child(cl)
	pad = PadCursor.new(); pad.bench = self; cl.add_child(pad)   # phase C: the gamepad drives a cursor ring and the bench's own keys
	backend = EngineBench.new()
	# 0.6: the live simulation on a worker thread in a real window (5-1 held frames for 23-28 ms on the main thread). Headless test
	# flows step synchronously so their reads follow their steps; CB_SYNC_LIVE=1 forces the old path for comparison.
	backend.async_live = DisplayServer.get_name() != "headless" and OS.get_environment("CB_SYNC_LIVE") != "1"
	backend.event.connect(_on_event)
	set_view(2, true)
	var start := OS.get_environment("CB_L2")
	if start == "job": start_job()
	elif start == "free": start_free()
	elif start == "testbed":   # QA/shot hook: CB_TESTBED=torch|station|fan, CB_BREAK=<break id>, CB_POWER=1
		Testbed.load_device(self, OS.get_environment("CB_TESTBED") if OS.get_environment("CB_TESTBED") != "" else "torch")
		if OS.get_environment("CB_BREAK") != "": Testbed.apply_break(self, OS.get_environment("CB_BREAK"))
		if OS.get_environment("CB_PIN") != "": backend.set_selector("pin", int(OS.get_environment("CB_PIN")))
		if OS.get_environment("CB_METER") != "":
			var mt := OS.get_environment("CB_METER").split(",")
			if mt.size() == 4: backend.set_dial("V"); backend.set_probe("red", [int(mt[0]), int(mt[1])]); backend.set_probe("black", [int(mt[2]), int(mt[3])])
		if OS.get_environment("CB_POWER") == "1": backend.set_power(true)
		if OS.get_environment("CB_VIEW") != "": set_view(int(OS.get_environment("CB_VIEW")), true)
		if OS.get_environment("CB_DEMO") != "": _demo(OS.get_environment("CB_DEMO"))
	else: mode = "title"; changed.emit()
	if OS.get_environment("CB_MAXFPS") != "": Engine.max_fps = int(OS.get_environment("CB_MAXFPS"))   # software-rendered harness runs: cap the CPU
	if OS.get_environment("CB_FRAMETIME") != "":
		DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	_aa()
	if quality == "low": _low_tier()
	if OS.get_environment("CB_SCALE3D") != "":   # render the 3D scene at N x the window (frame-time proxy for 2560x1440 on a 1080p screen)
		get_viewport().scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR; get_viewport().scaling_3d_scale = float(OS.get_environment("CB_SCALE3D"))

## ------------------------------------------------------------------------------------------------ quality tiers

const QUALITY_FILE := "user://quality.txt"

## The title's Graphics keys: remember the tier and rebuild the bench with it (the detected tier is the default).
func set_quality_saved(q: String) -> void:
	if OS.get_environment("CB_NOSAVE") == "":
		var f := FileAccess.open(QUALITY_FILE, FileAccess.WRITE)
		if f: f.store_string(q); f.close()
	if get_parent() and get_parent().has_method("set_look"): get_parent().call_deferred("set_look", "workbench")

func _pick_quality() -> String:
	var q := OS.get_environment("CB_QUALITY")
	if q in ["high", "medium", "low"]: return q
	var method := RenderingServer.get_current_rendering_method()
	if method == "gl_compatibility": return "low"
	if FileAccess.file_exists(QUALITY_FILE):
		var saved := FileAccess.get_file_as_string(QUALITY_FILE).strip_edges()
		if saved in ["high", "medium", "low"]: return saved
	var dev := RenderingServer.get_video_adapter_name().to_lower()
	if dev.contains("nvidia") or dev.contains("rtx") or dev.contains("radeon rx"): return "high"
	return "medium"

## Anti-aliasing per tier: high = 4x MSAA for edges plus TAA for shading and thin leads; medium = 2x MSAA; low = 2x MSAA on Compatibility, FXAA elsewhere.
func _aa() -> void:
	var vp := get_viewport()
	match quality:
		"high": vp.msaa_3d = Viewport.MSAA_4X; vp.use_taa = true; vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
		"medium": vp.msaa_3d = Viewport.MSAA_2X; vp.use_taa = false; vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
		_:
			# FXAA does not exist in the Compatibility renderer the low tier runs on (0.4.1: it warned and did nothing, so the low tier
			# had no AA at all); there it gets 2x MSAA, which Compatibility supports
			if RenderingServer.get_current_rendering_method() == "gl_compatibility": vp.msaa_3d = Viewport.MSAA_2X; vp.use_taa = false
			else: vp.msaa_3d = Viewport.MSAA_DISABLED; vp.use_taa = false; vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
	if OS.get_environment("CB_AA") == "none": vp.msaa_3d = Viewport.MSAA_DISABLED; vp.use_taa = false   # measurement hook

## Low tier (integrated GPUs, Deck class, the Compatibility renderer): one soft lamp shadow at a small atlas, no moon shadow,
## no depth of field, 3D drawn at 75 % and scaled up. The emissive screens, LEDs, glow and the warm/cool colour plan stay.
func _low_tier() -> void:
	var vp := get_viewport()
	vp.positional_shadow_atlas_size = 1024; vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR; vp.scaling_3d_scale = 0.75
	for n in find_children("*", "DirectionalLight3D", true, false): (n as DirectionalLight3D).shadow_enabled = false
	if lamp: lamp.light_size = 0.0; lamp.shadow_blur = 1.0
	env.glow_intensity = 0.4; env.adjustment_enabled = false

## ------------------------------------------------------------------------------------------------ environment and light

func _env() -> void:
	var we := WorldEnvironment.new(); env = Environment.new()
	var sky := Sky.new(); var pm := PanoramaSkyMaterial.new()
	pm.panorama = load("res://look2/assets/hdri/artist_workshop_1k.hdr"); pm.energy_multiplier = 0.35
	sky.sky_material = pm; env.sky = sky
	env.background_mode = Environment.BG_SKY
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY; env.ambient_light_energy = 0.35
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX; env.tonemap_exposure = 1.0
	env.glow_enabled = true; env.glow_intensity = 0.55; env.glow_bloom = 0.04; env.glow_hdr_threshold = 1.1; env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.adjustment_enabled = true; env.adjustment_contrast = 1.06; env.adjustment_saturation = 0.95
	if quality != "low":
		env.ssao_enabled = true; env.ssao_radius = 0.12; env.ssao_intensity = 1.6; env.ssao_power = 1.4; env.ssao_detail = 0.8
	if quality == "high":
		env.ssil_enabled = true; env.ssil_radius = 0.4; env.ssil_intensity = 0.8
		env.ssr_enabled = true; env.ssr_max_steps = 48; env.ssr_fade_in = 0.15; env.ssr_fade_out = 2.0
		env.volumetric_fog_enabled = true; env.volumetric_fog_density = 0.012; env.volumetric_fog_albedo = Color(0.9, 0.85, 0.8); env.volumetric_fog_length = 6.0
		env.volumetric_fog_ambient_inject = 0.0
	we.environment = env; add_child(we)

func _room() -> void:
	var wood := StandardMaterial3D.new()
	wood.albedo_texture = load("res://look2/assets/tex/wood_table_001_diff_2k.jpg")
	wood.normal_enabled = true; wood.normal_texture = load("res://look2/assets/tex/wood_table_001_nor_gl_2k.jpg")
	wood.orm_texture = null
	wood.roughness_texture = load("res://look2/assets/tex/wood_table_001_arm_2k.jpg"); wood.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
	wood.ao_enabled = true; wood.ao_texture = load("res://look2/assets/tex/wood_table_001_arm_2k.jpg"); wood.ao_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	wood.uv1_scale = Vector3(0.7, 0.7, 0.7); wood.uv1_triplanar = true; wood.uv1_world_triplanar = true
	wood.albedo_color = Color(0.95, 0.9, 0.85); wood.normal_scale = 1.4
	# desk
	MeshKit.add(self, MeshKit.rounded_box(Vector3(1.9, 0.045, 0.85), 0.006, 2), wood, Vector3(0, -0.0225, -0.05))
	for sx in [-0.9, 0.9]:
		for sz in [-0.42, 0.32]:
			MeshKit.add(self, MeshKit.rounded_box(Vector3(0.06, 0.73, 0.06), 0.004), MeshKit.m("anodised"), Vector3(sx, -0.41, sz))
	# room: walls, floor, ceiling (the camera never sees a void)
	var plaster := StandardMaterial3D.new()
	plaster.albedo_texture = load("res://look2/assets/tex/painted_plaster_wall_diff_1k.jpg"); plaster.albedo_color = Color(0.62, 0.60, 0.56)
	plaster.normal_enabled = true; plaster.normal_texture = load("res://look2/assets/tex/painted_plaster_wall_nor_gl_1k.jpg")
	plaster.roughness = 0.9; plaster.uv1_triplanar = true; plaster.uv1_world_triplanar = true; plaster.uv1_scale = Vector3(0.6, 0.6, 0.6)
	var floor_m := MeshKit.mat(Color(0.10, 0.09, 0.085), 0.8, 0.0, {"normal": 0.4, "triplanar": true, "uv_scale": 4.0})
	MeshKit.add(self, MeshKit.rounded_box(Vector3(5, 0.02, 5), 0.002), floor_m, Vector3(0, -0.79, 0.5))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(5, 3, 0.05), 0.002), plaster, Vector3(0, 0.7, -0.52))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.05, 3, 5), 0.002), plaster, Vector3(-2.2, 0.7, 0.5))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(0.05, 3, 5), 0.002), plaster, Vector3(2.2, 0.7, 0.5))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(5, 3, 0.05), 0.002), plaster, Vector3(0, 0.7, 2.6))
	MeshKit.add(self, MeshKit.rounded_box(Vector3(5, 0.05, 5), 0.002), plaster, Vector3(0, 2.2, 0.5))
	# window at the back right: night sky, moonlight rim
	var win := MeshKit.add(self, QuadMesh.new(), _night_sky_mat(), Vector3(1.15, 0.62, -0.494))
	(win.mesh as QuadMesh).size = Vector2(0.9, 0.7)
	for f in [[Vector3(1.15, 0.97, -0.49), Vector3(0.96, 0.035, 0.04)], [Vector3(1.15, 0.27, -0.49), Vector3(0.96, 0.035, 0.06)], [Vector3(0.68, 0.62, -0.49), Vector3(0.035, 0.74, 0.04)], [Vector3(1.62, 0.62, -0.49), Vector3(0.035, 0.74, 0.04)], [Vector3(1.15, 0.62, -0.49), Vector3(0.02, 0.7, 0.03)]]:
		MeshKit.add(self, MeshKit.rounded_box(f[1], 0.004), MeshKit.mat(Color(0.16, 0.15, 0.14), 0.7), f[0])
	var moon := DirectionalLight3D.new(); moon.light_color = Color(0.55, 0.65, 0.9); moon.light_energy = 0.12; moon.rotation_degrees = Vector3(-30, 140, 0); moon.shadow_enabled = quality != "low"
	add_child(moon)
	_esd_mat()
	_lamp()
	_drawers()
	_props()
	_pegboard()
	_shelf()

func _night_sky_mat() -> StandardMaterial3D:
	var g := Gradient.new(); g.set_color(0, Color(0.02, 0.03, 0.07)); g.set_color(1, Color(0.10, 0.12, 0.22))
	var t := GradientTexture2D.new(); t.gradient = g; t.fill_from = Vector2(0, 0); t.fill_to = Vector2(0, 1)
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_texture = t
	m.emission_enabled = true; m.emission_texture = t; m.emission_energy_multiplier = 1.0
	return m

func _esd_mat() -> void:
	var img := Image.create(512, 512, false, Image.FORMAT_RGB8)
	var base := Color(0.13, 0.18, 0.22)
	img.fill(base)
	var n := FastNoiseLite.new(); n.frequency = 0.08
	for y in 512:
		for x in 512:
			var c := base * (0.975 + 0.025 * n.get_noise_2d(x, y))
			if x % 64 == 0 or y % 64 == 0: c = c.lightened(0.035)
			var sc := n.get_noise_2d(x * 0.25 + 900.0, y * 3.0)
			if sc > 0.5: c = c.lightened((sc - 0.5) * 0.35)   # scuffs and wipe marks
			var edge := minf(minf(x, 511 - x), minf(y, 511 - y)) / 40.0
			if edge < 1.0: c = c.darkened((1.0 - edge) * 0.25)   # worn, darker edges
			for b in [[140, 300, 5.0], [380, 120, 4.0], [260, 420, 3.0]]:   # old solder burn spots
				var d := Vector2(x, y).distance_to(Vector2(b[0], b[1]))
				if d < float(b[2]): c = c.lerp(Color(0.05, 0.04, 0.035), 0.7 * (1.0 - d / float(b[2])))
			img.set_pixel(x, y, c)
	img.generate_mipmaps()   # minified without mips the mat print sparkles
	var tex := ImageTexture.create_from_image(img)
	var m := MeshKit.mat(Color.WHITE, 0.78, 0.0, {"normal": 0.25})
	m.albedo_texture = tex; m.uv1_scale = Vector3(1, 1, 1)
	var mat_mesh := MeshKit.rounded_box(Vector3(0.66, 0.003, 0.46), 0.0012, 2)
	MeshKit.add(self, mat_mesh, m, Vector3(0, 0.0015, 0.07))
	m.uv1_triplanar = true; m.uv1_world_triplanar = true; m.uv1_scale = Vector3(3.2, 3.2, 3.2)
	MeshKit.label(self, "ESD SAFE WORK SURFACE   10⁶-10⁹ Ω", 0.00012, Vector3(-0.12, 0.0032, 0.29), Color(0.55, 0.62, 0.68, 0.7))
	for i in 31:   # printed ruler along the front edge, 1 cm ticks
		var t := BoxMesh.new(); t.size = Vector3(0.0006, 0.0002, 0.006 if i % 5 == 0 else 0.003)
		MeshKit.add(self, t, MeshKit.mat(Color(0.55, 0.62, 0.68), 0.7), Vector3(0.0 + i * 0.01, 0.0031, 0.296))
	# grounding snap and coiled cord
	var snap := CylinderMesh.new(); snap.top_radius = 0.006; snap.bottom_radius = 0.006; snap.height = 0.004
	MeshKit.add(self, snap, MeshKit.m("steel"), Vector3(0.31, 0.004, -0.14))
	var pts := PackedVector3Array()
	for i in 60:
		var t := float(i) / 59.0
		pts.append(Vector3(0.31 + t * 0.25, 0.006 + 0.004 * sin(t * 50.0), -0.14 - t * 0.2 + 0.004 * cos(t * 50.0)))
	MeshKit.add(self, MeshKit.tube(pts, 0.0018, 6), MeshKit.mat(Color(0.05, 0.08, 0.12), 0.5))

func _lamp() -> void:
	var base_p := Vector3(-0.62, 0, -0.28)
	var dark := MeshKit.m("anodised")
	var b := CylinderMesh.new(); b.top_radius = 0.07; b.bottom_radius = 0.075; b.height = 0.025; b.radial_segments = 40
	MeshKit.add(self, b, dark, base_p + Vector3(0, 0.0125, 0))
	var j1 := base_p + Vector3(0, 0.03, 0); var j2 := base_p + Vector3(0.08, 0.42, 0.06); var j3 := Vector3(-0.22, 0.48, 0.0)
	for seg in [[j1, j2], [j2, j3]]:
		var off := Vector3(0, 0, 0.012)
		for o in [off, -off]:
			MeshKit.add(self, MeshKit.tube(PackedVector3Array([seg[0] + o, seg[1] + o]), 0.0045, 10), MeshKit.m("brushed_alu"))
	for j in [j1, j2]:
		var hub := CylinderMesh.new(); hub.top_radius = 0.014; hub.bottom_radius = 0.014; hub.height = 0.036
		MeshKit.add(self, hub, dark, j, Vector3(PI / 2, 0, 0))
	var shade := CylinderMesh.new(); shade.top_radius = 0.025; shade.bottom_radius = 0.075; shade.height = 0.11; shade.radial_segments = 40
	var shade_node := Node3D.new(); shade_node.position = j3; add_child(shade_node)
	shade_node.look_at_from_position(j3, Vector3(-0.02, 0, 0.08))
	var sm := MeshKit.mat(Color(0.12, 0.13, 0.12), 0.45, 0.6); sm.cull_mode = BaseMaterial3D.CULL_DISABLED
	MeshKit.add(shade_node, shade, sm, Vector3(0, 0, -0.04), Vector3(-PI / 2, 0, 0))
	var bulb := SphereMesh.new(); bulb.radius = 0.022; bulb.height = 0.044
	MeshKit.add(shade_node, bulb, MeshKit.mat(Color(1, 0.9, 0.75), 0.3, 0.0, {"emission": Color(1.0, 0.82, 0.6), "emission_energy": 8.0}), Vector3(0, 0, -0.06))
	lamp = SpotLight3D.new(); lamp.light_color = Color(1.0, 0.76, 0.50); lamp.light_energy = 4.2; lamp.spot_range = 1.6; lamp.spot_angle = 52.0; lamp.spot_angle_attenuation = 1.2
	lamp.shadow_enabled = true; lamp.light_size = 0.04 if quality == "high" else 0.0; lamp.shadow_blur = 1.5; lamp.light_volumetric_fog_energy = 0.6
	shade_node.add_child(lamp); lamp.position = Vector3(0, 0, -0.07)
	# a soft overall fill from the lamp bouncing off the wall
	var fill := OmniLight3D.new(); fill.light_color = Color(1.0, 0.85, 0.7); fill.light_energy = 0.3; fill.omni_range = 2.0; fill.position = Vector3(-0.3, 0.9, -0.3); add_child(fill)
	# bounce: the lamp pool on the oak and mat throws warm light back up under the instruments
	var bounce := OmniLight3D.new(); bounce.light_color = Color(1.0, 0.70, 0.45); bounce.light_energy = 0.55; bounce.omni_range = 0.55; bounce.omni_attenuation = 1.6
	bounce.position = Vector3(-0.08, 0.035, 0.0); bounce.shadow_enabled = false; bounce.light_specular = 0.0; add_child(bounce)

func _drawers() -> void:
	var cab := Node3D.new(); cab.position = Vector3(0.66, 0, -0.33); cab.rotation_degrees.y = -12; add_child(cab)
	var body_m := MeshKit.mat(Color(0.15, 0.16, 0.17), 0.5, 0.7)
	MeshKit.add(cab, MeshKit.rounded_box(Vector3(0.36, 0.30, 0.16), 0.004), body_m, Vector3(0, 0.15, 0))
	var labels := ["10R-91R", "100R-910R", "1K-9K1", "10K-91K", "100K-1M", "CER", "ELEC", "FILM", "1N4007", "1N4148", "ZENER", "LED", "NPN", "PNP", "MOSFET", "TO-220", "OPAMP", "555", "REG", "MISC"]
	var front := MeshKit.mat(Color(0.75, 0.80, 0.85), 0.25, 0.0, {"alpha": 0.55, "clearcoat": 0.8})
	for r in 5:
		for c in 4:
			var i := r * 4 + c
			var p := Vector3(-0.135 + c * 0.09, 0.27 - r * 0.056, 0.081)
			MeshKit.add(cab, MeshKit.rounded_box(Vector3(0.082, 0.048, 0.006), 0.002), front, p)
			MeshKit.add(cab, MeshKit.rounded_box(Vector3(0.03, 0.007, 0.008), 0.002), MeshKit.m("black_plastic"), p + Vector3(0, -0.012, 0.006))
			var card := MeshKit.rounded_box(Vector3(0.05, 0.014, 0.001), 0.0005)
			MeshKit.add(cab, card, MeshKit.mat(Color(0.92, 0.91, 0.86), 0.7), p + Vector3(0, 0.009, 0.0035))
			MeshKit.label(cab, labels[i], 0.00011, p + Vector3(0, 0.009, 0.0042), Color(0.1, 0.1, 0.1), true, Vector3.ZERO)
			# parts visible through the translucent front
			var bits := MeshKit.rounded_box(Vector3(0.06, 0.012, 0.03), 0.004)
			MeshKit.add(cab, bits, MeshKit.mat(Color.from_hsv(fmod(i * 0.137, 1.0), 0.35, 0.45), 0.6), p + Vector3(0, -0.016, -0.03))

func _props() -> void:
	# soldering station: base with a red temperature display, iron in its holder, brass sponge
	var st := Node3D.new(); st.position = Vector3(0.56, 0, -0.03); st.rotation_degrees.y = -30; add_child(st)
	MeshKit.add(st, MeshKit.rounded_box(Vector3(0.13, 0.085, 0.15), 0.008), MeshKit.m("anodised"), Vector3(0, 0.0425, 0))
	MeshKit.add(st, MeshKit.rounded_box(Vector3(0.06, 0.022, 0.002), 0.002), MeshKit.m("screen_glass"), Vector3(0, 0.058, 0.0755))
	MeshKit.label(st, "330°", 0.00028, Vector3(0, 0.058, 0.0772), Color(1.0, 0.25, 0.12), true, Vector3.ZERO).modulate = Color(3.0, 0.6, 0.3)
	var holder := MeshKit.add(st, MeshKit.tube(PackedVector3Array([Vector3(0.11, 0.0, -0.02), Vector3(0.11, 0.06, 0.03)]), 0.012, 16), MeshKit.m("steel"))
	holder.name = "holder"
	MeshKit.add(st, MeshKit.tube(PackedVector3Array([Vector3(0.11, 0.04, 0.0), Vector3(0.11, 0.13, 0.08)]), 0.009, 14), MeshKit.m("black_plastic"))
	MeshKit.add(st, MeshKit.tube(PackedVector3Array([Vector3(0.11, 0.13, 0.08), Vector3(0.11, 0.16, 0.105)]), 0.002, 8), MeshKit.m("steel"))
	var cable := PackedVector3Array([Vector3(0.11, 0.0, -0.025), Vector3(0.05, 0.004, -0.08), Vector3(0.0, 0.02, -0.075)])
	MeshKit.add(st, MeshKit.tube(MeshKit.round_corners(cable, 0.03), 0.003, 8), MeshKit.m("rubber"))
	var sponge := CylinderMesh.new(); sponge.top_radius = 0.025; sponge.bottom_radius = 0.025; sponge.height = 0.02
	MeshKit.add(st, sponge, MeshKit.mat(Color(0.75, 0.6, 0.3), 0.4, 1.0, {"normal": 1.0}), Vector3(0.11, 0.01, -0.08))
	# solder spool
	var spool := Node3D.new(); spool.position = Vector3(0.47, 0, -0.17); add_child(spool)
	for yy in [0.002, 0.042]:
		var fl := CylinderMesh.new(); fl.top_radius = 0.03; fl.bottom_radius = 0.03; fl.height = 0.004
		MeshKit.add(spool, fl, MeshKit.mat(Color(0.75, 0.2, 0.12), 0.5), Vector3(0, yy, 0))
	var core := CylinderMesh.new(); core.top_radius = 0.022; core.bottom_radius = 0.022; core.height = 0.036
	MeshKit.add(spool, core, MeshKit.m("solder"), Vector3(0, 0.022, 0))
	# mug
	var mug := Node3D.new(); mug.position = Vector3(-0.42, 0, 0.30); add_child(mug)
	var mb := CylinderMesh.new(); mb.top_radius = 0.042; mb.bottom_radius = 0.04; mb.height = 0.1; mb.radial_segments = 32
	MeshKit.add(mug, mb, MeshKit.mat(Color(0.18, 0.2, 0.22), 0.35, 0.0, {"clearcoat": 0.6}), Vector3(0, 0.05, 0))
	var tea := CylinderMesh.new(); tea.top_radius = 0.038; tea.bottom_radius = 0.038; tea.height = 0.002
	MeshKit.add(mug, tea, MeshKit.mat(Color(0.18, 0.09, 0.04), 0.1), Vector3(0, 0.092, 0))
	var handle := PackedVector3Array()
	for i in 13:
		var a := -PI / 2 + PI * float(i) / 12.0
		handle.append(Vector3(0.042 + 0.022 * cos(a), 0.05 + 0.028 * sin(a), 0))
	MeshKit.add(mug, MeshKit.tube(handle, 0.006, 10), MeshKit.mat(Color(0.18, 0.2, 0.22), 0.35, 0.0, {"clearcoat": 0.6}))
	# tweezers
	for s in [-1, 1]:
		MeshKit.add(self, MeshKit.tube(PackedVector3Array([Vector3(0.18, 0.004, 0.27), Vector3(0.30, 0.004 + 0.0, 0.27 + s * 0.006)]), 0.0016, 6), MeshKit.m("steel"))

func _shelf() -> void:
	var sh := Node3D.new(); sh.position = Vector3(0.62, 0.40, -0.43); add_child(sh)
	MeshKit.add(sh, MeshKit.rounded_box(Vector3(0.6, 0.018, 0.16), 0.003), MeshKit.mat(Color(0.30, 0.22, 0.15), 0.6, 0.0, {"normal": 0.4}))
	var items := [["RADIO", Vector3(0.16, 0.10, 0.08), Color(0.42, 0.30, 0.20)], ["SYNTH", Vector3(0.18, 0.05, 0.10), Color(0.15, 0.16, 0.18)], ["CHARGER", Vector3(0.06, 0.07, 0.05), Color(0.85, 0.85, 0.83)], ["LED STRIP", Vector3(0.09, 0.04, 0.09), Color(0.20, 0.22, 0.25)]]
	var x := -0.26
	for it in items:
		var sz: Vector3 = it[1]
		x += sz.x * 0.5
		MeshKit.add(sh, MeshKit.rounded_box(sz, 0.006), MeshKit.mat(it[2], 0.5), Vector3(x, 0.009 + sz.y * 0.5, 0))
		var tag := MeshKit.rounded_box(Vector3(0.05, 0.022, 0.001), 0.001)
		MeshKit.add(sh, tag, MeshKit.mat(Color(0.93, 0.90, 0.80), 0.8), Vector3(x, 0.03, sz.z * 0.5 + 0.002))
		MeshKit.label(sh, it[0], 0.00009, Vector3(x, 0.03, sz.z * 0.5 + 0.0028), Color(0.1, 0.1, 0.1), true, Vector3.ZERO)
		x += sz.x * 0.5 + 0.03

func _pegboard() -> void:
	var pb := Node3D.new(); pb.position = Vector3(-0.3, 0.46, -0.49); add_child(pb)
	var pbm := MeshKit.mat(Color(0.22, 0.2, 0.17), 0.8, 0.0, {"normal": 0.3})
	MeshKit.add(pb, MeshKit.rounded_box(Vector3(1.2, 0.6, 0.012), 0.002), pbm)
	var holes := MultiMesh.new(); holes.transform_format = MultiMesh.TRANSFORM_3D
	var hm := CylinderMesh.new(); hm.top_radius = 0.0035; hm.bottom_radius = 0.0035; hm.height = 0.002; hm.radial_segments = 8
	holes.mesh = hm; holes.instance_count = 47 * 23
	var i := 0
	for yy in 23:
		for xx in 47:
			holes.set_instance_transform(i, Transform3D(Basis(Vector3.RIGHT, PI / 2), Vector3(-0.575 + xx * 0.025, -0.275 + yy * 0.025, 0.0062))); i += 1
	var mmi := MultiMeshInstance3D.new(); mmi.multimesh = holes; mmi.material_override = MeshKit.mat(Color(0.02, 0.02, 0.02), 0.9); pb.add_child(mmi)
	# hanging wire spools and cutters
	var cols := [Color(0.62, 0.07, 0.05), Color(0.05, 0.05, 0.05), Color(0.85, 0.66, 0.08), Color(0.08, 0.22, 0.55), Color(0.08, 0.42, 0.18)]
	for k in cols.size():
		var sp := CylinderMesh.new(); sp.top_radius = 0.035; sp.bottom_radius = 0.035; sp.height = 0.03; sp.radial_segments = 28
		MeshKit.add(pb, sp, MeshKit.mat(cols[k], 0.45, 0.0, {"normal": 0.6}), Vector3(-0.5 + k * 0.085, 0.18, 0.03), Vector3(PI / 2, 0, 0))
		var hub := CylinderMesh.new(); hub.top_radius = 0.012; hub.bottom_radius = 0.012; hub.height = 0.034
		MeshKit.add(pb, hub, MeshKit.m("black_plastic"), Vector3(-0.5 + k * 0.085, 0.18, 0.03), Vector3(PI / 2, 0, 0))
	for k in 3:
		var x := 0.12 + k * 0.12
		for s in [-1, 1]:
			MeshKit.add(pb, MeshKit.tube(PackedVector3Array([Vector3(x, 0.15, 0.02), Vector3(x + s * 0.012, 0.03, 0.02), Vector3(x + s * 0.02, -0.06, 0.02)]), 0.006, 8), MeshKit.mat(Color(0.7, 0.15, 0.1) if k != 1 else Color(0.1, 0.25, 0.6), 0.5))
		MeshKit.add(pb, MeshKit.tube(PackedVector3Array([Vector3(x, 0.15, 0.02), Vector3(x, 0.22, 0.02)]), 0.004, 8), MeshKit.m("steel"))

## ------------------------------------------------------------------------------------------------ instruments (Kofi's classes, looked up by name so the bench runs without them)

func _new_class(cname: String) -> Node3D:
	for c in ProjectSettings.get_global_class_list():
		if str(c["class"]) == cname:
			var s = load(str(c["path"]))
			if s != null: return s.new()
	return null

func _instruments() -> void:
	scope = _new_class("Scope3D"); psu = _new_class("Psu3D"); dmm = _new_class("Dmm3D"); mcu = _new_class("Mcu3D"); fan = _new_class("Fan3D")
	var spots := [[scope, Vector3(-0.31, 0, -0.25), 14.0], [psu, Vector3(0.25, 0, -0.25), -22.0], [dmm, Vector3(0.195, 0, 0.065), -30.0], [mcu, Vector3(-0.19, 0.003, 0.13), 90.0], [fan, Vector3(0.11, 0.0, -0.11), -18.0]]
	for s in spots:
		if s[0] == null: continue
		var n: Node3D = s[0]; add_child(n); n.position = s[1]; n.rotation_degrees.y = s[2]

func _call(n: Object, m: String, args := []) -> Variant:
	if n != null and n.has_method(m): return n.callv(m, args)
	return null

## ------------------------------------------------------------------------------------------------ camera

func _camera() -> void:
	cam = Camera3D.new(); cam.fov = 38.0; cam.near = 0.01; cam.far = 20.0; add_child(cam)
	cam_attr = CameraAttributesPractical.new()
	cam_attr.dof_blur_far_enabled = quality != "low"; cam_attr.dof_blur_near_enabled = quality == "high"; cam_attr.dof_blur_amount = 0.06
	cam.attributes = cam_attr

func board_centre() -> Vector3:
	if board == null: return Vector3(0, 0.02, 0.07)
	return board.to_global(Vector3((board.w - 1) * P * 0.5, 0, (board.h - 1) * P * 0.5))

## World bounds of what is in use on the board (parts, wires, connectors), so the wiring view frames the circuit, not the empty pads.
func _used_bounds() -> AABB:
	if board == null: return AABB(Vector3(-0.07, 0.02, 0.02), Vector3(0.14, 0.01, 0.1))
	var pts: Array = []
	for c in board.connectors: pts.append(c.pad)
	for p in backend.parts: for q in p.pins: pts.append(q)
	for w in backend.wires: for q in w.path: pts.append(q)
	var bb := AABB(board.pad_world(int(pts[0][0]), int(pts[0][1])), Vector3.ZERO)
	for q in pts: bb = bb.expand(board.pad_world(int(q[0]), int(q[1])))
	return bb.grow(0.012)

const V1_TGT := Vector3(0.02, 0.03, -0.06)
const V1_YAW := 4.0
const V1_PITCH := -30.0
const V1_DIST := 0.62
func set_view(v: int, snap := false) -> void:
	view = v
	match v:
		1:   # 0.4.1 (Sigrid): device, scope, supply and meter all in frame at 16:9 and 16:10; tests/look2_frame_flow.gd holds it
			var asp1 := get_viewport().get_visible_rect().size.aspect()
			g_tgt = board_centre() + Vector3(V1_TGT.x, V1_TGT.y, V1_TGT.z); g_yaw = deg_to_rad(V1_YAW); g_pitch = deg_to_rad(V1_PITCH); g_dist = V1_DIST * (1.78 / clampf(asp1, 1.3, 2.4))
		5:
			var bb := _used_bounds()
			# the board sits above the tray: aim below its centre and pull back on narrow (16:10) windows
			var asp := get_viewport().get_visible_rect().size.aspect()
			g_tgt = bb.get_center() + Vector3(-0.022, 0.0, 0.032); g_yaw = 0.0; g_pitch = deg_to_rad(-62.0); g_dist = clampf(bb.size.length() * 2.6 * (1.78 / maxf(asp, 1.2)), 0.22, 0.42)
		2: g_tgt = Vector3(0.02, 0.04, -0.03); g_yaw = deg_to_rad(16.0); g_pitch = deg_to_rad(-26.0); g_dist = 0.92
		3: g_tgt = (scope.global_position + Vector3(-0.06, 0.075, 0)) if scope else Vector3(-0.3, 0.08, -0.25); g_yaw = deg_to_rad(14.0); g_pitch = deg_to_rad(-10.0); g_dist = 0.48
		4: g_tgt = (fan.global_position + Vector3(0, 0.07, 0)) if fan else Vector3(0.03, 0.07, -0.24); g_yaw = deg_to_rad(-20.0); g_pitch = deg_to_rad(-14.0); g_dist = 0.42
	if snap: tgt = g_tgt; yaw = g_yaw; pitch = g_pitch; dist = g_dist
	_view_pose = [g_tgt, g_yaw, g_pitch, g_dist]
	if ui: ui.call_deferred("_rebuild")

func _update_camera(dt: float) -> void:
	var k := 1.0 - exp(-dt * 6.0)
	tgt = tgt.lerp(g_tgt, k); yaw = lerp_angle(yaw, g_yaw, k); pitch = lerpf(pitch, g_pitch, k); dist = lerpf(dist, g_dist, k)
	var off := Vector3(0, 0, dist).rotated(Vector3.RIGHT, pitch).rotated(Vector3.UP, yaw)
	cam.position = tgt + off
	cam.look_at(tgt)
	cam_attr.dof_blur_far_distance = dist + 0.18; cam_attr.dof_blur_far_transition = maxf(0.3, dist * 0.8)
	cam_attr.dof_blur_near_distance = maxf(0.05, dist - 0.2); cam_attr.dof_blur_near_transition = 0.1

## ------------------------------------------------------------------------------------------------ modes

func _nosave() -> bool: return OS.has_environment("CB_NOSAVE") or OS.get_environment("CB_L2_TICKET") != ""

func start_job(id := "") -> void:
	if not _campaign:
		# one save with the classic stall: chapter 1 progress and the wallet carry between the two looks
		if not _nosave() and backend.has_save(): backend.load_game()
		else: backend.new_game()
		_campaign = true
	if id == "": id = OS.get_environment("CB_L2_TICKET") if OS.get_environment("CB_L2_TICKET") != "" else first_open_ticket()
	mode = "job"; ticket_id = id; _paid_text = ""
	# 5-1 from the title is the showcase: it unlocks the tickets before it, so it never saves. From the campaign it is a job.
	_showcase = id == TICKET and OS.get_environment("CB_L2_TICKET") == "" and not _ticket_open(id)
	if _showcase or OS.get_environment("CB_L2_TICKET") != "": backend.unlock_through(id)
	backend.open_ticket(id)
	_after_open()
	if OS.get_environment("CB_L2_REF") == "1" or OS.get_environment("CB_L2_NODIODE") == "1":
		backend.build_ref(id)
		if OS.get_environment("CB_L2_NODIODE") == "1":
			for p in backend.parts: if str(p.partId) == "1n4007": backend.delete_part(str(p.uid))
	var cs := OS.get_environment("CB_L2_CASE")
	if cs == "" and (OS.get_environment("CB_L2_REF") == "1" or OS.get_environment("CB_L2_NODIODE") == "1" or OS.get_environment("CB_L2_GHOST") != ""): cs = "open"
	if cs in ["open", "handed"] and case_node: case_node.set_state("open", false)
	if OS.get_environment("CB_PROBE") != "" and id == TICKET:
		backend.set_probe("ch1", [16, 8]); backend.set_dial("V"); backend.set_probe("red", [16, 2]); backend.set_probe("black", [22, 2])
	if OS.get_environment("CB_METER") != "":   # QA/shot hook: CB_METER=rx,ry,bx,by puts the red and black leads on two pads, dial on V
		var m := OS.get_environment("CB_METER").split(",")
		if m.size() == 4: backend.set_dial("V"); backend.set_probe("red", [int(m[0]), int(m[1])]); backend.set_probe("black", [int(m[2]), int(m[3])])
	if OS.get_environment("CB_PIN") != "": backend.set_selector("pin", int(OS.get_environment("CB_PIN")))
	if OS.get_environment("CB_POWER") == "1": backend.set_power(true)
	if OS.get_environment("CB_THERMAL") == "1": toggle_thermal()   # shot hook: chapter 4's thermal camera on
	if OS.get_environment("CB_POWER_AT") != "":   # QA/clip hook: switch the bench on after N seconds (the clip shows the moment)
		get_tree().create_timer(float(OS.get_environment("CB_POWER_AT"))).timeout.connect(func(): toggle_power())
	if OS.get_environment("CB_OPEN") == "1": open_case(); set_view(int(OS.get_environment("CB_VIEW")) if OS.get_environment("CB_VIEW") != "" else 1, true)   # shot hook
	if OS.get_environment("CB_DEMO") != "": _demo(OS.get_environment("CB_DEMO"))
	if OS.get_environment("CB_OPEN_AT") != "":    # QA/clip hook: open the case after N seconds
		get_tree().create_timer(float(OS.get_environment("CB_OPEN_AT"))).timeout.connect(func(): open_case())
	if OS.get_environment("CB_VIEW_AT") != "":    # QA/clip hook: "view@seconds,view@seconds" camera moves
		for part in OS.get_environment("CB_VIEW_AT").split(","):
			var vv := int(part.get_slice("@", 0)); var tt := float(part.get_slice("@", 1))
			get_tree().create_timer(tt).timeout.connect(func(): set_view(vv))
	if OS.get_environment("CB_VIEW") != "": set_view(int(OS.get_environment("CB_VIEW")), true)
	else: set_view(1)
	sync_board(); changed.emit()
	if OS.get_environment("CB_L2_GHOST") != "": _ghost_demo.call_deferred()
	if cs == "handed": get_tree().create_timer(2.5).timeout.connect(func(): hand_back())

func case_closed() -> bool: return case_node != null and case_node.state != "open"

func open_case() -> void:
	if case_node == null or case_node.state == "open": return
	case_node.set_state("open"); note = str(OPEN_LINE.get(ticket_id, "Case open. The board is on the bench.")); if sfx: sfx.play("clack")
	set_view(1); changed.emit()

## After a pass: the lid goes back on and the fan goes home running.
func hand_back() -> void:
	if case_node == null: return
	# save after a campaign job (not after the 5-1 showcase, which unlocks tickets the player has not reached)
	if not _nosave() and not _showcase and CH1.has(ticket_id) and backend.passed: backend.save_game()
	set_tool("select")
	if probe_node: probe_node.visible = false
	if probe_cable: probe_cable.visible = false
	backend.set_probe("ch1", null)
	case_node.set_state("handed"); handed = true; if sfx: sfx.play("page", 0.7)
	if not backend.powered: backend.set_power(true)
	if ticket_id == TICKET: backend.set_selector("pin", 0)
	note = "%s: \"%s\"" % [str(backend.ticket.get("customer", "")), str(backend.ticket.get("thanks", ""))]
	set_view(2); changed.emit()

## QA hook (CB_L2_GHOST=1): a 2N2222A picked from the drawer, its placement preview over pads 14-16 of row I, as the player sees it mid-drag.
func _ghost_demo() -> void:
	for it in drawer():
		if str(it.partId) == "2n2222a": pick_part(it); break
	await get_tree().process_frame
	qa_hover_lock = true
	for i in 30: await get_tree().process_frame   # the camera glides into the wiring view first
	_hover(cam.unproject_position(board.pad_world(14, 8)), true)
	hover_pad = Vector2i(14, 8)

func start_free() -> void:
	mode = "free"; _campaign = false; testbed_device = ""; testbed_paused = false
	backend._act("newGame", [1, "sandbox"])
	backend.open_ticket(TICKET)
	backend.clear_fault()   # the free bench is an open board, not the fan repair
	_after_open()
	if OS.get_environment("CB_L2_FREEPARTS") == "1":   # QA hook: a few arbitrary catalogue parts on the open board (sandbox: no bin, no limits)
		for q in [["led-green-5mm", null, 4, 11, 0], ["ne555", null, 9, 9, 0], ["cap-el", 100e-6, 6, 13, 0], ["lm7805", null, 15, 11, 0], ["res-cf", 4700, 3, 9, 0], ["led-blue-5mm", null, 19, 7, 0]]:
			var it := {"partId": q[0], "value": q[1], "variant": "", "kind": ""}
			for d in drawer():
				if str(d.partId) == q[0]: it.variant = d.variant; it.kind = d.kind; break
			backend.place(it, q[2], q[3], q[4])
		backend.add_wire([7, 9], [9, 9]); backend.add_wire([4, 11], [3, 11])
	if OS.get_environment("CB_POWER") == "1": backend.set_power(true)
	set_view(int(OS.get_environment("CB_VIEW")) if OS.get_environment("CB_VIEW") != "" else 1, OS.get_environment("CB_VIEW") != ""); sync_board(); changed.emit()

func back_to_title() -> void:
	backend.set_power(false); backend.close_ticket()
	if _showcase: _campaign = false; _showcase = false   # the showcase's unlocks are not the player's: the next Jobs reloads the save
	mode = "title"; tool = "select"; _clear_ghost()
	for c in board_root.get_children(): c.queue_free()
	board = null; parts3d.clear(); wires3d.clear(); _sig_parts = ""; _sig_wires = ""
	set_view(2); changed.emit()

func _after_open() -> void:
	hover_tip = ""; _pick_hl = {}; _pad_tip_shown = false   # 0.6: the last ticket's tip stayed on the rail into the next job
	for c in board_root.get_children(): c.queue_free()
	parts3d.clear(); wires3d.clear(); _sig_parts = ""; _sig_wires = ""; last_failure = {}
	capture_until = 0.0; _call(scope, "clear_capture")   # 0.5 (Noor): the testbed's 2000 V capture stayed on the scope into the next job
	for sfx_node in smoke_fx: if is_instance_valid(sfx_node): sfx_node.queue_free()
	smoke_fx.clear()
	board = Board3D.new(); board_root.add_child(board)
	board.build(int(backend.ticket.board.w), int(backend.ticket.board.h), backend.ticket.board.connectors)
	var c := Vector3((board.w - 1) * P * 0.5, 0, (board.h - 1) * P * 0.5)
	board.position = Vector3(-0.02, 0.003 + 0.012 + MeshKit.BOARD_T, 0.07) - c
	board.set_keepout(backend.bench_q.get("keepOut", []), str(backend.mains.get("keepOut", "")))   # 4-1: the mains side of the board
	thermal = false; backend.camera = false
	_contacts()
	if case_node: case_node.queue_free(); case_node = null
	handed = false
	if mode == "job":
		case_node = DeviceCase.new(); board_root.add_child(case_node)
		case_node.build(Vector2((board.w + 3) * P, (board.h + 3) * P), str(backend.ticket.get("id", "")), str(backend.ticket.get("title", "")), str(backend.ticket.get("customer", "")))
		case_node.global_position = board.to_global(c)
		case_node.set_state("closed", false)
	_layout_for_ticket()
	_cables()

## The bench-driven contacts of the ticket (its `contact` supplies) stand on the board between their two pads.
func _contacts() -> void:
	contacts3d.clear()
	for sd in backend.card.get("supplies", []):
		if str(sd.get("kind", "")) != "contact": continue
		var pa := Vector2(-1, -1); var pb := Vector2(-1, -1)
		for c in backend.ticket.board.connectors:
			if str(c.id) == str(sd.plus): pa = Vector2(float(c.pad[0]), float(c.pad[1]))
			if str(c.id) == str(sd.minus): pb = Vector2(float(c.pad[0]), float(c.pad[1]))
		if pa.x < 0 or pb.x < 0: continue
		var ct := Contact3D.new(); board.add_child(ct)
		ct.build(str(sd.id), board.pad_local(int(pa.x), int(pa.y)), board.pad_local(int(pb.x), int(pb.y)))
		contacts3d[str(sd.id)] = ct

## The bench is set for the job: the fan and the microcontroller only come out for 5-1; the scope stands behind the board,
## clear of the repair ticket on the left, so nothing on screen covers its trace.
func _layout_for_ticket() -> void:
	# the fan and the microcontroller only come out for 5-1, the open free bench (its board is 5-1's) and the testbed's fan driver
	var fan_job := (mode == "free" and testbed_device in ["", "fan"]) or (mode != "free" and ticket_id == TICKET)
	if fan: fan.visible = fan_job
	if mcu: mcu.visible = fan_job
	if scope: scope.position = Vector3(-0.05, 0, -0.30) if fan_job else Vector3(0.0, 0, -0.29); scope.rotation_degrees.y = 6.0 if fan_job else 0.0
	if fan: fan.position = Vector3(0.085, 0.0, -0.15)   # D-bench-ch45: at 0.17 it stood in front of the bench supply's display
	if iso_box == null and not backend.mains.is_empty(): iso_box = IsoBox.new(); add_child(iso_box)
	if iso_box:
		iso_box.visible = not backend.mains.is_empty() and mode != "free"
		iso_box.position = Vector3(0.30, 0.0, -0.085); iso_box.rotation_degrees.y = -30.0   # in front of the supply's lower right, under its display, behind the meter
	if mcu: mcu.position = Vector3(-0.07, 0.003, 0.215); mcu.rotation_degrees.y = 0.0   # in front of the case; the sorting box stands at its left

## Drawer rows: the ticket's shoebox (job) or the whole catalogue (free bench), grouped by kind.
func drawer() -> Array:
	if mode == "job": return backend.bin()
	var out: Array = []
	var pr = backend._q("parts", [false])
	if not (pr is Array): return out
	var i := 0
	for d in pr:
		var vals: Array = d.get("values", []) if d.get("values", null) is Array else []
		var fp := str(d.get("footprint", ""))
		if fp == "" or not NodeApi.FOOTPRINTS.has(fp) or (d.get("variants", []) as Array).is_empty(): continue
		var va: Dictionary = d.variants[0]
		var pick: Array = [null] if vals.is_empty() else [vals[0], vals[vals.size() / 2]] if vals.size() > 1 else [vals[0]]
		for v in pick:
			out.append({"i": i, "partId": str(d.id), "value": v, "variant": str(va.id), "label": ("%s  %s" % [NodeApi.format_value(float(v), str(d.kind)), str(d.name) if str(d.name).length() <= 22 else str(d.name).substr(0, 22)]) if v != null else str(d.name), "kind": str(d.kind), "footprint": fp, "price_text": str(va.get("priceText", "")), "tag": str(d.name) if v != null else "", "left": -1})
			i += 1
	return out

## A small 3D render of a part for the tray (rendered once in its own world, cached by part and value).
var _icons := {}
func part_icon(item: Dictionary) -> Texture2D:
	var key := "%s|%s" % [str(item.partId), str(item.get("value", ""))]
	if _icons.has(key): return _icons[key]
	var vp := SubViewport.new(); vp.size = Vector2i(144, 144); vp.own_world_3d = true; vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE; vp.msaa_3d = Viewport.MSAA_4X
	add_child(vp)
	var part := Part3D.make({"partId": item.partId, "kind": item.kind, "value": item.value, "variant": item.variant, "label": item.label, "footprint": item.footprint, "uid": "icon"})
	vp.add_child(part)
	var c := part._centre() + Vector3(0, 0.006, 0)
	var fp: Array = NodeApi.FOOTPRINTS.get(str(item.footprint), [[0, 0], [2, 0]])
	var span := 0.0
	for o in fp: span = maxf(span, Vector2(float(o[0]), float(o[1])).length() * P)
	var cam3 := Camera3D.new(); cam3.projection = Camera3D.PROJECTION_ORTHOGONAL; cam3.size = maxf(0.024, span + 0.012)
	vp.add_child(cam3); cam3.position = c + Vector3(0.05, 0.06, 0.07); cam3.look_at(c)
	var l := DirectionalLight3D.new(); l.light_color = Color(1.0, 0.9, 0.8); l.light_energy = 1.6; l.rotation_degrees = Vector3(-50, 30, 0); vp.add_child(l)
	var we := WorldEnvironment.new(); var e := Environment.new(); e.background_mode = Environment.BG_CLEAR_COLOR; e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.6, 0.7); e.ambient_light_energy = 0.8; e.tonemap_mode = Environment.TONE_MAPPER_AGX; we.environment = e; vp.add_child(we)
	_icons[key] = vp.get_texture()
	return _icons[key]

## Tray families: one tile per part, with its values (resistors) stepped on the tile.
func tray_families() -> Array:
	var fams: Array = []
	var by := {}
	for it in drawer():
		var k := str(it.partId) + "|" + str(it.variant)
		if not by.has(k): by[k] = {"name": _fam_name(it), "items": []}; fams.append(by[k])
		by[k].items.append(it)
	return fams

func _fam_name(it: Dictionary) -> String:
	if str(it.kind) == "R":
		if str(it.partId) == "trimmer": return "Trimmer"
		var t := str(it.get("tag", "")).replace("Resistor", "").strip_edges()
		return "Resistor" + ((" " + t) if t != "" else "")
	var l := str(it.label)
	return l if it.get("value", null) == null else str(it.get("tag", l))

## ------------------------------------------------------------------------------------------------ board sync

func sync_board() -> void:
	if board == null: return
	var sp := ""
	var shown: Array = backend._all_parts if not backend._all_parts.is_empty() else backend.parts   # the 3D bench shows the PP3 too (the classic stall drew it in its supply view)
	for p in shown: sp += "%s:%s:%d:%d:%d|" % [p.uid, p.partId, p.x, p.y, p.rot]
	if sp != _sig_parts:
		_sig_parts = sp
		var keep := {}
		for p in shown:
			var key := "%s:%d:%d:%d" % [p.uid, p.x, p.y, p.rot]
			keep[str(p.uid)] = true
			if parts3d.has(p.uid) and str(parts3d[p.uid].get_meta("key", "")) == key: continue
			if parts3d.has(p.uid): parts3d[p.uid].queue_free()
			var n := Part3D.make(p)
			n.set_meta("key", key)
			board.add_child(n)
			n.position = board.pad_local(int(p.x), int(p.y))
			n.rotation.y = -float(p.rot) * PI / 2.0
			parts3d[p.uid] = n
		for u in parts3d.keys(): if not keep.has(u): parts3d[u].queue_free(); parts3d.erase(u)
	var sw := ""
	for w in backend.wires: sw += "%s:%s|" % [w.wid, str(w.path)]
	if sw != _sig_wires:
		_sig_wires = sw
		for k in wires3d: wires3d[k].queue_free()
		wires3d.clear()
		var i := 0
		for w in backend.wires:
			var n := Wire3D.new(); board.add_child(n)
			n.wid = str(w.wid)
			n.build(w.path, Wire3D.palette(i + 2), bool(w.get("fixed", false)), board, 0.0004 * (i % 3))
			wires3d[w.wid] = n; i += 1
	_probes(); _meter_leads()
	_refresh_targets()   # 0.5: the target rings follow the board

func _probes() -> void:
	var pad = backend.probes.get("ch1", null)
	if pad == null:
		if probe_node: probe_node.visible = false
		if probe_cable: probe_cable.visible = false
		return
	if probe_node == null:
		probe_node = Node3D.new(); add_child(probe_node)
		var pm := MeshKit.mat(Color(0.14, 0.145, 0.155), 0.55)
		MeshKit.add(probe_node, MeshKit.tube(PackedVector3Array([Vector3(0.001, 0.012, 0.003), Vector3(0.012, 0.017, 0.045)]), 0.0022, 16), pm)
		MeshKit.add(probe_node, MeshKit.tube(PackedVector3Array([Vector3(0.0001, 0.0118, 0.0004), Vector3(0.0012, 0.0124, 0.0048)]), 0.0029, 16), pm)   # finger guard
		MeshKit.add(probe_node, MeshKit.tube(PackedVector3Array([Vector3(0, 0.003, 0), Vector3(0, 0.013, -0.002)]), 0.0014, 10), MeshKit.mat(Color(0.25, 0.26, 0.28), 0.5))
		var hook := PackedVector3Array()
		for i in 10: hook.append(Vector3(0.0012 * sin(i * 0.6), 0.003 - i * 0.0004, 0.0012 * cos(i * 0.6) - 0.0012))
		MeshKit.add(probe_node, MeshKit.tube(hook, 0.00035, 6), MeshKit.m("steel"))
		var ring := TorusMesh.new(); ring.inner_radius = 0.0021; ring.outer_radius = 0.0028
		MeshKit.add(probe_node, ring, MeshKit.mat(Color(0.95, 0.8, 0.1), 0.4, 0.0, {"emission": Color(0.95, 0.8, 0.1), "emission_energy": 0.4}), Vector3(0.009, 0.016, 0.034), Vector3(1.46, deg_to_rad(-15.0), 0))
	probe_node.visible = true
	var top := board.pad_world(int(pad[0]), int(pad[1]))
	probe_node.global_position = top
	var from := top + Vector3(0.012, 0.017, 0.045)
	if probe_node.has_meta("gnd"): (probe_node.get_meta("gnd") as Node).queue_free()
	for c in board.connectors:
		if str(c.role) == "ground":
			var g := board.pad_world(int(c.pad[0]), int(c.pad[1])) + Vector3(0, 0.012, 0)
			var gm := MeshKit.add(self, MeshKit.tube(_catenary(top + Vector3(0.006, 0.014, 0.022), g, 0.01, 12), 0.0007, 6), MeshKit.m("black_plastic"))
			MeshKit.add(gm, MeshKit.rounded_box(Vector3(0.0025, 0.002, 0.007), 0.0006), MeshKit.m("black_plastic"), g)
			probe_node.set_meta("gnd", gm); break
	var to: Vector3 = (scope.global_position + Vector3(0.11, 0.03, 0.08)) if scope else Vector3(-0.2, 0.03, -0.17)
	if probe_cable: probe_cable.queue_free()
	probe_cable = MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(PackedVector3Array([from, from + Vector3(0.0, -0.01, 0.05), Vector3(to.x, 0.004, from.z + 0.05), to]), 0.04, 6), 0.0013, 8), MeshKit.mat(Color(0.12, 0.12, 0.13), 0.55))

var _lead_sig := ""
func _meter_leads() -> void:
	var sig := "%s|%s" % [str(backend.probes.get("red", null)), str(backend.probes.get("black", null))]
	if sig == _lead_sig: return
	_lead_sig = sig
	for k in meter_leads: if is_instance_valid(meter_leads[k]): meter_leads[k].queue_free()
	meter_leads.clear()
	if board == null or dmm == null: return
	for which in ["red", "black"]:
		var pad = backend.probes.get(which, null)
		if pad == null: continue
		var n := Node3D.new(); add_child(n); meter_leads[which] = n
		var top := board.pad_world(int(pad[0]), int(pad[1]))
		var col := Color(0.62, 0.07, 0.05) if which == "red" else Color(0.04, 0.04, 0.045)
		var m := MeshKit.mat(col, 0.45, 0.0, {"clearcoat": 0.3})
		MeshKit.add(n, MeshKit.tube(PackedVector3Array([top + Vector3(0, 0.002, 0), top + Vector3(0.004, 0.012, 0.03)]), 0.0017, 12), m)
		var jack := dmm.global_position + dmm.global_transform.basis * Vector3(-0.02 if which == "red" else 0.02, 0.02, 0.06)
		MeshKit.add(n, MeshKit.tube(_catenary(top + Vector3(0.004, 0.012, 0.03), jack, 0.05), 0.0011, 8), m)

func _catenary(a: Vector3, b: Vector3, sag: float, n := 24) -> PackedVector3Array:
	var out := PackedVector3Array()
	for i in n + 1:
		var t := float(i) / n
		var p := a.lerp(b, t)
		p.y = maxf(0.004, p.y - sag * 4.0 * t * (1.0 - t))
		out.append(p)
	return out

## Leads from the instruments to the ticket's connectors (supply to V12 and GND, the MCU pin to PIN, the fan to its terminal).
func _cables() -> void:
	for c in cables_root.get_children(): c.queue_free()
	if board == null: return
	var post := func(id: String) -> Vector3:
		for c in board.connectors:
			if str(c.id) == id: return board.pad_world(int(c.pad[0]), int(c.pad[1])) + Vector3(0, 0.012, 0)
		return Vector3.INF
	var red := MeshKit.mat(Color(0.6, 0.06, 0.05), 0.45, 0.0, {"clearcoat": 0.3}); var blk := MeshKit.mat(Color(0.04, 0.04, 0.045), 0.45, 0.0, {"clearcoat": 0.3})
	var add := func(a: Vector3, b: Vector3, m: Material, sag: float) -> void:
		if a == Vector3.INF or b == Vector3.INF: return
		MeshKit.add(cables_root, MeshKit.tube(_catenary(a, b + Vector3(0, 0.012, 0), sag), 0.0011, 8), m)
		# minigrabber clip: dark body, coloured collar, steel hook onto the post
		MeshKit.add(cables_root, MeshKit.tube(PackedVector3Array([b + Vector3(0, 0.012, 0), b + Vector3(0, 0.003, 0)]), 0.0017, 12), MeshKit.m("black_plastic"))
		MeshKit.add(cables_root, MeshKit.tube(PackedVector3Array([b + Vector3(0, 0.0115, 0), b + Vector3(0, 0.0095, 0)]), 0.0019, 12), m)
		MeshKit.add(cables_root, MeshKit.tube(PackedVector3Array([b + Vector3(0, 0.003, 0), b + Vector3(0.0012, 0.001, 0)]), 0.0003, 6), MeshKit.m("steel"))
	var pr: Vector3 = _call(psu, "post_world", [0]) if psu and psu.has_method("post_world") else Vector3(0.28, 0.04, -0.17)
	var pb: Vector3 = _call(psu, "post_world", [1]) if psu and psu.has_method("post_world") else Vector3(0.31, 0.04, -0.17)
	# the bench supply's leads go to the ticket's own supply connectors (5-1: V12/GND, 1-3: IN/GND); a battery ticket uses no supply
	var plus := ""; var minus := ""
	for sd in backend.card.get("supplies", []):
		if str(sd.get("kind", "")) == "bench": plus = str(sd.get("plus", "")); minus = str(sd.get("minus", "")); break
	if plus == "" and ticket_id == TICKET: plus = "V12"; minus = "GND"
	if mode == "free": plus = "V12"; minus = "GND"
	if plus != "":
		add.call(pr, post.call(plus), red, 0.06)
		add.call(pb, post.call(minus), blk, 0.05)
	if iso_box and iso_box.visible:   # 4-1: the isolated mains leads (brown live, blue neutral) from the transformer's outlet to L and N
		for sd in backend.card.get("supplies", []):
			if str(sd.get("kind", "")) != "mains": continue
			add.call(iso_box.outlet_world(0), post.call(str(sd.plus)), MeshKit.mat(Color(0.36, 0.20, 0.10), 0.5), 0.05)
			add.call(iso_box.outlet_world(1), post.call(str(sd.minus)), MeshKit.mat(Color(0.10, 0.26, 0.62), 0.5), 0.05)
	if mcu and mcu.visible:
		var mp: Vector3 = _call(mcu, "pin_world") if mcu.has_method("pin_world") else Vector3(-0.17, 0.02, 0.1)
		add.call(mp, post.call("PIN"), MeshKit.mat(Color(0.85, 0.66, 0.08), 0.45), 0.02)
	for p in backend.parts:
		if str(p.partId).begins_with("fan"):
			for i in 2:
				var a: Vector3 = _call(fan, "lead_end_world", [i]) if fan and fan.has_method("lead_end_world") else Vector3(0.03, 0.02, -0.18)
				var pin: Array = p.pins[i]
				add.call(a, board.pad_world(int(pin[0]), int(pin[1])) + Vector3(0, 0.011, 0), red if i == 0 else blk, 0.03)

## ------------------------------------------------------------------------------------------------ live loop

func _exit_tree() -> void:
	if backend != null and is_instance_valid(backend): backend.stop_live_worker()

func _process(dt: float) -> void:
	_update_camera(dt)
	if OS.get_environment("CB_FRAMETIME") != "": _frametime(dt)
	if mode == "title":
		g_yaw += dt * 0.05
		return
	if not paused: backend.step(dt)
	sync_board()
	_live(dt)

func _live(dt: float) -> void:
	_flow(dt)
	var f: Dictionary = backend.frame
	# the engine's board list says which parts are burnt (a repair's arrived-burnt part stays charred with the power off)
	var burnt := {}
	for bp in backend.bench_q.get("parts", []): if bool(bp.get("smoked", false)): burnt[str(bp.uid)] = true
	for p in f.get("parts", []):
		var n: Part3D = parts3d.get(str(p.uid), null)
		if n == null: continue
		if thermal: n.set_thermal(float(p.get("temp", 25.0)))
		else: n.set_thermal(-1.0); n.set_heat(backend._heat(p))
		if n.anim.has("strip"): n.set_strip(absf(float(p.get("i", backend.part_current(str(p.uid))))) / 0.3)   # 5-2: the strip's 0.3 A is full brightness
		n.set_smoked(bool(p.get("smoked", false)) or backend.smoked.has(str(p.uid)) or burnt.has(str(p.uid)))
		if p.has("led"): n.set_led(float(p.led.get("mA", 0.0)), float(p.led.get("bloom", 0.0)))
		if p.has("galvo"): n.set_needle(float(p.galvo.get("needle", 0.0)), float(p.galvo.get("uA", 0.0)))
		if p.has("relay"):
			var op := bool(p.relay.get("operated", false))
			# 0.6: the armature is heard when it pulls in or drops out (the relay timer, 3-3); nobody has listened to it yet
			if sfx and op != bool(_relay_was.get(str(p.uid), false)): sfx.play("clack", 1.25 if op else 0.9)
			_relay_was[str(p.uid)] = op
			n.set_relay(op, float(p.relay.get("mA", 0.0)))
		if p.has("cap") and n.anim.has("level"):
			var vf := float(p.cap.get("vfull", 0.0))
			if vf > 0.0: n.set_level(float(p.cap.get("v", 0.0)) / vf)
	if not backend.powered:   # power off: every LED goes dark (the frame stops listing them, which left the last glow on)
		for u in parts3d:
			var pn: Part3D = parts3d[u]
			pn.set_led(0.0, 0.0)
			if pn.anim.has("needle"): pn.set_needle(0.0, 0.0)
			if pn.anim.has("armature"): pn.set_relay(false, 0.0)
			if pn.anim.has("level"): pn.set_level(1.0)   # a capacitor that arrives charged
	for sp in backend.parts:   # the jockey is the engine's number, with the power off too
		if str(sp.kind) == "SLIDE" and parts3d.has(str(sp.uid)): (parts3d[str(sp.uid)] as Part3D).set_jockey(float(sp.pos) if sp.get("pos", null) != null else 0.5)
	var closed := {}
	for ct in f.get("contacts", []): closed[str(ct.id)] = bool(ct.closed)
	for cid in contacts3d: (contacts3d[cid] as Contact3D).set_closed(bool(closed.get(cid, false)) and backend.powered, dt)
	for u in parts3d: if not backend.powered: (parts3d[u] as Part3D).set_smoked(burnt.has(u) or backend.smoked.has(u))
	# the fan: speed from its own current (200 mA = full speed)
	var fi := 0.0
	for p in f.get("parts", []):
		if str(p.uid) == "f1" and (p.get("pins", []) as Array).size() > 0: fi = absf(float(p.pins[0].i))
	_call(fan, "set_speed", [clampf(fi / 0.2, 0.0, 1.0) if backend.powered else 0.0])
	# supply, MCU, meter
	var amps := 0.0
	for n2 in f.get("parts", []): if str(n2.uid) == "f1": amps = fi
	_call(psu, "set_output", [backend.powered]); _call(psu, "set_values", [backend.supply_volts() if backend.supply_volts() > 0 else 12.0, amps if backend.powered else 0.0])
	var sel := pin_mode()
	_call(mcu, "set_powered", [backend.powered]); _call(mcu, "set_pin_mode", [sel])
	var d := backend.dmm()
	_call(dmm, "set_reading", [str(d.get("text", "")), str(d.get("unit", "")), str(d.get("mode", "OFF"))]); _call(dmm, "set_dial", [backend.dial])
	# scope: live samples at the CH1 probe; frozen capture after a failure
	_call(scope, "set_powered", [true])
	var now := Time.get_ticks_msec() / 1000.0
	if now > capture_until:
		var v: Array = backend.scope_q.get("v", []) if backend.powered and backend.probes.get("ch1", null) != null else []
		var vpd: Array = backend.bench_q.get("instruments", {}).get("scope", {}).get("voltsPerDiv", [5.0, 5.0]) if backend.bench_q.get("instruments", {}).get("scope", null) is Dictionary else [5.0, 5.0]
		_call(scope, "set_samples", [v, float(backend.scope_q.get("dt", 7.8125e-5)), float(vpd[0]), float(backend.scope_q.get("timePerDiv", 0.002))])
		_call(scope, "set_status", ["RUN" if backend.powered else "STOP"])
		var lines: Array = []
		if not v.is_empty():
			var mx := -1e9; var mn := 1e9
			for x in v: mx = maxf(mx, float(x)); mn = minf(mn, float(x))
			lines = ["max %s V" % EngineBench._g(mx, 3), "min %s V" % EngineBench._g(mn, 3)]
			if sel == "100 Hz": lines.append("Freq 100 Hz")
		_call(scope, "set_measure", [lines])
	for s in smoke_fx:
		if is_instance_valid(s): pass

func pin_mode() -> String:
	for s in backend.selectors:
		if str(s.id) == "pin": return str((s.options as Array)[int(s.index)])
	return "high"

func _frametime(dt: float) -> void:
	_ft_t += dt
	if _ft_t > 3.0: _ft.append(dt)
	if _ft_t > 3.0 + float(OS.get_environment("CB_FRAMETIME")):
		_ft.sort()
		var s := 0.0
		for x in _ft: s += x
		# 0.6: p99 and the worst frame too: the live simulation runs every 1/30 s, so at a high frame rate p95 hid its frames
		print("FRAMETIME avg %.2f ms  p95 %.2f ms  p99 %.2f ms  max %.2f ms  live %s  frames %d  size %s x%s  tier %s  method %s  gpu %s" % [1000.0 * s / _ft.size(), 1000.0 * _ft[int(_ft.size() * 0.95)], 1000.0 * _ft[int(_ft.size() * 0.99)], 1000.0 * _ft[_ft.size() - 1], "worker" if backend.async_live else "main", _ft.size(), str(get_viewport().get_visible_rect().size), str(get_viewport().scaling_3d_scale), quality, RenderingServer.get_current_rendering_method(), RenderingServer.get_video_adapter_name()])
		get_tree().quit()

## ------------------------------------------------------------------------------------------------ engine events

## One cue per bench event: the rocker clicks, a part thunks into its holes, a wire zips, a burnt resistor pops and an LED cracks,
## a failed test buzzes low, a pass chimes and the pay rings up. Recipes in StallSfx.RECIPES.
func _sound(name: String, data: Dictionary) -> void:
	if sfx == null: return
	match name:
		"power": sfx.play("click")
		"placed": sfx.play("thunk")
		"wired": sfx.play("zip", 0.7)
		"deleted": sfx.play("clack", 0.8)
		"smoked": if not bool(data.get("arrived", false)): sfx.play("crack" if str(data.get("kind", "")) == "LED" else "pop")
		"bench_failed": sfx.play("bad", 0.8)
		"paid":
			sfx.play("chime")
			if int(data.get("pay", 0)) > 0: get_tree().create_timer(0.45).timeout.connect(func(): sfx.play("kaching", 0.8))

func _flow(dt: float) -> void:
	var on := cute and backend.powered and mode != "title"
	var fw := {}
	if on:
		for w in backend.frame.get("wires", []): fw[str(w.wid)] = w
	for id in wires3d:
		var w: Dictionary = fw.get(id, {})
		(wires3d[id] as Wire3D).set_flow(float(w.get("i", 0.0)), float(w.get("speed", 0.0)), dt, on and not w.is_empty())

func set_cute(on: bool) -> void:
	cute = on
	if not _nosave():
		var cf := ConfigFile.new(); cf.load("user://look2.cfg"); cf.set_value("look", "cute", on); cf.save("user://look2.cfg")
	note = "Cute mode on: beads ride every wire that carries current, at the engine's speed." if on else "Cute mode off."
	changed.emit()

func set_sound(on: bool) -> void:
	sfx.enabled = on
	if not _nosave():
		var cf := ConfigFile.new(); cf.load("user://look2.cfg"); cf.set_value("audio", "sound", on); cf.save("user://look2.cfg")
	if on: sfx.play("tick")
	changed.emit()

func _load_sound_pref() -> bool:
	var cf := ConfigFile.new()
	return cf.load("user://look2.cfg") != OK or bool(cf.get_value("audio", "sound", true))

func _on_event(name: String, data: Dictionary) -> void:
	_sound(name, data)
	match name:
		"smoked" when bool(data.get("arrived", false)):
			# the customer's burn, seen on the first powered frame: no smoke, no blame, and the way out
			var nm: String = {"LED": "LED", "R": "resistor"}.get(str(data.get("kind", "")), "part")
			last_failure = {"title": "This %s arrived burnt" % nm, "text": "It was already burnt when the %s came in. A burnt part passes no current, whatever you wire around it. Right-click it to take it out, then fit a new one from the sorting box." % str(DeviceCase.device_of(ticket_id)[1]).get_slice("  ", 0).to_lower(), "uid": str(data.uid)}
			changed.emit()
		"smoked":
			var n: Part3D = parts3d.get(str(data.uid), null)
			if n: _smoke_at(n.global_transform * n._centre())
			var b = backend._q("bench")   # the burn bill changes the moment a part burns: show it now, not at the next edit
			if b is Dictionary: backend.bench_q = b
			var vce := 0.0; var vceo := 0.0
			var ex = null
			for e in backend.frame.get("events", []):
				if str(e.part) == str(data.uid) and e.get("failureId", null) != null: ex = backend._q("explain", [int(e.failureId)])
			if ex is Dictionary:
				var vars: Dictionary = ex.get("vars", {})
				vce = float(vars.get("vPeak", vars.get("vce", 0.0))); vceo = float(vars.get("vceo", 0.0))
			if vce > 0.0:
				_call(scope, "show_capture", [vce, vceo, 0.3]); capture_until = Time.get_ticks_msec() / 1000.0 + 1e6
			last_failure = {"title": _fail_title(str(data.get("kind", "")), vce), "text": str(data.get("text", "")), "uid": str(data.uid)}
			var cv := backend.coach_view()
			var cur := int(cv.get("cur", -1))
			if cur >= 0 and board:
				var tg := str(cv.steps[cur].get("target", ""))
				if tg.begins_with("pad:"):
					var xy := tg.substr(4).split(","); board.set_marks([[int(xy[0]), int(xy[1])]], Color(0.95, 0.4, 0.3))
			changed.emit()
		"bench_failed":
			# 0.6 (Tess on 1-2): the first failure's numbers stayed on the ticket through later tests ("LED 1: 3.71 mA" at 12 mA).
			# Each failed test replaces the text; a burn's own explanation (it carries the part) stays until it is dealt with.
			if last_failure.is_empty() or not last_failure.has("uid"): last_failure = {"title": "Last test failed", "text": str(data.get("text", ""))}
			changed.emit()
		"paid":
			var st := int(data.get("stars", 0))
			if int(data.get("pay", 0)) > 0 or _paid_text == "":   # a repeat pass pays nothing: keep the first pay on the ticket
				_paid_text = str(data.get("pay_text", "")) if int(data.get("pay", 0)) > 0 else "nothing more (already paid)"
				if int(data.get("burnt", 0)) > 0: _paid_text += " after %s for burnt parts" % burn_cost_text()
			if int(data.get("pay", 0)) > 0:
				var extras: Array = []
				if st > 0: extras.append("%d new star%s" % [st, "" if st == 1 else "s"])
				if int(data.get("tip", 0)) > 0: extras.append("a %s tip from %s, who waited" % [str(data.get("tip_text", "")), str(backend.ticket.get("customer", "the customer"))])
				var tail := ""
				if extras.size() == 1: tail = " and " + str(extras[0])
				elif extras.size() == 2: tail = ", " + str(extras[0]) + " and " + str(extras[1])
				note = "Bench test passed. Paid %s: the %s fee%s." % [str(data.get("pay_text", "")), str(backend.ticket.get("price_text", "")), tail]
			else: note = "Bench test passed again. This job is already paid."   # was "Paid : the $4.00 fee" with the amount missing
			last_failure = {}; changed.emit()
		"wired":
			# Rui (0.6 replay): "it says the wire connects nothing, but which end?" The bare end gets a red ring until the next edit.
			if board: board.set_marks(data.get("dangling", []), Color(0.95, 0.3, 0.25))
			if not last_failure.is_empty(): last_failure = {}; capture_until = 0.0
			changed.emit()
		"placed", "deleted":
			if board: board.set_marks([])
			if not last_failure.is_empty(): last_failure = {}; capture_until = 0.0
			changed.emit()
		"power", "lock":
			# an edit or a power change makes the last bench verdict stale: clear it so the ticket never shows an old failure (Noor, 1-5)
			if name in ["wired", "placed", "deleted"] and not last_failure.is_empty(): last_failure = {}; capture_until = 0.0   # not on power: a burn explanation stays readable after switching off
			changed.emit()

func _fail_title(kind: String, vce: float) -> String:
	if vce > 0.0: return "Q1 failed: collector over-voltage at turn-off"
	if kind == "R": return "Resistor burnt: too much power"
	if kind == "LED": return "LED burnt: too much current"
	return "A part burnt"

func _smoke_at(p: Vector3) -> void:
	# a thin grey wisp, not a cloud: many small, faint sprites in one rising column that widens and drifts with the room air
	var ps := GPUParticles3D.new(); ps.amount = 260; ps.lifetime = 5.0; ps.explosiveness = 0.0; ps.randomness = 0.4; ps.fixed_fps = 0
	ps.visibility_aabb = AABB(Vector3(-0.2, -0.05, -0.2), Vector3(0.4, 0.5, 0.4))
	ps.draw_order = GPUParticles3D.DRAW_ORDER_VIEW_DEPTH
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE; pm.emission_sphere_radius = 0.0012
	pm.direction = Vector3(0, 1, 0); pm.spread = 6.0; pm.initial_velocity_min = 0.016; pm.initial_velocity_max = 0.022
	pm.gravity = Vector3(0.0045, 0.006, -0.0015); pm.damping_min = 0.001; pm.damping_max = 0.002
	pm.angle_min = -180.0; pm.angle_max = 180.0; pm.angular_velocity_min = -12.0; pm.angular_velocity_max = 12.0
	pm.scale_min = 0.8; pm.scale_max = 1.2
	var sc := Curve.new(); sc.add_point(Vector2(0, 0.12)); sc.add_point(Vector2(0.35, 0.6)); sc.add_point(Vector2(1, 2.2)); var sct := CurveTexture.new(); sct.curve = sc; pm.scale_curve = sct
	var g := Gradient.new()   # set both arrays at once: set_color(i) after add_point indexes the sorted list and left the end white
	g.offsets = PackedFloat32Array([0.0, 0.06, 0.45, 1.0]); g.colors = PackedColorArray([Color(0.28, 0.28, 0.30, 0.0), Color(0.30, 0.30, 0.32, 0.32), Color(0.40, 0.41, 0.43, 0.14), Color(0.46, 0.47, 0.49, 0.0)])
	var gt := GradientTexture1D.new(); gt.gradient = g; pm.color_ramp = gt
	pm.turbulence_enabled = false   # turbulence clumps particles into beads at this scale
	pm.tangential_accel_min = -0.002; pm.tangential_accel_max = 0.002
	ps.process_material = pm
	var q := QuadMesh.new(); q.size = Vector2(0.016, 0.016)
	var m := StandardMaterial3D.new(); m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES; m.vertex_color_use_as_albedo = true
	m.billboard_keep_scale = true; m.roughness = 1.0; m.proximity_fade_enabled = true; m.proximity_fade_distance = 0.01
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED   # smoke must not catch the warm lamp and turn into cream puffs
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	for y in 64:
		for x in 64:
			var d := Vector2(x - 31.5, y - 31.5).length() / 32.0
			var a2 := clampf(1.0 - d, 0.0, 1.0); a2 = a2 * a2 * a2
			img.set_pixel(x, y, Color(1, 1, 1, a2))
	m.albedo_texture = ImageTexture.create_from_image(img); q.material = m
	ps.draw_pass_1 = q
	add_child(ps); ps.global_position = p + Vector3(0, 0.010, 0)
	ps.preprocess = 2.0
	var ember := OmniLight3D.new(); ember.light_color = Color(1.0, 0.35, 0.05); ember.light_energy = 1.4; ember.omni_range = 0.09; ps.add_child(ember)
	smoke_fx.append(ps)
	get_tree().create_timer(9.0).timeout.connect(func(): if is_instance_valid(ps): ps.emitting = false)
	get_tree().create_timer(14.0).timeout.connect(func(): if is_instance_valid(ps): ps.queue_free())

## ------------------------------------------------------------------------------------------------ input

func ray_pad(mp: Vector2) -> Vector2i:
	if board == null: return Vector2i(-1, -1)
	var o := cam.project_ray_origin(mp); var d := cam.project_ray_normal(mp)
	var hit = board.plane_world().intersects_ray(o, d)
	if hit == null: return Vector2i(-1, -1)
	var pad: Vector2i = board.pad_at_world(hit)
	# wires and leads go onto legs: a player aims at the leg as drawn, which stands above its pad. If the board-level pad is empty
	# and the ray at leg height lands on a pad with a leg or a wire end, take that one (Noor: clicks landed "one row short").
	if tool in ["wire", "red", "black", "probe"] and not _pad_used(pad):
		for h in [0.003, 0.006, 0.010, 0.014]:
			var hit2 = _plane_at(h).intersects_ray(o, d)
			if hit2 == null: continue
			var pad2: Vector2i = board.pad_at_world(hit2 - board.global_transform.basis.y.normalized() * h)
			if _pad_used(pad2): return pad2
	return pad

## The board plane raised by h metres (a part body or a leg top sits above the pads).
func _plane_at(h: float) -> Plane:
	var n: Vector3 = board.global_transform.basis.y.normalized()
	return Plane(n, board.global_position + n * h)

var _pad_tip_shown := false
const ROLE_TEXT := {"source": "where the supply's plus comes in", "supply": "where the supply's plus comes in", "ground": "ground, the supply's minus", "load": "a terminal of the device"}

## What is at a pad, in a few words: a connector and its role, a part's leg, or a wire end. "" for an empty hole.
func pad_tip(pad: Vector2i) -> String:
	var q: Dictionary = backend.bench_q
	for c in q.get("connectors", []):
		var cp: Array = c.get("pad", [])
		if cp.size() == 2 and int(cp[0]) == pad.x and int(cp[1]) == pad.y: return "%s: %s" % [str(c.get("id", "")), str(ROLE_TEXT.get(str(c.get("role", "")), "a terminal of the board"))]
	for p in q.get("parts", []):
		for pin in p.get("pins", []):
			var pp: Array = pin.get("pad", [])
			if pp.size() == 2 and int(pp[0]) == pad.x and int(pp[1]) == pad.y:
				var lab := str(pin.get("label", "")); if lab == "": lab = str(pin.get("name", ""))
				return "%s, %s leg" % [str(p.get("name", "part")), lab] if lab != "" else "%s leg" % str(p.get("name", "part"))
	if _pad_used(pad): return "A wire end"
	return ""

## The pads an end can go to: every leg, connector and wire end on the board.
func connect_targets() -> Array:
	var out: Array = []; var seen := {}
	var q: Dictionary = backend.bench_q
	for c in q.get("connectors", []):
		var cp: Array = c.get("pad", []); if cp.size() == 2 and not seen.has(str(cp)): seen[str(cp)] = true; out.append(cp)
	for p in q.get("parts", []):
		for pin in p.get("pins", []):
			var pp: Array = pin.get("pad", []); if pp.size() == 2 and not seen.has(str(pp)): seen[str(pp)] = true; out.append(pp)
	return out

func _refresh_targets() -> void:
	if board: board.set_targets(connect_targets() if tool in ["wire", "red", "black", "probe"] else [])

func _pad_used(pad: Vector2i) -> bool:
	if pad.x < 0: return false
	for p in backend._all_parts:
		for q in p.pins: if int(q[0]) == pad.x and int(q[1]) == pad.y: return true
	for w in backend.wires:
		var path: Array = w.path
		if path.is_empty(): continue
		for e in [path[0], path[path.size() - 1]]: if int(e[0]) == pad.x and int(e[1]) == pad.y: return true
	return false

func ray_hit(mp: Vector2) -> String:
	var o := cam.project_ray_origin(mp); var d := cam.project_ray_normal(mp)
	var q := PhysicsRayQueryParameters3D.create(o, o + d * 5.0, 2)
	var r := get_world_3d().direct_space_state.intersect_ray(q)
	if r.is_empty(): return ""
	var c: Object = r.collider
	while c != null and not c.has_meta("hit") and c is Node and (c as Node).get_parent() != null: c = (c as Node).get_parent()
	return str(c.get_meta("hit")) if c != null and c.has_meta("hit") else ""

var _view_pose: Array = []   ## the camera goal set_view left (target, yaw, pitch, distance)

## True when the player has zoomed, orbited or panned since the last view key.
func _cam_moved() -> bool:
	if _view_pose.size() < 4: return false
	return g_tgt.distance_to(_view_pose[0]) > 0.002 or absf(g_yaw - float(_view_pose[1])) > 0.01 or absf(g_pitch - float(_view_pose[2])) > 0.01 or absf(g_dist - float(_view_pose[3])) > 0.002

func set_tool(t: String) -> void:
	# 0.6 (Tess, 15 minutes on 1-1): in the wide views the battery hid its own leads. A wire, lead or probe tool picked there moves
	# the camera to the top-down board view (key 5); keys 1-4 still go back.
	# Rui (0.6 replay): the jump threw away his zoom; it happens only while the camera still sits where the view key put it.
	if t in ["wire", "red", "black", "probe"] and tool != t and view in [1, 2] and not _cam_moved() and mode in ["job", "free"] and board != null and not case_closed():
		set_view(5)
	tool = t
	if t != "place": _clear_ghost()
	wire_from = Vector2i(-1, -1); _wire_click = false; _clear_wire_preview()   # any tool change (W again, Esc) drops a half-drawn wire
	_refresh_targets()
	changed.emit()

func pick_part(item: Dictionary) -> void:
	place_item = item; place_rot = 0; set_tool("place")
	_clear_ghost()
	ghost = Part3D.make({"partId": item.partId, "kind": item.kind, "value": item.value, "variant": item.variant, "label": item.label, "footprint": item.footprint, "uid": "ghost"})
	ghost.set_ghost(1); ghost.visible = false
	if board: board.add_child(ghost)

func _clear_ghost() -> void:
	if ghost: ghost.queue_free(); ghost = null

func _clear_wire_preview() -> void:
	if wire_preview: wire_preview.queue_free(); wire_preview = null

func _unhandled_input(e: InputEvent) -> void:
	if mode == "title": return
	if e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		var over_tray := {} if not (mb.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]) else _tray_slot_hit(ray_hit(mb.position))
		var over_volt := mb.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN] and ray_hit(mb.position) == "psu_volt"
		var over_wire := mb.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN] and not over_volt and ray_hit(mb.position) == "slidewire"
		if over_wire:
			if mb.pressed: jockey_step((1.0 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else -1.0) * (0.1 if mb.shift_pressed else (10.0 if mb.ctrl_pressed else backend.jockey_step_mm())))
		elif over_volt:
			if mb.pressed: supply_step((1 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else -1) * (0.01 if mb.shift_pressed else (1.0 if mb.ctrl_pressed else 0.1)))
		elif not over_tray.is_empty():
			if mb.pressed:
				var fam: Dictionary = over_tray.fam
				tray_step(_fam_key(fam), fam.items, tray_index(fam) + (1 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else -1))
		elif mb.pressed and tool == "select" and _wheel_value(mb.position, 1 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else -1): pass
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed: g_dist = clampf(g_dist * 0.9, 0.12, 1.6)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed: g_dist = clampf(g_dist * 1.1, 0.12, 1.6)
		elif mb.button_index == MOUSE_BUTTON_MIDDLE: _drag = "pan" if mb.pressed else ""
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			if mb.pressed: _drag = "orbit_pending"; _last_mouse = mb.position
			else:
				if _drag == "orbit_pending": _right_click(mb.position)
				_drag = ""
		elif mb.button_index == MOUSE_BUTTON_LEFT: _left(mb.pressed, mb.position)
		_last_mouse = mb.position
	elif e is InputEventMouseMotion:
		var mm := e as InputEventMouseMotion
		if _jockey_drag: _jockey_to(mm.position); return
		if _drag == "orbit_pending" and mm.position.distance_to(_last_mouse) > 4.0: _drag = "orbit"
		if _drag == "orbit":
			g_yaw -= mm.relative.x * 0.005; g_pitch = clampf(g_pitch - mm.relative.y * 0.004, deg_to_rad(-88), deg_to_rad(-5))
		elif _drag == "pan":
			var right := cam.global_transform.basis.x; var fwd := Vector3(cam.global_transform.basis.z.x, 0, cam.global_transform.basis.z.z).normalized()
			g_tgt += (-right * mm.relative.x + fwd * -mm.relative.y) * g_dist * 0.0015
			g_tgt = g_tgt.clamp(Vector3(-0.8, 0.0, -0.4), Vector3(0.8, 0.4, 0.5))
		_hover(mm.position)
		var hid := ray_hit(mm.position) if _drag == "" else ""
		var tsl := _tray_slot_hit(hid)
		if not tsl.is_empty():
			var t2 := "%s %s, %s each: click picks it%s" % [str(tsl.fam.name), str(tsl.item.label).get_slice("  ", 0) if tsl.item.get("value", null) != null else "", str(tsl.item.get("price_text", "")), ", wheel changes the value" if (tsl.fam.items as Array).size() > 1 else ""]
			if t2 != hover_tip: hover_tip = t2; changed.emit()
		elif hid == "slidewire":
			var t5 := "JOCKEY %.1f mm: drag on the wire, wheel steps %s mm (Shift 0.1, Ctrl 10), J changes the step" % [backend.jockey_mm(), String.num(backend.jockey_step_mm())]
			if t5 != hover_tip: hover_tip = t5; changed.emit()
		elif hid == "psu_output" or hid == "psu_test" or hid == "tray_page" or hid == "psu_volt":
			var t3: String = {"psu_output": "OUTPUT: power on or off (Space)", "psu_test": "TEST: run the bench test (Enter)", "tray_page": "Next drawer of parts",
				"psu_volt": "VOLTAGE %.2f V: wheel 0.1 V, Shift 0.01 V, Ctrl 1 V" % backend.supply_volts()}[hid]
			if t3 != hover_tip: hover_tip = t3; changed.emit()
		elif tool == "select" and _drag == "" and not case_closed(): _set_pick_hl(_pick_item(mm.position))
		elif hover_tip != "" and _pick_hl.is_empty(): hover_tip = ""; changed.emit()
	elif e is InputEventKey and e.pressed and not e.echo:
		var k := e as InputEventKey
		var kc: int = k.keycode if k.keycode != KEY_NONE else k.physical_keycode   # some X input tools send only the physical code
		match kc:
			KEY_1: set_view(1)
			KEY_2: set_view(2)
			KEY_3: set_view(3)
			KEY_4: set_view(4)
			KEY_5: set_view(5)
			KEY_TAB: ui.toggle_schematic()
			KEY_W: set_tool("wire")
			KEY_P: set_tool("probe")
			KEY_M: set_tool("red")
			KEY_ESCAPE: set_tool("select")
			KEY_R:
				if tool == "place": place_rot = (place_rot + 1) % 4; _hover(get_viewport().get_mouse_position())
			KEY_O: open_case()
			KEY_LEFT: jockey_step(-(0.1 if k.shift_pressed else (10.0 if k.ctrl_pressed else backend.jockey_step_mm())))
			KEY_RIGHT: jockey_step(0.1 if k.shift_pressed else (10.0 if k.ctrl_pressed else backend.jockey_step_mm()))
			KEY_J: jockey_cycle()
			KEY_K: if mode == "free": Testbed.set_running(self, testbed_paused)   # 0.5 testbed: pause / run the simulation
			KEY_L: if mode == "free" and testbed_paused: Testbed.step_once(self)   # one frame forward while paused
			KEY_C: set_cute(not cute)
			KEY_T: toggle_thermal()
			KEY_H: if backend.passed and not handed: hand_back()
			KEY_BRACKETLEFT, KEY_BRACKETRIGHT:
				if tool == "place":
					for fam in tray_families():
						if str(fam.items[0].partId) == str(place_item.get("partId", "")) and str(fam.items[0].variant) == str(place_item.get("variant", "")):
							tray_step(_fam_key(fam), fam.items, tray_index(fam) + (1 if kc == KEY_BRACKETRIGHT else -1))
			KEY_SPACE: toggle_power()
			KEY_ENTER, KEY_KP_ENTER: run_test()
			KEY_Z:
				if k.ctrl_pressed: undo()
			KEY_PERIOD: if paused: backend._act("advance", [1]); backend._refresh_live(); backend._rebuild_model()
		get_viewport().set_input_as_handled()

var qa_hover_lock := false
func _hover(mp: Vector2, qa := false) -> void:
	if qa_hover_lock and not qa: return
	var pad := ray_pad(mp)
	hover_pad = pad
	if board == null: return
	var ok := pad.x >= 0
	# a wire end or a meter lead on a pad with no leg connects nothing: the marker turns red before the click, not after (Noor)
	var dead := tool in ["wire", "red", "black"] and ok and not _pad_used(pad)
	board.set_hover(pad.x, pad.y, ok and tool in ["wire", "probe", "red", "black", "place"], Color(0.9, 0.18, 0.12) if dead else (Color(0.91, 0.64, 0.24) if tool != "probe" else Color(0.95, 0.85, 0.2)))
	if tool in ["wire", "red", "black", "probe"] and ok:
		# 0.5 (Noor): every pad says what is there, a connector, a leg or a wire end, before the click
		var t4 := "No leg here: this end would connect nothing" if dead else pad_tip(pad)
		if t4 != hover_tip and (t4 != "" or _pad_tip_shown): hover_tip = t4; _pad_tip_shown = t4 != ""; changed.emit()
	if tool == "place" and ghost:
		ghost.visible = ok
		if ok:
			ghost.position = board.pad_local(pad.x, pad.y); ghost.rotation.y = -place_rot * PI / 2.0
			ghost.set_ghost(1 if backend.can_place(place_item, pad.x, pad.y, place_rot) == "" else 2)
	if tool == "wire" and wire_from.x >= 0 and ok:
		_clear_wire_preview()
		var a := board.pad_world(wire_from.x, wire_from.y) + Vector3(0, 0.002, 0); var b := board.pad_world(pad.x, pad.y) + Vector3(0, 0.002, 0)
		if a.distance_to(b) > 0.001:
			var mid := (a + b) * 0.5 + Vector3(0, 0.006, 0)
			wire_preview = MeshKit.add(self, MeshKit.tube(MeshKit.round_corners(PackedVector3Array([a, mid, b]), 0.01, 6), 0.0011, 8), MeshKit.mat(Color(0.91, 0.64, 0.24), 0.4, 0.0, {"alpha": 0.7, "emission": Color(0.91, 0.64, 0.24), "emission_energy": 0.6}))

func _left(pressed: bool, mp: Vector2) -> void:
	if case_closed() and not handed:
		if pressed: open_case()
		return
	if pressed and tool == "select" and ray_hit(mp) == "slidewire" and not backend.slide_part().is_empty():
		_jockey_drag = true; _jockey_to(mp); return
	if not pressed and _jockey_drag:
		_jockey_drag = false; changed.emit(); return
	var pad := ray_pad(mp)
	if pressed:
		var hit := ray_hit(mp)
		if pad.x < 0 and hit != "": _hit(hit); return
		match tool:
			"place":
				if pad.x >= 0:
					var r := backend.place(place_item, pad.x, pad.y, place_rot)
					note = str(r.get("msg", "")); if r.ok: set_tool("select")
			"wire":
				if pad.x >= 0:
					if _wire_click and wire_from.x >= 0 and pad != wire_from:   # click, then click: the second click ends the wire
						var rw := backend.add_wire([wire_from.x, wire_from.y], [pad.x, pad.y])
						note = str(rw.get("note", rw.get("msg", ""))); wire_from = Vector2i(-1, -1); _wire_click = false; _clear_wire_preview()
					else: wire_from = pad; _wire_click = false
			"probe":
				if pad.x >= 0: var r2 := backend.set_probe("ch1", [pad.x, pad.y]); note = str(r2.get("msg", "")); set_tool("select")
			"red", "black":
				if pad.x >= 0:
					if backend.dial == "OFF": backend.set_dial("V")
					var r3 := backend.set_probe(tool, [pad.x, pad.y]); note = str(r3.get("msg", ""))
					set_tool("black" if tool == "red" else "select")
		changed.emit()
	else:
		if tool == "wire" and wire_from.x >= 0:
			if pad.x >= 0 and pad != wire_from:
				var r := backend.add_wire([wire_from.x, wire_from.y], [pad.x, pad.y])
				note = str(r.get("note", r.get("msg", "")))
			elif pad == wire_from:
				# released where it started: a click, not a drag (Noor clicked twice and nothing happened, 0.4 hand play). Stay armed.
				_wire_click = true; note = "Wire from here: click the other end, or drag. Esc cancels."; changed.emit(); return
			wire_from = Vector2i(-1, -1); _wire_click = false; _clear_wire_preview(); changed.emit()

func _right_click(mp: Vector2) -> void:
	if tool != "select": set_tool("select"); return
	var it := _pick_item(mp)
	if it.is_empty(): return
	if it.kind == "part" and backend.replace_burnt(str(it.id)):
		note = str(backend.last_note); _set_pick_hl({}); changed.emit(); return
	if it.kind == "part":
		var nm := str(it.label)
		backend.delete_part(str(it.id))
		# the engine's own sentence: it names the wires that went with the part (they hung only on its legs); never silent (Noor)
		note = str(backend.last_note) if str(backend.last_note) != "" else "Removed the %s." % nm
		if note.contains("along with"): note += " Ctrl+Z puts them back."
	else:
		backend.delete_wire(str(it.id)); note = "Removed a wire."
	_set_pick_hl({}); changed.emit()

## What the pointer is over on the board, in board pad units: the nearest removable part (its body runs between its first and
## last leg) within 0.7 pad, else the nearest wire within 0.45 pad. Used for right-click removal and its hover highlight.
func _pick_item(mp: Vector2) -> Dictionary:
	if board == null: return {}
	var o := cam.project_ray_origin(mp); var dir := cam.project_ray_normal(mp)
	# a part's body stands above its pads: test the ray at several heights so a click on the body as drawn finds it
	# (at board level alone the hit fell behind the part and the player had to click 10 to 14 px low)
	var best := {}; var bd := 0.7
	var qs: Array = []
	for h in [0.0, 0.002, 0.004, 0.006, 0.008, 0.010, 0.013]:
		var hit = _plane_at(h).intersects_ray(o, dir)
		if hit == null: continue
		var l: Vector3 = board.to_local(hit - board.global_transform.basis.y.normalized() * h)
		qs.append([h, Vector2(l.x / P, l.z / P)])
	if qs.is_empty(): return {}
	for p in backend.parts:
		if bool(p.get("fixed", false)): continue
		var pins: Array = p.pins
		for hq in qs:
			var q: Vector2 = hq[1]
			for i in maxi(1, pins.size() - 1):
				var a := Vector2(float(pins[i][0]), float(pins[i][1])); var b := Vector2(float(pins[mini(i + 1, pins.size() - 1)][0]), float(pins[mini(i + 1, pins.size() - 1)][1]))
				var d := q.distance_to(Geometry2D.get_closest_point_to_segment(q, a, b))
				if d < bd: bd = d; best = {"kind": "part", "id": str(p.uid), "label": str(p.get("label", p.partId))}
	# a wire beside a part wins when the cursor is nearer the wire (Noor: right-click on a wire next to a resistor removed the resistor)
	var part_d := bd
	bd = minf(0.45, part_d - 0.05) if not best.is_empty() else 0.45
	for w in backend.wires:
		if bool(w.get("fixed", false)): continue
		var path: Array = w.path
		for hq in qs:
			if float(hq[0]) > 0.002: continue   # wires lie on the board
			var q: Vector2 = hq[1]
			for i in path.size() - 1:
				var d2 := q.distance_to(Geometry2D.get_closest_point_to_segment(q, Vector2(float(path[i][0]), float(path[i][1])), Vector2(float(path[i + 1][0]), float(path[i + 1][1]))))
				if d2 < bd: bd = d2; best = {"kind": "wire", "id": str(w.wid)}
	return best

var _pick_hl := {}
var _pick_hl_ms := 0
var _relay_was := {}   ## 0.6: the last armature state per relay uid (for its click)
var pot_alpha := {}   ## 0.6: the wiper position the wheel set on each panel pot (uid -> 0..1 from end A)
func _set_pick_hl(it: Dictionary) -> void:
	if str(it.get("id", "")) == str(_pick_hl.get("id", "")): return
	if str(it.get("id", "")) != "": _pick_hl_ms = Time.get_ticks_msec()
	for d in [_pick_hl, it]:
		if d.is_empty(): continue
		var on: bool = d == it
		var n = parts3d.get(str(d.id), null) if d.kind == "part" else wires3d.get(str(d.id), null)
		if n and is_instance_valid(n) and n.has_method("set_highlight"): n.set_highlight(on)
	_pick_hl = it
	var has_vals := false
	if not it.is_empty() and str(it.kind) == "part":
		for p in backend.parts: if str(p.uid) == str(it.id) and p.get("value", null) != null and not bool(p.get("fixed", false)): has_vals = true
	hover_tip = ("%s: %sright-click removes it" % [str(it.get("label", "wire")), "wheel changes the value, " if has_vals else ""]) if not it.is_empty() else ""
	changed.emit()
var hover_tip := ""

## ------------------------------------------------------------------------------------------------ the sorting box (the parts tray)

const SORT_BOX_AT := Vector3(-0.205, 0.0, 0.125)   ## front left of the case, below the ticket at 1280x800
var sort_box: SortBox
var tray_idx := {}          ## family key -> value index shown in its compartment
var _tray_sig := ""

func _fam_key(fam: Dictionary) -> String: return str(fam.items[0].partId) + "|" + str(fam.items[0].variant)

func _tray_default(items: Array) -> int:
	for i in items.size(): if str(items[i].label).begins_with("220 "): return i
	return items.size() / 2

func tray_index(fam: Dictionary) -> int: return int(tray_idx.get(_fam_key(fam), _tray_default(fam.items)))

## Step a family's value; if a part of that family is in hand, the part in hand changes too.
func tray_step(fam_key: String, items: Array, i: int) -> void:
	tray_idx[fam_key] = posmod(i, items.size())
	var it: Dictionary = items[tray_idx[fam_key]]
	if tool == "place" and str(place_item.get("partId", "")) == str(it.partId) and str(place_item.get("variant", "")) == str(it.variant): pick_part(it)
	else: changed.emit()

func _refresh_tray() -> void:
	if sort_box == null: return
	var show := mode == "free" or (mode == "job" and not case_closed() and not handed)
	sort_box.visible = show
	if not show: return
	var fams := tray_families()
	var sig := "%d|%s|%s|%s|%s" % [sort_box.page, str(fams.map(func(f): return _fam_key(f) + str(tray_index(f)) + str(f.items.size()))), str(place_item.get("partId", "")), str(place_item.get("value", "")), tool]
	if sig == _tray_sig: return
	_tray_sig = sig
	sort_box.fill(fams, tray_index, place_item if tool == "place" else {})

func _tray_slot_hit(id: String) -> Dictionary:
	var s := SortBox.slot_of(id)
	return sort_box.slots[s] if sort_box and s >= 0 and s < sort_box.slots.size() else {}

func _hit(id: String) -> void:
	match id:
		"psu_output": toggle_power()
		"mcu_pin": cycle_pin()
		"scope_probe": set_tool("probe")
		"dmm_dial":
			var order := ["OFF", "V", "mA", "Ω"]
			backend.set_dial(order[(order.find(backend.dial) + 1) % order.size()])
		"scope_run": paused = not paused; backend.set_running(not paused)
		"fan": set_view(4)
		"psu_test": run_test()
		"tray_page": sort_box.page = (sort_box.page + 1) % maxi(1, sort_box.pages)
		_:
			var sl := _tray_slot_hit(id)
			if not sl.is_empty(): pick_part(sl.item)
	changed.emit()

func toggle_power() -> void:
	if not backend.powered and _safety_first(): return
	if not backend.smoked.is_empty() and not backend.powered: pass
	backend.set_power(not backend.powered)
	if not backend.powered: capture_until = 0.0; _call(scope, "clear_capture")
	changed.emit()

func cycle_pin() -> void:
	for s in backend.selectors:
		if str(s.id) == "pin": backend.set_selector("pin", (int(s.index) + 1) % (s.options as Array).size())
	changed.emit()

func set_pin(i: int) -> void:
	backend.set_selector("pin", i); changed.emit()

## 4-1 (mains): the engine keeps power and the bench off until the safety card is read; the ticket says so instead of nothing.
func _safety_first() -> bool:
	if mode != "job" or not backend.safety_pending(): return false
	note = "Read the safety card on the ticket first. The bench stays off until you have."
	changed.emit()
	return true

func read_safety() -> void:
	backend.read_safety()
	note = "Card read. The isolation transformer feeds L and N. Build only on the 12 V side, outside the red square."
	if sfx: sfx.play("page", 0.7)
	changed.emit()

## Chapter 4's thermal camera (the ticket offers it): T or the rail key. The parts show the engine's temperatures in false colour.
func toggle_thermal() -> void:
	if not backend.camera_ok or mode != "job": return
	thermal = not thermal; backend.camera = thermal
	note = "Thermal camera on. Dark blue is room temperature, white is 150 C." if thermal else "Thermal camera off."
	changed.emit()

## The camera's reading: the hottest part and its temperature (the engine's number), for the tip plate.
func thermal_text() -> String:
	if not backend.powered: return "Thermal camera: power is off, everything is at room temperature"
	var best := {}; var bt := -1e9
	for p in backend.frame.get("parts", []):
		if float(p.get("temp", -1e9)) > bt: bt = float(p.get("temp", -1e9)); best = p
	if best.is_empty(): return "Thermal camera"
	var nm := str(backend.part_by(str(best.uid)).get("label", best.get("partId", "")))
	return "Thermal camera: hottest is %s at %.0f C" % [nm if nm != "" else str(best.uid), bt]

func run_test() -> void:
	if _safety_first(): return
	if backend.passed and mode == "job":
		note = "Already passed and paid. Close up and hand it back."; changed.emit(); return
	if bool(backend.ticket.get("eb", false)) and not backend.predictions_done():
		note = "Predict first: write your numbers on the ticket and press Lock in."; changed.emit(); return
	backend.run_bench(); changed.emit()

func undo() -> void:
	var r := backend.undo(); note = str(r.get("msg", ""))
	if board: board.set_marks([])
	capture_until = 0.0; _call(scope, "clear_capture"); last_failure = {}
	changed.emit()


## ------------------------------------------------------------------------------------------------ phase B: jobs, ticket text, free-bench saves

var _campaign := false

## What the customer says when the case is opened, per ticket.
const OPEN_LINE := {
	"1-1": "Case open. The LED sits straight across the 9 V clip, no resistor. It is dark now. Probe it.",
	"1-2": "Case open. Three LEDs in series on one resistor. Measure the current before you change anything.",
	"1-3": "Case open. A link wire puts the full 12 V on the heater element. It needs 8 V.",
	"1-4": "Case open. The load resistor is burnt. Measure the pack before you choose a new one.",
	"1-5": "Exam rig open. Predict first, then build and probe.",
	"2-1": "Case open. 5.6 k over 3.3 k into the ADC. Measure OUT with the meter before you swap anything.",
	"2-2": "Case open. The cable reel is the loop X, the slide wire is the bridge. Wire them to the cell and the galvanometer, then slide the jockey until the needle sits on zero.",
	"2-3": "Case open. The sealed box sits at the lower left. Meter it: volts open, then amps short. Then set the supply: key 4 shows its VOLTAGE knob.",
	"2-4": "Exam rig open. Predict first, then build the potentiometer and slide the jockey to the balance.",
	"3-1": "Case open. 10 k and 22 uF make the timer. Watch OUT on the scope before you change anything.",
	"3-2": "Case open. The button and the pull-up are soldered on, with no filter between SW and OUT. Look at OUT on the scope first.",
	"3-3": "Case open. The relay coil is on the 24 V rail behind 560 ohm. Look at the coil current on the scope before you change anything.",
	"3-4": "Exam rig open. Predict first, then build both cards and let the bench measure them.",
	"4-1": "Case open. The transformer is soldered in; its mains side sits in the red square. Build the bridge and the capacitor on the 12 V side.",
	"4-2": "Case open. IN to OUT is empty. A resistor from IN to OUT and a Zener from OUT to GND, banded end on OUT.",
	"4-3": "Case open. The regulator goes between IN and OUT. Switch on the thermal camera (T) and watch it heat before you choose a heatsink.",
	"4-4": "Your own board. An LM317, two resistors, and 3.30 V on OUT at every load.",
	"4-5": "Exam rig open. Predict first, then build and probe.",
	"5-1": "Case open. Q1 is burnt, and nothing across the fan catches its turn-off kick.",
	"5-2": "Case open. The strip is soldered on. GATE comes from a 3.3 V pin: the FET has to switch fully on from that.",
	"5-3": "Empty board. Diodes, a transistor and resistors: make Y low only when A and B are both high.",
	"5-4": "Case open. IN from the synth, OUT to the amplifier. One transistor, gain about ten.",
	"5-5": "Exam rig open. Predict first, then build and probe.",
}
const ARRIVE_LINE := {
	"1-1": "Lio put the torch on the counter. It does not light.",
	"1-2": "Ash left the bike light. It is too dim to be seen at night.",
	"1-3": "Mr. Brook brought the heater in a bucket. The fish were too warm.",
	"1-4": "Bo's car crawls. The battery pack came with it.",
	"1-5": "The exam rig is on the bench. No customer: this one is graded.",
	"2-1": "Kaya's weather station reads low. Someone sized its divider without the ADC on it.",
	"2-2": "The crew's telephone cable has shorted under the lane. They need to know where to dig.",
	"2-3": "Tomo's sealed sensor box died. Nobody makes it any more: measure it, then build its twin.",
	"2-4": "The exam rig is on the bench: a slide-wire potentiometer. No customer: this one is graded.",
	"3-1": "{c}'s camera flash lights its ready-light after a fraction of a second, long before the flash has charged.",
	"3-2": "{c}'s arcade button counts one press as several. The game sees a burst of presses.",
	"3-3": "{c}'s irrigation controller does not click. The relay never pulls in, so the valves stay shut.",
	"3-4": "The exam rig is on the bench: two capacitor cards. No customer: this one is graded.",
	"4-1": "{c}'s wall adapter hums and the radio on it crackles. It plugs into the mains: read the safety card first.",
	"4-2": "{c}'s radio wants a steady 5.1 V. Its supply wanders between 13 and 17 V.",
	"4-3": "{c}'s 3D-printer controller keeps cutting out. Its 5 V regulator gets too hot and shuts down.",
	"4-4": "Your bench needs a 3.3 V rail for the next jobs. You build this one for yourself.",
	"4-5": "The exam rig is on the bench: a Zener regulator. No customer: this one is graded.",
	"5-1": "The fan came in with its driver board. Open the case to work on it.",
	"5-2": "{c}'s LED strip needs 12 V, and the board that switches it only speaks 3.3 V.",
	"5-3": "{c}'s robotics club has run out of logic chips. They need a NAND gate built from parts.",
	"5-4": "{c}'s synth is too quiet for the amplifier. It needs a preamp with a gain of about ten.",
	"5-5": "The exam rig is on the bench: a common-emitter amplifier. No customer: this one is graded.",
}
## The slide wire's jockey (2-2, 2-4): a press or drag on the wire puts it under the pointer, the wheel, the arrow keys (and LB / RB
## on the pad, over the wire) step it by the engine's step (10, 1 or 0.1 mm; J or the right stick key changes it).
func jockey_to_mm(mm: float) -> bool:
	if backend.slide_part().is_empty(): return false
	var r: Dictionary = backend.set_jockey(snappedf(mm, 0.1))
	if not bool(r.ok): note = str(r.msg)
	return bool(r.ok)

func jockey_step(dmm: float) -> bool:
	var ok := jockey_to_mm(backend.jockey_mm() + dmm)
	if ok:
		hover_tip = "JOCKEY %.1f mm" % backend.jockey_mm()
		if sfx: sfx.play("tick")
		changed.emit()
	return ok

func jockey_cycle() -> void:
	if backend.slide_part().is_empty(): return
	backend.cycle_jockey_step()
	hover_tip = "Jockey step %s mm" % String.num(backend.jockey_step_mm()); changed.emit()

func _jockey_to(mp: Vector2) -> void:
	var sp: Dictionary = backend.slide_part()
	if sp.is_empty() or board == null: return
	var hit = _plane_at(0.0050).intersects_ray(cam.project_ray_origin(mp), cam.project_ray_normal(mp))   # the wire's own height: the pointer is over the wire, not over the board below it
	if hit == null: return
	var lp: Vector3 = board.to_local(hit)
	var a := Vector2(float(sp.pins[0][0]), float(sp.pins[0][1])); var b := Vector2(float(sp.pins[2][0]), float(sp.pins[2][1]))
	var t := clampf((Vector2(lp.x / P, lp.z / P) - a).dot(b - a) / (b - a).length_squared(), 0.0, 1.0)
	jockey_to_mm(t * 1000.0)
	if Time.get_ticks_msec() - _jockey_tip_ms > 120:   # the paper ticket rebuilds on every change: not on every mouse move
		_jockey_tip_ms = Time.get_ticks_msec(); hover_tip = "JOCKEY %.1f mm" % backend.jockey_mm(); changed.emit()

## The VOLTAGE knob: steps the bench supply (0 - 15 V, 0.01 V resolution) and says the new setting on the tip line.
func supply_step(dv: float) -> bool:
	if backend.supply_volts() <= 0.0 and not backend.bench_q.get("instruments", {}).has("supply"): return false
	var r: Dictionary = backend.set_supply(backend.supply_volts() + dv)
	hover_tip = ("VOLTAGE %.2f V" % backend.supply_volts()) if r.ok else str(r.msg)
	if r.ok and sfx: sfx.play("tick")
	changed.emit()
	return bool(r.ok)

func arrival_line() -> String: return str(ARRIVE_LINE.get(ticket_id, "The device is on the bench. Open the case to work on it.")).replace("{c}", str(backend.ticket.get("customer", "The customer")))

## The first bench job not yet passed (the campaign's next job), else 1-1.
func first_open_ticket() -> String:
	if not _campaign: return CH1[0]
	var done := {}
	for ch in [1, 2, 3, 4, 5]:
		for row in backend.progress(ch).get("tickets", []): if bool(row.get("done", false)): done[str(row.id)] = true
	for id in CH1: if not done.has(id): return id
	return CH1[0]

## The ticket is open (unlocked) in the engine's chapter map.
func _ticket_open(id: String) -> bool:
	if not _campaign: return false
	for row in backend.progress(int(id.get_slice("-", 0))).get("tickets", []): if str(row.id) == id: return bool(row.get("open", false))
	return false

func next_job() -> void:
	if _showcase: back_to_title(); return   # the showcase stands alone
	var i := CH1.find(ticket_id)
	var nx: String = CH1[i + 1] if i >= 0 and i + 1 < CH1.size() else ""
	backend.set_power(false); backend.close_ticket()
	if nx == "": back_to_title(); return
	start_job(nx)

var _paid_text := ""
## The exam slip's Lock in: every field must be a number; the engine records them and the hidden band appears.
func lock_predictions(fields: Array) -> void:
	for fl in fields:
		var tx := str(fl[1]).strip_edges().replace(",", ".")
		if not tx.is_valid_float(): note = "'%s' is not a number. Write a number in each box." % tx if tx != "" else "Write a number in each box first."; changed.emit(); return
	for fl in fields:
		var r: Dictionary = backend.predict(str(fl[0]), float(str(fl[1]).strip_edges().replace(",", ".")))
		if not r.ok: note = str(r.msg); changed.emit(); return
	note = "Predictions locked in. Now build it and measure."
	changed.emit()

func paid_text() -> String: return _paid_text if _paid_text != "" else "nothing"

func burn_cost_text() -> String:
	var c = backend.bench_q.get("burnCostText", null)
	return str(c) if c != null else "$0.00"

func set_selector(id: String, i: int) -> void:
	backend.set_selector(id, i); changed.emit()

## 0.6 condition dial (D-money-06): buy it once with the wallet, then run the live bench in any of the ticket's test conditions.
func buy_dial() -> void:
	var r: Dictionary = backend._act("buyUpgrade", ["condition-dial"])
	note = str(r.get("message", "")); backend.refresh_wallet(); backend._refresh_board()
	if sfx and r.get("ok", false): sfx.play("coin")
	changed.emit()

func set_condition(id: String) -> void:
	var r: Dictionary = backend._act("setCondition", [id if id != "" else null])
	note = str(r.get("message", "")); backend._refresh_board(); backend._refresh_live(); backend._rebuild_model()
	changed.emit()

## The meter's own LCD text, or what to do to get one.
func meter_text() -> String:
	var d: Dictionary = backend.dmm()
	if str(d.get("mode", "OFF")) == "OFF": return "off  (M for leads)"
	if backend.probes.get("red") == null or backend.probes.get("black") == null: return "%s  leads not placed" % str(d.get("mode", ""))
	if str(d.get("text", "")) == "----":   # say why there is no reading (Noor saw "----" and nothing else)
		if not backend.powered: return "%s ----  power is off" % str(d.get("mode", ""))
		var why := str(d.get("note", ""))
		return "%s ----  %s" % [str(d.get("mode", "")), why if why != "" else "a lead is on an empty pad"]
	return "%s %s" % [str(d.get("text", "----")), str(d.get("unit", ""))]

## One line of live numbers for the bench control plate.
func readout_text() -> String:
	if not backend.powered: return "POWER OFF"
	if ticket_id == TICKET and mode == "job":
		var fan_v: float = backend.volt_at([16, 2]) - backend.volt_at([22, 2])
		return "FAN %s" % (BenchUI.si(fan_v, "V") if pin_mode() != "100 Hz" else "switching")
	var sv: Dictionary = backend.scope_view
	if str(sv.get("text", "")) != "": return "%s  %s" % [str(sv.get("label", "")).to_upper(), _sig3(sv)]
	return "POWER ON"

## Live values per spec id while powered: the gauge spec from the engine's gauge, and 5-1's three from the fan and pin.
func live_specs() -> Dictionary:
	var out := {}
	if not backend.powered: return out
	if ticket_id == TICKET and mode == "job":
		var fan_v: float = backend.volt_at([16, 2]) - backend.volt_at([22, 2])
		var has_i: bool = str(backend.scope_view.get("text", "")) != ""
		if pin_mode() == "high": out["fanhi"] = BenchUI.si(fan_v, "V")
		if pin_mode() == "low": out["fanlo"] = BenchUI.si(fan_v, "V")
		if has_i: out["ipin"] = BenchUI.si(float(backend.scope_view.get("value", 0.0)) / 1000.0, "A")
		return out
	var g = backend.card.get("gauge", null)
	if g is Dictionary and str(backend.scope_view.get("text", "")) != "": out[str(g.spec)] = _sig3(backend.scope_view)
	# 0.6 (Noor on 1-2): LED 1 showed the live gauge while LEDs 2 and 3 showed the last test (the tired battery), so a series
	# chain read as three different currents. Every current spec on a part now reads the live frame, as the gauge does, and a
	# current is shown as its size: the battery's "-19.6 mA" (current into its plus terminal) reads "19.6 mA" delivered.
	for s in backend.card.get("specs", []):
		var pr := str(s.get("probe", ""))
		var m := _re_ipart().search(pr)
		if m == null or out.has(str(s.id)): continue
		var uid := _nth_part(m.get_string(1), int(m.get_string(2)))
		if uid == "": continue
		var fp: Dictionary = backend._frame_part(uid)
		if fp.is_empty(): continue
		var amps := backend.led_current(uid) if fp.has("led") else (float(fp.pins[0].i) if fp.has("pins") and (fp.pins as Array).size() > 0 else 0.0)
		out[str(s.id)] = BenchUI.si(_shown_current(str(s.id), amps), "A")
	return out

## Ravi (0.6): a current shows as its size only when the spec's whole band is at or below zero (1-2's battery: -25 mA .. 0, current
## into its plus terminal while it delivers). A band that crosses zero keeps the sign, because the sign is the lesson there (2-2's
## galvanometer either side of balance, 5-2's strip when off).
func _shown_current(id: String, amps: float) -> float:
	for src in [backend.card, backend.ticket]:
		for tg in (src as Dictionary).get("targets", []):
			if str(tg.get("id", "")) == id and tg.get("hi", null) != null: return -amps if float(tg.hi) <= 0.0 else amps
	return amps

static var _re_ip: RegEx
static func _re_ipart() -> RegEx:
	if _re_ip == null: _re_ip = RegEx.create_from_string("^\\s*i\\(@([a-z0-9-]+)#(\\d+)\\)\\s*$")
	return _re_ip

## The engine's `@partId#n`: the n-th part of that kind in board order (fixed parts included), as src/sim/rig.ts resolves it.
func _nth_part(pid: String, n: int) -> String:
	var k := 0
	for p in backend._all_parts:
		if str(p.get("partId", "")) == pid:
			k += 1
			if k == n: return str(p.uid)
	return ""

## The scope's gauge value with three significant digits ("14.9551 mA" -> "15.0 mA").
static func _sig3(sv: Dictionary) -> String:
	var v := float(sv.get("value", 0.0)); var u := str(sv.get("unit", ""))
	var a := absf(v); var d := 2 if a < 10.0 else (1 if a < 100.0 else 0)
	return "%s %s" % [String.num(v, d), u]

## A measured bench value in the spec's unit (from the spec name: current, power, voltage).
func spec_text(id: String, v: float) -> String:
	var nm := ""; var eu := ""
	for s in backend.ticket.get("specs", []): if str(s.id) == id: nm = str(s.get("name", "")).to_lower(); eu = str(s.get("unit", ""))
	var g = backend.card.get("gauge", null)
	if eu == "" and g is Dictionary and str(g.get("spec", "")) == id: eu = str(g.get("unit", ""))
	if eu == "A": v = _shown_current(id, v)   # Ravi: the size only where the band is all at or below zero (1-2's battery)
	if eu != "" and id != "ipin": return BenchUI.si(v, eu)   # the engine's own unit (level probe or gauge): 2-1 printed "3.27 W" when "with" matched " w"
	var words := nm.replace(",", " ").replace("(", " ").replace(")", " ").split(" ", false)
	var unit := "V"
	if "current" in words or "ma" in words or id.begins_with("i"): unit = "A"
	elif "power" in words or "w" in words or "watts" in words: unit = "W"
	if id == "ipin": unit = "A"
	return BenchUI.si(v, unit)

## Free bench builds: three slots, saved by the engine (parts, values, wires) under the user data folder.
func _build_path(slot: int) -> String: return "user://bench_build_%d.json" % slot
func has_build(slot: int) -> bool: return FileAccess.file_exists(_build_path(slot))
func save_build(slot: int) -> void:
	var parts: Array = []
	for p in backend.parts:
		if bool(p.get("fixed", false)): continue
		parts.append({"partId": str(p.partId), "value": p.get("value", null), "variant": str(p.get("variant", "")), "kind": str(p.get("kind", "")), "x": int(p.x), "y": int(p.y), "rot": int(p.get("rot", 0))})
	var wires: Array = []
	for w in backend.wires: wires.append({"path": w.path})
	var f := FileAccess.open(_build_path(slot), FileAccess.WRITE)
	if f == null: note = "Could not save build %d." % slot; changed.emit(); return
	f.store_string(JSON.stringify({"v": 1, "parts": parts, "wires": wires})); f.close()
	note = "Saved build %d: %d parts, %d wires." % [slot, parts.size(), wires.size()]; changed.emit()
func load_build(slot: int) -> void:
	if not has_build(slot): return
	var d = JSON.parse_string(FileAccess.get_file_as_string(_build_path(slot)))
	if not d is Dictionary: note = "Build %d is not readable." % slot; changed.emit(); return
	backend.set_power(false)
	for p in backend.parts.duplicate():
		if not bool(p.get("fixed", false)): backend.delete_part(str(p.uid))
	for w in backend.wires.duplicate(): backend.delete_wire(str(w.wid))
	var placed := 0; var wired := 0
	for p in d.get("parts", []):
		var r := backend.place({"partId": str(p.partId), "value": p.get("value", null), "variant": str(p.get("variant", "")), "kind": str(p.get("kind", ""))}, int(p.x), int(p.y), int(p.get("rot", 0)))
		if bool(r.get("ok", true)): placed += 1
	for w in d.get("wires", []):
		var path: Array = w.path
		var r2 := backend.add_wire(path[0], path[path.size() - 1])
		if bool(r2.get("ok", true)): wired += 1
	note = "Loaded build %d: %d parts, %d wires." % [slot, placed, wired]
	sync_board(); changed.emit()

## ------------------------------------------------------------------------------------------------ 0.4.1 README clips (QA only)

## CB_DEMO=<name>: a timed sequence through the bench's own methods, for the README GIFs (recorded from a GPU window).
##   pick     1-1: pick the 220 ohm from the sorting box, the ghost rides to the pads, it is placed
##   supply   2-3: the VOLTAGE knob steps the supply up to 8 V, OUTPUT, then TEST
##   measure  2-1: meter leads on OUT (2.76 V), the divider rebuilt, the meter reads 3.35 V, TEST passes
##   burn     1-1: power names the arrived-burnt LED; Ctrl+Z fits a fresh one; power again: it burns, and the rush bill lands
func _demo(name: String) -> void:
	var f0 := Engine.get_frames_drawn()
	while Engine.get_frames_drawn() < f0 + 30: await get_tree().process_frame   # past the splash and the first shader compiles
	print("DEMO go ", name)   # the recorder starts capturing on this line
	var at := func(t: float, f: Callable): get_tree().create_timer(t + 1.0).timeout.connect(f)
	match name:
		"pick":
			var fam: Dictionary = {}
			at.call(1.0, func():
				for s in sort_box.slots: if str(s.item.partId).begins_with("res"): fam = s
				if not fam.is_empty(): pick_part(fam.item))
			at.call(1.5, func(): set_view(5))
			for i in 6: at.call(2.4 + i * 0.25, func(): _hover(cam.unproject_position(board.pad_world(2 + i, 9)), true))
			at.call(4.2, func():
				var r := backend.place(place_item, 7, 9, 0); note = str(r.get("msg", "")); set_tool("select"); changed.emit())
		"supply":
			for i in 6: at.call(1.0 + i * 0.35, func(): hover_tip = ""; supply_step(0.5))
			at.call(4.2, func(): _hit("psu_output"))
			at.call(5.0, func(): _hit("psu_test"))
		"measure":
			at.call(0.8, func(): if not backend.powered: toggle_power())
			at.call(1.6, func(): backend.set_dial("V"); backend.set_probe("red", [14, 2]); changed.emit())
			at.call(2.2, func(): backend.set_probe("black", [14, 8]); changed.emit())
			at.call(4.0, func(): backend.build_ref(ticket_id); sync_board(); if not backend.powered: toggle_power())
			at.call(4.6, func(): backend.set_dial("V"); backend.set_probe("red", [14, 2]); backend.set_probe("black", [14, 8]); changed.emit())
			at.call(6.0, func(): run_test())
		"swap31":   # 0.5: 3-1 arrives with a 22 uF capacitor; the wheel steps it to 100 uF in place; power, test, pass
			at.call(0.4, func(): open_case(); set_view(5))
			at.call(1.6, func(): if not backend.powered: toggle_power())
			at.call(3.0, func(): toggle_power())
			for i in 8: at.call(3.6 + i * 0.4, func():
				for p in backend.parts: if str(p.partId) == "cap-el" and not bool(p.get("fixed", false)) and float(p.value) < 99e-6:
					var n3: Node3D = parts3d.get(str(p.uid), null)
					if n3: _wheel_value(cam.unproject_position(n3.global_position + Vector3(0, 0.004, 0)), 1))
			at.call(7.2, func(): if not backend.powered: toggle_power())
			at.call(9.6, func(): run_test())
		"jockey22":   # 0.5: 2-2 cable fault: the jockey slides along the wire and the galvanometer needle swings through zero
			at.call(0.4, func(): open_case(); set_view(5))
			at.call(1.0, func(): if not backend.powered: toggle_power())
			for i in 24: at.call(1.6 + i * 0.22, func(): jockey_to_mm(150.0 + i * 12.0))
		"testbed":   # 0.5: the fan driver switching at 100 Hz; the flyback diode comes out; the coil's kick burns the transistor
			at.call(0.6, func(): backend.set_selector("pin", 2); if not backend.powered: toggle_power())
			at.call(3.2, func(): Testbed.apply_break(self, "no_diode"))
		"dimmer":   # 0.6 testbed (CB_L2=testbed CB_TESTBED=dimmer): power; the knob turns from 10 % to full; the strip brightens
			at.call(0.4, func(): set_view(5))
			at.call(0.9, func(): if not backend.powered: toggle_power())
			var pot := ""
			for p in backend.parts: if str(p.partId) == "pot-panel": pot = str(p.uid)
			for i in 19: at.call(1.4 + i * 0.3, func():
				var a := 0.1 + 0.05 * i
				backend._act("setPot", [pot, a]); pot_alpha[pot] = a
				var pn = parts3d.get(pot, null)
				if pn: pn.set_knob(a)
				note = "Knob at %d %%. Strip current %.0f mA." % [int(round(a * 100)), absf(backend.part_current("f1")) * 1000.0]; changed.emit())
		"thermal43":   # 0.6: 4-3 with the reference built; power, half an amp, the thermal camera shows the 7805 heating
			at.call(0.4, func(): open_case(); backend.build_ref(ticket_id); sync_board(); set_view(5))
			at.call(1.0, func(): if not backend.powered: toggle_power())
			at.call(1.6, func(): toggle_thermal())
		"burn":   # the arrived-burnt LED is named as the customer's; Ctrl+Z fits a fresh one; still straight on 9 V, it burns and is billed
			at.call(0.5, func(): set_view(5))
			at.call(1.2, func(): toggle_power())
			at.call(3.0, func(): undo())
			at.call(4.2, func(): toggle_power())

## 0.5: the wheel over a placed part steps its value through what the box stocks for it (wires stay), so a repair swaps a value
## in place. False when the mouse is not over a part with values (the wheel then zooms as before).
func _wheel_value(mp: Vector2, dir: int) -> bool:
	if not (mb_wheel_ok()): return false
	var it := _pick_item(mp)
	if it.is_empty() or str(it.kind) != "part": return false
	# 0.6 (Tess: "I rolled the wheel over the board and the resistor turned into 1 k"): a wheel that sweeps over a part while zooming
	# zooms. The value steps only once the pointer has rested on the part (its tip showing) for a moment.
	if str(it.id) != str(_pick_hl.get("id", "")) or Time.get_ticks_msec() - _pick_hl_ms < 350: return false
	var part := {}
	for p in backend.parts: if str(p.uid) == str(it.id): part = p
	if str(part.get("kind", "")) == "POT" and not bool(part.get("fixed", false)):
		# 0.6 testbed dimmer: the wheel over a panel pot turns its knob (5 % a step); the engine moves the wiper
		var a := clampf(float(pot_alpha.get(str(it.id), 0.5)) - 0.05 * dir, 0.0, 1.0)
		pot_alpha[str(it.id)] = a
		var rp: Dictionary = backend._act("setPot", [str(it.id), a])
		var pn = parts3d.get(str(it.id), null)
		if pn and pn.has_method("set_knob"): pn.set_knob(a)
		note = "Knob at %d %%." % int(round((1.0 - a) * 100.0)) if rp.get("ok", false) else str(rp.get("message", ""))
		changed.emit(); return true
	if part.is_empty() or part.get("value", null) == null or bool(part.get("fixed", false)): return false
	var vals: Array = []
	for d in drawer():
		if str(d.get("partId", "")) == str(part.partId) and d.get("value", null) != null and not vals.has(float(d.value)): vals.append(float(d.value))
	if vals.size() < 2: return false
	vals.sort()
	var cur := float(part.value); var i := 0
	for k in vals.size(): if absf(float(vals[k]) - cur) <= absf(float(vals[i]) - cur): i = k
	var j := clampi(i + dir, 0, vals.size() - 1)
	if j == i: note = "That is the %s value in the box." % ("largest" if dir > 0 else "smallest"); changed.emit(); return true
	var r: Dictionary = backend.set_value(str(it.id), float(vals[j]))
	note = str(r.get("message", r.get("msg", ""))); sync_board()
	# 0.6: the hover tip kept the old value ("470 ohm resistor" after a step to 680): name the part again from the new board
	var keep_ms := _pick_hl_ms; _pick_hl = {}; _set_pick_hl(_pick_item(mp)); _pick_hl_ms = keep_ms
	changed.emit()
	return true

func mb_wheel_ok() -> bool: return backend.has_method("set_value") and mode in ["job", "free"]

