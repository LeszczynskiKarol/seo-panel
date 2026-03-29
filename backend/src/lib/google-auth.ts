// backend/src/lib/google-auth.ts

import { google } from "googleapis";
import fs from "fs";
import path from "path";

let cachedAuth: any = null;

export async function getGoogleAuth() {
  if (cachedAuth) return cachedAuth;

  let credentials: any;

  // Try JSON file first
  const keyPath = process.env.GOOGLE_PRIVATE_KEY_PATH;
  if (keyPath && fs.existsSync(keyPath)) {
    credentials = JSON.parse(fs.readFileSync(path.resolve(keyPath), "utf-8"));
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    throw new Error(
      "No Google credentials found. Set GOOGLE_PRIVATE_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON",
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      // Search Console
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/webmasters",
      // Indexing API
      "https://www.googleapis.com/auth/indexing",
      // Google Analytics 4 Data API
      "https://www.googleapis.com/auth/analytics.readonly",
      // Merchant Center Content API
      "https://www.googleapis.com/auth/content",
    ],
  });

  cachedAuth = auth;
  return auth;
}

export async function getSearchConsole() {
  const auth = await getGoogleAuth();
  return google.searchconsole({ version: "v1", auth });
}

export async function getAccessToken(): Promise<string> {
  const auth = await getGoogleAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}
