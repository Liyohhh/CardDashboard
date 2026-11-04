/* Card Night Champions — all data lives in localStorage (no server needed). */
const KEY = "card-champions-v1";
const PALETTE = ["#ff5c8a", "#ff8a3d", "#ffb800", "#22c55e", "#14c3b0", "#1f9bff", "#5b6cff", "#a259ff", "#ff4dd2", "#00b8d9", "#8d6e63", "#3a3f4b"];
const FACES = { smile: "Smile", happy: "Happy", wink: "Wink", cool: "Cool", sleepy: "Sleepy", none: "Plain" };


const uid = () => Math.random().toString(36).slice(2, 10);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
// each icon copy gets its own gradient ids, so hidden copies never blank out visible ones
let icN = 0;
const uniq = (svg) => { const n = (++icN).toString(36); return svg.replace(/id="([^"]+)"/g, `id="$1_${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1_${n})`).replace(/href="#([^"]+)"/g, `href="#$1_${n}"`); };
const iconSvg = (name) => ICONS[name] || ICONS[ICON_ALIAS[name]] || ICONS.cards;
const ic = (name, cls = "") => `<i class="ic ${cls}">${uniq(iconSvg(name))}</i>`;

/* ---------------- Avatars: coloured profile head ---------------- */
function tint(hex, amt = 0.8) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}
function faceSvg(face) {
  const ink = 'fill="#2d3142"', line = 'stroke="#2d3142" stroke-width="1.6" stroke-linecap="round" fill="none"';
  const cheeks = '<circle cx="18.2" cy="22" r="1.8" fill="#ff8fab" opacity=".7"/><circle cx="29.8" cy="22" r="1.8" fill="#ff8fab" opacity=".7"/>';
  switch (face) {
    case "smile": return `<circle cx="20.5" cy="18.5" r="1.4" ${ink}/><circle cx="27.5" cy="18.5" r="1.4" ${ink}/><path d="M21 22.3q3 2.6 6 0" ${line}/>${cheeks}`;
    case "happy": return `<path d="M19 19q1.5-2 3 0M26 19q1.5-2 3 0" ${line}/><path d="M20.5 21.8q3.5 4.2 7 0z" fill="#2d3142"/>${cheeks}`;
    case "wink": return `<circle cx="20.5" cy="18.5" r="1.4" ${ink}/><path d="M26 18.7h3" ${line}/><path d="M21 22.3q3 2.6 6 0" ${line}/>${cheeks}`;
    case "cool": return `<rect x="17.5" y="16.5" width="5.6" height="3.6" rx="1.6" ${ink}/><rect x="24.9" y="16.5" width="5.6" height="3.6" rx="1.6" ${ink}/><path d="M23 18h2" ${line}/><path d="M22 23q2.5 1.4 5-.6" ${line}/>`;
    case "sleepy": return `<path d="M19 18.8q1.5 1.4 3 0M26 18.8q1.5 1.4 3 0" ${line}/><circle cx="24" cy="23" r="1.2" ${ink}/>${cheeks}`;
    default: return "";
  }
}
function headSvg(color, face) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="${tint(color)}"/>
    <path d="M7 50c0-10.5 7.6-17 17-17s17 6.5 17 17z" fill="${color}"/>
    <circle cx="24" cy="19.5" r="10" fill="${color}"/>
    <ellipse cx="20.5" cy="14.5" rx="4" ry="2.2" fill="#fff" opacity=".25"/>
    ${faceSvg(face)}</svg>`;
}
const pic = (p) => (p.photo ? `<img src="${esc(p.photo)}" alt="" />` : headSvg(p.color, p.face));
const avatar = (p, size = "") => `<span class="avatar ${size}" style="--ring:${esc(p.color || "#fff")}">${pic(p)}</span>`;

// Shrink an uploaded image to a small square JPEG (data URL) so it fits in the database.
function photoFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const S = 160, c = document.createElement("canvas"); c.width = c.height = S;
      const k = Math.min(img.width, img.height), sx = (img.width - k) / 2, sy = (img.height - k) / 2;
      c.getContext("2d").drawImage(img, sx, sy, k, k, 0, 0, S, S);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("That file isn't an image we can read."));
    img.src = URL.createObjectURL(file);
  });
}

/* ---------------- Cloud config (Supabase) ---------------- */
const lsGet = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const lsSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };
// Invite links look like  https://you.github.io/repo/#join=<code>. The code carries the
// Supabase URL + publishable key, so they never need to be in the (public) repository.
const b64e = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (t) => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, "+").replace(/_/g, "/")))));
(function readInvite() {
  const m = location.hash.match(/join=([\w-]+)/);
  if (!m) return;
  try { const { u, k } = b64d(m[1]); if (u && k) { lsSet("cnc-sb-url", u); lsSet("cnc-sb-key", k); } } catch (e) {}
  history.replaceState(null, "", location.pathname + location.search);
})();
const DEMO_MODE = new URLSearchParams(location.search).has("demo"); // ?demo shows sample data without connecting
const builtIn = !!(window.SUPABASE_URL && window.SUPABASE_KEY); // set in config.js
const cfg = {
  url: String(window.SUPABASE_URL || lsGet("cnc-sb-url")).trim(),
  key: String(window.SUPABASE_KEY || lsGet("cnc-sb-key")).trim(),
};
const cloud = { on: !DEMO_MODE && !!(cfg.url && cfg.key), status: "local", error: "", synced: null };
const inviteLink = () => location.origin + location.pathname + (builtIn ? "" : "#join=" + b64e({ u: cfg.url, k: cfg.key }));
const editorName = () => lsGet("cnc-editor");
const CLOUD_CACHE = KEY + "-cloud";

