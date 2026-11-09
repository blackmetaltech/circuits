class_name BenchView
extends Control
## The world (M0 placeholder): a dark bench rectangle with the stall name and the open ticket's card text. The real bench view
## (board grid, parts, living wires, instruments) replaces this in M2. It reads only what the engine says (the ticketCard and region
## queries); the app tells it how much of the right side a drawer covers (set_cover).
var app
var stall := ""
var lane := ""
var card: Dictionary = {}
var cover := 0.0
var blocked := false
var title_mode := false
var zoom := 1.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

func set_cover(px: float) -> void: cover = px; queue_redraw()
func set_blocked(b: bool) -> void: blocked = b
func set_title(on: bool) -> void: title_mode = on; queue_redraw()

## CB_CAM for screenshots: "close", "wide", "full", or a zoom factor.
func set_camera(spec: String) -> void:
	match spec:
		"close": zoom = 1.3
		"wide": zoom = 0.8
		"full": zoom = 1.0
		_: if spec.is_valid_float(): zoom = clampf(float(spec), 0.4, 2.5)
	queue_redraw()

func set_state(region_strings: Dictionary, ticket_card) -> void:
	stall = str(region_strings.get("stall", "")); lane = str(region_strings.get("lane", ""))
	card = ticket_card if ticket_card is Dictionary else {}
	queue_redraw()

func _txt(s: String, p: Vector2, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT) -> void:
	draw_string(ThemeDB.fallback_font, p, s, align, -1.0, size, col)

func _draw() -> void:
	var vs := size
	var w := (vs.x - cover) * 0.8 * zoom; var h := vs.y * 0.6 * zoom
	var c := Vector2((vs.x - cover) * 0.5, vs.y * 0.5)
	var r := Rect2(c - Vector2(w, h) * 0.5, Vector2(w, h))
	draw_rect(r, Color(0.05, 0.08, 0.1), true)
	draw_rect(r, Color(0.2, 0.3, 0.32), false, 3.0)
	_txt(stall, r.position + Vector2(24, 44), 28, CbKit.TX)
	_txt(lane, r.position + Vector2(24, 76), 18, CbKit.DIM)
	if not card.is_empty():
		_txt(str(card.get("title", "")), r.position + Vector2(24, 128), 22, CbKit.ACC)
