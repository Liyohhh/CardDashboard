/* canvas-ui effects (https://github.com/DavidHDev/canvas-ui, MIT + Commons Clause, © David Haz).
   - Header (the 8-bit canvas): Retro Dither lens under the cursor and a short Glitch burst
     every few seconds. These read the header canvas directly, so they
     work in every browser with WebGL2.
   - Ripple on taps across the page: a GPU overlay on top of the normal page.
*/
import { createRipple, createRetroDither, createGlitch } from "./vendor/canvas-ui.js";

const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const only = new URLSearchParams(location.search).get("fx"); // ?fx=ripple tests one effect
const instances = {};

function layers(host, cls, sourceEl) {
  const source = sourceEl || document.createElement("canvas");
  if (!sourceEl) { source.style.display = "none"; host.append(source); }
  const output = document.createElement("canvas");
  output.className = "cui-out " + (cls || "");
  output.setAttribute("aria-hidden", "true");
  host.append(output);
  return { source, output };
}
function safe(name, fn) {
  if (only && only !== name) return null;
  try { return (instances[name] = fn()); } catch (e) { console.warn("canvas-ui:", name, e); return null; }
}

function init() {
  if (reduceMotion) return; // respect "reduce motion"
  const hero = document.querySelector(".hero");
  const art = document.getElementById("hero-art");

  // Ripple on every tap/click, across the whole page
  safe("ripple", () => {
    const { source, output } = layers(document.body, "cui-fixed");
    return createRipple({ source, content: document.querySelector(".frame"), output },
      { trigger: "click", amplitude: 0.4, rings: 2, wavelength: 60, shine: 0.45, refraction: 60, dispersion: 0.4 });
  });


  if (!art) return;

  // Header: Retro Dither lens following the cursor (always on, transparent to the eye when idle)
  safe("dither", () => {
    const { source, output } = layers(hero, "cui-art-out cui-dither", art);
    return createRetroDither({ source, content: hero, output, },
      { liveSource: art, pixelSize: 3, levels: 4, colorize: 0.55, darkColor: [0.1, 0.16, 0.45], lightColor: [1, 0.93, 0.55],
        radius: 0.22, softness: 0.6, strength: 0.9, baseStrength: 0, scanlines: 0.25, followSpeed: 6 });
  });

  // Header: glitch burst every ~7 s (shown only while it plays)
  const glitch = safe("glitch", () => {
    const { source, output } = layers(hero, "cui-art-out cui-glitch", art);
    const g = createGlitch({ source, content: hero, output }, { liveSource: art, interval: 9999, duration: 0.45, intensity: 0.8, rgbShift: 4, shift: 22, slices: 18, noise: 0.25 });
    g._out = output;
    return g;
  });
  if (glitch) {
    const burst = () => { glitch._out.classList.add("on"); glitch.burst(); setTimeout(() => glitch._out.classList.remove("on"), 520); };
    setTimeout(function loop() { if (!document.hidden) burst(); setTimeout(loop, 7000); }, 3500);
  }


  window.canvasUi = instances;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
