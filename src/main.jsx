import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Plus,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import "./styles.css";

const INVENTORY_URL = "/data/inventory.csv";
const CONFIG_URL = "/config/scoring-config.json";
const CAMPAIGN_KEY = "domainselector.campaign.v1";
const CAMPAIGN_ID_KEY = "domainselector.currentCampaignId.v1";
const CAMPAIGNS_KEY = "domainselector.savedCampaigns.v1";
const CONFIG_KEY = "domainselector.scoringConfig.v1";
const CONFIG_HISTORY_KEY = "domainselector.scoringConfigHistory.v1";
const SELECTED_KEY = "domainselector.selectedDomains.v1";
const ACTIVE_STEP_KEY = "domainselector.activeStep.v1";
const REQUIRED_COLUMNS = [
  "Domain",
  "DR",
  "Traffic",
  "Country. Traffic",
  "Niche",
  "Main",
  "Complementary",
  "Indirect",
  "GP Price",
  "LI Price",
  "Link Type",
  "TAT",
  "Red Flags",
  "Ranking",
  "Contact"
];

const steps = [
  "Client Info",
  "Campaign Setup",
  "Domain Criteria",
  "Expectations",
  "Call Notes",
  "Domain Matching",
  "Campaign Brief"
];

const initialCampaign = {
  clientName: "FreshBooks",
  website: "https://freshbooks.com",
  primaryContact: "John Smith",
  contactEmail: "john@freshbooks.com",
  industry: "SaaS, accounting software, small business",
  accountManager: "Sarah",
  startDate: "",
  contractValue: 5000,
  budgetPerLink: 500,
  billingCycle: "Monthly",
  targetPages: [{ url: "freshbooks.com", keyword: "best project software", type: "Product page" }],
  anchorStrategy: "Natural / Mixed",
  monthlyLinks: 10,
  linkTypes: ["Guest Post", "Niche Edit"],
  domainApproval: "BlueTree selects - no approval needed",
  contentApproval: "No - BlueTree handles content",
  competitors: "",
  minimumDa: 30,
  minimumDr: 50,
  minimumTraffic: 3000,
  linkRequirement: "Dofollow only",
  niches: "SaaS, B2B tech, project management, HR software",
  geo: "Global",
  excludedNiches: "gambling, CBD, crypto, adult, payday loans",
  primaryGoal: "Keyword Rankings",
  kpis: ["Keyword Rankings", "Organic Traffic", "DA / DR"],
  monitoredKeywords: "best project software\ninvoice software for small business",
  timeline: "3-6 months",
  reportingFrequency: "Monthly",
  reportingContact: "reports@client.com",
  communicationChannel: "Email",
  services: ["Content Creation", "Technical SEO"],
  teamNotes: "",
  salesNotes: "",
  onboardingNotes: ""
};

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headerIndex = rows.findIndex((r) => r[0] === "Domain");
  if (headerIndex < 0) {
    throw new Error("Malformed CSV: could not find the Domain header row.");
  }
  const headers = rows[headerIndex];
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`Inventory CSV is missing required columns: ${missing.join(", ")}.`);
  }
  return rows.slice(headerIndex + 1).map((r, index) => {
    const item = { id: index + 1 };
    headers.forEach((h, i) => {
      item[h] = r[i] || "";
    });
    return item;
  }).filter((row) => row.Domain);
}

const numberFrom = (value) => {
  const parsed = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value) => `$${Math.round(value || 0).toLocaleString()}`;
const formatNumber = (value) => Math.round(value || 0).toLocaleString();
const wordsFrom = (value) => String(value || "").toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 3) || [];
const clean = (value) => String(value || "").toLowerCase().trim();

function effectiveConfig(config, campaign) {
  const industry = clean(campaign.industry);
  const override = config.overrides?.find((item) => industry.includes(clean(item.industryContains)));
  return override ? { ...config, weights: { ...config.weights, ...override.weights } } : config;
}

function priceFor(domain) {
  const gp = numberFrom(domain["GP Price"]);
  const li = numberFrom(domain["LI Price"]);
  return gp || li || 0;
}

