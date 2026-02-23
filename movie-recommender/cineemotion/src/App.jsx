import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5000";

function getPosterUrl(title) {
  return API_BASE + "/posters/" + encodeURIComponent(title);
}

const EMOTIONS = [
  "joy","sadness","fear","anger","disgust","surprise",
  "trust","anticipation","curiosity","excitement","hope","love",
  "guilt","shame","gratitude","loneliness","confidence","determination",
  "regret","relief","nostalgia","compassion","anxiety","inspiration",
];

const EMOTION_COLORS = {
  joy:"#d97706",sadness:"#3b82f6",fear:"#7c3aed",anger:"#dc2626",
  disgust:"#16a34a",surprise:"#ea580c",trust:"#0891b2",anticipation:"#db2777",
  curiosity:"#2563eb",excitement:"#e11d48",hope:"#15803d",love:"#be123c",
  guilt:"#64748b",shame:"#92400e",gratitude:"#b45309",loneliness:"#4338ca",
  confidence:"#c2410c",determination:"#991b1b",regret:"#475569",relief:"#047857",
  nostalgia:"#a16207",compassion:"#be185d",anxiety:"#78350f",inspiration:"#0e7490",
};

const GENRE_OPTIONS = [
  "Action","Adventure","Animation","Biography","Comedy","Crime",
  "Documentary","Drama","Fantasy","History","Horror","Musical",
  "Mystery","Romance","Sci-Fi","Sport","Thriller","War","Western",
];

// 4 columns, 6 rows — grouped by emotional theme
// Col 1: Positive/uplifting
const COL1 = ["joy","excitement","hope","love","gratitude","inspiration"];
// Col 2: Social/relational
const COL2 = ["trust","anticipation","curiosity","compassion","confidence","determination"];
// Col 3: Negative/dark
const COL3 = ["sadness","fear","anger","disgust","anxiety","loneliness"];
// Col 4: Complex/reflective
const COL4 = ["surprise","guilt","shame","regret","relief","nostalgia"];

function genRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function defaultEmotions() {
  var o = {}; EMOTIONS.forEach(function(e){ o[e] = 5; }); return o;
}