/* ---------------- State ---------------- */
let state = migrate(cloud.on ? loadCloudCache() : load());
function loadCloudCache() {
  try { const c = JSON.parse(lsGet(CLOUD_CACHE)); if (c) return c; } catch (e) {}
  return { players: [], games: [], matches: [] };
}
let filter = "all";
const hist = { game: "all", player: "all", from: "", to: "", limit: 10 };

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  return demoData();
}
function migrate(s) {
  s.players ||= []; s.games ||= []; s.matches ||= [];
  const emojiIcon = { "🃏": "card-wild", "♠️": "card-spade", "♥️": "card-heart", "♦️": "card-diamond", "♣️": "card-club", "👑": "crown", "🎲": "dices", "⭐": "star", "💎": "premium", "🔥": "meteor" };
  s.players.forEach((p, i) => {
    if (!p.face) { p.face = "smile"; if (!PALETTE.includes(p.color)) p.color = PALETTE[i % PALETTE.length]; }
    delete p.emoji;
  });
  s.games.forEach((g) => { if (!g.icon) g.icon = emojiIcon[g.emoji] || "card-wild"; delete g.emoji; });
  if (cloud.on) s.demo = false;
  return s;
}
function save() {
  try { localStorage.setItem(cloud.on ? CLOUD_CACHE : KEY, JSON.stringify(state)); } catch (e) {}
  render();
  if (cloud.on && cloud.synced) cloudPush();
}

/* ---------------- Cloud sync (Supabase) ---------------- */
// Every save() compares the current data with the last copy known to be in Supabase
// and sends only what changed (upserts + deletes).
let sb = null;
const TABLES = {
  players: { to: (p) => ({ id: p.id, name: p.name, color: p.color, face: p.face, photo: p.photo || null }), from: (r) => ({ id: r.id, name: r.name, color: r.color, face: r.face, photo: r.photo || null }) },
  games: { to: (g) => ({ id: g.id, name: g.name, icon: g.icon }), from: (r) => ({ id: r.id, name: r.name, icon: r.icon }) },
  matches: {
    to: (m) => ({ id: m.id, game_id: m.gameId, date: m.date, players: m.players, winner_id: m.winnerId }),
    from: (r) => ({ id: r.id, gameId: r.game_id, date: r.date, players: r.players, winnerId: r.winner_id }),
  },
};
const chk = (r) => { if (r.error) throw r.error; return r; };
function snapshot() {
  const snap = {};
  for (const t in TABLES) snap[t] = new Map(state[t].map((x) => [x.id, JSON.stringify(TABLES[t].to(x))]));
  return snap;
}
async function cloudLoad() {
  setSync("syncing");
  const names = Object.keys(TABLES);
  const res = await Promise.all(names.map((t) => sb.from(t).select("*").order("created_at")));
  res.forEach(chk);
  names.forEach((t, i) => (state[t] = res[i].data.map(TABLES[t].from)));
  state.demo = false;
  cloud.synced = snapshot();
  try { localStorage.setItem(CLOUD_CACHE, JSON.stringify(state)); } catch (e) {}
  render();
  setSync("live");
}
let pushing = Promise.resolve();
function cloudPush() {
  pushing = pushing.then(async () => {
    const now = snapshot(), was = cloud.synced, ups = {}, dels = {};
    for (const t in TABLES) {
      ups[t] = [...now[t]].filter(([id, j]) => was[t].get(id) !== j).map(([, j]) => JSON.parse(j));
      dels[t] = [...was[t].keys()].filter((id) => !now[t].has(id));
    }
    if (![...Object.values(ups), ...Object.values(dels)].some((a) => a.length)) return;
    setSync("syncing");
    try {
      if (dels.matches.length) chk(await sb.from("matches").delete().in("id", dels.matches));
      for (const t of ["games", "players"]) if (dels[t].length) chk(await sb.from(t).delete().in("id", dels[t]));
      for (const t of ["games", "players", "matches"]) if (ups[t].length) chk(await sb.from(t).upsert(ups[t]));
      cloud.synced = now;
      setSync("live");
    } catch (e) {
      setSync("error", e.message);
      toast("Couldn't save to Supabase: " + e.message);
      await cloudLoad().catch(() => {});
    }
  });
  return pushing;
}
async function initCloud() {
  if (!cloud.on) { setSync("local"); if (!DEMO_MODE) showLock("invite"); return; }
  if (!editorName()) showLock("name");
  if (!window.supabase) return setSync("error", "The Supabase library didn't load (check your internet connection).");
  try {
    sb = window.supabase.createClient(cfg.url, cfg.key, { global: { headers: { "x-editor": encodeURIComponent(editorName() || "Someone") } } });
    sb.auth.onAuthStateChange(() => setTimeout(renderOwnerBox, 0));
    await cloudLoad();
  } catch (e) { return setSync("error", e.message || String(e)); }
  let timer;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { pushing = pushing.then(() => cloudLoad()).catch((e) => setSync("error", e.message)); }, 400); };
  const ch = sb.channel("card-champions");
  for (const t in TABLES) ch.on("postgres_changes", { event: "*", schema: "public", table: t }, refresh);
  ch.subscribe();
  window.addEventListener("focus", refresh);
}
function setSync(status, error = "") {
  cloud.status = status; cloud.error = error;
  const label = { local: "Saved in this browser", syncing: "Saving…", live: "Live · synced", error: "Sync problem" }[status];
  const pill = $("#sync-pill"); // optional
  if (pill) { pill.className = "sync-pill " + status; pill.innerHTML = `<i></i>${label}`; }
  renderCloudBox();
}
function renderCloudBox() {
  const box = $("#cloud-box");
  if ($("#me-name")) { $("#me-name").textContent = editorName() || "Someone"; $("#me-change").onclick = () => showLock("name"); }
  if (!box) return;
  if (!cloud.on) { box.innerHTML = `<p class="muted">Demo mode: nothing is saved online. Remove <b>?demo</b> from the address to use the real scoreboard.</p>`; return; }
  box.innerHTML = `
    <div class="cloud-status ${cloud.status}"><i></i><div><b>${cloud.status === "error" ? "Can't reach Supabase" : cloud.status === "syncing" ? "Syncing…" : "Connected · live"}</b>
      <div class="muted">${cloud.status === "error" ? esc(cloud.error) : "Everyone with the link sees and edits the same scores. Changes appear instantly, and a backup is saved every day."}</div></div></div>
    <div class="field-label">${builtIn ? "Site link" : "Invite link"} <span class="muted">(anyone with this link can view and edit the scores)</span></div>
    <div class="invite-row"><input id="invite" readonly value="${esc(inviteLink())}" /><button class="btn btn-blue" id="invite-copy">Copy</button></div>
    <div class="field-label">Your name in the change log</div>
    <div class="btn-row"><span class="name-chip">${ic("person", "sm")}${esc(editorName() || "Someone")}</span>
      <button class="btn btn-ghost btn-sm" id="name-change">Change</button>
      ${cloud.status === "error" ? `<button class="btn btn-blue btn-sm" id="sb-retry">Try again</button>` : ""}
      ${builtIn ? "" : `<button class="btn btn-danger btn-sm" id="sb-disconnect">Forget link on this device</button>`}</div>`;
  $("#invite-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(inviteLink()); } catch (e) { $("#invite").select(); document.execCommand("copy"); }
    toast("Link copied");
  };
  $("#name-change").onclick = () => showLock("name");
  $("#sb-retry") && ($("#sb-retry").onclick = () => location.reload());
  $("#sb-disconnect") && ($("#sb-disconnect").onclick = () => {
    if (confirm("Forget the invite link on this device? You'll need the link again to get back in. (No scores are deleted.)")) {
      lsSet("cnc-sb-url", ""); lsSet("cnc-sb-key", ""); location.reload();
    }
  });

}

