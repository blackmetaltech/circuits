#!/usr/bin/env bash
# CIRCUITS local release (a GitHub release per layer, built on this machine; pattern from GRID's scripts/release-local.sh).
# usage: scripts/release-local.sh <vX.Y.Z> [<source-dir>] [--no-upload]
#   source-dir: a checkout of that tag (default: this repo; it must be clean at the tag).
# Steps: build the sidecar -> export Linux (Godot 4.7.2 templates) -> bundle the pinned Node runtime + sidecar (core/ci/package.sh) -> zip
# -> smoke-run the Linux build headless (CB_SMOKE=1: title, then ticket 1-1; must print SMOKE OK, no SCRIPT ERROR) -> SHA256SUMS.txt
# -> gh release create (notes = that version's CHANGELOG section). The upload happens only after the headless smoke passes.
set -euo pipefail
ver=$1; src=${2:-$(cd "$(dirname "$0")/.." && pwd)}; upload=1
[ "${3:-}" = "--no-upload" ] && upload=0
src=$(cd "$src" && pwd); core=$src/core
NODE_VERSION=22.23.4
cache=$HOME/.cache/cobanana/node; mkdir -p "$cache"
out=${CB_RELEASE_OUT:-${TMPDIR:-/tmp}/circuits-release/$ver}; rm -rf "$out"; mkdir -p "$out/dist"
log() { echo "[release $ver] $*"; }

f=node-v$NODE_VERSION-linux-x64
if [ ! -d "$cache/$f" ]; then
  log "fetching $f"; curl -fsSL -o "$cache/$f.tar.xz" "https://nodejs.org/dist/v$NODE_VERSION/$f.tar.xz"; tar xf "$cache/$f.tar.xz" -C "$cache"
fi

cd "$src"
grep -q "\"version\": \"${ver#v}\"" package.json || { echo "package.json is not ${ver#v}" >&2; exit 1; }
log "sidecar"; ./node_modules/.bin/vite build -c vite.bridge.config.ts >/dev/null
log "import"; timeout 900 godot --headless --path godot --import >/dev/null 2>&1 || true
mkdir -p godot/build/linux
log "export Linux"
timeout 900 godot --headless --path godot --export-release Linux > "$out/export-Linux.log" 2>&1 || { echo "Linux export failed (see $out/export-Linux.log)" >&2; exit 1; }
CB_PROJECT=$src "$core/ci/package.sh" linux godot/build/linux "$cache/node-v$NODE_VERSION-linux-x64" "$out/pkg" "$ver" CIRCUITS node-circuits >/dev/null
# Linux as a zip; keep the executable bits
(cd "$out" && mkdir -p lx && tar xzf "pkg/CIRCUITS-$ver-linux.tar.gz" -C lx && cd lx && zip -qry "$out/dist/CIRCUITS-$ver-linux-x86_64.zip" CIRCUITS)

log "smoke-run the Linux export headless"
smoke=$(mktemp -d); (cd "$smoke" && unzip -q "$out/dist/CIRCUITS-$ver-linux-x86_64.zip")
HOME=$smoke/home CB_SMOKE=1 timeout 300 "$smoke/CIRCUITS/CIRCUITS.x86_64" --headless > "$out/smoke.log" 2>&1 || true
grep -q "SMOKE OK" "$out/smoke.log" || { echo "smoke failed: no SMOKE OK (see $out/smoke.log)" >&2; exit 1; }
! grep -qE "SCRIPT ERROR|Parse Error" "$out/smoke.log" || { echo "smoke failed: script errors (see $out/smoke.log)" >&2; exit 1; }
rm -rf "$smoke"; log "smoke OK"

(cd "$out/dist" && sha256sum *.zip > SHA256SUMS.txt)
v=${ver#v}
awk -v v="$v" '/^## \[/{p=index($0,"["v"]")>0; next} p' CHANGELOG.md > "$out/notes.md"
[ -s "$out/notes.md" ] || { echo "no CHANGELOG entry for $v" >&2; exit 1; }
printf '\n---\nBuilt locally from tag %s. Extract and run; Node.js is bundled.\n- **Linux (x86_64)**: unzip, run `CIRCUITS/node-circuits.sh` (needs a Vulkan driver).\n- Windows and macOS builds come from the CI release workflow; this release is Linux only.\n' "$ver" >> "$out/notes.md"
ls -la "$out/dist"
if [ $upload = 1 ]; then
  title=$(grep -m1 "^## \[$v\]" CHANGELOG.md | sed -E 's/^## \[[^]]*\] - //; s/ \(tag.*//')
  gh release create "$ver" -R blackmetaltech/circuits --title "CIRCUITS $v $title" --notes-file "$out/notes.md" "$out"/dist/*
  log "released"
fi
