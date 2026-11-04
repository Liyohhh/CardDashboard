/*! canvas-ui (vanilla WebGL builds: Ripple, RetroDither, Glitch)
 * https://github.com/DavidHDev/canvas-ui
 * Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0 (see canvas-ui-LICENSE.md).
 * Bundled from the TypeScript sources with esbuild. Modified: RetroDither and Glitch accept a
 * `liveSource` canvas option so they can process the 8-bit header in every browser. */
// ../patched/canvas-viewport.ts
var canvasDimensionLimits = /* @__PURE__ */ new WeakMap();
function getCanvasPixelRatio(element, context) {
  const scale = window.visualViewport?.scale || 1;
  const requested = Math.min(window.devicePixelRatio || 1, 2) * scale;
  const width = Math.max(element.clientWidth, 1);
  const height = Math.max(element.clientHeight, 1);
  let maxDimension = 8192;
  if (context) {
    let limit = canvasDimensionLimits.get(context);
    if (limit === void 0) {
      limit = Math.min(
        maxDimension,
        context.getParameter(context.MAX_TEXTURE_SIZE),
        context.getParameter(context.MAX_RENDERBUFFER_SIZE)
      );
      canvasDimensionLimits.set(context, limit);
    }
    maxDimension = limit;
  }
  return Math.min(
    requested,
    maxDimension / Math.max(width, height),
    Math.sqrt(16777216 / (width * height))
  );
}
function createCanvasResizeObserver(onResize) {
  const viewport = window.visualViewport;
  let frame = 0;
  let disconnected = false;
  const schedule = () => {
    if (frame || disconnected) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onResize();
    });
  };
  const observer = new ResizeObserver(schedule);
  window.addEventListener("resize", schedule, { passive: true });
  viewport?.addEventListener("resize", schedule, { passive: true });
  return {
    observe(element, options) {
      observer.observe(element, options);
    },
    unobserve(element) {
      observer.unobserve(element);
    },
    disconnect() {
      disconnected = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
    }
  };
}

// ../patched/html-in-canvas.ts
function prepareHtmlInCanvas(source, content) {
  if ("content" in source) {
    source.setAttribute("content", "drawable");
    content.setAttribute("drawable", "");
  } else {
    source.setAttribute("layoutsubtree", "");
  }
}
function drawHtmlInCanvas(source, context, content) {
  const transform = context.drawElementImage(content, 0, 0);
  const canvas = source;
  if (transform && typeof canvas.updateElementGeometry === "function") {
    canvas.updateElementGeometry(content, { canvasTransform: transform });
  }
}

// ../patched/Ripple/RippleVanilla.ts
var DEFAULTS = {
  amplitude: 0.5,
  speed: 0.65,
  wavelength: 80,
  rings: 2,
  decay: 1,
  refraction: 100,
  dispersion: 0.5,
  shine: 0.5,
  trigger: "click",
  interval: 0
};
var MAX_RIPPLES = 12;
var BASE_SPEED = 340;
var VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
var FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uContent;
uniform vec2 uResolution;
uniform vec4 uRipples[12];
uniform int uCount;
uniform float uSpeed;
uniform float uWavelength;
uniform float uWidth;
uniform float uDecay;
uniform float uRefraction;
uniform float uDispersion;
uniform float uShine;
uniform float uHasContent;
uniform float uMaxX;

vec4 page (vec2 p) {
  p.x = clamp(p.x, 0.0005, uMaxX - 0.0005);
  p.y = clamp(p.y, 0.0005, 0.9995);
  return texture(uContent, p);
}

