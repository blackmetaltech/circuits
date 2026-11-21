class_name StallTop
extends Control
## The topmost bench layer (below the paper pages): supply cables with alligator clips, the DMM's leads and draggable probe tips, the scope's
## CH1 clip lead, the ticket chit pinned to the scope bezel, Wren's coach slip with a hand-drawn arrow, the customer's speech bubble and the
## part icon that follows the pointer. Pure drawing; StallScene owns state and fills the fields below.

const S = preload("res://stall/stall_style.gd")
var t := 0.0
var L: Dictionary = {}
var ticket: Dictionary = {}
var locked := false
var cables: Array = []            ## [{a: Vector2, b: Vector2, col: Color}] supply cables (a at the supply port, b at the connector clip)
var leads: Array = []             ## [{from: Vector2 (socket), tip: Vector2, col: Color, on_pad: bool, hover: bool}]
var scope_lead: Dictionary = {}   ## {from, to}
var held: Dictionary = {}         ## {part: Dictionary, pos: Vector2, p: float} icon following the pointer off the board
var tag: Dictionary = {}          ## hover readout {text, pos}
var chit_pay := true             ## the fee line fits on the paper (the scene hides it when the paper would have to grow past what the instruments under it allow; the notebook has it)
var slip_text := ""
var slip_step := ""
var arrow_to := Vector2.ZERO
var show_arrow := false
var bubble := ""
var bubble_alpha := 0.0
var toast := ""
var toast_age := 9.0
var toast_dur := 3.5
var toast_quick := false         ## a transient confirmation ("Wire joined"), drawn as a small dark tag so it is never mistaken for Wren's slip
var toast_bench := false         ## the toast is a bench verdict ("Too high: OUT reads 7.63 V"): it describes the board as it was, so the next edit takes it down
var hint_box_drop := false
var peek: Dictionary = {}
var _arrow_k := 0.0
var _last_slip := ""
var _props: StallProps

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE; set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); set_process(true)

func _process(dt: float) -> void:
	t += dt; toast_age += dt
	if S.handheld and toast_age < 90.0 and toast != "" and not toast_quick:   # long cards page on by themselves (4.5 s a page) and stay up long enough to read every page
		var np := dock_pages()
		toast_dur = maxf(toast_dur, float(np) * DOCK_PAGE_S + 1.5)
		if not toast_manual: toast_scroll = mini(np - 1, int(toast_age / DOCK_PAGE_S))
	if slip_text != _last_slip: _last_slip = slip_text; _arrow_k = 0.0   # a new step: the pen draws the arrow again
	_arrow_k = minf(1.0, _arrow_k + dt * 1.6)
	queue_redraw()

## The longest message any run has shown, measured the way a 1280x800 handheld draws it (24 design px, DOCK_W wide): the flows assert it needs two pages or fewer.
static var longest := ""
static var longest_lines := 0
static func handheld_lines(text: String) -> int:
	var tp := TextParagraph.new(); tp.add_string(text, S.hand(), 24); tp.width = 880.0 - 60.0
	return tp.get_line_count()

func say(s: String) -> void:
	var nl := handheld_lines(s)
	if nl > longest_lines: longest_lines = nl; longest = s
	toast = s; toast_scroll = 0; toast_manual = false; toast_bench = false; toast_quick = false; toast_age = 0.0; toast_dur = clampf(3.5 + float(s.length()) * 0.045, 3.5, 11.0)   # a long sentence stays long enough to read

## The bench's verdict on the board: shown like any note, but any edit of the board takes it down (it would be stale).
func say_bench(s: String) -> void:
	say(s); toast_bench = true; toast_dur = clampf(toast_dur, 6.0, 16.0)

## Any edit of the board: a bench verdict is about the board as it was, so it goes.
func edited() -> void:
	if toast_bench: toast_age = 99.0; toast_bench = false

## A short confirmation that fades fast and looks like the hover readout, not like a note from Wren.
func say_quick(s: String) -> void: toast = s; toast_quick = true; toast_age = 0.0; toast_dur = 2.0

