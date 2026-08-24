// Jednorazowe wystawienie nowego refresh tokena dla Google Ads API.
// Flow loopback: lokalny serwer HTTP odbiera code z redirectu, wymienia na
// tokeny i wypisuje TYLKO refresh token do wklejenia w .env (nie loguje
// access tokena). Uruchamiaj z backend/: node scripts/ads-oauth-refresh.mjs
import http from "node:http";
import { spawn } from "node:child_process";
import { config } from "dotenv";
config();

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const PORT = 8123;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/adwords";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Brak GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET w .env");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // wymusza wydanie NOWEGO refresh tokena
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err || !code) {
    res.end("Blad autoryzacji: " + (err || "brak code") + " — zamknij karte.");
    console.error("OAUTH ERROR:", err || "no code");
    server.close(); process.exit(1);
  }
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const tok = await r.json();
    if (!tok.refresh_token) {
      console.error("Brak refresh_token w odpowiedzi:", JSON.stringify({ ...tok, access_token: tok.access_token ? "<hidden>" : undefined }));
      res.end("Nie dostalem refresh tokena — sprawdz konsole.");
    } else {
      console.log("NEW_REFRESH_TOKEN=" + tok.refresh_token);
      res.end("Gotowe! Token odebrany — mozesz zamknac te karte i wrocic do terminala.");
    }
  } catch (e) {
    console.error("Token exchange padl:", e.message);
    res.end("Blad wymiany code na token — sprawdz konsole.");
  }
  server.close();
});

server.listen(PORT, () => {
  console.log("Czekam na autoryzacje na " + REDIRECT);
  console.log("Otwieram przegladarke...");
  spawn("cmd", ["/c", "start", "", authUrl.replace(/&/g, "^&")], { shell: false, detached: true });
  console.log("Jesli przegladarka sie nie otworzyla, wejdz recznie:\n" + authUrl);
});
setTimeout(() => { console.error("Timeout 5 min — przerwane."); server.close(); process.exit(1); }, 300000);