void main () {
  vec2 pUv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 frag = pUv * uResolution;

  vec2 grad = vec2(0.0);
  float k = 6.28318530718 / uWavelength;
  float w2 = uWidth * uWidth;

  for (int i = 0; i < 12; i++) {
    if (i >= uCount) break;
    vec4 rp = uRipples[i];
    vec2 dv = frag - rp.xy;
    float r = length(dv);
    float front = uSpeed * rp.z;
    float s = r - front;
    float env = exp(-s * s / w2) * exp(-uDecay * rp.z) * rp.w;
    env *= smoothstep(0.0, 0.08, rp.z);
    env *= inversesqrt(1.0 + front / max(uWavelength, 1.0) * 0.2);
    if (env < 0.0015) continue;
    float dh = (k * cos(s * k) - 2.0 * s / w2 * sin(s * k)) * env;
    grad += dv / max(r, 1.0) * dh * uWavelength * 0.16;
  }

  float g = dot(grad, vec2(-0.55, -0.8));
  float glint = pow(clamp(g * 2.2, 0.0, 1.0), 2.0) * uShine;
  float shade = pow(clamp(-g * 1.6, 0.0, 1.0), 2.0) * uShine * 0.3;

  if (uHasContent < 0.5) {
    float a = clamp(glint * 0.9 + shade * 0.5, 0.0, 0.85);
    outColor = vec4(vec3(glint * 0.9), a);
    return;
  }

  vec2 offs = grad * uRefraction / uResolution;
  vec3 col;
  if (uDispersion > 0.001) {
    float d = uDispersion * 0.35;
    col = vec3(
      page(pUv + offs * (1.0 + d)).r,
      page(pUv + offs).g,
      page(pUv + offs * (1.0 - d)).b
    );
  } else {
    col = page(pUv + offs).rgb;
  }
  col += glint;
  col *= 1.0 - shade;
  outColor = vec4(col, 1.0);
}`;
function createRipple(elements, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const { source, content, output } = elements;
  const gl = output.getContext("webgl2", {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: true
  });
  if (!gl || gl.isContextLost()) return null;
  const sourceCtx = source.getContext("2d");
  const paintable = source;
  const htmlInCanvas = Boolean(
    sourceCtx && typeof sourceCtx.drawElementImage === "function" && typeof paintable.requestPaint === "function"
  );
  if (htmlInCanvas) prepareHtmlInCanvas(source, content);
  let contentDirty = false;
  let wake = () => {
  };
  if (htmlInCanvas) {
    paintable.onpaint = () => {
      try {
        sourceCtx.reset();
        drawHtmlInCanvas(source, sourceCtx, content);
        contentDirty = true;
        wake();
      } catch {
      }
    };
  }
  function compile(type, text) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Ripple shader error:", gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  const vertexShader = compile(gl.VERTEX_SHADER, VERT);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name.replace("[0]", "")] = gl.getUniformLocation(
      program,
      info.name
    );
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const contentTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, contentTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0])
  );
  let contentMaxX = 1;
  function syncCanvasSize() {
    const dpr = getCanvasPixelRatio(output, gl);
    const width = Math.max(1, Math.round(output.clientWidth * dpr));
    const height = Math.max(1, Math.round(output.clientHeight * dpr));
    if (output.width !== width || output.height !== height) {
      output.width = width;
      output.height = height;
    }
    contentMaxX = Math.min(
      1,
      Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1))
    );
    if (htmlInCanvas) {
      const sourceWidth = Math.max(1, Math.round(source.clientWidth * dpr));
      const sourceHeight = Math.max(1, Math.round(source.clientHeight * dpr));
      if (source.width !== sourceWidth || source.height !== sourceHeight) {
        source.width = sourceWidth;
        source.height = sourceHeight;
      }
      paintable.requestPaint();
    }
  }
  syncCanvasSize();
  function uploadContent() {
    if (!htmlInCanvas || !contentDirty) return;
    contentDirty = false;
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    );
  }
  const ripples = [];
  const rippleData = new Float32Array(MAX_RIPPLES * 4);
  function splash(x, y, strength = 1) {
    if (reducedMotion) return;
    if (ripples.length >= MAX_RIPPLES) ripples.shift();
    ripples.push({ x, y, age: 0, amp: strength });
    start();
  }
  function pruneRipples(delta) {
    const diag = Math.hypot(output.clientWidth, output.clientHeight);
    const speedPx = BASE_SPEED * Math.max(config.speed, 0.05);
    const width = config.wavelength * Math.max(config.rings, 1) * 0.5;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.age += delta;
      const gone = rp.age * speedPx > diag + width * 3 || Math.exp(-Math.max(config.decay, 0.05) * rp.age) * rp.amp < 0.012;
      if (gone) ripples.splice(i, 1);
    }
  }
  function render() {
    uploadContent();
    const dpr = output.width / Math.max(output.clientWidth, 1);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.uniform1i(uniforms.uContent, 0);
    gl.uniform2f(uniforms.uResolution, output.width, output.height);
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const rp = ripples[i];
      rippleData[i * 4] = rp ? rp.x * dpr : 0;
      rippleData[i * 4 + 1] = rp ? rp.y * dpr : 0;
      rippleData[i * 4 + 2] = rp ? rp.age : 0;
      rippleData[i * 4 + 3] = rp ? rp.amp * Math.max(config.amplitude, 0) : 0;
    }
    gl.uniform4fv(uniforms.uRipples, rippleData);
    gl.uniform1i(uniforms.uCount, ripples.length);
    gl.uniform1f(uniforms.uSpeed, BASE_SPEED * Math.max(config.speed, 0.05) * dpr);
    gl.uniform1f(uniforms.uWavelength, Math.max(config.wavelength, 4) * dpr);
    gl.uniform1f(
      uniforms.uWidth,
      Math.max(config.wavelength, 4) * Math.max(config.rings, 1) * 0.5 * dpr
    );
    gl.uniform1f(uniforms.uDecay, Math.max(config.decay, 0.05));
    gl.uniform1f(uniforms.uRefraction, Math.max(config.refraction, 0) * dpr);
    gl.uniform1f(uniforms.uDispersion, Math.max(config.dispersion, 0));
    gl.uniform1f(uniforms.uShine, Math.max(config.shine, 0));
    gl.uniform1f(uniforms.uHasContent, htmlInCanvas ? 1 : 0);
    gl.uniform1f(uniforms.uMaxX, contentMaxX);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function renderIdle() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    if (htmlInCanvas) {
      render();
    } else {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }
  let raf = 0;
  let lastTime = performance.now();
  let destroyed = false;
  let running = false;
  let visible = true;
  let ambientTimer = 0;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;
  function spawnAmbient() {
    const w = output.clientWidth;
    const h = output.clientHeight;
    if (w < 10 || h < 10) return;
    splash(
      w * (0.15 + Math.random() * 0.7),
      h * (0.15 + Math.random() * 0.7),
      0.6 + Math.random() * 0.5
    );
  }
  function frame(now) {
    if (destroyed) return;
    if (!visible) {
      running = false;
      return;
    }
    const delta = Math.min(Math.max((now - lastTime) / 1e3, 0), 1 / 30);
    lastTime = now;
    if (!reducedMotion) {
      pruneRipples(delta);
      if (config.interval > 0) {
        ambientTimer += delta;
        if (ambientTimer >= config.interval) {
          ambientTimer = 0;
          spawnAmbient();
        }
      }
    }
    if (ripples.length > 0) {
      render();
    } else {
      renderIdle();
      if (!contentDirty && (config.interval <= 0 || reducedMotion)) {
        running = false;
        return;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (destroyed || running || !visible) return;
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }
  wake = start;
  start();
  function localPoint(event) {
    const rect = output.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }
  let hoverX = -1e5;
  let hoverY = -1e5;
  function onPointerDown(event) {
    if (config.trigger === "none") return;
    const [x, y] = localPoint(event);
    splash(x, y, 1);
  }
  function onPointerMove(event) {
    if (config.trigger !== "hover") return;
    const [x, y] = localPoint(event);
    if (Math.hypot(x - hoverX, y - hoverY) < 56) return;
    hoverX = x;
    hoverY = y;
    splash(x, y, 0.3);
  }
  content.addEventListener("pointerdown", onPointerDown, { passive: true });
  content.addEventListener("pointermove", onPointerMove, { passive: true });
  function onMotionChange() {
    reducedMotion = motionQuery.matches;
    if (reducedMotion) ripples.length = 0;
    start();
  }
  motionQuery.addEventListener("change", onMotionChange);
  const observer = createCanvasResizeObserver(() => {
    syncCanvasSize();
    start();
  });
  observer.observe(output);
  observer.observe(content);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1]?.isIntersecting ?? true;
    if (visible) start();
  });
  intersection.observe(output);
  return {
    setOptions(next) {
      if (!Object.entries(next).some(
        ([key, value]) => config[key] !== value
      ))
        return;
      Object.assign(config, next);
      start();
    },
    splash,
    resize() {
      syncCanvasSize();
      start();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      content.removeEventListener("pointerdown", onPointerDown);
      content.removeEventListener("pointermove", onPointerMove);
      observer.disconnect();
      intersection.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      gl.deleteTexture(contentTexture);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(quad);
      if (htmlInCanvas) paintable.onpaint = null;
    }
  };
}

// ../patched/rect-cache.ts
function createRectCache(element) {
  let current = element.getBoundingClientRect();
  const refresh = () => {
    current = element.getBoundingClientRect();
  };
  const observer = new ResizeObserver(refresh);
  observer.observe(element);
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("scroll", refresh, {
    capture: true,
    passive: true
  });
  return {
    get current() {
      return current;
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    }
  };
}

// ../patched/RetroDither/RetroDitherVanilla.ts
var DEFAULTS2 = {
  radius: 0.5,
  softness: 1,
  pixelSize: 2,
  levels: 4,
  darkColor: [0, 0, 0],
  lightColor: [1, 1, 1],
  colorize: 0.1,
  contrast: 0.6,
  brightness: 0,
  strength: 0.75,
  baseStrength: 0,
  invert: 0,
  scanlines: 0,
  pattern: "bayer",
  trail: 0.4,
  degauss: 0.8,
  followSpeed: 3
};
var PATTERNS = { bayer: 0, halftone: 1, hatch: 2, dash: 3 };
var VERT2 = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
var TRAIL_N = 24;
var RIPPLE_N = 3;
var FRAG2 = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uContent;
uniform vec2 uResolution;
uniform float uPixelSize;
uniform float uLevels;
uniform float uRadius;
uniform float uSoftness;
uniform vec2 uPointer;
uniform float uActive;
uniform vec3 uDark;
uniform vec3 uLight;
uniform float uColorize;
uniform float uContrast;
uniform float uBrightness;
uniform float uStrength;
uniform float uBase;
uniform float uInvert;
uniform float uScanlines;
uniform float uMaxX;
uniform sampler2D uTextMask;
uniform int uPattern;
uniform vec3 uTrail[${TRAIL_N}];
uniform vec4 uRipples[${RIPPLE_N}];

#define S(a, b, t) smoothstep(a, b, t)

float bayer (ivec2 p) {
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(b[(p.y % 4) * 4 + (p.x % 4)]) + 0.5) / 16.0;
}

float patternThreshold (ivec2 cell) {
  if (uPattern == 1) {
    vec2 p = vec2(cell % 4) - 1.5;
    return clamp(length(p) / 2.6, 0.03, 0.97);
  }
  if (uPattern == 2) {
    return fract(float(cell.x + cell.y) * 0.25 + 0.125);
  }
  if (uPattern == 3) {
    return fract(float(cell.x) * 0.25 + float(cell.y % 2) * 0.5 + 0.125);
  }
  return bayer(cell);
}

float ditherQuant (float v, ivec2 cell) {
  float x = v * uLevels;
  return floor(x + step(patternThreshold(cell), fract(x))) / uLevels;
}

void main () {
  vec2 uv = vUv;

  if (uv.x > uMaxX) {
    outColor = vec4(0.0);
    return;
  }

  float aspect = uResolution.x / uResolution.y;

  float rippleReveal = 0.0;
  vec2 rippleWarp = vec2(0.0);
  for (int i = 0; i < ${RIPPLE_N}; i++) {
    float amp = uRipples[i].w;
    if (amp <= 0.001) continue;
    vec2 toUv = (uv - uRipples[i].xy) * vec2(aspect, 1.0);
    float d = length(toUv);
    float band = exp(-pow((d - uRipples[i].z) / 0.07, 2.0)) * amp;
    rippleReveal = max(rippleReveal, band);
    rippleWarp += normalize(toUv + 1e-5) * band * 0.012 / vec2(aspect, 1.0);
  }
  uv = clamp(uv + rippleWarp, vec2(0.0), vec2(uMaxX, 1.0));

  vec4 content = texture(uContent, vec2(uv.x, 1.0 - uv.y));

  vec2 frag = uv * uResolution;
  vec2 cell = floor(frag / uPixelSize);
  vec2 cellUv = (cell + 0.5) * uPixelSize / uResolution;
  cellUv = clamp(cellUv, vec2(0.001), vec2(uMaxX - 0.002, 0.999));
  vec4 pixel = texture(uContent, vec2(cellUv.x, 1.0 - cellUv.y));
  float rawLum = dot(pixel.rgb, vec3(0.299, 0.587, 0.114));

  float textness = texture(uTextMask, vec2(uv.x, 1.0 - uv.y)).r;
  float crisp = 0.0;
  if (textness > 0.4) {
    float px = max(uPixelSize * 0.25, 1.0);
    vec2 fineUv = (floor(frag / px) + 0.5) * px / uResolution;
    fineUv = clamp(fineUv, vec2(0.001), vec2(uMaxX - 0.002, 0.999));
    vec4 fine = texture(uContent, vec2(fineUv.x, 1.0 - fineUv.y));
    float fineLum = dot(fine.rgb, vec3(0.299, 0.587, 0.114));
    if (abs(fineLum - rawLum) > 0.1) {
      crisp = 1.0;
      pixel = fine;
      rawLum = fineLum;
    }
  }

  float contrastAmt = mix(uContrast, max(uContrast, 0.5), crisp);
  float brightAmt = uBrightness * mix(1.0, 0.3, crisp);
  float lum = clamp((rawLum - 0.5) * contrastAmt + 0.5 + brightAmt, 0.0, 1.0);
  lum = mix(lum, 1.0 - lum, clamp(uInvert, 0.0, 1.0));
  float q = crisp > 0.5
    ? clamp(floor(lum * uLevels + 0.5) / uLevels, 0.0, 1.0)
    : ditherQuant(lum, ivec2(cell));

  vec3 palette = mix(uDark, uLight, q);
  vec3 keepHue = pixel.rgb * (q / max(lum, 0.001));
  vec3 dithered = mix(keepHue, palette, clamp(uColorize, 0.0, 1.0));
  float scanAmp = mix(0.45, 0.15, crisp);
  dithered *= 1.0 - uScanlines * scanAmp * mod(cell.y, 2.0);
  dithered *= 1.0 + rippleReveal * vec3(0.22, -0.06, 0.3);

  float dist = length((uv - uPointer) * vec2(aspect, 1.0));
  float radius = max(uRadius * uActive, 1e-4);
  float inner = radius * (1.0 - clamp(uSoftness, 0.0, 1.0));
  float lens = (1.0 - S(inner, radius, dist)) * uActive;

  float ghost = 0.0;
  for (int i = 0; i < ${TRAIL_N}; i++) {
    float amp = uTrail[i].z;
    if (amp <= 0.001) continue;
    float td = length((uv - uTrail[i].xy) * vec2(aspect, 1.0));
    float tr = max(uRadius * 0.8, 1e-4);
    ghost = max(ghost, (1.0 - S(tr * 0.2, tr, td)) * amp);
  }

  float mask = clamp(max(max(lens, ghost), clamp(uBase, 0.0, 1.0)), 0.0, 1.0)
    * clamp(uStrength, 0.0, 1.0);
  mask = clamp(max(mask, rippleReveal), 0.0, 1.0);

  float apply = step(bayer(ivec2(cell)), mask);

  vec3 col = mix(content.rgb, dithered, apply);
  float alpha = mix(content.a, pixel.a, apply);
  outColor = vec4(col, alpha);
}`;
function createRetroDither(elements, options = {}) {
  const config = { ...DEFAULTS2, ...options };
  const { source, content, output } = elements;
  const gl = output.getContext("webgl2", {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false
  });
  if (!gl || gl.isContextLost()) return null;
  const sourceCtx = source.getContext("2d");
  const paintable = source;
  const htmlInCanvas = Boolean(
    sourceCtx && typeof sourceCtx.drawElementImage === "function" && typeof paintable.requestPaint === "function"
  );
  if (htmlInCanvas) prepareHtmlInCanvas(source, content);
  let contentDirty = false;
  let wake = () => {
  };
  const liveSource = options.liveSource;
  if (liveSource) {
    const pump = () => {
      if (destroyed) return;
      contentDirty = true;
      wake();
      setTimeout(pump, 110);
    };
    setTimeout(pump, 0);
  }
  if (htmlInCanvas) {
    paintable.onpaint = () => {
      try {
        sourceCtx.reset();
        drawHtmlInCanvas(source, sourceCtx, content);
        contentDirty = true;
        scheduleTextMask();
        wake();
      } catch {
      }
    };
  }
  function compile(type, text) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("RetroDither shader error:", gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  const vertexShader = compile(gl.VERTEX_SHADER, VERT2);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG2);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const contentTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, contentTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0])
  );
  const textMaskTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textMaskTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0])
  );
  const MASK_SCALE = 0.25;
  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d");
  let maskDirty = false;
  let maskTimer = 0;
  let maskStamp = 0;
  function buildTextMask() {
    if (!maskCtx) return;
    const bounds = output.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width * MASK_SCALE));
    const height = Math.max(1, Math.round(bounds.height * MASK_SCALE));
    if (maskCanvas.width !== width || maskCanvas.height !== height) {
      maskCanvas.width = width;
      maskCanvas.height = height;
    }
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.fillStyle = "#fff";
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node;
    while (node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const parent = node.parentElement;
      if (!parent || parent.checkVisibility && !parent.checkVisibility()) {
        continue;
      }
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (r.width < 1 || r.height < 1) continue;
        if (r.bottom < bounds.top || r.top > bounds.bottom) continue;
        maskCtx.fillRect(
          (r.left - bounds.left - 1) * MASK_SCALE,
          (r.top - bounds.top - 1) * MASK_SCALE,
          (r.width + 2) * MASK_SCALE,
          (r.height + 2) * MASK_SCALE
        );
      }
    }
    const fields = content.querySelectorAll("input, textarea, select");
    for (let i = 0; i < fields.length; i++) {
      const r = fields[i].getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.bottom < bounds.top || r.top > bounds.bottom) continue;
      maskCtx.fillRect(
        (r.left - bounds.left) * MASK_SCALE,
        (r.top - bounds.top) * MASK_SCALE,
        r.width * MASK_SCALE,
        r.height * MASK_SCALE
      );
    }
    maskDirty = true;
  }
  function scheduleTextMask() {
    if (maskTimer) return;
    const wait = Math.max(0, 120 - (performance.now() - maskStamp));
    maskTimer = window.setTimeout(() => {
      maskTimer = 0;
      maskStamp = performance.now();
      buildTextMask();
      start();
    }, wait);
  }
  let contentMaxX = 1;
  function syncCanvasSize() {
    const dpr = getCanvasPixelRatio(output, gl);
    const width = Math.max(1, Math.round(output.clientWidth * dpr));
    const height = Math.max(1, Math.round(output.clientHeight * dpr));
    if (output.width !== width || output.height !== height) {
      output.width = width;
      output.height = height;
    }
    contentMaxX = Math.min(
      1,
      Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1))
    );
    if (htmlInCanvas) {
      const sourceWidth = Math.max(1, Math.round(source.clientWidth * dpr));
      const sourceHeight = Math.max(1, Math.round(source.clientHeight * dpr));
      if (source.width !== sourceWidth || source.height !== sourceHeight) {
        source.width = sourceWidth;
        source.height = sourceHeight;
      }
      paintable.requestPaint();
    }
  }
  syncCanvasSize();
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, target: 0 };
  const trailData = new Float32Array(TRAIL_N * 3);
  const trailPts = [];
  const rippleData = new Float32Array(RIPPLE_N * 4);
  const ripples = [];
  let fxAlive = false;
  function updateEffects(nowS) {
    fxAlive = false;
    if (config.trail > 1e-3 && pointer.active > 0.1 && !reducedMotion) {
      const last = trailPts[trailPts.length - 1];
      if (!last || nowS - last.t >= 0.04) {
        trailPts.push({ x: pointer.x, y: pointer.y, t: nowS });
        if (trailPts.length > TRAIL_N) trailPts.shift();
      }
    }
    trailData.fill(0);
    for (let i = trailPts.length - 1; i >= 0; i--) {
      const p = trailPts[i];
      const age = nowS - p.t;
      const fade = Math.min(Math.max((0.95 - age) / 0.25, 0), 1);
      const s = config.trail * Math.exp(-age * 2.2) * fade;
      if (s < 5e-3) {
        trailPts.splice(0, i + 1);
        break;
      }
      trailData[i * 3] = p.x;
      trailData[i * 3 + 1] = p.y;
      trailData[i * 3 + 2] = s;
      fxAlive = true;
    }
    rippleData.fill(0);
    for (let i = ripples.length - 1; i >= 0; i--) {
      if (nowS - ripples[i].t > 0.9) ripples.splice(i, 1);
    }
    for (let i = 0; i < ripples.length && i < RIPPLE_N; i++) {
      const age = nowS - ripples[i].t;
      rippleData[i * 4] = ripples[i].x;
      rippleData[i * 4 + 1] = ripples[i].y;
      rippleData[i * 4 + 2] = age * 1.2;
      rippleData[i * 4 + 3] = config.degauss * (1 - age / 0.9);
      fxAlive = true;
    }
  }
  function uploadContent() {
    if (!htmlInCanvas && !liveSource || !contentDirty) return;
    contentDirty = false;
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    if (liveSource) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      liveSource || source
    );
  }
  function uploadMask() {
    if (!maskDirty) return;
    maskDirty = false;
    gl.bindTexture(gl.TEXTURE_2D, textMaskTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      maskCanvas
    );
  }
  function render() {
    uploadContent();
    uploadMask();
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.uniform1i(uniforms.uContent, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textMaskTexture);
    gl.uniform1i(uniforms.uTextMask, 1);
    gl.uniform2f(uniforms.uResolution, output.width, output.height);
    const dpr = output.width / Math.max(output.clientWidth, 1);
    gl.uniform1f(uniforms.uPixelSize, Math.max(config.pixelSize, 1) * dpr);
    gl.uniform1f(uniforms.uLevels, Math.max(config.levels, 1));
    gl.uniform1f(uniforms.uRadius, Math.max(config.radius, 0.01));
    gl.uniform1f(uniforms.uSoftness, config.softness);
    gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
    gl.uniform1f(uniforms.uActive, pointer.active);
    gl.uniform3f(
      uniforms.uDark,
      config.darkColor[0],
      config.darkColor[1],
      config.darkColor[2]
    );
    gl.uniform3f(
      uniforms.uLight,
      config.lightColor[0],
      config.lightColor[1],
      config.lightColor[2]
    );
    gl.uniform1f(uniforms.uColorize, config.colorize);
    gl.uniform1f(uniforms.uContrast, Math.max(config.contrast, 0));
    gl.uniform1f(uniforms.uBrightness, config.brightness);
    gl.uniform1f(uniforms.uStrength, config.strength);
    gl.uniform1f(uniforms.uBase, config.baseStrength);
    gl.uniform1f(uniforms.uInvert, config.invert);
    gl.uniform1f(uniforms.uScanlines, config.scanlines);
    gl.uniform1i(uniforms.uPattern, PATTERNS[config.pattern] ?? 0);
    gl.uniform3fv(uniforms["uTrail[0]"], trailData);
    gl.uniform4fv(uniforms["uRipples[0]"], rippleData);
    gl.uniform1f(uniforms.uMaxX, contentMaxX);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  let raf = 0;
  let lastTime = performance.now();
  let destroyed = false;
  let running = false;
  let visible = true;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;
  function frame(now) {
    if (destroyed) return;
    if (!visible) {
      running = false;
      return;
    }
    const delta = Math.min((now - lastTime) / 1e3, 1 / 30);
    lastTime = now;
    const ease = reducedMotion ? 1 : 1 - Math.exp(-delta * Math.max(config.followSpeed, 0.5));
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;
    pointer.active += (pointer.target - pointer.active) * ease;
    updateEffects(now / 1e3);
    render();
    const settled = Math.abs(pointer.tx - pointer.x) < 5e-4 && Math.abs(pointer.ty - pointer.y) < 5e-4 && Math.abs(pointer.target - pointer.active) < 1e-3 && !fxAlive;
    if (settled && !contentDirty) {
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
      pointer.active = pointer.target;
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (destroyed || running || !visible) return;
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }
  wake = start;
  start();
  function onMotionChange() {
    reducedMotion = motionQuery.matches;
    start();
  }
  motionQuery.addEventListener("change", onMotionChange);
  const observer = createCanvasResizeObserver(() => {
    syncCanvasSize();
    scheduleTextMask();
    start();
  });
  observer.observe(output);
  observer.observe(content);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1]?.isIntersecting ?? true;
    if (visible) start();
  });
  intersection.observe(output);
  const listenTarget = output.parentElement ?? output;
  const rectCache = createRectCache(output);
  function onPointerMove(event) {
    const rect = rectCache.current;
    pointer.tx = (event.clientX - rect.left) / Math.max(rect.width, 1);
    pointer.ty = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
    pointer.target = 1;
    start();
  }
  function onPointerLeave() {
    pointer.target = 0;
    start();
  }
  function onPointerDown(event) {
    if (reducedMotion || config.degauss <= 1e-3) return;
    const rect = rectCache.current;
    ripples.push({
      x: (event.clientX - rect.left) / Math.max(rect.width, 1),
      y: 1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
      t: performance.now() / 1e3
    });
    if (ripples.length > RIPPLE_N) ripples.shift();
    start();
  }
  listenTarget.addEventListener("pointermove", onPointerMove, { passive: true });
  listenTarget.addEventListener("pointerleave", onPointerLeave, { passive: true });
  listenTarget.addEventListener("pointerdown", onPointerDown, { passive: true });
  content.addEventListener("scroll", scheduleTextMask, {
    capture: true,
    passive: true
  });
  scheduleTextMask();
  return {
    setOptions(next) {
      let changed = false;
      for (const [key, value] of Object.entries(next)) {
        const prev = config[key];
        if (Array.isArray(value) && Array.isArray(prev)) {
          if (value.length !== prev.length || value.some((item, i) => item !== prev[i])) {
            changed = true;
            break;
          }
        } else if (prev !== value) {
          changed = true;
          break;
        }
      }
      Object.assign(config, next);
      if (!changed) return;
      scheduleTextMask();
      start();
    },
    resize() {
      syncCanvasSize();
      start();
    },
    destroy() {
      destroyed = true;
      rectCache.destroy();
      cancelAnimationFrame(raf);
      window.clearTimeout(maskTimer);
      observer.disconnect();
      intersection.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      listenTarget.removeEventListener("pointermove", onPointerMove);
      listenTarget.removeEventListener("pointerleave", onPointerLeave);
      listenTarget.removeEventListener("pointerdown", onPointerDown);
      content.removeEventListener("scroll", scheduleTextMask, {
        capture: true
      });
      gl.deleteTexture(contentTexture);
      gl.deleteTexture(textMaskTexture);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(quad);
      if (htmlInCanvas) paintable.onpaint = null;
    }
  };
}

