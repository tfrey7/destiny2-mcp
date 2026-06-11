import { homedir } from "node:os";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: new URL("../.env", import.meta.url) });

export const BUNGIE_BASE = "https://www.bungie.net/Platform";
export const AUTHORIZE_URL = "https://www.bungie.net/en/OAuth/Authorize";
export const TOKEN_URL = "https://www.bungie.net/Platform/App/OAuth/token/";

export const CALLBACK_PORT = 7777;
export const REDIRECT_URI = `https://127.0.0.1:${CALLBACK_PORT}/callback`;

export const DATA_DIR = join(homedir(), ".destiny2-mcp");
export const TOKENS_PATH = join(DATA_DIR, "tokens.json");
export const MANIFEST_DIR = join(DATA_DIR, "manifest");
export const CERT_DIR = join(DATA_DIR, "certs");

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[destiny2-mcp] Missing required env var ${name}`);
  return value;
}

export function credentials() {
  return {
    apiKey: requireEnv("BUNGIE_API_KEY"),
    clientId: requireEnv("BUNGIE_CLIENT_ID"),
    clientSecret: requireEnv("BUNGIE_CLIENT_SECRET"),
  };
}
