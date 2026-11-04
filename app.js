/* Card War: scoreboard logic. Data syncs to Supabase (see config.js); ?demo shows sample data. */
const KEY = "card-champions-v1";
const PALETTE = ["#e0412e", "#2f6fd0", "#4e9a3a", "#f4b81c", "#8a5bb8", "#f05a28", "#14c3b0", "#ff5c8a", "#444444"];
const CHARS = ["mario", "luigi", "peach", "yoshi", "toad", "dk", "wario", "bowser", "daisy", "drybones", "waluigi", "rob"];
const CHAR_NAMES = { mario: "Mario", luigi: "Luigi", peach: "Peach", yoshi: "Yoshi", toad: "Toad", dk: "Donkey Kong", wario: "Wario", bowser: "Bowser", daisy: "Daisy", drybones: "Dry Bones", waluigi: "Waluigi", rob: "R.O.B." };
// characters from the earlier version, mapped to the closest new one
const CHAR_ALIAS = { koopa: "yoshi", goomba: "dk", lakitu: "drybones", blooper: "rob", piranha: "yoshi", spiny: "bowser" };


const uid = () => Math.random().toString(36).slice(2, 10);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
// each icon copy gets its own gradient ids, so hidden copies never blank out visible ones
let icN = 0;
const uniq = (svg) => { const n = (++icN).toString(36); return svg.replace(/id="([^"]+)"/g, `id="$1_${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1_${n})`).replace(/href="#([^"]+)"/g, `href="#$1_${n}"`); };
const iconSvg = (name) => ICONS[name] || ICONS[ICON_ALIAS[name]] || ICONS.cards;
const ic = (name, cls = "") => `<i class="ic ${cls}">${uniq(iconSvg(name))}</i>`;

/* ---------------- Profile icon: Mario character (default) or photo ---------------- */
const charOf = (p) => (CHARS.includes(p.char) ? p.char : CHAR_ALIAS[p.char] || CHARS[[...String(p.id || p.name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 4]);
const spr = (name) => `sprites/${name}.png`;
const head = (c) => `sprites/chars/${c}.png`;
const avatar = (p, size = "md", cls = "") => `<span class="pi pi-${size} ${cls}" style="--c:${esc(p.color || "#2f6fd0")}">` +
  (p.photo ? `<img class="ph" src="${esc(p.photo)}" alt="" />` : `<img class="ch" src="${head(charOf(p))}" alt="" />`) + `</span>`;

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
    if (!p.face) p.face = "smile";
    if (!/^#[0-9a-f]{6}$/i.test(p.color || "")) p.color = PALETTE[i % PALETTE.length];
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
  players: { to: (p) => ({ id: p.id, name: p.name, color: p.color, face: p.face || "smile", photo: p.photo || null, char: p.char || null }), from: (r) => ({ id: r.id, name: r.name, color: r.color, face: r.face, photo: r.photo || null, char: r.char || null }) },
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

/* ---------------- Register (name prompt) / private screen ---------------- */
function showLock(mode) {
  $("#lock").hidden = false;
  document.body.classList.add("locked");
  const body = $("#lock-body");
  if (mode === "name") {
    body.innerHTML = `<h1>HELLO NOOBS!</h1><div class="sub">Here to see your worth :D!</div>
      <div class="panel"><h2>PLAYER ENTRY</h2>
        <label class="lab" for="lock-name">ENTER YOUR NAME</label>
        <div class="name-entry"><img class="px" src="sprites/mario.png" alt="" /><input id="lock-name" maxlength="24" placeholder="e.g. Haretz BITCH" value="${esc(editorName())}" autocomplete="nickname" /></div>
        <p class="hint">Your name shows in the change log next to anything you add or edit.</p>
        <label class="chk"><input type="checkbox" id="lock-fair" checked /><span class="tick"></span><span>I promise to record every win honestly, else im a retard</span></label>
        <button class="btn gold start" id="lock-go"><img class="px" src="sprites/mario-run2.png" alt="" />PRESS START</button></div>
      <div class="foot">© CARD WAR · SEASON 1</div>`;
    const go = () => { const n = $("#lock-name").value.trim(); if (!n) return $("#lock-name").focus(); lsSet("cnc-editor", n); location.reload(); };
    $("#lock-go").onclick = go;
    $("#lock-name").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    setTimeout(() => $("#lock-name").focus(), 50);
    return;
  }
  body.innerHTML = `<h1>PRIVATE GAME</h1><div class="sub">Open Card War with the invite link you were sent.</div>
    <div class="panel"><h2>JOIN</h2>
      <div class="field"><label class="lab" for="lock-invite">INVITE LINK</label><input id="lock-invite" placeholder="Paste your invite link" autocomplete="off" /></div>
      <button class="btn gold start" id="lock-join">JOIN GAME</button>
      <details style="margin-top:22px"><summary class="lab" style="cursor:pointer">I'M THE OWNER</summary>
        <div class="field"><label class="lab" for="sb-url">PROJECT URL</label><input id="sb-url" placeholder="https://your-project.supabase.co" autocomplete="off" /></div>
        <div class="field"><label class="lab" for="sb-key">PUBLISHABLE KEY</label><input id="sb-key" placeholder="sb_publishable_…" autocomplete="off" /></div>
        <button class="btn" id="sb-connect">CONNECT</button></details></div>`;
  body.querySelectorAll(".field input").forEach((i) => Object.assign(i.style, { width: "100%" }));
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
        <button class="btn gold" id="ow-login">SIGN IN</button>
      </div>`;
    $("#ow-login").onclick = async () => {
      const { error } = await sb.auth.signInWithPassword({ email: $("#ow-email").value.trim(), password: $("#ow-pass").value });
      if (error) toast("Sign-in failed: " + error.message);
    };
    return;
  }
  box.innerHTML = `<p class="muted">Loading…</p>`;
  const { data, error } = await sb.from("activity_log").select("*").order("at", { ascending: false }).limit(150);
  const head = `<div class="btn-row owner-head"><span class="name-chip">${esc(session.user.email)}</span>
    <button class="btn small ghost" id="ow-refresh">REFRESH</button><button class="btn small ghost" id="ow-logout">SIGN OUT</button></div>`;
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
      const ch = ["name", "color", "char", "photo"].filter((k) => e.old_data[k] !== e.new_data[k]);
      if (ch.includes("name")) what = `player <b>${esc(e.old_data.name)}</b> → <b>${esc(e.new_data.name)}</b>`;
      else if (ch.length) what += ` (${ch.map((k) => ({ color: "colour", char: "character", photo: "picture" }[k])).join(", ")})`;
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
  const chars = ["mario", "peach", "luigi", "toad", "yoshi", "daisy"];
  const cols = ["#2f6fd0", "#e0412e", "#4e9a3a", "#8a5bb8", "#f4b81c", "#14c3b0"];
  const players = names.map((name, i) => ({ id: uid(), name, color: cols[i], face: "smile", char: chars[i] }));
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
  renderHud(ranked, matches);
  renderPodium(ranked);
  renderStats(ranked, matches);
  renderRanking(ranked);
  renderGameChamps();
  renderRecent([...matches].reverse().slice(0, 5));
  renderHistory();
  renderManage();
}

function renderHud(ranked, matches) {
  const top = ranked[0], g = filter === "all" ? null : gameOf(filter);
  $("#hud-name").textContent = top ? top.p.name.toUpperCase().slice(0, 10) : "CARD WAR";
  $("#hud-wins").textContent = String(top ? top.wins : 0).padStart(6, "0");
  $("#hud-coins").textContent = matches.length;
  $("#hud-world").textContent = g ? g.name.toUpperCase().slice(0, 8) : "ALL";
  $("#hud-day").textContent = new Date().toLocaleDateString("en", { month: "short", day: "numeric" }).toUpperCase();
  $("#scope").textContent = g ? g.name.toUpperCase() : "ALL GAMES";
}

function renderTabs() {
  if (filter !== "all" && !byId(state.games, filter)) filter = "all";
  const tabs = [{ id: "all", name: "All games", icon: "cards" }, ...state.games];
  const el = $("#game-tabs");
  el.innerHTML = tabs.map((t) => `<button class="tab ${filter === t.id ? "active" : ""}" data-filter="${t.id}">${ic(t.icon)}${esc(t.name)}</button>`).join("");
  const act = el.querySelector(".tab.active"); // scroll the row only, never the page
  if (act && (act.offsetLeft < el.scrollLeft || act.offsetLeft + act.offsetWidth > el.scrollLeft + el.clientWidth)) el.scrollLeft = act.offsetLeft - 8;
}

/* Top three on pipes: 2nd, 1st, 3rd */
function renderPodium(ranked) {
  if (!ranked.length) {
    $("#podium").innerHTML = `<div class="top3-empty"><p>NO MATCHES YET.<br>PLAY A GAME TO CROWN A CHAMPION!</p><button class="qbtn" data-action="new-match"><img class="px" src="sprites/q1.png" alt="" />ADD MATCH</button></div>`;
    return;
  }
  const h = [128, 84, 52], size = ["xl", "lg", "lg"];
  $("#podium").innerHTML = [1, 0, 2].map((i) => {
    const s = ranked[i];
    const pipe = `<span class="pipe"><span class="t"></span><span class="b" style="height:${h[i]}px">${i + 1}</span></span>`;
    if (!s) return `<div class="slot ghost r${i + 1}"><span class="pi pi-${size[i]}" style="--c:#222"></span><b>???</b><small>WAITING</small>${pipe}</div>`;
    return `<button class="slot r${i + 1}" data-player="${s.p.id}">${avatar(s.p, size[i])}<b>${esc(s.p.name.toUpperCase())}</b><small>${String(s.wins).padStart(3, "0")} WINS · ${pct(s.rate)}</small>${pipe}</button>`;
  }).join("");
}

function renderStats(ranked, matches) {
  const bestRate = [...ranked].filter((s) => s.played >= 3).sort((a, b) => b.rate - a.rate || b.played - a.played)[0];
  const hot = [...ranked].filter((s) => s.streak > 0).sort((a, b) => b.streak - a.streak)[0];
  const counts = {};
  matches.forEach((m) => (counts[m.gameId] = (counts[m.gameId] || 0) + 1));
  const topG = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const fav = topG && byId(state.games, topG[0]);
  const days = new Set(matches.map((m) => m.date)), first = matches[0];
  const row = (img, label, sub, val) => `<div class="st"><img class="px" src="${spr(img)}" alt="" /><span>${label}${sub ? `<i>${sub}</i>` : ""}</span><b>${val}</b></div>`;
  $("#stats").innerHTML =
    row("coin1", "Matches", matches.length ? `last one ${(relDay(matches[matches.length - 1].date) || fmtDate(matches[matches.length - 1].date)).toLowerCase()}` : "none yet", `× ${matches.length}`) +
    row("q1", "Best win rate", bestRate ? `${esc(bestRate.p.name)}, ${plural(bestRate.played, "game")}` : "needs 3+ games", bestRate ? pct(bestRate.rate) : "—") +
    row("spiny", "On fire", hot ? `${esc(hot.p.name)}, wins in a row` : "no streak right now", hot ? `× ${hot.streak}` : "—") +
    row("flag-top", "Most played", fav ? plural(topG[1], "match").replace("matchs", "matches") : "play a game first", fav ? esc(fav.name.toUpperCase().slice(0, 9)) : "—") +
    row("mario", "Players", "", `× ${state.players.length}`) +
    row("used", "Game days", first ? `since ${fmtDate(first.date)}` : "", `× ${days.size}`);
}

function renderRanking(ranked) {
  $("#ranking").innerHTML = ranked.length ? ranked.map((s, i) => {
    const n = Math.round(s.rate * 10);
    return `<div class="rk" data-player="${s.p.id}"><span class="n">${i + 1}</span>${avatar(s.p, "sm")}<span class="nm">${esc(s.p.name)}</span>
      <span class="bar" title="${pct(s.rate)} win rate">${Array.from({ length: 10 }, (_, k) => `<u class="${k < n ? "on" : ""}"></u>`).join("")}</span><span class="w">${s.wins}W</span></div>`;
  }).join("") : `<p class="empty">No results yet</p>`;
}

function renderGameChamps() {
  const el = $("#game-champs");
  if (!state.games.length) { el.innerHTML = `<p class="empty">Add a game in Manage</p>`; return; }
  el.innerHTML = state.games.map((g) => {
    const { ranked, matches } = computeStats(g.id);
    const c = ranked[0];
    return `<button class="gc" data-filter="${g.id}">${ic(g.icon)}<span>${esc(g.name)}<small>${plural(matches.length, "match").replace("matchs", "matches")}</small></span>
      ${c ? `<span class="champ">${avatar(c.p, "xs")}${esc(c.p.name)} <b>${c.wins}W</b></span>` : `<span class="muted">No winner yet</span>`}</button>`;
  }).join("");
}

const listNames = (ps) => (ps.length > 1 ? ps.slice(0, -1).join(", ") + " and " + ps[ps.length - 1] : ps[0] || "nobody");
function renderRecent(ms) {
  $("#recent").innerHTML = ms.length ? ms.map((m) => {
    const w = byId(state.players, m.winnerId), g = gameOf(m.gameId);
    const others = m.players.filter((id) => id !== m.winnerId).map((id) => esc(byId(state.players, id)?.name || "?"));
    return `<div class="lg">${w ? avatar(w, "sm") : ""}<span><b>${w ? esc(w.name) : "?"}</b> beat ${listNames(others)} at ${esc(g.name)}.</span><small>${(relDay(m.date) || fmtDate(m.date)).toUpperCase()}</small></div>`;
  }).join("") : `<p class="empty">No matches yet</p>`;
}

function matchItem(m) {
  const g = gameOf(m.gameId), w = byId(state.players, m.winnerId);
  const ps = m.players.map((id) => byId(state.players, id)).filter(Boolean);
  const others = ps.filter((p) => p.id !== m.winnerId).map((p) => esc(p.name));
  return `<div class="match">${ic(g.icon)}<span><b>${w ? esc(w.name) : "?"}</b> won ${esc(g.name)}<small>vs ${listNames(others)}</small></span>
    <span class="stack">${ps.slice(0, 5).map((p) => avatar(p, "xs", p.id === m.winnerId ? "win" : "")).join("")}</span>
    <button class="icon-btn" data-edit-match="${m.id}" title="Edit">${ic("edit")}</button><button class="icon-btn del" data-del-match="${m.id}" title="Delete">${ic("delete")}</button></div>`;
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
    <div class="hs"><img class="px" src="sprites/coin1.png" alt="" /><div><b>${ms.length}</b><span>matches</span></div></div>
    <div class="hs"><img class="px" src="sprites/used.png" alt="" /><div><b>${Object.keys(days).length}</b><span>game days</span></div></div>
    ${pw !== null ? `<div class="hs"><img class="px" src="sprites/q1.png" alt="" /><div><b>${pw} / ${ms.length}</b><span>won by ${esc(byId(state.players, hist.player).name)}</span></div></div>`
      : `<div class="hs">${tp ? avatar(tp, "sm") : ""}<div><b>${tp ? esc(tp.name.toUpperCase()) : "—"}</b><span>${tp ? `most wins here (${topW[1]})` : "most wins here"}</span></div></div>`}`;

  const allDays = Object.entries(days);
  $("#history-list").innerHTML = allDays.length ? allDays.slice(0, hist.limit).map(([d, list]) => `
    <div class="day">
      <div class="day-head"><span class="day-badge"><span><b>${D(d).getDate()}</b>${D(d).toLocaleDateString("en", { month: "short" }).toUpperCase()}</span></span>
        <div><div class="day-title">${fmtLong(d).toUpperCase()}</div><div class="muted">${relDay(d) ? relDay(d) + " · " : ""}${plural(list.length, "match").replace("matchs", "matches")}</div></div></div>
      ${list.map((m) => matchItem(m)).join("")}
    </div>`).join("") + (allDays.length > hist.limit ? `<div class="show-more"><button class="btn ghost" id="h-more">SHOW MORE DAYS (${allDays.length - hist.limit} LEFT)</button></div>` : "")
    : `<div class="box"><p class="empty">No matches for these filters</p></div>`;
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
      <button class="icon-btn" data-edit-player="${p.id}" title="Edit">${ic("edit")}</button>
      <button class="icon-btn del" data-del-player="${p.id}" title="Remove">${ic("delete")}</button></li>`).join("") || `<li class="empty">No players yet</li>`;
  $("#game-list").innerHTML = state.games.map((g) => {
    const n = state.matches.filter((m) => m.gameId === g.id).length;
    return `<li>${ic(g.icon)}<span class="grow">${esc(g.name)} <span class="muted">· ${plural(n, "match").replace("matchs", "matches")}</span></span>
      <button class="icon-btn" data-edit-game="${g.id}" title="Edit">${ic("edit")}</button>
      <button class="icon-btn del" data-del-game="${g.id}" title="Remove">${ic("delete")}</button></li>`;
  }).join("") || `<li class="empty">No games yet</li>`;
  $("#demo-note").hidden = !state.demo;
}

/* ---------------- Player / game editor ---------------- */
let editing = null; // {type:'player'|'game', id, draft}
const iconGrid = (sel) => GAME_ICONS.map((k) => `<button type="button" class="icon-opt ${sel === k ? "on" : ""}" data-pick-icon="${k}">${ic(k)}</button>`).join("");

function openPlayerEditor(id) {
  const p = id ? byId(state.players, id) : null;
  editing = { type: "player", id, draft: p ? { ...p, char: charOf(p) } : { name: "", color: PALETTE[state.players.length % PALETTE.length], face: "smile", char: CHARS[state.players.length % CHARS.length] } };
  $("#e-title").textContent = p ? "EDIT PLAYER" : "NEW PLAYER";
  drawPlayerEditor();
  $("#e-error").textContent = "";
  $("#edit-modal").showModal();
  setTimeout(() => $("#e-name")?.focus(), 50);
}
function drawPlayerEditor() {
  const d = editing.draft;
  $("#e-body").innerHTML = `
    <div class="editor-top">${avatar(d, "xl")}
      <div class="photo-actions">
        <label class="btn small">${d.photo ? "CHANGE PHOTO" : "⬆ UPLOAD PHOTO"}<input type="file" id="e-photo" accept="image/*" hidden /></label>
        ${d.photo ? `<button type="button" class="btn small ghost" id="e-photo-remove">USE CHARACTER</button>` : ""}
      </div></div>
    <label class="field-label" for="e-name">NAME</label><input id="e-name" maxlength="24" value="${esc(d.name)}" placeholder="Player name" />
    <div class="field-label">CHARACTER ${d.photo ? `<span class="muted">used when there's no photo</span>` : `<span class="muted">${CHAR_NAMES[d.char] || ""}</span>`}</div>
    <div class="chars">${CHARS.map((c) => `<button type="button" class="${d.char === c ? "on" : ""}" data-pick-char="${c}" title="${CHAR_NAMES[c]}" aria-label="${CHAR_NAMES[c]}"><img src="${head(c)}" alt="" /></button>`).join("")}</div>
    <div class="field-label">COLOUR</div>
    <div class="swatches">${PALETTE.map((c) => `<button type="button" class="swatch ${d.color === c ? "on" : ""}" style="--c:${c}" data-pick-color="${c}" aria-label="colour ${c}"></button>`).join("")}
      <label class="swatch custom" title="Pick any colour"><input type="color" id="e-color" value="${d.color}" /></label></div>`;
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
  $("#e-title").textContent = g ? "EDIT GAME" : "NEW GAME";
  drawGameEditor();
  $("#e-error").textContent = "";
  $("#edit-modal").showModal();
}
function drawGameEditor() {
  const d = editing.draft;
  $("#e-body").innerHTML = `
    <div class="editor-preview">${ic(d.icon, "xl")}</div>
    <label class="field-label" for="e-name">GAME NAME</label><input id="e-name" maxlength="24" value="${esc(d.name)}" placeholder="e.g. UNO, Poker, Big Two" />
    <div class="field-label">ICON</div>
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
    return `<div class="pg-row"><span>${ic(g.icon)}${esc(g.name)}</span><span class="bar">${Array.from({ length: 10 }, (_, k) => `<u class="${k < Math.round(r * 10) ? "on" : ""}"></u>`).join("")}</span><span>${b.wins}/${b.played} · ${pct(r)}</span></div>`;
  }).join("");
  const lastM = sortedMatches().filter((m) => m.players.includes(pid)).pop();
  $("#profile-body").innerHTML = `
    <div class="profile-head">${avatar(p, "lg")}<div><h2>${esc(p.name.toUpperCase())}</h2><div class="muted">Rank #${s ? all.indexOf(s) + 1 : "—"}${lastM ? ` · last played ${fmtDate(lastM.date)}` : ""}</div></div>
      <button class="btn small" data-edit-player="${p.id}">CUSTOMISE</button></div>
    <div class="profile-stats">
      <div><b>${s?.wins ?? 0}</b><span>Wins</span></div><div><b>${s?.played ?? 0}</b><span>Played</span></div>
      <div><b>${s ? pct(s.rate) : "0%"}</b><span>Win rate</span></div><div><b>${s?.bestStreak ?? 0}</b><span>Best streak</span></div>
    </div>
    <div class="field-label">WINS PER GAME</div>
    ${rows || `<p class="empty">No matches yet</p>`}
    ${s ? `<div class="field-label">LAST 5</div>${form(s.form)}` : ""}`;
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
  $("#m-title").textContent = m ? "EDIT MATCH" : "ADD A MATCH";
  $("#m-date").value = m ? m.date : today();
  $("#m-ng-name").value = "";
  $("#m-error").textContent = "";
  drawMatchModal();
  $("#match-modal").showModal();
}
function drawMatchModal() {
  $("#m-games").innerHTML = state.games.map((g) =>
    `<button type="button" class="gpick ${mm.gameId === g.id ? "on" : ""}" data-pick-game="${g.id}">${ic(g.icon)}${esc(g.name)}</button>`).join("") +
    `<button type="button" class="gpick add ${mm.gameId === "__new" ? "on" : ""}" data-pick-game="__new">${ic("add")}New game</button>`;
  $("#m-newgame").hidden = mm.gameId !== "__new";
  $("#m-ng-icons").innerHTML = iconGrid(mm.ngIcon);
  $("#m-players").innerHTML = state.players.map((p) =>
    `<button type="button" class="pick ${mm.players.has(p.id) ? "on" : ""}" data-pick="${p.id}">${avatar(p, "xs")}${esc(p.name)}</button>`).join("") +
    `<span class="pick add-player"><span class="plus">+</span><input id="m-np" maxlength="24" placeholder="New player" aria-label="New player name" /><button type="button" class="btn small" id="m-np-add">ADD</button></span>`;
  const addNew = () => {
    const name = $("#m-np").value.trim(); if (!name) return $("#m-np").focus();
    const existing = state.players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    let id = existing && existing.id;
    if (!id) { if (state.demo) { clearDemoIfNeeded(); mm.players.clear(); mm.winner = null; } id = uid(); state.players.push({ id, name, color: PALETTE[state.players.length % PALETTE.length], face: "smile", photo: null, char: CHARS[state.players.length % CHARS.length] }); save(); }
    mm.players.add(id); drawMatchModal(); $("#m-error").textContent = "";
  };
  $("#m-np-add").onclick = addNew;
  $("#m-np").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } });
  const ps = state.players.filter((p) => mm.players.has(p.id));
  $("#m-winner").innerHTML = ps.length ? ps.map((p) =>
    `<button type="button" class="pick win ${mm.winner === p.id ? "on" : ""}" data-win="${p.id}">${avatar(p, "xs")}${esc(p.name)}${mm.winner === p.id ? `<img class="px" src="sprites/coin1.png" alt="" style="width:16px" />` : ""}</button>`).join("")
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
  const nav = document.querySelector(".menu");
  if (nav.getBoundingClientRect().top <= 0) window.scrollTo({ top: nav.offsetTop - 4, behavior: "smooth" });
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
  else if (d.filter) { filter = d.filter; render(); if (t.classList.contains("gc")) $("#game-tabs").scrollIntoView({ behavior: "smooth", block: "start" }); }
  else if (d.pickGame) { mm.gameId = d.pickGame; drawMatchModal(); if (d.pickGame === "__new") $("#m-ng-name").focus(); }
  else if (d.pickIcon) {
    if ($("#edit-modal").open && editing?.type === "game") { editing.draft.icon = d.pickIcon; drawGameEditor(); }
    else { mm.ngIcon = d.pickIcon; drawMatchModal(); }
  }
  else if (d.pickColor) { editing.draft.color = d.pickColor; drawPlayerEditor(); }
  else if (d.pickChar) { editing.draft.char = d.pickChar; drawPlayerEditor(); }
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
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `card-war-${today()}.json` });
  a.click(); URL.revokeObjectURL(a.href);
});
$("#import-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.players) || !Array.isArray(data.matches)) throw 0;
    state = migrate(data); save(); alert("Imported!");
  } catch { alert("That file doesn't look like a Card War backup."); }
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
// menu gets a bottom line once it sticks to the top
addEventListener("scroll", () => { const n = document.querySelector(".menu"); n.classList.toggle("stuck", n.getBoundingClientRect().top <= 0); }, { passive: true });
