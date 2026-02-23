import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5000";

const EMOTIONS = [
  "joy","sadness","fear","anger","disgust","surprise","trust",
  "anticipation","curiosity","excitement","hope","love","guilt",
  "shame","gratitude","loneliness","confidence","determination",
  "regret","relief","nostalgia","compassion","anxiety","inspiration",
];

const EMOTION_META = {
  joy:           { emoji: "😊", color: "#FFD700" },
  sadness:       { emoji: "😢", color: "#6495ED" },
  fear:          { emoji: "😰", color: "#9370DB" },
  anger:         { emoji: "😡", color: "#FF4500" },
  disgust:       { emoji: "🤢", color: "#228B22" },
  surprise:      { emoji: "😮", color: "#FF8C00" },
  trust:         { emoji: "🤝", color: "#20B2AA" },
  anticipation:  { emoji: "🤩", color: "#FF69B4" },
  curiosity:     { emoji: "🔍", color: "#4169E1" },
  excitement:    { emoji: "⚡", color: "#FF6347" },
  hope:          { emoji: "🌟", color: "#32CD32" },
  love:          { emoji: "❤️", color: "#DC143C" },
  guilt:         { emoji: "😔", color: "#808080" },
  shame:         { emoji: "😳", color: "#BC8F8F" },
  gratitude:     { emoji: "🙏", color: "#DAA520" },
  loneliness:    { emoji: "🌙", color: "#483D8B" },
  confidence:    { emoji: "💪", color: "#FF8C00" },
  determination: { emoji: "🎯", color: "#B22222" },
  regret:        { emoji: "😞", color: "#708090" },
  relief:        { emoji: "😌", color: "#3CB371" },
  nostalgia:     { emoji: "🕰️", color: "#CD853F" },
  compassion:    { emoji: "💖", color: "#DB7093" },
  anxiety:       { emoji: "😬", color: "#8B4513" },
  inspiration:   { emoji: "✨", color: "#00CED1" },
};

const GENRE_OPTIONS = [
  "Action","Adventure","Animation","Biography","Comedy","Crime",
  "Documentary","Drama","Fantasy","History","Horror","Musical",
  "Mystery","Romance","Sci-Fi","Sport","Thriller","War","Western",
];

function genRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function defaultEmotions() {
  const obj = {};
  EMOTIONS.forEach(function(e) { obj[e] = 5; });
  return obj;
}

async function apiRecommend(members, topN, filters) {
  const res = await fetch(API_BASE + "/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ members: members, top_n: topN, filters: filters }),
  });
  if (!res.ok) {
    const err = await res.json().catch(function() { return {}; });
    throw new Error(err.error || ("HTTP " + res.status));
  }
  return res.json();
}

async function apiHealth() {
  const res = await fetch(API_BASE + "/health");
  return res.json();
}

function EmotionSlider(props) {
  const emotion = props.emotion;
  const value = props.value;
  const onChange = props.onChange;
  const meta = EMOTION_META[emotion];
  const pct = (value / 10) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 4 }}>
        <span style={{ fontSize:13, color:"#e2e8f0", display:"flex", alignItems:"center", gap:6, textTransform:"capitalize" }}>
          <span style={{ fontSize:16 }}>{meta.emoji}</span>{emotion}
        </span>
        <span style={{
          fontSize:13, fontWeight:700,
          color: meta.color, background: meta.color + "20",
          padding:"1px 8px", borderRadius:4, minWidth:32, textAlign:"center",
        }}>{value}</span>
      </div>
      <div style={{ position:"relative", height:8, borderRadius:99, background:"#1e293b" }}>
        <div style={{
          position:"absolute", left:0, top:0, height:"100%", borderRadius:99,
          width: pct + "%",
          background: "linear-gradient(90deg," + meta.color + "88," + meta.color + ")",
          transition:"width 0.1s",
          boxShadow: "0 0 8px " + meta.color + "55",
        }} />
        <input
          type="range" min={0} max={10} step={0.5} value={value}
          onChange={function(e) { onChange(emotion, parseFloat(e.target.value)); }}
          style={{
            position:"absolute", top:"50%", left:0, transform:"translateY(-50%)",
            width:"100%", height:24, opacity:0, cursor:"pointer", margin:0, padding:0,
          }}
        />
      </div>
    </div>
  );
}

