import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Briefcase, Search, ExternalLink, Plus, CheckCircle2, Clock, Mail, Copy, Trash2, RefreshCw, Globe, Filter, Send, Star } from "lucide-react";
import "./style.css";

const STORAGE_KEY = "live-job-application-tracker-v2";

const CANDIDATE = {
  name: "Chinmayee Ganthakoru",
  email: "chinmayee.4673@gmail.com",
  phone: "+1-623-759-9750",
  headline: "MSEE candidate, VLSI / ASIC / RTL / Physical Design / Verification",
  visa: "F-1 student visa. OPT/STEM OPT eligible where applicable.",
  skills: "RTL-to-GDSII, Physical Design, ASIC Design, Verilog, SystemVerilog, UVM, Python, Tcl, Synopsys, Cadence, STA, DRC/LVS",
};

const emptyJob = {
  company: "",
  title: "",
  location: "",
  url: "",
  focus: "Physical Design",
  priority: "High",
  status: "Interested",
  notes: "",
};

const statuses = ["Interested", "In Progress", "Applied", "Interview", "Offer", "Rejected", "Saved"];
const focusOptions = ["Physical Design", "RTL Design", "Verification", "EDA", "ASIC", "VLSI", "Other"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix = "job") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadTrackedJobs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTrackedJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function guessFocus(job) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  if (text.includes("verification") || text.includes("uvm")) return "Verification";
  if (text.includes("physical") || text.includes("place") || text.includes("routing") || text.includes("sta")) return "Physical Design";
  if (text.includes("rtl")) return "RTL Design";
  if (text.includes("eda") || text.includes("cadence") || text.includes("synopsys")) return "EDA";
  if (text.includes("asic")) return "ASIC";
  return "VLSI";
}

function makeTrackedFromLive(job, status = "Interested") {
  return {
    id: uid("tracked"),
    live_id: job.id,
    source: job.source,
    company: job.company,
    title: job.title,
    location: job.location,
    url: job.url,
    focus: guessFocus(job),
    priority: "High",
    status,
    notes: job.description?.slice(0, 500) || "",
    salary: job.salary || "",
    created_at: new Date().toISOString(),
    applied_date: status === "Applied" ? today() : "",
    followup_date: status === "Applied" ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) : "",
    referral_name: "",
    referral_contact: "",
    interview_date: "",
    interview_notes: "",
  };
}

function coverLetter(job) {
  return `Dear Hiring Manager,

I am excited to apply for the ${job.title} role at ${job.company}. I am an MSEE candidate with hands-on experience in ${job.focus}, RTL-to-GDSII implementation, physical design, verification, and semiconductor design workflows.

My background includes practical work with Verilog, SystemVerilog, UVM, Python, Tcl, Synopsys tools, Cadence tools, STA, DRC/LVS, and silicon implementation flows. I am especially interested in this role because it aligns with my VLSI/ASIC background and my goal of contributing to high-impact semiconductor engineering teams.

I am currently on F-1 status and am eligible for OPT/STEM OPT where applicable.

Thank you for your time and consideration.

Best regards,
${CANDIDATE.name}
${CANDIDATE.email}
${CANDIDATE.phone}`;
}

function followUp(job) {
  return `Subject: Following Up — ${job.title} Application

Dear Hiring Team,

I hope you are doing well. I am following up on my application for the ${job.title} role at ${job.company}, submitted on ${job.applied_date || "recently"}.

I remain very interested in this opportunity. My background in VLSI/ASIC design, RTL-to-GDSII flows, physical design, verification, and EDA tools aligns strongly with this position.

Thank you for your time and consideration.

Best regards,
${CANDIDATE.name}`;
}

function linkedIn(job) {
  return `Hi, I’m ${CANDIDATE.name}, an MSEE candidate focused on VLSI, ASIC design, physical design, RTL, and verification. I found the ${job.title} role at ${job.company} and would love to learn more about the team. Thank you!`;
}

