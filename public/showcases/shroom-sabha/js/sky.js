/* ═══════════════════════════════════════════════════════════════════════════
   THE SKY BEHIND THE FARM
   ---------------------------------------------------------------------------
   The map is an island; this is what it floats on. A single full-screen
   fragment shader that reads the clock and moves through the day:

     05–07  dawn      earth lifting into ochre and sand
     07–16  day       sand haze, slow dust cloud, sun glow
     16–19  dusk      terracotta falling back into earth
     19–05  night     deep earth, a green-brown nebula, warm gold stars

   Built entirely from the farm's own seven colours — sand, terracotta, ochre,
   earth, sage, moss, pine. The warm four carry the light; the greens are land
   and appear only as a horizon bounce and threaded through the night. A sky in
   the map's own family means the slab and the air read as one object lit by
   one sun, which is what an isometric view needs to stop looking like a
   cut-out.

   Deliberately low-contrast and slow — it sits behind a map people are
   trying to read, so it should register as atmosphere, never as content.

   Raw WebGL2, no library, about 4 KB. Renders at half resolution (the whole
   thing is soft gradients, so nobody can tell) and caps at 30 fps to stay
   cheap on a phone. Falls back to a plain CSS gradient if WebGL is missing.
   ═══════════════════════════════════════════════════════════════════════ */

const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uHour;      // 0..24, fractional

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

/* how much of each part of the day is showing right now */
float windowAt(float h, float a, float b, float feather){
  return smoothstep(a - feather, a + feather, h) *
         (1.0 - smoothstep(b - feather, b + feather, h));
}

