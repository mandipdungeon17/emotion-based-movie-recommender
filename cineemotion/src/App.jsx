import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "";
var TMDB_LOGO_BASE = "/tmdb-img";

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
const COL1 = ["joy","excitement","hope","love","gratitude","inspiration"];
const COL2 = ["trust","anticipation","curiosity","compassion","confidence","determination"];
const COL3 = ["sadness","fear","anger","disgust","anxiety","loneliness"];
const COL4 = ["surprise","guilt","shame","regret","relief","nostalgia"];

function defaultEmotions() {
  var o = {}; EMOTIONS.forEach(function(e){ o[e] = 5; }); return o;
}

function defaultFilters() {
  return { eras: [], min_imdb: 0, genres: [] };
}

// ─── API HELPERS ─────────────────────────────────────────────────────────────

async function apiHealth() { return (await fetch(API_BASE + "/health")).json(); }

async function apiCreateRoom(name) {
  var res = await fetch(API_BASE + "/rooms/create", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name }),
  });
  if (!res.ok) { var e = await res.json().catch(function(){ return {}; }); throw new Error(e.error || "HTTP "+res.status); }
  return res.json();
}

async function apiJoinRoom(roomId, name) {
  var res = await fetch(API_BASE + "/rooms/" + roomId + "/join", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name }),
  });
  if (!res.ok) { var e = await res.json().catch(function(){ return {}; }); throw new Error(e.error || "HTTP "+res.status); }
  return res.json();
}

async function apiLeaveRoom(roomId, memberId) {
  await fetch(API_BASE + "/rooms/" + roomId + "/leave", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ member_id: memberId }),
  });
}

async function apiGetRoom(roomId, memberId) {
  var res = await fetch(API_BASE + "/rooms/" + roomId + "?member_id=" + memberId);
  if (!res.ok) return null;
  return res.json();
}

async function apiUpdateEmotions(roomId, memberId, emotions) {
  await fetch(API_BASE + "/rooms/" + roomId + "/emotions", {
    method: "PUT", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ member_id: memberId, emotions: emotions }),
  });
}

async function apiUpdateSettings(roomId, memberId, settings) {
  await fetch(API_BASE + "/rooms/" + roomId + "/settings", {
    method: "PUT", headers: {"Content-Type": "application/json"},
    body: JSON.stringify(Object.assign({ member_id: memberId }, settings)),
  });
}

async function apiUpdateFilters(roomId, memberId, filters) {
  await fetch(API_BASE + "/rooms/" + roomId + "/filters", {
    method: "PUT", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ member_id: memberId, filters: filters }),
  });
}

async function apiRoomRecommend(roomId, memberId) {
  var res = await fetch(API_BASE + "/rooms/" + roomId + "/recommend", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ member_id: memberId }),
  });
  if (!res.ok) { var e = await res.json().catch(function(){ return {}; }); throw new Error(e.error || "HTTP "+res.status); }
  return res.json();
}

async function apiSetReady(roomId, memberId, ready) {
  await fetch(API_BASE + "/rooms/" + roomId + "/ready", {
    method: "PUT", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ member_id: memberId, ready: ready }),
  });
}

// Clipboard helper that works on http:// LAN IPs (not just localhost/https)
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  var el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand("copy"); } catch(e) {}
  document.body.removeChild(el);
  return Promise.resolve();
}

