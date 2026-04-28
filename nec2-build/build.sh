#!/usr/bin/env bash
# Build nec2c to WebAssembly via Emscripten.
#
# Output: ../public/nec2.js  (loader)
#         ../public/nec2.wasm (binary)
#
# Usage: source ~/emsdk/emsdk_env.sh && ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v emcc >/dev/null 2>&1; then
  echo "ERROR: emcc not on PATH. Run: source ~/emsdk/emsdk_env.sh" >&2
  exit 1
fi

SRC_DIR="nec2c-src"

# The source includes two main()s (main.c and nec2c.c). Makefile.am uses main.c.
SOURCES=(
  "$SRC_DIR/calculations.c"
  "$SRC_DIR/geometry.c"
  "$SRC_DIR/input.c"
  "$SRC_DIR/matrix.c"
  "$SRC_DIR/network.c"
  "$SRC_DIR/shared.c"
  "$SRC_DIR/fields.c"
  "$SRC_DIR/ground.c"
  "$SRC_DIR/main.c"
  "$SRC_DIR/misc.c"
  "$SRC_DIR/radiation.c"
  "$SRC_DIR/somnec.c"
)

OUT_DIR="../public"
mkdir -p "$OUT_DIR"

# Notes on flags:
# -O2 for a sane balance of perf and compile time
# -s MODULARIZE=1 + EXPORT_ES6=1 so Vite can import it as an ES module
# -s INVOKE_RUN=0 so JS can drive main() via callMain()
# -s EXIT_RUNTIME=0 so we can call main() repeatedly without tearing down the module
# -s ALLOW_MEMORY_GROWTH=1 because NEC-2 allocates heavily based on problem size
# -s FORCE_FILESYSTEM=1 so MEMFS is available for input/output cards
# -s EXPORTED_RUNTIME_METHODS exposes the helpers we use from JS
# -s ENVIRONMENT=web,worker keeps the bundle lean (no node-specific shims)
# -lm for libm (complex.h trig)

emcc "${SOURCES[@]}" \
  -I"$SRC_DIR" \
  -O2 \
  -DHAVE_STRLCPY=0 \
  -DPACKAGE_STRING='"nec2c-wasm 1.7.7"' \
  -DPACKAGE_VERSION='"1.7.7"' \
  -DPACKAGE_NAME='"nec2c-wasm"' \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=Nec2Module \
  -s INVOKE_RUN=0 \
  -s EXIT_RUNTIME=0 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=33554432 \
  -s FORCE_FILESYSTEM=1 \
  -s EXPORTED_RUNTIME_METHODS='["callMain","FS","cwrap","ccall"]' \
  -s ENVIRONMENT=web,worker,node \
  -Wno-incompatible-pointer-types \
  -Wno-implicit-function-declaration \
  -Wno-int-conversion \
  -lm \
  -o "$OUT_DIR/nec2.js"

echo
echo "Build complete:"
ls -lh "$OUT_DIR/nec2.js" "$OUT_DIR/nec2.wasm"
