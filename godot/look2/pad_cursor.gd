class_name PadCursor
extends Control
## Gamepad on the bench (phase C, first pass). The left stick drives a cursor ring; the face buttons and bumpers become the
## same mouse and key events the bench already answers, at that cursor, so every pad action is a mouse or key action the
## flows test. Axes are tracked from the events themselves, so a test can drive it headless.
##   Left stick  cursor            A  click (pick, place, wire end, press a key on the ticket)
##   Right stick orbit the view    B  right click (drop the tool, remove a part)
##   LB / RB     wheel at cursor (part value, supply volts, zoom)
##   X  power (Space)   Y  bench test (Enter)   RT  rotate the part in hand (R)
##   D-pad up wire (W), down meter leads (M), left / right previous / next view   Back  schematic (Tab)   Start  select tool (Esc)
## On the title the pad uses Godot's own focus navigation (A presses the focused key); the cursor only appears on the bench.

const SPEED := 900.0         ## px/s at full stick
const DEAD := 0.18
const AIM := 0.45            ## 0.5: the ring slows to this over anything it can act on (a pad, a part, a key), so legs are hit first time
## Rumble (0.5), read from the bench's own state so it never drifts from what the screen shows: power, a pass, a burn.
const RUMBLE := {"power": [0.15, 0.0, 0.08], "pass": [0.3, 0.2, 0.25], "burn": [0.9, 0.6, 0.35]}   # weak, strong, seconds
var _was := {"powered": false, "passed": false, "smoked": 0}
var bench: Node               ## Workbench
var pos := Vector2(640, 400)
var active := false           ## true after the first pad input on the bench: the ring shows
var axes := {}                ## JoyAxis -> value, from the events

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	z_index = 100

func _on_bench() -> bool: return bench != null and str(bench.mode) != "title"

func _input(e: InputEvent) -> void:
	if e is InputEventJoypadMotion:
		var jm := e as InputEventJoypadMotion
		axes[jm.axis] = jm.axis_value
		if jm.axis == JOY_AXIS_TRIGGER_RIGHT and jm.axis_value > 0.6 and not bool(axes.get(-1, false)):
			axes[-1] = true; _key(KEY_R)
		elif jm.axis == JOY_AXIS_TRIGGER_RIGHT and jm.axis_value < 0.3: axes[-1] = false
		if _on_bench(): get_viewport().set_input_as_handled()
	elif e is InputEventJoypadButton and _on_bench():
		var jb := e as InputEventJoypadButton
		get_viewport().set_input_as_handled()
		if not active: active = true; pos = get_viewport().get_mouse_position() if get_viewport().get_mouse_position() != Vector2.ZERO else pos; queue_redraw()
		match jb.button_index:
			JOY_BUTTON_A: _mouse(MOUSE_BUTTON_LEFT, jb.pressed)
			JOY_BUTTON_B: _mouse(MOUSE_BUTTON_RIGHT, jb.pressed)
			JOY_BUTTON_LEFT_SHOULDER: if jb.pressed: _wheel(MOUSE_BUTTON_WHEEL_DOWN)
			JOY_BUTTON_RIGHT_SHOULDER: if jb.pressed: _wheel(MOUSE_BUTTON_WHEEL_UP)
			JOY_BUTTON_X: if jb.pressed: _key(KEY_SPACE)
			JOY_BUTTON_Y: if jb.pressed: _key(KEY_ENTER)
			JOY_BUTTON_BACK: if jb.pressed: _key(KEY_TAB)
			JOY_BUTTON_START: if jb.pressed: _key(KEY_ESCAPE)
			JOY_BUTTON_DPAD_UP: if jb.pressed: _key(KEY_W)
			JOY_BUTTON_DPAD_DOWN: if jb.pressed: _key(KEY_M)
			JOY_BUTTON_DPAD_LEFT: if jb.pressed: bench.set_view(wrapi(int(bench.view) - 1, 1, 6))
			JOY_BUTTON_DPAD_RIGHT: if jb.pressed: bench.set_view(wrapi(int(bench.view) + 1, 1, 6))

