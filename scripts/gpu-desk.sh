#!/bin/zsh
# gpu-desk.sh: hand play on a GPU-backed window (phase C). Same verbs as core/qa/desk.sh, but the game renders with Forward+ on
# the NVIDIA GPU through PRIME on the real X display (gpu-shot.sh's environment), at real speed, with a frame cap.
# One window at a time across all games: `start` takes the shared GPU display lock and holds it until `stop`.
#   scripts/gpu-desk.sh start 1280x800 [VAR=VAL ...]     (CB_MAXFPS defaults to 60; saves isolated in $DIR/data)
#   scripts/gpu-desk.sh shot <name>                        prints the PNG path (window only); Read it
#   scripts/gpu-desk.sh click X Y | rclick X Y | move X Y | wheel X Y up|down [n] | drag X1 Y1 X2 Y2 [button]
#   scripts/gpu-desk.sh key <xdotool key name>             e.g. space Return Escape Tab ctrl+z bracketright
#   scripts/gpu-desk.sh log [n]                            last n lines of the game log (look for SCRIPT ERROR)
#   scripts/gpu-desk.sh stop                               closes the game and releases the lock
# Coordinates are window pixels (the window sits at 0,0). The pointer is the real one on that display: keep runs short.
set -u
ROOT=${0:A:h:h}
DIR=${GPU_DESK_DIR:-/tmp/cb-gpu-desk-${USER:-u}}
mkdir -p $DIR/data $DIR/shots
export DISPLAY=:0.0
CMD=${1:?usage: gpu-desk.sh start|shot|click|rclick|move|wheel|drag|key|log|stop ...}; shift
wid() { [[ -s $DIR/pid ]] && xdotool search --pid $(<$DIR/pid) 2>/dev/null | tail -1; }
case $CMD in
  start)
    RES=${1:-1280x800}; shift 2>/dev/null
    [[ -s $DIR/pid ]] && kill -0 $(<$DIR/pid) 2>/dev/null && { echo "gpu-desk: a game is already running (stop it first)"; exit 1; }
    # hold the shared lock in a small keeper process; its pid is recorded and stop ends exactly that process
    setsid zsh -c 'exec 9>/tmp/cb-gpu-display.lock; flock -w 300 9 || exit 3; echo $$ > "$1"; exec sleep infinity' zsh $DIR/lockpid &!
    for i in {1..300}; do [[ -s $DIR/lockpid ]] && break; sleep 1; done
    [[ -s $DIR/lockpid ]] || { echo "gpu-desk: GPU display lock busy for 5 min"; exit 3; }
    cd $ROOT/godot || exit 1
    : > $DIR/game.log
    setsid nohup sh -c 'echo $$ > "$1"; shift; exec "$@"' sh $DIR/pid env XDG_DATA_HOME=$DIR/data VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json \
      __NV_PRIME_RENDER_OFFLOAD=1 __VK_LAYER_NV_optimus=NVIDIA_only CB_NOAUTOSAVE=1 CB_MAXFPS=${CB_MAXFPS:-60} "$@" \
      ${CB_GODOT:-godot} --path . --rendering-method forward_plus --resolution $RES --position 0,0 > $DIR/game.log 2>&1 < /dev/null &!
    for i in {1..60}; do [[ -n $(wid) ]] && break; sleep 0.5; done
    sleep ${CB_SETTLE:-4}
    grep -m1 "Using Device" $DIR/game.log
    grep -qE "Forward\+ - Using Device.*NVIDIA" $DIR/game.log || echo "gpu-desk: WARNING: not Forward+ on NVIDIA (see log)"
    echo "window $(wid)";;
  shot)
    N=${1:-shot}; W=$(wid); [[ -n $W ]] || { echo "gpu-desk: no window"; exit 1; }
    import -window $W $DIR/shots/$N.png && echo $DIR/shots/$N.png;;
  click|rclick|move)
    W=$(wid); xdotool mousemove --window $W $1 $2; sleep 0.05
    [[ $CMD == click ]] && xdotool click 1; [[ $CMD == rclick ]] && xdotool click 3; true;;
  wheel)
    W=$(wid); xdotool mousemove --window $W $1 $2; B=4; [[ $3 == down ]] && B=5
    for i in {1..${4:-1}}; do xdotool click $B; sleep 0.05; done;;
  drag)
    W=$(wid); xdotool mousemove --window $W $1 $2 mousedown ${5:-1}; sleep 0.1
    xdotool mousemove --window $W $3 $4; sleep 0.1; xdotool mouseup ${5:-1};;
  key)
    W=$(wid); xdotool windowactivate --sync $W 2>/dev/null; xdotool key --clearmodifiers $1;;
  log) tail -n ${1:-40} $DIR/game.log;;
  stop)
    [[ -s $DIR/pid ]] && { P=$(<$DIR/pid); kill -TERM -- -$P 2>/dev/null; kill $P 2>/dev/null; sleep 0.5; kill -KILL -- -$P 2>/dev/null; }
    rm -f $DIR/pid
    [[ -s $DIR/lockpid ]] && { kill -TERM -- -$(<$DIR/lockpid) 2>/dev/null; kill $(<$DIR/lockpid) 2>/dev/null; }
    rm -f $DIR/lockpid; echo stopped;;
  *) echo "gpu-desk: unknown command $CMD"; exit 2;;
esac
