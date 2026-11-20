#!/bin/zsh
# Screenshot run: all states at 1920x1080 and 1280x800 (and the phone 2424x1080 with CB_PHONE=1).
# One Godot process at a time. Usage: godot/tests/run_shots.sh [outdir]   (CB_ONLY=title,lock narrows it)
set -u
HERE=${0:A:h}; PROJ=${HERE:h}; OUT=${1:-$PROJ/../docs/screens/ch1}
mkdir -p $OUT
sizes=(1920x1080 1280x800)
[[ -n ${CB_PHONE:-} ]] && sizes+=(2424x1080)
for res in $sizes; do
  W=${res%x*}; H=${res#*x}
  CB_SHOTS=1 CB_NOSAVE=1 CB_UNLOCK=1 CB_SHOT_DIR=$OUT timeout 540 xvfb-run -a -s "-screen 0 ${W}x${H}x24" godot --path $PROJ --rendering-driver opengl3 --resolution $res 2>&1 | grep -E "^shot|^data|ERROR|SCRIPT"
done
