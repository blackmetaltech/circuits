class_name SaveMigrate
extends RefCounted
## The game was called NODE until v0.1.0. Godot keeps `user://` in a folder named after the project (config/name), so the rename moved it from
## `<app_userdata>/NODE` to `<app_userdata>/CIRCUITS`. On the first start under the new name everything the old folder holds (the engine's saves,
## settings, logs) is copied across, and the stall's own file `node_stall.cfg` becomes `circuits_stall.cfg`. Nothing is overwritten or deleted, and a marker
## file stops it from running a second time (a player who deletes a save does not get the old one back).

const OLD_PROJECT := "NODE"
const OLD_STALL := "node_stall.cfg"
const NEW_STALL := "circuits_stall.cfg"
const MARKER := "migrated_from_node.txt"

## Copy every file under `old_dir` that is missing under `new_dir` (recursively). Returns how many files were copied.
static func copy_missing(old_dir: String, new_dir: String) -> int:
	if not DirAccess.dir_exists_absolute(old_dir): return 0
	DirAccess.make_dir_recursive_absolute(new_dir)
	var n := 0
	for f in DirAccess.get_files_at(old_dir):
		var dst := new_dir.path_join(f)
		if FileAccess.file_exists(dst): continue
		if DirAccess.copy_absolute(old_dir.path_join(f), dst) == OK: n += 1
	for d in DirAccess.get_directories_at(old_dir):
		n += copy_missing(old_dir.path_join(d), new_dir.path_join(d))
	return n

## node_stall.cfg -> circuits_stall.cfg inside `dir`, when the new file is not there yet. Returns 1 when it was copied.
static func carry_stall_file(dir: String) -> int:
	var old := dir.path_join(OLD_STALL); var new := dir.path_join(NEW_STALL)
	if FileAccess.file_exists(old) and not FileAccess.file_exists(new) and DirAccess.copy_absolute(old, new) == OK: return 1
	return 0

## The whole migration between two folders (absolute paths). Returns the number of files carried over; 0 when there was nothing to do.
static func migrate(old_dir: String, new_dir: String) -> int:
	if FileAccess.file_exists(new_dir.path_join(MARKER)): return 0
	var n := 0
	if old_dir != new_dir: n += copy_missing(old_dir, new_dir)
	n += carry_stall_file(new_dir)
	DirAccess.make_dir_recursive_absolute(new_dir)
	var f := FileAccess.open(new_dir.path_join(MARKER), FileAccess.WRITE)
	if f != null: f.store_string("carried %d files from the NODE-era folder\n" % n)
	return n

static func old_user_dir() -> String: return OS.get_user_data_dir().get_base_dir().path_join(OLD_PROJECT)

## Called once at startup, before anything reads `user://`. Tests (CB_NOSAVE) never touch a real folder.
static func run_default() -> int:
	if OS.has_environment("CB_NOSAVE"): return 0
	return migrate(old_user_dir(), OS.get_user_data_dir())
