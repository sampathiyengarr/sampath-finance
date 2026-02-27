import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

const C = {
  bg:"#0b0c10", surface:"#13151c", card:"#191c26", border:"#222536",
  accent:"#e8b84b", income:"#3ecf8e", expense:"#e06c6c",
  blue:"#6b9cf5", muted:"#5a6480", text:"#dde1ef", dim:"#8a94b0",
  purple:"#a78bfa", teal:"#2dd4bf",
};

const MONTHS_LABELS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
function getMonths(fy) {
  const [y1,y2] = fy.split("-");
  const s1=y1.slice(2), s2=y2.slice(2);
  return [...MONTHS_LABELS.slice(0,9).map(m=>`${m}-${s1}`),...MONTHS_LABELS.slice(9).map(m=>`${m}-${s2}`)];
}

// ── PERSONAL INCOME ROWS ──────────────────────────────────────────────────────
const ALL_INCOME_ROWS = [
  { id:"rental",    label:"Rental — Anand Prakash",           budget:13750, note:"₹13,750 upto Jan-26 · ₹15,000 from Feb-26" },
  { id:"cash_cust", label:"Cash from Customer",               budget:25000, note:"₹10k→TIN HUF · ₹10k Pankaj · ₹6k Mina · ₹1k from adhoc" },
  { id:"wife",      label:"Wife's Contribution — Staff",      budget:10000, note:"For house staff" },
  { id:"tin_huf",   label:"TIN HUF Transfer to Personal",     budget:10000, note:"Funded from ₹25k cash · funds Loan 1 EMI · ₹823 surplus" },
  { id:"sam7_reimb",label:"SAM 7 — Loan 2 Reimbursement",     budget:10000, note:"Reimburses Loan 2 EMI ₹9,704 · ₹296 surplus" },
  { id:"adhoc",     label:"Adhoc / Additional Income",        budget:0,     note:"Cash sales, extra work, one-off — fill when received" },
];

// ── PERSONAL EXPENSE ROWS ─────────────────────────────────────────────────────
const ALL_EXPENSE_ROWS = [
  { id:"emi1",      label:"EMI — Loan 1 (Wedding ₹1.03L)",   budget:9177,  note:"Closes Dec 2026" },
  { id:"emi2",      label:"EMI — Loan 2 (SAM 7 ₹2.04L)",     budget:9704,  note:"Ends Feb 2027" },
  { id:"emi3",      label:"EMI — Loan 3 (₹5.14L Closure)",   budget:11503, note:"Ends Dec 2030" },
  { id:"flat_emi",  label:"Flat EMI — Anand Prakash (50%)",   budget:12964, note:"Your share of home loan" },
  { id:"society",   label:"Society Charges — Anand Prakash",  budget:1000,  note:"Monthly maintenance, Anand Prakash flat" },
  { id:"pankaj",    label:"Pankaj — Cook Salary",             budget:10000, note:"Paid from ₹25k cash receipts" },
  { id:"mina",      label:"Mina — Maid Salary",               budget:6000,  note:"Paid from ₹25k cash receipts" },
  { id:"day_maid",  label:"Day Maid",                         budget:0,     note:"SAM 7 pays — personal benefit", bizPays:"SAM 7" },
  { id:"night_maid",label:"Night Maid",                       budget:0,     note:"NMC pays — personal benefit",   bizPays:"NMC" },
  { id:"other",     label:"Other Personal Expenses",          budget:0,     note:"Groceries, utilities, medical" },
];

// ── ENTITY ROW DEFINITIONS ────────────────────────────────────────────────────
const ENTITY_DEFS = {
  "NMC": {
    color: C.blue,
    fullName: "Neural Maven Consulting",
    incomeRows: [
      { id:"nmc_consulting", label:"Consulting / Project Income", budget:0 },
      { id:"nmc_retainer",   label:"Retainer Income",             budget:0 },
      { id:"nmc_other_inc",  label:"Other Income",                budget:0 },
    ],
    expenseRows: [
      { id:"nmc_alex",       label:"Alex — Salary",               budget:5000 },
      { id:"nmc_night_maid", label:"Night Maid Salary",           budget:0,    note:"Personal benefit paid by NMC" },
      { id:"nmc_house_help", label:"House Help (NMC share)",      budget:2000 },
      { id:"nmc_society",    label:"Society Charges (NMC share)", budget:4500 },
      { id:"nmc_office",     label:"Office / Ops Expenses",       budget:0 },
      { id:"nmc_other_exp",  label:"Other Expenses",              budget:0 },
    ],
  },
  "SAM 7": {
    color: C.accent,
    fullName: "SAM 7",
    incomeRows: [
      { id:"s7_income",      label:"Business Income",             budget:10250 },
      { id:"s7_other_inc",   label:"Other Income",                budget:0 },
    ],
    expenseRows: [
      { id:"s7_alex",        label:"Alex — Salary",               budget:10000 },
      { id:"s7_day_maid",    label:"Day Maid Salary",             budget:0,    note:"Personal benefit paid by SAM 7" },
      { id:"s7_loan2_reimb", label:"Loan 2 Reimbursement to Personal", budget:10000 },
      { id:"s7_ops",         label:"Operations Expenses",         budget:0 },
      { id:"s7_other_exp",   label:"Other Expenses",              budget:0 },
    ],
  },
  "TIN HUF": {
    color: C.income,
    fullName: "The Indian Networker HUF",
    incomeRows: [
      { id:"tin_cash_dep",   label:"Cash Deposit (from ₹25k)",   budget:10000 },
      { id:"tin_other_inc",  label:"Other Income",                budget:0 },
    ],
    expenseRows: [
      { id:"tin_alex",       label:"Alex — Salary",               budget:5000 },
      { id:"tin_transfer",   label:"Transfer to Personal (Loan 1)", budget:10000 },
      { id:"tin_other_exp",  label:"Other Expenses",              budget:0 },
    ],
  },
};

// ── ACTIVE ROWS WITH FY LOGIC ─────────────────────────────────────────────────
function getActiveRows(fy, type) {
  const rows = type==="income" ? ALL_INCOME_ROWS : ALL_EXPENSE_ROWS;
  const fyYear = parseInt(fy.split("-")[0]);
  return rows.map(r => {
    if(type==="expense" && r.id==="emi1"    && fyYear>=2026) return {...r, budget:0, note:"Closed Dec 2026"};
    if(type==="income"  && r.id==="tin_huf" && fyYear>=2026) return {...r, budget:0, note:"Ended — Loan 1 closed"};
    if(type==="income"  && r.id==="rental"  && fyYear>=2026) return {...r, budget:15000};
    return r;
  });
}