var cam_rect := Rect2()   ## the thermal camera chip above the board (chapter 4); empty off a chapter-4 bench
var cam_on := false
func _cam_chip() -> void:
	if cam_rect.size == Vector2.ZERO: return
	S.rr(self, cam_rect, 8, Color("#1b1d21")); S.rr(self, cam_rect.grow(-3), 6, Color("#ff9d4a") if cam_on else Color("#2c2f35"))
	var fs := maxi(16, S.min_font)
	var txt := "THERMAL CAM  [T]" if not S.handheld else "THERMAL CAM"
	S.text(self, S.mono(), txt, cam_rect.position + Vector2(cam_rect.size.x * 0.5 - S.tw(S.mono(), txt, fs) * 0.5, cam_rect.size.y * 0.5 + fs * 0.34), fs, Color("#15161a") if cam_on else Color("#e8e0c8"))

func slip_rect() -> Rect2: return L.get("slip", Rect2())

func _draw() -> void:
	if L.is_empty(): return
	for c in cables: _cable(c)
	_cam_chip()
	if not scope_lead.is_empty(): _scope_lead()
	if not peek.is_empty(): _peek()
	else: _chit()
	for ld in leads: _lead(ld)
	if not held.is_empty(): _held()
	_slip()
	if bubble_alpha > 0.01: _bubble()
	if not tag.is_empty(): _tag()
	if toast_age < toast_dur: _toast()

func _cable(c: Dictionary) -> void:
	var clip: Vector2 = c.b
	if c.has("via"): _routed(c)   # around the outside of the board, over the top edge, and down to the clip
	else: S.cable(self, c.a, c.b, 46.0, c.col, 7.0)
	S.rr(self, Rect2(clip + Vector2(-16, -10), Vector2(32, 20)), 5, Color("#14161a")); S.rr(self, Rect2(clip + Vector2(-13, -8), Vector2(26, 16)), 4, c.col.lightened(0.05))
	draw_line(clip + Vector2(-16, -4), clip + Vector2(-26, -8), Color("#9aa0a8"), 3.0); draw_line(clip + Vector2(-16, 4), clip + Vector2(-26, 8), Color("#9aa0a8"), 3.0)

## A cable through waypoints with rounded corners (quadratic beziers between the segment midpoints).
func _routed(c: Dictionary) -> void:
	var wp: Array = [c.a]; wp.append_array(c.via); wp.append(c.b)
	var pts := PackedVector2Array([wp[0]])
	for i in range(1, wp.size() - 1):
		var p0: Vector2 = (wp[i - 1] as Vector2) if i == 1 else ((wp[i - 1] as Vector2).lerp(wp[i], 0.5))
		var p2: Vector2 = (wp[i + 1] as Vector2) if i == wp.size() - 2 else ((wp[i] as Vector2).lerp(wp[i + 1], 0.5))
		for k in range(0, 9):
			var u := float(k) / 8.0
			pts.append(p0.lerp(wp[i], u).lerp((wp[i] as Vector2).lerp(p2, u), u))
	pts.append(wp[wp.size() - 1])
	draw_polyline(pts.duplicate(), Color(0, 0, 0, 0.35), 9.0, true)
	draw_polyline(pts.duplicate(), (c.col as Color).darkened(0.35), 8.0, true)
	draw_polyline(pts, c.col, 7.0, true)

func _scope_lead() -> void:
	S.cable(self, scope_lead.from, scope_lead.to, 60.0, Color("#2a2d33"), 4.0)
	var c: Vector2 = scope_lead.to
	S.rr(self, Rect2(c + Vector2(-9, -26), Vector2(18, 32)), 5, Color("#2e7d32")); S.rr(self, Rect2(c + Vector2(-6, -22), Vector2(12, 12)), 3, Color("#7CFF6B"))
	draw_line(c + Vector2(0, 6), c + Vector2(0, 12), Color("#d8dce0"), 3.0)
	S.text(self, S.hand(), "CH1", c + Vector2(12, -12), 14, Color("#9dffa0"))

