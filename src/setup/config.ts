import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: new URL("../../.env", import.meta.url) });

export const BUNGIE_BASE = "https://www.bungie.net/Platform";
export const AUTHORIZE_URL = "https://www.bungie.net/en/OAuth/Authorize";
export const TOKEN_URL = "https://www.bungie.net/Platform/App/OAuth/token/";

export const CALLBACK_PORT = 7777;
export const REDIRECT_URI = `https://127.0.0.1:${CALLBACK_PORT}/callback`;

export const DATA_DIR = join(homedir(), ".destiny2-mcp");
export const TOKENS_PATH = join(DATA_DIR, "tokens.json");
export const MANIFEST_DIR = join(DATA_DIR, "manifest");
export const CERT_DIR = join(DATA_DIR, "certs");

// Walk up from this module to the nearest dir holding package.json. Anchoring on a marker file
// (not a fixed number of "..") keeps data/ resolvable across every layout: tsx-from-src, the
// multi-file tsc dist/, and the single-file esbuild bundle the .mcpb ships (where this module is
// no longer three levels deep). package.json sits at the package root in all three.
const packageRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)));

function findPackageRoot(start: string): string {
  for (let dir = start; ; ) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }

    const parent = dirname(dir);

    if (parent === dir) {
      return start; // hit the filesystem root without a match — fall back
    }

    dir = parent;
  }
}

export const BUILDS_FILE = join(packageRoot, "data", "builds.json");

export const ORNAMENTS_FILE = join(packageRoot, "data", "ornaments.json");

export const SHADERS_FILE = join(packageRoot, "data", "shaders.json");

export const TRIUMPHS_FILE = join(packageRoot, "data", "triumphs.json");

export const GOD_ROLLS_FILE = join(packageRoot, "data", "god-rolls.json");

export function credentials() {
  return {
    apiKey: credential("apiKey", "BUNGIE_API_KEY"),
    clientId: credential("clientId", "BUNGIE_CLIENT_ID"),
    clientSecret: credential("clientSecret", "BUNGIE_CLIENT_SECRET"),
  };
}

// Baked into the bundle so the .mcpb ships ready-to-run with no per-user secret prompt — the DIM
// model (see docs/oauth-mcpb-findings.md). These are *app* credentials, not per-user; env vars
// override them so local dev reads from .env and the real values are pasted in only at bundle time.
const BAKED_IN = {
  apiKey: "4325eb7894a543c6a69b3b5a37b441b2",
  clientId: "52705",
  clientSecret: "jH0e4rC0MN96utuh8i4hvUEqOvuoRuKxh76DYm.AlWk",
};

function credential(name: keyof typeof BAKED_IN, envName: string): string {
  const value = process.env[envName] || BAKED_IN[name];

  if (!value) {
    throw new Error(`[destiny2-mcp] Missing ${envName} — set it in .env or bake it into config.ts`);
  }

  return value;
}