// ── BUILD ACTUALS ─────────────────────────────────────────────────────────────
function buildActuals(fy) {
  const months = getMonths(fy);
  const obj = {};
  [...getActiveRows(fy,"income"),...getActiveRows(fy,"expense")].forEach(r => {
    months.forEach(m => {
      if(r.id==="rental" && fy==="2025-26") {
        obj[`${r.id}_${m}`] = (m==="Feb-26"||m==="Mar-26") ? 15000 : 13750;
      } else if(r.id==="adhoc" || r.id==="day_maid" || r.id==="night_maid" || r.id==="other") {
        obj[`${r.id}_${m}`] = 0;
      } else {
        obj[`${r.id}_${m}`] = r.budget;
      }
    });
  });
  return obj;
}

function buildEntityActuals(entity) {
  const def = ENTITY_DEFS[entity];
  const obj = {};
  [...def.incomeRows,...def.expenseRows].forEach(r => {
    MONTHS_LABELS.forEach(m => { obj[`${r.id}_${m}`] = r.budget||0; });
  });
  return obj;
}

const INITIAL_FY_LIST = ["2025-26","2026-27"];
function buildInitialState() {
  const s = {};
  INITIAL_FY_LIST.forEach(fy => { s[fy] = buildActuals(fy); });
  return s;
}
function buildInitialEntityState() {
  const s = {};
  Object.keys(ENTITY_DEFS).forEach(e => { s[e] = buildEntityActuals(e); });
  return s;
}

