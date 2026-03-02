type StatResult = {
  metric: "inflation" | "unemployment" | "gdp_growth";
  country: string;
  claimed_value: number;
  unit: "%" | "unknown";
  dataset: "World Bank";
  latest_value: number | null;
  latest_year: number | null;
  verdict: "match" | "mismatch" | "unknown";
  note: string;
};

const COUNTRY_TO_ISO3: Record<string, string> = {
  singapore: "SGP",
  // add more when needed
};

const METRIC_TO_WB: Record<string, string> = {
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  gdp_growth: "NY.GDP.MKTP.KD.ZG",
};

function extractPercentClaims(text: string) {
  // very simple pattern: "<country> ... <metric> ... <number>%"
  // Example: "Singapore has a 10% inflation this year"
  const lower = text.toLowerCase();
  const out: Array<{ country: string; metric: keyof typeof METRIC_TO_WB; value: number }> = [];

  const metrics: Array<{ key: keyof typeof METRIC_TO_WB; words: string[] }> = [
    { key: "inflation", words: ["inflation", "cpi"] },
    { key: "unemployment", words: ["unemployment"] },
    { key: "gdp_growth", words: ["gdp growth", "economic growth"] },
  ];

  // grab percent numbers
  const percMatches = [...lower.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  if (!percMatches.length) return out;

  // guess country by keyword
  const country = Object.keys(COUNTRY_TO_ISO3).find(c => lower.includes(c));
  if (!country) return out;

  // guess metric by keyword
  const metric = metrics.find(m => m.words.some(w => lower.includes(w)))?.key;
  if (!metric) return out;

  // take first % as "claimed"
  const value = Number(percMatches[0][1]);
  if (Number.isFinite(value)) out.push({ country, metric, value });

  return out;
}

async function fetchWorldBankLatest(iso3: string, indicator: string) {
  // World Bank API returns latest years first (usually)
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${indicator}?format=json`;

  const res = await fetch(url);
  if (!res.ok) return { value: null, year: null };

  const data = await res.json();
  const rows = Array.isArray(data?.[1]) ? data[1] : [];

  const firstWithValue = rows.find((r: any) => r?.value != null);
  return {
    value: firstWithValue?.value ?? null,
    year: firstWithValue?.date ? Number(firstWithValue.date) : null,
  };
}

export async function enrichWithStatisticalValidation(analysis: any, text: string) {
  const claims = extractPercentClaims(text);
  if (!claims.length) {
    analysis.stat_validation = { results: [], note: "No numeric % statistic claims detected." };
    return analysis;
  }

  const results: StatResult[] = [];

  for (const c of claims) {
    const iso3 = COUNTRY_TO_ISO3[c.country];
    const indicator = METRIC_TO_WB[c.metric];

    const latest = await fetchWorldBankLatest(iso3, indicator);

    // “match” logic: within 1.0 percentage point (tune later)
    let verdict: StatResult["verdict"] = "unknown";
    let note = "";

    if (latest.value == null || latest.year == null) {
      verdict = "unknown";
      note = "No dataset value available.";
    } else {
      const diff = Math.abs(latest.value - c.value);
      verdict = diff <= 1.0 ? "match" : "mismatch";
      note = `Compared to latest available annual value (${latest.year}).`;
    }

    results.push({
      metric: c.metric,
      country: c.country,
      claimed_value: c.value,
      unit: "%",
      dataset: "World Bank",
      latest_value: latest.value,
      latest_year: latest.year,
      verdict,
      note,
    });
  }

  analysis.stat_validation = {
    results,
    note: "Stat checks use World Bank annual indicators (may lag the current year).",
  };

  return analysis;
}