// Aggregation strategies exposed to the user
var STRATEGIES = [
  { id:"avg_no_misery",  label:"Balanced",       desc:"Average mood, but vetoes any emotion someone strongly dislikes" },
  { id:"avg",            label:"Simple Average", desc:"Straight average of all members' emotions" },
  { id:"least_misery",   label:"Least Misery",   desc:"Picks the minimum per emotion — nobody gets a clashing mood" },
  { id:"most_pleasure",  label:"Most Pleasure",  desc:"Picks the maximum per emotion — honours the strongest desire" },
  { id:"weighted_avg",   label:"By Intensity",   desc:"Members who feel more strongly pull the group more" },
];

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
var CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; }
html, body { margin:0; padding:0; height:100%; background:#f0efe9; font-family:'DM Sans',sans-serif; }
::-webkit-scrollbar { width:5px; }
::-webkit-scrollbar-track { background:#e8e6df; }
::-webkit-scrollbar-thumb { background:#c5c0b5; border-radius:99px; }

/* ── Responsive ── */
@media (max-width: 900px) {
  .room-body { flex-direction: column !important; }
  .left-sidebar { display: none !important; }
  .emotion-grid { grid-template-columns: 1fr 1fr !important; gap: 0 18px !important; }
  .tab-content { padding: 16px 14px !important; }
  .hamburger-btn { display: flex !important; }
}
@media (min-width: 901px) {
  .hamburger-btn { display: none !important; }
  .mobile-drawer-overlay { display: none !important; }
}
@media (max-width: 560px) {
  .home-cards { flex-direction: column !important; }
  .emotion-grid { grid-template-columns: 1fr !important; }
  .strategy-bar { flex-direction: column !important; align-items: stretch !important; }
  .tab-bar { overflow-x: auto !important; }
}


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
  height: 36px;
  background: transparent;
  cursor: pointer;
  margin: 0;
  padding: 0;
  display: block;
}
.slider-input:focus { outline: none; }

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
  margin-top: -5.5px;
  cursor: pointer;
  transition: transform 0.1s;
}
.slider-input:hover::-webkit-slider-thumb { transform: scale(1.15); }
.slider-input:active::-webkit-slider-thumb { transform: scale(1.25); }

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

.nbtn {
  flex:1; padding:7px 0; border-radius:5px;
  border:1px solid #d1cfc8; background:none;
  color:#64748b; font-size:13px; font-weight:600;
  cursor:pointer; font-family:'DM Mono',monospace; transition:all 0.12s;
}
.nbtn.active { background:#1e293b; color:#fff; border-color:#1e293b; }

/* ── Mobile drawer overlay ── */
.mobile-drawer-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35); z-index: 999;
}
.mobile-drawer {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: 280px; max-width: 85vw;
  background: #fff; z-index: 1000;
  display: flex; flex-direction: column;
  box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  animation: slideIn 0.2s ease-out;
}
@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function EmotionSlider(props) {
  var emotion = props.emotion;
  var value   = props.value;
  var onChange = props.onChange;
  var color   = EMOTION_COLORS[emotion] || "#64748b";
  var pct     = (value / 10) * 100;

  return (
    <div style={{ marginBottom:2 }}>
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
      <div style={{ position:"relative" }}>
        <div style={{
          position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
          width: pct+"%", height:5, borderRadius:99,
          background: color, pointerEvents:"none", zIndex:1,
          transition:"width 0.05s",
        }} />
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

  var expandState = useState(false);
  var expanded = expandState[0]; var setExpanded = expandState[1];

  // Collect watch providers: flatrate first, then rent, then buy — deduplicated
  var wp = r.watch_providers || {};
  var allProviders = (wp.flatrate || []).concat(wp.rent || []).concat(wp.buy || []);
  var seen = {};
  var uniqueProviders = [];
  allProviders.forEach(function(p) {
    if (!seen[p.name]) { seen[p.name] = true; uniqueProviders.push(p); }
  });
  var displayProviders = uniqueProviders.slice(0, 6);

  return (
    <div style={{ display:"flex", gap:14, padding:"16px 0", borderBottom:"1px solid #f0efe9" }}>
      <PosterImage title={r.title} />
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
        {/* Rank + Title */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, color: rankColor }}>#{r.rank}</span>
          <span style={{ fontSize:15, fontWeight:700, color:"#0f172a", lineHeight:1.2 }}>{r.title}</span>
        </div>

        {/* Year, Ratings, Genres */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          {r.year && <span style={{ fontSize:11, color:"#94a3b8" }}>{r.year}</span>}
          {r.imdb && <span style={{ fontSize:11, color:"#d97706", fontWeight:600 }}>{r.imdb} IMDb</span>}
          {r.tmdb_rating && (
            <span style={{ fontSize:11, color:"#0891b2", fontWeight:600 }}>{r.tmdb_rating.toFixed(1)} TMDB</span>
          )}
          {genres.filter(Boolean).map(function(g){ return (
            <span key={g} style={{ fontSize:11, color:"#64748b" }}>{g}</span>
          ); })}
        </div>

        {/* Dominant emotions */}
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

        {/* Overview (expandable) */}
        {r.overview && (
          <div style={{ marginTop:2 }}>
            <p style={{
              fontSize:11, color:"#64748b", lineHeight:1.5, margin:0,
              overflow: expanded ? "visible" : "hidden",
              display: expanded ? "block" : "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : 2,
              WebkitBoxOrient: "vertical",
            }}>
              {r.overview}
            </p>
            {r.overview.length > 120 && (
              <button onClick={function(){ setExpanded(!expanded); }}
                style={{ background:"none", border:"none", padding:0,
                  fontSize:10, color:"#2563eb", cursor:"pointer",
                  fontWeight:600, marginTop:2 }}>
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* Match percentage bar */}
        <div style={{ marginTop:2 }}>
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

        {/* Watch providers */}
        {displayProviders.length > 0 && (
          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", marginTop:4 }}>
            <span style={{ fontSize:9, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em", marginRight:2 }}>Watch on</span>
            {displayProviders.map(function(p) {
              return (
                <img key={p.name} src={TMDB_LOGO_BASE + p.logo_path}
                  alt={p.name} title={p.name}
                  style={{ width:22, height:22, borderRadius:4, objectFit:"cover" }}
                  onError={function(e){ e.target.style.display="none"; }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow(props) {
  var m = props.member; var isMe = props.isMe; var isMemberAdmin = props.isAdmin;
  var isReady = m.ready;
  var top3 = Object.entries(m.emotions).sort(function(a,b){ return b[1]-a[1]; }).slice(0,3);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #f0efe9" }}>
      <div style={{ width:32, height:32, borderRadius:6, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0,
        background: isMemberAdmin ? "#d97706" : isMe ? "#0ea5e9" : "#1e293b" }}>
        {m.name[0].toUpperCase()}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#1e293b", marginBottom:2 }}>
          {m.name}
          {isMemberAdmin && <span style={{ fontSize:10, color:"#d97706", marginLeft:7, fontWeight:700, letterSpacing:"0.05em" }}>ADMIN</span>}
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
      <span style={{
        fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:4,
        background: isReady ? "#dcfce7" : "#fef3c7",
        color: isReady ? "#16a34a" : "#b45309",
      }}>
        {isReady ? "Ready" : "Editing"}
      </span>
    </div>
  );
}

function FilterPanel(props) {
  var filters = props.filters; var onChange = props.onChange;
  var disabled = props.disabled;
  function toggleArr(key, val) {
    var arr = filters[key]||[];
    var next = arr.includes(val) ? arr.filter(function(x){ return x!==val; }) : arr.concat([val]);
    onChange(Object.assign({}, filters, { [key]: next }));
  }
  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
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

// ─── SHARE LINK HELPER ──────────────────────────────────────────────────────
function getShareUrl(roomId) {
  return window.location.origin + "?room=" + roomId;
}

function SharePanel(props) {
  var roomId = props.roomId;
  var copied = useState(false);
  var isCopied = copied[0]; var setCopied = copied[1];
  var url = getShareUrl(roomId);
  var canShare = typeof navigator.share === "function";

  function copyLink() {
    copyToClipboard(url).then(function() {
      setCopied(true);
      setTimeout(function(){ setCopied(false); }, 2000);
    });
  }

  function copyCode() {
    copyToClipboard(roomId);
  }

  function shareRoom() {
    navigator.share({
      title: "Join my CinEmotion room",
      text: "Join room " + roomId + " on CinEmotion!",
      url: url,
    }).catch(function(){});
  }

  return (
    <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"14px 16px", marginBottom:16 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:10 }}>Share Room</div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:700, color:"#1e293b", letterSpacing:"0.18em" }}>{roomId}</span>
        <button className="btn-ghost" style={{ fontSize:11, padding:"4px 10px" }} onClick={copyCode}>Copy Code</button>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom: canShare ? 8 : 0 }}>
        <input readOnly value={url} className="ifield" style={{ fontSize:11, padding:"6px 10px", flex:1 }} onClick={function(e){ e.target.select(); }} />
        <button className="btn-primary" style={{ width:"auto", padding:"6px 14px", fontSize:11 }} onClick={copyLink}>
          {isCopied ? "Copied!" : "Copy Link"}
        </button>
      </div>
      {canShare && (
        <button className="btn-primary" style={{ padding:"8px 14px", fontSize:12, background:"#25D366" }} onClick={shareRoom}>
          Share via WhatsApp / Apps
        </button>
      )}
    </div>
  );
}

// ─── LEFT SIDEBAR (desktop) + MOBILE DRAWER ────────────────────────────────
function SidebarContent(props) {
  var myName      = props.myName;
  var room        = props.room;
  var currentRoom = props.currentRoom;
  var onLeave     = props.onLeave;
  var isAdmin     = props.isAdmin;
  var memberId    = props.memberId;

  var memberCount = room ? room.members.length : 0;
  var MAX = 10;
  var copiedState = useState(false);
  var isCopied = copiedState[0]; var setCopied = copiedState[1];

  function copyRoomLink() {
    var url = getShareUrl(currentRoom);
    copyToClipboard(url).then(function() {
      setCopied(true); setTimeout(function(){ setCopied(false); }, 2000);
    });
  }

  var sep = { height:1, background:"#e8e6df", margin:"16px 0" };

  return (
    <>
      <div style={{ padding:"14px 18px 0", flex:1 }}>
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#94a3b8", marginBottom:8 }}>Session</div>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:700, color:"#1e293b", letterSpacing:"0.18em", marginBottom:4 }}>{currentRoom}</div>
        <button className="btn-ghost" style={{ fontSize:10, padding:"3px 10px", marginBottom:6 }} onClick={copyRoomLink}>
          {isCopied ? "Link Copied!" : "Share Room Link"}
        </button>
        <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>
          Signed in as <strong style={{ color:"#1e293b" }}>{myName}</strong>
        </div>
        {isAdmin && (
          <span style={{ fontSize:10, fontWeight:700, color:"#d97706", background:"#fef3c7", padding:"2px 8px", borderRadius:4 }}>Room Admin</span>
        )}

        {/* Members */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, marginTop:12 }}>
          <span style={{ fontSize:11, color:"#64748b" }}>Members</span>
          <span style={{
            fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700,
            color: memberCount >= MAX ? "#dc2626" : "#16a34a",
            background: memberCount >= MAX ? "#fef2f2" : "#f0fdf4",
            padding:"1px 8px", borderRadius:4,
          }}>{memberCount}/{MAX}</span>
        </div>
        {room && room.members.map(function(m){
          var isMemberAdmin = room.admin_id && m.id === room.admin_id;
          var isMe = m.id === memberId;
          var isReady = m.ready;
          return (
            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
              {/* Status dot: green = ready, orange = editing */}
              <span style={{
                width:8, height:8, borderRadius:"50%", flexShrink:0,
                background: isReady ? "#16a34a" : "#f59e0b",
              }} />
              <div style={{ width:22, height:22, borderRadius:4, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff", flexShrink:0,
                background: isMemberAdmin ? "#d97706" : isMe ? "#0ea5e9" : "#334155" }}>
                {m.name[0].toUpperCase()}
              </div>
              <span style={{ fontSize:12, color: isMe ? "#0ea5e9" : "#374151", fontWeight: isMe ? 600 : 400 }}>
                {m.name}
                {isMemberAdmin && <span style={{ fontSize:9, color:"#d97706", marginLeft:4 }}>ADMIN</span>}
              </span>
            </div>
          );
        })}

        <div style={sep} />
      </div>

      <div style={{ padding:"14px 18px 18px" }}>
        <button className="btn-ghost" style={{ width:"100%", color:"#dc2626", borderColor:"#fca5a5" }}
          onClick={onLeave}>Leave Room</button>
      </div>
    </>
  );
}

function LeftSidebar(props) {
  return (
    <div className="left-sidebar" style={{
      width:240, flexShrink:0, borderRight:"1px solid #e5e3dc",
      background:"#fff", display:"flex", flexDirection:"column",
      height:"100%", overflowY:"auto",
    }}>
      <SidebarContent {...props} />
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Restore session from localStorage (survives refresh)
  var saved = (function() {
    try {
      var s = localStorage.getItem("cineemotion_session");
      return s ? JSON.parse(s) : null;
    } catch(e) { return null; }
  })();

  var [currentRoom, setCurrentRoom]   = useState(saved ? saved.roomId : null);
  var [memberId, setMemberId]         = useState(saved ? saved.memberId : null);
  var [roomState, setRoomState]       = useState(null);
  var [myName, setMyName]             = useState(saved ? saved.myName : "");
  var [joinCode, setJoinCode]         = useState("");
  var [nameInput, setNameInput]       = useState("");
  var [view, setView]                 = useState(saved && saved.roomId ? "room" : "home");
  var [activeTab, setActiveTab]       = useState("emotions");
  var [myEmotions, setMyEmotions]     = useState(defaultEmotions);
  var [myFilters, setMyFilters]       = useState(defaultFilters);
  var [topN, setTopN]                 = useState(5);
  var [strategy, setStrategy]         = useState("avg_no_misery");
  var [results, setResults]           = useState(null);
  var [loading, setLoading]           = useState(false);
  var [error, setError]               = useState("");
  var [apiStatus, setApiStatus]       = useState("checking");
  var [drawerOpen, setDrawerOpen]     = useState(false);

  // Also check URL for ?room=XXXX (from shared link)
  useEffect(function() {
    var params = new URLSearchParams(window.location.search);
    var roomParam = params.get("room");
    if (roomParam && !currentRoom) {
      setJoinCode(roomParam.toUpperCase());
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Save session to localStorage whenever it changes
  useEffect(function() {
    if (currentRoom && memberId && myName) {
      localStorage.setItem("cineemotion_session", JSON.stringify({
        roomId: currentRoom, memberId: memberId, myName: myName,
      }));
    }
  }, [currentRoom, memberId, myName]);

  var MAX = 10;

  // Derived admin status
  var isAdmin = roomState && memberId && roomState.admin_id === memberId;
  var room = roomState;
  var memberCount = room ? room.members.length : 0;
  var readyCount = room ? room.ready_count || 0 : 0;
  var myMember = room && memberId ? room.members.find(function(m){ return m.id === memberId; }) : null;
  var myReady = myMember ? myMember.ready : false;

  // ── Health check on mount ──
  useEffect(function(){
    apiHealth().then(function(){ setApiStatus("online"); }).catch(function(){ setApiStatus("offline"); });
  }, []);

  // ── Polling: sync room state from server every 2.5 seconds ──
  var prevResultsRef = useRef(null);

  useEffect(function() {
    if (!currentRoom || !memberId) return;

    var active = true;

    function poll() {
      apiGetRoom(currentRoom, memberId).then(function(data) {
        if (!active) return;
        if (!data) {
          localStorage.removeItem("cineemotion_session");
          setCurrentRoom(null); setMemberId(null); setRoomState(null);
          setView("home"); setMyEmotions(defaultEmotions()); setMyFilters(defaultFilters());
          return;
        }
        setRoomState(data);

        // Sync admin-controlled values
        setStrategy(data.strategy);
        setTopN(data.top_n);

        // Sync own filters from server (other members' filters are in data.members)
        var me = data.members.find(function(m){ return m.id === memberId; });
        if (me && me.filters) {
          setMyFilters(me.filters);
        }

        // If new results appeared, update and switch tab
        if (data.results) {
          var newKey = JSON.stringify(data.results.recommendations && data.results.recommendations.length);
          var oldKey = prevResultsRef.current;
          if (newKey !== oldKey) {
            setResults(data.results);
            setActiveTab("results");
            prevResultsRef.current = newKey;
          }
        } else {
          prevResultsRef.current = null;
        }
      }).catch(function() {
        if (active) {
          localStorage.removeItem("cineemotion_session");
          setCurrentRoom(null); setMemberId(null); setRoomState(null);
          setView("home"); setMyEmotions(defaultEmotions()); setMyFilters(defaultFilters());
        }
      });
    }

    poll();
    var interval = setInterval(poll, 2500);
    return function() { active = false; clearInterval(interval); };
  }, [currentRoom, memberId]);

  // ── Emotion change with debounced server sync ──
  var emotionTimerRef = useRef(null);

  var handleEmotionChange = useCallback(function(emotion, value) {
    setMyEmotions(function(prev) {
      var next = Object.assign({}, prev, { [emotion]: value });

      clearTimeout(emotionTimerRef.current);
      emotionTimerRef.current = setTimeout(function() {
        if (currentRoom && memberId) {
          apiUpdateEmotions(currentRoom, memberId, next);
        }
      }, 500);

      return next;
    });
  }, [currentRoom, memberId]);

  // ── Filter change with debounced server sync ──
  var filterTimerRef = useRef(null);

  var handleFiltersChange = useCallback(function(newFilters) {
    setMyFilters(newFilters);

    clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(function() {
      if (currentRoom && memberId) {
        apiUpdateFilters(currentRoom, memberId, newFilters);
      }
    }, 500);
  }, [currentRoom, memberId]);

  // ── Room actions ──

  async function createRoom() {
    if (!nameInput.trim()) { setError("Please enter your name"); return; }
    if (apiStatus === "offline") { setError("API offline — start app.py first"); return; }
    setError("");
    try {
      var data = await apiCreateRoom(nameInput.trim());
      setMemberId(data.member_id);
      setCurrentRoom(data.room_id);
      setMyName(nameInput.trim());
      setView("room");
      setMyEmotions(defaultEmotions());
      setMyFilters(defaultFilters());
      apiUpdateEmotions(data.room_id, data.member_id, defaultEmotions());
    } catch (e) {
      setError(e.message);
    }
  }

  async function joinRoom() {
    if (!nameInput.trim()) { setError("Please enter your name"); return; }
    if (apiStatus === "offline") { setError("API offline — start app.py first"); return; }
    var rid = joinCode.trim().toUpperCase();
    if (!rid || rid.length !== 6) { setError("Enter a 6-character room code"); return; }
    setError("");
    try {
      var data = await apiJoinRoom(rid, nameInput.trim());
      setMemberId(data.member_id);
      setCurrentRoom(data.room_id);
      setMyName(nameInput.trim());
      setView("room");
      setMyEmotions(defaultEmotions());
      setMyFilters(defaultFilters());
      apiUpdateEmotions(data.room_id, data.member_id, defaultEmotions());
    } catch (e) {
      setError(e.message);
    }
  }

  function leaveRoom() {
    if (currentRoom && memberId) {
      apiLeaveRoom(currentRoom, memberId);
    }
    localStorage.removeItem("cineemotion_session");
    setCurrentRoom(null); setMemberId(null); setRoomState(null);
    setMyName(""); setView("home");
    setResults(null); setMyEmotions(defaultEmotions()); setMyFilters(defaultFilters());
    setActiveTab("emotions");
    prevResultsRef.current = null;
    setDrawerOpen(false);
  }

  async function getRecommendations() {
    if (apiStatus === "offline") { setError("API offline — start app.py first"); return; }
    if (!isAdmin) return;
    setLoading(true); setError("");
    try {
      var data = await apiRoomRecommend(currentRoom, memberId);
      setResults(data.results);
      setActiveTab("results");
      prevResultsRef.current = JSON.stringify(data.results.recommendations && data.results.recommendations.length);
    } catch (e) { setError("Error: " + e.message); }
    finally { setLoading(false); }
  }

  // ── Admin-only settings helpers ──
  function handleStrategyChange(newStrategy) {
    if (!isAdmin) return;
    setStrategy(newStrategy);
    apiUpdateSettings(currentRoom, memberId, { strategy: newStrategy });
  }

  function handleTopNChange(newTopN) {
    if (!isAdmin) return;
    setTopN(newTopN);
    apiUpdateSettings(currentRoom, memberId, { top_n: newTopN });
  }

  function toggleReady() {
    var next = !myReady;
    apiSetReady(currentRoom, memberId, next);
  }

  var recs        = results && results.recommendations ? results.recommendations : [];
  var myFiltersActive = (myFilters.eras&&myFilters.eras.length>0)||myFilters.min_imdb>0||(myFilters.genres&&myFilters.genres.length>0);

  // Compute aggregated filters for display on Members tab
  var aggregatedFilters = (function() {
    if (!room || !room.members) return { eras:[], min_imdb:0, genres:[] };
    var allEras = {};
    var allGenres = {};
    var minImdbs = [];
    room.members.forEach(function(m) {
      var f = m.filters || defaultFilters();
      (f.eras || []).forEach(function(e) { allEras[e] = true; });
      (f.genres || []).forEach(function(g) { allGenres[g] = true; });
      if (f.min_imdb > 0) minImdbs.push(f.min_imdb);
    });
    return {
      eras: Object.keys(allEras).sort(),
      genres: Object.keys(allGenres).sort(),
      min_imdb: minImdbs.length ? Math.min.apply(null, minImdbs) : 0,
    };
  })();

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (view === "home") {
    return (
      <div style={{ minHeight:"100vh", background:"#f0efe9", fontFamily:"'DM Sans',sans-serif",
        display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 16px" }}>
        <style>{CSS}</style>
        <div style={{ width:"100%", maxWidth:860 }}>
          <div style={{ marginBottom:36 }}>
            <h1 style={{ margin:"0 0 6px", fontSize:28, fontWeight:700, color:"#0f172a", letterSpacing:"-0.03em" }}>CinEmotion</h1>
            <div style={{ fontSize:13, color:"#94a3b8", marginBottom:8 }}>Group Movie Recommender</div>
          </div>

          <div style={{ display:"flex", gap:18, flexWrap:"wrap" }} className="home-cards">
            <div style={{ flex:1, minWidth:260, background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"24px" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:14 }}>New Session</div>
              <label style={{ fontSize:11, fontWeight:600, color:"#64748b", display:"block", marginBottom:6, letterSpacing:"0.05em" }}>YOUR NAME</label>
              <input className="ifield" value={nameInput} onChange={function(e){ setNameInput(e.target.value); }}
                onKeyDown={function(e){ if(e.key==="Enter") createRoom(); }}
                placeholder="Enter your name" style={{ marginBottom:14 }} />
              <button className="btn-primary" onClick={createRoom}>Create Room</button>
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
          </div>

          {error && <div style={{ fontSize:12, color:"#dc2626", marginTop:12, padding:"8px 14px", background:"#fef2f2", borderRadius:6 }}>{error}</div>}

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
    { id:"filters",  label:"Filters" + (myFiltersActive ? " \u2022" : "") },
    { id:"members",  label:"Members ("+memberCount+")" },
    { id:"results",  label:"Results" + (recs.length ? " ("+recs.length+")" : "") },
  ];

  return (
    <div style={{ height:"100vh", background:"#f0efe9", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{CSS}</style>

      {/* Topbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e3dc", height:48, display:"flex",
        alignItems:"center", paddingLeft:18, gap:12, flexShrink:0, zIndex:100 }}>
        {/* Hamburger button — visible only on mobile via CSS */}
        <button className="hamburger-btn" onClick={function(){ setDrawerOpen(true); }}
          style={{ display:"none", alignItems:"center", justifyContent:"center",
            width:36, height:36, border:"none", background:"none", cursor:"pointer", padding:0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span style={{ fontSize:14, fontWeight:700, color:"#0f172a", letterSpacing:"-0.02em" }}>CinEmotion</span>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="mobile-drawer-overlay" onClick={function(){ setDrawerOpen(false); }}>
          <div className="mobile-drawer" onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 18px", borderBottom:"1px solid #e5e3dc" }}>
              <span style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>CinEmotion</span>
              <button onClick={function(){ setDrawerOpen(false); }}
                style={{ border:"none", background:"none", cursor:"pointer", fontSize:20, color:"#64748b", padding:"4px" }}>&times;</button>
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              <SidebarContent
                myName={myName} room={roomState}
                currentRoom={currentRoom} onLeave={leaveRoom}
                isAdmin={isAdmin} memberId={memberId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="room-body" style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* LEFT SIDEBAR (desktop only, hidden on mobile via CSS) */}
        <LeftSidebar
          myName={myName} room={roomState}
          currentRoom={currentRoom} onLeave={leaveRoom}
          isAdmin={isAdmin} memberId={memberId}
        />

        {/* RIGHT PANEL */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Tab bar */}
          <div className="tab-bar" style={{ background:"#fff", borderBottom:"1px solid #e5e3dc", display:"flex",
            padding:"0 24px", flexShrink:0 }}>
            {tabs.map(function(t){
              return (
                <button key={t.id} className={"tab-btn"+(activeTab===t.id?" active":"")}
                  onClick={function(){ setActiveTab(t.id); }}>{t.label}</button>
              );
            })}
          </div>

          {/* Tab content — scrollable */}
          <div className="tab-content" style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

            {/* ── SET EMOTIONS ── */}
            {activeTab === "emotions" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:3 }}>Set Your Emotions</div>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>Drag each slider to reflect how you feel right now. Use the full range.</div>
                  </div>
                  <button className="btn-ghost" style={{ flexShrink:0 }}
                    onClick={function(){
                      var d = defaultEmotions();
                      setMyEmotions(d);
                      if (currentRoom && memberId) apiUpdateEmotions(currentRoom, memberId, d);
                    }}>
                    Reset all
                  </button>
                </div>

                {/* 4×6 slider grid */}
                <div className="emotion-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"0 36px",
                  background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"18px 24px" }}>

                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#d97706", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #fef3c7" }}>
                      Positive
                    </div>
                    {COL1.map(function(e){
                      return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
                    })}
                  </div>

                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#0891b2", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #e0f2fe" }}>
                      Social
                    </div>
                    {COL2.map(function(e){
                      return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
                    })}
                  </div>

                  <div>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                      color:"#dc2626", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #fee2e2" }}>
                      Dark
                    </div>
                    {COL3.map(function(e){
                      return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
                    })}
                  </div>

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

                {/* Action bar — sticky */}
                <div style={{ position:"sticky", bottom:0, marginTop:16, zIndex:20,
                  background:"#f0efe9", borderTop:"1px solid #e5e3dc", padding:"14px 0 4px" }}>
                  <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"16px 20px" }}>

                    {/* Ready status bar */}
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
                      <button className={myReady ? "btn-ghost" : "btn-primary"}
                        style={myReady ? { padding:"8px 18px", fontSize:12, color:"#16a34a", borderColor:"#86efac" } : { padding:"8px 18px", fontSize:12, width:"auto", background:"#16a34a" }}
                        onClick={toggleReady}>
                        {myReady ? "Edit My Input" : "I'm Done"}
                      </button>
                      <span style={{
                        fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700,
                        color: readyCount === memberCount ? "#16a34a" : "#b45309",
                        background: readyCount === memberCount ? "#dcfce7" : "#fef3c7",
                        padding:"4px 10px", borderRadius:5,
                      }}>
                        {readyCount}/{memberCount} ready
                      </span>
                      {readyCount === memberCount && memberCount > 0 && (
                        <span style={{ fontSize:11, color:"#16a34a", fontWeight:600 }}>All members ready!</span>
                      )}
                    </div>

                    {/* Strategy + Top N + Get Recs — admin only */}
                    {isAdmin && (
                      <div>
                        <div style={{ marginBottom:14 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8" }}>Group Mood Strategy</span>
                          </div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                            {STRATEGIES.map(function(s){
                              var active = strategy === s.id;
                              return (
                                <button key={s.id} onClick={function(){ handleStrategyChange(s.id); }}
                                  title={s.desc}
                                  style={{
                                    padding:"5px 12px", borderRadius:5, fontSize:11, fontWeight:600,
                                    fontFamily:"'DM Sans',sans-serif", transition:"all 0.12s", whiteSpace:"nowrap",
                                    border: active ? "none" : "1px solid #d1cfc8",
                                    background: active ? "#1e293b" : "none",
                                    color: active ? "#fff" : "#64748b",
                                    cursor: "pointer",
                                  }}>
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                          {STRATEGIES.find(function(s){ return s.id===strategy; }) && (
                            <div style={{ fontSize:11, color:"#94a3b8", marginTop:6, fontStyle:"italic" }}>
                              {STRATEGIES.find(function(s){ return s.id===strategy; }).desc}
                            </div>
                          )}
                        </div>

                        <div className="strategy-bar" style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                          <div style={{ display:"flex", gap:6, flex:1, minWidth:220 }}>
                            {[3,5,7,10].map(function(n){
                              return <button key={n} className={"nbtn"+(topN===n?" active":"")}
                                onClick={function(){ handleTopNChange(n); }}>{n}</button>;
                            })}
                            <input type="number" min={1} max={50} value={topN}
                              onChange={function(e){ handleTopNChange(Math.max(1,Math.min(50,parseInt(e.target.value)||1))); }}
                              className="ifield" style={{ width:54, textAlign:"center", padding:"7px 6px",
                                fontFamily:"'DM Mono',monospace", fontSize:13 }} />
                          </div>
                          <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
                            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:20, fontWeight:700, color:"#1e293b" }}>{topN}</span>
                            <span style={{ fontSize:11, color:"#94a3b8" }}>results</span>
                          </div>
                          <button className="btn-primary" style={{ fontSize:13, padding:"10px 24px", width:"auto" }}
                            onClick={getRecommendations} disabled={loading}>
                            {loading ? "Finding matches..." :
                             "Get Recommendations \u2014 "+memberCount+(memberCount===1?" person":" people")}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Non-admin: just show current strategy */}
                    {!isAdmin && (
                      <div style={{ fontSize:11, color:"#94a3b8" }}>
                        Strategy: <strong style={{ color:"#64748b" }}>{STRATEGIES.find(function(s){ return s.id===strategy; }) ? STRATEGIES.find(function(s){ return s.id===strategy; }).label : strategy}</strong>
                        {" \u2014 "}{topN} results \u2014 Waiting for admin to get recommendations
                      </div>
                    )}

                    {error && <div style={{ fontSize:12, color:"#dc2626", marginTop:8, padding:"6px 10px", background:"#fef2f2", borderRadius:5 }}>{error}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── FILTERS ── */}
            {activeTab === "filters" && (
              <div style={{ maxWidth:680 }}>
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Your Filters</span>
                  </div>
                  <div style={{ fontSize:12, color:"#94a3b8" }}>Choose your preferred era, rating, and genres. Each member sets their own filters independently.</div>
                </div>
                <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"22px 24px" }}>
                  <FilterPanel filters={myFilters} onChange={handleFiltersChange} disabled={false} />
                </div>
                {myFiltersActive && (
                  <button className="btn-ghost" style={{ marginTop:12, fontSize:11 }}
                    onClick={function(){ handleFiltersChange({ eras:[], min_imdb:0, genres:[] }); }}>Clear all filters</button>
                )}

                {/* Number of Results + Get Recommendations — admin only */}
                {isAdmin && (
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
                        return <button key={n} className={"nbtn"+(topN===n?" active":"")}
                          onClick={function(){ handleTopNChange(n); }}>{n}</button>;
                      })}
                      <input type="number" min={1} max={50} value={topN}
                        onChange={function(e){ handleTopNChange(Math.max(1,Math.min(50,parseInt(e.target.value)||1))); }}
                        className="ifield" style={{ width:60, textAlign:"center", padding:"7px 6px", fontFamily:"'DM Mono',monospace", fontSize:13 }} />
                    </div>
                    {error && <div style={{ fontSize:12, color:"#dc2626", marginBottom:10, padding:"8px 12px", background:"#fef2f2", borderRadius:5 }}>{error}</div>}
                    <button className="btn-primary" style={{ fontSize:14, padding:"12px" }}
                      onClick={getRecommendations} disabled={loading}>
                      {loading ? "Finding matches..." :
                       "Get Recommendations \u2014 "+memberCount+(memberCount===1?" person":" people")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── MEMBERS ── */}
            {activeTab === "members" && (
              <div style={{ maxWidth:680 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:3 }}>Room Members</div>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>Share the link or code so others can join</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>{memberCount}/{MAX} slots used</div>
                  </div>
                </div>

                <SharePanel roomId={currentRoom} />

                <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"4px 18px", marginBottom:20 }}>
                  {room && room.members.map(function(m){
                    return <MemberRow key={m.id} member={m} isMe={m.id===memberId} isAdmin={room.admin_id && m.id === room.admin_id} />;
                  })}
                </div>

                {/* Aggregated group emotions */}
                {room && room.members.length > 1 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.08em" }}>Group Emotion Average</div>
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

                {/* Aggregated group filters */}
                {room && room.members.length > 1 && (
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.08em" }}>Aggregated Filters (Union)</div>
                    <div style={{ background:"#fff", border:"1px solid #e5e3dc", borderRadius:10, padding:"18px 24px" }}>
                      {aggregatedFilters.eras.length === 0 && aggregatedFilters.genres.length === 0 && aggregatedFilters.min_imdb === 0 ? (
                        <span style={{ fontSize:11, color:"#94a3b8" }}>No filters set by any member</span>
                      ) : (
                        <div>
                          {aggregatedFilters.eras.length > 0 && (
                            <div style={{ marginBottom:10 }}>
                              <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:6 }}>Eras</div>
                              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                {aggregatedFilters.eras.map(function(e){
                                  var lbl = e==="old"?"\u22641999":e==="mid"?"2000\u201310":"2011+";
                                  return <span key={e} style={{ fontSize:10, background:"#f1f5f9", color:"#475569", padding:"2px 7px", borderRadius:4, fontWeight:500 }}>{lbl}</span>;
                                })}
                              </div>
                            </div>
                          )}
                          {aggregatedFilters.min_imdb > 0 && (
                            <div style={{ marginBottom:10 }}>
                              <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:6 }}>Min IMDb</div>
                              <span style={{ fontSize:10, background:"#fffbeb", color:"#b45309", padding:"2px 7px", borderRadius:4, fontWeight:500 }}>
                                IMDb \u2265 {aggregatedFilters.min_imdb}
                              </span>
                            </div>
                          )}
                          {aggregatedFilters.genres.length > 0 && (
                            <div>
                              <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:6 }}>Genres</div>
                              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                {aggregatedFilters.genres.map(function(g){
                                  return <span key={g} style={{ fontSize:10, background:"#f1f5f9", color:"#475569", padding:"2px 7px", borderRadius:4, fontWeight:500 }}>{g}</span>;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Per-member filter breakdown */}
                      <div style={{ marginTop:14, borderTop:"1px solid #e8e6df", paddingTop:12 }}>
                        <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:8 }}>Per-Member Filters</div>
                        {room.members.map(function(m) {
                          var f = m.filters || defaultFilters();
                          var hasFilters = (f.eras && f.eras.length > 0) || f.min_imdb > 0 || (f.genres && f.genres.length > 0);
                          return (
                            <div key={m.id} style={{ marginBottom:8, paddingBottom:8, borderBottom:"1px solid #f0efe9" }}>
                              <div style={{ fontSize:12, fontWeight:600, color:"#1e293b", marginBottom:4 }}>
                                {m.name}
                                {m.id === memberId && <span style={{ fontSize:10, color:"#0ea5e9", marginLeft:5 }}>YOU</span>}
                              </div>
                              {!hasFilters ? (
                                <span style={{ fontSize:10, color:"#94a3b8" }}>No filters</span>
                              ) : (
                                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                                  {f.eras && f.eras.map(function(e){
                                    var lbl = e==="old"?"\u22641999":e==="mid"?"2000\u201310":"2011+";
                                    return <span key={e} style={{ fontSize:9, background:"#f1f5f9", color:"#475569", padding:"1px 6px", borderRadius:3 }}>{lbl}</span>;
                                  })}
                                  {f.min_imdb > 0 && <span style={{ fontSize:9, background:"#fffbeb", color:"#b45309", padding:"1px 6px", borderRadius:3 }}>IMDb \u2265{f.min_imdb}</span>}
                                  {f.genres && f.genres.map(function(g){
                                    return <span key={g} style={{ fontSize:9, background:"#f1f5f9", color:"#475569", padding:"1px 6px", borderRadius:3 }}>{g}</span>;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
                    <div style={{ fontSize:40, fontWeight:700, color:"#e2e0d8", marginBottom:12, letterSpacing:"-0.05em" }}>\u2014</div>
                    <div style={{ fontSize:14, fontWeight:500, color:"#64748b", marginBottom:5 }}>No results yet</div>
                    <div style={{ fontSize:12 }}>
                      {isAdmin ? "Go to Set Emotions and click Get Recommendations" : "Waiting for admin to get recommendations"}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", marginBottom:4 }}>
                          Top {recs.length} for {memberCount===1 ? myName : memberCount+" people"}
                        </div>
                        {results && results.strategy_label && (
                          <div style={{ fontSize:11, color:"#64748b", marginBottom:4,
                            background:"#f8fafc", border:"1px solid #e2e8f0",
                            borderRadius:5, padding:"3px 9px", display:"inline-block" }}>
                            Strategy: <strong>{results.strategy_label}</strong>
                          </div>
                        )}
                        {results && results.group_avg_emotions && (
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
