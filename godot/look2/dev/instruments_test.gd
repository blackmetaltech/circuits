extends Node3D
## Dev: all five bench instruments on a desk (CB_LOOK2_DEV=instruments). Env: CB_CAM=scope|fan, CB_CAP=1 (off-scale capture). Not shipped behaviour.

func _ready() -> void:
	# environment: workshop HDRI at half energy, AgX, SSAO, glow
	var sky := Sky.new(); var pm := PanoramaSkyMaterial.new()
	pm.panorama = load("res://look2/assets/hdri/artist_workshop_1k.hdr"); pm.energy_multiplier = 0.5
	sky.sky_material = pm
	var e := Environment.new(); e.background_mode = Environment.BG_SKY; e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY; e.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	e.tonemap_mode = Environment.TONE_MAPPER_AGX; e.tonemap_exposure = 1.0
	e.ssao_enabled = true; e.ssao_radius = 0.05; e.ssao_intensity = 1.2; e.ssao_power = 1.3
	e.glow_enabled = true; e.glow_intensity = 0.6; e.glow_strength = 1.0; e.glow_bloom = 0.05; e.glow_hdr_threshold = 1.4
	var we := WorldEnvironment.new(); we.environment = e; add_child(we)
	# desk
	var desk := MeshInstance3D.new(); var pl := PlaneMesh.new(); pl.size = Vector2(2.0, 1.2); desk.mesh = pl
	desk.material_override = MeshKit.mat(Color(0.11, 0.075, 0.05), 0.55, 0.0, {"normal": 0.2, "uv_scale": 2.0}); add_child(desk)
	# warm desk lamp with soft shadows
	var lamp := SpotLight3D.new(); lamp.position = Vector3(0.25, 0.85, 0.55); lamp.light_color = Color(1.0, 0.8, 0.58)
	lamp.light_energy = 6.0; lamp.spot_range = 3.0; lamp.spot_angle = 48.0; lamp.spot_attenuation = 0.6
	lamp.shadow_enabled = true; lamp.light_size = 0.04
	lamp.look_at_from_position(lamp.position, Vector3(-0.02, 0.05, 0.0)); add_child(lamp)
	# the instruments
	var scope := Scope3D.new(); scope.position = Vector3(-0.2, 0, -0.2); scope.rotation.y = 0.12; add_child(scope)
	var psu := Psu3D.new(); psu.position = Vector3(0.30, 0, -0.2); psu.rotation.y = 0.22; add_child(psu)
	var dmm := Dmm3D.new(); dmm.position = Vector3(0.13, 0, 0.13); dmm.rotation.y = 0.15; add_child(dmm)
	var mcu := Mcu3D.new(); mcu.position = Vector3(-0.03, 0, 0.13); mcu.rotation.y = 0.5; add_child(mcu)
	var fan := Fan3D.new(); fan.position = Vector3(-0.30, 0, 0.1); fan.rotation.y = 0.35; add_child(fan)
	# data from the engine fixture
	var d: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://look2/fixtures/51_ref_pwm.json"))
	var q: Dictionary = d.scope_q
	scope.set_samples(q.v, float(q.dt), 5.0, 0.002)
	scope.set_measure(["Freq 100.0 Hz", "Vpp 12.0 V", "Duty 50 %", "Vmax 12.0 V"])
	scope.set_status("RUN")
	if OS.get_environment("CB_CAP") == "1":
		scope.show_capture(2005, 40, 0.3)
	dmm.set_dial("V"); dmm.set_reading("11.96", "V", "V")
	psu.set_values(12.0, 0.21); psu.set_output(true)
	mcu.set_pin_mode("100 Hz")
	fan.set_speed(0.9)
	# camera
	var cam := Camera3D.new(); cam.fov = 40.0; cam.current = true; add_child(cam)
	var which := OS.get_environment("CB_CAM")
	if which == "scope":
		cam.position = scope.to_global(Vector3(0.0, 0.2, 0.42)); cam.look_at(scope.to_global(Vector3(-0.03, 0.09, 0.07))); cam.fov = 32.0
	elif which == "fan":
		cam.position = fan.to_global(Vector3(0.12, 0.17, 0.33)); cam.look_at(fan.to_global(Vector3(0.0, 0.085, 0.0))); cam.fov = 34.0
	elif which == "psu":
		cam.position = psu.to_global(Vector3(0.05, 0.14, 0.5)); cam.look_at(psu.to_global(Vector3(0.0, 0.08, 0.14))); cam.fov = 32.0
	elif which == "dmm":
		cam.position = dmm.to_global(Vector3(0.0, 0.2, 0.3)); cam.look_at(dmm.to_global(Vector3(0.0, 0.07, 0.0))); cam.fov = 32.0
	else:
		cam.position = Vector3(0.28, 0.5, 0.78); cam.look_at(Vector3(-0.02, 0.05, -0.02))