func _lead(ld: Dictionary) -> void:
	var a: Vector2 = ld.from; var tip: Vector2 = ld.tip; var col: Color = ld.col
	var grip := tip + Vector2(52, -96)     # the probe body is held up and to the right of its tip
	S.cable(self, a, grip, 70.0, col.darkened(0.55) if col.r > col.g else Color("#1b1c20"), 5.0)
	var dir := (tip - grip).normalized(); var side := dir.orthogonal()
	var body := PackedVector2Array([grip + side * 11, grip - side * 11, grip + dir * 70 - side * 6, grip + dir * 70 + side * 6])
	draw_colored_polygon(body.duplicate(), Color(0, 0, 0, 0.3))
	for i in body.size(): body[i] = body[i] + Vector2(0, -2)
	draw_colored_polygon(body, col.darkened(0.25)); draw_line(grip + dir * 4, grip + dir * 66, col.lightened(0.15), 5.0)
	draw_line(grip + dir * 70, tip, Color("#c9ced4"), 3.0); draw_circle(tip, 2.5, Color.WHITE)
	if ld.get("hover", false) or ld.get("on_pad", false): S.glow(self, tip, 30.0, Color(col, 0.35))
	if ld.get("on_pad", false): draw_arc(tip, 12.0, 0, TAU, 20, Color(col.lightened(0.3), 0.9), 2.5)

func _held() -> void:
	var p: float = held.p; var o: Vector2 = held.pos
	var pd: Dictionary = held.part
	draw_circle(o + Vector2(0, 22), 0.0, Color.BLACK)
	PartArt.draw(self, pd, o - Vector2(p * 1.0, 0), p, {"lit": 0.0, "smoked": false})

const CH_ID := 16        ## chit text sizes in design px: every line is 16 px or more at 1080p, and S.min_font lifts them to 16 screen px on a handheld
const CH_SPEC := 18
const CH_PAY := 16
const CH_RIB := 16

## The title and customer sizes of a chit: a long title shrinks (never under 16) to fit the width instead of running into the price.
static func _chit_sizes(tk: Dictionary, inner: float) -> Dictionary:
	var f := S.hand()
	var tsz := 28
	while tsz > 18 and S.tw(f, str(tk.get("title", "")), tsz) > inner: tsz -= 2
	var csz := 18
	while csz > 16 and S.tw(f, "for %s" % str(tk.get("customer", "")), csz) > inner: csz -= 1
	return {"t": maxi(tsz, S.min_font), "c": maxi(csz, S.min_font)}

## The height a chit needs: the same flow as _chit (ribbon, ticket line, title, customer, rule, the spec's wrapped lines, the fee line), so the paper grows to hold every line.
static func chit_need(tk: Dictionary, width: float, with_pay := true) -> float:
	var f := S.hand(); var inner := width - 28.0
	var sz := _chit_sizes(tk, inner)
	var y := 14.0 + float(maxi(CH_ID, S.min_font)) + 12.0
	var mains = tk.get("mains", {})
	if mains is Dictionary and not (mains as Dictionary).is_empty():
		y += S.wrapped_h(f, str((mains as Dictionary).get("ribbon", "")), CH_RIB, inner) + 10.0 + 12.0
	y += float(sz.t) + 8.0 + float(sz.c) + 6.0 + 10.0
	var ssz := maxi(CH_SPEC, S.min_font)
	y += float(ssz) + 8.0 + S.wrapped_h(f, str(tk.get("spec", "")), CH_SPEC, inner) - float(ssz)
	var pay := str(tk.get("pay_text", ""))
	if pay != "" and with_pay:
		var psz := maxi(CH_PAY, S.min_font)
		y += float(psz) + 10.0 + S.wrapped_h(f, pay, CH_PAY, inner) - float(psz)
	return y + 12.0

