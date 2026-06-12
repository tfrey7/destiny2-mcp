#!/usr/bin/env bash
# Assemble and pack the .mcpb bundle. The server is esbuild-bundled into a SINGLE file
# (server/index.js) with all npm deps inlined — deliberately NOT a copied node_modules tree.
# Claude Desktop's install dialog enumerates every file in the bundle and times out on large
# trees (~2300 files of node_modules made the install silently hang with no dialog); collapsing
# to one file keeps the bundle at a handful of entries so it installs. The runtime path math in
# config.ts finds data/ by walking up to server/package.json, so the flat layout still resolves.
set -euo pipefail
cd "$(dirname "$0")/.."

# All build artifacts live under release/: the intermediate staging tree (release/bundle/) and the
# packed .mcpb. package.json is the single source of truth for the version; it is stamped into the
# manifest below.
OUTDIR=release
BUNDLE="$OUTDIR/bundle"
VERSION=$(node -p "require('./package.json').version")
OUT="$OUTDIR/destiny2-mcp-${VERSION}.mcpb"

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

# Copy the manifest, stamping version from package.json so the two never drift.
MCPB_OUT="$BUNDLE/manifest.json" MCPB_VERSION="$VERSION" node -e '
  const fs = require("fs");
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  manifest.version = process.env.MCPB_VERSION;
  fs.writeFileSync(process.env.MCPB_OUT, JSON.stringify(manifest, null, 2) + "\n");
'

# Zip + validate against the manifest schema.
npx -y @anthropic-ai/mcpb pack "$BUNDLE" "$OUT"

echo "Built $OUT"
echo "Bundle file count: $(unzip -l "$OUT" | tail -1 | awk '{print $2}')"
