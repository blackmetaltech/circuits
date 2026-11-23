#!/usr/bin/env bash
# scripts/flows.sh [out_dir] : the Godot flows that CI runs (the "New look ... Godot flows on the real engine" step), one at a time, each through the
# shared runner core/qa/run-flow.sh. The runner fails a flow on a script error in its log (SCRIPT ERROR, Parse Error, "Error calling ..."), a missing
# OK line, a timeout, or a check count under the minimum in flow-min.txt. RAISE=1 scripts/flows.sh raises the minimums after a green run (never lowers).
# Add a new flow HERE (and run RAISE=1 once): CI calls this script, so a flow listed only in a workflow file is not covered by the minimums.
# Prints one PASS/FAIL line per flow, exits 1 if any failed (all flows still run, so one report shows every failure).
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
O=${1:-${TMPDIR:-/tmp}/circuits-flows}; mkdir -p "$O"
raise=(); [ -n "${RAISE:-}" ] && raise=(--raise)
bad=0
for spec in look2_ch1_flow:600 look2_ch23_flow:900 look2_swap_flow:400 look2_testbed_flow:600 look2_pad_flow:300 look2_frame_flow:300 sfx_flow:120 look2_save_flow:300; do
  core/qa/run-flow.sh -o "$O" -T "${spec#*:}" "${raise[@]}" "${spec%%:*}" || bad=1
done
[ $bad -eq 0 ] && echo "ALL FLOWS PASS" || echo "FAILED"
exit $bad
