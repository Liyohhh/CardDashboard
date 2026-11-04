/* 8-bit landscape for the welcome screen: sunrise sky, mountains, meadow and a picnic of cards. */
window.drawWelcomeArt = function (cv) {
  const rect = cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const H = 170, W = Math.max(110, Math.round(H * rect.width / rect.height));
  cv.width = W; cv.height = H;
  const X = cv.getContext("2d");
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const R = (x, y, w, h, c) => { X.fillStyle = c; X.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) P(cx + x, cy + y, c); };
  const sprite = (x0, y0, rows, pal) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) P(x0 + x, y0 + y, pal[ch]); }));

  // sky: blue at the top, warm sunrise near the horizon (checker-dithered bands)
  const stops = ["#2a6fd8", "#3a83ea", "#5a9df5", "#7fb6fb", "#a9cdfd", "#cfdcf5", "#f2d9d6", "#ffd7a8"];
  const bandH = 92 / stops.length;
  stops.forEach((c, i) => {
    const y0 = Math.round(i * bandH), y1 = Math.round((i + 1) * bandH);
    R(0, y0, W, y1 - y0 + 1, c);
    if (i + 1 < stops.length) for (let y = y1 - 2; y < y1; y++) for (let x = 0; x < W; x++) if ((x + y) % 2 === 0) P(x, y, stops[i + 1]);
  });
  R(0, 92, W, H, stops[stops.length - 1]);
  // sun
  disc(Math.round(W * 0.28), 74, 9, "#ffe9b0"); disc(Math.round(W * 0.28), 74, 7, "#fff6d6");
  // clouds
  const cloud = (x, y, w) => { R(x + 2, y + 2, w - 4, 3, "#fff"); R(x, y + 4, w, 2, "#fff"); disc(x + 4, y + 2, 2, "#fff"); disc(x + w / 2, y + 1, 3, "#fff"); disc(x + w - 5, y + 2, 2, "#fff"); R(x, y + 6, w, 1, "#dbe6fb"); };
  cloud(Math.round(W * 0.1), 18, 22); cloud(Math.round(W * 0.6), 30, 28); cloud(Math.round(W * 0.82), 12, 16);
  // sparkles
  [[0.45, 10], [0.72, 52], [0.18, 40], [0.9, 30]].forEach(([fx, y]) => { const x = Math.round(W * fx); P(x, y, "#fff"); P(x - 1, y, "#fff"); P(x + 1, y, "#fff"); P(x, y - 1, "#fff"); P(x, y + 1, "#fff"); });

  // mountains (far + near with snow caps)
  const ridge = (peaks, base, col, snow) => {
    for (let x = 0; x < W; x++) {
      let top = base;
      for (const [px, py, sl] of peaks) top = Math.min(top, py + Math.abs(x - px * W) * sl);
      R(x, top, 1, H - top, col);
      if (snow) for (const [px, py, sl] of peaks) { const t = py + Math.abs(x - px * W) * sl; if (Math.abs(top - t) < 0.5 && t < py + 9) R(x, top, 1, Math.max(1, 9 - (t - py) + (x % 3 === 0 ? 1 : 0)), snow); }
    }
  };
  ridge([[0.15, 70, 0.9], [0.5, 62, 0.8], [0.88, 72, 0.9]], 104, "#b9bfea", null);
  ridge([[0.32, 50, 1.05], [0.75, 66, 0.95]], 110, "#8b93d8", "#ffffff");
  // shading on the near mountain
  for (let x = 0; x < W; x++) if (x % 2 === 0) { const y = 50 + Math.abs(x - 0.32 * W) * 1.05; if (x > 0.32 * W && y < 108) P(x, Math.round(y) + 10, "#7a82c9"); }

  // pine trees on the left
  const pine = (x, base, h) => { for (let i = 0; i < h; i++) R(x - Math.floor(i / 2.2), base - h + i, Math.floor(i / 2.2) * 2 + 1, 1, i % 4 === 0 ? "#2e6a4f" : "#3b7f5e"); R(x, base, 1, 2, "#5a3a22"); };
  [[4, 112, 16], [10, 114, 20], [17, 113, 14], [23, 116, 12]].forEach(([x, b, h]) => pine(x, b, h));

  // meadow rising to the right
  for (let x = 0; x < W; x++) {
    const top = Math.round(118 - x * 0.16 + Math.sin(x / 9) * 1.5);
    R(x, top, 1, H - top, "#6cc25a");
    R(x, top, 1, 1, "#9ae86f");
    for (let y = top + 6; y < H; y += 7) if ((x * 7 + y) % 11 === 0) P(x, y, "#58ab4c");
  }
  // flowers
  const fl = ["#ffe066", "#ff8fab", "#ffffff", "#ffb86b", "#b6d8ff"];
  for (let i = 0; i < W * 1.6; i++) {
    const x = Math.floor(rnd() * W), top = 118 - x * 0.16, y = Math.round(top + 4 + rnd() * (H - top - 4));
    const c = fl[Math.floor(rnd() * fl.length)];
    P(x, y, c); if (rnd() < 0.4) { P(x + 1, y, c); P(x, y - 1, "#3f9a43"); }
  }
  // tall foreground grass tufts
  for (let x = 0; x < W; x += 3) { const h = 3 + Math.floor(rnd() * 5); R(x, H - h, 1, h, rnd() < 0.5 ? "#3f9a43" : "#4fb24d"); }

  // picnic blanket with cards and a console
  const bx = Math.round(W * 0.42), by = 132;
  for (let y = 0; y < 14; y++) for (let x = 0; x < 34; x++) { const off = Math.round(y * 0.6); P(bx + x - off, by + y, ((Math.floor(x / 4) + Math.floor(y / 3)) % 2) ? "#ff6b7d" : "#ffffff"); }
  const SU = { S: [".#.", "###", ".#."], H: ["#.#", "###", ".#."], D: [".#.", "###", ".#."], C: [".#.", "###", "###"] };
  const card = (x, y, s) => { const col = s === "H" || s === "D" ? "#e8314a" : "#23263a"; R(x, y, 7, 10, "#23263a"); R(x + 1, y + 1, 5, 8, "#fff"); sprite(x + 2, y + 3, SU[s], { "#": col }); };
  card(bx + 2, by - 2, "S"); card(bx + 8, by - 3, "H"); card(bx + 14, by - 2, "D");
  // console
  const cx = bx + 23, cy = by - 6;
  R(cx, cy, 9, 13, "#1e1b3a"); R(cx + 1, cy + 1, 7, 11, "#7c5cff"); R(cx + 2, cy + 2, 5, 4, "#8be28b"); R(cx + 2, cy + 8, 2, 1, "#1e1b3a"); P(cx + 6, cy + 8, "#ff4d6d");
  // coins
  [[bx - 4, by + 4], [bx + 32, by + 9]].forEach(([x, y]) => { R(x, y, 3, 4, "#ffc928"); P(x + 1, y + 1, "#fff1a8"); });
};

// Draw now if the welcome screen is already showing (app.js may open it before this file loads).
(function () {
  const draw = () => { const cv = document.getElementById("welcome-art"), lock = document.getElementById("lock"); if (cv && lock && !lock.hidden) window.drawWelcomeArt(cv); };
  draw();
  window.addEventListener("load", draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
