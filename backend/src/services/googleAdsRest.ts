// backend/src/services/googleAdsRest.ts
//
// Cienki klient REST dla Google Ads API — zastępuje bibliotekę `google-ads-api`.
//
// Powód (2026-07-28): wrapper `google-ads-api` przyjmuje w konfiguracji
// wyłącznie `refresh_token`, a od 2026-08-05 Google wymaga passkeya przy
// wystawianiu NOWEGO refresh tokena. Service account jest z tego wymogu
// wyłączony, ale wrapper go nie obsługuje. REST + google-auth-library
// obsługuje obie ścieżki, a przy okazji zdejmuje zależność grpc.
//
// Kształt wierszy jest celowo normalizowany do snake_case — dokładnie tak,
// jak zwracał wrapper — żeby ciało ads.service.ts (row.metrics.cost_micros
// itd.) pozostało nietknięte. REST zwraca camelCase.

import fs from "node:fs";
import { JWT } from "google-auth-library";

const API = "https://googleads.googleapis.com/v23";
const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

const CFG = () => ({
  saKeyFile: process.env.GOOGLE_ADS_SA_KEY_FILE || "",
  clientId: process.env.GOOGLE_ADS_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
  devToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
  refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
});

export type AdsAuthMode = "sa" | "refresh_token" | null;

/** Która ścieżka auth jest aktywna. SA ma pierwszeństwo. */
export function adsAuthMode(): AdsAuthMode {
  const c = CFG();
  if (c.saKeyFile) return "sa";
  // Sentinele wstawiane przy zakładaniu integracji, zanim realny token
  // zostanie wklejony — traktujemy jak brak. W kodzie krążyły historycznie
  // dwa warianty ("PENDING" w verify, "PENDING_APPROVAL" w create), więc
  // odcinamy oba w jednym miejscu.
  const PENDING = new Set(["PENDING", "PENDING_APPROVAL"]);
  if (c.clientId && c.clientSecret && c.refreshToken && !PENDING.has(c.refreshToken)) {
    return "refresh_token";
  }
  return null;
}

// ─── Access token (wspólny cache dla obu ścieżek) ─────────────────────────

let tokenCache: { token: string | null; exp: number } = { token: null, exp: 0 };
let jwtClient: JWT | null = null;

async function saAccessToken(): Promise<{ token: string; exp: number }> {
  const c = CFG();
  if (!jwtClient) {
    // Klucz czytamy sami i podajemy email+key JAWNIE. Wariant `new JWT({
    // keyFile })` zwracał "invalid_grant: account not found" (sprawdzone
    // 2026-07-28) — biblioteka schodzi wtedy na Application Default
    // Credentials zamiast użyć wskazanego pliku. Jawne poświadczenia są przy
    // okazji bezpieczniejsze: nie ma ryzyka, że w tle podłączy się cudze ADC.
    let key: { client_email?: string; private_key?: string; private_key_id?: string };
    try {
      key = JSON.parse(fs.readFileSync(c.saKeyFile, "utf8"));
    } catch (e: any) {
      throw new Error(`Google Ads SA: nie mogę odczytać klucza ${c.saKeyFile}: ${e.message}`);
    }
    if (!key.client_email || !key.private_key) {
      throw new Error(`Google Ads SA: klucz ${c.saKeyFile} nie zawiera client_email/private_key`);
    }
    jwtClient = new JWT({
      email: key.client_email,
      key: key.private_key,
      keyId: key.private_key_id,
      scopes: [ADS_SCOPE],
    });
  }
  const { token } = await jwtClient.getAccessToken();
  if (!token) throw new Error(`Google Ads SA: brak access_token z klucza ${c.saKeyFile}`);
  const exp = jwtClient.credentials?.expiry_date || Date.now() + 3600 * 1000;
  return { token, exp };
}

async function refreshTokenAccessToken(): Promise<{ token: string; exp: number }> {
  const c = CFG();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j: any = await r.json();
  if (!j.access_token) {
    throw new Error(`Google OAuth: brak access_token (${j.error || r.status})`);
  }
  return { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
}

async function accessToken(): Promise<string> {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const mode = adsAuthMode();
  if (!mode) throw new Error("Google Ads: brak skonfigurowanej ścieżki auth (ani SA, ani refresh token)");
  const { token, exp } = mode === "sa" ? await saAccessToken() : await refreshTokenAccessToken();
  tokenCache = { token, exp: exp - 60_000 };
  return token;
}

// ─── Normalizacja odpowiedzi: camelCase → snake_case ──────────────────────

const snakeCache = new Map<string, string>();
function toSnake(key: string): string {
  let v = snakeCache.get(key);
  if (v === undefined) {
    v = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
    snakeCache.set(key, v);
  }
  return v;
}

// Google zwraca int64 jako stringi ("costMicros": "1234567"). ads.service.ts
// sumuje metryki i zapisuje je Prismą jako liczby, więc rzutujemy — ale TYLKO
// wewnątrz obiektu `metrics`. Poza nim stringi muszą zostać stringami:
// segments.date to "2026-07-28", a id-ki są dalej opakowywane w String().
function normalize(value: any, inMetrics = false): any {
  if (Array.isArray(value)) return value.map((v) => normalize(v, inMetrics));
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const key = toSnake(k);
      out[key] = normalize(v, inMetrics || key === "metrics");
    }
    return out;
  }
  if (inMetrics && typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

// ─── Klient ───────────────────────────────────────────────────────────────

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

export interface CustomerOptions {
  customer_id: string;
  login_customer_id?: string;
}

async function adsFetch(path: string, body: unknown, loginCustomerId?: string): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "developer-token": CFG().devToken,
    "Content-Type": "application/json",
  };
  const login = onlyDigits(loginCustomerId || "");
  if (login) headers["login-customer-id"] = login;

  const r = await fetch(`${API}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail =
      j?.error?.details?.[0]?.errors?.map((e: any) => e.message).join("; ") ||
      j?.error?.message ||
      r.status;
    const err: any = new Error(`Google Ads API: ${detail}`);
    // ads.service.ts loguje e.errors — zachowujemy ten kształt.
    err.errors = j?.error;
    throw err;
  }
  return j;
}

export class AdsRestClient {
  /** Odpowiednik client.Customer() z google-ads-api. */
  Customer(opts: CustomerOptions) {
    const customerId = onlyDigits(opts.customer_id);
    return {
      query: async (gaql: string): Promise<any[]> => {
        const j = await adsFetch(
          `customers/${customerId}/googleAds:searchStream`,
          { query: gaql },
          opts.login_customer_id,
        );
        const batches = Array.isArray(j) ? j : [j];
        return batches.flatMap((b: any) => b.results || []).map((row: any) => normalize(row));
      },
    };
  }

  async listAccessibleCustomers(): Promise<any> {
    const j = await adsFetch("customers:listAccessibleCustomers", undefined);
    return j?.resourceNames || [];
  }
}
