const DOMAIN_QUERIES = [
  "ASIC verification",
  "RTL design",
  "physical design engineer",
  "VLSI engineer",
];

function cleanHtml(input = "") {
  return String(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function salaryText(min, max, currency = "") {
  if (!min && !max) return "";

  const fmt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return v >= 1000 ? Math.round(v).toLocaleString() : String(v);
  };

  if (min && max) return `${currency}${fmt(min)} - ${currency}${fmt(max)}`;
  return `${currency}${fmt(min || max)}`;
}

function normalizeAdzuna(job, country) {
  const text = `${job.title || ""} ${job.location?.display_name || ""} ${job.description || ""}`;

  return {
    id: `adzuna-${country}-${job.id}`,
    source: "Adzuna",
    title: job.title || "Untitled role",
    company: job.company?.display_name || "Unknown company",
    location: job.location?.display_name || country.toUpperCase(),
    country: country.toUpperCase(),
    description: cleanHtml(job.description || ""),
    salary: salaryText(
      job.salary_min,
      job.salary_max,
      country === "de" ? "€" : "$"
    ),
    url: job.redirect_url,
    created: job.created || "",
    category: job.category?.label || "",
    remote: /remote|work from home|home office|hybrid/i.test(text),
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

  if (!appId || !appKey) {
    return {
      jobs: [],
      warning: "Adzuna API keys are not configured.",
    };
  }

  const url = new URL(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`
  );

  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "10");
  url.searchParams.set("what", query);
  url.searchParams.set("content-type", "application/json");
  url.searchParams.set("sort_by", "date");

  if (location && location !== "remote") {
    url.searchParams.set("where", location);
  }

  const res = await fetch(url);

  if (res.status === 429) {
    return {
      jobs: [],
      warning: `Adzuna ${country.toUpperCase()} rate limit reached. Showing other available sources.`,
    };
  }

  if (res.status === 503) {
    return {
      jobs: [],
      warning: `Adzuna ${country.toUpperCase()} is temporarily unavailable. Showing other available sources.`,
    };
  }

  if (!res.ok) {
    return {
      jobs: [],
      warning: `Adzuna ${country.toUpperCase()} failed with status ${res.status}.`,
    };
  }

  const data = await res.json();

  return {
    jobs: (data.results || []).map((j) => normalizeAdzuna(j, country)),
  };
}

async function fetchRemotive(query) {
  const url = new URL("https://remotive.com/api/remote-jobs");
  url.searchParams.set("search", query);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "JobApplicationCommandCenter/1.0",
    },
  });

  if (!res.ok) {
    return {
      jobs: [],
      warning: `Remotive failed with status ${res.status}.`,
    };
  }

  const data = await res.json();

  return {
    jobs: (data.jobs || []).map(normalizeRemotive),
  };
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

function isDomainRelevant(job) {
  const text = `${job.title} ${job.description} ${job.category}`.toLowerCase();

  const include =
    text.includes("asic") ||
    text.includes("rtl") ||
    text.includes("vlsi") ||
    text.includes("physical design") ||
    text.includes("design verification") ||
    text.includes("verification engineer") ||
    text.includes("systemverilog") ||
    text.includes("uvm") ||
    text.includes("eda") ||
    text.includes("semiconductor") ||
    text.includes("digital ic") ||
    text.includes("soc") ||
    text.includes("fpga") ||
    text.includes("chip design") ||
    text.includes("silicon") ||
    text.includes("ic design");

  const exclude =
    text.includes("copywriter") ||
    text.includes("marketing") ||
    text.includes("sales") ||
    text.includes("seo") ||
    text.includes("content writer") ||
    text.includes("content marketing") ||
    text.includes("frontend") ||
    text.includes("backend") ||
    text.includes("full stack") ||
    text.includes("mern") ||
    text.includes("react developer") ||
    text.includes("customer support") ||
    text.includes("account executive") ||
    text.includes("business development");

  return include && !exclude;
}

function isRemoteFriendly(job) {
  return (
    job.remote ||
    /remote|home office|work from home|hybrid/i.test(
      `${job.title} ${job.location} ${job.description}`
    )
  );
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.filter(Boolean))];
}

export default async function handler(req, res) {
  try {
    const query = String(req.query.query || "domain-defaults").trim();
    const country = String(req.query.country || "all").toLowerCase();
    const location = String(req.query.location || "").trim();
    const remoteOnly = String(req.query.remote || "false") === "true";

    const queries = query === "domain-defaults" ? DOMAIN_QUERIES : [query];

    const tasks = [];

    for (const q of queries) {
      if (country === "all") {
        tasks.push(fetchAdzuna({ country: "us", query: q, location }));
        tasks.push(fetchAdzuna({ country: "de", query: q, location }));
        tasks.push(fetchRemotive(q));
      } else if (country === "us") {
        tasks.push(fetchAdzuna({ country: "us", query: q, location }));
        tasks.push(fetchRemotive(q));
      } else if (country === "de") {
        tasks.push(fetchAdzuna({ country: "de", query: q, location }));
        tasks.push(fetchRemotive(q));
      } else {
        tasks.push(fetchRemotive(q));
      }
    }

    const settled = await Promise.allSettled(tasks);

    let jobs = [];
    let warnings = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        jobs.push(...(item.value.jobs || []));
        if (item.value.warning) warnings.push(item.value.warning);
      } else {
        warnings.push(item.reason?.message || "A source failed.");
      }
    }

    jobs = dedupe(jobs)
      .filter((job) => !remoteOnly || isRemoteFriendly(job))
      .filter(isDomainRelevant)
      .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))
      .slice(0, 60);

    res.status(200).json({
      jobs,
      warnings: uniqueWarnings(warnings),
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Live job search failed.",
    });
  }
}