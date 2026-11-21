extends Node
## NODE front end. The old COBANANA dashboard shell (top bar, sidebar cards, bottom tabs) is gone from the main view: the whole interface is
## Wren's repair stall (godot/stall/). Env hooks: CB_SCREEN=title|map|bench|notebook|settings, CB_TICKET=1-3, CB_UNLOCK=1, CB_SHOTS=1 (screenshot run).
var scene: StallScene

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color("#120c08"))
	scene = StallScene.new(); add_child(scene)
	if OS.get_environment("CB_SHOTS") != "":
		var sh = load("res://tests/ch4_shots.gd" if OS.get_environment("CB_SHOTS") == "ch4" else "res://tests/ch3_shots.gd" if OS.get_environment("CB_SHOTS") == "ch3" else ("res://tests/ch2_shots.gd" if OS.get_environment("CB_SHOTS") == "ch2" else "res://tests/stall_shots.gd")).new(); add_child(sh); sh.run(scene)
	if OS.get_environment("CB_SHOT") != "":   # one screenshot after CB_SHOT_AT seconds, then quit
		var at := float(OS.get_environment("CB_SHOT_AT")) if OS.get_environment("CB_SHOT_AT") != "" else 4.0
		get_tree().create_timer(at).timeout.connect(func(): get_viewport().get_texture().get_image().save_png(OS.get_environment("CB_SHOT")); get_tree().quit())
