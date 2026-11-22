extends SceneTree
## Layout audit of the bench at 1920x1080 and 1280x800 (a handheld window: 1920x1200 design units, text sized in screen pixels), over every ticket of chapters 1 to 4:
## the speech bubble never touches the GO button or an instrument, nothing runs off the window, shoebox names fit their tags, chit text is 16 px or more on screen,
## the coin total stays inside the window, and a long explanation needs two pages or fewer on a handheld.
##   godot --headless --path godot -s res://tests/layout_flow.gd        (needs godot/sidecar/bridge.mjs; exit code 0 = all green)
const S = preload("res://stall/stall_style.gd")
var sc: StallScene
var bk: EngineBench
var fails := 0
var checks := 0
var verbose := OS.get_environment("CB_VERBOSE") != ""
const CHAPTERS := 5
const IDS := ["1-1", "1-2", "1-3", "1-4", "1-5", "2-1", "2-2", "2-3", "2-4", "3-1", "3-2", "3-3", "3-4", "4-1", "4-2", "4-3", "4-4", "4-5", "5-1", "5-2", "5-3", "5-4", "5-5"]

func _initialize() -> void:
	OS.set_environment("CB_NOSAVE", "1")
	_run()

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond:
		if verbose: print("  ok   ", what)
	else:
		fails += 1; print("  FAIL ", what)

func _frames(n: int) -> void:
	for i in n: await process_frame

func _set_layout(res: Vector2i) -> void:
	var handheld := res.x < 1600
	OS.set_environment("CB_LAYOUT", "handheld" if handheld else "desktop")
	root.get_window().size = res
	var k := minf(float(res.x) / 1920.0, float(res.y) / 1080.0)
	sc.size = Vector2(float(res.x) / k, float(res.y) / k)
	sc._lay_key = ""