/* ---------------- Lock screen / name prompt ---------------- */
function showLock(mode) {
  $("#lock").hidden = false;
  document.body.classList.add("locked");
  const body = $("#lock-body");
  const art = () => { const cv = $("#welcome-art"); if (cv && window.drawWelcomeArt) window.drawWelcomeArt(cv); };
  requestAnimationFrame(art);
  if (!showLock.bound) { showLock.bound = true; window.addEventListener("resize", () => { if (!$("#lock").hidden) art(); }); }
  if (mode === "name") {
    body.innerHTML = `
      <div class="lock-hello"><h2>Hello Noobs!</h2><p>Here to see your worth :D! ${ic("heart", "sm")}</p></div>
      <div class="lock-field"><label for="lock-name">Your name</label>
        <input id="lock-name" class="pill-input" maxlength="24" placeholder="e.g. Haretz BITCH" value="${esc(editorName())}" autocomplete="nickname" /></div>
      <p class="lock-note">Your name appears in the change log next to anything you add or edit.</p>
      <label class="lock-check"><input type="checkbox" id="lock-fair" checked /><span></span>I promise to record every win honestly, else im a retard</label>
      <button class="pill-btn primary" id="lock-go">Let's play ${ic("controller", "sm")}</button>`;
    const go = () => { const n = $("#lock-name").value.trim(); if (!n) return $("#lock-name").focus(); lsSet("cnc-editor", n); location.reload(); };
    $("#lock-go").onclick = go;
    $("#lock-name").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    setTimeout(() => $("#lock-name").focus(), 50);
    return;
  }
  body.innerHTML = `
    <div class="lock-hello"><h2>Hi there! This scoreboard is private</h2><p>Open it with the invite link you were sent ${ic("cards", "sm")}</p></div>
    <div class="lock-field"><label for="lock-invite">Invite link</label>
      <div class="pill-row"><input id="lock-invite" class="pill-input" placeholder="Paste your invite link" autocomplete="off" />
      <button class="pill-btn primary" id="lock-join">Join</button></div></div>
    <div class="lock-or"><span>or, if you're the owner</span></div>
    <div class="lock-grid">
      <div class="lock-field"><label for="sb-url">Project URL</label><input id="sb-url" class="pill-input" placeholder="https://your-project.supabase.co" autocomplete="off" /></div>
      <div class="lock-field"><label for="sb-key">Publishable key</label><input id="sb-key" class="pill-input" placeholder="sb_publishable_…" autocomplete="off" /></div>
    </div>
    <p class="lock-note">Saved only in this browser. After connecting, copy the invite link from <b>Manage</b>.</p>
    <button class="pill-btn" id="sb-connect">Connect</button>`;
  $("#lock-join").onclick = () => {
    const m = $("#lock-invite").value.match(/join=([\w-]+)/);
    try { const { u, k } = b64d(m[1]); lsSet("cnc-sb-url", u); lsSet("cnc-sb-key", k); location.reload(); }
    catch (e) { toast("That doesn't look like an invite link. Ask the owner to send it again."); }
  };
  $("#sb-connect").onclick = () => {
    const url = $("#sb-url").value.trim().replace(/\/+$/, ""), key = $("#sb-key").value.trim();
    if (!/^https:\/\/[\w.-]+$/.test(url) || key.length < 20) return toast("Please paste the Project URL and the publishable key.");
    lsSet("cnc-sb-url", url); lsSet("cnc-sb-key", key); location.reload();
  };
}

/* ---------------- Change log (owner only) ---------------- */
async function renderOwnerBox() {
  const box = $("#owner-box");
  if (!box) return;
  if (!cloud.on || !sb) { box.innerHTML = `<p class="muted">Available once the site is connected to Supabase.</p>`; return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    box.innerHTML = `<p class="muted">Only the owner can see this. Sign in with your Supabase owner account.</p>
      <div class="cloud-form">
        <label>Email<input id="ow-email" type="email" autocomplete="username" /></label>
        <label>Password<input id="ow-pass" type="password" autocomplete="current-password" /></label>
        <button class="btn btn-blue" id="ow-login">Sign in</button>
      </div>`;
    $("#ow-login").onclick = async () => {
      const { error } = await sb.auth.signInWithPassword({ email: $("#ow-email").value.trim(), password: $("#ow-pass").value });
      if (error) toast("Sign-in failed: " + error.message);
    };
    return;
  }
  box.innerHTML = `<p class="muted">Loading…</p>`;
  const { data, error } = await sb.from("activity_log").select("*").order("at", { ascending: false }).limit(150);
  const head = `<div class="btn-row owner-head"><span class="name-chip">${ic("person", "sm")}${esc(session.user.email)}</span>
    <button class="btn btn-ghost btn-sm" id="ow-refresh">Refresh</button><button class="btn btn-ghost btn-sm" id="ow-logout">Sign out</button></div>`;
  if (error) box.innerHTML = head + `<p class="error">${esc(error.message)}</p>`;
  else if (!data.length) box.innerHTML = head + `<p class="empty">No changes recorded yet, or this account isn't set as the owner (see the README).</p>`;
  else box.innerHTML = head + `<ul class="log">${data.map(logItem).join("")}</ul>`;
  $("#ow-refresh").onclick = renderOwnerBox;
  $("#ow-logout").onclick = () => sb.auth.signOut();
}
function logItem(e) {
  const row = e.new_data || e.old_data || {};
  const pName = (id) => byId(state.players, id)?.name || "a removed player";
  const gName = (id) => byId(state.games, id)?.name || "a removed game";
  const verb = { insert: "added", update: "edited", delete: "deleted" }[e.action] || e.action;
  let what = "";
  if (e.table_name === "players") {
    what = `player <b>${esc(row.name)}</b>`;
    if (e.action === "update" && e.old_data) {
      const ch = ["name", "color", "face", "photo"].filter((k) => e.old_data[k] !== e.new_data[k]);
      if (ch.includes("name")) what = `player <b>${esc(e.old_data.name)}</b> → <b>${esc(e.new_data.name)}</b>`;
      else if (ch.length) what += ` (${ch.map((k) => ({ color: "colour", face: "face", photo: "picture" }[k])).join(", ")})`;
    }
  } else if (e.table_name === "games") {
    what = `game <b>${esc(row.name)}</b>`;
    if (e.action === "update" && e.old_data?.name !== e.new_data?.name) what = `game <b>${esc(e.old_data.name)}</b> → <b>${esc(e.new_data.name)}</b>`;
  } else if (e.table_name === "matches") {
    what = `match: <b>${esc(pName(row.winner_id))}</b> won ${esc(gName(row.game_id))} on ${fmtDate(row.date)} (${plural((row.players || []).length, "player")})`;
  }
  const when = new Date(e.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  let who = e.editor || "Someone"; try { who = decodeURIComponent(who); } catch (x) {}
  return `<li class="log-${e.action}"><span class="log-dot"></span><div><b>${esc(who)}</b> ${verb} ${what}<div class="muted">${when}</div></div></li>`;
}

let toastTimer;
function toast(msg) {
  let el = $("#toast");
  if (!el) { el = Object.assign(document.createElement("div"), { id: "toast" }); document.body.append(el); }
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 4000);
}

