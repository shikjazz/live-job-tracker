# Live Job Board + Application Tracker

This app lets your friend search live jobs in her domain and track applications.

## What it does

- Shows live jobs for VLSI, ASIC, RTL, Verification, Physical Design, EDA.
- Searches USA, Germany, and remote jobs.
- Lets her click "Apply from app" which opens the official application page and adds the job to the tracker as In Progress.
- Lets her mark submitted after applying.
- Tracks statuses, follow-up dates, notes and templates.
- Uses browser localStorage for tracking unless you later add Supabase.

## Job sources

1. Adzuna API for USA and Germany jobs.
2. Remotive API for remote jobs.

You need Adzuna API keys:
- https://developer.adzuna.com/

Add these in Vercel Environment Variables:

ADZUNA_APP_ID
ADZUNA_APP_KEY

Remotive does not need a key, but Remotive jobs must link back to Remotive and show Remotive as source.

## Local setup

```bash
npm install
npm run dev
```

Open the localhost URL.

## Deploy on Vercel

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

Install command:

```bash
npm install
```

If Vercel has vite permission issues, temporarily use:

```bash
rm -rf node_modules package-lock.json && npm install
```

then redeploy without cache.

## Important reality

The app cannot submit every application inside the app because companies use Workday, Greenhouse, Lever, Ashby, custom forms, CAPTCHA and visa questions.

Correct flow:
Live listing → Apply from app → official application page opens → app tracks the job.