async function apiRecommend(members, topN, filters) {
  var res = await fetch(API_BASE + "/recommend", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ members, top_n: topN, filters }),
  });
  if (!res.ok) { var e = await res.json().catch(function(){ return {}; }); throw new Error(e.error || "HTTP "+res.status); }
  return res.json();
}
async function apiHealth() { return (await fetch(API_BASE + "/health")).json(); }

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
var CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; }
html, body { margin:0; padding:0; height:100%; background:#f0efe9; font-family:'DM Sans',sans-serif; }
::-webkit-scrollbar { width:5px; }
::-webkit-scrollbar-track { background:#e8e6df; }
::-webkit-scrollbar-thumb { background:#c5c0b5; border-radius:99px; }

.btn-primary {
  background:#1e293b; color:#fff; border:none; border-radius:6px;
  padding:10px 20px; font-size:13px; font-weight:600; cursor:pointer;
  font-family:'DM Sans',sans-serif; letter-spacing:0.02em; transition:background 0.15s;
  width:100%;
}
.btn-primary:hover { background:#0f172a; }
.btn-primary:disabled { background:#94a3b8; cursor:not-allowed; }
.btn-ghost {
  background:none; border:1px solid #d1cfc8; border-radius:6px;
  padding:6px 13px; font-size:12px; font-weight:500; color:#64748b;
  cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.12s;
}
.btn-ghost:hover { border-color:#94a3b8; color:#374151; }
.btn-ghost:focus { outline:none; }

.tab-btn {
  padding:10px 20px; font-size:11px; font-weight:700;
  letter-spacing:0.08em; text-transform:uppercase;
  background:none; border:none; cursor:pointer; color:#94a3b8;
  border-bottom:2px solid transparent; transition:all 0.15s;
  font-family:'DM Sans',sans-serif; white-space:nowrap;
}
.tab-btn.active { color:#1e293b; border-bottom-color:#1e293b; }

.pill {
  display:inline-flex; align-items:center; padding:3px 10px;
  border-radius:4px; font-size:11px; font-weight:500;
  border:1px solid #d1cfc8; background:none; color:#64748b;
  cursor:pointer; transition:all 0.12s; font-family:'DM Sans',sans-serif;
}
.pill:hover { border-color:#94a3b8; color:#374151; }
.pill.active { background:#1e293b; color:#fff; border-color:#1e293b; }

.ifield {
  width:100%; padding:9px 13px; border:1px solid #d1cfc8; border-radius:6px;
  font-size:13px; color:#1e293b; background:#fff;
  transition:border-color 0.15s; font-family:'DM Sans',sans-serif;
}
.ifield:focus { border-color:#64748b; outline:none; }
.icode { font-family:'DM Mono',monospace; letter-spacing:0.2em; font-size:15px; text-transform:uppercase; }

/* ── Slider: full custom styling to guarantee interaction ── */
.slider-input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 36px;           /* tall clickable area */
  background: transparent;
  cursor: pointer;
  margin: 0;
  padding: 0;
  display: block;
}
.slider-input:focus { outline: none; }

/* Webkit (Chrome, Edge, Safari) */
.slider-input::-webkit-slider-runnable-track {
  height: 5px;
  border-radius: 99px;
  background: #e2e0d8;
}
.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1e293b;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  margin-top: -5.5px;    /* center thumb on track: (16-5)/2 = 5.5 */
  cursor: pointer;
  transition: transform 0.1s;
}
.slider-input:hover::-webkit-slider-thumb { transform: scale(1.15); }
.slider-input:active::-webkit-slider-thumb { transform: scale(1.25); }

/* Firefox */
.slider-input::-moz-range-track {
  height: 5px;
  border-radius: 99px;
  background: #e2e0d8;
  border: none;
}
.slider-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1e293b;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  cursor: pointer;
}

/* nbtn = number buttons */
.nbtn {
  flex:1; padding:7px 0; border-radius:5px;
  border:1px solid #d1cfc8; background:none;
  color:#64748b; font-size:13px; font-weight:600;
  cursor:pointer; font-family:'DM Mono',monospace; transition:all 0.12s;
}
.nbtn.active { background:#1e293b; color:#fff; border-color:#1e293b; }
`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function StatusDot(props) {
  var s = props.status;
  var color = s === "online" ? "#16a34a" : s === "offline" ? "#dc2626" : "#94a3b8";
  var label = s === "online" ? "API connected" : s === "offline" ? "API offline — run app.py" : "Connecting...";
  return (
    <span style={{ fontSize:11, color:"#64748b", display:"inline-flex", alignItems:"center", gap:5 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:color, display:"inline-block", flexShrink:0 }} />
      {label}
    </span>
  );
}

// Full-featured slider with visible thumb and track fill
function EmotionSlider(props) {
  var emotion = props.emotion;
  var value   = props.value;
  var onChange = props.onChange;
  var color   = EMOTION_COLORS[emotion] || "#64748b";
  var pct     = (value / 10) * 100;

  return (
    <div style={{ marginBottom:2 }}>
      {/* Label + value row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
        <span style={{ fontSize:12, fontWeight:500, color:"#374151", textTransform:"capitalize", letterSpacing:"0.01em" }}>
          {emotion}
        </span>
        <span style={{
          fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace",
          color: color, background: color+"15", padding:"1px 7px", borderRadius:4, minWidth:32, textAlign:"center",
        }}>
          {value}
        </span>
      </div>

      {/* Track with color fill behind the native slider */}
      <div style={{ position:"relative" }}>
        {/* colored fill bar — purely visual, pointer-events none */}
        <div style={{
          position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
          width: pct+"%", height:5, borderRadius:99,
          background: color, pointerEvents:"none", zIndex:1,
          transition:"width 0.05s",
        }} />
        {/* the actual interactive slider on top */}
        <input
          type="range" min={0} max={10} step={0.5} value={value}
          className="slider-input"
          style={{ position:"relative", zIndex:2 }}
          onChange={function(ev) { onChange(emotion, parseFloat(ev.target.value)); }}
        />
      </div>
    </div>
  );
}

function PosterImage(props) {
  var shown = useState(true);
  var visible = shown[0]; var setVisible = shown[1];
  if (!visible) {
    return (
      <div style={{ width:76, height:112, borderRadius:6, background:"#e8e6df",
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <span style={{ fontSize:10, color:"#94a3b8", textAlign:"center", padding:4, lineHeight:1.3 }}>No poster</span>
      </div>
    );
  }
  return (
    <img src={getPosterUrl(props.title)} alt={props.title}
      onError={function(){ setVisible(false); }}
      style={{ width:76, height:112, objectFit:"cover", borderRadius:6, flexShrink:0, background:"#e8e6df" }} />
  );
}

function ResultCard(props) {
  var r = props.result; var i = props.index;
  var genres = (r.genres||"").split("|").slice(0,3);
  var rankColors = ["#d97706","#94a3b8","#b45309"];
  var rankColor  = rankColors[i] || "#94a3b8";
  return (
    <div style={{ display:"flex", gap:14, padding:"16px 0", borderBottom:"1px solid #f0efe9" }}>
      <PosterImage title={r.title} />
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, color: rankColor }}>#{r.rank}</span>
            <span style={{ fontSize:15, fontWeight:700, color:"#0f172a", lineHeight:1.2 }}>{r.title}</span>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:6 }}>
            {r.year && <span style={{ fontSize:11, color:"#94a3b8" }}>{r.year}</span>}
            {r.imdb && <span style={{ fontSize:11, color:"#d97706", fontWeight:600 }}>{r.imdb} IMDb</span>}
            {genres.filter(Boolean).map(function(g){ return (
              <span key={g} style={{ fontSize:11, color:"#64748b" }}>{g}</span>
            ); })}
          </div>
          {r.dominant_emotions && r.dominant_emotions.length > 0 && (
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {r.dominant_emotions.map(function(de){
                return (
                  <span key={de.emotion} style={{ fontSize:10, fontWeight:600, textTransform:"capitalize",
                    color: EMOTION_COLORS[de.emotion]||"#64748b" }}>{de.emotion}</span>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
            <span style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em" }}>Match</span>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:700, color:"#1e293b" }}>
              {r.match_percent}<span style={{ fontSize:12 }}>%</span>
            </span>
          </div>
          <div style={{ height:3, background:"#e8e6df", borderRadius:99, overflow:"hidden" }}>
            <div style={{ width: r.match_percent+"%", height:"100%", background:"#1e293b", borderRadius:99,
              transition:"width 0.8s cubic-bezier(.4,0,.2,1)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberRow(props) {
  var m = props.member; var isMe = props.isMe;
  var top3 = Object.entries(m.emotions).sort(function(a,b){ return b[1]-a[1]; }).slice(0,3);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #f0efe9" }}>
      <div style={{ width:32, height:32, borderRadius:6, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0,
        background: isMe ? "#0ea5e9" : "#1e293b" }}>
        {m.name[0].toUpperCase()}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", marginBottom:2 }}>
          {m.name}
          {isMe && <span style={{ fontSize:10, color:"#0ea5e9", marginLeft:7, fontWeight:700, letterSpacing:"0.05em" }}>YOU</span>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {top3.map(function(item){
            return <span key={item[0]} style={{ fontSize:10, fontWeight:600, textTransform:"capitalize", color: EMOTION_COLORS[item[0]]||"#64748b" }}>
              {item[0]} {item[1]}
            </span>;
          })}
        </div>
      </div>
    </div>
  );
}

function FilterPanel(props) {
  var filters = props.filters; var onChange = props.onChange;
  function toggleArr(key, val) {
    var arr = filters[key]||[];
    var next = arr.includes(val) ? arr.filter(function(x){ return x!==val; }) : arr.concat([val]);
    onChange(Object.assign({}, filters, { [key]: next }));
  }
  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:10 }}>Release Era</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["old","Before 2000"],["mid","2000–2010"],["new","2011+"]].map(function(pair){
            var active = (filters.eras||[]).includes(pair[0]);
            return <button key={pair[0]} className={"pill"+(active?" active":"")} onClick={function(){ toggleArr("eras",pair[0]); }}>{pair[1]}</button>;
          })}
        </div>
      </div>
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8" }}>Min IMDb</span>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600, color:"#1e293b" }}>{filters.min_imdb||0}</span>
        </div>
        <input type="range" min={0} max={10} step={0.5} value={filters.min_imdb||0}
          className="slider-input"
          onChange={function(ev){ onChange(Object.assign({}, filters, { min_imdb: parseFloat(ev.target.value) })); }} />
      </div>
      <div>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:10 }}>Genres</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {GENRE_OPTIONS.map(function(g){
            var active = (filters.genres||[]).includes(g);
            return <button key={g} className={"pill"+(active?" active":"")} onClick={function(){ toggleArr("genres",g); }}>{g}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

// ─── LEFT SIDEBAR (fixed info panel) ─────────────────────────────────────────
function LeftSidebar(props) {
  var myName      = props.myName;
  var room        = props.room;
  var myEmotions  = props.myEmotions;
  var filters     = props.filters;
  var apiStatus   = props.apiStatus;
  var currentRoom = props.currentRoom;
  var onLeave     = props.onLeave;

  var memberCount = room ? room.members.length : 0;
  var MAX = 10;

  // top 6 emotions by value
  var topEmotions = Object.entries(myEmotions)
    .sort(function(a,b){ return b[1]-a[1]; })
    .slice(0, 6);

  var filtersActive = (filters.eras&&filters.eras.length>0) || filters.min_imdb>0 || (filters.genres&&filters.genres.length>0);

  var sep = { height:1, background:"#e8e6df", margin:"16px 0" };

  return (
    <div style={{
      width:240, flexShrink:0, borderRight:"1px solid #e5e3dc",
      background:"#fff", display:"flex", flexDirection:"column",
      height:"100%", overflowY:"auto",
    }}>
      {/* Top: logo + nav */}
      <div style={{ padding:"16px 18px 0" }}>
        <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", letterSpacing:"-0.02em", marginBottom:4 }}>CineEmotion</div>
        <StatusDot status={apiStatus} />
      </div>

      <div style={{ padding:"14px 18px 0", flex:1 }}>

        {/* Room info */}
        <div style={sep} />
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#94a3b8", marginBottom:8 }}>Session</div>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:700, color:"#1e293b", letterSpacing:"0.18em", marginBottom:4 }}>{currentRoom}</div>
        <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>
          Signed in as <strong style={{ color:"#1e293b" }}>{myName}</strong>
        </div>

        {/* Members */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:11, color:"#64748b" }}>Members</span>
          <span style={{
            fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700,
            color: memberCount >= MAX ? "#dc2626" : "#16a34a",
            background: memberCount >= MAX ? "#fef2f2" : "#f0fdf4",
            padding:"1px 8px", borderRadius:4,
          }}>{memberCount}/{MAX}</span>
        </div>
        {room && room.members.map(function(m){
          return (
            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
              <div style={{ width:22, height:22, borderRadius:4, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff", flexShrink:0,
                background: m.name===myName ? "#0ea5e9" : "#334155" }}>
                {m.name[0].toUpperCase()}
              </div>
              <span style={{ fontSize:12, color: m.name===myName ? "#0ea5e9" : "#374151", fontWeight: m.name===myName ? 600 : 400 }}>
                {m.name}
              </span>
            </div>
          );
        })}

        {/* Divider */}
        <div style={sep} />

        {/* Top emotions summary */}
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#94a3b8", marginBottom:10 }}>Your Top Emotions</div>
        {topEmotions.map(function(item){
          var pct = (item[1]/10)*100;
          var color = EMOTION_COLORS[item[0]]||"#64748b";
          return (
            <div key={item[0]} style={{ marginBottom:7 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:"#374151", textTransform:"capitalize" }}>{item[0]}</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:600, color: color }}>{item[1]}</span>
              </div>
              <div style={{ height:3, background:"#e8e6df", borderRadius:99, overflow:"hidden" }}>
                <div style={{ width:pct+"%", height:"100%", background:color, borderRadius:99, transition:"width 0.3s" }} />
              </div>
            </div>
          );
        })}

        {/* Divider */}
        <div style={sep} />

        {/* Filters summary */}
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#94a3b8", marginBottom:8 }}>Active Filters</div>
        {!filtersActive ? (
          <span style={{ fontSize:11, color:"#94a3b8" }}>None</span>
        ) : (
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {filters.eras && filters.eras.map(function(e){
              var lbl = e==="old"?"≤1999":e==="mid"?"2000–10":"2011+";
              return <span key={e} style={{ fontSize:10, background:"#f1f5f9", color:"#475569", padding:"2px 7px", borderRadius:4, fontWeight:500 }}>{lbl}</span>;
            })}
            {filters.min_imdb>0 && <span style={{ fontSize:10, background:"#fffbeb", color:"#b45309", padding:"2px 7px", borderRadius:4, fontWeight:500 }}>IMDb ≥ {filters.min_imdb}</span>}
            {filters.genres && filters.genres.map(function(g){
              return <span key={g} style={{ fontSize:10, background:"#f1f5f9", color:"#475569", padding:"2px 7px", borderRadius:4, fontWeight:500 }}>{g}</span>;
            })}
          </div>
        )}

        <div style={sep} />
      </div>

      {/* Bottom: Leave button */}
      <div style={{ padding:"14px 18px 18px" }}>
        <button className="btn-ghost" style={{ width:"100%", color:"#dc2626", borderColor:"#fca5a5" }}
          onClick={onLeave}>Leave Room</button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  var [rooms, setRooms]               = useState({});
  var [currentRoom, setCurrentRoom]   = useState(null);
  var [myName, setMyName]             = useState("");
  var [joinCode, setJoinCode]         = useState("");
  var [nameInput, setNameInput]       = useState("");
  var [view, setView]                 = useState("home");
  var [activeTab, setActiveTab]       = useState("emotions");
  var [myEmotions, setMyEmotions]     = useState(defaultEmotions);
  var [topN, setTopN]                 = useState(5);
  var [filters, setFilters]           = useState({ eras:[], min_imdb:0, genres:[] });
  var [results, setResults]           = useState(null);
  var [loading, setLoading]           = useState(false);
  var [error, setError]               = useState("");
  var [apiStatus, setApiStatus]       = useState("checking");

  var MAX = 10;

  useEffect(function(){
    apiHealth().then(function(){ setApiStatus("online"); }).catch(function(){ setApiStatus("offline"); });
  }, []);

  function syncToRoom(emo) {
    setRooms(function(prev){
      if (!currentRoom || !prev[currentRoom]) return prev;
      var room = prev[currentRoom];
      var members = room.members.map(function(m){
        return m.name === myName ? Object.assign({}, m, { emotions: Object.assign({}, emo) }) : m;
      });
      return Object.assign({}, prev, { [currentRoom]: Object.assign({}, room, { members }) });
    });
  }

  var handleEmotionChange = useCallback(function(emotion, value) {
    setMyEmotions(function(prev){
      var next = Object.assign({}, prev, { [emotion]: value });
      setRooms(function(prevRooms){
        if (!currentRoom || !prevRooms[currentRoom]) return prevRooms;
        var room = prevRooms[currentRoom];
        var members = room.members.map(function(m){
          return m.name === myName ? Object.assign({}, m, { emotions: Object.assign({}, next) }) : m;
        });
        return Object.assign({}, prevRooms, { [currentRoom]: Object.assign({}, room, { members }) });
      });
      return next;
    });
  }, [currentRoom, myName]);

  function createRoom() {
    if (!nameInput.trim()) { setError("Please enter your name"); return; }
    var id = genRoomId();
    var me = { id: Date.now(), name: nameInput.trim(), emotions: Object.assign({}, myEmotions) };
    setRooms(function(prev){ return Object.assign({}, prev, { [id]: { id, members:[me] } }); });
    setMyName(nameInput.trim()); setCurrentRoom(id); setView("room"); setError("");
  }

  function joinRoom() {
    if (!nameInput.trim()) { setError("Please enter your name"); return; }
    var rid = joinCode.trim().toUpperCase();
    if (!rooms[rid]) { setError("Room not found"); return; }
    if (rooms[rid].members.length >= MAX) { setError("Room is full"); return; }
    var taken = rooms[rid].members.find(function(m){ return m.name.toLowerCase() === nameInput.trim().toLowerCase(); });
    if (taken) { setError("Name already taken in this room"); return; }
    var me = { id: Date.now(), name: nameInput.trim(), emotions: Object.assign({}, myEmotions) };
    setRooms(function(prev){
      var room = prev[rid];
      return Object.assign({}, prev, { [rid]: Object.assign({}, room, { members: room.members.concat([me]) }) });
    });
    setMyName(nameInput.trim()); setCurrentRoom(rid); setView("room"); setError("");
  }

  function leaveRoom() {
    var rid = currentRoom; var name = myName;
    setRooms(function(prev){
      if (!prev[rid]) return prev;
      var members = prev[rid].members.filter(function(m){ return m.name !== name; });
      var next = Object.assign({}, prev);
      if (members.length === 0) { delete next[rid]; }
      else { next[rid] = Object.assign({}, prev[rid], { members }); }
      return next;
    });
    setCurrentRoom(null); setMyName(""); setView("home");
    setResults(null); setMyEmotions(defaultEmotions()); setActiveTab("emotions");
  }

  async function getRecommendations() {
    if (apiStatus === "offline") { setError("API offline — start app.py first"); return; }
    var room = rooms[currentRoom];
    if (!room || !room.members.length) return;
    setLoading(true); setError("");
    try {
      var data = await apiRecommend(room.members, topN, filters);
      setResults(data); setActiveTab("results");
    } catch(e) { setError("Error: "+e.message); }
    finally { setLoading(false); }
  }

  var room        = currentRoom ? rooms[currentRoom] : null;
  var memberCount = room ? room.members.length : 0;
  var recs        = results && results.recommendations ? results.recommendations : [];
  var filtersActive = (filters.eras&&filters.eras.length>0)||filters.min_imdb>0||(filters.genres&&filters.genres.length>0);

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (view === "home") {
    return (
      <div style={{ minHeight:"100vh", background:"#f0efe9", fontFamily:"'DM Sans',sans-serif",
        display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
        <style>{CSS}</style>
        <div style={{ width:"100%", maxWidth:860 }}>
          <div style={{ marginBottom:36 }}>
            <h1 style={{ margin:"0 0 6px", fontSize:28, fontWeight:700, color:"#0f172a", letterSpacing:"-0.03em" }}>CineEmotion</h1>
            <div style={{ fontSize:13, color:"#94a3b8", marginBottom:8 }}>Group Movie Recommender</div>
            <StatusDot status={apiStatus} />
          </div>

          <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:260, background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"24px" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:14 }}>New Session</div>
              <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:6, letterSpacing:"0.05em" }}>YOUR NAME</label>
              <input className="ifield" value={nameInput} onChange={function(e){ setNameInput(e.target.value); }}
                onKeyDown={function(e){ if(e.key==="Enter") createRoom(); }}
                placeholder="Enter your name" style={{ marginBottom:14 }} />
              <button className="btn-primary" onClick={createRoom}>Create Room</button>
              {error && <div style={{ fontSize:12, color:"#dc2626", marginTop:8 }}>{error}</div>}
            </div>

            <div style={{ flex:1, minWidth:260, background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"24px" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:14 }}>Join Existing</div>
              <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:6, letterSpacing:"0.05em" }}>YOUR NAME</label>
              <input className="ifield" value={nameInput} onChange={function(e){ setNameInput(e.target.value); }}
                placeholder="Enter your name" style={{ marginBottom:10 }} />
              <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:6, letterSpacing:"0.05em" }}>ROOM CODE</label>
              <input className="ifield icode" value={joinCode}
                onChange={function(e){ setJoinCode(e.target.value.toUpperCase()); }}
                onKeyDown={function(e){ if(e.key==="Enter") joinRoom(); }}
                placeholder="XXXXXX" maxLength={6} style={{ marginBottom:14 }} />
              <button className="btn-primary" onClick={joinRoom}>Join Room</button>
            </div>

            {Object.keys(rooms).length > 0 && (
              <div style={{ flex:1, minWidth:180, background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"24px" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:14 }}>Active Rooms</div>
                {Object.values(rooms).map(function(r){
                  return (
                    <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #f0efe9" }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:15, fontWeight:700, color:"#1e293b", letterSpacing:"0.12em" }}>{r.id}</span>
                      <span style={{ fontSize:11, color:"#94a3b8" }}>{r.members.length}/{MAX}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop:18, padding:"13px 20px", borderRadius:8, background:"#fff",
            border:"1px solid #e5e3dc", display:"flex", gap:24, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8" }}>Backend</span>
            <code style={{ fontSize:12, color:"#16a34a", fontFamily:"'DM Mono',monospace" }}>pip install flask flask-cors pandas numpy</code>
            <code style={{ fontSize:12, color:"#1e293b", fontFamily:"'DM Mono',monospace" }}>python app.py</code>
          </div>
        </div>
      </div>
    );
  }

  // ── ROOM ──────────────────────────────────────────────────────────────────
  var tabs = [
    { id:"emotions", label:"Set Emotions" },
    { id:"filters",  label:"Filters" + (filtersActive ? " •" : "") },
    { id:"members",  label:"Members ("+memberCount+")" },
    { id:"results",  label:"Results" + (recs.length ? " ("+recs.length+")" : "") },
  ];

  return (
    <div style={{ height:"100vh", background:"#f0efe9", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{CSS}</style>

      {/* Topbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e3dc", height:48, display:"flex",
        alignItems:"center", paddingLeft:18, flexShrink:0, zIndex:100 }}>
        <span style={{ fontSize:14, fontWeight:700, color:"#0f172a", letterSpacing:"-0.02em" }}>CineEmotion</span>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* LEFT SIDEBAR */}
        <LeftSidebar
          myName={myName} room={room} myEmotions={myEmotions}
          filters={filters} apiStatus={apiStatus}
          currentRoom={currentRoom} onLeave={leaveRoom}
        />

        {/* RIGHT PANEL */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Tab bar */}
          <div style={{ background:"#fff", borderBottom:"1px solid #e5e3dc", display:"flex",
            padding:"0 24px", flexShrink:0 }}>
            {tabs.map(function(t){
              return (
                <button key={t.id} className={"tab-btn"+(activeTab===t.id?" active":"")}
                  onClick={function(){ setActiveTab(t.id); }}>{t.label}</button>
              );
            })}
          </div>

          {/* Tab content — scrollable */}
          <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

            {/* ── SET EMOTIONS ── */}
            {activeTab === "emotions" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:3 }}>Set Your Emotions</div>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>Drag each slider to reflect how you feel right now. Use the full range.</div>
                  </div>
                  <button className="btn-ghost" style={{ flexShrink:0 }}
                    onClick={function(){ var d=defaultEmotions(); setMyEmotions(d); syncToRoom(d); }}>
                    Reset all
                  </button>
                </div>

                {/* 4×6 slider grid — grouped by emotional theme */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"0 36px",
                  background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"18px 24px" }}>

                  {/* Col 1: Positive */}
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#d97706", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #fef3c7" }}>
                      Positive
                    </div>
                    {COL1.map(function(e){
                      return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
                    })}
                  </div>

                  {/* Col 2: Social */}
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#0891b2", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #e0f2fe" }}>
                      Social
                    </div>
                    {COL2.map(function(e){
                      return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
                    })}
                  </div>

                  {/* Col 3: Dark */}
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#dc2626", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #fee2e2" }}>
                      Dark
                    </div>
                    {COL3.map(function(e){
                      return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
                    })}
                  </div>

                  {/* Col 4: Reflective */}
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#7c3aed", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #ede9fe" }}>
                      Reflective
                    </div>
                    {COL4.map(function(e){
                      return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
                    })}
                  </div>

                </div>

                {/* Get Recommendations — sticky bar always visible */}
                <div style={{ position:"sticky", bottom:0, marginTop:16, zIndex:20,
                  background:"#f0efe9", borderTop:"1px solid #e5e3dc", padding:"14px 0 4px" }}>
                  <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"16px 20px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                      {/* Quick N buttons */}
                      <div style={{ display:"flex", gap:6, flex:1, minWidth:220 }}>
                        {[3,5,7,10].map(function(n){
                          return <button key={n} className={"nbtn"+(topN===n?" active":"")} onClick={function(){ setTopN(n); }}>{n}</button>;
                        })}
                        <input type="number" min={1} max={50} value={topN}
                          onChange={function(e){ setTopN(Math.max(1,Math.min(50,parseInt(e.target.value)||1))); }}
                          className="ifield" style={{ width:54, textAlign:"center", padding:"7px 6px",
                            fontFamily:"'DM Mono',monospace", fontSize:13 }} />
                      </div>
                      {/* Label */}
                      {/* <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:700, color:"#1e293b" }}>{topN}</span>
                        <span style={{ fontSize:11, color:"#94a3b8" }}>results</span>
                      </div> */}
                      {/* Button */}
                      
                    </div>
                    {error && <div style={{ fontSize:12, color:"#dc2626", marginTop:8, padding:"6px 10px", background:"#fef2f2", borderRadius:5 }}>{error}</div>}
                    <button className="btn-primary" style={{ fontSize:14, padding:"12px", marginTop:"15px" }}
                      onClick={getRecommendations} disabled={loading}>
                      {loading ? "Finding matches..." : "Get Recommendations — "+memberCount+(memberCount===1?" person":" people")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── FILTERS ── */}
            {activeTab === "filters" && (
              <div style={{ maxWidth:680 }}>
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:3 }}>Filters</div>
                  <div style={{ fontSize:12, color:"#94a3b8" }}>Applied when you click Get Recommendations</div>
                </div>
                <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"22px 24px" }}>
                  <FilterPanel filters={filters} onChange={setFilters} />
                </div>
                {filtersActive && (
                  <button className="btn-ghost" style={{ marginTop:12, fontSize:11 }}
                    onClick={function(){ setFilters({ eras:[], min_imdb:0, genres:[] }); }}>Clear all filters</button>
                )}

                {/* Number of Results + Get Recommendations — also available here */}
                <div style={{ marginTop:20, background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"20px 24px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", marginBottom:2 }}>Number of Results</div>
                      <div style={{ fontSize:11, color:"#94a3b8" }}>How many movies to recommend</div>
                    </div>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:700, color:"#1e293b" }}>{topN}</span>
                  </div>
                  <div style={{ display:"flex", gap:7, marginBottom:14 }}>
                    {[3,5,7,10].map(function(n){
                      return <button key={n} className={"nbtn"+(topN===n?" active":"")} onClick={function(){ setTopN(n); }}>{n}</button>;
                    })}
                    <input type="number" min={1} max={50} value={topN}
                      onChange={function(e){ setTopN(Math.max(1,Math.min(50,parseInt(e.target.value)||1))); }}
                      className="ifield" style={{ width:60, textAlign:"center", padding:"7px 6px", fontFamily:"'DM Mono',monospace", fontSize:13 }} />
                  </div>
                  {error && <div style={{ fontSize:12, color:"#dc2626", marginBottom:10, padding:"8px 12px", background:"#fef2f2", borderRadius:5 }}>{error}</div>}
                  <button className="btn-primary" style={{ fontSize:14, padding:"12px" }}
                    onClick={getRecommendations} disabled={loading}>
                    {loading ? "Finding matches..." : "Get Recommendations — "+memberCount+(memberCount===1?" person":" people")}
                  </button>
                </div>
              </div>
            )}

            {/* ── MEMBERS ── */}
            {activeTab === "members" && (
              <div style={{ maxWidth:560 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:3 }}>Room Members</div>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>Share the code so others can join</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:24, fontWeight:700, color:"#1e293b", letterSpacing:"0.18em" }}>{currentRoom}</div>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>{memberCount}/{MAX} slots used</div>
                  </div>
                </div>

                <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"4px 18px", marginBottom:20 }}>
                  {room && room.members.map(function(m){
                    return <MemberRow key={m.id} member={m} isMe={m.name===myName} />;
                  })}
                </div>

                {room && room.members.length > 1 && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.08em", fontSize:10 }}>Group Average</div>
                    <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"18px 24px",
                      display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 32px" }}>
                      {EMOTIONS.map(function(e){
                        var avg = room.members.reduce(function(s,m){ return s+m.emotions[e]; }, 0) / room.members.length;
                        var pct = (avg/10)*100;
                        var color = EMOTION_COLORS[e]||"#64748b";
                        return (
                          <div key={e} style={{ marginBottom:6 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                              <span style={{ fontSize:11, color:"#374151", textTransform:"capitalize" }}>{e}</span>
                              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:600, color:color }}>{avg.toFixed(1)}</span>
                            </div>
                            <div style={{ height:3, background:"#e8e6df", borderRadius:99, overflow:"hidden" }}>
                              <div style={{ width:pct+"%", height:"100%", background:color, borderRadius:99 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── RESULTS ── */}
            {activeTab === "results" && (
              <div style={{ maxWidth:680 }}>
                {recs.length === 0 ? (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                    padding:"80px 0", color:"#94a3b8", textAlign:"center" }}>
                    <div style={{ fontSize:40, fontWeight:700, color:"#e2e0d8", marginBottom:12, letterSpacing:"-0.05em" }}>—</div>
                    <div style={{ fontSize:14, fontWeight:500, color:"#64748b", marginBottom:5 }}>No results yet</div>
                    <div style={{ fontSize:12 }}>Go to Set Emotions and click Get Recommendations</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:4 }}>
                          Top {recs.length} for {memberCount===1 ? myName : memberCount+" people"}
                        </div>
                        {results.group_avg_emotions && (
                          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                            {Object.entries(results.group_avg_emotions)
                              .sort(function(a,b){ return b[1]-a[1]; })
                              .slice(0,4)
                              .map(function(item){
                                return <span key={item[0]} style={{ fontSize:11, fontWeight:600, textTransform:"capitalize",
                                  color: EMOTION_COLORS[item[0]]||"#64748b" }}>{item[0]} {item[1]}</span>;
                              })}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:26, fontWeight:700, color:"#1e293b", lineHeight:1 }}>{recs.length}</div>
                        <div style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em" }}>results</div>
                      </div>
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"0 20px" }}>
                      {recs.map(function(r, i){ return <ResultCard key={r.title+i} result={r} index={i} />; })}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>{/* end tab content */}
        </div>{/* end right panel */}
      </div>{/* end body */}
    </div>
  );
}