function demoData() {
  const names = ["Ahmad", "Bella", "Chris", "Dina", "Evan", "Farah"];
  const faces = ["cool", "happy", "smile", "wink", "sleepy", "smile"];
  const cols = ["#1f9bff", "#ff5c8a", "#ff8a3d", "#22c55e", "#a259ff", "#14c3b0"];
  const players = names.map((name, i) => ({ id: uid(), name, color: cols[i], face: faces[i] }));
  const games = [["UNO", "cards"], ["Poker", "card-spade"], ["Big Two", "card-heart"], ["Blackjack", "card-diamond"]].map(([name, icon]) => ({ id: uid(), name, icon }));
  const matches = [];
  const weights = [5, 4, 3, 3, 2, 2];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let d = 40; d >= 0; d--) {
    const date = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    const perDay = rnd() > 0.75 ? 2 : 1;
    for (let k = 0; k < perDay; k++) {
      const g = games[Math.floor(rnd() * games.length)];
      const ps = players.filter(() => rnd() > 0.3);
      if (ps.length < 2) continue;
      const total = ps.reduce((a, p) => a + weights[players.indexOf(p)], 0);
      let r = rnd() * total, winner = ps[0];
      for (const p of ps) { r -= weights[players.indexOf(p)]; if (r <= 0) { winner = p; break; } }
      matches.push({ id: uid(), gameId: g.id, date, players: ps.map((p) => p.id), winnerId: winner.id, at: d * 10 + k });
    }
  }
  return { players, games, matches, demo: true };
}

/* ---------------- Stats ---------------- */
const byId = (arr, id) => arr.find((x) => x.id === id);
const sortedMatches = () => state.matches.map((m, i) => [m, i]).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).map((x) => x[0]);

function computeStats(gameId = "all") {
  const ms = sortedMatches().filter((m) => gameId === "all" || m.gameId === gameId);
  const stats = state.players.map((p) => ({ p, played: 0, wins: 0, byGame: {}, results: [] }));
  const S = Object.fromEntries(stats.map((s) => [s.p.id, s]));
  for (const m of ms) {
    for (const pid of m.players) {
      const s = S[pid]; if (!s) continue;
      const won = m.winnerId === pid;
      s.played++; if (won) s.wins++;
      s.byGame[m.gameId] ??= { played: 0, wins: 0 };
      s.byGame[m.gameId].played++; if (won) s.byGame[m.gameId].wins++;
      s.results.push(won);
    }
  }
  for (const s of stats) {
    s.rate = s.played ? s.wins / s.played : 0;
    let cur = 0; for (let i = s.results.length - 1; i >= 0 && s.results[i]; i--) cur++;
    let best = 0, run = 0; for (const w of s.results) { run = w ? run + 1 : 0; best = Math.max(best, run); }
    s.streak = cur; s.bestStreak = best; s.form = s.results.slice(-5);
    const bg = Object.entries(s.byGame).sort((a, b) => b[1].wins - a[1].wins)[0];
    s.bestGame = bg && bg[1].wins > 0 ? byId(state.games, bg[0]) : null;
  }
  const ranked = stats.filter((s) => s.played > 0).sort((a, b) => b.wins - a.wins || b.rate - a.rate || a.played - b.played);
  return { ranked, matches: ms };
}

