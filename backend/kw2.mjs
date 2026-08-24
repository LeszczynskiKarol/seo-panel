import fs from 'fs';
import { JWT } from 'google-auth-library';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i), l.slice(i+1).trim()]}));
const key = JSON.parse(fs.readFileSync(env.GOOGLE_ADS_SA_KEY_FILE,'utf8'));
const jwt = new JWT({email:key.client_email, key:key.private_key, keyId:key.private_key_id, scopes:['https://www.googleapis.com/auth/adwords']});
const {token} = await jwt.getAccessToken();
const cid = (env.GOOGLE_ADS_CUSTOMER_ID||'').replace(/\D/g,'');
const mcc = (env.GOOGLE_ADS_MCC_ID||'').replace(/\D/g,'');
const seeds = ["arkusze maturalne","arkusze maturalne 2025","arkusz maturalny cke","arkusze cke","arkusze maturalne biologia","arkusze maturalne chemia","arkusze maturalne fizyka","arkusze maturalne historia","arkusze maturalne geografia","arkusze maturalne informatyka","arkusze maturalne wos","arkusze maturalne niemiecki","matura probna arkusze","stara matura arkusze"];
const body = {
  language: "languageConstants/1030",           // Polish
  geoTargetConstants: ["geoTargetConstants/2616"], // Poland
  keywordPlanNetwork: "GOOGLE_SEARCH",
  keywordSeed: { keywords: seeds },
  includeAdultKeywords: false
};
const r = await fetch(`https://googleads.googleapis.com/v23/customers/${cid}:generateKeywordIdeas`,{
  method:'POST',
  headers:{'Authorization':`Bearer ${token}`,'developer-token':env.GOOGLE_ADS_DEVELOPER_TOKEN,'login-customer-id':mcc,'Content-Type':'application/json'},
  body: JSON.stringify(body)
});
const txt = await r.text();
if(!r.ok){ console.error(r.status, txt.slice(0,1500)); process.exit(1); }
const j = JSON.parse(txt);
const rows = (j.results||[]).map(x=>({
  kw:x.text,
  vol: Number(x.keywordIdeaMetrics?.avgMonthlySearches||0),
  comp: x.keywordIdeaMetrics?.competition,
  compIdx: x.keywordIdeaMetrics?.competitionIndex,
  low: x.keywordIdeaMetrics?.lowTopOfPageBidMicros ? (Number(x.keywordIdeaMetrics.lowTopOfPageBidMicros)/1e6).toFixed(2):'',
  high: x.keywordIdeaMetrics?.highTopOfPageBidMicros ? (Number(x.keywordIdeaMetrics.highTopOfPageBidMicros)/1e6).toFixed(2):'',
  months: (x.keywordIdeaMetrics?.monthlySearchVolumes||[]).slice(-12).map(m=>`${m.month.slice(0,3)}:${m.monthlySearches}`).join(' ')
})).sort((a,b)=>b.vol-a.vol);
fs.writeFileSync('D:/tmp/kwark.json', JSON.stringify(rows,null,1));
console.log('total ideas:', rows.length);
for(const x of rows.slice(0,60)) console.log(`${x.vol}\t${x.compIdx??''}\t${x.low}-${x.high}\t${x.kw}`);
