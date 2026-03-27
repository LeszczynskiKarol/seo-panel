import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOMAINS = [
  // === SAAS ===
  {
    domain: "www.maturapolski.pl",
    siteUrl: "https://www.maturapolski.pl",
    gscProperty: "sc-domain:maturapolski.pl",
    sitemapPath: "/sitemap_index.xml",
    label: "MaturaPolski",
    category: "SAAS",
  },
  {
    domain: "www.smart-edu.ai",
    siteUrl: "https://www.smart-edu.ai",
    gscProperty: "sc-domain:smart-edu.ai",
    sitemapPath: "/sitemap_index.xml",
    label: "Smart-Edu.ai",
    category: "SAAS",
  },
  {
    domain: "www.smart-copy.ai",
    siteUrl: "https://www.smart-copy.ai",
    gscProperty: "sc-domain:smart-copy.ai",
    sitemapPath: "/sitemap.xml",
    label: "Smart-Copy.ai",
    category: "SAAS",
  },
  {
    domain: "www.interpunkcja.com.pl",
    siteUrl: "https://www.interpunkcja.com.pl",
    gscProperty: "sc-domain:interpunkcja.com.pl",
    sitemapPath: "/sitemap_index.xml",
    label: "Interpunkcja",
    category: "SAAS",
  },

  // === ECOMMERCE ===
  {
    domain: "www.silniki-elektryczne.com.pl",
    siteUrl: "https://www.silniki-elektryczne.com.pl",
    gscProperty: "sc-domain:silniki-elektryczne.com.pl",
    sitemapPath: "/sitemap_index.xml",
    label: "Stojan Shop",
    category: "ECOMMERCE",
  },

  // === CONTENT SITES ===
  {
    domain: "www.ebookcopywriting.pl",
    siteUrl: "https://www.ebookcopywriting.pl",
    gscProperty: "sc-domain:ebookcopywriting.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Ebook Copywriting",
    category: "CONTENT_SITE",
  },
  {
    domain: "www.copywritingseo.pl",
    siteUrl: "https://www.copywritingseo.pl",
    gscProperty: "sc-domain:copywritingseo.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Copywriting SEO",
    category: "CONTENT_SITE",
  },

  // === SATELLITE SITES ===
  {
    domain: "www.licencjackie.pl",
    siteUrl: "https://www.licencjackie.pl",
    gscProperty: "sc-domain:licencjackie.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Licencjackie",
    category: "SATELLITE",
  },
  {
    domain: "www.praca-magisterska.pl",
    siteUrl: "https://www.praca-magisterska.pl",
    gscProperty: "sc-domain:praca-magisterska.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Praca Magisterska",
    category: "SATELLITE",
  },
  {
    domain: "www.prace-magisterskie.pl",
    siteUrl: "https://www.prace-magisterskie.pl",
    gscProperty: "sc-domain:prace-magisterskie.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Prace Magisterskie",
    category: "SATELLITE",
  },
  {
    domain: "www.magisterkaonline.com.pl",
    siteUrl: "https://www.magisterkaonline.com.pl",
    gscProperty: "sc-domain:magisterkaonline.com.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Magisterka Online",
    category: "SATELLITE",
  },
  {
    domain: "www.ecopywriting.pl",
    siteUrl: "https://www.ecopywriting.pl",
    gscProperty: "sc-domain:ecopywriting.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "eCopywriting",
    category: "SATELLITE",
  },
  {
    domain: "www.icopywriter.pl",
    siteUrl: "https://www.icopywriter.pl",
    gscProperty: "sc-domain:icopywriter.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "iCopywriter",
    category: "SATELLITE",
  },
  {
    domain: "www.agencja-copywriterska.pl",
    siteUrl: "https://www.agencja-copywriterska.pl",
    gscProperty: "sc-domain:agencja-copywriterska.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Agencja Copywriterska",
    category: "SATELLITE",
  },
  {
    domain: "www.sklad-tekstu.pl",
    siteUrl: "https://www.sklad-tekstu.pl",
    gscProperty: "sc-domain:sklad-tekstu.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Skład Tekstu",
    category: "SATELLITE",
  },
  {
    domain: "www.1copywriting.pl",
    siteUrl: "https://www.1copywriting.pl",
    gscProperty: "sc-domain:1copywriting.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "1Copywriting",
    category: "SATELLITE",
  },
  {
    domain: "www.copywriting-blog.pl",
    siteUrl: "https://www.copywriting-blog.pl",
    gscProperty: "sc-domain:copywriting-blog.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Copywriting Blog",
    category: "SATELLITE",
  },
  {
    domain: "www.silnik-elektryczny.pl",
    siteUrl: "https://www.silnik-elektryczny.pl",
    gscProperty: "sc-domain:silnik-elektryczny.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Silnik Elektryczny (SEO)",
    category: "SATELLITE",
  },
  {
    domain: "www.silniki-trojfazowe.pl",
    siteUrl: "https://www.silniki-trojfazowe.pl",
    gscProperty: "sc-domain:silniki-trojfazowe.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Silniki Trójfazowe (SEO)",
    category: "SATELLITE",
  },
  {
    domain: "www.zostancopywriterem.pl",
    siteUrl: "https://www.zostancopywriterem.pl",
    gscProperty: "sc-domain:zostancopywriterem.pl",
    sitemapPath: "/sitemap-index.xml",
    label: "Zostań Copywriterem",
    category: "SATELLITE",
  },
] as const;

async function seed() {
  console.log("🌱 Seeding domains...\n");

  for (const d of DOMAINS) {
    const existing = await prisma.domain.findUnique({
      where: { domain: d.domain },
    });

    if (existing) {
      console.log(`  ⏭️  ${d.domain} (already exists)`);
      continue;
    }

    await prisma.domain.create({ data: { ...d } as any });
    console.log(`  ✅ ${d.domain} → ${d.label}`);
  }

  console.log(`\n✅ Seeded ${DOMAINS.length} domains`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
