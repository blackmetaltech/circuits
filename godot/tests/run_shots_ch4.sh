#!/bin/zsh
# Chapter 4 screenshot run: every state at 1920x1080 and 1280x800 into docs/screens/ch4 (192 colours). One Godot process at a time, on desk slot g (display :267), the Xvfb is stopped when done.
# Usage: godot/tests/run_shots_ch4.sh [outdir]   (CB_ONLY=s41,s43 narrows it)
set -u
HERE=${0:A:h}; PROJ=${HERE:h}; OUT=${1:-$PROJ/../docs/screens/ch4}
mkdir -p $OUT
export XDG_DATA_HOME=${XDG_DATA_HOME:-${TMPDIR:-/tmp}/circuits-shots/data}
Xvfb :267 -screen 0 1920x1080x24 >/dev/null 2>&1 &
XPID=$!
sleep 2
for res in 1920x1080 1280x800; do
  DISPLAY=:267 CB_SHOTS=ch4 CB_NOSAVE=1 CB_SHOT_DIR=$OUT timeout 900 godot --path $PROJ --rendering-driver opengl3 --resolution $res 2>&1 | grep -E "^shot|^data|SCRIPT|ERROR" | grep -v "translation"
done
kill $XPID
for f in $OUT/*.png; do convert "$f" -colors 192 PNG8:"$f.q" && mv "$f.q" "$f"; done
