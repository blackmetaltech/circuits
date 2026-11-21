extends SceneTree
## The NODE -> CIRCUITS rename moves `user://` (Godot names the folder after the project): an old save folder is carried over on the first start under the new name.
##   godot --headless --path godot -s res://tests/save_migrate_flow.gd         (exit code 0 = green)
var fails := 0
var checks := 0

func ok(cond: bool, what: String) -> void:
	checks += 1
	if cond: print("  ok   ", what)
	else:
		fails += 1; print("  FAIL ", what)

func _write(path: String, text: String) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var f := FileAccess.open(path, FileAccess.WRITE); f.store_string(text); f.close()

func _read(path: String) -> String:
	if not FileAccess.file_exists(path): return "<missing>"
	return FileAccess.get_file_as_string(path)

func _rm(dir: String) -> void:
	if not DirAccess.dir_exists_absolute(dir): return
	for f in DirAccess.get_files_at(dir): DirAccess.remove_absolute(dir.path_join(f))
	for d in DirAccess.get_directories_at(dir): _rm(dir.path_join(d))
	DirAccess.remove_absolute(dir)

func _initialize() -> void:
	var base := OS.get_user_data_dir().path_join("_migrate_test")
	_rm(base)
	var old := base.path_join("NODE"); var new := base.path_join("CIRCUITS")
	ok(SaveMigrate.old_user_dir().get_file() == "NODE" and SaveMigrate.old_user_dir().get_base_dir() == OS.get_user_data_dir().get_base_dir(), "the old folder is the sibling called NODE of the new user folder")
	ok(ProjectSettings.get_setting("application/config/name") == "CIRCUITS", "the project is called CIRCUITS (that name is what moved user://)")
	print("== an old save folder is carried over")
	_write(old.path_join("saves/slot1.json"), "{\"wallet\":420}")
	_write(old.path_join("settings.cfg"), "[prefs]\ncute=false\n")
	_write(old.path_join(SaveMigrate.OLD_STALL), "[progress]\nwallet=420\ndone=[\"1-1\"]\n")
	var n := SaveMigrate.migrate(old, new)
	ok(n >= 4, "files were carried over (%d)" % n)
	ok(_read(new.path_join("saves/slot1.json")) == "{\"wallet\":420}", "the engine's save is in the new folder, byte for byte")
	ok(_read(new.path_join("settings.cfg")).contains("cute=false"), "the settings came along")
	ok(_read(new.path_join(SaveMigrate.NEW_STALL)).contains("wallet=420"), "the stall file is now circuits_stall.cfg with the same progress")
	ok(FileAccess.file_exists(old.path_join("saves/slot1.json")), "the old folder is left alone (nothing deleted)")
	print("== it runs once")
	DirAccess.remove_absolute(new.path_join("saves/slot1.json"))
	_write(new.path_join(SaveMigrate.NEW_STALL), "[progress]\nwallet=999\n")
	ok(SaveMigrate.migrate(old, new) == 0 and _read(new.path_join("saves/slot1.json")) == "<missing>", "a second start copies nothing (a deleted save does not come back)")
	ok(_read(new.path_join(SaveMigrate.NEW_STALL)).contains("wallet=999"), "and never overwrites the new file")
	print("== a new file wins, a missing one is filled")
	_rm(new)
	_write(new.path_join("settings.cfg"), "[prefs]\ncute=true\n")
	SaveMigrate.migrate(old, new)
	ok(_read(new.path_join("settings.cfg")).contains("cute=true"), "a file the new folder already has is not overwritten")
	ok(_read(new.path_join("saves/slot1.json")) != "<missing>", "a file it lacks is filled in")
	print("== same folder (a platform that keeps the user folder): only the stall file is renamed")
	_rm(old); _rm(new)
	_write(old.path_join(SaveMigrate.OLD_STALL), "[progress]\nwallet=7\n")
	SaveMigrate.migrate(old, old)
	ok(_read(old.path_join(SaveMigrate.NEW_STALL)).contains("wallet=7"), "node_stall.cfg is read as circuits_stall.cfg in place")
	print("== nothing to migrate")
	_rm(base)
	ok(SaveMigrate.migrate(base.path_join("none"), base.path_join("fresh")) == 0, "a fresh install has nothing to carry")
	_rm(base)
	print("save_migrate_flow: %d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