function App() {
  const [tab, setTab] = useState("live");
  const [tracked, setTracked] = useState([]);
  const [liveJobs, setLiveJobs] = useState([]);
  const [query, setQuery] = useState("domain-defaults");
  const [country, setCountry] = useState("all");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [filter, setFilter] = useState({ search: "", status: "All", focus: "All" });
  const [manual, setManual] = useState(emptyJob);
  const [templateJob, setTemplateJob] = useState(null);
  const [templateKind, setTemplateKind] = useState("cover");
  const [copied, setCopied] = useState(false);

  useEffect(() => setTracked(loadTrackedJobs()), []);
  useEffect(() => saveTrackedJobs(tracked), [tracked]);

  async function searchLiveJobs() {
    setLoading(true);
    setLiveError("");
    setWarnings([]);
    try {
      const params = new URLSearchParams({
        query,
        country,
        location,
        remote: String(remoteOnly),
      });
      const res = await fetch(`/api/live-jobs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Live search failed");
      setLiveJobs(data.jobs || []);
      setWarnings(data.warnings || []);
    } catch (e) {
      setLiveError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    searchLiveJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trackJob(job, status = "Interested") {
    const exists = tracked.some((j) => j.live_id === job.id || (j.company === job.company && j.title === job.title));
    if (exists) return;
    setTracked((items) => [makeTrackedFromLive(job, status), ...items]);
  }

  function applyFromApp(job) {
    trackJob(job, "In Progress");
    window.open(job.url, "_blank", "noopener,noreferrer");
  }

  function markSubmitted(job) {
    setTracked((items) =>
      items.map((j) =>
        j.id === job.id
          ? { ...j, status: "Applied", applied_date: today(), followup_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }
          : j
      )
    );
  }

  function addManualJob() {
    if (!manual.company || !manual.title) return;
    setTracked((items) => [{ ...manual, id: uid("manual"), created_at: new Date().toISOString(), applied_date: "", followup_date: "" }, ...items]);
    setManual(emptyJob);
  }

  function updateTracked(id, patch) {
    setTracked((items) => items.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function removeTracked(id) {
    setTracked((items) => items.filter((j) => j.id !== id));
  }

  const stats = useMemo(() => {
    const out = Object.fromEntries(statuses.map((s) => [s, 0]));
    tracked.forEach((j) => (out[j.status] = (out[j.status] || 0) + 1));
    return out;
  }, [tracked]);

  const filteredTracked = useMemo(() => {
    const s = filter.search.toLowerCase();
    return tracked
      .filter((j) => filter.status === "All" || j.status === filter.status)
      .filter((j) => filter.focus === "All" || j.focus === filter.focus)
      .filter((j) => !s || `${j.company} ${j.title} ${j.location} ${j.notes}`.toLowerCase().includes(s));
  }, [tracked, filter]);

  const templateText = templateJob
    ? templateKind === "follow"
      ? followUp(templateJob)
      : templateKind === "linkedin"
      ? linkedIn(templateJob)
      : coverLetter(templateJob)
    : "";

  async function copyText() {
    await navigator.clipboard.writeText(templateText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1><Briefcase size={28}/> Live Job Board + Application Tracker</h1>
          <p>For VLSI, ASIC, RTL, Verification, Physical Design and EDA jobs in the USA, Germany, and remote markets.</p>
        </div>
        <nav>
          <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}><Globe size={16}/> Live Jobs</button>
          <button className={tab === "tracker" ? "active" : ""} onClick={() => setTab("tracker")}><CheckCircle2 size={16}/> Tracker</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><Mail size={16}/> Templates</button>
        </nav>
      </header>

      <main className="container">
        <section className="stats">
          {statuses.map((s) => <div className="stat" key={s}><b>{stats[s] || 0}</b><span>{s}</span></div>)}
        </section>

        {tab === "live" && (
          <>
            <section className="panel">
              <h2><Search size={22}/> Search latest jobs</h2>
              <div className="grid">
                <select value={query} onChange={(e) => setQuery(e.target.value)}>
                  <option value="domain-defaults">All domain roles</option>
                  <option value="physical design engineer">Physical Design Engineer</option>
                  <option value="ASIC design engineer">ASIC Design Engineer</option>
                  <option value="RTL design engineer">RTL Design Engineer</option>
                  <option value="design verification engineer UVM">Design Verification Engineer / UVM</option>
                  <option value="VLSI engineer">VLSI Engineer</option>
                  <option value="EDA applications engineer">EDA Applications Engineer</option>
                  <option value="semiconductor engineer">Semiconductor Engineer</option>
                </select>
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="all">USA + Germany + Remote</option>
                  <option value="us">USA</option>
                  <option value="de">Germany</option>
                </select>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional city/state e.g. Austin, Munich, California" />
                <label className="check"><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote-friendly only</label>
              </div>
              <button className="primary" onClick={searchLiveJobs} disabled={loading}>{loading ? <RefreshCw className="spin" size={18}/> : <Search size={18}/>} Search Live Listings</button>
              {liveError && <p className="error">{liveError}</p>}
              {warnings.length > 0 && <p className="warning">{warnings.join(" ")}</p>}
              <p className="hint">Adzuna needs API keys in Vercel. Remotive remote listings work without keys but are attributed as source.</p>
            </section>

            <section className="list">
              {liveJobs.map((job) => (
                <article className="card" key={job.id}>
                  <div>
                    <div className="badges"><span>{job.source}</span>{job.remote && <span>Remote</span>}{job.salary && <span>{job.salary}</span>}</div>
                    <h3>{job.title}</h3>
                    <p className="company">{job.company} · {job.location}</p>
                    <p>{job.description?.slice(0, 280)}{job.description?.length > 280 ? "..." : ""}</p>
                  </div>
                  <div className="actions">
                    <button onClick={() => trackJob(job, "Saved")}><Star size={16}/> Track</button>
                    <button onClick={() => applyFromApp(job)} className="primary"><Send size={16}/> Apply from app</button>
                    <a href={job.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/> View</a>
                  </div>
                </article>
              ))}
              {!loading && liveJobs.length === 0 && <div className="empty">No live jobs loaded yet. Click “Search Live Listings”.</div>}
            </section>
          </>
        )}

        {tab === "tracker" && (
          <>
            <section className="panel">
              <h2><Plus size={22}/> Add job manually</h2>
              <div className="grid">
                <input value={manual.company} onChange={(e) => setManual({ ...manual, company: e.target.value })} placeholder="Company" />
                <input value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Job title" />
                <input value={manual.location} onChange={(e) => setManual({ ...manual, location: e.target.value })} placeholder="Location" />
                <input value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} placeholder="Application URL" />
                <select value={manual.focus} onChange={(e) => setManual({ ...manual, focus: e.target.value })}>{focusOptions.map((x) => <option key={x}>{x}</option>)}</select>
                <select value={manual.priority} onChange={(e) => setManual({ ...manual, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select>
              </div>
              <textarea value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} placeholder="Notes / referral / job description" />
              <button className="primary" onClick={addManualJob}><Plus size={18}/> Add to tracker</button>
            </section>

            <section className="panel filters">
              <Filter size={20}/>
              <input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} placeholder="Search tracked jobs" />
              <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option>All</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
              <select value={filter.focus} onChange={(e) => setFilter({ ...filter, focus: e.target.value })}><option>All</option>{focusOptions.map((s) => <option key={s}>{s}</option>)}</select>
            </section>

            <section className="list">
              {filteredTracked.map((job) => (
                <article className="card" key={job.id}>
                  <div>
                    <div className="badges"><span>{job.status}</span><span>{job.focus}</span>{job.source && <span>{job.source}</span>}</div>
                    <h3>{job.title}</h3>
                    <p className="company">{job.company} · {job.location}</p>
                    {job.applied_date && <p className="date"><Clock size={14}/> Applied {job.applied_date}. Follow-up: {job.followup_date || "not set"}</p>}
                    <p>{job.notes?.slice(0, 240)}</p>
                  </div>
                  <div className="actions">
                    {job.url && <button className="primary" onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}><Send size={16}/> Continue apply</button>}
                    {job.status !== "Applied" && <button onClick={() => markSubmitted(job)}><CheckCircle2 size={16}/> Mark submitted</button>}
                    <button onClick={() => { setTemplateJob(job); setTab("profile"); }}><Mail size={16}/> Templates</button>
                    <select value={job.status} onChange={(e) => updateTracked(job.id, { status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
                    <button className="danger" onClick={() => removeTracked(job.id)}><Trash2 size={16}/></button>
                  </div>
                </article>
              ))}
              {filteredTracked.length === 0 && <div className="empty">No tracked jobs yet. Track a live job or add one manually.</div>}
            </section>
          </>
        )}

        {tab === "profile" && (
          <section className="two">
            <div className="panel">
              <h2>Candidate profile</h2>
              <p><b>{CANDIDATE.name}</b></p>
              <p>{CANDIDATE.headline}</p>
              <p>{CANDIDATE.visa}</p>
              <p>{CANDIDATE.skills}</p>
            </div>
            <div className="panel">
              <h2>Templates</h2>
              {!templateJob ? <p>Select Templates from a tracked job.</p> : (
                <>
                  <div className="buttons">
                    <button className={templateKind === "cover" ? "active" : ""} onClick={() => setTemplateKind("cover")}>Cover Letter</button>
                    <button className={templateKind === "follow" ? "active" : ""} onClick={() => setTemplateKind("follow")}>Follow-up</button>
                    <button className={templateKind === "linkedin" ? "active" : ""} onClick={() => setTemplateKind("linkedin")}>LinkedIn</button>
                  </div>
                  <textarea className="template" readOnly value={templateText}/>
                  <button className="primary" onClick={copyText}><Copy size={16}/> {copied ? "Copied" : "Copy"}</button>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);