/* ---------------- Render helpers ---------------- */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pct = (r) => Math.round(r * 100) + "%";
const D = (d) => new Date(d + "T00:00");
const fmtDate = (d) => D(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const fmtLong = (d) => D(d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const relDay = (d) => { const diff = Math.round((D(today()) - D(d)) / 864e5); return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? `${diff} days ago` : ""; };
const form = (f) => `<span class="form">${f.map((w) => `<i class="${w ? "w" : "l"}">${w ? "W" : "L"}</i>`).join("")}</span>`;
const gameOf = (id) => byId(state.games, id) || { name: "Deleted game", icon: "cards" };

function render() {
  renderTabs();
  const { ranked, matches } = computeStats(filter);
  $("#chip-today").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  renderPodium(ranked);
  renderTiles(ranked, matches);
  renderLeaderboard(ranked);
  renderGameChamps();
  renderMatches($("#recent"), [...matches].reverse().slice(0, 5));
  renderHistory();
  renderManage();
}

function renderTabs() {
  if (filter !== "all" && !byId(state.games, filter)) filter = "all";
  const tabs = [{ id: "all", name: "All games", icon: "star" }, ...state.games];
  const el = $("#game-tabs");
  el.innerHTML = tabs.map((t) =>
    `<button class="tab ${filter === t.id ? "active" : ""}" data-filter="${t.id}">${ic(t.icon)}${esc(t.name)}</button>`).join("");
  const edge = () => el.classList.toggle("at-end", el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  el.onscroll = edge; requestAnimationFrame(edge);
  const act = el.querySelector(".tab.active"); // scroll the row only, never the page
  if (act && (act.offsetLeft < el.scrollLeft || act.offsetLeft + act.offsetWidth > el.scrollLeft + el.clientWidth)) el.scrollLeft = act.offsetLeft - 8;
}

/* Top 3: 2nd, 1st, 3rd */
function renderPodium(ranked) {
  if (!ranked.length) {
    $("#podium").innerHTML = `<div class="podium-empty">${ic("trophy", "lg")}<div><b>No matches yet</b><p>Record your first game to crown a champion.</p></div>
      <button class="btn btn-blue" data-action="new-match">+ Add match</button></div>`;
    return;
  }
  const label = ["1st", "2nd", "3rd"];
  const step = (i) => `<div class="step step-${i + 1}" aria-hidden="true"><b>${i + 1}</b></div>`;
  $("#podium").innerHTML = [1, 0, 2].map((i) => {
    const s = ranked[i];
    if (!s) return `<div class="slot r${i + 1}"><div class="podium-card ghost r${i + 1}"><span class="place">${label[i]}</span><p>Waiting for a challenger</p></div>${step(i)}</div>`;
    return `<div class="slot r${i + 1}"><button class="podium-card r${i + 1}" data-player="${s.p.id}">
      <span class="place">${label[i]}</span>
      ${avatar(s.p, i === 0 ? "xl" : "lg")}
      <span class="pname">${esc(s.p.name)}</span>
      <span class="ptag">${i === 0 ? "Champion" : s.bestGame ? esc(s.bestGame.name) + " pro" : "Contender"}</span>
      <span class="pstats"><span><b>${s.wins}</b>wins</span><span><b>${pct(s.rate)}</b>win rate</span><span><b>${s.played}</b>played</span></span>
    </button>${step(i)}</div>`;
  }).join("");
}

/* Highlights that the podium doesn't already show */
function renderTiles(ranked, matches) {
  const bestRate = [...ranked].filter((s) => s.played >= 3).sort((a, b) => b.rate - a.rate || b.played - a.played)[0];
  const hot = [...ranked].filter((s) => s.streak > 0).sort((a, b) => b.streak - a.streak)[0];
  const counts = {};
  matches.forEach((m) => (counts[m.gameId] = (counts[m.gameId] || 0) + 1));
  const topG = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const fav = topG && byId(state.games, topG[0]);
  const last = matches[matches.length - 1];
  const tile = (cls, icon, label, value, sub, who) => `<div class="tile ${cls}" ${who ? `data-player="${who.p.id}"` : ""}>
      <span class="tile-ic">${ic(icon)}</span>
      <div class="tile-body"><span class="label">${label}</span><b class="big">${value}</b><span class="tile-sub">${sub}</span></div></div>`;
  $("#tiles").innerHTML =
    tile("t4", "dices", "Matches played", matches.length, last ? `last one ${relDay(last.date) || fmtDate(last.date)}` : "none yet") +
    tile("t2", "chart", "Best win rate", bestRate ? pct(bestRate.rate) : "—", bestRate ? `${esc(bestRate.p.name)} · ${plural(bestRate.played, "game")}` : "needs 3+ games", bestRate) +
    tile("t3", "flame", "On fire", hot ? `${hot.streak} win${hot.streak > 1 ? "s" : ""}` : "—", hot ? `${esc(hot.p.name)} · in a row` : "no streak right now", hot) +
    tile("t1", fav ? fav.icon : "cards", "Favourite game", fav ? esc(fav.name) : "—", fav ? `${plural(topG[1], "match").replace("matchs", "matches")}` : "play a game first");
}

function renderLeaderboard(ranked) {
  $("#lb-body").innerHTML = ranked.length ? ranked.map((s, i) => `
    <tr data-player="${s.p.id}">
      <td><span class="rank r${Math.min(i + 1, 4)}">${i + 1}</span></td>
      <td><div class="player-cell">${avatar(s.p, "sm")}<span>${esc(s.p.name)}</span></div></td>
      <td class="num"><b>${s.wins}</b></td>
      <td class="num hide-sm">${s.played}</td>
      <td><div class="rate"><span class="bar"><i style="width:${pct(s.rate)}"></i></span><span>${pct(s.rate)}</span></div></td>
      <td class="hide-sm">${form(s.form)}</td>
    </tr>`).join("") : `<tr><td colspan="6" class="empty">No results yet</td></tr>`;
}

function renderGameChamps() {
  const el = $("#game-champs");
  if (!state.games.length) { el.innerHTML = `<p class="empty">Add a game in Manage</p>`; return; }
  el.innerHTML = state.games.map((g, i) => {
    const { ranked, matches } = computeStats(g.id);
    const c = ranked[0];
    return `<button class="gc c${i % 6}" data-filter="${g.id}">
      ${ic(g.icon, "md")}
      <span class="info"><span class="gname">${esc(g.name)}</span><span class="muted">${plural(matches.length, "match").replace("matchs", "matches")}</span></span>
      ${c ? `<span class="champ">${avatar(c.p, "xs")}<span>${esc(c.p.name)}<span class="muted"> · ${c.wins}W</span></span></span>` : `<span class="muted">No winner yet</span>`}
    </button>`;
  }).join("");
}

function matchItem(m, actions) {
  const g = gameOf(m.gameId);
  const w = byId(state.players, m.winnerId);
  const ps = m.players.map((id) => byId(state.players, id)).filter(Boolean);
  return `<li class="match">
    ${ic(g.icon, "md")}
    <div class="info"><div class="title">${w ? esc(w.name) : "?"} won ${esc(g.name)}</div>
      <div class="sub">${actions ? "vs " + (ps.filter((p) => p.id !== m.winnerId).map((p) => esc(p.name)).join(", ") || "—") : fmtDate(m.date) + " · " + ps.length + " players"}</div></div>
    <div class="stack">${ps.slice(0, 5).map((p) => `<span class="${p.id === m.winnerId ? "winner" : ""}" title="${esc(p.name)}">${avatar(p, "xs")}</span>`).join("")}${ps.length > 5 ? `<span class="more">+${ps.length - 5}</span>` : ""}</div>
    ${actions ? `<button class="icon-btn" data-edit-match="${m.id}" title="Edit">${ic("edit", "sm")}</button><button class="icon-btn del" data-del-match="${m.id}" title="Delete">${ic("delete", "sm")}</button>` : ""}
  </li>`;
}
function renderMatches(el, ms) {
  el.innerHTML = ms.length ? ms.map((m) => matchItem(m, false)).join("") : `<li class="empty">No matches yet</li>`;
}

/* ---------------- History ---------------- */
function renderHistory() {
  const opt = (v, label, sel) => `<option value="${v}" ${sel === v ? "selected" : ""}>${esc(label)}</option>`;
  if (hist.game !== "all" && !byId(state.games, hist.game)) hist.game = "all";
  if (hist.player !== "all" && !byId(state.players, hist.player)) hist.player = "all";
  $("#h-game").innerHTML = opt("all", "All games", hist.game) + state.games.map((g) => opt(g.id, g.name, hist.game)).join("");
  $("#h-player").innerHTML = opt("all", "Everyone", hist.player) + state.players.map((p) => opt(p.id, p.name, hist.player)).join("");
  $("#h-from").value = hist.from; $("#h-to").value = hist.to;

  const ms = sortedMatches().reverse().filter((m) =>
    (hist.game === "all" || m.gameId === hist.game) &&
    (hist.player === "all" || m.players.includes(hist.player)) &&
    (!hist.from || m.date >= hist.from) && (!hist.to || m.date <= hist.to));

  const days = {};
  for (const m of ms) (days[m.date] ||= []).push(m);
  const winCount = {};
  for (const m of ms) winCount[m.winnerId] = (winCount[m.winnerId] || 0) + 1;
  const topW = Object.entries(winCount).sort((a, b) => b[1] - a[1])[0];
  const tp = topW && byId(state.players, topW[0]);
  const pw = hist.player !== "all" ? ms.filter((m) => m.winnerId === hist.player).length : null;

  $("#h-summary").innerHTML = `
    <div class="hs">${ic("history", "md")}<div><b>${ms.length}</b><span>matches</span></div></div>
    <div class="hs">${ic("calendar", "md")}<div><b>${Object.keys(days).length}</b><span>game days</span></div></div>
    ${pw !== null ? `<div class="hs">${ic("trophy", "md")}<div><b>${pw} / ${ms.length}</b><span>won by ${esc(byId(state.players, hist.player).name)}</span></div></div>`
      : `<div class="hs">${tp ? avatar(tp, "sm") : ic("trophy", "md")}<div><b>${tp ? esc(tp.name) : "—"}</b><span>${tp ? `most wins here (${topW[1]})` : "most wins here"}</span></div></div>`}`;

  const allDays = Object.entries(days);
  $("#history-list").innerHTML = allDays.length ? allDays.slice(0, hist.limit).map(([d, list]) => `
    <div class="day">
      <div class="day-head"><span class="day-badge"><b>${D(d).getDate()}</b>${D(d).toLocaleDateString(undefined, { month: "short" })}</span>
        <div><div class="day-title">${fmtLong(d)}</div><div class="muted">${relDay(d) ? relDay(d) + " · " : ""}${list.length} match${list.length > 1 ? "es" : ""}</div></div></div>
      <ul class="match-list">${list.map((m) => matchItem(m, true)).join("")}</ul>
    </div>`).join("") + (allDays.length > hist.limit ? `<div class="show-more"><button class="btn btn-ghost" id="h-more">Show more days (${allDays.length - hist.limit} left)</button></div>` : "")
    : `<div class="card"><p class="empty">No matches for these filters</p></div>`;
  $("#h-more")?.addEventListener("click", () => { hist.limit += 10; renderHistory(); });
}
["#h-game", "#h-player", "#h-from", "#h-to"].forEach((sel) => $(sel).addEventListener("change", (e) => {
  hist[{ "#h-game": "game", "#h-player": "player", "#h-from": "from", "#h-to": "to" }[sel]] = e.target.value; hist.limit = 10; renderHistory();
}));
$("#h-clear").addEventListener("click", () => { Object.assign(hist, { game: "all", player: "all", from: "", to: "", limit: 10 }); renderHistory(); });

/* ---------------- Manage ---------------- */
function renderManage() {
  $("#player-list").innerHTML = state.players.map((p) =>
    `<li>${avatar(p, "sm")}<span class="grow">${esc(p.name)}</span>
      <button class="icon-btn" data-edit-player="${p.id}" title="Edit">${ic("edit", "sm")}</button>
      <button class="icon-btn del" data-del-player="${p.id}" title="Remove">${ic("delete", "sm")}</button></li>`).join("") || `<li class="empty">No players yet</li>`;
  $("#game-list").innerHTML = state.games.map((g) => {
    const n = state.matches.filter((m) => m.gameId === g.id).length;
    return `<li>${ic(g.icon, "md")}<span class="grow">${esc(g.name)} <span class="muted">· ${plural(n, "match").replace("matchs", "matches")}</span></span>
      <button class="icon-btn" data-edit-game="${g.id}" title="Edit">${ic("edit", "sm")}</button>
      <button class="icon-btn del" data-del-game="${g.id}" title="Remove">${ic("delete", "sm")}</button></li>`;
  }).join("") || `<li class="empty">No games yet</li>`;
  $("#demo-note").hidden = !state.demo;
}

/* ---------------- Player / game editor ---------------- */
let editing = null; // {type:'player'|'game', id, draft}
const iconGrid = (sel) => GAME_ICONS.map((k) => `<button type="button" class="icon-opt ${sel === k ? "on" : ""}" data-pick-icon="${k}">${ic(k)}</button>`).join("");

function openPlayerEditor(id) {
  const p = id ? byId(state.players, id) : null;
  editing = { type: "player", id, draft: p ? { ...p } : { name: "", color: PALETTE[state.players.length % PALETTE.length], face: "smile" } };
  $("#e-title").textContent = p ? "Edit player" : "New player";
  drawPlayerEditor();
  $("#e-error").textContent = "";
  $("#edit-modal").showModal();
  setTimeout(() => $("#e-name")?.focus(), 50);
}
function drawPlayerEditor() {
  const d = editing.draft;
  $("#e-body").innerHTML = `
    <div class="editor-preview"><span class="avatar xl">${pic(d)}</span>
      <div class="photo-actions">
        <label class="btn btn-blue btn-sm">${d.photo ? "Change photo" : "Upload photo"}<input type="file" id="e-photo" accept="image/*" hidden /></label>
        ${d.photo ? `<button type="button" class="btn btn-ghost btn-sm" id="e-photo-remove">Use cartoon head</button>` : ""}
      </div></div>
    <label>Name<input id="e-name" maxlength="24" value="${esc(d.name)}" placeholder="Player name" /></label>
    <div class="field-label">Colour</div>
    <div class="swatches">${PALETTE.map((c) => `<button type="button" class="swatch ${d.color === c ? "on" : ""}" style="--c:${c}" data-pick-color="${c}"></button>`).join("")}
      <label class="swatch custom" title="Pick any colour" style="--c:${d.color}"><input type="color" id="e-color" value="${d.color}" /></label></div>
    <div class="field-label">Face</div>
    <div class="faces">${Object.entries(FACES).map(([k, n]) => `<button type="button" class="face-opt ${d.face === k ? "on" : ""}" data-pick-face="${k}"><span class="avatar sm">${headSvg(d.color, k)}</span>${n}</button>`).join("")}</div>`;
  $("#e-name").addEventListener("input", (e) => (d.name = e.target.value));
  $("#e-color").addEventListener("input", (e) => { d.color = e.target.value; drawPlayerEditor(); });
  $("#e-photo").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { d.photo = await photoFromFile(f); drawPlayerEditor(); } catch (err) { $("#e-error").textContent = err.message; }
  });
  $("#e-photo-remove") && ($("#e-photo-remove").onclick = () => { d.photo = null; drawPlayerEditor(); });
}
function openGameEditor(id) {
  const g = id ? byId(state.games, id) : null;
  editing = { type: "game", id, draft: g ? { ...g } : { name: "", icon: GAME_ICONS[state.games.length % GAME_ICONS.length] } };
  $("#e-title").textContent = g ? "Edit game" : "New game";
  drawGameEditor();
  $("#e-error").textContent = "";
  $("#edit-modal").showModal();
}
function drawGameEditor() {
  const d = editing.draft;
  $("#e-body").innerHTML = `
    <div class="editor-preview">${ic(d.icon, "xl")}</div>
    <label>Game name<input id="e-name" maxlength="24" value="${esc(d.name)}" placeholder="e.g. UNO, Poker, Big Two" /></label>
    <div class="field-label">Icon</div>
    <div class="icon-grid">${iconGrid(d.icon)}</div>`;
  $("#e-name").addEventListener("input", (e) => (d.name = e.target.value));
}
$("#edit-form").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "save") return;
  e.preventDefault();
  const d = editing.draft;
  d.name = d.name.trim();
  if (!d.name) { $("#e-error").textContent = "Please enter a name."; return; }
  const list = editing.type === "player" ? state.players : state.games;
  if (list.some((x) => x.id !== editing.id && x.name.toLowerCase() === d.name.toLowerCase())) { $("#e-error").textContent = "That name already exists."; return; }
  if (editing.id) Object.assign(byId(list, editing.id), d);
  else {
    if (editing.type === "player") clearDemoIfNeeded();
    (editing.type === "player" ? state.players : state.games).push({ ...d, id: uid() });
  }
  $("#edit-modal").close();
  save();
});