function scoreDomain(domain, campaign, config) {
  const weights = config.weights;
  const minDr = numberFrom(campaign.minimumDr || config.defaults.minimumDr);
  const minTraffic = numberFrom(campaign.minimumTraffic || config.defaults.minimumTraffic);
  const dr = numberFrom(domain.DR);
  const traffic = numberFrom(domain.Traffic);
  const ranking = clean(domain.Ranking);
  const linkType = clean(domain["Link Type"]);
  const redFlags = clean(domain["Red Flags"]);
  const reasons = [];

  if (config.hardRules.drBelowMinimum && dr < minDr) reasons.push(`DR ${dr || 0} is below minimum ${minDr}.`);
  if (config.hardRules.trafficBelowMinimum && traffic < minTraffic) reasons.push(`Traffic ${formatNumber(traffic)} is below minimum ${formatNumber(minTraffic)}.`);
  if (config.hardRules.nofollowWhenDofollowRequired && clean(campaign.linkRequirement).includes("dofollow") && linkType.includes("nofollow")) reasons.push("Link type is nofollow.");
  if (config.hardRules.poorRanking && /(poor|bad)/.test(ranking)) reasons.push(`Ranking is ${domain.Ranking || "poor"}.`);
  if (reasons.length) return { excluded: true, reasons };

  const clientWords = wordsFrom(`${campaign.niches} ${campaign.targetPages.map((p) => p.keyword).join(" ")}`);
  const domainString = clean(`${domain.Niche} ${domain.Main} ${domain.Complementary} ${domain.Indirect}`);
  const matches = [...new Set(clientWords.filter((word) => domainString.includes(word)))];
  const density = clientWords.length ? matches.length / clientWords.length : 0;
  const niche = Math.min(weights.niche, Math.round(density * weights.niche * 3));

  const drScore = Math.min(weights.dr, Math.max(0, Math.round(((dr - minDr) / (85 - minDr)) * weights.dr)));
  const trafficScore = Math.min(weights.traffic, Math.max(0, Math.round((Math.log10(Math.max(traffic / minTraffic, 1)) / Math.log10(50)) * weights.traffic)));
  const perLinkBudget = numberFrom(campaign.budgetPerLink)
    || (numberFrom(campaign.contractValue) && numberFrom(campaign.monthlyLinks)
      ? numberFrom(campaign.contractValue) / numberFrom(campaign.monthlyLinks)
      : 0);
  const price = priceFor(domain);
  const priceScore = perLinkBudget && price && price <= perLinkBudget
    ? Math.min(weights.price, Math.round(((perLinkBudget - price) / perLinkBudget) * weights.price))
    : 0;
  const rankingScore = ranking.includes("good") ? weights.ranking : ranking.includes("okay") || ranking.includes("ok") ? Math.round(weights.ranking / 2) : 0;
  const geoField = clean(domain["Country. Traffic"]);
  const geo = clean(campaign.geo);
  const geoScore = !geo || geo === "global" || geoField.includes(geo) ? weights.geo : 0;
  const redFlagScore = !redFlags || ["no", "none", "-"].includes(redFlags) ? weights.redFlags : 0;
  const score = niche + drScore + trafficScore + priceScore + rankingScore + geoScore + redFlagScore;

  return {
    excluded: false,
    score,
    matches,
    price,
    breakdown: { niche, dr: drScore, traffic: trafficScore, price: priceScore, ranking: rankingScore, geo: geoScore, redFlags: redFlagScore },
    reason: matches.length
      ? `Matches ${matches.slice(0, 4).join(", ")} with ${domain.Ranking || "unrated"} inventory quality.`
      : `${domain.Ranking || "Unrated"} publisher that clears quality thresholds, but niche overlap is light.`
  };
}

