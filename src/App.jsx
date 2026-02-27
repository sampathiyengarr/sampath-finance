import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0b0c10", surface: "#13151c", card: "#191c26", border: "#222536",
  accent: "#e8b84b", income: "#3ecf8e", expense: "#e06c6c",
  blue: "#6b9cf5", muted: "#5a6480", text: "#dde1ef", dim: "#8a94b0",
  purple: "#a78bfa", teal: "#2dd4bf",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MONTHS_LABELS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
function getMonths(fy) {
  const [y1, y2] = fy.split("-");
  const s1 = y1.slice(2), s2 = y2.slice(2);
  return [...MONTHS_LABELS.slice(0,9).map(m=>`${m}-${s1}`),...MONTHS_LABELS.slice(9).map(m=>`${m}-${s2}`)];
}

const ALL_INCOME_ROWS = [
  { id:"rental",    label:"Rental Income — Andheri East",      budget:13750, note:"Fixed — tenant pays monthly" },
  { id:"cash_cust", label:"Cash from Customer",                 budget:25000, note:"₹10k → TIN HUF, ₹16k → staff" },
  { id:"wife",      label:"Wife's Contribution — Staff",        budget:10000, note:"For house staff" },
  { id:"tin_huf",   label:"TIN HUF Transfer to Personal",       budget:10000, note:"Funds Loan 1 EMI" },
  { id:"sam7_reimb",label:"SAM 7 — Loan 2 Reimbursement",       budget:10000, note:"Reimburses Loan 2 EMI" },
];

const ALL_EXPENSE_ROWS = [
  { id:"emi1",     label:"EMI — Loan 1 (Wedding ₹1.03L)",       budget:9177,  note:"Closes Dec 2026", closesAfterFY:"2025-26" },
  { id:"emi2",     label:"EMI — Loan 2 (SAM 7 ₹2.04L)",         budget:9704,  note:"Ends Feb 2027" },
  { id:"emi3",     label:"EMI — Loan 3 (Wedding+Closure)",       budget:11503, note:"Ends Dec 2030" },
  { id:"flat_emi", label:"Flat EMI — Andheri East (Your 50%)",   budget:12964, note:"Home loan share" },
  { id:"society",  label:"Flat Society Charges",                 budget:1000,  note:"Monthly maintenance" },
  { id:"cook",     label:"Cook Salary",                          budget:10000, note:"Cash from receipts" },
  { id:"maid",     label:"Maid Salary",                          budget:6000,  note:"Cash from receipts" },
  { id:"other",    label:"Other Personal Expenses",              budget:0,     note:"Groceries, utilities, medical" },
];

function getActiveRows(fy, type) {
  const rows = type==="income" ? ALL_INCOME_ROWS : ALL_EXPENSE_ROWS;
  const fyYear = parseInt(fy.split("-")[0]);
  return rows.map(r => {
    if(type==="expense" && r.id==="emi1" && fyYear >= 2026) return {...r, budget:0, note:"Closed Dec 2026"};
    if(type==="income"  && r.id==="tin_huf" && fyYear >= 2026) return {...r, budget:0, note:"Ended — Loan 1 closed"};
    return r;
  });
}

function buildActuals(fy) {
  const months = getMonths(fy);
  const obj = {};
  [...getActiveRows(fy,"income"),...getActiveRows(fy,"expense")].forEach(r => {
    months.forEach(m => { obj[`${r.id}_${m}`] = r.budget; });
  });
  return obj;
}

const INITIAL_FY_LIST = ["2025-26","2026-27"];
function buildInitialState() {
  const s = {};
  INITIAL_FY_LIST.forEach(fy => { s[fy] = buildActuals(fy); });
  return s;
}

// ─── INITIAL GOALS ────────────────────────────────────────────────────────────
const INITIAL_GOALS = [
  { id:"g1", name:"Emergency Fund",       target:200000, saved:15000,  color:C.income,  deadline:"Mar-27", icon:"🛡️" },
  { id:"g2", name:"Loan 3 Prepayment",    target:100000, saved:0,      color:C.blue,    deadline:"Mar-27", icon:"🏦" },
  { id:"g3", name:"Family Vacation",      target:75000,  saved:5000,   color:C.accent,  deadline:"Dec-26", icon:"✈️" },
  { id:"g4", name:"Home Renovation Fund", target:150000, saved:0,      color:C.purple,  deadline:"Mar-28", icon:"🏠" },
];