/* ---------------- Profile ---------------- */
function openProfile(pid) {
  const all = computeStats("all").ranked;
  const s = all.find((x) => x.p.id === pid);
  const p = byId(state.players, pid);
  if (!p) return;
  const rows = state.games.map((g) => {
    const b = s?.byGame[g.id];
    if (!b) return "";
    const r = b.wins / b.played;
    return `<div class="pg-row"><span>${ic(g.icon, "sm")}${esc(g.name)}</span><span class="bar"><i style="width:${pct(r)}"></i></span><span>${b.wins}/${b.played} · ${pct(r)}</span></div>`;
  }).join("");
  const lastM = sortedMatches().filter((m) => m.players.includes(pid)).pop();
  $("#profile-body").innerHTML = `
    <div class="profile-head">${avatar(p, "lg")}<div><h2>${esc(p.name)}</h2><div class="muted">Overall rank #${s ? all.indexOf(s) + 1 : "—"}${lastM ? ` · last played ${fmtDate(lastM.date)}` : ""}</div></div>
      <button class="btn btn-ghost btn-sm" data-edit-player="${p.id}">${ic("edit", "xs")}Customise</button></div>
    <div class="profile-stats">
      <div><b>${s?.wins ?? 0}</b><span>Wins</span></div><div><b>${s?.played ?? 0}</b><span>Played</span></div>
      <div><b>${s ? pct(s.rate) : "0%"}</b><span>Win rate</span></div><div><b>${s?.bestStreak ?? 0}</b><span>Best streak</span></div>
    </div>
    <div class="field-label">Wins per game</div>
    ${rows || `<p class="empty">No matches yet</p>`}
    ${s ? `<div class="field-label">Last 5</div>${form(s.form)}` : ""}`;
  $("#profile-modal").showModal();
}