// ../patched/Glitch/GlitchVanilla.ts
var DEFAULTS3 = {
  intensity: 1,
  interval: 3,
  duration: 0.4,
  slices: 24,
  shift: 30,
  rgbShift: 4,
  blocks: 0.5,
  noise: 0.35
};
var VERT3 = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
var FRAG3 = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uContent;
uniform vec2 uResolution;
uniform float uSeed;
uniform float uAmp;
uniform float uSlices;
uniform float uShift;
uniform float uRgbShift;
uniform float uBlocks;
uniform float uNoise;
uniform float uMaxX;

float hash12 (vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec4 page (vec2 p) {
  p.x = clamp(p.x, 0.0005, uMaxX - 0.0005);
  p.y = clamp(p.y, 0.0005, 0.9995);
  return texture(uContent, vec2(p.x, 1.0 - p.y));
}

void main () {
  vec2 uv = vUv;
  if (uv.x > uMaxX) {
    outColor = vec4(0.0);
    return;
  }

  float e = uAmp;
  vec2 guv = uv;

  if (e > 0.001) {
    float band = floor(uv.y * uSlices);
    float pick = hash12(vec2(band, uSeed));
    float tear = step(1.0 - 0.3 * min(e, 1.0), pick);
    float dir = hash12(vec2(band, uSeed + 13.0)) * 2.0 - 1.0;
    guv.x += tear * dir * e * uShift / uResolution.x;

    float sub = floor(uv.y * uSlices * 7.0);
    float micro = hash12(vec2(sub, uSeed + 29.0));
    guv.x += (micro - 0.5) * e * uNoise * 3.0 / uResolution.x;

    vec2 cell = floor(guv * vec2(10.0, uSlices * 0.5));
    float br = hash12(cell + uSeed * 0.0173);
    if (br > 1.0 - 0.14 * uBlocks * min(e, 1.0)) {
      vec2 jump = vec2(
        hash12(cell + uSeed + 3.1) - 0.5,
        hash12(cell + uSeed + 7.7) - 0.5
      );
      guv += jump * vec2(0.08, 0.02) * e;
    }
  }

  float split = uRgbShift * e / uResolution.x;
  vec4 c = page(guv);
  float r = page(guv + vec2(split, 0.0)).r;
  float b = page(guv - vec2(split, 0.0)).b;
  vec4 col = vec4(r, c.g, b, c.a);

  if (e > 0.001 && uNoise > 0.001) {
    float grain = hash12(vUv * uResolution + uSeed * 5.3) - 0.5;
    float row = floor(vUv.y * uResolution.y);
    float flicker = hash12(vec2(row, uSeed + 41.0));
    float lines = step(0.985 - 0.01 * uNoise * e, flicker);
    col.rgb += (grain * 0.22 + lines * 0.35) * uNoise * min(e, 1.0) * col.a;
  }

  outColor = vec4(clamp(col.rgb, 0.0, 1.0) * col.a, col.a);
}`;
function createGlitch(elements, options = {}) {
  const config = { ...DEFAULTS3, ...options };
  const { source, content, output } = elements;
  const gl = output.getContext("webgl2", {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: true
  });
  if (!gl || gl.isContextLost()) return null;
  const sourceCtx = source.getContext("2d");
  const paintable = source;
  const htmlInCanvas = Boolean(
    sourceCtx && typeof sourceCtx.drawElementImage === "function" && typeof paintable.requestPaint === "function"
  );
  if (htmlInCanvas) prepareHtmlInCanvas(source, content);
  let contentDirty = false;
  let wake = () => {
  };
  const liveSource = options.liveSource;
  if (liveSource) {
    const pump = () => {
      if (destroyed) return;
      contentDirty = true;
      wake();
      setTimeout(pump, 110);
    };
    setTimeout(pump, 0);
  }
  if (htmlInCanvas) {
    paintable.onpaint = () => {
      try {
        sourceCtx.reset();
        drawHtmlInCanvas(source, sourceCtx, content);
        contentDirty = true;
        wake();
      } catch {
      }
    };
  }
  function compile(type, text) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Glitch shader error:", gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  const vertexShader = compile(gl.VERTEX_SHADER, VERT3);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG3);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const contentTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, contentTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0])
  );
  let contentMaxX = 1;
  function syncCanvasSize() {
    const dpr = getCanvasPixelRatio(output, gl);
    const width = Math.max(1, Math.round(output.clientWidth * dpr));
    const height = Math.max(1, Math.round(output.clientHeight * dpr));
    if (output.width !== width || output.height !== height) {
      output.width = width;
      output.height = height;
    }
    contentMaxX = Math.min(
      1,
      Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1))
    );
    if (htmlInCanvas) {
      const sourceWidth = Math.max(1, Math.round(source.clientWidth * dpr));
      const sourceHeight = Math.max(1, Math.round(source.clientHeight * dpr));
      if (source.width !== sourceWidth || source.height !== sourceHeight) {
        source.width = sourceWidth;
        source.height = sourceHeight;
      }
      paintable.requestPaint();
    }
  }
  syncCanvasSize();
  function uploadContent() {
    if (!htmlInCanvas && !liveSource || !contentDirty) return;
    contentDirty = false;
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    if (liveSource) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      liveSource || source
    );
  }
  let time = 0;
  let burstAt = 0.6;
  let burstSeed = 1;
  let envelope = 0;
  function advanceTimeline(delta) {
    time += delta;
    if (config.interval <= 0) {
      envelope = 1;
      return;
    }
    const sinceBurst = time - burstAt;
    const duration = Math.max(config.duration, 0.05);
    if (sinceBurst >= 0 && sinceBurst < duration) {
      const tail = 1 - Math.pow(sinceBurst / duration, 2);
      envelope = tail * (0.7 + 0.3 * hash(burstSeed + Math.floor(time * 24)));
    } else {
      envelope = 0;
      if (sinceBurst >= duration) {
        burstAt = time + Math.max(config.interval, 0.3) * (0.75 + 0.5 * Math.random());
        burstSeed = Math.floor(Math.random() * 1e3);
      }
    }
  }
  function hash(n) {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }
  function render() {
    uploadContent();
    const dpr = output.width / Math.max(output.clientWidth, 1);
    const amp = envelope * Math.max(config.intensity, 0);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.uniform1i(uniforms.uContent, 0);
    gl.uniform2f(uniforms.uResolution, output.width, output.height);
    gl.uniform1f(uniforms.uSeed, Math.floor(time * 24) + burstSeed);
    gl.uniform1f(uniforms.uAmp, amp);
    gl.uniform1f(uniforms.uSlices, Math.max(config.slices, 3));
    gl.uniform1f(uniforms.uShift, Math.max(config.shift, 0) * dpr);
    gl.uniform1f(uniforms.uRgbShift, Math.max(config.rgbShift, 0) * dpr);
    gl.uniform1f(uniforms.uBlocks, Math.min(Math.max(config.blocks, 0), 1));
    gl.uniform1f(uniforms.uNoise, Math.min(Math.max(config.noise, 0), 1));
    gl.uniform1f(uniforms.uMaxX, contentMaxX);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  let raf = 0;
  let lastTime = performance.now();
  let destroyed = false;
  let running = false;
  let visible = true;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;
  function frame(now) {
    if (destroyed) return;
    if (!visible) {
      running = false;
      return;
    }
    const delta = Math.min(Math.max((now - lastTime) / 1e3, 0), 1 / 30);
    lastTime = now;
    const wasActive = envelope > 0;
    if (!reducedMotion) advanceTimeline(delta);
    else envelope = 0;
    if (envelope > 0 || wasActive || contentDirty) render();
    if (reducedMotion && !contentDirty) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (destroyed || running || !visible) return;
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }
  wake = start;
  start();
  function onMotionChange() {
    reducedMotion = motionQuery.matches;
    start();
  }
  motionQuery.addEventListener("change", onMotionChange);
  const observer = createCanvasResizeObserver(() => {
    syncCanvasSize();
    start();
  });
  observer.observe(output);
  observer.observe(content);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1]?.isIntersecting ?? true;
    if (visible) start();
  });
  intersection.observe(output);
  return {
    setOptions(next) {
      if (!Object.entries(next).some(
        ([key, value]) => config[key] !== value
      ))
        return;
      Object.assign(config, next);
      start();
    },
    burst() {
      burstAt = time;
      burstSeed = Math.floor(Math.random() * 1e3);
      start();
    },
    resize() {
      syncCanvasSize();
      start();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      gl.deleteTexture(contentTexture);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(quad);
      if (htmlInCanvas) paintable.onpaint = null;
    }
  };
}
export {
  createGlitch,
  createRetroDither,
  createRipple
};
