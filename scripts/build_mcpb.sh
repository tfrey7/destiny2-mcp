#!/usr/bin/env bash
# Assemble and pack the .mcpb bundle. Two independent things matter here:
#
# 1. The server is esbuild-bundled into a SINGLE file (server/index.js) with all npm deps
#    inlined — deliberately NOT a copied node_modules tree. This is for cleanliness/size only;
#    it is NOT an install fix. (An earlier theory blamed install failures on bundle file COUNT
#    — that was a misdiagnosis. The real cause is #2.) The runtime path math in config.ts finds
#    data/ by walking up to server/package.json, so the flat single-file layout still resolves.
#
# 2. The .mcpb is packed with STORED (uncompressed) zip entries, NOT `mcpb pack`'s default
#    DEFLATE. Claude Desktop's bundled Node (24.16+) has a stream pause/resume regression
#    (nodejs/node#62557) that DEADLOCKS its bundled zip reader on any DEFLATE entry whose
#    COMPRESSED size >= the stream highWaterMark — 64 KiB on macOS, 16 KiB on Windows. Opening
#    such a .mcpb silently hangs: no preview, no install dialog, no error, zero CPU
#    (anthropics/claude-code#67865, #68002). Storing every entry uncompressed never takes the
#    inflate path, so the bundle installs on affected AND fixed Desktop builds. Costs download
#    size (no compression); that is the accepted trade for an install that actually works.
set -euo pipefail
cd "$(dirname "$0")/.."

# All build artifacts live under release/: the intermediate staging tree (release/bundle/) and the
# packed .mcpb. package.json is the single source of truth for the version; it is stamped into the
# manifest below.
OUTDIR=release
BUNDLE="$OUTDIR/bundle"
VERSION=$(node -p "require('./package.json').version")
OUT="$OUTDIR/destiny2-mcp-${VERSION}.mcpb"
DISPLAY_SUFFIX=""

# Debug build (MCPB_DEBUG=1, via `npm run pack:mcpb:debug`): version the artifact as a prerelease of
# the next patch, "<next-patch>-<strand>" (e.g. 1.1.4-dummy-debug). This is valid semver that sorts
# ABOVE the installed release (so Desktop never treats the install as a downgrade) and BELOW the
# eventual release of that patch, while the -<strand> tag marks it as a throwaway. The bundle's
# `name` is unchanged, so installing it over the release build replaces it (Desktop keys replacement
# on name); the " (<strand>)" display-name suffix labels it in the extensions list.
if [[ "${MCPB_DEBUG:-}" == "1" ]]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$BRANCH" != strand/* ]]; then
    echo "ERROR: pack:mcpb:debug must run on a strand/<name> branch (on '$BRANCH'). Use pack:mcpb for releases." >&2
    exit 1
  fi
  STRAND=${BRANCH#strand/}
  NEXT_PATCH=$(node -e 'const [a,b,c]=require("./package.json").version.split(".").map(Number); console.log(`${a}.${b}.${c+1}`)')
  VERSION="${NEXT_PATCH}-${STRAND}"
  DISPLAY_SUFFIX=" ($STRAND)"
  OUT="$OUTDIR/destiny2-mcp-${STRAND}.mcpb"
fi

rm -rf "$OUTDIR"
mkdir -p "$BUNDLE/server"

# Typecheck before bundling — esbuild strips types without checking them.
npm run typecheck

# Bundle src/ + all deps into one ESM file. node: builtins (incl. node:sqlite) stay external.
# The banner shims require() so any CJS dep that calls it dynamically works under ESM on node.
npx esbuild src/index.ts \
  --bundle \
  --platform=node \
  --target=node24 \
  --format=esm \
  --outfile="$BUNDLE/server/index.js" \
  --banner:js="import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);"

# Runtime data files (read from disk, not imported) and package.json — the latter marks the dir as
# ESM ("type":"module") and is the anchor config.ts walks up to find for packageRoot.
cp -R data "$BUNDLE/server/data"
cp package.json "$BUNDLE/server/"

# The install-screen icon. Sits at the archive root next to manifest.json; the manifest's
# "icon" field points to it relative to that root. Without it Claude Desktop shows a "D" tile.
cp assets/icon.png "$BUNDLE/icon.png"

# Copy the manifest, stamping version from package.json so the two never drift. A debug build also
# appends DISPLAY_SUFFIX to display_name so a strand bundle is labelled in the extensions list.
MCPB_OUT="$BUNDLE/manifest.json" MCPB_VERSION="$VERSION" MCPB_DISPLAY_SUFFIX="$DISPLAY_SUFFIX" node -e '
  const fs = require("fs");
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  manifest.version = process.env.MCPB_VERSION;
  manifest.display_name += process.env.MCPB_DISPLAY_SUFFIX;
  fs.writeFileSync(process.env.MCPB_OUT, JSON.stringify(manifest, null, 2) + "\n");
'

# Validate the manifest against the MCPB schema — this is the check `mcpb pack` runs before it
# zips. We validate but do NOT use `mcpb pack` to build the archive, because it only emits
# DEFLATE entries (see header note #2); instead we zip by hand with STORED compression.
npx -y @anthropic-ai/mcpb validate "$BUNDLE/manifest.json"

# Pack STORED (uncompressed): -Z store = no compression, -X = drop extra file attrs, -r recurse.
# manifest.json must sit at the archive root. Run from inside $BUNDLE so paths are relative.
OUT_ABS="$PWD/$OUT"
rm -f "$OUT_ABS"
( cd "$BUNDLE" && zip -rX -Z store "$OUT_ABS" manifest.json icon.png server -x '*/.DS_Store' >/dev/null )

echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
# Guard: every entry must be Stored. A single DEFLATE entry >= the Node highWaterMark would
# silently brick install on Claude Desktop builds running Node 24.16+ (see header note #2).
# The method column ($2 in `unzip -v`) is "Stored" or "Defl:N"; error if any "Defl" appears.
if unzip -v "$OUT" | awk '$2 ~ /^Defl/ {found=1} END {exit !found}'; then
  echo "ERROR: bundle has DEFLATE (compressed) entries — would hang Claude Desktop install." >&2
  unzip -v "$OUT" >&2
  exit 1
fi
echo "All entries Stored — installable on Node 24.16+ Desktop builds."
