extends CbApp
## NODE front-end (M0 skeleton). Everything else (title, top bar, dock, drawers, toasts, settings, codex, saves, coach, pad, touch,
## env hooks, smoke) comes from CbApp in addons/cobanana. This file only says what is specific to the game. The world is a
## placeholder bench rectangle until the real bench view (M2).
var bench: BenchView

func game_config() -> Dictionary:
	return {
		"title": str(ProjectSettings.get_setting("application/config/name", "NODE")),
		"tagline": tr("NODE_TAGLINE"),
		"blurb": tr("NODE_BLURB"),
		"accent": Color("#35c8ff"), "accent2": Color("#ffb347"),
		"modes": [["learner", tr("MODE_LEARNER"), tr("MODE_LEARNER_DESC")], ["engineer", tr("MODE_ENGINEER"), tr("MODE_ENGINEER_DESC")], ["sandbox", tr("MODE_SANDBOX"), tr("MODE_SANDBOX_DESC")]],
		"dock": [["level", tr("DOCK_LEVEL"), Color("#ffb347"), tr("DOCK_LEVEL")], ["codex", tr("DOCK_CODEX"), Color("#9fb4c8"), tr("DOCK_CODEX")]],
		"screens": {"level": "res://screens/level.gd"},
		"overlay": ["level"], "full": ["codex"],
		"tick_label": tr("TICK_BUTTON"), "tick_seconds": [0.0, 4.0, 1.6, 0.6],
		"keys": [["Space", tr("KEY_SPACE_DESC")], ["1-2", tr("KEY_DOCK_DESC")]],
	}

func game_build_world(parent: Node) -> Node:
	bench = BenchView.new(); bench.app = self; parent.add_child(bench)
	return bench

func game_on_changed() -> void:
	if bench == null: return
	var reg: Dictionary = b.q("region")
	bench.set_state(reg.get("strings", {}) if reg is Dictionary else {}, b.q("ticketCard"))

func game_time_text() -> String:
	return tr("HUD_TIME") % int(b.g.get("tick", 0))

func game_top_stats() -> Array:
	var p = b.q("progress")
	if p == null or not (p is Dictionary): return []
	var tk = b.g.get("ticket", null)
	return [[tr("HUD_WALLET"), str(p.get("walletText", "")), CbKit.ACC],
		[tr("HUD_TICKET"), str(tk.id) if tk is Dictionary else tr("HUD_NONE"), CbKit.TX if tk is Dictionary else CbKit.DIM]]

func game_coach_steps() -> Array:
	return [
		{"id": "bench", "kind": "read", "title": tr("COACH_BENCH_TITLE"),
			"body": tr("COACH_BENCH_BODY"),
			"why": tr("COACH_BENCH_WHY")},
	]

func game_camera(spec: String) -> void:
	if bench != null: bench.set_camera(spec)

func game_title_demo() -> void:   # the title's backdrop is the empty bench: nothing to animate yet
	pass

func game_smoke() -> void:
	CbSmoke._check(tr("NODE_TAGLINE") != "NODE_TAGLINE", "string catalogue locales/strings.csv is loaded (run --import)")
	var r: Dictionary = b.act("openTicket", ["0-0"]); await get_tree().process_frame
	CbSmoke._check(bool(r.get("ok", false)), "openTicket opens the placeholder ticket")
	var card = b.q("ticketCard")
	CbSmoke._check(card is Dictionary and str(card.id) == "0-0", "ticketCard answers")
	CbSmoke._check(bench.card.get("id", "") == "0-0" and bench.stall != "", "the world follows the engine's ticket and shows the stall name")
	show_screen("level"); await get_tree().process_frame
	bench.set_camera("close"); bench.set_camera("full")
	r = b.act("openTicket", ["nope"])
	CbSmoke._check(not bool(r.get("ok", true)) and str(r.get("message", "")) != "", "a bad ticket id teaches")
	b.act("closeTicket", []); await get_tree().process_frame
	CbSmoke._check(b.q("ticketCard") == null, "closeTicket returns to the counter")
	show_screen(home); await get_tree().process_frame

func _start_up() -> void:   # GATE-A SPIKE: delete after Gate A (BUILD-PLAN GA-2): CB_SPIKE=scope or user://spike.cfg opens the scope spike instead of the title
	var sc := SpikeScope.config()   # GATE-A SPIKE
	if not OS.has_environment("CB_SMOKE") and SpikeScope.enabled(sc):   # GATE-A SPIKE
		var sp := SpikeScope.new(); add_child(sp); sp.setup(self, sc); return   # GATE-A SPIKE
	super._start_up()   # GATE-A SPIKE