function MemberCard(props) {
  const member = props.member;
  const isMe = props.isMe;
  const entries = Object.entries(member.emotions);
  entries.sort(function(a, b) { return b[1] - a[1]; });
  const top = entries.slice(0, 3);
  return (
    <div style={{
      background:"linear-gradient(135deg,#0f172a,#1e293b)",
      border: "1px solid " + (isMe ? "#6366f1" : "#334155"),
      borderRadius:12, padding:"14px 16px", marginBottom:10,
      boxShadow: isMe ? "0 0 16px #6366f140" : "none",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
        <div style={{
          width:32, height:32, borderRadius:"50%", display:"flex",
          alignItems:"center", justifyContent:"center",
          background: isMe ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "linear-gradient(135deg,#334155,#475569)",
          fontSize:14, fontWeight:700, color:"white",
        }}>{member.name[0].toUpperCase()}</div>
        <span style={{ color: isMe ? "#a5b4fc" : "#94a3b8", fontSize:14, fontWeight:600 }}>
          {member.name}
          {isMe && (
            <span style={{ fontSize:10, color:"#6366f1", background:"#6366f120", padding:"1px 6px", borderRadius:4, marginLeft:6 }}>
              you
            </span>
          )}
        </span>
      </div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {top.map(function(item) {
          const e = item[0];
          const v = item[1];
          const m = EMOTION_META[e];
          return (
            <span key={e} style={{
              fontSize:11, padding:"2px 7px", borderRadius:99,
              background: m.color + "20", color: m.color,
              border: "1px solid " + m.color + "40",
            }}>{m.emoji} {e} {v}</span>
          );
        })}
      </div>
    </div>
  );
}

function MovieCard(props) {
  const result = props.result;
  const rank = props.rank;
  const cols = ["#FFD700","#C0C0C0","#CD7F32","#94a3b8","#94a3b8"];
  const c = cols[Math.min(rank, cols.length - 1)];
  const genreStr = result.genres || "";
  const genres = genreStr.split("|").slice(0, 3);
  return (
    <div style={{
      background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",
      border:"1px solid #334155", borderRadius:16, padding:"18px 20px", marginBottom:12,
      position:"relative", overflow:"hidden",
      boxShadow: rank === 0 ? "0 0 30px #FFD70028" : "0 2px 12px #00000040",
    }}>
      <div style={{
        position:"absolute", right:-16, top:-16, width:80, height:80, borderRadius:"50%",
        background: "radial-gradient(circle," + c + "18,transparent 70%)", pointerEvents:"none",
      }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <span style={{ fontSize:20, fontWeight:900, color:c }}># {result.rank}</span>
            <span style={{ fontSize:16, fontWeight:700, color:"#f1f5f9" }}>{result.title}</span>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:8 }}>
            <span style={{ color:"#64748b", fontSize:12 }}>{result.year}</span>
            {genres.map(function(g) {
              return (
                <span key={g} style={{
                  fontSize:11, padding:"2px 7px", borderRadius:99,
                  background:"#6366f120", color:"#818cf8", border:"1px solid #6366f130",
                }}>{g}</span>
              );
            })}
            {result.imdb && (
              <span style={{ fontSize:12, color:"#FCD34D" }}>★ {result.imdb}</span>
            )}
          </div>
          {result.dominant_emotions && result.dominant_emotions.length > 0 && (
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {result.dominant_emotions.map(function(de) {
                const dm = EMOTION_META[de.emotion];
                if (!dm) return null;
                return (
                  <span key={de.emotion} style={{
                    fontSize:10, padding:"1px 6px", borderRadius:99,
                    background: dm.color + "15", color: dm.color,
                  }}>{dm.emoji} {de.emotion}</span>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ textAlign:"right", minWidth:56 }}>
          <div style={{ fontSize:26, fontWeight:900, color:c, lineHeight:1 }}>{result.match_percent}%</div>
          <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>match</div>
        </div>
      </div>
      <div style={{ marginTop:10, height:3, borderRadius:99, background:"#1e293b" }}>
        <div style={{
          height:"100%", borderRadius:99,
          width: result.match_percent + "%",
          background: "linear-gradient(90deg," + c + "88," + c + ")",
          boxShadow: "0 0 6px " + c + "66",
          transition:"width 1s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </div>
  );
}

function Chip(props) {
  const col = props.color || "#6366f1";
  return (
    <button onClick={props.onClick} style={{
      padding:"4px 10px", borderRadius:99,
      border: "1px solid " + (props.active ? col : "#334155"),
      background: props.active ? col + "20" : "transparent",
      color: props.active ? col : "#64748b",
      fontSize:12, cursor:"pointer", transition:"all 0.15s",
    }}>{props.label}</button>
  );
}

function FilterPanel(props) {
  const filters = props.filters;
  const onChange = props.onChange;

  function toggle(key, val) {
    const arr = filters[key] || [];
    const next = arr.includes(val)
      ? arr.filter(function(x) { return x !== val; })
      : arr.concat([val]);
    const updated = {};
    Object.keys(filters).forEach(function(k) { updated[k] = filters[k]; });
    updated[key] = next;
    onChange(updated);
  }

  return (
    <div style={{ padding:"16px", background:"#0f172a", borderRadius:14, border:"1px solid #1e293b", marginBottom:20 }}>
      <div style={{ fontSize:12, color:"#64748b", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Filters</div>

      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, color:"#475569", marginBottom:7 }}>Era</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["old","mid","new"].map(function(e) {
            const lbl = e === "old" ? "1999 and before" : e === "mid" ? "2000 to 2010" : "2011 and after";
            const eras = filters.eras || [];
            return (
              <Chip key={e} label={lbl} active={eras.includes(e)}
                onClick={function() { toggle("eras", e); }} color="#818cf8" />
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
          <span style={{ fontSize:12, color:"#475569" }}>Min IMDB</span>
          <span style={{ fontSize:13, fontWeight:700, color:"#FCD34D" }}>{filters.min_imdb || 0}</span>
        </div>
        <div style={{ position:"relative", height:8, borderRadius:99, background:"#1e293b" }}>
          <div style={{
            position:"absolute", left:0, top:0, height:"100%", borderRadius:99,
            width: (((filters.min_imdb || 0) / 10) * 100) + "%",
            background:"linear-gradient(90deg,#FCD34D88,#FCD34D)",
          }} />
          <input type="range" min={0} max={10} step={0.5} value={filters.min_imdb || 0}
            onChange={function(e) {
              const updated = {};
              Object.keys(filters).forEach(function(k) { updated[k] = filters[k]; });
              updated.min_imdb = parseFloat(e.target.value);
              onChange(updated);
            }}
            style={{ position:"absolute", top:"50%", left:0, transform:"translateY(-50%)",
              width:"100%", height:24, opacity:0, cursor:"pointer", margin:0, padding:0 }} />
        </div>
      </div>

      <div>
        <div style={{ fontSize:12, color:"#475569", marginBottom:7 }}>Genres</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {GENRE_OPTIONS.map(function(g) {
            const gs = filters.genres || [];
            return (
              <Chip key={g} label={g} active={gs.includes(g)}
                onClick={function() { toggle("genres", g); }} color="#a78bfa" />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ApiStatusBadge(props) {
  const status = props.status;
  const cfgMap = {
    checking: { color:"#94a3b8", dot:"#94a3b8", label:"Checking API..." },
    online:   { color:"#22c55e", dot:"#22c55e", label:"API Online" },
    offline:  { color:"#ef4444", dot:"#ef4444", label:"API Offline - run app.py" },
  };
  const cfg = cfgMap[status] || cfgMap.checking;
  return (
    <span style={{
      fontSize:11, color:cfg.color, background: cfg.dot + "15",
      border: "1px solid " + cfg.dot + "30", padding:"2px 10px", borderRadius:99,
      display:"inline-flex", alignItems:"center", gap:5,
    }}>
      <span style={{
        width:6, height:6, borderRadius:"50%", background:cfg.dot, display:"inline-block",
        boxShadow: status === "online" ? ("0 0 6px " + cfg.dot) : "none",
      }} />
      {cfg.label}
    </span>
  );
}

export default function App() {
  const [rooms, setRooms]             = useState({});
  const [currentRoom, setCurrentRoom] = useState(null);
  const [myName, setMyName]           = useState("");
  const [joinCode, setJoinCode]       = useState("");
  const [nameInput, setNameInput]     = useState("");
  const [view, setView]               = useState("home");
  const [activeTab, setActiveTab]     = useState("emotions");
  const [myEmotions, setMyEmotions]   = useState(defaultEmotions);
  const [topN, setTopN]               = useState(5);
  const [filters, setFilters]         = useState({ eras:[], min_imdb:0, genres:[] });
  const [results, setResults]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [apiStatus, setApiStatus]     = useState("checking");
  const [showFilters, setShowFilters] = useState(false);

  const MAX = 10;

  useEffect(function() {
    apiHealth()
      .then(function() { setApiStatus("online"); })
      .catch(function() { setApiStatus("offline"); });
  }, []);

  function syncEmotionsToRoom(emotions) {
    setRooms(function(prev) {
      if (!currentRoom || !prev[currentRoom]) return prev;
      const room = prev[currentRoom];
      const members = room.members.map(function(m) {
        if (m.name !== myName) return m;
        const updated = {};
        Object.keys(m).forEach(function(k) { updated[k] = m[k]; });
        updated.emotions = {};
        Object.keys(emotions).forEach(function(k) { updated.emotions[k] = emotions[k]; });
        return updated;
      });
      const updatedRoom = {};
      Object.keys(room).forEach(function(k) { updatedRoom[k] = room[k]; });
      updatedRoom.members = members;
      const updatedRooms = {};
      Object.keys(prev).forEach(function(k) { updatedRooms[k] = prev[k]; });
      updatedRooms[currentRoom] = updatedRoom;
      return updatedRooms;
    });
  }

  const handleEmotionChange = useCallback(function(emotion, value) {
    setMyEmotions(function(prev) {
      const next = {};
      Object.keys(prev).forEach(function(k) { next[k] = prev[k]; });
      next[emotion] = value;
      setRooms(function(prevRooms) {
        if (!currentRoom || !prevRooms[currentRoom]) return prevRooms;
        const room = prevRooms[currentRoom];
        const members = room.members.map(function(m) {
          if (m.name !== myName) return m;
          const upd = {};
          Object.keys(m).forEach(function(k) { upd[k] = m[k]; });
          upd.emotions = {};
          Object.keys(next).forEach(function(k) { upd.emotions[k] = next[k]; });
          return upd;
        });
        const upRoom = {};
        Object.keys(room).forEach(function(k) { upRoom[k] = room[k]; });
        upRoom.members = members;
        const upRooms = {};
        Object.keys(prevRooms).forEach(function(k) { upRooms[k] = prevRooms[k]; });
        upRooms[currentRoom] = upRoom;
        return upRooms;
      });
      return next;
    });
  }, [currentRoom, myName]);

  function createRoom() {
    if (!nameInput.trim()) { setError("Enter your name first"); return; }
    const id = genRoomId();
    const emo = {};
    Object.keys(myEmotions).forEach(function(k) { emo[k] = myEmotions[k]; });
    const me = { id: Date.now(), name: nameInput.trim(), emotions: emo };
    setRooms(function(prev) {
      const next = {};
      Object.keys(prev).forEach(function(k) { next[k] = prev[k]; });
      next[id] = { id: id, members: [me] };
      return next;
    });
    setMyName(nameInput.trim());
    setCurrentRoom(id);
    setView("room");
    setError("");
  }

  function joinRoom() {
    if (!nameInput.trim()) { setError("Enter your name first"); return; }
    const rid = joinCode.trim().toUpperCase();
    if (!rooms[rid]) { setError("Room not found."); return; }
    if (rooms[rid].members.length >= MAX) { setError("Room is full (10/10)."); return; }
    const nameLower = nameInput.trim().toLowerCase();
    const dup = rooms[rid].members.find(function(m) { return m.name.toLowerCase() === nameLower; });
    if (dup) { setError("Name already taken in this room."); return; }
    const emo = {};
    Object.keys(myEmotions).forEach(function(k) { emo[k] = myEmotions[k]; });
    const me = { id: Date.now(), name: nameInput.trim(), emotions: emo };
    setRooms(function(prev) {
      const room = prev[rid];
      const upRoom = {};
      Object.keys(room).forEach(function(k) { upRoom[k] = room[k]; });
      upRoom.members = room.members.concat([me]);
      const next = {};
      Object.keys(prev).forEach(function(k) { next[k] = prev[k]; });
      next[rid] = upRoom;
      return next;
    });
    setMyName(nameInput.trim());
    setCurrentRoom(rid);
    setView("room");
    setError("");
  }

  function leaveRoom() {
    const leaving = currentRoom;
    const leavingName = myName;
    setRooms(function(prev) {
      if (!prev[leaving]) return prev;
      const room = prev[leaving];
      const members = room.members.filter(function(m) { return m.name !== leavingName; });
      const next = {};
      Object.keys(prev).forEach(function(k) { next[k] = prev[k]; });
      if (members.length === 0) {
        delete next[leaving];
      } else {
        const upRoom = {};
        Object.keys(room).forEach(function(k) { upRoom[k] = room[k]; });
        upRoom.members = members;
        next[leaving] = upRoom;
      }
      return next;
    });
    setCurrentRoom(null);
    setView("home");
    setResults(null);
    setMyEmotions(defaultEmotions());
    setActiveTab("emotions");
  }

  async function handleGetRecommendations() {
    if (apiStatus === "offline") { setError("Flask API is offline. Run: python app.py"); return; }
    const room = rooms[currentRoom];
    if (!room || room.members.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiRecommend(room.members, topN, filters);
      setResults(data);
      setActiveTab("results");
    } catch(e) {
      setError("API Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const room = currentRoom ? rooms[currentRoom] : null;
  const memberCount = room ? room.members.length : 0;

  const GLOBAL_CSS = "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=Syne+Mono&display=swap'); * { box-sizing: border-box; } body { margin: 0; } input:focus, button:focus { outline: none; } button:active { transform: scale(0.97); } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0f172a; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 99px; }";

  const appStyle   = { minHeight:"100vh", background:"#020817", color:"#f1f5f9", fontFamily:"'Syne',sans-serif" };
  const wrapStyle  = { position:"relative", zIndex:1, maxWidth:500, margin:"0 auto", padding:"0 16px 60px" };
  const glow1Style = { position:"fixed", pointerEvents:"none", zIndex:0, top:"-20%", left:"-10%", width:"60%", height:"60%", borderRadius:"50%", background:"radial-gradient(ellipse,#6366f118 0%,transparent 70%)" };
  const glow2Style = { position:"fixed", pointerEvents:"none", zIndex:0, bottom:"-20%", right:"-10%", width:"60%", height:"60%", borderRadius:"50%", background:"radial-gradient(ellipse,#8b5cf618 0%,transparent 70%)" };

  if (view === "home") {
    return (
      <div style={appStyle}>
        <style>{GLOBAL_CSS}</style>
        <div style={glow1Style} /><div style={glow2Style} />
        <div style={Object.assign({}, wrapStyle, { paddingTop:56 })}>

          <div style={{ textAlign:"center", marginBottom:44 }}>
            <div style={{ fontSize:52, marginBottom:10 }}>🎬</div>
            <h1 style={{
              fontSize:38, fontWeight:900, lineHeight:1.1, margin:"0 0 10px",
              background:"linear-gradient(135deg,#f1f5f9 0%,#818cf8 60%,#c084fc 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            }}>CineEmotion</h1>
            <p style={{ color:"#64748b", fontSize:14, margin:"0 0 16px", lineHeight:1.6 }}>
              group movie recommendations<br />powered by collective emotions
            </p>
            <ApiStatusBadge status={apiStatus} />
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:11, color:"#64748b", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:7 }}>Your Name</label>
            <input value={nameInput}
              onChange={function(e) { setNameInput(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") createRoom(); }}
              placeholder="Enter your name..."
              style={{ width:"100%", padding:"12px 16px", borderRadius:12, background:"#0f172a",
                border:"1px solid #334155", color:"#f1f5f9", fontSize:15 }} />
          </div>

          <button onClick={createRoom} style={{
            width:"100%", padding:14, borderRadius:12, marginBottom:14,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            border:"none", color:"white", fontSize:15, fontWeight:700, cursor:"pointer",
            boxShadow:"0 0 24px #6366f138",
          }}>✨ Create New Room</button>

          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
            <div style={{ flex:1, height:1, background:"#1e293b" }} />
            <span style={{ color:"#475569", fontSize:11 }}>or join existing</span>
            <div style={{ flex:1, height:1, background:"#1e293b" }} />
          </div>

          <div style={{ display:"flex", gap:10, marginBottom:4 }}>
            <input value={joinCode}
              onChange={function(e) { setJoinCode(e.target.value.toUpperCase()); }}
              onKeyDown={function(e) { if (e.key === "Enter") joinRoom(); }}
              placeholder="ROOM CODE" maxLength={6}
              style={{ flex:1, padding:"12px 16px", borderRadius:12, background:"#0f172a",
                border:"1px solid #334155", color:"#f1f5f9", fontSize:16, letterSpacing:"0.15em" }} />
            <button onClick={joinRoom} style={{
              padding:"12px 18px", borderRadius:12, background:"#1e293b",
              border:"1px solid #334155", color:"#94a3b8", fontSize:14, cursor:"pointer", fontWeight:600,
            }}>Join</button>
          </div>

          {error && <div style={{ color:"#f87171", fontSize:13, marginTop:10, textAlign:"center" }}>{error}</div>}

          {Object.keys(rooms).length > 0 && (
            <div style={{ marginTop:32 }}>
              <div style={{ fontSize:11, color:"#64748b", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Active Rooms</div>
              {Object.values(rooms).map(function(r) {
                return (
                  <div key={r.id} style={{
                    background:"#0f172a", border:"1px solid #1e293b", borderRadius:10,
                    padding:"10px 14px", marginBottom:8,
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                  }}>
                    <span style={{ fontSize:16, fontWeight:700, color:"#818cf8", letterSpacing:"0.1em" }}>{r.id}</span>
                    <span style={{ color:"#64748b", fontSize:13 }}>{r.members.length}/{MAX} members</span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop:40, padding:"16px", borderRadius:14, background:"#0f172a", border:"1px solid #1e293b" }}>
            <div style={{ fontSize:11, color:"#64748b", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Backend Setup</div>
            <div style={{ fontSize:12, color:"#475569", lineHeight:2 }}>
              <div style={{ color:"#22c55e" }}>pip install flask flask-cors pandas numpy</div>
              <div style={{ color:"#818cf8" }}>python app.py</div>
              <div style={{ color:"#64748b", marginTop:4 }}>Place movies_dataset_500.csv next to app.py</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id:"emotions", label:"Emotions" },
    { id:"members",  label:"Members (" + memberCount + "/" + MAX + ")" },
    { id:"results",  label:"Results" + (results ? " (" + (results.recommendations ? results.recommendations.length : 0) + ")" : "") },
  ];

  return (
    <div style={appStyle}>
      <style>{GLOBAL_CSS}</style>
      <div style={glow1Style} /><div style={glow2Style} />

      <div style={{
        position:"sticky", top:0, zIndex:100,
        background:"#020817", borderBottom:"1px solid #1e293b",
        padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>🎬</span>
            <span style={{ fontSize:18, fontWeight:700, color:"#818cf8", letterSpacing:"0.15em" }}>{currentRoom}</span>
            <span style={{ fontSize:11, color:"#22c55e", background:"#22c55e15",
              border:"1px solid #22c55e30", padding:"1px 7px", borderRadius:99 }}>
              {memberCount}/{MAX}
            </span>
          </div>
          <div style={{ color:"#475569", fontSize:11, marginTop:2 }}>
            {myName} · <ApiStatusBadge status={apiStatus} />
          </div>
        </div>
        <button onClick={leaveRoom} style={{
          background:"none", border:"1px solid #334155", borderRadius:8,
          color:"#64748b", padding:"6px 12px", fontSize:12, cursor:"pointer",
        }}>Leave</button>
      </div>

      <div style={{ display:"flex", borderBottom:"1px solid #1e293b", background:"#020817", position:"sticky", top:57, zIndex:99 }}>
        {tabs.map(function(t) {
          return (
            <button key={t.id} onClick={function() { setActiveTab(t.id); }} style={{
              flex:1, padding:"12px 4px", border:"none", cursor:"pointer",
              fontSize:12, fontWeight:600, background:"none",
              color: activeTab === t.id ? "#818cf8" : "#475569",
              borderBottom: activeTab === t.id ? "2px solid #6366f1" : "2px solid transparent",
              transition:"all 0.2s",
            }}>{t.label}</button>
          );
        })}
      </div>

      <div style={Object.assign({}, wrapStyle, { paddingTop:20 })}>

        {activeTab === "emotions" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <span style={{ color:"#64748b", fontSize:13 }}>Set your emotional vibe</span>
              <button onClick={function() { const d = defaultEmotions(); setMyEmotions(d); syncEmotionsToRoom(d); }}
                style={{ background:"none", border:"1px solid #334155", borderRadius:8,
                  color:"#64748b", padding:"4px 10px", fontSize:12, cursor:"pointer" }}>
                reset
              </button>
            </div>

            {EMOTIONS.map(function(e) {
              return <EmotionSlider key={e} emotion={e} value={myEmotions[e]} onChange={handleEmotionChange} />;
            })}

            <div style={{ marginTop:24 }}>
              <button onClick={function() { setShowFilters(function(p) { return !p; }); }} style={{
                width:"100%", padding:"10px", borderRadius:10, marginBottom:12,
                background:"#0f172a", border:"1px solid #334155",
                color: showFilters ? "#818cf8" : "#64748b", fontSize:13,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              }}>
                {showFilters ? "Hide Filters" : "Show Filters"}
                {(filters.eras.length > 0 || filters.min_imdb > 0 || filters.genres.length > 0) && (
                  <span style={{ fontSize:10, background:"#6366f120", color:"#818cf8",
                    border:"1px solid #6366f130", padding:"1px 7px", borderRadius:99 }}>active</span>
                )}
              </button>
              {showFilters && <FilterPanel filters={filters} onChange={setFilters} />}
            </div>

            <div style={{ padding:"20px", borderRadius:16, background:"#0f172a", border:"1px solid #1e293b" }}>
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <label style={{ fontSize:11, color:"#64748b", letterSpacing:"0.1em", textTransform:"uppercase" }}>Recommendations</label>
                  <span style={{ color:"#818cf8", fontWeight:700, fontSize:18 }}>{topN}</span>
                </div>
                <div style={{ display:"flex", gap:7, marginBottom:8 }}>
                  {[3,5,7,10].map(function(n) {
                    return (
                      <button key={n} onClick={function() { setTopN(n); }} style={{
                        flex:1, padding:"8px 0", borderRadius:8,
                        border: topN === n ? "2px solid #6366f1" : "1px solid #334155",
                        background: topN === n ? "#6366f120" : "transparent",
                        color: topN === n ? "#818cf8" : "#64748b",
                        fontSize:15, fontWeight:700, cursor:"pointer",
                      }}>{n}</button>
                    );
                  })}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color:"#475569", whiteSpace:"nowrap" }}>Custom:</span>
                  <input type="number" min={1} max={50} value={topN}
                    onChange={function(e) { setTopN(Math.max(1, Math.min(50, parseInt(e.target.value) || 1))); }}
                    style={{ width:70, padding:"6px 10px", borderRadius:8, background:"#020817",
                      border:"1px solid #334155", color:"#94a3b8", fontSize:15, textAlign:"center" }} />
                  <span style={{ fontSize:11, color:"#475569" }}>max 50</span>
                </div>
              </div>

              {error && (
                <div style={{ color:"#f87171", fontSize:12, marginBottom:12,
                  padding:"8px 12px", background:"#f8717115", borderRadius:8, border:"1px solid #f8717130" }}>
                  {error}
                </div>
              )}

              <button onClick={handleGetRecommendations} disabled={loading} style={{
                width:"100%", padding:14, borderRadius:12,
                background: loading ? "#334155" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                border:"none", color:"white", fontSize:15, fontWeight:700,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 24px #6366f138",
                transition:"all 0.2s",
              }}>
                {loading ? "Getting recommendations..." : "Recommend for " + memberCount + (memberCount === 1 ? " person" : " people")}
              </button>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div>
            <div style={{
              marginBottom:16, padding:"16px", borderRadius:12,
              background:"linear-gradient(135deg,#0f172a,#1e293b)",
              border:"1px solid #6366f130",
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <div>
                <div style={{ fontSize:10, color:"#64748b", marginBottom:4, letterSpacing:"0.1em", textTransform:"uppercase" }}>Share Room Code</div>
                <div style={{ fontSize:28, fontWeight:900, color:"#818cf8", letterSpacing:"0.25em" }}>{currentRoom}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:10, color:"#64748b", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>Capacity</div>
                <div style={{ fontSize:22, fontWeight:700, color:"#94a3b8" }}>
                  {memberCount}<span style={{ color:"#334155" }}>/{MAX}</span>
                </div>
              </div>
            </div>

            {room && room.members.length > 1 && (
              <div style={{ marginBottom:18, padding:"16px", borderRadius:12, background:"#0f172a", border:"1px solid #1e293b" }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.1em" }}>
                  Group Emotion Average
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {EMOTIONS.map(function(e) {
                    const avg = room.members.reduce(function(s, m) { return s + m.emotions[e]; }, 0) / room.members.length;
                    const op = avg / 10;
                    const hexVal = Math.round(op * 255).toString(16).padStart(2, "0");
                    const meta = EMOTION_META[e];
                    return (
                      <span key={e} style={{
                        fontSize:11, padding:"3px 8px", borderRadius:99,
                        background: meta.color + hexVal,
                        color: op > 0.45 ? "#fff" : meta.color,
                        border: "1px solid " + meta.color + "40",
                        opacity: 0.35 + op * 0.65,
                      }}>
                        {meta.emoji} {avg.toFixed(1)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {room && room.members.map(function(m) {
              return <MemberCard key={m.id} member={m} isMe={m.name === myName} />;
            })}
          </div>
        )}

        {activeTab === "results" && (
          <div>
            {!results ? (
              <div style={{ textAlign:"center", padding:"60px 20px" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🎬</div>
                <div style={{ color:"#334155", fontSize:14, lineHeight:1.8 }}>
                  No recommendations yet.<br />
                  <span style={{ color:"#475569" }}>Set emotions and click Recommend.</span>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom:20, padding:"14px 16px", borderRadius:12, background:"#0f172a", border:"1px solid #1e293b" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:10, color:"#64748b", marginBottom:3, textTransform:"uppercase", letterSpacing:"0.1em" }}>
                        Group of {results.group_size}
                      </div>
                      <div style={{ color:"#94a3b8", fontSize:14, fontWeight:600 }}>
                        {room ? room.members.map(function(m) { return m.name; }).join(", ") : ""}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:24, color:"#818cf8", fontWeight:900, lineHeight:1 }}>
                        {results.recommendations ? results.recommendations.length : 0}
                      </div>
                      <div style={{ fontSize:10, color:"#475569" }}>results</div>
                    </div>
                  </div>
                  {results.group_avg_emotions && (
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {Object.entries(results.group_avg_emotions)
                        .sort(function(a, b) { return b[1] - a[1]; })
                        .slice(0, 5)
                        .map(function(item) {
                          const e = item[0];
                          const v = item[1];
                          const meta = EMOTION_META[e];
                          return (
                            <span key={e} style={{
                              fontSize:11, padding:"2px 8px", borderRadius:99,
                              background: meta.color + "20", color: meta.color,
                              border: "1px solid " + meta.color + "40",
                            }}>{meta.emoji} {e} {v}</span>
                          );
                        })}
                    </div>
                  )}
                </div>

                {results.recommendations && results.recommendations.map(function(r, i) {
                  return <MovieCard key={r.title + i} result={r} rank={i} />;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}