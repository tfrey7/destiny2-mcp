import { BUNGIE_BASE, requireEnv } from "../config.js";
import { getAccessToken } from "./auth.js";

interface BungieEnvelope<T> {
  Response: T;
  ErrorCode: number;
  ErrorStatus: string;
  Message: string;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  auth?: boolean;
}

export async function bungieFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = { "X-API-Key": requireEnv("BUNGIE_API_KEY") };
  if (auth) headers.Authorization = `Bearer ${await getAccessToken()}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BUNGIE_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const envelope = (await response.json()) as BungieEnvelope<T>;
  if (envelope.ErrorCode !== 1) {
    throw new Error(`[destiny2-mcp] Bungie error ${envelope.ErrorStatus}: ${envelope.Message}`);
  }
  return envelope.Response;
}
