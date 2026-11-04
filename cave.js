/* Underground cave animation: Mario runs through, grabs the coins, bumps the ? block and stomps the Goomba. */
(() => {
  const cave = document.getElementById("cave"), qb = document.getElementById("qb");
  if (!cave || !qb) return;
  const seq = ["q1", "q1", "q2", "q3", "q2"]; let qi = 0;
  setInterval(() => { if (!qb.dataset.used) { qi = (qi + 1) % seq.length; qb.src = "sprites/" + seq[qi] + ".png"; } }, 160);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const hero = document.getElementById("hero"), gb = document.getElementById("gb"), coins = [...cave.querySelectorAll(".coin")];
  let W = cave.clientWidth, hx = -60, hy = 0, vy = 0, f = 0, last = 0, bumped = false, gx = W * 0.8, sq = 0;
  addEventListener("resize", () => (W = cave.clientWidth));
  const rel = (el) => { const r = el.getBoundingClientRect(), c = cave.getBoundingClientRect(); return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }; };
  const pts = (t, x, y) => { const e = document.createElement("span"); e.className = "pts"; e.textContent = t; e.style.left = x + "px"; e.style.top = y + "px"; cave.append(e); setTimeout(() => e.remove(), 850); };

  function tick(t) {
    if (t - last > 33 && !document.hidden) {
      last = t; f++;
      const small = W < 860, H = hero.offsetHeight, maxv = small ? 11 : 14, speed = small ? 2.4 : 3.2;
      hx += speed;
      if (hx > W + 60) { hx = -60; bumped = false; delete qb.dataset.used; coins.forEach((c) => c.classList.remove("got")); }
      const hc = hx + hero.offsetWidth / 2, q = rel(qb), g = gx + gb.offsetWidth / 2, c0 = rel(coins[0]);
      // jump: at the ? block, at the coin row, and onto the goomba
      if (!hy) {
        const gap = g - hc, rv = speed + 1.2;
        if (!bumped && Math.abs(hc - (q.x + q.w / 2)) < 5) vy = maxv;
        else if (!coins[0].classList.contains("got") && Math.abs(hc - (c0.x - 30)) < 4) vy = maxv;
        else if (!sq && gap > 10 && gap <= rv * 2 * maxv * 0.92) vy = Math.max(5, Math.min(maxv, gap / (rv * 2 * 0.92)));
      }
      if (vy || hy) { hy += vy; vy -= 1; if (hy <= 0) { hy = 0; vy = 0; } }
      const top = cave.clientHeight - 64 - H - hy;
      if (!bumped && vy > 0 && top <= q.y + q.h && Math.abs(hc - (q.x + q.w / 2)) < 28) {
        bumped = true; vy = 0; qb.dataset.used = 1; qb.src = "sprites/used.png"; qb.classList.add("bump"); setTimeout(() => qb.classList.remove("bump"), 110);
        const c = document.createElement("img"); c.src = "sprites/coin1.png"; c.className = "pop"; c.style.left = q.x + q.w / 2 - 14 + "px"; c.style.top = q.y - 6 + "px"; cave.append(c); setTimeout(() => c.remove(), 650);
        pts("200", q.x + q.w + 4, q.y - 16);
      }
      coins.forEach((c) => { if (c.classList.contains("got")) return; const r = rel(c); if (hx + hero.offsetWidth > r.x && hx < r.x + r.w && top < r.y + r.h && top + H > r.y) c.classList.add("got"); });
      if (!sq && vy < 0 && hy < 44 && Math.abs(hc - g) < 30) { sq = 28; vy = 9; gb.src = "sprites/goomba-flat.png"; gb.style.height = gb.offsetWidth / 2 + "px"; pts("100", gx, cave.clientHeight - 130); }
      hero.src = "sprites/" + (hy ? "mario-jump" : ["mario-run1", "mario-run2", "mario-run3"][Math.floor(f / 3) % 3]) + ".png";
      hero.style.transform = `translate(${hx}px,${-hy}px)`;
      if (sq) { if (--sq === 0) { gx = W + 40; gb.style.height = ""; gb.src = "sprites/goomba.png"; } }
      else { gx -= 1.2; if (gx < -60) gx = W + 40; gb.src = "sprites/" + ((f >> 3) % 2 ? "goomba" : "goomba2") + ".png"; }
      gb.style.transform = `translate(${gx}px,0)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