// ─── INITIAL NET WORTH ────────────────────────────────────────────────────────
const INITIAL_ASSETS = [
  { id:"a1", label:"Andheri East Flat (50% share)",   value:2300000, type:"property" },
  { id:"a2", label:"Savings Account — Personal",       value:50000,   type:"cash" },
  { id:"a3", label:"TIN HUF Account",                  value:20000,   type:"cash" },
  { id:"a4", label:"SAM 7 Account",                    value:10000,   type:"cash" },
  { id:"a5", label:"Fixed Deposits / Investments",     value:0,       type:"investment" },
  { id:"a6", label:"Other Assets",                     value:0,       type:"other" },
];
const INITIAL_LIABILITIES = [
  { id:"l1", label:"IDFC Loan 1 Outstanding",          value:91775 },
  { id:"l2", label:"IDFC Loan 2 Outstanding",          value:116442 },
  { id:"l3", label:"IDFC Loan 3 Outstanding",          value:667169 },
  { id:"l4", label:"Home Loan Outstanding (Your 50%)", value:751674 },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const inr = n => "₹" + Number(n||0).toLocaleString("en-IN");
const mono = { fontFamily:"monospace" };
const lbl = { fontFamily:"monospace", fontSize:10, letterSpacing:2, textTransform:"uppercase", color:C.dim };
function nextFY(fy) { const [a,b]=fy.split("-").map(Number); return `${a+1}-${String(b+1).padStart(2,"0")}`; }
function fyTotalRowData(allActuals, fy, rowId) {
  return getMonths(fy).reduce((s,m)=>s+(allActuals[fy]?.[`${rowId}_${m}`]||0),0);
}
function fyTotalsData(allActuals, fy) {
  const ms=getMonths(fy), iR=getActiveRows(fy,"income"), eR=getActiveRows(fy,"expense");
  const act=allActuals[fy]||{};
  const totalInc=ms.reduce((s,m)=>s+iR.reduce((ss,r)=>ss+(act[`${r.id}_${m}`]||0),0),0);
  const totalExp=ms.reduce((s,m)=>s+eR.reduce((ss,r)=>ss+(act[`${r.id}_${m}`]||0),0),0);
  return { totalInc, totalExp, net:totalInc-totalExp };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
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
      <div style={{ width:175, fontSize:11, color:C.dim, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l}</div>
      <div style={{ flex:1, height:5, background:C.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${Math.min(100,Math.round((Math.max(0,amount)/Math.max(1,max))*100))}%`, height:"100%", background:color, borderRadius:3 }} />
      </div>
      <div style={{ ...mono, fontSize:11, color:C.text, width:84, textAlign:"right", flexShrink:0 }}>{inr(amount)}</div>
    </div>
  );
}

function EditCell({ value, onChange, color }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const start = () => { setDraft(String(value)); setEditing(true); };
  const commit = () => { const n=parseInt(draft.replace(/[^0-9]/g,""),10); if(!isNaN(n)) onChange(n); setEditing(false); };
  if(editing) return <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(false);}} style={{ width:76, background:"#0b0e18", border:`1px solid ${C.accent}`, borderRadius:3, color:C.accent, fontFamily:"monospace", fontSize:11, padding:"2px 4px", textAlign:"right", outline:"none" }} />;
  return <span onClick={start} title="Click to edit" style={{ ...mono, fontSize:11, color:color||C.text, cursor:"pointer", borderBottom:`1px dashed ${C.border}`, paddingBottom:1 }}>{inr(value)}</span>;
}

function EditNum({ value, onChange, color, prefix="" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const start = () => { setDraft(String(value)); setEditing(true); };
  const commit = () => { const n=parseInt(draft.replace(/[^0-9]/g,""),10); if(!isNaN(n)) onChange(n); setEditing(false); };
  if(editing) return <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(false);}} style={{ width:100, background:"#0b0e18", border:`1px solid ${C.accent}`, borderRadius:3, color:C.accent, fontFamily:"monospace", fontSize:12, padding:"3px 6px", textAlign:"right", outline:"none" }} />;
  return <span onClick={start} style={{ ...mono, fontSize:13, color:color||C.text, cursor:"pointer", borderBottom:`1px dashed ${C.border}` }}>{prefix}{inr(value)}</span>;
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

const btnStyle = (rgb) => ({ background:`rgba(${rgb},0.12)`, border:`1px solid rgba(${rgb},0.3)`, color:`rgb(${rgb})`, fontFamily:"monospace", fontSize:11, padding:"8px 14px", borderRadius:4, cursor:"pointer", letterSpacing:0.5, display:"inline-flex", alignItems:"center", gap:6 });

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [fyList, setFyList]       = useState(INITIAL_FY_LIST);
  const [allActuals, setAllActuals] = useState(buildInitialState);
  const [activeFY, setActiveFY]   = useState("2025-26");
  const [tab, setTab]             = useState("overview");
  const [importStatus, setImportStatus] = useState("");

  // Net Worth state
  const [assets, setAssets]             = useState(INITIAL_ASSETS);
  const [liabilities, setLiabilities]   = useState(INITIAL_LIABILITIES);

  // Goals state
  const [goals, setGoals] = useState(INITIAL_GOALS);
  const [newGoal, setNewGoal] = useState({ name:"", target:"", saved:"", deadline:"", icon:"🎯" });
  const [showAddGoal, setShowAddGoal] = useState(false);

  const months      = useMemo(()=>getMonths(activeFY),[activeFY]);
  const incomeRows  = useMemo(()=>getActiveRows(activeFY,"income"),[activeFY]);
  const expenseRows = useMemo(()=>getActiveRows(activeFY,"expense"),[activeFY]);
  const actuals     = allActuals[activeFY]||{};

  const setActual = useCallback((id,month,val)=>{
    setAllActuals(prev=>({...prev,[activeFY]:{...prev[activeFY],[`${id}_${month}`]:val}}));
  },[activeFY]);

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

  // Net Worth computed
  const totalAssets      = assets.reduce((s,a)=>s+a.value,0);
  const totalLiabilities = liabilities.reduce((s,l)=>s+l.value,0);
  const netWorth         = totalAssets - totalLiabilities;

  // Monthly net surplus for active FY
  const avgMonthlyNet = useMemo(()=>{
    const { net } = fyTotalsData(allActuals, activeFY);
    return Math.round(net/12);
  },[allActuals, activeFY]);

  // ── Excel Export ──────────────────────────────────────────────────────────
  function exportToExcel() {
    const wb = XLSX.utils.book_new();
    fyList.forEach(fy=>{
      const ms=getMonths(fy), iRows=getActiveRows(fy,"income"), eRows=getActiveRows(fy,"expense"), act=allActuals[fy]||{};
      const data=[]; data.push([`SAMPATH PERSONAL CASH FLOW — FY ${fy}`, ...Array(ms.length+3).fill("")]);
      data.push([`Exported: ${new Date().toLocaleDateString("en-IN")}`, ...Array(ms.length+3).fill("")]);
      data.push([]); data.push(["Line Item",...ms,"FY Total","Budget/mo","Avg Variance"]);
      data.push(["── INCOME ──"]);
      iRows.forEach(r=>{ const vals=ms.map(m=>act[`${r.id}_${m}`]||0); const fy2=vals.reduce((a,b)=>a+b,0); data.push([r.label,...vals,fy2,r.budget,Math.round(fy2/12)-r.budget]); });
      const incTots=ms.map(m=>iRows.reduce((s,r)=>s+(act[`${r.id}_${m}`]||0),0));
      data.push(["TOTAL INCOME",...incTots,incTots.reduce((a,b)=>a+b,0),"",""]);
      data.push([]); data.push(["── EXPENSES ──"]);
      eRows.forEach(r=>{ const vals=ms.map(m=>act[`${r.id}_${m}`]||0); const fy2=vals.reduce((a,b)=>a+b,0); data.push([r.label,...vals,fy2,r.budget,Math.round(fy2/12)-r.budget]); });
      const expTots=ms.map(m=>eRows.reduce((s,r)=>s+(act[`${r.id}_${m}`]||0),0));
      data.push(["TOTAL EXPENSES",...expTots,expTots.reduce((a,b)=>a+b,0),"",""]);
      data.push([]); const netTots=ms.map((_,i)=>incTots[i]-expTots[i]);
      data.push(["NET CASH FLOW",...netTots,netTots.reduce((a,b)=>a+b,0),"",""]);
      const ws=XLSX.utils.aoa_to_sheet(data); ws["!cols"]=[{wch:38},...ms.map(()=>({wch:10})),{wch:12},{wch:11},{wch:14}];
      XLSX.utils.book_append_sheet(wb,ws,`FY ${fy}`);
    });
    // Net Worth sheet
    const nwData=[["NET WORTH SNAPSHOT",""],["Date",new Date().toLocaleDateString("en-IN")],[""],["ASSETS","Value (₹)"],...assets.map(a=>[a.label,a.value]),["TOTAL ASSETS",totalAssets],[""],["LIABILITIES","Value (₹)"],...liabilities.map(l=>[l.label,l.value]),["TOTAL LIABILITIES",totalLiabilities],[""],["NET WORTH",netWorth]];
    const wsNW=XLSX.utils.aoa_to_sheet(nwData); wsNW["!cols"]=[{wch:34},{wch:16}];
    XLSX.utils.book_append_sheet(wb,wsNW,"Net Worth");
    // Goals sheet
    const gData=[["SAVINGS GOALS","Target","Saved","Remaining","% Done","Deadline"],...goals.map(g=>[g.icon+" "+g.name,g.target,g.saved,g.target-g.saved,Math.round((g.saved/g.target)*100)+"%",g.deadline])];
    const wsG=XLSX.utils.aoa_to_sheet(gData); wsG["!cols"]=[{wch:28},{wch:12},{wch:12},{wch:12},{wch:10},{wch:12}];
    XLSX.utils.book_append_sheet(wb,wsG,"Savings Goals");
    XLSX.writeFile(wb,`Sampath_CashFlow_v4_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  // ── Excel Import ──────────────────────────────────────────────────────────
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
          const ws=wb.Sheets[name]; const rows=XLSX.utils.sheet_to_json(ws,{header:1});
          const headerIdx=rows.findIndex(r=>r[0]==="Line Item"); if(headerIdx===-1) return;
          const headers=rows[headerIdx]; const ms=getMonths(fy); const monthCols=ms.map(m=>headers.indexOf(m));
          const newAct=newAllActuals[fy]?{...newAllActuals[fy]}:buildActuals(fy);
          const allRows=[...getActiveRows(fy,"income"),...getActiveRows(fy,"expense")];
          rows.slice(headerIdx+1).forEach(row=>{
            const matched=allRows.find(r=>r.label===row[0]);
            if(matched) ms.forEach((m,mi)=>{ const ci=monthCols[mi]; if(ci!==-1&&row[ci]!==undefined){ const v=parseInt(row[ci],10); if(!isNaN(v)) newAct[`${matched.id}_${m}`]=v; }});
          });
          newAllActuals[fy]=newAct; if(!fyList.includes(fy)) setFyList(prev=>[...prev,fy].sort()); imported++;
        });
        setAllActuals(newAllActuals); setImportStatus(`✅ Imported ${imported} year(s)`); setTimeout(()=>setImportStatus(""),3000);
      } catch(err) { setImportStatus("❌ "+err.message); }
    };
    reader.readAsBinaryString(file); e.target.value="";
  }

  // ─── PANEL: OVERVIEW ──────────────────────────────────────────────────────
  function OverviewPanel() {
    const chartData=months.map(m=>{ const t=monthTotals(activeFY,m); return { month:m.slice(0,3), Income:t.inc, Expenses:t.exp, Net:t.net }; });
    const { totalInc, totalExp, net } = fyTotalsData(allActuals, activeFY);
    return (
      <div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          <KpiCard lbl="FY Total Income"    val={inr(totalInc)} sub={`FY ${activeFY}`} color={C.income} />
          <KpiCard lbl="FY Total Expenses"  val={inr(totalExp)} sub={`FY ${activeFY}`} color={C.expense} />
          <KpiCard lbl="FY Net Surplus"     val={(net>=0?"+":"")+inr(net)} sub={`FY ${activeFY}`} color={C.accent} />
          <KpiCard lbl="Avg Monthly Net"    val={(avgMonthlyNet>=0?"+":"")+inr(avgMonthlyNet)} sub="per month" color={avgMonthlyNet>=0?C.income:C.expense} />
          <KpiCard lbl="Net Worth"          val={netWorth>=0?inr(netWorth):"−"+inr(Math.abs(netWorth))} sub="assets − liabilities" color={C.blue} />
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
              <Bar dataKey="Net"      fill={C.accent}  radius={[3,3,0,0]} fillOpacity={0.9}  />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SectionHeader title="Breakdown" />
        <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:260 }}>
            <div style={{ ...lbl, marginBottom:14 }}>Income (avg/mo)</div>
            {incomeRows.map(r=>{ const avg=Math.round(months.reduce((s,m)=>s+(actuals[`${r.id}_${m}`]||0),0)/12); return <MiniBar key={r.id} lbl={r.label} amount={avg} max={25000} color={C.income} />; })}
            <div style={{ borderTop:`1px solid ${C.border}`, marginTop:10, paddingTop:10, display:"flex", justifyContent:"space-between", ...mono, fontSize:13, color:C.accent, fontWeight:700 }}><span>AVG/MO</span><span>{inr(Math.round(totalInc/12))}</span></div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:260 }}>
            <div style={{ ...lbl, marginBottom:14 }}>Expenses (avg/mo)</div>
            {expenseRows.map(r=>{ const avg=Math.round(months.reduce((s,m)=>s+(actuals[`${r.id}_${m}`]||0),0)/12); return <MiniBar key={r.id} lbl={r.label} amount={avg} max={30384} color={C.expense} />; })}
            <div style={{ borderTop:`1px solid ${C.border}`, marginTop:10, paddingTop:10, display:"flex", justifyContent:"space-between", ...mono, fontSize:13, color:C.accent, fontWeight:700 }}><span>AVG/MO</span><span>{inr(Math.round(totalExp/12))}</span></div>
          </div>
        </div>
        <div style={{ background:"linear-gradient(135deg,rgba(232,184,75,.07),rgba(62,207,142,.04))", border:"1px solid rgba(232,184,75,.2)", borderRadius:8, padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:22, flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:15, color:C.muted }}>Net Surplus — FY {activeFY}</div>
            <div style={{ fontSize:11, color:C.accent, marginTop:5 }}>{activeFY==="2025-26"?"Loans 1 & 2 offset by entities — true EMI burden ₹24,467/mo":"Loan 1 closed — saving ₹9,177/mo from Jan 2027"}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:38, fontWeight:900, color:net>=0?C.income:C.expense }}>{net>=0?"+":""}{inr(net)}</div>
            <div style={{ fontSize:11, color:C.dim }}>≈ {inr(avgMonthlyNet)} / month avg</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── PANEL: NET WORTH ─────────────────────────────────────────────────────
  function NetWorthPanel() {
    const updateAsset = (id, val) => setAssets(prev => prev.map(a => a.id===id ? {...a, value:val} : a));
    const updateLiab  = (id, val) => setLiabilities(prev => prev.map(l => l.id===id ? {...l, value:val} : l));

    // Historical net worth projection (simple: assumes current surplus goes to savings)
    const nwProjection = Array.from({length:13},(_,i)=>{
      const monthsFromNow = i;
      return {
        month: i===0 ? "Now" : `M+${i*2}`,
        "Net Worth": netWorth + (avgMonthlyNet * monthsFromNow * 2),
      };
    });

    const assetColors = { property:C.blue, cash:C.income, investment:C.accent, other:C.dim };

    const pieData = assets.filter(a=>a.value>0).map(a=>({ name:a.label, value:a.value, color:assetColors[a.type] }));

    return (
      <div>
        {/* Summary KPIs */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          <KpiCard lbl="Total Assets"      val={inr(totalAssets)}      sub="click values to update" color={C.income} />
          <KpiCard lbl="Total Liabilities" val={inr(totalLiabilities)} sub="loans outstanding"      color={C.expense} />
          <KpiCard lbl="Net Worth"         val={(netWorth>=0?"+":"-")+inr(Math.abs(netWorth))} sub="assets − liabilities" color={netWorth>=0?C.blue:C.expense} />
          <KpiCard lbl="Debt-to-Asset"     val={Math.round((totalLiabilities/Math.max(totalAssets,1))*100)+"%"} sub="lower is better" color={C.accent} />
        </div>

        <div style={{ display:"flex", gap:18, flexWrap:"wrap", marginTop:24 }}>
          {/* Assets */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, flex:1, minWidth:280 }}>
            <div style={{ ...lbl, marginBottom:16, color:C.income }}>Assets — Click to Edit</div>
            {assets.map(a=>(
              <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.border}22` }}>
                <div>
                  <div style={{ fontSize:12 }}>{a.label}</div>
                  <div style={{ ...mono, fontSize:9, color:C.dim, letterSpacing:1, textTransform:"uppercase" }}>{a.type}</div>
                </div>
                <EditNum value={a.value} onChange={v=>updateAsset(a.id,v)} color={C.income} />
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", ...mono, fontSize:14, color:C.income, fontWeight:700, borderTop:`1px solid ${C.border}`, marginTop:8 }}>
              <span>TOTAL ASSETS</span><span>{inr(totalAssets)}</span>
            </div>
          </div>

          {/* Liabilities */}
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
              <span>NET WORTH</span><span>{netWorth>=0?"+":"-"}{inr(Math.abs(netWorth))}</span>
            </div>
          </div>

          {/* Asset pie */}
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

        {/* Net Worth Projection */}
        <SectionHeader title="Net Worth Projection (next 24 months at current surplus)" />
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22 }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={nwProjection}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:10, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:C.muted, fontSize:10, fontFamily:"monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+(v/100000).toFixed(1)+"L"} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Net Worth" stroke={C.blue} strokeWidth={2} fill="url(#nwGrad)" dot={{ r:3, fill:C.blue }} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ ...mono, fontSize:10, color:C.dim, marginTop:8 }}>Based on avg monthly surplus of {inr(avgMonthlyNet)}. Update actuals in Monthly Tracker to improve accuracy.</div>
        </div>
      </div>
    );
  }

  // ─── PANEL: SAVINGS GOALS ─────────────────────────────────────────────────
  function GoalsPanel() {
    const updateGoalSaved  = (id, val) => setGoals(prev=>prev.map(g=>g.id===id?{...g,saved:Math.min(val,g.target)}:g));
    const updateGoalTarget = (id, val) => setGoals(prev=>prev.map(g=>g.id===id?{...g,target:val}:g));
    const deleteGoal       = (id)      => setGoals(prev=>prev.filter(g=>g.id!==id));
    const addGoal = () => {
      if(!newGoal.name||!newGoal.target) return;
      setGoals(prev=>[...prev,{ id:"g"+Date.now(), name:newGoal.name, target:parseInt(newGoal.target)||0, saved:parseInt(newGoal.saved)||0, deadline:newGoal.deadline||"Mar-27", icon:newGoal.icon||"🎯", color:C.teal }]);
      setNewGoal({ name:"", target:"", saved:"", deadline:"", icon:"🎯" }); setShowAddGoal(false);
    };

    const monthsToGoal = (g) => avgMonthlyNet<=0 ? "∞" : Math.ceil((g.target-g.saved)/avgMonthlyNet)+" mo";

    return (
      <div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          <KpiCard lbl="Active Goals"     val={goals.length}                                                    sub="set and tracking"   color={C.accent} />
          <KpiCard lbl="Total Target"     val={inr(goals.reduce((s,g)=>s+g.target,0))}                         sub="across all goals"   color={C.blue} />
          <KpiCard lbl="Total Saved"      val={inr(goals.reduce((s,g)=>s+g.saved,0))}                          sub="so far"             color={C.income} />
          <KpiCard lbl="Monthly Surplus"  val={(avgMonthlyNet>=0?"+":"")+inr(avgMonthlyNet)}                    sub="available to save"  color={avgMonthlyNet>=0?C.income:C.expense} />
        </div>

        <SectionHeader title="Savings Goals" right={
          <button onClick={()=>setShowAddGoal(!showAddGoal)} style={btnStyle("167,139,250")}>＋ Add Goal</button>
        } />

        {/* Add goal form */}
        {showAddGoal && (
          <div style={{ background:C.card, border:`1px solid ${C.accent}`, borderRadius:8, padding:20, marginBottom:20 }}>
            <div style={{ ...lbl, marginBottom:14, color:C.accent }}>New Goal</div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {[["Icon","icon",40],["Goal Name","name",180],["Target ₹","target",120],["Saved so far ₹","saved",120],["Deadline","deadline",100]].map(([label2,key,w])=>(
                <div key={key}>
                  <div style={{ ...lbl, marginBottom:5 }}>{label2}</div>
                  <input value={newGoal[key]} onChange={e=>setNewGoal(p=>({...p,[key]:e.target.value}))}
                    style={{ width:w, background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.text, fontFamily:"monospace", fontSize:12, padding:"6px 10px", outline:"none" }} />
                </div>
              ))}
              <div style={{ alignSelf:"flex-end" }}>
                <button onClick={addGoal} style={btnStyle("62,207,142")}>✓ Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Goal cards */}
        <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
          {goals.map(g=>{
            const pct    = Math.min(100,Math.round((g.saved/Math.max(g.target,1))*100));
            const remain = g.target - g.saved;
            const months2Goal = avgMonthlyNet>0 ? Math.ceil(remain/avgMonthlyNet) : null;
            return (
              <div key={g.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${g.color}`, borderRadius:8, padding:20, flex:1, minWidth:240, position:"relative" }}>
                <button onClick={()=>deleteGoal(g.id)} style={{ position:"absolute", top:12, right:12, background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14 }}>✕</button>
                <div style={{ fontSize:24, marginBottom:6 }}>{g.icon}</div>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{g.name}</div>
                <div style={{ ...mono, fontSize:10, color:C.dim, marginBottom:14 }}>Deadline: {g.deadline}</div>

                <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:`linear-gradient(90deg,${g.color}88,${g.color})`, borderRadius:3, transition:"width 0.3s" }} />
                </div>

                <div style={{ display:"flex", justifyContent:"space-between", ...mono, fontSize:10, color:C.dim, marginBottom:14 }}>
                  <span style={{ color:g.color, fontWeight:700 }}>{pct}% done</span>
                  <span>{inr(remain)} to go</span>
                </div>

                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ ...lbl, marginBottom:3 }}>Saved</div>
                    <EditNum value={g.saved} onChange={v=>updateGoalSaved(g.id,v)} color={g.color} />
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ ...lbl, marginBottom:3 }}>Target</div>
                    <EditNum value={g.target} onChange={v=>updateGoalTarget(g.id,v)} color={C.dim} />
                  </div>
                </div>

                {months2Goal!==null && (
                  <div style={{ marginTop:12, padding:"7px 12px", background:`${g.color}11`, borderRadius:4, ...mono, fontSize:10, color:g.color }}>
                    {pct>=100 ? "🎉 Goal Reached!" : `At ₹${avgMonthlyNet.toLocaleString("en-IN")}/mo surplus → ~${months2Goal} months to go`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* All goals summary bar */}
        <SectionHeader title="Goals Progress Summary" />
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22 }}>
          {goals.map(g=>(
            <div key={g.id} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12 }}>{g.icon} {g.name}</span>
                <span style={{ ...mono, fontSize:11, color:g.color }}>{inr(g.saved)} / {inr(g.target)}</span>
              </div>
              <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
                <div style={{ width:`${Math.min(100,Math.round((g.saved/Math.max(g.target,1))*100))}%`, height:"100%", background:g.color, borderRadius:4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── PANEL: FORECAST ──────────────────────────────────────────────────────
  function ForecastPanel() {
    const [openingBalance, setOpeningBalance] = useState(50000);
    const [extraSaving, setExtraSaving]       = useState(0);

    // Generate 18-month forecast
    const forecastData = useMemo(()=>{
      const data = [];
      let balance = openingBalance;
      const today = new Date();
      const fyYear = parseInt(activeFY.split("-")[0]);

      for(let i=0; i<18; i++) {
        const d = new Date(today.getFullYear(), today.getMonth()+i, 1);
        const monthLabel = d.toLocaleString("en-IN",{month:"short",year:"2-digit"});

        // Determine if Loan 1 is active this month
        const isLoan1Active = (d < new Date(2027,0,1)); // closes end of Dec 2026
        const loan1EMI      = isLoan1Active ? 9177 : 0;
        const tin_huf_in    = isLoan1Active ? 10000 : 0;

        const monthInc  = 13750 + 25000 + 10000 + tin_huf_in + 10000; // rental+cash+wife+tinhuf+sam7
        const monthExp  = loan1EMI + 9704 + 11503 + 12964 + 1000 + 10000 + 6000 + extraSaving;
        const net       = monthInc - monthExp;
        balance        += net;

        data.push({ month:monthLabel, "Monthly Net":net, "Bank Balance":balance, "Income":monthInc, "Expenses":monthExp });
      }
      return data;
    },[openingBalance, extraSaving, activeFY]);

    const loan1ClosingIdx = forecastData.findIndex(d=>d["Monthly Net"]!==forecastData[0]["Monthly Net"]);

    return (
      <div>
        <SectionHeader title="6–18 Month Cash Flow Forecast" />

        {/* Controls */}
        <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:24 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, flex:1, minWidth:220 }}>
            <div style={{ ...lbl, marginBottom:8 }}>Opening Bank Balance</div>
            <EditNum value={openingBalance} onChange={setOpeningBalance} color={C.income} prefix="₹" />
            <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>Your current savings account balance</div>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:20, flex:1, minWidth:220 }}>
            <div style={{ ...lbl, marginBottom:8 }}>Extra Monthly Saving (goal allocation)</div>
            <EditNum value={extraSaving} onChange={setExtraSaving} color={C.accent} prefix="₹" />
            <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>Amount you want to set aside each month for goals</div>
          </div>
          <div style={{ background:"rgba(62,207,142,.07)", border:"1px solid rgba(62,207,142,.2)", borderRadius:8, padding:20, flex:1, minWidth:220 }}>
            <div style={{ ...lbl, marginBottom:8, color:C.income }}>🎉 Loan 1 Closes Dec 2026</div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:22, color:C.income, fontWeight:800 }}>+₹9,177/mo</div>
            <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>Watch your balance jump in the chart from Jan 2027</div>
          </div>
        </div>

        {/* Balance projection */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22, marginBottom:20 }}>
          <div style={{ ...lbl, marginBottom:14 }}>Projected Bank Balance — 18 Months</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.income} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.income} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:C.muted, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+(v/1000).toFixed(0)+"k"} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Bank Balance" stroke={C.income} strokeWidth={2.5} fill="url(#balGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly net & income/expense */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:22 }}>
          <div style={{ ...lbl, marginBottom:14 }}>Monthly Income vs Expenses vs Net</div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={forecastData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:C.muted, fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+v/1000+"k"} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize:11, fontFamily:"monospace" }} />
              <Bar dataKey="Income"      fill={C.income}  radius={[3,3,0,0]} fillOpacity={0.8} />
              <Bar dataKey="Expenses"    fill={C.expense} radius={[3,3,0,0]} fillOpacity={0.7} />
              <Bar dataKey="Monthly Net" fill={C.accent}  radius={[3,3,0,0]} fillOpacity={0.9} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Forecast table */}
        <SectionHeader title="Month-by-Month Forecast Table" />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                {["Month","Income","Expenses","Monthly Net","Bank Balance"].map(h=>(
                  <th key={h} style={{ ...mono, fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:C.dim, padding:"7px 12px", textAlign:"right", background:C.surface, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap", ...(h==="Month"?{textAlign:"left"}:{}) }}>{h}</th>
                ))}
              </tr>
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
        <div style={{ marginTop:12, background:"rgba(232,184,75,.05)", borderLeft:`3px solid ${C.accent}`, padding:"9px 14px", fontSize:11, color:C.muted, lineHeight:1.6, borderRadius:"0 4px 4px 0" }}>
          💡 This forecast uses fixed budget values. Update actuals monthly in the Tracker tab for a more accurate projection.
          Loan 1 EMI (₹9,177) is automatically removed from Jan 2027 onwards.
        </div>
      </div>
    );
  }

  // ─── PANEL: TRACKER (condensed) ───────────────────────────────────────────
  function TrackerPanel() {
    const th={ fontFamily:"monospace", fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:C.dim, padding:"7px 9px", textAlign:"right", background:C.surface, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" };
    const td={ padding:"7px 9px", borderBottom:`1px solid ${C.border}22` };
    const renderRows=(rows,isExp)=>rows.map((row,ri)=>{
      const fyT=months.reduce((s,m)=>s+(actuals[`${row.id}_${m}`]||0),0);
      const avgA=Math.round(fyT/12); const vari=isExp?row.budget-avgA:avgA-row.budget;
      const closed=row.id==="emi1"&&activeFY!=="2025-26";
      return (
        <tr key={row.id} style={{ background:ri%2===0?"transparent":"rgba(255,255,255,0.01)", opacity:closed?0.4:1 }}>
          <td style={{ ...td, fontSize:12 }}>{row.label}{closed&&<span style={{ ...mono, fontSize:9, color:C.income, background:"rgba(62,207,142,.1)", padding:"1px 6px", borderRadius:3, marginLeft:8 }}>CLOSED</span>}</td>
          <td style={{ ...td, ...mono, fontSize:11, textAlign:"right", color:C.dim }}>{inr(row.budget)}</td>
          {months.map(m=>(
            <td key={m} style={{ ...td, textAlign:"right" }}>
              <EditCell value={actuals[`${row.id}_${m}`]||0} onChange={v=>setActual(row.id,m,v)} color={isExp?C.expense:C.income} />
            </td>
          ))}
          <td style={{ ...td, ...mono, fontSize:11, textAlign:"right", color:C.accent, fontWeight:700 }}>{inr(fyT)}</td>
          <td style={{ ...td, ...mono, fontSize:11, textAlign:"right", color:vari>=0?C.income:C.expense }}>{vari>=0?"+":""}{inr(vari)}</td>
        </tr>
      );
    });
    const { totalInc, totalExp, net } = fyTotalsData(allActuals, activeFY);
    return (
      <div>
        <SectionHeader title={`Monthly Tracker — FY ${activeFY}`} right={<span style={{ ...mono, fontSize:10, color:C.muted }}>Click any value to edit actual</span>} />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign:"left", minWidth:210 }}>Line Item</th>
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
                {months.map(m=><td key={m} style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.accent, fontWeight:700 }}>{inr(incomeRows.reduce((s,r)=>s+(actuals[`${r.id}_${m}`]||0),0))}</td>)}
                <td style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.accent, fontWeight:700 }}>{inr(totalInc)}</td><td/>
              </tr>
              <tr style={{ background:C.surface }}><td colSpan={months.length+4} style={{ ...td, ...mono, fontSize:9, letterSpacing:2, color:C.muted, textTransform:"uppercase" }}>── Expenses ──</td></tr>
              {renderRows(expenseRows, true)}
              <tr style={{ background:"rgba(224,108,108,.05)" }}>
                <td style={{ ...td, ...mono, fontSize:12, color:C.expense, fontWeight:700 }}>TOTAL EXPENSES</td>
                <td style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.expense, fontWeight:700 }}>{inr(expenseRows.reduce((s,r)=>s+r.budget,0))}</td>
                {months.map(m=><td key={m} style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.expense, fontWeight:700 }}>{inr(expenseRows.reduce((s,r)=>s+(actuals[`${r.id}_${m}`]||0),0))}</td>)}
                <td style={{ ...td, ...mono, fontSize:12, textAlign:"right", color:C.expense, fontWeight:700 }}>{inr(totalExp)}</td><td/>
              </tr>
              <tr style={{ background:"rgba(62,207,142,.05)" }}>
                <td style={{ ...td, ...mono, fontSize:13, color:C.income, fontWeight:800 }}>NET CASH FLOW</td>
                <td style={{ ...td, ...mono, fontSize:13, textAlign:"right", color:C.income, fontWeight:800 }}>{inr(incomeRows.reduce((s,r)=>s+r.budget,0)-expenseRows.reduce((s,r)=>s+r.budget,0))}</td>
                {months.map(m=>{ const n=monthTotals(activeFY,m).net; return <td key={m} style={{ ...td, ...mono, fontSize:13, textAlign:"right", color:n>=0?C.income:C.expense, fontWeight:800 }}>{n>=0?"+":""}{inr(n)}</td>; })}
                <td style={{ ...td, ...mono, fontSize:13, textAlign:"right", color:net>=0?C.income:C.expense, fontWeight:800 }}>{(net>=0?"+":"")+inr(net)}</td><td/>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const TABS = [
    { id:"overview",  label:"Overview" },
    { id:"tracker",   label:"Monthly Tracker" },
    { id:"networth",  label:"Net Worth 📈" },
    { id:"goals",     label:"Savings Goals 🎯" },
    { id:"forecast",  label:"Forecast 🔮" },
  ];

  const panels = {
    overview: <OverviewPanel />,
    tracker:  <TrackerPanel />,
    networth: <NetWorthPanel />,
    goals:    <GoalsPanel />,
    forecast: <ForecastPanel />,
  };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${C.surface} 0%,#161926 100%)`, borderBottom:`1px solid ${C.border}`, padding:"22px 40px 18px", display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:14 }}>
        <div>
          <div style={{ fontFamily:"Georgia,serif", fontSize:24, fontWeight:800 }}>💼 Sampath <span style={{ color:C.accent }}>Krishnaswamy Iyengar</span></div>
          <div style={{ ...mono, fontSize:10, color:C.muted, letterSpacing:2, marginTop:5, textTransform:"uppercase" }}>Personal Cash Flow · All amounts in ₹ · v4</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <label style={btnStyle("107,156,245")}>📂 Import<input type="file" accept=".xlsx,.xls" onChange={importFromExcel} style={{ display:"none" }} /></label>
          <button onClick={exportToExcel} style={btnStyle("62,207,142")}>⬇ Export All</button>
          <button onClick={addYear}       style={btnStyle("167,139,250")}>＋ Add {nextFY(fyList[fyList.length-1])}</button>
          {importStatus && <span style={{ ...mono, fontSize:11, color:importStatus.startsWith("✅")?C.income:C.expense }}>{importStatus}</span>}
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
