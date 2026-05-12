const DOMAIN_QUERIES = [
  "physical design engineer",
  "ASIC design engineer",
  "RTL design engineer",
  "design verification engineer",
  "VLSI engineer",
  "EDA applications engineer",
  "digital IC design engineer",
  "semiconductor verification engineer"
];

function cleanHtml(input = "") {
  return String(input).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function salaryText(min, max, currency = "") {
  if (!min && !max) return "";
  const fmt = (n) => {
    if (!n) return "";
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return v >= 1000 ? Math.round(v).toLocaleString() : String(v);
  };
  if (min && max) return `${currency}${fmt(min)} - ${currency}${fmt(max)}`;
  return `${currency}${fmt(min || max)}`;
}

function normalizeAdzuna(job, country) {
  return {
    id: `adzuna-${country}-${job.id}`,
    source: "Adzuna",
    title: job.title || "Untitled role",
    company: job.company?.display_name || "Unknown company",
    location: job.location?.display_name || country.toUpperCase(),
    country: country.toUpperCase(),
    description: cleanHtml(job.description || ""),
    salary: salaryText(job.salary_min, job.salary_max, country === "de" ? "€" : "$"),
    url: job.redirect_url,
    created: job.created || "",
    category: job.category?.label || "",
    remote: /remote|work from home|home office/i.test(`${job.title} ${job.location?.display_name} ${job.description}`),
  };
}

function normalizeRemotive(job) {
  return {
    id: `remotive-${job.id}`,
    source: "Remotive",
    title: job.title || "Untitled remote role",
    company: job.company_name || "Unknown company",
    location: job.candidate_required_location || "Remote",
    country: "REMOTE",
    description: cleanHtml(job.description || ""),
    salary: job.salary || "",
    url: job.url,
    created: job.publication_date || "",
    category: job.category || "",
    remote: true,
  };
}

async function fetchAdzuna({ country, query, location, page = 1 }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return { jobs: [], warning: "Adzuna API keys are not configured." };

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "20");
  url.searchParams.set("what", query);
  if (location && location !== "remote") url.searchParams.set("where", location);
  url.searchParams.set("content-type", "application/json");
  url.searchParams.set("sort_by", "date");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Adzuna ${country} failed: ${res.status}`);
  const data = await res.json();
  return { jobs: (data.results || []).map((j) => normalizeAdzuna(j, country)) };
}

async function fetchRemotive(query) {
  const url = new URL("https://remotive.com/api/remote-jobs");
  url.searchParams.set("search", query);
  const res = await fetch(url, { headers: { "User-Agent": "JobApplicationCommandCenter/1.0" } });
  if (!res.ok) return { jobs: [], warning: `Remotive failed: ${res.status}` };
  const data = await res.json();
  return { jobs: (data.jobs || []).map(normalizeRemotive) };
}

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.source}|${job.company}|${job.title}|${job.location}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function handler(req, res) {
  try {
    const query = String(req.query.query || "VLSI OR ASIC OR RTL OR verification OR physical design").trim();
    const country = String(req.query.country || "all").toLowerCase();
    const location = String(req.query.location || "").trim();
    const remoteOnly = String(req.query.remote || "false") === "true";

    const queries = query === "domain-defaults" ? DOMAIN_QUERIES : [query];
    const tasks = [];

    for (const q of queries) {
      if (country === "all" || country === "us") tasks.push(fetchAdzuna({ country: "us", query: q, location }));
      if (country === "all" || country === "de") tasks.push(fetchAdzuna({ country: "de", query: q, location }));
      tasks.push(fetchRemotive(q));
    }

    const settled = await Promise.allSettled(tasks);
    const warnings = [];
    let jobs = [];
    for (const item of settled) {
      if (item.status === "fulfilled") {
        jobs.push(...(item.value.jobs || []));
        if (item.value.warning) warnings.push(item.value.warning);
      } else {
        warnings.push(item.reason?.message || "A source failed.");
      }
    }

    jobs = dedupe(jobs)
      .filter((job) => !remoteOnly || job.remote || /remote|home office|work from home/i.test(`${job.title} ${job.location} ${job.description}`))
      .filter((job) => /asic|rtl|vlsi|verification|physical design|eda|semiconductor|ic design|digital design|uvm|fpga/i.test(`${job.title} ${job.description} ${job.category}`))
      .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))
      .slice(0, 80);

    res.status(200).json({ jobs, warnings });
  } catch (error) {
    res.status(500).json({ error: error.message || "Live job search failed." });
  }
}