/* ---------------- Match modal ---------------- */
let mm = null; // {editId, gameId ('__new' for new game), players:Set, winner, ngIcon}
function openMatchModal(editId) {
  const m = editId ? byId(state.matches, editId) : null;
  mm = {
    editId, gameId: m ? m.gameId : (filter !== "all" ? filter : state.games[0]?.id || "__new"),
    players: new Set(m ? m.players : []), winner: m ? m.winnerId : null, ngIcon: GAME_ICONS[state.games.length % GAME_ICONS.length],
  };
  $("#m-title").textContent = m ? "Edit match" : "Add a match";
  $("#m-date").value = m ? m.date : today();
  $("#m-ng-name").value = "";
  $("#m-error").textContent = "";
  drawMatchModal();
  $("#match-modal").showModal();
}
function drawMatchModal() {
  $("#m-games").innerHTML = state.games.map((g) =>
    `<button type="button" class="gpick ${mm.gameId === g.id ? "on" : ""}" data-pick-game="${g.id}">${ic(g.icon, "md")}${esc(g.name)}</button>`).join("") +
    `<button type="button" class="gpick add ${mm.gameId === "__new" ? "on" : ""}" data-pick-game="__new">${ic("add", "md")}New game</button>`;
  $("#m-newgame").hidden = mm.gameId !== "__new";
  $("#m-ng-icons").innerHTML = iconGrid(mm.ngIcon);
  $("#m-players").innerHTML = state.players.map((p) =>
    `<button type="button" class="pick ${mm.players.has(p.id) ? "on" : ""}" data-pick="${p.id}">${avatar(p, "sm")}${esc(p.name)}</button>`).join("") +
    `<span class="pick add-player"><span class="plus">+</span><input id="m-np" maxlength="24" placeholder="New player" aria-label="New player name" /><button type="button" class="btn btn-blue btn-sm" id="m-np-add">Add</button></span>`;
  const addNew = () => {
    const name = $("#m-np").value.trim(); if (!name) return $("#m-np").focus();
    const existing = state.players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    let id = existing && existing.id;
    if (!id) { if (state.demo) { clearDemoIfNeeded(); mm.players.clear(); mm.winner = null; } id = uid(); state.players.push({ id, name, color: PALETTE[state.players.length % PALETTE.length], face: "smile", photo: null }); save(); }
    mm.players.add(id); drawMatchModal(); $("#m-error").textContent = "";
  };
  $("#m-np-add").onclick = addNew;
  $("#m-np").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } });
  const ps = state.players.filter((p) => mm.players.has(p.id));
  $("#m-winner").innerHTML = ps.length ? ps.map((p) =>
    `<button type="button" class="pick win ${mm.winner === p.id ? "on" : ""}" data-win="${p.id}">${avatar(p, "sm")}${esc(p.name)}${mm.winner === p.id ? ic("crown", "xs") : ""}</button>`).join("")
    : `<span class="muted">Select players first</span>`;
}
$("#match-form").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "save") return;
  e.preventDefault();
  const err = (t) => ($("#m-error").textContent = t);
  let gameId = mm.gameId;
  if (gameId === "__new") {
    const name = $("#m-ng-name").value.trim();
    if (!name) return err("Type a name for the new game.");
    const existing = state.games.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (existing) gameId = existing.id;
    else { gameId = uid(); state.games.push({ id: gameId, name, icon: mm.ngIcon }); }
  }
  if (!$("#m-date").value) return err("Pick a date.");
  if (mm.players.size < 2) return err("Pick at least 2 players.");
  if (!mm.winner) return err("Pick the winner.");
  const data = { gameId, date: $("#m-date").value, players: [...mm.players], winnerId: mm.winner };
  if (mm.editId) Object.assign(byId(state.matches, mm.editId), data);
  else state.matches.push({ id: uid(), ...data });
  $("#match-modal").close();
  save();
});