func _chit() -> void:
	var r: Rect2 = L.get("chit", Rect2())
	if ticket.is_empty() or r.size == Vector2.ZERO: return
	S.paper(self, r, -3.0, Color("#f6efd8"))
	var c := r.get_center(); draw_set_transform(c, deg_to_rad(-3.0), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.pin(self, q.position + Vector2(r.size.x * 0.5, 10))
	var f := S.hand(); var inner := r.size.x - 28.0
	var fee: String = str(ticket.get("price_text", "")) if str(ticket.get("price_text", "")) != "" else "%d coins" % int(ticket.get("price", 0))
	# a flowing layout: every line sits under the one above, whatever the text size (handheld grows the text to 16 screen px)
	var y := q.position.y + 14.0 + float(maxi(CH_ID, S.min_font)) + 12.0
	var mains = ticket.get("mains", {})
	if mains is Dictionary and not (mains as Dictionary).is_empty():   # a mains ticket: the red ribbon, "simulated mains: do not try this at home", across the top of the card
		var rib := str((mains as Dictionary).get("ribbon", ""))
		var rf := maxi(CH_RIB, S.min_font)
		var rh := S.wrapped_h(f, rib, CH_RIB, inner) + 10.0
		draw_rect(Rect2(q.position.x, q.position.y + 22.0, r.size.x, rh), Color("#b3261c"), true)
		S.text(self, f, rib, Vector2(q.position.x + 14, q.position.y + 22.0 + float(rf) + 3.0), CH_RIB, Color("#fff4dc"), HORIZONTAL_ALIGNMENT_LEFT, inner)
		y += rh + 12.0
	var sz := _chit_sizes(ticket, inner)
	S.text(self, f, "TICKET %s%s" % [str(ticket.get("id", "")), "  EB" if bool(ticket.get("eb", false)) else ""], Vector2(q.position.x + 14, y), CH_ID, S.INK_RED)
	S.text(self, f, fee, Vector2(q.position.x + r.size.x - 14 - S.tw(f, fee, 17), y), 17, Color(S.INK, 0.8))
	y += float(sz.t) + 8.0
	S.text(self, f, str(ticket.get("title", "")), Vector2(q.position.x + 14, y), int(sz.t), S.INK)
	y += float(sz.c) + 6.0
	S.text(self, f, "for %s" % str(ticket.get("customer", "")), Vector2(q.position.x + 14, y), int(sz.c), Color(S.INK, 0.8))
	y += 10.0
	draw_line(Vector2(q.position.x + 12, y), Vector2(q.position.x + r.size.x - 12, y), Color(S.INK, 0.25), 1.5)
	var spec := str(ticket.get("spec", ""))
	var ssz := maxi(CH_SPEC, S.min_font)
	y += float(ssz) + 8.0
	S.text(self, f, spec, Vector2(q.position.x + 14, y), CH_SPEC, S.INK, HORIZONTAL_ALIGNMENT_LEFT, inner)
	y += S.wrapped_h(f, spec, CH_SPEC, inner) - float(ssz)
	var pay := str(ticket.get("pay_text", ""))
	var psz := maxi(CH_PAY, S.min_font)
	# the fee line: the paper is sized to hold it; while the FIXED stamp is on the chit the stamp takes its place (text is never stamped over)
	if pay != "" and chit_pay and not locked:
		y += float(psz) + 10.0
		S.text(self, f, pay, Vector2(q.position.x + 14, y), CH_PAY, Color(S.INK, 0.7), HORIZONTAL_ALIGNMENT_LEFT, inner)
	if locked:   # a rubber stamp: it sits below the last line of text and hangs over the paper's lower edge (onto the meter's blank top rim), never on the words
		draw_set_transform(c + Vector2(r.size.x * 0.5 - 62.0, y + 26.0), deg_to_rad(-8.0), Vector2.ONE)
		S.rr_line(self, Rect2(-52, -17, 104, 34), 6, Color(0.1, 0.55, 0.2, 0.9), 3.5)
		S.text(self, S.hand(), "FIXED", Vector2(-36, 9), 24, Color(0.1, 0.55, 0.2, 0.9))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _slip() -> void:
	if slip_text == "": return
	var r := slip_rect()
	var w := r.size.x - 40.0; var fs := 21
	S.paper(self, r, 1.5, Color("#f7f0d6"))
	var c := r.get_center(); draw_set_transform(c, deg_to_rad(1.5), Vector2.ONE)
	var q := Rect2(-r.size * 0.5, r.size)
	S.text(self, S.hand(), slip_step, q.position + Vector2(18, 28), 15, S.INK_RED)
	S.text(self, S.hand(), slip_text, q.position + Vector2(18, 56), fs, S.INK, HORIZONTAL_ALIGNMENT_LEFT, w)
	S.pin(self, q.position + Vector2(r.size.x - 20, 14), Color("#3a8f5a"))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if show_arrow:
		var from := Vector2(clampf(arrow_to.x, r.position.x + 30, r.end.x - 30), r.position.y - 4)
		if arrow_to.y > r.position.y: from = Vector2(r.end.x if arrow_to.x > r.end.x else clampf(arrow_to.x, r.position.x, r.end.x), r.get_center().y)
		var d := arrow_to - from
		var to := arrow_to - d.normalized() * 34.0
		S.hand_arrow(self, from, to, Color("#2b3a67"), 4.5, _arrow_k, 0.18)
		if _arrow_k >= 1.0:
			var pulse := 0.5 + 0.5 * sin(t * 4.0)
			draw_arc(arrow_to, 22.0 + 4.0 * pulse, 0.0, TAU, 24, Color("#ffd98a", 0.6 * pulse + 0.2), 3.0)

const BUB_FS := 20
## Where the speech bubble is drawn (grown UP to hold its sentence); the tail reaches 30 px left of it and 6 px below it, which is included.
func bubble_rect() -> Rect2:
	var q: Rect2 = L.get("bubble", Rect2())
	if bubble == "" or q.size == Vector2.ZERO: return Rect2()
	var need := S.wrapped_h(S.hand(), bubble, BUB_FS, q.size.x - 28.0) + 26.0
	return Rect2(q.position.x, q.end.y - need, q.size.x, need)   # sized to its sentence (grows up from the bottom edge, above her head)

func _bubble() -> void:
	var r: Rect2 = L.get("bubble", Rect2())
	if bubble == "" or r.size == Vector2.ZERO: return
	var a := bubble_alpha
	modulate = Color(1, 1, 1, 1)
	var q := bubble_rect()
	S.shadow(self, q, 22, Vector2(5, 7), 0.3 * a)
	S.rr(self, q, 22, Color(0.98, 0.96, 0.9, a)); S.rr_line(self, q, 22, Color(S.INK, 0.5 * a), 2.0)
	var cx := q.get_center().x   # the tail drops straight down to her head
	var tail := PackedVector2Array([Vector2(cx - 18, q.end.y - 4), Vector2(cx + 18, q.end.y - 4), Vector2(cx - 2, q.end.y + 12)])
	draw_colored_polygon(tail, Color(0.98, 0.96, 0.9, a))
	S.text(self, S.hand(), bubble, q.position + Vector2(14, 14.0 + float(maxi(BUB_FS, S.min_font))), BUB_FS, Color(S.INK, a), HORIZONTAL_ALIGNMENT_LEFT, q.size.x - 28)

func _tag() -> void:
	var s: String = tag.text; var p: Vector2 = tag.pos
	var w := S.tw(S.mono(), s, 20) + 22.0
	var r := Rect2(p + Vector2(18, -44), Vector2(w, 32))
	S.rr(self, r, 6, Color("#14161a", 0.92)); S.rr_line(self, r, 6, Color(S.AMBER, 0.8), 1.5)
	S.text(self, S.mono(), s, r.position + Vector2(11, 23), 20, S.AMBER)

func _toast() -> void:
	var a := clampf(minf(toast_age * 4.0, (toast_dur - toast_age) * 2.0), 0.0, 1.0)
	if toast_quick:
		var w := S.tw(S.mono(), toast, 18) + 26.0
		var q := Rect2(size.x * 0.5 - w * 0.5, 200, w, 30)
		S.rr(self, q, 8, Color("#14161a", 0.88 * a)); S.rr_line(self, q, 8, Color(S.AMBER, 0.5 * a), 1.5)
		S.text(self, S.mono(), toast, q.position + Vector2(13, 21), 18, Color(S.AMBER, a))
		return
	if S.handheld: _toast_dock(a); return
	var th := S.wrapped_h(S.hand(), toast, 22, 620.0)
	var r := Rect2(size.x * 0.5 - 330, 196, 660, maxf(46.0, th + 24.0))
	S.paper(self, r, -0.6, Color(0.97, 0.93, 0.8, a))
	S.text(self, S.hand(), toast, r.position + Vector2(20, 31), 22, Color(S.INK, a), HORIZONTAL_ALIGNMENT_LEFT, 620.0)

## Handheld: a long message card docks in the window strip above the bench (wide, four lines a page, paging by itself or with the wheel) instead of lying over the board.
## The card is as tall as its text (up to four lines); the page counter has a row of its own under the text.
const DOCK_W := 880.0                       ## card width in design px (a 1280-px handheld shows it 590 px wide)
const DOCK_LINES := 4                       ## lines a page: the card ends above the board's top edge
const DOCK_PAGE_S := 4.5                    ## seconds a page stays before the next one
var toast_scroll := 0                       ## the page shown
var toast_manual := false                   ## the wheel was used: stop paging by itself
var toast_rect := Rect2()                   ## where the docked card is (the scene sends the wheel here)
func _dock_para() -> TextParagraph:
	var tp := TextParagraph.new(); tp.add_string(toast, S.hand(), maxi(18, S.min_font)); tp.width = DOCK_W - 60.0
	return tp
func toast_lines() -> int: return _dock_para().get_line_count()
func dock_pages() -> int: return maxi(1, int(ceilf(float(toast_lines()) / float(DOCK_LINES))))

func _toast_dock(a: float) -> void:
	var sz := maxi(18, S.min_font)
	var tp := _dock_para()
	var n := tp.get_line_count(); var lh := S.hand().get_height(sz)
	var pages := maxi(1, int(ceilf(float(n) / float(DOCK_LINES))))
	var page := clampi(toast_scroll, 0, pages - 1)
	var first := page * DOCK_LINES
	var shown := mini(n - first, DOCK_LINES)
	var r := Rect2(size.x * 0.5 - DOCK_W * 0.5, 8.0, DOCK_W, float(shown) * lh + 22.0 + (26.0 if pages > 1 else 0.0))
	toast_rect = r
	S.paper(self, r, -0.4, Color(0.97, 0.93, 0.8, a))
	for i in shown: tp.draw_line(get_canvas_item(), r.position + Vector2(30, 10 + float(i) * lh), first + i, Color(S.INK, a))
	if pages > 1: S.text(self, S.mono(), "%d / %d" % [page + 1, pages], Vector2(r.end.x - 30.0 - S.tw(S.mono(), "%d / %d" % [page + 1, pages], 16), r.end.y - 8.0), 16, Color(S.INK, 0.6 * a))

## The folded scope drawer on phones: a peek strip with a mini trace, the amber/green band and the LOCK lamp, always in view.
func _peek() -> void:
	var r: Rect2 = peek.rect; var sc: Dictionary = peek.sc
	S.shadow(self, r, 14, Vector2(-6, 8), 0.5)
	S.rr(self, r, 14, Color("#4e5348")); S.rr(self, r.grow(-4), 12, Color("#6c7263"))
	var scr := Rect2(r.position + Vector2(10, 14), Vector2(r.size.x - 20, 150))
	S.rr(self, scr.grow(5), 10, Color("#15171a")); S.rr(self, scr, 8, Color("#0a1a10"))
	var lo := float(sc.lo); var hi := float(sc.hi); var top_v := float(sc.vdiv) * 7.0
	var y_of := func(v: float) -> float: return scr.end.y - 8.0 - clampf(v / top_v, 0.0, 1.0) * (scr.size.y - 16.0)
	var col: Color = S.PHOS if peek.locked else S.AMBER
	var y1: float = y_of.call(hi); var y0: float = y_of.call(lo)
	draw_rect(Rect2(scr.position.x, y1, scr.size.x, maxf(y0 - y1, 6.0)), Color(col, 0.28), true)
	var pts := PackedVector2Array(); var smp: Array = peek.samples
	for i in smp.size(): pts.append(Vector2(scr.position.x + 4.0 + float(i) / (smp.size() - 1) * (scr.size.x - 8.0), y_of.call(float(smp[i]))))
	if peek.live and pts.size() > 1: draw_polyline(pts, Color(0.5, 1.0, 0.5, 0.95), 2.5, true)
	var lamp := Vector2(r.position.x + r.size.x * 0.5, scr.end.y + 40.0)
	draw_circle(lamp, 14, Color("#0a1a14")); draw_circle(lamp, 10, Color("#7fffd4") if peek.locked else Color(0.1, 0.25, 0.2))
	if peek.locked: S.glow(self, lamp, 44.0, Color("#7fffd4", 0.5))
	S.text(self, S.mono(), "LOCK", lamp + Vector2(-22, 38), 18, Color("#7fffd4", 1.0 if peek.locked else 0.4))
	S.text(self, S.hand(), "scope", lamp + Vector2(-24, 74), 18, Color("#e8e0c8"))
	S.text(self, S.hand(), "<", lamp + Vector2(-8, 112), 34, Color("#e8e0c8", 0.8))
	S.text(self, S.hand(), str(peek.id), lamp + Vector2(-16, 150), 16, Color("#e8e0c8", 0.7))