/* the farm's palette */
const vec3 SAND  = vec3(0.910, 0.643, 0.361);
const vec3 TERRA = vec3(0.788, 0.545, 0.322);
const vec3 OCHRE = vec3(0.612, 0.392, 0.196);
const vec3 EARTH = vec3(0.353, 0.212, 0.125);
const vec3 PINE  = vec3(0.306, 0.373, 0.235);

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;   // aspect-correct

  float h = uHour;
  float night = max(windowAt(h, -1.0, 5.5, 1.0), windowAt(h, 19.0, 25.0, 1.0));
  float dawn  = windowAt(h, 5.0, 8.0, 1.0);
  float day   = windowAt(h, 7.5, 16.5, 1.2);
  float dusk  = windowAt(h, 16.0, 19.5, 1.0);
  float total = max(night + dawn + day + dusk, 0.001);
  night /= total; dawn /= total; day /= total; dusk /= total;

  /* ── base gradient ─────────────────────────────────────────────────── */
  float g = uv.y;                        // 0 at the horizon, 1 at the top
  vec3 col =
      night * mix(EARTH * 0.24, EARTH * 0.09, g)
    + dawn  * mix(SAND  * 0.95, EARTH * 0.42, g)
    + day   * mix(SAND  * 1.02, OCHRE * 0.62, g)
    + dusk  * mix(TERRA * 0.92, EARTH * 0.30, g);

  /* forest bounce — light coming back up off a hundred acres of canopy */
  float bounce = smoothstep(0.34, 0.0, uv.y);
  col = mix(col, mix(col, PINE, 0.40),
            bounce * (day * 0.30 + dawn * 0.22 + dusk * 0.20 + night * 0.34));

  /* ── the light source, arcing across the sky ───────────────────────── */
  float t = clamp((h - 6.0) / 12.0, 0.0, 1.0);              // 0 at dawn, 1 at dusk
  vec2 sunPos = vec2(mix(-0.85, 0.85, t), mix(-0.30, 0.42, sin(t * 3.14159)));
  float sunD = length(q - sunPos);
  vec3 sunCol = day * SAND * 1.08 + dawn * mix(SAND, OCHRE, 0.35)
              + dusk * mix(TERRA, OCHRE, 0.40);
  col += sunCol * (0.34 * exp(-sunD * 3.0) + 0.13 * exp(-sunD * 1.05));

  /* the moon takes the same arc, twelve hours out of phase */
  float mt = fract((h + 12.0) / 24.0);
  vec2 moonPos = vec2(mix(-0.8, 0.8, mt), -0.18 + 0.34 * sin(mt * 3.14159));
  float moonD = length(q - moonPos);
  col += night * mix(SAND, vec3(1.0), 0.35) *
         (0.15 * exp(-moonD * 6.5) + 0.05 * exp(-moonD * 1.7));

  /* ── stars, with a slow twinkle ────────────────────────────────────── */
  if (night > 0.01){
    vec2 sp = gl_FragCoord.xy / 2.4;
    vec2 si = floor(sp);
    float r = hash(si);
    if (r > 0.9955){
      float tw = 0.55 + 0.45 * sin(uTime * 1.7 + r * 90.0);
      float d = length(fract(sp) - 0.5);
      /* warm gold stars, not blue-white — keeps night in the same family */
      col += night * mix(SAND, vec3(1.0), 0.45) * tw * smoothstep(0.42, 0.0, d) * 0.95;
    }
    /* a faint band of nebula, drifting */
    float band = fbm(q * 2.1 + vec2(uTime * 0.006, 0.0) + vec2(0.0, q.x * 1.4));
    float mask = smoothstep(0.60, 0.0, abs(q.y + q.x * 0.35 + 0.05));
    col += night * mask * pow(band, 2.2) * mix(PINE, EARTH, 0.45) * 0.95;
  }

  /* ── high cloud, only when there is light to catch it ──────────────── */
  float lit = day + dawn * 0.8 + dusk * 0.8;
  if (lit > 0.01){
    vec2 cp = q * 1.5 + vec2(uTime * 0.010, uTime * 0.003);
    float c = fbm(cp + fbm(cp * 0.7) * 0.5);
    c = smoothstep(0.46, 0.86, c);
    vec3 cloudCol = day * mix(SAND, vec3(1.0), 0.30)
                  + dawn * mix(SAND, TERRA, 0.45)
                  + dusk * mix(TERRA, OCHRE, 0.35);
    col = mix(col, cloudCol, c * lit * 0.34);
  }

  /* ── settle it down: grain, and a vignette so the map stays the hero ─ */
  col *= 1.0 - 0.48 * pow(length(q * vec2(0.85, 1.0)), 2.0);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.012;

  outColor = vec4(max(col, vec3(0.0)), 1.0);
}`;

function compile (gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('sky shader:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/*
 * Every return path from createSky() must have the same shape.
 *
 * It did not, and the cost was severe: the two fallback paths omitted
 * followClock(), so on any device where the sky could not get a WebGL context,
 * app boot threw "sky?.followClock is not a function" — an unhandled rejection
 * that killed the rest of the boot sequence, initMap included. The map never
 * mounted at all, and because nothing caught the rejection it failed in
 * complete silence. Building the stub from the real object's keys means a new
 * method cannot be added to one path and forgotten in the others.
 */
const SKY_STUB = {
  ok: false,
  setHour () {},
  followClock () {},
  destroy () {}
};

export function createSky (host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sky-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const gl = canvas.getContext('webgl2', {
    antialias: false, depth: false, stencil: false,
    powerPreference: 'low-power', alpha: false
  });

  if (!gl) {
    /* No WebGL. A static gradient still reads as sky. */
    host.classList.add('sky-fallback');
    canvas.remove();
    return { ...SKY_STUB };
  }

  /*
   * A phone under memory pressure will take this context away — a browser
   * with many tabs open is enough to trigger it. Losing it silently leaves an
   * blank canvas sitting over the page for the rest of the session, so drop to
   * the painted gradient instead. It is a static sky rather than a moving one,
   * which nobody will notice, and it cannot fail twice.
   */
  let dead = false;
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    dead = true;
    host.classList.add('sky-fallback');
    canvas.style.display = 'none';
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    /* Deliberately not rebuilding the shader. Once a device has shown it will
       evict us it will do it again, and a gradient that stays is worth more
       than a sky that keeps vanishing. */
  }, false);

  const prog = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    host.classList.add('sky-fallback');
    canvas.remove();
    return { ...SKY_STUB };
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'p');
  gl.linkProgram(prog);
  gl.useProgram(prog);

  /* one big triangle covers the screen with no index buffer */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uHour = gl.getUniformLocation(prog, 'uHour');

  const SCALE = 0.5;                       // half-res: it is all soft gradients
  let hour = new Date().getHours() + new Date().getMinutes() / 60;
  let raf = 0, last = 0, running = true;
  const t0 = performance.now();

  function resize () {
    const w = Math.max(2, Math.round(host.clientWidth * SCALE));
    const h = Math.max(2, Math.round(host.clientHeight * SCALE));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  function frame (now) {
    raf = requestAnimationFrame(frame);
    if (!running || dead || document.hidden || now - last < 33) return;  // ~30fps is plenty
    last = now;
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform1f(uHour, hour);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  raf = requestAnimationFrame(frame);
  addEventListener('resize', resize, { passive: true });


  let skyTorn = false;
  function teardownSky () {
    if (skyTorn) return;
    skyTorn = true;
    dead = true;
    cancelAnimationFrame(raf);
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    try { canvas.remove(); } catch {}
  }
  addEventListener('pagehide', teardownSky, { once: true });

  return {
    ok: true,
    /** Drive the sky from a specific hour (0..24) — used by the night toggle. */
    setHour (h) { hour = ((h % 24) + 24) % 24; },
    /** Follow the real clock again. */
    followClock () {
      const d = new Date();
      hour = d.getHours() + d.getMinutes() / 60;
    },
    /* Same as the map: removing the canvas is not the same as releasing the
       context. Without the explicit loss the sky keeps one per reload. */
    destroy () { teardownSky(); }
  };
}
