#!/usr/bin/env bash
# Assemble and pack the .mcpb bundle. The bundle mirrors the repo layout under server/
# so the runtime path math in config.ts (packageRoot -> data/builds.json, node_modules
# resolution) is identical to a local `tsx` run — nothing in the app needs to know it is bundled.
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

# Compile TS -> dist/ (the bundle runs on plain node, no tsx).
npm run build

# Mirror the repo layout under server/.
cp -R dist "$BUNDLE/server/dist"
cp -R data "$BUNDLE/server/data"
cp package.json package-lock.json "$BUNDLE/server/"

# Copy the manifest, stamping version from package.json so the two never drift.
MCPB_OUT="$BUNDLE/manifest.json" MCPB_VERSION="$VERSION" node -e '
  const fs = require("fs");
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  manifest.version = process.env.MCPB_VERSION;
  fs.writeFileSync(process.env.MCPB_OUT, JSON.stringify(manifest, null, 2) + "\n");
'

# Production deps only, installed inside the bundle. No native modules (manifest reader
# uses node:sqlite), so --ignore-scripts is safe and keeps the tree platform-agnostic.
( cd "$BUNDLE/server" && npm ci --omit=dev --ignore-scripts )

# Zip + validate against the manifest schema.
npx -y @anthropic-ai/mcpb pack "$BUNDLE" "$OUT"

echo "Built $OUT"
