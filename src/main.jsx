import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const SECRET_PIN = "1947"

const C = { bg:"#0b0c10", surface:"#13151c", card:"#191c26", border:"#222536", accent:"#e8b84b", expense:"#e06c6c", dim:"#8a94b0", text:"#dde1ef" }

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [shake, setShake] = useState(false)

  const handleKey = (k) => {
    if (k === "DEL") { setPin(p => p.slice(0, -1)); setError(""); return; }
    if (pin.length >= 6) return;
    const next = pin + k
    setPin(next)
    if (next.length === SECRET_PIN.length) {
      if (next === SECRET_PIN) {
        sessionStorage.setItem("skif_auth", "1")
        onUnlock()
      } else {
        setShake(true)
        setError("Incorrect PIN")
        setTimeout(() => { setPin(""); setShake(false); setError("") }, 900)
      }
    }
  }

  const keys = ["1","2","3","4","5","6","7","8","9","","0","DEL"]

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:C.card, border:"1px solid #222536", borderRadius:16, padding:"48px 40px", width:320, textAlign:"center" }}>
        <div style={{ fontFamily:"Georgia,serif", fontSize:22, fontWeight:800, marginBottom:4, color:"#e8b84b" }}>
          Sampath Finance
        </div>
        <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:2, textTransform:"uppercase", marginBottom:36 }}>
          Enter PIN to continue
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:12, marginBottom:8 }}>
          {Array.from({ length: SECRET_PIN.length }).map((_, i) => (
            <div key={i} style={{ width:14, height:14, borderRadius:"50%", background: i < pin.length ? "#e8b84b" : "transparent", border: i < pin.length ? "2px solid #e8b84b" : "2px solid #222536" }} />
          ))}
        </div>
        <div style={{ height:20, fontFamily:"monospace", fontSize:11, color:C.expense, marginBottom:20 }}>{error}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
          {keys.map((k, i) => k === "" ? <div key={i} /> : (
            <button key={i} onClick={() => handleKey(k)} style={{ background: k==="DEL" ? "rgba(224,108,108,0.1)" : "#13151c", border: k==="DEL" ? "1px solid rgba(224,108,108,0.3)" : "1px solid #222536", borderRadius:10, padding:"16px 0", color: k==="DEL" ? "#e06c6c" : "#dde1ef", fontSize: k==="DEL" ? 13 : 20, fontWeight:600, cursor:"pointer" }}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginTop:28, letterSpacing:1 }}>
          PRIVATE · PERSONAL FINANCIAL DATA
        </div>
      </div>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} }`}</style>
    </div>
  )
}

function Root() {
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => {
    if (sessionStorage.getItem("skif_auth") === "1") setUnlocked(true)
  }, [])
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Root /></React.StrictMode>
)
