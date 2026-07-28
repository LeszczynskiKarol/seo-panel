// Diagnostyka auth Google Ads — którą ścieżką się uwierzytelniamy i czy
// realnie mamy dostęp do konta. Uruchamiaj z backend/:
//   npx tsx scripts/ads-auth-check.ts
//
// Wymusić konkretną ścieżkę (do porównania SA vs stary refresh token):
//   npx tsx scripts/ads-auth-check.ts --refresh-token
//
// Skrypt niczego nie zmienia — same odczyty.
import "dotenv/config";
import { AdsRestClient, adsAuthMode } from "../src/services/googleAdsRest.js";

if (process.argv.includes("--refresh-token")) {
  // adsAuthMode() daje SA pierwszeństwo; czyszcząc ścieżkę klucza wymuszamy
  // fallback, żeby dało się porównać oba wyniki na tych samych danych.
  delete process.env.GOOGLE_ADS_SA_KEY_FILE;
  console.log("(wymuszono fallback na refresh token)");
}

const mask = (s: string) => (s.length <= 4 ? "***" : `***${s.slice(-4)}`);

async function main() {
  const mode = adsAuthMode();
  console.log("auth mode        :", mode ?? "BRAK");
  console.log("customer_id      :", process.env.GOOGLE_ADS_CUSTOMER_ID || "(brak)");
  console.log("mcc_id           :", process.env.GOOGLE_ADS_MCC_ID || "(brak)");
  console.log("developer_token  :", process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? mask(process.env.GOOGLE_ADS_DEVELOPER_TOKEN) : "(brak)");
  console.log("sa key file      :", process.env.GOOGLE_ADS_SA_KEY_FILE || "(brak)");

  if (!mode) {
    console.error("\nBrak skonfigurowanej ścieżki auth — nie ma czego testować.");
    process.exit(1);
  }

  const client = new AdsRestClient();

  console.log("\n[1/2] listAccessibleCustomers …");
  try {
    const accessible = await client.listAccessibleCustomers();
    console.log("  OK:", JSON.stringify(accessible));
    if (Array.isArray(accessible) && accessible.length === 0) {
      console.log("  UWAGA: pusta lista — SA nie został jeszcze dodany jako użytkownik w Google Ads.");
    }
  } catch (e: any) {
    console.error("  BŁĄD:", e.message);
  }

  // --customer=<id> pozwala odpytać inne konto pod tym samym MCC — przydatne,
  // gdy konto domyślne nie ma świeżych danych, a chcemy sprawdzić normalizację
  // na realnych wierszach.
  const override = process.argv.find((a) => a.startsWith("--customer="))?.split("=")[1];
  const customerId = override || process.env.GOOGLE_ADS_CUSTOMER_ID || "";

  const customer = client.Customer({
    customer_id: customerId,
    login_customer_id: process.env.GOOGLE_ADS_MCC_ID || "",
  });

  const dumpRow = (r: any) => {
    console.log("  próbka (po normalizacji do snake_case):");
    console.log("   ", JSON.stringify(r));
    // Kontrola typów: metryki muszą być liczbami, a segments.date stringiem —
    // inaczej Prisma poleci przy zapisie (pola Int / DateTime).
    const m = r.metrics || {};
    console.log(
      "  typy: cost_micros =", typeof m.cost_micros,
      "| clicks =", typeof m.clicks,
      "| impressions =", typeof m.impressions,
      "| segments.date =", typeof r.segments?.date,
    );
  };

  console.log(`\n[2/2] GAQL na koncie ${customerId}: kampanie z ostatnich 7 dni …`);
  try {
    const rows = await customer.query(`
      SELECT campaign.id, campaign.name, campaign.status,
             metrics.cost_micros, metrics.clicks, metrics.impressions, segments.date
      FROM campaign
      WHERE segments.date DURING LAST_7_DAYS
      ORDER BY segments.date DESC
    `);
    console.log(`  OK: ${rows.length} wierszy`);
    if (rows.length) {
      dumpRow(rows[0]);
    } else {
      // Zero wierszy może znaczyć "brak ruchu w oknie" ALBO "konto bez kampanii".
      // Dopytujemy bez filtra daty, żeby to rozróżnić.
      console.log("  zero wierszy — sprawdzam, czy konto ma jakiekolwiek kampanie …");
      const all = await customer.query(
        `SELECT campaign.id, campaign.name, campaign.status FROM campaign`,
      );
      console.log(`  kampanie w ogóle: ${all.length}`);
      if (all.length) console.log("   ", JSON.stringify(all.slice(0, 3)));
    }
  } catch (e: any) {
    console.error("  BŁĄD:", e.message);
  }

  // Bez segments.date Google agreguje po kampanii zamiast segmentować po dniach,
  // więc wiersze wracają nawet gdy w oknie nie było ruchu. To jedyny pewny
  // sposób, żeby zobaczyć obiekt `metrics` i sprawdzić, czy int64 (przychodzące
  // z API jako stringi) zostały rzutowane na liczby.
  console.log("\n[3/3] kontrola normalizacji metryk (agregat, szerokie okno) …");
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await customer.query(`
      SELECT campaign.id, campaign.name,
             metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '2025-01-01' AND '${today}'
      ORDER BY metrics.impressions DESC
    `);
    console.log(`  OK: ${rows.length} wierszy`);
    const withData = rows.find((r: any) => (r.metrics?.impressions || 0) > 0) || rows[0];
    if (withData) {
      dumpRow(withData);
      const m = withData.metrics || {};
      const bad = ["cost_micros", "clicks", "impressions", "conversions"].filter(
        (k) => m[k] !== undefined && typeof m[k] !== "number",
      );
      console.log(
        bad.length
          ? `  ⚠ NIE-LICZBOWE metryki: ${bad.join(", ")} — Prisma to odrzuci`
          : "  ✓ wszystkie metryki są liczbami",
      );
    }
  } catch (e: any) {
    console.error("  BŁĄD:", e.message);
  }
}

main().catch((e) => {
  console.error("padlo:", e);
  process.exit(1);
});
