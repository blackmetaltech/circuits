class_name PartArt4
extends RefCounted
## Chapter 4 parts, drawn in code (DESIGN §5.1): the TO-220 regulator (bare, or with a clip-on aluminium heatsink: more fins for a lower thermal resistance) with a shutdown lamp, the customer's constant-current load (a little
## grey gadget box with a current arrow), the cathode band of every diode (drawn by PartArt._diode) and the Zener's bent bar. Local frame, like the other part art: origin = pad (x, y), pitch `p`.

static func _c(c: Color, sh: bool) -> Color: return PartArt.SHADOW if sh else c

## The regulator: three leads (pins 0..2 along +x, 2 pads apart), a black plastic body with a metal tab above it, the type printed on it, an optional heatsink behind the tab.
## `variant`: "TO220" (bare), "TO220-25" / "-15" / "-8" (sink of that many C/W: 25 small, 8 big). `hot` 0..1 tints the sink and the tab; `off`: the thermal shutdown lamp (red) is lit.
static func regulator(ci: CanvasItem, lp: Array, p: float, sh: bool, variant: String, hot: float, off: bool, smoked: bool, label: String) -> void:
	var x0: float = lp[0].x * p; var x1: float = lp[lp.size() - 1].x * p; var cx := (x0 + x1) * 0.5
	PartArt._leads(ci, lp, p, lp.map(func(v): return v + Vector2(0, -0.9)))
	var w := (x1 - x0) + p * 1.6
	var fins := 0
	if variant.ends_with("-25"): fins = 3
	elif variant.ends_with("-15"): fins = 5
	elif variant.ends_with("-8"): fins = 8
	var body := Rect2(cx - w * 0.5, -p * 3.3, w, p * 2.0)
	var tab := Rect2(cx - w * 0.5, -p * 4.4, w, p * 1.1)
	if fins > 0:   # the heatsink: an aluminium block behind the tab with fins standing up; bigger for a smaller thetaSA
		var sw := w + p * 0.6 + float(fins) * p * 0.1; var sh_h := p * (1.2 + float(fins) * 0.3)
		var blk := Rect2(cx - sw * 0.5, tab.position.y - sh_h, sw, sh_h + p * 0.2)
		var al := Color(0.74, 0.76, 0.8).lerp(Color(1.0, 0.5, 0.22), clampf(hot * 1.1, 0.0, 1.0)) if not sh else PartArt.SHADOW
		PartArt.rrect(ci, blk, p * 0.12, _c(al, sh))
		if not sh:
			for k in fins + 1:
				var fx := blk.position.x + p * 0.18 + (blk.size.x - p * 0.36) * float(k) / float(fins)
				ci.draw_line(Vector2(fx, blk.position.y + p * 0.12), Vector2(fx, tab.position.y), Color(0.4, 0.42, 0.46, 0.8), p * 0.1)
			ci.draw_line(blk.position + Vector2(p * 0.2, p * 0.1), Vector2(blk.end.x - p * 0.2, blk.position.y + p * 0.1), Color(1, 1, 1, 0.3), p * 0.07)
	var tab_col := Color(0.7, 0.72, 0.76).lerp(Color(1.0, 0.55, 0.25), clampf(hot, 0.0, 1.0))
	PartArt.rrect(ci, tab, p * 0.1, _c(tab_col, sh))
	PartArt.rrect(ci, body, p * 0.14, _c(Color(0.1, 0.1, 0.12) if not smoked else Color(0.03, 0.03, 0.03), sh))
	if sh: return
	ci.draw_circle(Vector2(cx, tab.position.y + p * 0.55), p * 0.26, Color(0.12, 0.12, 0.14))   # the mounting hole
	ci.draw_line(body.position + Vector2(p * 0.2, p * 0.2), Vector2(body.end.x - p * 0.2, body.position.y + p * 0.2), Color(1, 1, 1, 0.14), p * 0.07)
	PartArt3._txt(ci, label.get_slice(" ", 0), Vector2(cx - p * 0.62, body.position.y + p * 1.0), int(clampf(p * 0.5, 9.0, 20.0)), Color(0.86, 0.88, 0.95, 0.95))
	var lamp := Vector2(body.end.x - p * 0.4, body.end.y - p * 0.4)   # the shutdown lamp: dark while it runs, red while the chip has shut itself off
	ci.draw_circle(lamp, p * 0.2, Color(0.12, 0.04, 0.04)); ci.draw_circle(lamp, p * 0.14, Color(1.0, 0.25, 0.15) if off else Color(0.3, 0.1, 0.08))

## The customer's equipment: a grey plastic gadget box between OUT and GND with a downward current arrow and "mA".
static func cc_load(ci: CanvasItem, lp: Array, p: float, sh: bool) -> void:
	var a: Vector2 = lp[0] * p; var b: Vector2 = lp[1] * p; var mid := (a + b) * 0.5
	var al := (b - a).normalized(); var side := al.orthogonal()
	PartArt._leads(ci, [lp[0], lp[1]], p, [lp[0] + al * 1.2, lp[1] - al * 1.2])
	var h := (b - a).length() * 0.5 - p * 1.2; var w := p * 1.0
	ci.draw_colored_polygon(PackedVector2Array([mid - al * h - side * w, mid + al * h - side * w, mid + al * h + side * w, mid - al * h + side * w]), _c(Color("#6c7076"), sh))
	if sh: return
	var inner := PackedVector2Array([mid - al * (h - p * 0.15) - side * (w - p * 0.15), mid + al * (h - p * 0.15) - side * (w - p * 0.15), mid + al * (h - p * 0.15) + side * (w - p * 0.15), mid - al * (h - p * 0.15) + side * (w - p * 0.15)])
	ci.draw_colored_polygon(inner, Color("#8a8e95"))
	var tip := mid + al * h * 0.55; var tail := mid - al * h * 0.55
	ci.draw_line(tail, tip, Color("#1c1d20"), p * 0.12)
	ci.draw_colored_polygon(PackedVector2Array([tip + al * p * 0.3, tip - al * p * 0.1 - side * p * 0.3, tip - al * p * 0.1 + side * p * 0.3]), Color("#1c1d20"))
	PartArt3._txt(ci, "load", mid - side * p * 0.1 - al * p * 0.2 + side * p * 0.25, int(clampf(p * 0.4, 9.0, 18.0)), Color(0.12, 0.12, 0.14, 0.9))

## A Zener: the diode body with a Z-bent cathode bar (the bar's ends turn away), drawn over PartArt._diode's plain band.
static func zener_bar(ci: CanvasItem, p: float) -> void:
	var x := 2.6 * p; var y := 0.34 * p; var k := 0.22 * p
	var col := Color(0.82, 0.84, 0.88)
	ci.draw_line(Vector2(x, -y), Vector2(x, y), col, p * 0.2)
	ci.draw_line(Vector2(x - k, -y), Vector2(x, -y), col, p * 0.12); ci.draw_line(Vector2(x, y), Vector2(x + k, y), col, p * 0.12)