func _process(dt: float) -> void:
	if not _on_bench(): return
	var l := _stick(JOY_AXIS_LEFT_X, JOY_AXIS_LEFT_Y)
	if l != Vector2.ZERO:
		active = true
		var vs := get_viewport().get_visible_rect().size
		var aim := AIM if (str(bench.hover_tip) != "" or (bench.hover_pad as Vector2i).x >= 0) else 1.0
		pos = (pos + l * l.length() * SPEED * aim * dt).clamp(Vector2.ZERO, vs - Vector2.ONE)
		var mm := InputEventMouseMotion.new(); mm.position = _win(pos); mm.global_position = mm.position; mm.relative = l * SPEED * dt
		Input.parse_input_event(mm)
		queue_redraw()
	var r := _stick(JOY_AXIS_RIGHT_X, JOY_AXIS_RIGHT_Y)
	if r != Vector2.ZERO:
		bench.g_yaw -= r.x * 1.8 * dt
		bench.g_pitch = clampf(bench.g_pitch - r.y * 1.4 * dt, deg_to_rad(-88), deg_to_rad(-5))

	_rumble_watch()

func _rumble_watch() -> void:
	var b = bench.backend
	if b == null: return
	var fresh := 0   # parts the player burned: a repair's arrived-burnt parts do not rumble (the same rule as their sound)
	var ab = b.get("arrived_burnt")   # FixtureBench (the test double) has none
	for uid in (b.smoked as Dictionary): if not (ab is Dictionary and (ab as Dictionary).has(uid)): fresh += 1
	var now := {"powered": bool(b.powered), "passed": bool(b.passed), "smoked": fresh}
	if active:
		if now.powered != _was.powered: _rumble("power")
		if now.passed and not _was.passed: _rumble("pass")
		if int(now.smoked) > int(_was.smoked) and now.powered: _rumble("burn")
	_was = now

var last_rumble := ""   ## QA: the last rumble cue (CI has no joypad)
func _rumble(kind: String) -> void:
	last_rumble = kind
	var r: Array = RUMBLE[kind]
	for d in Input.get_connected_joypads(): Input.start_joy_vibration(d, float(r[0]), float(r[1]), float(r[2]))

func _stick(ax: int, ay: int) -> Vector2:
	var v := Vector2(float(axes.get(ax, 0.0)), float(axes.get(ay, 0.0)))
	return Vector2.ZERO if v.length() < DEAD else v.limit_length(1.0)

func _mouse(button: int, pressed: bool) -> void:
	var mb := InputEventMouseButton.new(); mb.button_index = button; mb.pressed = pressed; mb.position = _win(pos); mb.global_position = mb.position
	Input.parse_input_event(mb)

## Parsed mouse events arrive in window pixels and the window's stretch maps them into the viewport: send the cursor's
## viewport position through that same transform, or every pad click lands off target on any window not at the base size.
func _win(p: Vector2) -> Vector2: return get_viewport().get_final_transform() * p

func _wheel(button: int) -> void:
	_mouse(button, true); _mouse(button, false)

func _key(kc: int) -> void:
	for down in [true, false]:
		var k := InputEventKey.new(); k.keycode = kc; k.physical_keycode = kc; k.pressed = down
		Input.parse_input_event(k)

func _draw() -> void:
	if not active or not _on_bench(): return
	draw_arc(pos, 11.0, 0.0, TAU, 32, Color(0.0, 0.0, 0.0, 0.6), 4.0, true)
	draw_arc(pos, 11.0, 0.0, TAU, 32, Color(1.0, 0.78, 0.25), 2.0, true)
	draw_circle(pos, 2.0, Color(1.0, 0.78, 0.25))
