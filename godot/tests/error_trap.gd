class_name ErrorTrap
extends Logger
## Counts every error the engine logs while a test runs (GDScript runtime errors such as "Invalid access to property or key 'board' on a base object of
## type 'Dictionary'", push_error calls, failed engine calls). Warnings do not count. A test installs it with OS.add_logger(trap) and ends with
## ok(trap.count == 0, ...). Errors raised on any thread are kept (the mutex guards the list).
var count := 0
var lines: Array = []
var _m := Mutex.new()

func _log_error(function: String, file: String, line: int, code: String, rationale: String, _editor_notify: bool, error_type: int, _script_backtraces: Array) -> void:
	if error_type == Logger.ERROR_TYPE_WARNING: return
	_m.lock()
	count += 1
	if lines.size() < 20: lines.append("%s:%d %s: %s" % [file.get_file(), line, function, rationale if rationale != "" else code])
	_m.unlock()