func _run() -> void:
	sc = StallScene.new(); root.add_child(sc)
	sc.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT); sc.size = Vector2(1920, 1080)
	await _frames(6)
	if not sc.backend.ENGINE:
		print("FAIL the engine sidecar did not start (npx vite build -c vite.bridge.config.ts)"); quit(2); return
	bk = sc.backend
	bk.new_game()
	for res in [Vector2i(1920, 1080), Vector2i(1280, 800)]:
		await _set_layout_and_frames(res)
		for id in IDS:
			bk.unlock_through(id); sc.start_ticket(id)
			if bk.safety_pending(): bk.read_safety()
			sc.pages.show_page(""); sc._lay_key = ""
			await _frames(3)
			await _audit(id, res)
	for res in [Vector2i(1920, 1080), Vector2i(1280, 800)]:
		await _set_layout_and_frames(res)
		await _map_audit(res)
	print("layout_flow: %d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)

func _set_layout_and_frames(res: Vector2i) -> void:
	_set_layout(res); await _frames(3)

func _inst_rects() -> Dictionary:
	var out := {}
	out["scope"] = Rect2(sc.scope.position, ScopeView.DESIGN * sc.scope.scale.x)
	out["supply"] = Rect2(sc.supply.position, SupplyView.DESIGN * sc.supply.scale.x)
	out["dmm"] = Rect2(sc.dmm.position, DmmView.DESIGN * sc.dmm.scale.x)
	out["go"] = sc.L.bench
	out["tin"] = sc.props.tin_rect_full()
	out["chit"] = sc.L.chit
	return out

func _audit(id: String, res: Vector2i) -> void:
	var tag := "%s @%dx%d" % [id, res.x, res.y]
	ok(sc.handheld == (res.x < 1600) and (S.min_font >= 20) == (res.x < 1600) and int(sc.size.y) == (1200 if res.x < 1600 else 1080), "%s the layout class is the one under test (handheld %s, min font %d, scene %s)" % [tag, str(sc.handheld), S.min_font, str(sc.size)])
	var W := sc.size.x; var H := sc.size.y
	var R := _inst_rects()
	# the customer's line, for both states of the ticket
	for line in [str(bk.ticket.get("ask", "")), str(bk.ticket.get("thanks", ""))]:
		sc.top.bubble = line
		var b: Rect2 = sc.top.bubble_rect()
		if verbose: print("  ", tag, " bubble ", b, " go ", R.go)
		ok(b.size != Vector2.ZERO and b.position.y >= 0.0, "%s the bubble stays in the window (%s)" % [tag, str(b)])
		var bt := Rect2(b.position - Vector2(6, 6), b.size + Vector2(12, 24))   # with its tail and a margin
		for k in ["go", "scope", "supply", "dmm", "tin", "chit"]:
			ok(not bt.intersects(R[k]), "%s the bubble does not touch %s (%s vs %s)" % [tag, k, str(bt), str(R[k])])
		ok(not bt.intersects(sc.board_rect), "%s the bubble does not cover the perfboard (%s vs %s)" % [tag, str(bt), str(sc.board_rect)])
		ok(not bt.intersects(Rect2(sc.L.box)) and not bt.intersects(Rect2(sc.L.notebook)), "%s the bubble does not cover the shoebox or the notebook" % tag)
		var ex: Rect2 = sc.L.exam
		ok(not bt.intersects(ex), "%s the bubble does not touch the exam / crew card" % tag)
	# the customer is fully readable: the face and the paper in the hands inside the window, clear of every control
	var cv: Rect2 = StallProps.customer_visible(sc.L.customer)
	ok(cv.position.y >= 0.0 and cv.end.y <= H - 4.0 and cv.position.x >= 0.0 and cv.end.x <= W, "%s the customer (face and paper) is inside the window (%s in %dx%d)" % [tag, str(cv), int(W), int(H)])
	for k in ["go", "scope", "supply", "dmm", "tin", "chit"]:
		ok(not cv.intersects(R[k]), "%s the customer does not overlap %s (%s vs %s)" % [tag, k, str(cv), str(R[k])])
	ok(not cv.intersects(sc.board_rect), "%s the customer does not overlap the perfboard (%s vs %s)" % [tag, str(cv), str(sc.board_rect)])
	ok(not cv.intersects(Rect2(sc.L.box)) and not cv.intersects(Rect2(sc.L.notebook)) and not cv.intersects(sc.L.exam), "%s the customer is clear of the shoebox, the notebook and the exam card" % tag)
	for k in ["go", "scope", "supply", "dmm", "tin"]:
		var r: Rect2 = R[k]
		ok(r.position.x >= 0.0 and r.position.y >= 0.0 and r.end.x <= W + 0.5 and r.end.y <= H + 0.5, "%s %s inside the window (%s in %dx%d)" % [tag, k, str(r), int(W), int(H)])
	# instruments never overlap each other (the supply and the meter sit under the scope)
	ok(not R.supply.intersects(R.dmm), "%s supply and meter do not overlap" % tag)
	ok(not R.scope.grow(-4).intersects(R.supply) and not R.scope.grow(-4).intersects(R.dmm), "%s the scope is clear of the supply and the meter" % tag)
	ok(not R.go.intersects(R.dmm) and not R.go.intersects(R.supply), "%s GO is clear of the supply and the meter" % tag)
	ok(not R.tin.intersects(R.go) and not R.tin.intersects(R.dmm), "%s the tin is clear of GO and the meter" % tag)
	var dmm_body := Rect2(R.dmm.position + Vector2(0, 36), R.dmm.size - Vector2(0, 36))   # the meter's top rim is blank bezel: the paper may hang over it
	ok(not R.chit.intersects(R.supply) and not R.chit.intersects(dmm_body) and not R.chit.intersects(R.tin), "%s the chit is clear of the supply, the meter and the tin (%s)" % [tag, str(R.chit)])
	ok(sc.top.chit_need(bk.ticket, R.chit.size.x, sc.top.chit_pay) <= R.chit.size.y + 0.5, "%s the chit paper holds every line of its text (%.0f of %.0f)" % [tag, sc.top.chit_need(bk.ticket, R.chit.size.x, sc.top.chit_pay), R.chit.size.y])
	# Wren's slip: every step's text, however long, keeps the paper off the perfboard, inside the window and clear of the customer and her bubble
	var cvw: Dictionary = bk.coach_view()
	var step_texts: Array = ["Fixed! Click here (or open the notebook) for the next ticket."]
	for st in cvw.steps: step_texts.append(str(st.text))
	for txt in step_texts:
		var lay: Dictionary = sc.slip_layout(txt); var sr: Rect2 = lay.rect
		ok(not sr.intersects(sc.board_rect), "%s the coach slip stays off the perfboard (%d chars, %s vs %s)" % [tag, txt.length(), str(sr), str(sc.board_rect)])
		ok(sr.position.x >= 0.0 and sr.end.y <= H and sr.position.y >= 0.0, "%s the coach slip is inside the window (%s)" % [tag, str(sr)])
		ok(not sr.intersects(cv) and not sr.intersects(Rect2(sc.L.bubble.position.x - 6.0, sc.L.bubble.position.y - 60.0, 330.0, 190.0)), "%s the coach slip is clear of the customer and her bubble" % tag)
		ok(int(lay.fs) >= 16 and S.wrapped_h(S.hand(), txt, int(lay.fs), sr.size.x - 40.0) + 84.0 <= sr.size.y + 0.5, "%s the coach slip holds all its text at %d px" % [tag, int(lay.fs)])
	# the coin total sits inside the window
	var tt: Rect2 = sc.props.tin_text_rect()
	ok(tt.end.y <= H - 6.0, "%s the coin total is not clipped (bottom %.0f of %.0f)" % [tag, tt.end.y, H])
	# the board view: every connector and every point of the reference design is on screen, and the pad pitch is not smaller than the whole board's
	var ref: Dictionary = EngineBench.REFS.get(id, EngineBench.REFS_CH2.get(id, EngineBench.REFS_CH3.get(id, EngineBench.REFS_CH4.get(id, EngineBench.REFS_CH5.get(id, {})))))
	var pts: Array = []
	for c in bk.ticket.board.connectors: pts.append(Vector2(c.pad[0], c.pad[1]))
	for w in ref.get("wires", []): for q in w: pts.append(Vector2(q[0], q[1]))
	for q in ref.get("parts", []): pts.append(Vector2(q[3], q[4]))
	for pt in bk.parts:   # fixed parts of the ticket (the relay, the slide wire, the sealed module): every pin, and a pad of room around the body
		for q in pt.pins: pts.append(Vector2(q[0], q[1]))
		var lo := Vector2(1e9, 1e9); var hi := Vector2(-1e9, -1e9)
		for q in pt.pins: lo = Vector2(minf(lo.x, q[0]), minf(lo.y, q[1])); hi = Vector2(maxf(hi.x, q[0]), maxf(hi.y, q[1]))
		pts.append(hi + Vector2(1, 1)); pts.append(lo - Vector2(1, 1))
	for q in pts:
		var sp := sc.pad_screen(q)
		ok(sc.board_rect.grow(-2.0).has_point(sp), "%s pad %s is on screen at %s (board %s)" % [tag, str(q), str(sp), str(sc.board_rect)])
	ok(sc.bench.p >= 28.0, "%s the board pitch is %.1f px per pad" % [tag, sc.bench.p])
	# shoebox names fit their tags
	var inner: Rect2 = sc.props.box_inner()
	for it in sc.props.items:
		var fit: Dictionary = sc.props.label_fit(it, inner.size.x - 4.0 - StallProps.LABEL_X - 10.0)
		ok(bool(fit.fits), "%s shoebox name fits: '%s' (%s)" % [tag, str(it.label), str(fit)])


## The chapter pages of the notebook (the map): every ticket card's text is 16 px or more on screen, sits inside its card, and no two text blocks of one card overlap (the "locked" tag
## used to run over the spec); both with the later chapters locked (a fresh game) and with everything unlocked.
func _map_audit(res: Vector2i) -> void:
	for pass_i in 2:
		if pass_i == 0: bk.new_game()
		else: bk.unlock_through(IDS[IDS.size() - 1])
		for ch in range(1, CHAPTERS + 1):
			sc.start_ticket(IDS[0]); sc.map_chapter = ch; sc._refresh_pages()
			sc.pages.record_cards = true; sc.pages.card_rects.clear(); sc.pages.show_page("map"); sc.pages.open_t = 1.0
			await _frames(3)
			sc.pages.card_rects.clear(); sc.pages.queue_redraw(); await _frames(2)
			var tag := "map ch%d @%dx%d %s" % [ch, res.x, res.y, "fresh" if pass_i == 0 else "all unlocked"]
			var cards := {}; var texts: Array = []
			for e in sc.pages.card_rects:
				if e.has("card"): cards[e.id] = e.card
				else: texts.append(e)
			ok(texts.size() > 0 and cards.size() == sc.pages.tickets.size(), "%s: %d cards recorded (%d text lines)" % [tag, cards.size(), texts.size()])
			for e in texts:
				ok(int(e.size) >= 16, "%s: %s '%s' is %d px (16 minimum)" % [tag, e.id, str(e.text).left(24), int(e.size)])
				if cards.has(e.id): ok((cards[e.id] as Rect2).grow(2.0).encloses(e.rect), "%s: %s '%s' stays on its card (%s vs %s)" % [tag, e.id, str(e.text).left(24), str(e.rect), str(cards[e.id])])
			for i in texts.size():
				for j in range(i + 1, texts.size()):
					if texts[i].id != texts[j].id: continue
					var ra: Rect2 = (texts[i].rect as Rect2).grow(-2.0); var rb: Rect2 = (texts[j].rect as Rect2).grow(-2.0)
					ok(not ra.intersects(rb), "%s: %s '%s' does not overlap '%s' (%s vs %s)" % [tag, texts[i].id, str(texts[i].text).left(18), str(texts[j].text).left(18), str(ra), str(rb)])
			var lp: Rect2 = sc.pages.map_left_free
			ok(lp.size.y >= 120.0, "%s: the left page has room for its sketch (%s)" % [tag, str(lp)])
	sc.pages.record_cards = false; sc.pages.show_page("")