function App() {
  const [active, setActive] = useState(() => numberFrom(localStorage.getItem(ACTIVE_STEP_KEY)) || 0);
  const [campaign, setCampaign] = useState(() => readJson(CAMPAIGN_KEY, initialCampaign));
  const [campaignId, setCampaignId] = useState(() => localStorage.getItem(CAMPAIGN_ID_KEY) || "");
  const [savedCampaigns, setSavedCampaigns] = useState(() => readJson(CAMPAIGNS_KEY, []));
  const [config, setConfig] = useState(null);
  const [domains, setDomains] = useState([]);
  const [selected, setSelected] = useState(() => new Set(readJson(SELECTED_KEY, [])));
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("score");
  const [tab, setTab] = useState("shortlist");
  const [shortlistSize, setShortlistSize] = useState(50);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [budgetWarning, setBudgetWarning] = useState(null);

  useEffect(() => {
    Promise.all([fetch(INVENTORY_URL).then((r) => r.text()), fetch(CONFIG_URL).then((r) => r.json())])
      .then(([csv, cfg]) => {
        const parsedConfig = readJson(CONFIG_KEY, cfg);
        setDomains(parseCsv(csv));
        setConfig(parsedConfig);
        setShortlistSize(parsedConfig.defaults?.shortlistSize || cfg.defaults?.shortlistSize || 50);
      })
      .catch((error) => {
        setLoadError(error.message || "Could not load inventory or scoring config.");
        setNotice(error.message || "Could not load inventory or scoring config.");
      });
  }, []);

  useEffect(() => {
    writeJson(CAMPAIGN_KEY, campaign);
  }, [campaign]);

  useEffect(() => {
    writeJson(SELECTED_KEY, [...selected]);
  }, [selected]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_STEP_KEY, String(active));
  }, [active]);

  const currentConfig = useMemo(() => config ? effectiveConfig(config, campaign) : null, [config, campaign]);
  const scored = useMemo(() => {
    if (!currentConfig) return { included: [], excluded: [] };
    const results = domains.map((domain) => ({ ...domain, scoring: scoreDomain(domain, campaign, currentConfig) }));
    const included = results.filter((d) => !d.scoring.excluded);
    const excluded = results.filter((d) => d.scoring.excluded);
    included.sort((a, b) => b.scoring.score - a.scoring.score);
    return { included, excluded };
  }, [domains, campaign, currentConfig]);

  const shortlist = useMemo(() => {
    let list = scored.included.slice(0, shortlistSize);
    if (query) {
      const q = clean(query);
      list = list.filter((d) => clean(`${d.Domain} ${d.Niche} ${d.Main} ${d.Contact}`).includes(q));
    }
    return [...list].sort((a, b) => {
      if (sort === "dr") return numberFrom(b.DR) - numberFrom(a.DR);
      if (sort === "traffic") return numberFrom(b.Traffic) - numberFrom(a.Traffic);
      if (sort === "price") return a.scoring.price - b.scoring.price;
      return b.scoring.score - a.scoring.score;
    });
  }, [scored, shortlistSize, query, sort]);

  useEffect(() => {
    if (selected.size === 0 && scored.included.length) {
      setSelected(new Set(scored.included.slice(0, numberFrom(campaign.monthlyLinks) || 10).map((d) => d.id)));
    }
  }, [scored.included.length]);

  const selectedDomains = scored.included.filter((d) => selected.has(d.id));
  const totals = selectedDomains.reduce((acc, domain) => {
    acc.cost += domain.scoring.price;
    acc.dr += numberFrom(domain.DR);
    return acc;
  }, { cost: 0, dr: 0 });
  const budget = numberFrom(campaign.budgetPerLink) && numberFrom(campaign.monthlyLinks)
    ? numberFrom(campaign.budgetPerLink) * numberFrom(campaign.monthlyLinks)
    : numberFrom(campaign.contractValue);
  const totalSnapshot = { ...totals, budget, count: selectedDomains.length, averageDr: selectedDomains.length ? totals.dr / selectedDomains.length : 0 };
  const isOverBudget = totalSnapshot.cost > totalSnapshot.budget;

  const goToStep = (nextStep) => {
    if (nextStep === 6 && isOverBudget) {
      setBudgetWarning({ nextStep });
      return;
    }
    setActive(nextStep);
  };

  const update = (key, value) => setCampaign((prev) => ({ ...prev, [key]: value }));
  const updateTarget = (index, key, value) => setCampaign((prev) => ({
    ...prev,
    targetPages: prev.targetPages.map((page, i) => i === index ? { ...page, [key]: value } : page)
  }));
  const toggleArray = (key, value) => {
    const values = new Set(campaign[key]);
    values.has(value) ? values.delete(value) : values.add(value);
    update(key, [...values]);
  };
  const saveCampaign = () => {
    const id = campaignId || `${Date.now()}`;
    const record = {
      id,
      name: campaign.clientName || "Untitled campaign",
      campaign,
      selected: [...selected],
      savedAt: new Date().toISOString()
    };
    const next = [record, ...savedCampaigns.filter((item) => item.id !== id)].slice(0, 25);
    setCampaignId(id);
    localStorage.setItem(CAMPAIGN_ID_KEY, id);
    setSavedCampaigns(next);
    writeJson(CAMPAIGNS_KEY, next);
    setNotice("Campaign saved locally and can be reopened later.");
  };
  const openCampaign = (record) => {
    setCampaign(record.campaign);
    setSelected(new Set(record.selected || []));
    setCampaignId(record.id);
    localStorage.setItem(CAMPAIGN_ID_KEY, record.id);
    setActive(0);
    setNotice(`Reopened ${record.name}.`);
  };
  const newCampaign = () => {
    setCampaign(initialCampaign);
    setSelected(new Set());
    setCampaignId("");
    localStorage.removeItem(CAMPAIGN_ID_KEY);
    setActive(0);
    setNotice("Started a new campaign.");
  };
  const copyBrief = async () => {
    await navigator.clipboard.writeText(briefText(campaign, selectedDomains, currentConfig));
    setNotice("Campaign brief copied.");
  };
  const addRows = (workbook, name, rows) => {
    const sheet = workbook.addWorksheet(name.slice(0, 31));
    if (!rows.length) return sheet;
    sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: Math.min(Math.max(key.length + 4, 14), 34) }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173A35" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    return sheet;
  };

  const exportWorkbook = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "DomainSelector";
    wb.created = new Date();
    const targetPages = campaign.targetPages.map((p) => `${p.url}`).join("\n");
    addRows(wb, "Client Info", [{
      "Client Name": campaign.clientName,
      "Client Status": "Active",
      "Order / Period": 1,
      "Order Start Date": campaign.startDate,
      "Order Deadline": "",
      "Link Volume": campaign.monthlyLinks,
      "Budget Per Target": numberFrom(campaign.budgetPerLink) || budget / Math.max(numberFrom(campaign.monthlyLinks), 1),
      "Min. DR": campaign.minimumDr,
      "Min. Traffic": campaign.minimumTraffic,
      "Order Payment Date": "Unpaid",
      "Order Type": campaign.billingCycle,
      "Domains": campaign.website,
      "Target Pages": targetPages,
      "Domain Approval": campaign.domainApproval.includes("no approval") ? "No" : "Yes",
      "Domain Approval Tracker": "",
      "Order / Period Notes": campaign.teamNotes,
      "Team in Charge": "Sponsored",
      "Links Live": 0,
      "Order / Period Shortfall": campaign.monthlyLinks,
      "Link Tracker": "",
      "Order Status": "Planned",
      "Account Manager": campaign.accountManager
    }]);
    addRows(wb, "Client Target Pages", campaign.targetPages.map((p, i) => ({
      "Target URL": p.url,
      "Target Keyword": p.keyword,
      "Page Type": p.type || `Page ${i + 1}`
    })));
    const cmRows = selectedDomains.map((d, i) => ({
      "Period": 1,
      "Period Start Date": campaign.startDate,
      "Order #": `${campaign.clientName.slice(0, 3).toUpperCase()}${String(i + 1).padStart(4, "0")}`,
      "Order Date": new Date().toISOString().slice(0, 10),
      "Placement Domain": d.Domain,
      "Placement URL": "",
      "DR": numberFrom(d.DR),
      "Traffic": numberFrom(d.Traffic),
      "Order Price": d.scoring.price,
      "DB Price": d["GP Price"] || d["LI Price"],
      "Can Use": "Yes",
      "TAT": d.TAT,
      "Target URL": campaign.targetPages[i % campaign.targetPages.length]?.url || "",
      "Anchor Text": campaign.anchorStrategy,
      "Link Type": d["Link Type"],
      "Budget": numberFrom(campaign.budgetPerLink) || budget / Math.max(numberFrom(campaign.monthlyLinks), 1),
      "Profit": { formula: `P${i + 2}-I${i + 2}` },
      "Status": "Planned",
      "Publishing Date": "",
      "Contact Email": d.Contact,
      "Thread ID": "",
      "Team": campaign.accountManager,
      "Notes": d.scoring.reason,
      "Review Status": "",
      "Review Notes": "",
      "Topics/Snippets": "",
      "GP Doc": "",
      "Content Status": "",
      "Payment Invoice": "",
      "Vendor Name (on the invoice)": "",
      "Request Type": "",
      "Invoice Link No.": "",
      "Payment Status": "",
      "Payment Notes": "",
      "Hash": d["CM Hashes"] || `${d.Domain}-${i + 1}`
    }));
    addRows(wb, "CM", cmRows);
    const host = new URL(campaign.website.startsWith("http") ? campaign.website : `https://${campaign.website}`).hostname.replace(/^www\./, "");
    addRows(wb, `Referring Domains - ${host}`, selectedDomains.map((d, i) => ({
      "#": i + 1,
      "Domain": d.Domain,
      "Is spam": d["Red Flags"] ? "Review" : "False",
      "DR": numberFrom(d.DR),
      "Dofollow ref. domains": "",
      "Dofollow linked domains": "",
      "Traffic ": numberFrom(d.Traffic),
      "Keywords ": "",
      "Links to target": "",
      "New links": "",
      "Lost links": "",
      "Dofollow links": "",
      "First seen": "",
      "Lost": ""
    })));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${campaign.clientName.replace(/[^a-z0-9]+/gi, "-")}-campaign.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!config) {
    return <Shell notice={notice} setNotice={setNotice}>
      <div className={loadError ? "errorState" : "loading"}>
        <h1>{loadError ? "Could not load DomainSelector" : "Loading inventory and scoring config..."}</h1>
        {loadError && <p>{loadError}</p>}
      </div>
    </Shell>;
  }

  return (
    <Shell notice={notice} setNotice={setNotice}>
      <header className="topbar">
        <div className="brandmark">DS</div>
        <div>
          <strong>DomainSelector</strong>
          <span>BlueTree Digital campaign workspace</span>
        </div>
        <button className="ghost iconText" onClick={newCampaign}><Plus size={16} /> New</button>
        <button className="ghost iconText" onClick={() => goToStep(6)}><Clipboard size={16} /> Brief</button>
      </header>
      <CampaignLibrary campaigns={savedCampaigns} currentId={campaignId} openCampaign={openCampaign} />
      <nav className="steps">
        {steps.map((step, i) => (
          <button key={step} className={active === i ? "active" : ""} onClick={() => goToStep(i)}>
            <small>{String(i + 1).padStart(2, "0")}</small>{step}
          </button>
        ))}
      </nav>
      {active === 0 && <ClientInfo campaign={campaign} update={update} />}
      {active === 1 && <CampaignSetup campaign={campaign} update={update} updateTarget={updateTarget} toggleArray={toggleArray} />}
      {active === 2 && <DomainCriteria campaign={campaign} update={update} />}
      {active === 3 && <Expectations campaign={campaign} update={update} toggleArray={toggleArray} />}
      {active === 4 && <CallNotes campaign={campaign} update={update} />}
      {active === 5 && (
        <DomainMatching
          campaign={campaign}
          domains={domains}
          config={currentConfig}
          rawConfig={config}
          setConfig={setConfig}
          shortlist={shortlist}
          excluded={scored.excluded}
          selected={selected}
          setSelected={setSelected}
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
          shortlistSize={shortlistSize}
          setShortlistSize={setShortlistSize}
          totals={totalSnapshot}
          tab={tab}
          setTab={setTab}
        />
      )}
      {active === 6 && (
        <CampaignBrief
          campaign={campaign}
          config={currentConfig}
          selectedDomains={selectedDomains}
          totals={totalSnapshot}
          setTab={setTab}
          setActive={setActive}
          copyBrief={copyBrief}
          exportWorkbook={exportWorkbook}
          saveCampaign={saveCampaign}
        />
      )}
      <footer className="footer">
        <button className="ghost iconText" disabled={active === 0} onClick={() => setActive((s) => Math.max(0, s - 1))}><ArrowLeft size={16} /> Back</button>
        <div className="footerActions">
          <button className="ghost iconText" onClick={saveCampaign}><Save size={16} /> Save</button>
          {active < steps.length - 1 && <button className="primary iconText" onClick={() => goToStep(Math.min(6, active + 1))}>Continue <ArrowRight size={16} /></button>}
        </div>
      </footer>
      {budgetWarning && (
        <BudgetWarning
          totals={totalSnapshot}
          onContinue={() => {
            setBudgetWarning(null);
            setActive(budgetWarning.nextStep);
          }}
          onBack={() => {
            setBudgetWarning(null);
            setActive(0);
            setNotice("Update Contract Value, monthly links, or selected domains before finalizing.");
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children, notice, setNotice }) {
  return (
    <main className="app">
      {children}
      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}<X size={16} /></button>}
    </main>
  );
}

function CampaignLibrary({ campaigns, currentId, openCampaign }) {
  if (!campaigns.length) {
    return null;
  }
  return (
    <aside className="campaignShelf" aria-label="Saved campaigns">
      <strong>Saved campaigns</strong>
      <div>
        {campaigns.slice(0, 6).map((record) => (
          <button key={record.id} className={record.id === currentId ? "active" : ""} onClick={() => openCampaign(record)}>
            <span>{record.name}</span>
            <small>{new Date(record.savedAt).toLocaleDateString()}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}

function Section({ title, subtitle, children }) {
  return <section className="section"><h1>{title}</h1><p>{subtitle}</p><div className="rule" />{children}</section>;
}

function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{hint && <em>{hint}</em>}{children}</label>;
}

function ClientInfo({ campaign, update }) {
  return (
    <Section title="Client Information" subtitle="Core details from the sales call and SOW">
      <div className="grid two">
        <Field label="Company Name"><input value={campaign.clientName} onChange={(e) => update("clientName", e.target.value)} /></Field>
        <Field label="Website"><input value={campaign.website} onChange={(e) => update("website", e.target.value)} /></Field>
        <Field label="Primary Contact"><input value={campaign.primaryContact} onChange={(e) => update("primaryContact", e.target.value)} /></Field>
        <Field label="Contact Email"><input value={campaign.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} /></Field>
        <Field label="Industry"><input value={campaign.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. SaaS, Fintech, E-commerce" /></Field>
        <Field label="Assigned Account Manager"><input value={campaign.accountManager} onChange={(e) => update("accountManager", e.target.value)} /></Field>
        <Field label="Campaign Start Date"><input type="date" value={campaign.startDate} onChange={(e) => update("startDate", e.target.value)} /></Field>
        <Field label="Billing Cycle"><select value={campaign.billingCycle} onChange={(e) => update("billingCycle", e.target.value)}><option>Monthly</option><option>One-time</option><option>Quarterly</option></select></Field>
        <Field label="Contract Value ($)" hint="Monthly value used for total budget"><input type="number" value={campaign.contractValue} onChange={(e) => update("contractValue", e.target.value)} /></Field>
        <Field label="Budget Per Link ($)" hint="Required for price-efficiency scoring"><input type="number" value={campaign.budgetPerLink} onChange={(e) => update("budgetPerLink", e.target.value)} /></Field>
      </div>
    </Section>
  );
}

function CampaignSetup({ campaign, update, updateTarget, toggleArray }) {
  const linkTypes = ["Guest Post", "Niche Edit", "Digital PR", "Resource Link", "Listicle", "Roundup"];
  return (
    <Section title="Campaign Setup" subtitle="Target pages, link volume, and placement strategy">
      <h2>Target Pages</h2>
      {campaign.targetPages.map((page, i) => (
        <div className="targetBox" key={i}>
          <strong>Page {i + 1}</strong>
          <div className="grid three">
            <Field label="URL"><input value={page.url} onChange={(e) => updateTarget(i, "url", e.target.value)} /></Field>
            <Field label="Target Keyword"><input value={page.keyword} onChange={(e) => updateTarget(i, "keyword", e.target.value)} /></Field>
            <Field label="Page Type"><select value={page.type} onChange={(e) => updateTarget(i, "type", e.target.value)}><option>Product page</option><option>Homepage</option><option>Blog post</option><option>Landing page</option></select></Field>
          </div>
        </div>
      ))}
      <button className="secondary iconText" onClick={() => update("targetPages", [...campaign.targetPages, { url: "", keyword: "", type: "Landing page" }])}><Plus size={16} /> Add Page</button>
      <div className="grid two spaced">
        <Field label="Anchor Text Strategy"><select value={campaign.anchorStrategy} onChange={(e) => update("anchorStrategy", e.target.value)}><option>Natural / Mixed</option><option>Exact match light</option><option>Brand-heavy</option></select></Field>
        <Field label="Monthly Link Volume" hint="Used to assign domains to periods in export"><input type="number" value={campaign.monthlyLinks} onChange={(e) => update("monthlyLinks", e.target.value)} /></Field>
      </div>
      <Field label="Link Types"><ChipRow values={linkTypes} selected={campaign.linkTypes} onClick={(v) => toggleArray("linkTypes", v)} /></Field>
      <div className="grid two">
        <Field label="Domain Approval Process"><select value={campaign.domainApproval} onChange={(e) => update("domainApproval", e.target.value)}><option>BlueTree selects - no approval needed</option><option>Client approves shortlist before outreach</option></select></Field>
        <Field label="Content Approval Required?"><select value={campaign.contentApproval} onChange={(e) => update("contentApproval", e.target.value)}><option>No - BlueTree handles content</option><option>Yes - client reviews content</option></select></Field>
      </div>
      <Field label="Competitors / Sites To Avoid"><textarea rows="4" value={campaign.competitors} onChange={(e) => update("competitors", e.target.value)} /></Field>
    </Section>
  );
}

function DomainCriteria({ campaign, update }) {
  return (
    <Section title="Domain Criteria" subtitle="Quality thresholds used to filter inventory">
      <div className="grid two">
        <Field label="Minimum DA (Moz)"><input type="number" value={campaign.minimumDa} onChange={(e) => update("minimumDa", e.target.value)} /></Field>
        <Field label="Minimum DR (Ahrefs)" hint="Defaults to 50; below this is filtered out"><input type="number" value={campaign.minimumDr} onChange={(e) => update("minimumDr", e.target.value)} /></Field>
        <Field label="Minimum Monthly Traffic" hint="Defaults to 3,000"><input type="number" value={campaign.minimumTraffic} onChange={(e) => update("minimumTraffic", e.target.value)} /></Field>
        <Field label="Link Type Requirement"><select value={campaign.linkRequirement} onChange={(e) => update("linkRequirement", e.target.value)}><option>Dofollow only</option><option>Either dofollow or nofollow</option></select></Field>
      </div>
      <Field label="Preferred Niches / Topics" hint="More specific topics improve matching"><textarea rows="4" value={campaign.niches} onChange={(e) => update("niches", e.target.value)} /></Field>
      <Field label="Geo Focus"><select value={campaign.geo} onChange={(e) => update("geo", e.target.value)}><option>Global</option><option>US</option><option>UK</option><option>CA</option><option>AU</option><option>IN</option></select></Field>
      <Field label="Industries / Niches To Exclude"><textarea rows="3" value={campaign.excludedNiches} onChange={(e) => update("excludedNiches", e.target.value)} /></Field>
    </Section>
  );
}

function Expectations({ campaign, update, toggleArray }) {
  const kpis = ["Keyword Rankings", "Organic Traffic", "DA / DR", "Referring Domains", "Leads", "Revenue", "Brand Mentions"];
  const services = ["Content Creation", "Technical SEO", "Competitor Analysis", "Local SEO", "International SEO", "Penalty Recovery"];
  return (
    <Section title="Goals & Expectations" subtitle="What success looks like for this client">
      <Field label="Primary Campaign Goal"><select value={campaign.primaryGoal} onChange={(e) => update("primaryGoal", e.target.value)}><option>Keyword Rankings</option><option>Organic Traffic</option><option>Referral Authority</option><option>Brand Visibility</option></select></Field>
      <Field label="KPIs To Track"><ChipRow values={kpis} selected={campaign.kpis} onClick={(v) => toggleArray("kpis", v)} /></Field>
      <Field label="Target Keywords To Monitor"><textarea rows="4" value={campaign.monitoredKeywords} onChange={(e) => update("monitoredKeywords", e.target.value)} /></Field>
      <div className="grid two">
        <Field label="Expected Results Timeline"><select value={campaign.timeline} onChange={(e) => update("timeline", e.target.value)}><option>3-6 months</option><option>6-9 months</option><option>9-12 months</option></select></Field>
        <Field label="Reporting Frequency"><select value={campaign.reportingFrequency} onChange={(e) => update("reportingFrequency", e.target.value)}><option>Monthly</option><option>Bi-weekly</option><option>Quarterly</option></select></Field>
        <Field label="Reporting Contact"><input value={campaign.reportingContact} onChange={(e) => update("reportingContact", e.target.value)} /></Field>
        <Field label="Communication Channel"><select value={campaign.communicationChannel} onChange={(e) => update("communicationChannel", e.target.value)}><option>Email</option><option>Slack</option><option>Teams</option></select></Field>
      </div>
      <Field label="Additional Services Interested In"><ChipRow values={services} selected={campaign.services} onClick={(v) => toggleArray("services", v)} /></Field>
      <Field label="Notes For Campaign Team"><textarea rows="4" value={campaign.teamNotes} onChange={(e) => update("teamNotes", e.target.value)} /></Field>
    </Section>
  );
}

function CallNotes({ campaign, update }) {
  return (
    <Section title="Call Notes" subtitle="Paste sales and onboarding summaries for the campaign team">
      <NoteBox title="Sales Call" value={campaign.salesNotes} onChange={(v) => update("salesNotes", v)} />
      <NoteBox title="Onboarding Call" value={campaign.onboardingNotes} onChange={(v) => update("onboardingNotes", v)} />
    </Section>
  );
}

function NoteBox({ title, value, onChange }) {
  return <div className="noteBox"><h2>{title}</h2><Field label="Fireflies Summary Or Call Notes"><textarea rows="8" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Paste summary, keywords, action items, and client quirks..." /></Field></div>;
}

function DomainMatching(props) {
  const {
    domains, config, rawConfig, setConfig, shortlist, excluded, selected, setSelected, query, setQuery, sort, setSort,
    shortlistSize, setShortlistSize, totals, tab, setTab
  } = props;
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  return (
    <Section title="Domain Matching" subtitle="Scored shortlist from the paid sites inventory">
      <Stats totals={totals} />
      <div className="runSummary">
        <Info label="Inventory Rows" value={formatNumber(domains.length)} />
        <Info label="Scoring Config" value={config.version} />
        <Info label="Repeatability" value="Deterministic for same brief, inventory, and config" />
      </div>
      <div className="toolbar">
        <div className="search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search domains, niches, or contacts" /></div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="score">Score</option><option value="dr">DR</option><option value="traffic">Traffic</option><option value="price">Price</option></select>
        <select value={shortlistSize} onChange={(e) => setShortlistSize(Number(e.target.value))}><option>25</option><option>50</option><option>100</option></select>
      </div>
      <div className="tabs">
        <button className={tab === "shortlist" ? "active" : ""} onClick={() => setTab("shortlist")}><Layers size={16} /> Shortlist ({shortlist.length})</button>
        <button className={tab === "excluded" ? "active" : ""} onClick={() => setTab("excluded")}><Filter size={16} /> Disqualified ({excluded.length})</button>
        <button className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}><Settings size={16} /> Scoring Config</button>
      </div>
      {tab === "shortlist" && <DomainTable domains={shortlist} selected={selected} toggle={toggle} />}
      {tab === "excluded" && <ExcludedTable domains={excluded.slice(0, 100)} />}
      {tab === "config" && <ConfigPanel rawConfig={rawConfig} setConfig={setConfig} />}
    </Section>
  );
}

function Stats({ totals }) {
  const remaining = totals.budget - totals.cost;
  const overBudget = remaining < 0;
  return <div className="statGrid">
    <div><span>Selected</span><strong>{totals.count}</strong></div>
    <div><span>Budget Spent</span><strong>{formatMoney(totals.cost)}</strong></div>
    <div className={overBudget ? "dangerStat" : ""}><span>{overBudget ? "Over Budget" : "Remaining"}</span><strong>{formatMoney(Math.abs(remaining))}</strong></div>
    <div><span>Avg DR</span><strong>{Math.round(totals.averageDr || 0)}</strong></div>
  </div>;
}

function BudgetWarning({ totals, onContinue, onBack }) {
  return (
    <div className="modalScrim" role="dialog" aria-modal="true">
      <div className="budgetModal">
        <div className="warningIcon"><AlertTriangle size={26} /></div>
        <h2>Campaign is over budget</h2>
        <p>
          The selected domains cost {formatMoney(totals.cost)}, but the contract value is {formatMoney(totals.budget)}.
          That puts this campaign {formatMoney(totals.cost - totals.budget)} over budget.
        </p>
        <div className="modalStats">
          <Info label="Selected Domains" value={totals.count} />
          <Info label="Average DR" value={Math.round(totals.averageDr || 0)} />
          <Info label="Over Budget" value={formatMoney(totals.cost - totals.budget)} />
        </div>
        <div className="actionRow">
          <button className="ghost iconText" onClick={onBack}><ArrowLeft size={16} /> Back To Contract Value</button>
          <button className="primary iconText" onClick={onContinue}>Continue Anyway <ArrowRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function DomainTable({ domains, selected, toggle }) {
  return <div className="tableWrap"><table><thead><tr><th></th><th>Domain</th><th>Score</th><th>Metrics</th><th>Price</th><th>Reasoning</th><th>Red Flags</th><th>Contact</th></tr></thead><tbody>
    {domains.map((d) => <tr key={d.id} className={selected.has(d.id) ? "picked" : ""}>
      <td><button className="checkButton" onClick={() => toggle(d.id)}>{selected.has(d.id) ? <Check size={16} /> : <Plus size={16} />}</button></td>
      <td><strong>{d.Domain}</strong><span>{compactText(d.Main || d.Niche, 70)}</span></td>
      <td><div className="score">{d.scoring.score}</div><Breakdown breakdown={d.scoring.breakdown} /></td>
      <td><span>DR {d.DR}</span><span>{formatNumber(numberFrom(d.Traffic))} traffic</span><span>{d["Country. Traffic"] || "Geo n/a"}</span><span>{d["Link Type"] || "Link type n/a"}</span><span>{d.TAT || "TAT n/a"}</span></td>
      <td>{formatMoney(d.scoring.price)}</td>
      <td>{d.scoring.reason}</td>
      <td>{d["Red Flags"] || "Clean"}</td>
      <td>{d.Contact || "No contact"}</td>
    </tr>)}
  </tbody></table></div>;
}

function Breakdown({ breakdown }) {
  return <div className="bars">{Object.entries(breakdown).map(([key, value]) => <span key={key} style={{ "--w": `${Math.max(8, value * 3)}px` }} title={`${key}: ${value}`} />)}</div>;
}

function ExcludedTable({ domains }) {
  return <div className="tableWrap"><table><thead><tr><th>Domain</th><th>DR</th><th>Traffic</th><th>Ranking</th><th>Reason</th></tr></thead><tbody>
    {domains.map((d) => <tr key={d.id}><td><strong>{d.Domain}</strong></td><td>{d.DR}</td><td>{formatNumber(numberFrom(d.Traffic))}</td><td>{d.Ranking || "-"}</td><td>{d.scoring.reasons.join(" ")}</td></tr>)}
  </tbody></table></div>;
}

function ConfigPanel({ rawConfig, setConfig }) {
  const [draft, setDraft] = useState(JSON.stringify(rawConfig, null, 2));
  const [history, setHistory] = useState(() => readJson(CONFIG_HISTORY_KEY, []));
  const save = () => {
    try {
      const parsed = JSON.parse(draft);
      const nextConfig = {
        ...parsed,
        version: `${parsed.version || "custom"}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`
      };
      const nextHistory = [{ ...rawConfig, archivedAt: new Date().toISOString() }, ...history].slice(0, 10);
      writeJson(CONFIG_HISTORY_KEY, nextHistory);
      writeJson(CONFIG_KEY, nextConfig);
      setHistory(nextHistory);
      setConfig(nextConfig);
    } catch {
      alert("Config JSON is invalid. Fix the syntax before saving.");
    }
  };
  const restore = (item) => {
    const restored = { ...item, version: `${item.version || "restored"}-restored-${new Date().toISOString().slice(0, 10)}` };
    delete restored.archivedAt;
    writeJson(CONFIG_KEY, restored);
    setConfig(restored);
    setDraft(JSON.stringify(restored, null, 2));
  };
  return <div className="configPanel">
    <div className="configHeader"><SlidersHorizontal size={18} /><div><strong>Runtime Scoring Configuration</strong><span>Weights, hard rules, overrides, and prompts are editable without rebuilding.</span></div><button className="primary iconText" onClick={save}><Save size={16} /> Save Config</button></div>
    <textarea rows="18" value={draft} onChange={(e) => setDraft(e.target.value)} />
    <div className="configHistory">
      <strong>Rollback history</strong>
      {history.length ? history.map((item) => (
        <button className="ghost" key={`${item.version}-${item.archivedAt}`} onClick={() => restore(item)}>
          {item.version} <span>{item.archivedAt ? new Date(item.archivedAt).toLocaleString() : ""}</span>
        </button>
      )) : <p>No previous config versions yet.</p>}
    </div>
  </div>;
}

function CampaignBrief({ campaign, config, selectedDomains, totals, setActive, copyBrief, exportWorkbook, saveCampaign }) {
  return (
    <Section title="Campaign Brief Ready" subtitle={`Generated ${new Date().toLocaleDateString()}`}>
      <div className="briefHero">
        <div className="avatar">{campaign.clientName[0]}</div>
        <div><h2>{campaign.clientName}</h2><span>{campaign.website}</span></div>
        <strong>{formatMoney(campaign.contractValue)}<small>/ {campaign.billingCycle}</small></strong>
      </div>
      <Stats totals={totals} />
      <div className="briefGrid">
        <div className="panel"><h2>Domain Criteria</h2><Info label="Min DR / DA" value={`${campaign.minimumDr} / ${campaign.minimumDa}`} /><Info label="Min Traffic" value={formatNumber(campaign.minimumTraffic)} /><Info label="Niches" value={campaign.niches} /><Info label="Geo" value={campaign.geo} /><Info label="Link Type" value={campaign.linkRequirement} /></div>
        <div className="panel"><h2>Goals & Expectations</h2><Info label="Primary Goal" value={campaign.primaryGoal} /><Info label="Timeline" value={campaign.timeline} /><Info label="Reporting" value={campaign.reportingFrequency} /><Info label="Scoring Version" value={config.version} /></div>
      </div>
      <div className="briefGrid">
        <div className="panel fullPanel">
          <div className="panelHeader">
            <h2>Selected Domains</h2>
            <button className="ghost iconText" onClick={() => setActive(5)}><SlidersHorizontal size={16} /> Edit Selection</button>
          </div>
          {selectedDomains.length ? <BriefDomainList domains={selectedDomains} /> : <p className="emptyState">No domains selected yet.</p>}
        </div>
      </div>
      <div className="briefGrid">
        <div className="panel fullPanel">
          <h2>Target Pages</h2>
          <div className="targetList">
            {campaign.targetPages.map((page, index) => (
              <Info key={`${page.url}-${index}`} label={page.type || `Page ${index + 1}`} value={`${page.url} - ${page.keyword}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="actionRow">
        <button className="ghost iconText" onClick={saveCampaign}><Save size={16} /> Save Campaign</button>
        <button className="ghost iconText" onClick={copyBrief}><Clipboard size={16} /> Copy Brief</button>
        <button className="primary iconText" onClick={exportWorkbook}><FileSpreadsheet size={16} /> Export XLSX</button>
        <button className="secondary iconText" onClick={() => {
          localStorage.removeItem(CAMPAIGN_KEY);
          localStorage.removeItem(SELECTED_KEY);
          localStorage.removeItem(CAMPAIGN_ID_KEY);
          localStorage.removeItem(ACTIVE_STEP_KEY);
          location.reload();
        }}><Trash2 size={16} /> Reset</button>
      </div>
    </Section>
  );
}

function BriefDomainList({ domains }) {
  return (
    <div className="briefDomainList">
      {domains.map((domain) => (
        <div className="briefDomain" key={domain.id}>
          <div>
            <strong>{domain.Domain}</strong>
            <span>{compactText(domain.scoring.reason, 110)}</span>
          </div>
          <div><span>Score</span><strong>{domain.scoring.score}</strong></div>
          <div><span>DR</span><strong>{domain.DR}</strong></div>
          <div><span>Traffic</span><strong>{formatNumber(numberFrom(domain.Traffic))}</strong></div>
          <div><span>Price</span><strong>{formatMoney(domain.scoring.price)}</strong></div>
          <div><span>Type</span><strong>{domain["Link Type"] || "-"}</strong></div>
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }) {
  return <div className="info"><span>{label}</span><strong>{value || "-"}</strong></div>;
}

function ChipRow({ values, selected, onClick }) {
  return <div className="chips">{values.map((value) => <button type="button" key={value} className={selected.includes(value) ? "selected" : ""} onClick={() => onClick(value)}>{value}</button>)}</div>;
}

function compactText(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function briefText(campaign, domains, config) {
  return `${campaign.clientName} campaign brief
Goal: ${campaign.primaryGoal}
Monthly links: ${campaign.monthlyLinks}
Criteria: DR ${campaign.minimumDr}+, traffic ${campaign.minimumTraffic}+, ${campaign.linkRequirement}
Niches: ${campaign.niches}
Selected domains: ${domains.map((d) => d.Domain).join(", ")}
Scoring config: ${config.version}`;
}

createRoot(document.getElementById("root")).render(<App />);
