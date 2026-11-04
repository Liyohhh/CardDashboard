/* 8-bit animated header scene, drawn on a small canvas and scaled up with crisp pixels.
   The scene adapts its width to the header, so it is never stretched or awkwardly cropped. */
(function () {
  const cv = document.getElementById("hero-art");
  if (!cv) return;
  const H = 66; // scene height in "art pixels"
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 300, X = cv.getContext("2d"), bg = null, layout = null, seed = 7;

  /* ---------- tiny pixel helpers ---------- */
  const R = (x, y, w, h, c) => { X.fillStyle = c; X.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) P(cx + x, cy + y, c); };
  const sprite = (x0, y0, rows, pal) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) P(x0 + x, y0 + y, pal[ch]); }));
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* ---------- 5x7 font ---------- */
  const F = {
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."], G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".####"],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"], R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."], "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  };
  const tw = (t, s) => t.length * 6 * s - s;
  const glyphs = (t, x0, y0, s, col) => [...t].forEach((ch, i) => (F[ch] || F[" "]).forEach((row, y) => [...row].forEach((c, x) => {
    if (c === "#") for (let yy = 0; yy < s; yy++) R(x0 + (i * 6 + x) * s, y0 + y * s + yy, s, 1, col(y * s + yy, s * 7));
  })));

  /* ---------- palette ---------- */
  const G = { o: "#1b4d2a", d: "#26733a", m: "#35a04a", l: "#5cc75a", h: "#9ae86f" };

  /* ---------- scenery ---------- */
  function sky() {
    const stops = [[0, "#2a74e0"], [11, "#3584ea"], [22, "#4596f2"], [32, "#5aa9f8"], [42, "#74bcfc"]];
    stops.forEach(([y, c], i) => {
      const y1 = i + 1 < stops.length ? stops[i + 1][0] : H;
      R(0, y, W, y1 - y, c);
      if (i + 1 < stops.length) for (let yy = y1 - 3; yy < y1; yy++) for (let x = 0; x < W; x++) if ((x + yy) % 2 === 0) P(x, yy, stops[i + 1][1]);
    });
  }
  function cloudBand(y) {
    for (let x = -6; x < W + 8; x += 13) disc(x, y + 6 - 3, 5 + Math.round(rnd() * 4), "#cfe7ff");
    R(0, y + 5, W, 14, "#cfe7ff");
    for (let x = -6; x < W + 8; x += 13) disc(x - 1, y + 4 - 2, 4 + Math.round(rnd() * 4), "#ffffff");
    R(0, y + 6, W, 3, "#ffffff");
  }
  function hills(y) {
    for (let x = -10; x < W + 30; x += 46) { disc(x, y + 16, 20, "#6cc28a"); disc(x - 2, y + 15, 19, "#82d39a"); }
    for (let x = 12; x < W + 30; x += 46) { disc(x, y + 20, 16, "#5bb57c"); }
  }
  function canopyBlob(cx, cy, r) {
    disc(cx, cy, r + 1, G.o); disc(cx, cy, r, G.d); disc(cx - 1, cy - 1, r - 1, G.m); disc(cx - 2, cy - 2, Math.max(1, r - 3), G.l);
    for (let i = 0; i < r; i++) { const a = rnd() * 6.28, d = rnd() * (r - 2); P(cx - 2 + Math.round(Math.cos(a) * d * 0.6), cy - 2 + Math.round(Math.sin(a) * d * 0.6), G.h); }
  }
  function tree(x, base, s) {
    const th = Math.round(15 * s), r = Math.round(8 * s);
    R(x - 2, base - th, 4, th, "#3d2414"); R(x - 1, base - th, 2, th, "#7a4b2a"); P(x, base - th + 3, "#a8683a");
    [[-r + 2, -th - 2, r - 1], [r - 2, -th - 1, r - 1], [0, -th - r + 2, r], [-r / 2, -th - r / 2 - 2, r - 1], [r / 2, -th - r / 2, r - 1]]
      .forEach(([dx, dy, rr]) => canopyBlob(x + Math.round(dx), base + Math.round(dy), Math.round(rr)));
  }
  function bush(x, base, w) {
    const n = Math.max(2, Math.round(w / 7)), step = w / (n - 1);
    for (let i = 0; i < n; i++) disc(x + Math.round(i * step), base - 4 - (i % 2) + 1, 5 + (i % 2), G.o);
    for (let i = 0; i < n; i++) { const cx = x + Math.round(i * step), r = 4 + (i % 2); disc(cx, base - r + 1, r, G.d); disc(cx - 1, base - r, r - 1, G.m); disc(cx - 2, base - r - 1, Math.max(1, r - 3), G.l); }
  }
  function ground(y) {
    R(0, y + 4, W, H - y - 4, "#6b4226");
    for (let i = 0; i < W * 0.9; i++) { const xx = Math.floor(rnd() * W), yy = y + 6 + Math.floor(rnd() * (H - y - 6)); R(xx, yy, 2, 1, rnd() < 0.5 ? "#553219" : "#83532f"); }
    R(0, y, W, 5, G.m); R(0, y, W, 1, G.l); R(0, y + 4, W, 1, G.d);
    for (let x = 0; x < W; x++) { if (x % 3 === 0) P(x, y - 1, G.m); if (x % 6 === 1) { P(x, y - 2, G.l); P(x, y - 1, G.l); } if (x % 9 === 4) { P(x, y + 5, G.m); P(x, y + 6, G.d); } }
  }
  function badge(cx, y, w, h) {
    const x = Math.round(cx - w / 2);
    R(x + 2, y + 2, w, h, "rgba(10,30,90,.35)");
    R(x + 2, y, w - 4, h, "#1d2f63"); R(x, y + 2, w, h - 4, "#1d2f63"); R(x + 1, y + 1, w - 2, h - 2, "#1d2f63");
    R(x + 3, y + 1, w - 6, h - 2, "#2c4a92"); R(x + 1, y + 3, w - 2, h - 6, "#2c4a92"); R(x + 2, y + 2, w - 4, h - 4, "#2c4a92");
    R(x + 3, y + 2, w - 6, 1, "#5b80d6"); R(x + 3, y + h - 3, w - 6, 1, "#223b7a");
    const t = "CARD NIGHT!", s = 2, tx = Math.round(cx - tw(t, s) / 2), ty = y + Math.round((h - 14) / 2);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 2; dy++) glyphs(t, tx + dx, ty + dy, s, () => "#4a1d06");
    glyphs(t, tx, ty, s, (r, hh) => (r < hh * 0.35 ? "#ffe066" : r < hh * 0.6 ? "#ffb52e" : "#ff7a1a"));
    glyphs(t, tx, ty, s, (r) => (r === 0 ? "#fff6c4" : "transparent"));
  }
  function consoleMini(x, y) { // 11 x 16 handheld
    R(x + 1, y, 9, 16, "#1e1b3a"); R(x, y + 1, 11, 14, "#1e1b3a"); R(x + 1, y + 1, 9, 14, "#ff8a3d"); R(x + 1, y + 1, 9, 1, "#ffb27a"); R(x + 1, y + 13, 9, 1, "#e0651c");
    R(x + 2, y + 2, 7, 6, "#2b2650"); R(x + 3, y + 3, 5, 4, "#8be28b"); P(x + 4, y + 4, "#ff3b5c"); P(x + 6, y + 4, "#ff3b5c"); R(x + 4, y + 5, 3, 1, "#ff3b5c"); P(x + 5, y + 6, "#ff3b5c");
    R(x + 2, y + 10, 3, 1, "#1e1b3a"); R(x + 3, y + 9, 1, 3, "#1e1b3a"); P(x + 8, y + 10, "#ff4d6d"); P(x + 7, y + 12, "#ffc928");
  }

  /* ---------- animated bits ---------- */
  const SUIT = { S: ["..#..", ".###.", "#####", "#####", "..#.."], H: [".#.#.", "#####", "#####", ".###.", "..#.."], D: ["..#..", ".###.", "#####", ".###.", "..#.."], C: [".###.", ".###.", "#####", "#####", "..#.."] };
  function miniCard(x, y, suit) {
    const col = suit === "H" || suit === "D" ? "#e8314a" : "#23263a";
    R(x + 1, y, 7, 12, "#23263a"); R(x, y + 1, 9, 10, "#23263a"); R(x + 1, y + 1, 7, 10, "#fff"); R(x + 1, y + 10, 7, 1, "#dfe6f3");
    sprite(x + 2, y + 4, SUIT[suit], { "#": col });
  }
  const COIN = [ // spin frames
    [".###.", "#ooo#", "#oyo#", "#oyo#", "#oyo#", "#ooo#", ".###."],
    ["..#..", ".#o#.", ".#y#.", ".#y#.", ".#y#.", ".#o#.", "..#.."],
    ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    ["..#..", ".#o#.", ".#y#.", ".#y#.", ".#y#.", ".#o#.", "..#.."],
  ];
  const coin = (x, y, f) => sprite(x, y, COIN[f % 4], { "#": "#7a4a00", o: "#ffc928", y: "#fff1a8" });
  function sparkle(x, y, phase) {
    if (phase === 0) return;
    const w = "#ffffff", g = "#fff2a8";
    P(x, y, w);
    if (phase >= 1) { P(x - 1, y, w); P(x + 1, y, w); P(x, y - 1, w); P(x, y + 1, w); }
    if (phase >= 2) { P(x - 2, y, g); P(x + 2, y, g); P(x, y - 2, g); P(x, y + 2, g); }
  }
  function smallCloud(x, y, w) {
    R(x + 2, y + 2, w - 4, 3, "#fff"); R(x, y + 4, w, 2, "#fff"); disc(x + 4, y + 2, 2, "#fff"); disc(x + w / 2, y + 1, 3, "#fff"); disc(x + w - 5, y + 2, 2, "#fff"); R(x, y + 6, w, 1, "#cfe7ff");
  }

  /* ---------- layout + static background ---------- */
  function build() {
    const rect = cv.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    W = Math.max(160, Math.round(H * rect.width / rect.height));
    cv.width = W; cv.height = H;
    // On wide screens the champion card covers the left side: centre the title in the open space.
    const mobile = window.innerWidth <= 860;
    const card = document.querySelector(".champ-card");
    let leftSafe = 0;
    if (!mobile && card) leftSafe = Math.min(W * 0.45, ((card.getBoundingClientRect().right - rect.left) / rect.width) * W);
    const cx = Math.round((leftSafe + W) / 2);
    const bw = 142, by = 16, gy = 54;
    seed = 7;
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const keep = X; X = off.getContext("2d");
    sky();
    cloudBand(30);
    hills(36);
    const bushes = [];
    for (let x = 30; x < W - 30; x += 38) bushes.push([x + Math.round(rnd() * 8), 12 + Math.round(rnd() * 10)]);
    bushes.forEach(([x, w]) => bush(x, gy, w));
    tree(14, gy, mobile ? 1 : 1.2); tree(W - 14, gy, mobile ? 1 : 1.15);
    if (!mobile && leftSafe > 60) tree(Math.round(leftSafe) - 6, gy, 0.8);
    ground(gy);
    badge(cx, by, bw, 22);
    consoleMini(cx - 9, gy - 16);
    X = keep;
    bg = off;
    // animated items, relative to the title
    layout = {
      cx, gy,
      coins: [-60, -51, -42, 34, 43, 52].map((d) => cx + d),
      cards: [[cx - 33, "D"], [cx - 22, "C"], [cx + 5, "S"], [cx + 16, "H"]],
      sparkles: [[cx - 70, 6], [cx + 74, 8], [cx - 30, 4], [cx + 30, 3], [W - 40, 22], [Math.max(30, leftSafe + 10), 18], [cx + 90, 26]].map(([x, y], i) => [Math.round(x), y, i]),
      clouds: [[0.15, 6, 14], [0.55, 3, 18], [0.85, 10, 12]],
    };
    return true;
  }

  function frame(t) {
    if (!bg && !build()) return;
    X.drawImage(bg, 0, 0);
    const L = layout, s = t / 1000;
    L.clouds.forEach(([fx, y, w], i) => { const x = ((fx * W + s * (1.2 + i * 0.4)) % (W + w * 2)) - w; smallCloud(Math.round(x), y, w); });
    L.sparkles.forEach(([x, y, i]) => sparkle(x, y, [0, 1, 2, 1][Math.floor(s * 2.2 + i * 1.3) % 4]));
    L.coins.forEach((x, i) => coin(x, L.gy - 10, Math.floor(s * 6 + i)));
    L.cards.forEach(([x, suit], i) => miniCard(x, L.gy - 13 + (Math.floor(s * 2 + i) % 2 ? -1 : 0), suit));
  }

  let last = 0;
  function loop(t) {
    if (t - last > 110) { frame(t); last = t; } // ~9 fps: chunky, retro and light on battery
    requestAnimationFrame(loop);
  }
  const rebuild = () => { bg = null; frame(performance.now()); };
  window.addEventListener("resize", () => { clearTimeout(rebuild.t); rebuild.t = setTimeout(rebuild, 120); });
  window.addEventListener("load", rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  if (reduce) frame(0); else requestAnimationFrame(loop);
  window.redrawHeroArt = rebuild;
})();
