import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import selfsigned from "selfsigned";
import { CERT_DIR } from "./config.js";

export interface Cert {
  key: string;
  cert: string;
  /** True when the cert chains to a trust store the browser honors (mkcert), so no warning is shown. */
  trusted: boolean;
}

export function resolveCert(): Cert {
  return mkcertAvailable() ? mkcertCert() : selfsignedCert();
}

function mkcertAvailable(): boolean {
  try {
    execFileSync("mkcert", ["-CAROOT"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// mkcert issues a cert signed by a locally-installed CA, so the browser trusts it (no warning).
// The cert is cached in CERT_DIR and reused until the files are deleted.
function mkcertCert(): Cert {
  mkdirSync(CERT_DIR, { recursive: true });
  const keyPath = join(CERT_DIR, "127.0.0.1-key.pem");
  const certPath = join(CERT_DIR, "127.0.0.1.pem");

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    execFileSync(
      "mkcert",
      ["-key-file", keyPath, "-cert-file", certPath, "127.0.0.1", "localhost"],
      { stdio: "ignore" },
    );
  }

  return {
    key: readFileSync(keyPath, "utf8"),
    cert: readFileSync(certPath, "utf8"),
    trusted: true,
  };
}

// Fallback for hosts without mkcert: a throwaway cert no one trusts, so the browser warns.
function selfsignedCert(): Cert {
  const pems = selfsigned.generate([{ name: "commonName", value: "127.0.0.1" }], { days: 365 });

  return { key: pems.private, cert: pems.cert, trusted: false };
}
