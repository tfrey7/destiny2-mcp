import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { credentials, DATA_DIR, TOKEN_URL, TOKENS_PATH } from "../setup/config.js";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  membershipId: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  membership_id: string;
}

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function readTokens(): Promise<StoredTokens | null> {
  try {
    return JSON.parse(await readFile(TOKENS_PATH, "utf8")) as StoredTokens;
  } catch {
    return null;
  }
}

async function writeTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

function toStored(response: TokenResponse): StoredTokens {
  const now = Date.now();

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    accessExpiresAt: now + response.expires_in * 1000,
    refreshExpiresAt: now + response.refresh_expires_in * 1000,
    membershipId: response.membership_id,
  };
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    throw new Error(
      `[destiny2-mcp] Token request failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as TokenResponse;
}

export async function exchangeCode(code: string): Promise<StoredTokens> {
  const tokens = toStored(await postToken({ grant_type: "authorization_code", code }));

  await writeTokens(tokens);
  return tokens;
}

export async function clearTokens(): Promise<boolean> {
  const tokens = await readTokens();

  await rm(TOKENS_PATH, { force: true });
  return tokens !== null;
}

export async function getAccessToken(): Promise<string> {
  const tokens = await readTokens();

  if (!tokens) {
    throw new Error("[destiny2-mcp] Not authenticated. Run the `login` tool to log in.");
  }

  if (tokens.accessExpiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return tokens.accessToken;
  }

  if (tokens.refreshExpiresAt <= Date.now()) {
    throw new Error("[destiny2-mcp] Session expired. Run the `login` tool to log in again.");
  }

  const refreshed = toStored(
    await postToken({ grant_type: "refresh_token", refresh_token: tokens.refreshToken }),
  );

  await writeTokens(refreshed);
  return refreshed.accessToken;
}