// ── INITIAL GOALS & NET WORTH ─────────────────────────────────────────────────
const INITIAL_GOALS = [
  { id:"g1", name:"Emergency Fund",       target:200000, saved:15000, color:C.income,  deadline:"Mar-27", icon:"shield" },
  { id:"g2", name:"Loan 3 Prepayment",    target:100000, saved:0,     color:C.blue,    deadline:"Mar-27", icon:"bank" },
  { id:"g3", name:"Family Vacation",      target:75000,  saved:5000,  color:C.accent,  deadline:"Dec-26", icon:"plane" },
  { id:"g4", name:"Home Renovation Fund", target:150000, saved:0,     color:C.purple,  deadline:"Mar-28", icon:"home" },
];
const INITIAL_ASSETS = [
  { id:"a1", label:"Anand Prakash Flat (50% share)", value:2300000, type:"property" },
  { id:"a2", label:"Savings Account — Personal",      value:50000,   type:"cash" },
  { id:"a3", label:"TIN HUF Account",                 value:20000,   type:"cash" },
  { id:"a4", label:"SAM 7 Account",                   value:10000,   type:"cash" },
  { id:"a5", label:"Fixed Deposits / Investments",    value:0,       type:"investment" },
  { id:"a6", label:"Other Assets",                    value:0,       type:"other" },
];
const INITIAL_LIABILITIES = [
  { id:"l1", label:"IDFC Loan 1 Outstanding",          value:91775  },
  { id:"l2", label:"IDFC Loan 2 Outstanding",          value:116442 },
  { id:"l3", label:"IDFC Loan 3 Outstanding",          value:667169 },
  { id:"l4", label:"Home Loan Outstanding (Your 50%)", value:751674 },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const inr = n => "₹" + Number(n||0).toLocaleString("en-IN");
const mono = { fontFamily:"monospace" };
const lbl  = { fontFamily:"monospace", fontSize:10, letterSpacing:2, textTransform:"uppercase", color:C.dim };
function nextFY(fy) { const [a,b]=fy.split("-").map(Number); return `${a+1}-${String(b+1).padStart(2,"0")}`; }

function fyTotals(allActuals, fy) {
  const ms=getMonths(fy), act=allActuals[fy]||{};
  const iR=getActiveRows(fy,"income"), eR=getActiveRows(fy,"expense");
  const totalInc=ms.reduce((s,m)=>s+iR.reduce((ss,r)=>ss+(act[`${r.id}_${m}`]||0),0),0);
  const totalExp=ms.reduce((s,m)=>s+eR.reduce((ss,r)=>ss+(act[`${r.id}_${m}`]||0),0),0);
  return { totalInc, totalExp, net:totalInc-totalExp };
}

function entityTotals(entityActuals, entity) {
  const def=ENTITY_DEFS[entity], act=entityActuals[entity]||{};
  const totalInc=MONTHS_LABELS.reduce((s,m)=>s+def.incomeRows.reduce((ss,r)=>ss+(act[`${r.id}_${m}`]||0),0),0);
  const totalExp=MONTHS_LABELS.reduce((s,m)=>s+def.expenseRows.reduce((ss,r)=>ss+(act[`${r.id}_${m}`]||0),0),0);
  return { totalInc, totalExp, net:totalInc-totalExp };
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function NavTab({ text, active, onClick }) {
  return (
    <div onClick={onClick} style={{ padding:"12px 18px", fontFamily:"monospace", fontSize:10, letterSpacing:2, textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap", color:active?C.accent:C.muted, borderBottom:`2px solid ${active?C.accent:"transparent"}`, transition:"all 0.15s" }}>
      {text}
    </div>
  );
}

function KpiCard({ lbl:l, val, sub, color, delta }) {
  return (
    <div style={{ flex:1, minWidth:150, background:C.card, border:`1px solid ${C.border}`, borderTop:`3px solid ${color}`, borderRadius:8, padding:"18px 20px" }}>
      <div style={lbl}>{l}</div>
      <div style={{ fontFamily:"Georgia,serif", fontSize:22, fontWeight:800, color, marginTop:8, lineHeight:1 }}>{val}</div>
      {delta!==undefined && <div style={{ ...mono, fontSize:10, color:delta>=0?C.income:C.expense, marginTop:3 }}>{delta>=0?"▲":"▼"} {inr(Math.abs(delta))} vs prev yr</div>}
      <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>{sub}</div>
    </div>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, margin:"26px 0 14px" }}>
      <div style={{ fontFamily:"Georgia,serif", fontSize:16, fontWeight:700 }}>{title}</div>
      <div style={{ flex:1, height:1, background:C.border }} />
      {right}
    </div>
  );
}

function MiniBar({ lbl:l, amount, max, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
      <div style={{ width:185, fontSize:11, color:C.dim, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l}</div>
      <div style={{ flex:1, height:5, background:C.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${Math.min(100,Math.round((Math.max(0,amount)/Math.max(1,max))*100))}%`, height:"100%", background:color, borderRadius:3 }} />
      </div>
      <div style={{ ...mono, fontSize:11, color:C.text, width:84, textAlign:"right", flexShrink:0 }}>{inr(amount)}</div>
    </div>
  );
}

function EditCell({ value, onChange, color }) {
  const [editing,setEditing] = useState(false);
  const [draft,setDraft]     = useState("");
  const start  = () => { setDraft(String(value)); setEditing(true); };
  const commit = () => { const n=parseInt(draft.replace(/[^0-9]/g,""),10); if(!isNaN(n)) onChange(n); setEditing(false); };
  if(editing) return <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(false);}} style={{ width:76, background:"#0b0e18", border:`1px solid ${C.accent}`, borderRadius:3, color:C.accent, fontFamily:"monospace", fontSize:11, padding:"2px 4px", textAlign:"right", outline:"none" }} />;
  return <span onClick={start} title="Click to edit" style={{ ...mono, fontSize:11, color:color||C.text, cursor:"pointer", borderBottom:`1px dashed ${C.border}`, paddingBottom:1 }}>{inr(value)}</span>;
}

function EditNum({ value, onChange, color }) {
  const [editing,setEditing] = useState(false);
  const [draft,setDraft]     = useState("");
  const start  = () => { setDraft(String(value)); setEditing(true); };
  const commit = () => { const n=parseInt(draft.replace(/[^0-9]/g,""),10); if(!isNaN(n)) onChange(n); setEditing(false); };
  if(editing) return <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(false);}} style={{ width:100, background:"#0b0e18", border:`1px solid ${C.accent}`, borderRadius:3, color:C.accent, fontFamily:"monospace", fontSize:12, padding:"3px 6px", textAlign:"right", outline:"none" }} />;
  return <span onClick={start} style={{ ...mono, fontSize:13, color:color||C.text, cursor:"pointer", borderBottom:`1px dashed ${C.border}` }}>{inr(value)}</span>;
}

const CustomTooltip = ({ active, payload, label:l }) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"10px 14px", fontFamily:"monospace", fontSize:11 }}>
      <div style={{ color:C.dim, marginBottom:5 }}>{l}</div>
      {payload.map((p,i)=><div key={i} style={{ color:p.color, marginBottom:2 }}>{p.name}: {inr(p.value)}</div>)}
    </div>
  );
};

const btnStyle = rgb => ({ background:`rgba(${rgb},0.12)`, border:`1px solid rgba(${rgb},0.3)`, color:`rgb(${rgb})`, fontFamily:"monospace", fontSize:11, padding:"8px 14px", borderRadius:4, cursor:"pointer", letterSpacing:0.5, display:"inline-flex", alignItems:"center", gap:6 });

// ── TRACKER TABLE (reusable for personal + entities) ──────────────────────────
function TrackerTable({ incomeRows, expenseRows, actuals, setActual, months, label }) {
  const th = { fontFamily:"monospace", fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:C.dim, padding:"7px 9px", textAlign:"right", background:C.surface, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" };
  const td = { padding:"7px 9px", borderBottom:`1px solid ${C.border}22` };

  const monthInc  = m => incomeRows.reduce((s,r)=>s+(actuals[`${r.id}_${m}`]||0),0);
  const monthExp  = m => expenseRows.reduce((s,r)=>s+(actuals[`${r.id}_${m}`]||0),0);
  const totalInc  = months.reduce((s,m)=>s+monthInc(m),0);
  const totalExp  = months.reduce((s,m)=>s+monthExp(m),0);

  const renderRows = (rows, isExp) => rows.map((row,ri) => {
    const fyT = months.reduce((s,m)=>s+(actuals[`${row.id}_${m}`]||0),0);
    const avgA = Math.round(fyT/12);
    const vari = isExp ? row.budget-avgA : avgA-row.budget;
    const isBizPays = !!row.bizPays;
    const isClosed  = row.budget===0 && row.note && row.note.includes("Closed");

    return (
      <tr key={row.id} style={{ background:ri%2===0?"transparent":"rgba(255,255,255,0.01)", opacity:isClosed?0.4:1 }}>
        <td style={{ ...td, fontSize:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span>{row.label}</span>
            {isBizPays && <span style={{ ...mono, fontSize:9, color:C.blue, background:"rgba(107,156,245,.12)", padding:"1px 7px", borderRadius:3, flexShrink:0 }}>{row.bizPays} pays</span>}
            {isClosed   && <span style={{ ...mono, fontSize:9, color:C.income, background:"rgba(62,207,142,.1)", padding:"1px 6px", borderRadius:3, flexShrink:0 }}>CLOSED</span>}
          </div>
          {row.note && <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{row.note}</div>}
        </td>
        <td style={{ ...td, ...mono, fontSize:11, textAlign:"right", color:C.dim }}>{inr(row.budget)}</td>
        {months.map(m=>(
          <td key={m} style={{ ...td, textAlign:"right" }}>
            {isBizPays
              ? <span style={{ ...mono, fontSize:10, color:C.blue }}>biz</span>
              : <EditCell value={actuals[`${row.id}_${m}`]||0} onChange={v=>setActual(row.id,m,v)} color={isExp?C.expense:C.income} />
            }
          </td>
        ))}
        <td style={{ ...td, ...mono, fontSize:11, textAlign:"right", color:C.accent, fontWeight:700 }}>{isBizPays?"—":inr(fyT)}</td>
        <td style={{ ...td, ...mono, fontSize:11, textAlign:"right", color:vari>=0?C.income:C.expense }}>{isBizPays?"—":(vari>=0?"+":"")+inr(vari)}</td>
      </tr>
    );
  });

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign:"left", minWidth:220 }}>Line Item</th>
            <th style={{ ...th, minWidth:78 }}>Budget</th>
            {months.map(m=><th key={m} style={th}>{m}</th>)}
            <th style={{ ...th, color:C.accent }}>FY Total</th>
            <th style={{ ...th, color:C.blue }}>Var/mo</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ background:C.surface }}><td colSpan={months.length+4} style={{ ...td, ...mono, fontSize:9, letterSpacing:2, color:C.muted, textTransform:"uppercase" }}>── Income ──</td></tr>
          {renderRows(incomeRows, false)}
          <tr style={{ background:"rgba(232,184,75,.05)" }}>
            <td style={{ ...td, ...mono, fontSize:12, color:C.accent, fontWeight:700 }}>TOTAL INCOME</td>
            <td style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.accent, fontWeight:700 }}>{inr(incomeRows.reduce((s,r)=>s+r.budget,0))}</td>
            {months.map(m=><td key={m} style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.accent, fontWeight:700 }}>{inr(monthInc(m))}</td>)}
            <td style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.accent, fontWeight:700 }}>{inr(totalInc)}</td><td/>
          </tr>
          <tr style={{ background:C.surface }}><td colSpan={months.length+4} style={{ ...td, ...mono, fontSize:9, letterSpacing:2, color:C.muted, textTransform:"uppercase" }}>── Expenses ──</td></tr>
          {renderRows(expenseRows, true)}
          <tr style={{ background:"rgba(224,108,108,.05)" }}>
            <td style={{ ...td, ...mono, fontSize:12, color:C.expense, fontWeight:700 }}>TOTAL EXPENSES</td>
            <td style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.expense, fontWeight:700 }}>{inr(expenseRows.reduce((s,r)=>s+r.budget,0))}</td>
            {months.map(m=><td key={m} style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.expense, fontWeight:700 }}>{inr(monthExp(m))}</td>)}
            <td style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.expense, fontWeight:700 }}>{inr(totalExp)}</td><td/>
          </tr>
          <tr style={{ background:"rgba(62,207,142,.05)" }}>
            <td style={{ ...td, ...mono, fontSize:13, color:C.income, fontWeight:800 }}>NET</td>
            <td style={{ ...td, ...mono, fontSize:13, textAlign:"right", color:C.income, fontWeight:800 }}>{inr(incomeRows.reduce((s,r)=>s+r.budget,0)-expenseRows.reduce((s,r)=>s+r.budget,0))}</td>
            {months.map(m=>{ const n=monthInc(m)-monthExp(m); return <td key={m} style={{ ...td, ...mono, fontSize:13, textAlign:"right", color:n>=0?C.income:C.expense, fontWeight:800 }}>{n>=0?"+":""}{inr(n)}</td>; })}
            <td style={{ ...td, ...mono, fontSize:13, textAlign:"right", color:(totalInc-totalExp)>=0?C.income:C.expense, fontWeight:800 }}>{(totalInc-totalExp)>=0?"+":""}{inr(totalInc-totalExp)}</td><td/>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [fyList,setFyList]           = useState(INITIAL_FY_LIST);
  const [allActuals,setAllActuals]   = useState(buildInitialState);
  const [entityActuals,setEntityActuals] = useState(buildInitialEntityState);
  const [activeFY,setActiveFY]       = useState("2025-26");
  const [activeEntity,setActiveEntity] = useState("NMC");
  const [tab,setTab]                 = useState("overview");
  const [importStatus,setImportStatus] = useState("");
  const [assets,setAssets]           = useState(INITIAL_ASSETS);
  const [liabilities,setLiabilities] = useState(INITIAL_LIABILITIES);
  const [goals,setGoals]             = useState(INITIAL_GOALS);
  const [newGoal,setNewGoal]         = useState({ name:"", target:"", saved:"", deadline:"" });
  const [showAddGoal,setShowAddGoal] = useState(false);

  const months      = useMemo(()=>getMonths(activeFY),[activeFY]);
  const incomeRows  = useMemo(()=>getActiveRows(activeFY,"income"),[activeFY]);
  const expenseRows = useMemo(()=>getActiveRows(activeFY,"expense"),[activeFY]);
  const actuals     = allActuals[activeFY]||{};

  const setActual = useCallback((id,month,val)=>{
    setAllActuals(prev=>({...prev,[activeFY]:{...prev[activeFY],[`${id}_${month}`]:val}}));
  },[activeFY]);

  const setEntityActual = useCallback((entity,id,month,val)=>{
    setEntityActuals(prev=>({...prev,[entity]:{...prev[entity],[`${id}_${month}`]:val}}));
  },[]);

  function monthTotals(fy,month) {
    const act=allActuals[fy]||{};
    const inc=getActiveRows(fy,"income").reduce((s,r)=>s+(act[`${r.id}_${month}`]||0),0);
    const exp=getActiveRows(fy,"expense").reduce((s,r)=>s+(act[`${r.id}_${month}`]||0),0);
    return { inc, exp, net:inc-exp };
  }

  function addYear() {
    const last=fyList[fyList.length-1], newFY=nextFY(last);
    if(fyList.includes(newFY)) return;
    setFyList(prev=>[...prev,newFY]);
    setAllActuals(prev=>({...prev,[newFY]:buildActuals(newFY)}));
    setActiveFY(newFY); setTab("overview");
  }

  const totalAssets      = assets.reduce((s,a)=>s+a.value,0);
  const totalLiabilities = liabilities.reduce((s,l)=>s+l.value,0);
  const netWorth         = totalAssets-totalLiabilities;
  const { net:fyNet }    = fyTotals(allActuals,activeFY);
  const avgMonthlyNet    = Math.round(fyNet/12);

  // ── EXPORT ──────────────────────────────────────────────────────────────────
  function exportToExcel() {
    const wb = XLSX.utils.book_new();
    fyList.forEach(fy=>{
      const ms=getMonths(fy), iR=getActiveRows(fy,"income"), eR=getActiveRows(fy,"expense"), act=allActuals[fy]||{};
      const data=[[`SAMPATH PERSONAL CASH FLOW — FY ${fy}`]];
      data.push(["Line Item",...ms,"FY Total","Budget/mo"]);
      data.push(["── INCOME ──"]);
      iR.forEach(r=>{ const vals=ms.map(m=>act[`${r.id}_${m}`]||0); data.push([r.label,...vals,vals.reduce((a,b)=>a+b,0),r.budget]); });
      data.push(["TOTAL INCOME",...ms.map(m=>iR.reduce((s,r)=>s+(act[`${r.id}_${m}`]||0),0))]);
      data.push(["── EXPENSES ──"]);
      eR.forEach(r=>{ const vals=ms.map(m=>act[`${r.id}_${m}`]||0); data.push([r.label,...vals,vals.reduce((a,b)=>a+b,0),r.budget]); });
      data.push(["TOTAL EXPENSES",...ms.map(m=>eR.reduce((s,r)=>s+(act[`${r.id}_${m}`]||0),0))]);
      const ws=XLSX.utils.aoa_to_sheet(data); ws["!cols"]=[{wch:36},...ms.map(()=>({wch:10})),{wch:12},{wch:10}];
      XLSX.utils.book_append_sheet(wb,ws,`FY ${fy}`);
    });
    Object.keys(ENTITY_DEFS).forEach(entity=>{
      const def=ENTITY_DEFS[entity], act=entityActuals[entity]||{};
      const data=[[`${def.fullName} — FY 2025-26`],["Line Item",...MONTHS_LABELS,"Total","Budget"]];
      data.push(["── INCOME ──"]);
      def.incomeRows.forEach(r=>{ const vals=MONTHS_LABELS.map(m=>act[`${r.id}_${m}`]||0); data.push([r.label,...vals,vals.reduce((a,b)=>a+b,0),r.budget]); });
      data.push(["── EXPENSES ──"]);
      def.expenseRows.forEach(r=>{ const vals=MONTHS_LABELS.map(m=>act[`${r.id}_${m}`]||0); data.push([r.label,...vals,vals.reduce((a,b)=>a+b,0),r.budget]); });
      const ws=XLSX.utils.aoa_to_sheet(data); ws["!cols"]=[{wch:34},...MONTHS_LABELS.map(()=>({wch:9})),{wch:12},{wch:10}];
      XLSX.utils.book_append_sheet(wb,ws,entity);
    });
    XLSX.writeFile(wb,`Sampath_Finance_v5_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  // ── IMPORT ──────────────────────────────────────────────────────────────────
  function importFromExcel(e) {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try {
        const wb=XLSX.read(ev.target.result,{type:"binary"}); let imported=0;
        const newAllActuals={...allActuals};
        wb.SheetNames.forEach(name=>{
          const fy=name.replace("FY ","").trim();
          if(!/^\d{4}-\d{2,4}$/.test(fy)) return;
          const ws=wb.Sheets[name], rows=XLSX.utils.sheet_to_json(ws,{header:1});
          const headerIdx=rows.findIndex(r=>r[0]==="Line Item"); if(headerIdx===-1) return;
          const headers=rows[headerIdx], ms=getMonths(fy), monthCols=ms.map(m=>headers.indexOf(m));
          const newAct=newAllActuals[fy]?{...newAllActuals[fy]}:buildActuals(fy);
          const allRows=[...getActiveRows(fy,"income"),...getActiveRows(fy,"expense")];
          rows.slice(headerIdx+1).forEach(row=>{ const matched=allRows.find(r=>r.label===row[0]); if(matched) ms.forEach((m,mi)=>{ const ci=monthCols[mi]; if(ci!==-1&&row[ci]!==undefined){ const v=parseInt(row[ci],10); if(!isNaN(v)) newAct[`${matched.id}_${m}`]=v; }}); });
          newAllActuals[fy]=newAct; if(!fyList.includes(fy)) setFyList(prev=>[...prev,fy].sort()); imported++;
        });
        setAllActuals(newAllActuals); setImportStatus(`Imported ${imported} year(s)`); setTimeout(()=>setImportStatus(""),3000);
      } catch(err) { setImportStatus("Error: "+err.message); }
    };
    reader.readAsBinaryString(file); e.target.value="";
  }

  // ── PANEL: OVERVIEW ─────────────────────────────────────────────────────────
  function OverviewPanel() {
    const chartData=months.map(m=>{ const t=monthTotals(activeFY,m); return { month:m.slice(0,3), Income:t.inc, Expenses:t.exp, Net:t.net }; });
    const { totalInc, totalExp } = fyTotals(allActuals,activeFY);
    const pieColors=[C.income,"#2ea86e",C.blue,"#5a8de0",C.accent,C.teal];

    // Entity summary
    const entitySummary = Object.keys(ENTITY_DEFS).map(e=>({ name:e, ...entityTotals(entityActuals,e), color:ENTITY_DEFS[e].color }));

    return (
      <div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          <KpiCard lbl="FY Total Income"   val={inr(totalInc)}  sub={`FY ${activeFY}`} color={C.income} />
          <KpiCard lbl="FY Total Expenses" val={inr(totalExp)}  sub={`FY ${activeFY}`} color={C.expense} />
          <KpiCard lbl="FY Net Surplus"    val={(fyNet>=0?"+":"")+inr(fyNet)} sub={`FY ${activeFY}`} color={C.accent} />
          <KpiCard lbl="Avg Monthly Net"   val={(avgMonthlyNet>=0?"+":"")+inr(avgMonthlyNet)} sub="per month" color={avgMonthlyNet>=0?C.income:C.expense} />
          <KpiCard lbl="Net Worth"         val={(netWorth>=0?"+":"")+inr(netWorth)} sub="assets minus liabilities" color={C.blue} />
        </div>

        <SectionHeader title={`Monthly Cash Flow — FY ${activeFY}`} />
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22 }}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:10, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:C.muted, fontSize:10, fontFamily:"monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+v/1000+"k"} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize:11, fontFamily:"monospace" }} />
              <Bar dataKey="Income"   fill={C.income}  radius={[3,3,0,0]} fillOpacity={0.85} />
              <Bar dataKey="Expenses" fill={C.expense} radius={[3,3,0,0]} fillOpacity={0.75} />
              <Bar dataKey="Net"      fill={C.accent}  radius={[3,3,0,0]} fillOpacity={0.9} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Entity Summary Cards */}
        <SectionHeader title="Business Entities — FY Summary" right={<span style={{ ...mono, fontSize:10, color:C.muted }}>Edit in Entities tab</span>} />
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          {entitySummary.map(e=>(
            <div key={e.name} onClick={()=>{ setActiveEntity(e.name); setTab("entities"); }}
              style={{ flex:1, minWidth:180, background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${e.color}`, borderRadius:8, padding:"16px 20px", cursor:"pointer" }}>
              <div style={{ ...mono, fontSize:10, color:e.color, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>{e.name}</div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.dim, marginBottom:4 }}>
                <span>Income</span><span style={{ color:C.income, ...mono }}>{inr(e.totalInc)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.dim, marginBottom:8 }}>
                <span>Expenses</span><span style={{ color:C.expense, ...mono }}>{inr(e.totalExp)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, ...mono, fontSize:13 }}>
                <span style={{ color:C.dim }}>Net</span>
                <span style={{ color:e.net>=0?C.income:C.expense }}>{e.net>=0?"+":""}{inr(e.net)}</span>
              </div>
            </div>
          ))}
        </div>

        <SectionHeader title="Income & Expense Breakdown" />
        <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:260 }}>
            <div style={{ ...lbl, marginBottom:14 }}>Income Sources (avg/mo)</div>
            {incomeRows.map((r,i)=>{ const avg=Math.round(months.reduce((s,m)=>s+(actuals[`${r.id}_${m}`]||0),0)/12); return avg>0&&<MiniBar key={r.id} lbl={r.label} amount={avg} max={25000} color={pieColors[i%pieColors.length]} />; })}
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:260 }}>
            <div style={{ ...lbl, marginBottom:14 }}>Expenses (avg/mo)</div>
            {expenseRows.filter(r=>!r.bizPays).map(r=>{ const avg=Math.round(months.reduce((s,m)=>s+(actuals[`${r.id}_${m}`]||0),0)/12); return avg>0&&<MiniBar key={r.id} lbl={r.label} amount={avg} max={13000} color={C.expense} />; })}
          </div>
        </div>

        <div style={{ background:"linear-gradient(135deg,rgba(232,184,75,.07),rgba(62,207,142,.04))", border:"1px solid rgba(232,184,75,.2)", borderRadius:8, padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:22, flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:15, color:C.muted }}>FY {activeFY} Net Surplus</div>
            <div style={{ fontSize:11, color:C.accent, marginTop:5 }}>{activeFY==="2025-26"?"Loans 1 & 2 offset by TIN HUF + SAM 7 — effective burden ₹24,467/mo":"Loan 1 closed — saving ₹9,177/mo from Jan 2027"}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:38, fontWeight:900, color:fyNet>=0?C.income:C.expense }}>{fyNet>=0?"+":""}{inr(fyNet)}</div>
            <div style={{ fontSize:11, color:C.dim }}>approx {inr(avgMonthlyNet)} per month</div>
          </div>
        </div>
      </div>
    );
  }

  // ── PANEL: TRACKER ──────────────────────────────────────────────────────────
  function TrackerPanel() {
    return (
      <div>
        <SectionHeader title={`Monthly Tracker — FY ${activeFY}`} right={<span style={{ ...mono, fontSize:10, color:C.muted }}>Click any value to edit</span>} />
        <TrackerTable incomeRows={incomeRows} expenseRows={expenseRows} actuals={actuals} setActual={setActual} months={months} />
        <div style={{ marginTop:12, background:"rgba(232,184,75,.05)", borderLeft:`3px solid ${C.accent}`, padding:"9px 14px", fontSize:11, color:C.muted, lineHeight:1.6, borderRadius:"0 4px 4px 0" }}>
          Adhoc income: fill in the month you receive it — leaves as 0 otherwise.
          Day Maid (SAM 7) and Night Maid (NMC) show as business-paid — they don't hit your personal cash.
          Rental: ₹13,750 Apr-25 to Jan-26, then ₹15,000 from Feb-26.
        </div>
      </div>
    );
  }

  // ── PANEL: ENTITIES ─────────────────────────────────────────────────────────
  function EntitiesPanel() {
    const def = ENTITY_DEFS[activeEntity];
    const act = entityActuals[activeEntity]||{};
    const setAct = (id,m,v) => setEntityActual(activeEntity,id,m,v);
    const { totalInc, totalExp, net } = entityTotals(entityActuals,activeEntity);

    return (
      <div>
        {/* Entity switcher */}
        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
          {Object.keys(ENTITY_DEFS).map(e=>(
            <button key={e} onClick={()=>setActiveEntity(e)}
              style={{ padding:"10px 20px", fontFamily:"monospace", fontSize:11, cursor:"pointer", borderRadius:6, fontWeight:activeEntity===e?700:400,
                background:activeEntity===e?`${ENTITY_DEFS[e].color}22`:"transparent",
                border:`1px solid ${activeEntity===e?ENTITY_DEFS[e].color:C.border}`,
                color:activeEntity===e?ENTITY_DEFS[e].color:C.muted }}>
              {e}
            </button>
          ))}
        </div>

        {/* Entity KPIs */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:24 }}>
          <KpiCard lbl={`${activeEntity} — Total Income`}   val={inr(totalInc)} sub="FY 2025-26" color={def.color} />
          <KpiCard lbl={`${activeEntity} — Total Expenses`} val={inr(totalExp)} sub="FY 2025-26" color={C.expense} />
          <KpiCard lbl={`${activeEntity} — Net`}            val={(net>=0?"+":"")+inr(net)} sub="FY 2025-26" color={net>=0?C.income:C.expense} />
          <KpiCard lbl="Avg Monthly Net" val={(Math.round(net/12)>=0?"+":"")+inr(Math.round(net/12))} sub="per month" color={C.dim} />
        </div>

        <SectionHeader title={`${def.fullName} — Monthly Tracker`} right={<span style={{ ...mono, fontSize:10, color:C.muted }}>Click any value to edit</span>} />
        <TrackerTable
          incomeRows={def.incomeRows}
          expenseRows={def.expenseRows}
          actuals={act}
          setActual={setAct}
          months={MONTHS_LABELS}
        />

        {/* Entity-specific notes */}
        <div style={{ marginTop:14, background:`${def.color}08`, borderLeft:`3px solid ${def.color}`, padding:"10px 16px", fontSize:11, color:C.dim, borderRadius:"0 4px 4px 0", lineHeight:1.7 }}>
          {activeEntity==="NMC" && "NMC pays Night Maid salary (personal benefit) and contributes to house help and society charges. Alex salary: ₹5,000/mo."}
          {activeEntity==="SAM 7" && "SAM 7 reimburses Loan 2 EMI (₹10,000/mo) to personal account. Also pays Day Maid salary (personal benefit). Alex salary: ₹10,000/mo."}
          {activeEntity==="TIN HUF" && "TIN HUF receives ₹10,000 cash deposit monthly from the ₹25k customer cash. Transfers ₹10,000 back to personal account to fund Loan 1 EMI (₹9,177). ₹823 surplus stays in HUF. Alex salary: ₹5,000/mo."}
        </div>
      </div>
    );
  }

  // ── PANEL: NET WORTH ────────────────────────────────────────────────────────
  function NetWorthPanel() {
    const updateAsset = (id,val) => setAssets(prev=>prev.map(a=>a.id===id?{...a,value:val}:a));
    const updateLiab  = (id,val) => setLiabilities(prev=>prev.map(l=>l.id===id?{...l,value:val}:l));
    const assetColors = { property:C.blue, cash:C.income, investment:C.accent, other:C.dim };
    const pieData = assets.filter(a=>a.value>0).map(a=>({ name:a.label, value:a.value, color:assetColors[a.type] }));
    const nwProjection = Array.from({length:13},(_,i)=>({ month:i===0?"Now":`M+${i*2}`, "Net Worth":netWorth+(avgMonthlyNet*i*2) }));

    return (
      <div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          <KpiCard lbl="Total Assets"      val={inr(totalAssets)}      sub="click values to update" color={C.income} />
          <KpiCard lbl="Total Liabilities" val={inr(totalLiabilities)} sub="all loans"              color={C.expense} />
          <KpiCard lbl="Net Worth"         val={(netWorth>=0?"+":"")+inr(netWorth)} sub="assets minus liabilities" color={netWorth>=0?C.blue:C.expense} />
          <KpiCard lbl="Debt-to-Asset"     val={Math.round((totalLiabilities/Math.max(totalAssets,1))*100)+"%" } sub="lower is better" color={C.accent} />
        </div>
        <div style={{ display:"flex", gap:18, flexWrap:"wrap", marginTop:24 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:280 }}>
            <div style={{ ...lbl, marginBottom:16, color:C.income }}>Assets — Click to Edit</div>
            {assets.map(a=>(
              <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.border}22` }}>
                <div><div style={{ fontSize:12 }}>{a.label}</div><div style={{ ...mono, fontSize:9, color:C.dim, textTransform:"uppercase" }}>{a.type}</div></div>
                <EditNum value={a.value} onChange={v=>updateAsset(a.id,v)} color={C.income} />
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", ...mono, fontSize:14, color:C.income, fontWeight:700, borderTop:`1px solid ${C.border}`, marginTop:8 }}>
              <span>TOTAL ASSETS</span><span>{inr(totalAssets)}</span>
            </div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:280 }}>
            <div style={{ ...lbl, marginBottom:16, color:C.expense }}>Liabilities — Click to Edit</div>
            {liabilities.map(l=>(
              <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.border}22` }}>
                <div style={{ fontSize:12 }}>{l.label}</div>
                <EditNum value={l.value} onChange={v=>updateLiab(l.id,v)} color={C.expense} />
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", ...mono, fontSize:14, color:C.expense, fontWeight:700, borderTop:`1px solid ${C.border}`, marginTop:8 }}>
              <span>TOTAL LIABILITIES</span><span>{inr(totalLiabilities)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", ...mono, fontSize:16, color:netWorth>=0?C.blue:C.expense, fontWeight:900 }}>
              <span>NET WORTH</span><span>{netWorth>=0?"+":""}{inr(netWorth)}</span>
            </div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:200 }}>
            <div style={{ ...lbl, marginBottom:12 }}>Asset Mix</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((entry,i)=><Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={v=>inr(v)} contentStyle={{ background:C.card, border:`1px solid ${C.border}`, fontFamily:"monospace", fontSize:11 }} />
              </PieChart>
            </ResponsiveContainer>
            {pieData.map((d,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:7, fontSize:10, color:C.dim, marginBottom:3 }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:d.color, display:"inline-block", flexShrink:0 }} />
                <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</span>
                <span style={{ ...mono, color:C.text, fontSize:10 }}>{inr(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
        <SectionHeader title="Net Worth Projection (24 months at current surplus)" />
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22 }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={nwProjection}>
              <defs><linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.3}/><stop offset="95%" stopColor={C.blue} stopOpacity={0.02}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:10, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:C.muted, fontSize:10, fontFamily:"monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+(v/100000).toFixed(1)+"L"} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Net Worth" stroke={C.blue} strokeWidth={2} fill="url(#nwGrad)" dot={{ r:3, fill:C.blue }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ── PANEL: GOALS ────────────────────────────────────────────────────────────
  function GoalsPanel() {
    const updateSaved  = (id,val) => setGoals(prev=>prev.map(g=>g.id===id?{...g,saved:Math.min(val,g.target)}:g));
    const updateTarget = (id,val) => setGoals(prev=>prev.map(g=>g.id===id?{...g,target:val}:g));
    const deleteGoal   = (id)     => setGoals(prev=>prev.filter(g=>g.id!==id));
    const addGoal = () => {
      if(!newGoal.name||!newGoal.target) return;
      setGoals(prev=>[...prev,{ id:"g"+Date.now(), name:newGoal.name, target:parseInt(newGoal.target)||0, saved:parseInt(newGoal.saved)||0, deadline:newGoal.deadline||"Mar-27", color:C.teal }]);
      setNewGoal({ name:"", target:"", saved:"", deadline:"" }); setShowAddGoal(false);
    };
    return (
      <div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          <KpiCard lbl="Active Goals"    val={goals.length}  sub="tracking"         color={C.accent} />
          <KpiCard lbl="Total Target"    val={inr(goals.reduce((s,g)=>s+g.target,0))} sub="combined"  color={C.blue} />
          <KpiCard lbl="Total Saved"     val={inr(goals.reduce((s,g)=>s+g.saved,0))}  sub="so far"    color={C.income} />
          <KpiCard lbl="Monthly Surplus" val={(avgMonthlyNet>=0?"+":"")+inr(avgMonthlyNet)} sub="to allocate" color={avgMonthlyNet>=0?C.income:C.expense} />
        </div>
        <SectionHeader title="Savings Goals" right={<button onClick={()=>setShowAddGoal(!showAddGoal)} style={btnStyle("167,139,250")}>+ Add Goal</button>} />
        {showAddGoal && (
          <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:8, padding:20, marginBottom:20 }}>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {[["Goal Name","name",200],["Target","target",120],["Saved so far","saved",120],["Deadline","deadline",100]].map(([label2,key,w])=>(
                <div key={key}>
                  <div style={{ ...lbl, marginBottom:5 }}>{label2}</div>
                  <input value={newGoal[key]} onChange={e=>setNewGoal(p=>({...p,[key]:e.target.value}))} style={{ width:w, background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, fontFamily:"monospace", fontSize:12, padding:"6px 10px", outline:"none" }} />
                </div>
              ))}
              <div style={{ alignSelf:"flex-end" }}><button onClick={addGoal} style={btnStyle("62,207,142")}>Save</button></div>
            </div>
          </div>
        )}
        <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
          {goals.map(g=>{
            const pct=Math.min(100,Math.round((g.saved/Math.max(g.target,1))*100));
            const remain=g.target-g.saved;
            const months2=avgMonthlyNet>0?Math.ceil(remain/avgMonthlyNet):null;
            return (
              <div key={g.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${g.color}`, borderRadius:8, padding:20, flex:1, minWidth:240, position:"relative" }}>
                <button onClick={()=>deleteGoal(g.id)} style={{ position:"absolute", top:12, right:12, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>x</button>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{g.name}</div>
                <div style={{ ...mono, fontSize:10, color:C.dim, marginBottom:14 }}>Deadline: {g.deadline}</div>
                <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:g.color, borderRadius:3 }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", ...mono, fontSize:10, color:C.dim, marginBottom:14 }}>
                  <span style={{ color:g.color, fontWeight:700 }}>{pct}% done</span><span>{inr(remain)} to go</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div><div style={{ ...lbl, marginBottom:3 }}>Saved</div><EditNum value={g.saved} onChange={v=>updateSaved(g.id,v)} color={g.color} /></div>
                  <div style={{ textAlign:"right" }}><div style={{ ...lbl, marginBottom:3 }}>Target</div><EditNum value={g.target} onChange={v=>updateTarget(g.id,v)} color={C.dim} /></div>
                </div>
                {months2!==null && (
                  <div style={{ marginTop:12, padding:"7px 12px", background:`${g.color}11`, borderRadius:4, ...mono, fontSize:10, color:g.color }}>
                    {pct>=100?"Goal Reached!":`At ${inr(avgMonthlyNet)}/mo surplus, ~${months2} months to go`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── PANEL: FORECAST ─────────────────────────────────────────────────────────
  function ForecastPanel() {
    const [openingBal,setOpeningBal] = useState(50000);
    const [extraSaving,setExtraSaving] = useState(0);
    const forecastData = useMemo(()=>{
      const data=[]; let balance=openingBal;
      const today=new Date();
      for(let i=0;i<18;i++){
        const d=new Date(today.getFullYear(),today.getMonth()+i,1);
        const monthLabel=d.toLocaleString("en-IN",{month:"short",year:"2-digit"});
        const loan1Active=(d<new Date(2027,0,1));
        const rent=(d>=new Date(2026,1,1))?15000:13750;
        const inc=rent+25000+10000+(loan1Active?10000:0)+10000;
        const exp=(loan1Active?9177:0)+9704+11503+12964+1000+10000+6000+extraSaving;
        const net=inc-exp; balance+=net;
        data.push({ month:monthLabel, "Monthly Net":net, "Bank Balance":balance, Income:inc, Expenses:exp });
      }
      return data;
    },[openingBal,extraSaving]);

    return (
      <div>
        <SectionHeader title="18-Month Cash Flow Forecast" />
        <div style={{ display:"flex", gap:18, flexWrap:"wrap", marginBottom:24 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, flex:1, minWidth:200 }}>
            <div style={{ ...lbl, marginBottom:8 }}>Opening Bank Balance</div>
            <EditNum value={openingBal} onChange={setOpeningBal} color={C.income} />
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, flex:1, minWidth:200 }}>
            <div style={{ ...lbl, marginBottom:8 }}>Extra Monthly Saving</div>
            <EditNum value={extraSaving} onChange={setExtraSaving} color={C.accent} />
          </div>
          <div style={{ background:"rgba(62,207,142,.07)", border:"1px solid rgba(62,207,142,.2)", borderRadius:8, padding:20, flex:1, minWidth:200 }}>
            <div style={{ ...lbl, marginBottom:8, color:C.income }}>Loan 1 Closes Dec 2026</div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:22, color:C.income, fontWeight:800 }}>+₹9,177/mo</div>
            <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>Balance jumps from Jan 2027</div>
          </div>
          <div style={{ background:"rgba(232,184,75,.07)", border:"1px solid rgba(232,184,75,.2)", borderRadius:8, padding:20, flex:1, minWidth:200 }}>
            <div style={{ ...lbl, marginBottom:8, color:C.accent }}>Rent Increase Feb-26</div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:22, color:C.accent, fontWeight:800 }}>+₹1,250/mo</div>
            <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>₹13,750 to ₹15,000 from Feb-26</div>
          </div>
        </div>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, marginBottom:20 }}>
          <div style={{ ...lbl, marginBottom:14 }}>Projected Bank Balance — 18 Months</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecastData}>
              <defs><linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.income} stopOpacity={0.3}/><stop offset="95%" stopColor={C.income} stopOpacity={0.02}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:C.muted, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+(v/1000).toFixed(0)+"k"} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Bank Balance" stroke={C.income} strokeWidth={2.5} fill="url(#balGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <SectionHeader title="Month-by-Month Table" />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["Month","Income","Expenses","Monthly Net","Bank Balance"].map(h=>(
                <th key={h} style={{ ...mono, fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:C.dim, padding:"7px 12px", textAlign:h==="Month"?"left":"right", background:C.surface, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {forecastData.map((row,i)=>(
                <tr key={i} style={{ background:i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                  <td style={{ padding:"7px 12px", fontSize:12, ...mono }}>{row.month}</td>
                  <td style={{ padding:"7px 12px", ...mono, fontSize:11, textAlign:"right", color:C.income }}>{inr(row.Income)}</td>
                  <td style={{ padding:"7px 12px", ...mono, fontSize:11, textAlign:"right", color:C.expense }}>{inr(row.Expenses)}</td>
                  <td style={{ padding:"7px 12px", ...mono, fontSize:11, textAlign:"right", color:row["Monthly Net"]>=0?C.accent:C.expense, fontWeight:600 }}>{row["Monthly Net"]>=0?"+":""}{inr(row["Monthly Net"])}</td>
                  <td style={{ padding:"7px 12px", ...mono, fontSize:11, textAlign:"right", color:row["Bank Balance"]>=0?C.income:C.expense, fontWeight:700 }}>{inr(row["Bank Balance"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────────────────────────
  const TABS = [
    { id:"overview",  label:"Overview" },
    { id:"tracker",   label:"Monthly Tracker" },
    { id:"entities",  label:"Entities — NMC / SAM 7 / TIN HUF" },
    { id:"networth",  label:"Net Worth" },
    { id:"goals",     label:"Savings Goals" },
    { id:"forecast",  label:"Forecast" },
  ];

  const panels = { overview:<OverviewPanel/>, tracker:<TrackerPanel/>, entities:<EntitiesPanel/>, networth:<NetWorthPanel/>, goals:<GoalsPanel/>, forecast:<ForecastPanel/> };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${C.surface} 0%,#161926 100%)`, borderBottom:`1px solid ${C.border}`, padding:"22px 40px 18px", display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:14 }}>
        <div>
          <div style={{ fontFamily:"Georgia,serif", fontSize:24, fontWeight:800 }}>Sampath <span style={{ color:C.accent }}>Krishnaswamy Iyengar</span></div>
          <div style={{ ...mono, fontSize:10, color:C.muted, letterSpacing:2, marginTop:5, textTransform:"uppercase" }}>Personal Finance Dashboard · v5 · All amounts in Indian Rupees</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <label style={btnStyle("107,156,245")}>Import Excel<input type="file" accept=".xlsx,.xls" onChange={importFromExcel} style={{ display:"none" }} /></label>
          <button onClick={exportToExcel} style={btnStyle("62,207,142")}>Export All</button>
          <button onClick={addYear}       style={btnStyle("167,139,250")}>+ Add {nextFY(fyList[fyList.length-1])}</button>
          {importStatus && <span style={{ ...mono, fontSize:11, color:C.income }}>{importStatus}</span>}
        </div>
      </div>

      {/* FY Switcher */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 40px", display:"flex", alignItems:"center", overflowX:"auto" }}>
        <span style={{ ...mono, fontSize:9, color:C.muted, letterSpacing:2, textTransform:"uppercase", paddingRight:16, borderRight:`1px solid ${C.border}`, marginRight:8, whiteSpace:"nowrap" }}>Fiscal Year</span>
        {fyList.map(fy=>(
          <div key={fy} onClick={()=>{ setActiveFY(fy); setTab("overview"); }}
            style={{ padding:"10px 16px", fontFamily:"monospace", fontSize:11, cursor:"pointer", whiteSpace:"nowrap", fontWeight:activeFY===fy?700:400, color:activeFY===fy?C.accent:C.muted, borderBottom:`2px solid ${activeFY===fy?C.accent:"transparent"}`, transition:"all 0.15s" }}>
            FY {fy}
          </div>
        ))}
      </div>

      {/* Nav Tabs */}
      <div style={{ display:"flex", background:C.card, borderBottom:`1px solid ${C.border}`, padding:"0 40px", overflowX:"auto" }}>
        {TABS.map(t=><NavTab key={t.id} text={t.label} active={tab===t.id} onClick={()=>setTab(t.id)} />)}
      </div>

      {/* Content */}
      <div style={{ padding:"26px 40px 60px" }}>
        {panels[tab]||panels["overview"]}
      </div>
    </div>
  );
}