/* ---------------- Views ---------------- */
function showView(v) {
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === "view-" + v));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearDemoIfNeeded() {
  if (state.demo) state = { players: [], games: state.games, matches: [] };
}

/* ---------------- Events ---------------- */
document.addEventListener("click", (e) => {
  const t = e.target.closest("button, [data-player], [data-filter]");
  if (!t) return;
  const d = t.dataset;
  if (d.view) { document.querySelectorAll("dialog[open]").forEach((x) => x.close()); showView(d.view); }
  else if (d.action === "new-match") openMatchModal();
  else if (d.action === "new-player") openPlayerEditor();
  else if (d.action === "new-game") openGameEditor();
  else if (d.filter) { filter = d.filter; render(); if (t.classList.contains("gc")) window.scrollTo({ top: 0, behavior: "smooth" }); }
  else if (d.pickGame) { mm.gameId = d.pickGame; drawMatchModal(); if (d.pickGame === "__new") $("#m-ng-name").focus(); }
  else if (d.pickIcon) {
    if ($("#edit-modal").open && editing?.type === "game") { editing.draft.icon = d.pickIcon; drawGameEditor(); }
    else { mm.ngIcon = d.pickIcon; drawMatchModal(); }
  }
  else if (d.pickColor) { editing.draft.color = d.pickColor; drawPlayerEditor(); }
  else if (d.pickFace) { editing.draft.face = d.pickFace; drawPlayerEditor(); }
  else if (d.pick) { mm.players.has(d.pick) ? mm.players.delete(d.pick) : mm.players.add(d.pick); if (!mm.players.has(mm.winner)) mm.winner = null; drawMatchModal(); }
  else if (d.win) { mm.winner = d.win; drawMatchModal(); }
  else if (d.editMatch) openMatchModal(d.editMatch);
  else if (d.delMatch) { if (confirm("Delete this match?")) { state.matches = state.matches.filter((m) => m.id !== d.delMatch); save(); } }
  else if (d.editPlayer) { $("#profile-modal").close(); openPlayerEditor(d.editPlayer); }
  else if (d.editGame) openGameEditor(d.editGame);
  else if (d.delPlayer) {
    if (confirm("Remove this player and all their matches?")) {
      state.players = state.players.filter((p) => p.id !== d.delPlayer);
      state.matches = state.matches.filter((m) => !m.players.includes(d.delPlayer));
      save();
    }
  }
  else if (d.delGame) {
    if (confirm("Remove this game and all its matches?")) {
      state.games = state.games.filter((g) => g.id !== d.delGame);
      state.matches = state.matches.filter((m) => m.gameId !== d.delGame);
      save();
    }
  }
  else if (d.close !== undefined) t.closest("dialog").close();
  else if (d.player) openProfile(d.player);
});

$("#export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `card-champions-${today()}.json` });
  a.click(); URL.revokeObjectURL(a.href);
});
$("#import-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.players) || !Array.isArray(data.matches)) throw 0;
    state = migrate(data); save(); alert("Imported!");
  } catch { alert("That file doesn't look like a Card Champions backup."); }
  e.target.value = "";
});
$("#reset-btn").addEventListener("click", () => {
  if (confirm("Delete ALL players, games and matches?")) { state = { players: [], games: [], matches: [] }; save(); }
});
$("#clear-demo").addEventListener("click", () => {
  if (confirm("Remove the demo players and matches? (Games are kept.)")) { state = { players: [], games: state.games, matches: [] }; save(); }
});

document.querySelectorAll("[data-ic]").forEach((el) => (el.innerHTML = uniq(iconSvg(el.dataset.ic))));
render();
initCloud().then(renderOwnerBox);
