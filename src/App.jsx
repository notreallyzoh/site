import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as Tone from 'tone';
import { PERSONAL, TECH_STACK, EXPERIENCES, CATEGORIES, PROJECTS, SOCIALS } from './data';
import './App.css';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════
   AUDIO ENGINE — ambient synth via Tone.js
   ═══════════════════════════════════════════════ */
const AudioCtx = createContext();
let audioInitialized = false;
let synth, filter, reverb, bellSynth;

function initAudio() {
  if (audioInitialized) return;
  audioInitialized = true;

  reverb = new Tone.Reverb({ decay: 6, wet: 0.5 }).toDestination();
  filter = new Tone.Filter({ frequency: 400, type: 'lowpass', rolloff: -24 }).connect(reverb);

  synth = new Tone.PolySynth(Tone.FMSynth, {
    volume: -22,
    harmonicity: 2,
    modulationIndex: 1.5,
    envelope: { attack: 2, decay: 3, sustain: 0.8, release: 4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 1, decay: 2, sustain: 0.5, release: 3 },
  }).connect(filter);

  bellSynth = new Tone.PolySynth(Tone.AMSynth, {
    volume: -18,
    harmonicity: 3,
    envelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 1.2 },
  }).connect(reverb);

  // Play ambient pad chord
  synth.triggerAttack(['C3', 'E3', 'G3', 'B3']);
}

function setFilterFreq(val) {
  if (filter) filter.frequency.rampTo(val, 0.3);
}
function setReverbWet(val) {
  if (reverb) reverb.wet.rampTo(val, 0.5);
}
function playBell(note) {
  if (bellSynth) bellSynth.triggerAttackRelease(note, '8n');
}

const BELL_NOTES = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6'];

function AudioProvider({ children }) {
  const [muted, setMuted] = useState(true); // start muted, user opts in
  const [started, setStarted] = useState(false);

  const toggleMute = useCallback(async () => {
    if (!started) {
      await Tone.start();
      initAudio();
      setStarted(true);
      setMuted(false);
      Tone.getDestination().volume.value = 0;
    } else {
      setMuted(m => {
        const next = !m;
        Tone.getDestination().volume.value = next ? -Infinity : 0;
        return next;
      });
    }
  }, [started]);

  // M key shortcut
  useEffect(() => {
    const onKey = e => { if (e.key === 'm' || e.key === 'M') toggleMute(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMute]);

  return (
    <AudioCtx.Provider value={{ muted, started, toggleMute, setFilterFreq, setReverbWet, playBell }}>
      {children}
    </AudioCtx.Provider>
  );
}
const useAudio = () => useContext(AudioCtx);

/* ═══════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════ */
const ThemeCtx = createContext();
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('zoh-theme') || 'classy');
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('zoh-theme', theme); }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === 'classy' ? 'bold' : 'classy'), []);
  return <ThemeCtx.Provider value={{ theme, toggle, isClassy: theme === 'classy' }}>{children}</ThemeCtx.Provider>;
}
const useTheme = () => useContext(ThemeCtx);

/* ═══════════════════════════════════════════════
   CURSOR TRAIL
   ═══════════════════════════════════════════════ */
function CursorTrail() {
  const dotRef = useRef();
  const ringRef = useRef();

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const pos = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      gsap.to(dot, { x: mouse.x, y: mouse.y, duration: 0.1, ease: 'power2.out' });
    };

    const tick = () => {
      pos.x += (mouse.x - pos.x) * 0.12;
      pos.y += (mouse.y - pos.y) * 0.12;
      gsap.set(ring, { x: pos.x, y: pos.y });
      requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    tick();

    // Scale ring on hover over links/buttons
    const grow = () => gsap.to(ring, { scale: 1.8, opacity: 0.3, duration: 0.3 });
    const shrink = () => gsap.to(ring, { scale: 1, opacity: 0.5, duration: 0.3 });
    document.querySelectorAll('a, button, .work__card').forEach(el => {
      el.addEventListener('mouseenter', grow);
      el.addEventListener('mouseleave', shrink);
    });

    return () => {
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}

/* ═══════════════════════════════════════════════
   GSAP HELPERS
   ═══════════════════════════════════════════════ */
function glitchReveal(el) {
  const orig = el.textContent;
  const chars = '@#$%&!?<>░▒▓█▄▀';
  return gsap.to(el, {
    duration: 1.2,
    onUpdate() {
      const p = this.progress();
      const rev = Math.floor(p * orig.length);
      let t = '';
      for (let i = 0; i < orig.length; i++) {
        if (i < rev) t += orig[i];
        else if (orig[i] === ' ') t += ' ';
        else t += chars[Math.floor(Math.random() * chars.length)];
      }
      el.textContent = t;
    },
  });
}

/* ═══════════════════════════════════════════════
   IMMERSIVE PARTICLE CANVAS
   Mystical breathing particles — gentle orbit by default,
   disturbed and expressive on interaction.
   Modulates Tone.js ambient synth in real time.
   ═══════════════════════════════════════════════ */
function useImmersiveCanvas(canvasRef, audioRef) {
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let raf;
    const dpr = window.devicePixelRatio || 1;
    const mouse = { x: -999, y: -999, down: false };
    const COLORS = [
      { r: 155, g: 109, b: 255 }, // purple
      { r: 200, g: 255, b: 0 },   // lime
      { r: 0, g: 229, b: 204 },   // cyan
      { r: 112, g: 64, b: 212 },  // deep purple
      { r: 255, g: 109, b: 255 }, // pink
      { r: 80, g: 200, b: 255 },  // sky
    ];

    function resize() {
      cv.width = cv.offsetWidth * dpr;
      cv.height = cv.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const W = () => cv.offsetWidth;
    const H = () => cv.offsetHeight;
    const CX = () => W() / 2;
    const CY = () => H() * 0.38; // center on logo area

    const bRect = () => cv.getBoundingClientRect();
    const onMove = e => { const r = bRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    const onDown = e => { mouse.down = true; createBurst(e); };
    const onUp = () => { mouse.down = false; };
    const onLeave = () => { mouse.x = -999; mouse.y = -999; mouse.down = false; };
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mousedown', onDown);
    cv.addEventListener('mouseup', onUp);
    cv.addEventListener('mouseleave', onLeave);
    cv.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; const r = bRect(); mouse.x = t.clientX - r.left; mouse.y = t.clientY - r.top; mouse.down = true; createBurst({ clientX: t.clientX, clientY: t.clientY }); }, { passive: false });
    cv.addEventListener('touchmove', e => { const t = e.touches[0]; const r = bRect(); mouse.x = t.clientX - r.left; mouse.y = t.clientY - r.top; }, { passive: true });
    cv.addEventListener('touchend', () => { mouse.down = false; mouse.x = -999; mouse.y = -999; });

    // Particles — gentle orbital breathing
    const N = 80;
    const ps = [];
    let t = 0;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + Math.random() * 0.3;
      const orbit = 40 + Math.random() * 120;
      const col = COLORS[i % COLORS.length];
      ps.push({
        x: CX() + Math.cos(angle) * orbit,
        y: CY() + Math.sin(angle) * orbit,
        vx: 0, vy: 0,
        orbit, angle,
        speed: 0.001 + Math.random() * 0.004, // slow = mystical
        r: 1.5 + Math.random() * 3,
        col,
        baseAlpha: 0.15 + Math.random() * 0.35,
        breathPhase: Math.random() * Math.PI * 2,
        breathSpeed: 0.008 + Math.random() * 0.012,
      });
    }

    // Burst on click — also triggers bell note
    function createBurst(e) {
      const r = bRect();
      const bx = e.clientX - r.left, by = e.clientY - r.top;
      // Audio: play bell
      const audio = audioRef.current;
      if (audio?.started) {
        const note = BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)];
        playBell(note);
      }
      for (let i = 0; i < 25; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 6;
        const col = COLORS[Math.floor(Math.random() * COLORS.length)];
        ps.push({
          x: bx, y: by,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          orbit: 0, angle: 0, speed: 0,
          r: 1 + Math.random() * 4, col,
          baseAlpha: 0.9, breathPhase: 0, breathSpeed: 0,
          isBurst: true, life: 1,
          decay: 0.008 + Math.random() * 0.012,
        });
      }
    }

    let dragFrame = 0;
    let disturbance = 0; // 0 = calm, 1 = very disturbed

    function draw() {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      t += 0.016;

      // Measure disturbance from mouse proximity
      let closestDist = 999;
      if (mouse.x > 0) {
        const dx = mouse.x - CX(), dy = mouse.y - CY();
        closestDist = Math.hypot(dx, dy);
      }
      const targetDist = mouse.x > 0 ? Math.max(0, 1 - closestDist / 300) : 0;
      disturbance += (targetDist - disturbance) * 0.05;

      // Audio modulation
      const audio = audioRef.current;
      if (audio?.started) {
        setFilterFreq(200 + disturbance * 3000);
        setReverbWet(0.6 - disturbance * 0.4);
      }

      // Breathing global pulse
      const breathGlobal = Math.sin(t * 0.5) * 0.15 + 0.85;

      // Drag trail
      if (mouse.down && mouse.x > 0) {
        dragFrame++;
        if (dragFrame % 2 === 0) {
          const col = COLORS[Math.floor(Math.random() * COLORS.length)];
          ps.push({
            x: mouse.x + (Math.random() - 0.5) * 15,
            y: mouse.y + (Math.random() - 0.5) * 15,
            vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 - 0.5,
            orbit: 0, angle: 0, speed: 0,
            r: 2 + Math.random() * 3, col,
            baseAlpha: 0.8, breathPhase: 0, breathSpeed: 0,
            isBurst: true, life: 1,
            decay: 0.012 + Math.random() * 0.01,
          });
        }
      } else { dragFrame = 0; }

      // Connection lines
      for (let i = 0; i < Math.min(ps.length, N); i++) {
        for (let j = i + 1; j < Math.min(ps.length, N); j++) {
          const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            const lineAlpha = 0.06 * (1 - d / 100) * breathGlobal;
            ctx.strokeStyle = `rgba(155,109,255,${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Update & draw particles
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];

        if (p.isBurst) {
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.97; p.vy *= 0.97;
          p.vy += 0.01; // slight gravity
          p.life -= p.decay;
          if (p.life <= 0) { ps.splice(i, 1); continue; }
          const { r: cr, g: cg, b: cb } = p.col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.baseAlpha * p.life})`;
          ctx.shadowColor = `rgba(${cr},${cg},${cb},0.6)`;
          ctx.shadowBlur = 10 * p.life;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // Breathing alpha
          p.breathPhase += p.breathSpeed;
          const breath = Math.sin(p.breathPhase) * 0.3 + 0.7;
          const alpha = p.baseAlpha * breath * breathGlobal;

          // Mystical slow orbit (speed increases with disturbance)
          const speedMult = 1 + disturbance * 4;
          p.angle += p.speed * speedMult;
          const wobble = Math.sin(t * 0.3 + p.breathPhase) * 8; // gentle wobble
          const tx = CX() + Math.cos(p.angle) * (p.orbit + wobble);
          const ty = CY() + Math.sin(p.angle) * (p.orbit + wobble);
          p.vx += (tx - p.x) * 0.02;
          p.vy += (ty - p.y) * 0.02;

          // Mouse repulsion — stronger when closer
          if (mouse.x > 0) {
            const dx = p.x - mouse.x, dy = p.y - mouse.y;
            const d = Math.hypot(dx, dy);
            if (d < 120 && d > 0) {
              const force = (120 - d) / 120 * (1.5 + disturbance * 2);
              p.vx += (dx / d) * force;
              p.vy += (dy / d) * force;
            }
          }

          p.vx *= 0.93; p.vy *= 0.93;
          p.x += p.vx; p.y += p.vy;

          const { r: cr, g: cg, b: cb } = p.col;
          const glowR = p.r * (1 + disturbance * 0.5);
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
          ctx.shadowColor = `rgba(${cr},${cg},${cb},${alpha * 0.5})`;
          ctx.shadowBlur = 8 + disturbance * 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Center glow — breathes
      const glowSize = 120 + disturbance * 60;
      const g = ctx.createRadialGradient(CX(), CY(), 5, CX(), CY(), glowSize);
      g.addColorStop(0, `rgba(155,109,255,${0.06 * breathGlobal})`);
      g.addColorStop(0.4, `rgba(0,229,204,${0.02 * breathGlobal})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Mouse hover ring — gentle
      if (mouse.x > 0 && !mouse.down) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 20 + disturbance * 15, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,255,0,${0.1 + disturbance * 0.15})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      cv.removeEventListener('mousemove', onMove);
      cv.removeEventListener('mousedown', onDown);
      cv.removeEventListener('mouseup', onUp);
      cv.removeEventListener('mouseleave', onLeave);
    };
  }, [canvasRef, audioRef]);
}

/* ═══════════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════════ */
const SECS = [
  { id: 'hero', label: 'Home', n: '00' },
  { id: 'about', label: 'About', n: '01' },
  { id: 'work', label: 'Work', n: '02' },
  { id: 'experience', label: 'Exp', n: '03' },
  { id: 'contact', label: 'Contact', n: '04' },
];

function Nav() {
  const { toggle, isClassy } = useTheme();
  const [active, setActive] = useState('hero');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { threshold: 0.25 });
    SECS.forEach(({ id }) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const go = id => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setOpen(false); };

  return (
    <nav className={`nav ${open ? 'nav--open' : ''}`}>
      <div className="nav__logo" onClick={() => go('hero')}>
        <span className="nav__logo-at mono">@</span>
        <span className="nav__logo-name mono">notreallyzoh</span>
      </div>
      <button className="nav__burger" onClick={() => setOpen(!open)} aria-label="Menu">
        <span /><span /><span />
      </button>
      <div className="nav__links">
        {SECS.map(s => (
          <button key={s.id} className={`nav__link mono ${active === s.id ? 'active' : ''}`} onClick={() => go(s.id)}>
            <span className="nav__n">{s.n}</span>{s.label}
            {active === s.id && <span className="nav__dot" />}
          </button>
        ))}
        <a href="/resume.pdf" download className="neo-btn neo-btn--outline nav__resume">
          Resume ↓
        </a>
      </div>
      <button className="nav__theme glass" onClick={toggle} aria-label="Toggle theme">
        <span>{isClassy ? '◐' : '◑'}</span>
        <span className="mono nav__theme-label">{isClassy ? 'CLASSY' : 'BOLD'}</span>
      </button>
      <MuteButton />
    </nav>
  );
}

function MuteButton() {
  const { muted, started, toggleMute } = useAudio();
  return (
    <button className="nav__mute glass" onClick={toggleMute} aria-label="Toggle sound" title="Press M to toggle">
      <span>{!started || muted ? '🔇' : '🔊'}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════
   HERO — immersive full-screen particle playground
   ═══════════════════════════════════════════════ */
function Hero() {
  const morphRef = useRef(null);
  const logoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const { started, muted } = useAudio();
  const audioStateRef = useRef({ started, muted });
  audioStateRef.current = { started, muted };

  useImmersiveCanvas(canvasRef, audioStateRef);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const lines = document.querySelectorAll('.hero__line');
    lines.forEach(line => glitchReveal(line));
  }, [loaded]);

  // Morphing role loop
  useEffect(() => {
    if (!morphRef.current) return;
    const words = ['artist', 'engineer', 'explorer', 'builder', 'dreamer', 'creator'];
    let idx = 0;
    const morph = () => {
      const next = words[idx % words.length];
      gsap.to(morphRef.current, {
        duration: 0.25, opacity: 0, y: -8, ease: 'power2.in',
        onComplete: () => {
          if (!morphRef.current) return;
          morphRef.current.textContent = next;
          gsap.fromTo(morphRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
        }
      });
      idx++;
    };
    const interval = setInterval(morph, 2000);
    return () => clearInterval(interval);
  }, []);

  // Parallax
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to('.hero__overlay', {
        y: -60, opacity: 0,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 }
      });
    });
    return () => ctx.revert();
  }, []);

  // Logo float
  useEffect(() => {
    if (!logoRef.current) return;
    gsap.to(logoRef.current, { y: -8, duration: 3, ease: 'sine.inOut', repeat: -1, yoyo: true });
  }, []);

  return (
    <section className={`hero ${loaded ? 'hero--loaded' : ''}`} id="hero">
      <canvas ref={canvasRef} className="hero__canvas" />
      <div className="hero__overlay">
        <img ref={logoRef} src="/logo.png" alt="@notreallyzoh" className="hero__logo hero__reveal" style={{ '--delay': '0s' }} />
        <p className="hero__hint mono hero__reveal" style={{ '--delay': '0.3s' }}>click · drag · hover</p>
        <h1 className="hero__heading hero__reveal" style={{ '--delay': '0.5s' }}>
          <span className="hero__line">{PERSONAL.name}</span>
        </h1>
        <p className="hero__tagline mono hero__reveal" style={{ '--delay': '0.8s' }}>{PERSONAL.tagline}</p>
        <div className="hero__morph-wrap mono hero__reveal" style={{ '--delay': '1s' }}>
          a digital <span ref={morphRef} className="hero__morph-word">artist</span>
        </div>
        <div className="hero__ctas hero__reveal" style={{ '--delay': '1.2s' }}>
          <a href="#work" className="neo-btn" onClick={e => { e.preventDefault(); document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' }); }}>View Work ↓</a>
          <a href="/resume.pdf" download className="neo-btn neo-btn--outline">Resume ↓</a>
        </div>
      </div>
      <div className="hero__scroll mono hero__reveal" style={{ '--delay': '1.4s' }}><span>scroll</span><div className="hero__scroll-line" /></div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   ABOUT — horizontal scroll for tech stack
   ═══════════════════════════════════════════════ */
function About() {
  const ref = useRef();
  const hScrollRef = useRef();

  useEffect(() => {
    const s = ref.current; if (!s) return;
    const ctx = gsap.context(() => {
      // Title & bio animations
      gsap.from(s.querySelector('.about__title'), { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 75%', toggleActions: 'play none none reverse' } });
      gsap.from(s.querySelectorAll('.about__bio p'), { y: 30, opacity: 0, stagger: 0.1, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: s, start: 'top 70%', toggleActions: 'play none none reverse' } });

      // Horizontal scroll for tech stack cards
      const hScroll = hScrollRef.current;
      if (hScroll) {
        const cards = hScroll.querySelectorAll('.stack-card');
        const totalWidth = Array.from(cards).reduce((sum, c) => sum + c.offsetWidth + 16, 0);
        gsap.to(hScroll, {
          x: () => -(totalWidth - window.innerWidth + 200),
          ease: 'none',
          scrollTrigger: {
            trigger: '.hscroll-wrap',
            start: 'top 20%',
            end: () => `+=${totalWidth}`,
            scrub: 1,
            pin: true,
          }
        });
      }
    }, s);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="section" id="about">
      <div className="container">
        <div className="section-label">About</div>
        <h2 className="about__title">Where <em>code</em> meets <em>expression</em></h2>
        <div className="about__bio">
          <p className="about__hero-line">{PERSONAL.bio[0]}</p>
          {PERSONAL.bio.slice(1).map((l, i) => <p key={i}>{l}</p>)}
          <p className="about__long">{PERSONAL.longBio}</p>
        </div>
      </div>
      <div className="hscroll-wrap">
        <div className="container">
          <h3 className="mono stack-title">// TOOLKIT</h3>
        </div>
        <div ref={hScrollRef} className="hscroll-track">
          {TECH_STACK.map(c => (
            <div key={c.cat} className="stack-card neo-card">
              <div className="stack-card__inner">
                <div className="stack-cat"><span className="stack-icon">{c.icon}</span><span className="mono">{c.cat}</span></div>
                <div className="stack-tools">{c.tools.map(t => <span key={t} className="stack-tool">{t}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="container">
        <GitHubViz />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   GITHUB
   ═══════════════════════════════════════════════ */
function GitHubViz() {
  const cvRef = useRef();
  const [stats, setStats] = useState({ total: 0, streak: 0 });
  const [weeks, setWeeks] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://api.github.com/users/notreallyzoh/events/public?per_page=100');
        const events = await res.json();
        if (!Array.isArray(events)) { mock(); return; }
        const map = {};
        const now = new Date();
        for (let i = 0; i < 365; i++) { const d = new Date(now); d.setDate(d.getDate() - i); map[d.toISOString().split('T')[0]] = 0; }
        events.forEach(ev => { const dt = ev.created_at?.split('T')[0]; if (dt && map[dt] !== undefined) map[dt]++; });
        const sorted = Object.keys(map).sort();
        const w = []; let cur = [];
        sorted.forEach(d => { cur.push(map[d]); if (cur.length === 7) { w.push(cur); cur = []; } });
        if (cur.length) w.push(cur);
        let str = 0; for (let i = sorted.length - 1; i >= 0; i--) { if (map[sorted[i]] > 0) str++; else break; }
        setWeeks(w); setStats({ total: Object.values(map).reduce((a, b) => a + b, 0), streak: str });
      } catch { mock(); }
    })();
    function mock() {
      const w = Array.from({ length: 52 }, () => Array.from({ length: 7 }, () => Math.random() > 0.4 ? Math.floor(Math.random() * 6) : 0));
      setWeeks(w); setStats({ total: 183, streak: 3 });
    }
  }, []);

  const drawGrid = useCallback(() => {
    const cv = cvRef.current; if (!cv || !weeks) return;
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    const cell = 9, gap = 3, style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#9b6dff';
    const bg3 = style.getPropertyValue('--bg-tertiary').trim() || '#16142a';
    const sx = (cv.width - weeks.length * (cell + gap)) / 2, sy = (cv.height - 7 * (cell + gap)) / 2;
    weeks.forEach((w, wi) => w.forEach((v, di) => {
      const x = sx + wi * (cell + gap), y = sy + di * (cell + gap);
      c.beginPath(); c.roundRect(x, y, cell, cell, 2);
      if (v === 0) { c.fillStyle = bg3; } else { c.fillStyle = accent; c.globalAlpha = 0.2 + Math.min(v / 5, 1) * 0.8; }
      c.fill(); c.globalAlpha = 1;
    }));
  }, [weeks]);

  useEffect(() => { drawGrid(); }, [drawGrid]);
  useEffect(() => {
    const obs = new MutationObserver(drawGrid);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, [drawGrid]);

  if (!weeks) return null;
  return (
    <div className="github glass">
      <div className="github__top">
        <h3 className="mono github__label">// GITHUB_ACTIVITY</h3>
        <a href="https://github.com/notreallyzoh" target="_blank" rel="noopener noreferrer" className="mono github__user">@notreallyzoh</a>
      </div>
      <canvas ref={cvRef} width={680} height={110} className="github__canvas" />
      <div className="github__stats">
        <div><span className="github__num">{stats.total}</span><span className="mono github__lbl">contributions</span></div>
        <div><span className="github__num">{stats.streak}</span><span className="mono github__lbl">day streak</span></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   WORK — scroll waypoint animated entry
   ═══════════════════════════════════════════════ */
function Work() {
  const [cat, setCat] = useState('installations');
  const ref = useRef();
  const gridRef = useRef();
  const filtered = PROJECTS.filter(p => p.category === cat);

  useEffect(() => {
    const s = ref.current; if (!s) return;
    const ctx = gsap.context(() => {
      // Animate title with scroll waypoint
      const title = s.querySelector('.work__title');
      gsap.from(title, {
        y: 80, opacity: 0, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: s, start: 'top 75%', toggleActions: 'play none none reverse' }
      });

      // Animate tabs
      gsap.from(s.querySelectorAll('.work__tab'), {
        x: -20, opacity: 0, stagger: 0.05, duration: 0.4, ease: 'power2.out',
        scrollTrigger: { trigger: s, start: 'top 70%', toggleActions: 'play none none reverse' }
      });
    }, s);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    gsap.fromTo(gridRef.current.querySelectorAll('.work__card'),
      { y: 50, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 0.6, ease: 'power2.out' }
    );
  }, [cat]);

  return (
    <section ref={ref} className="section" id="work">
      <div className="container">
        <div className="section-label">Work & Projects</div>
        <h2 className="work__title">Creative <em>Showcase</em></h2>
        <div className="work__tabs">
          {CATEGORIES.map(c => (
            <button key={c.id} className={`work__tab mono ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
        <div ref={gridRef} className="work__grid">
          {filtered.map(p => <ProjectCard key={p.id} p={p} />)}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ p }) {
  const [mi, setMi] = useState(0);
  const [open, setOpen] = useState(false);
  const m = p.media[mi];

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div className="work__card neo-card" onClick={() => setOpen(true)}>
        <div className="work__media">
          {m?.type === 'video'
            ? <video src={m.src} muted loop playsInline autoPlay />
            : <img src={m?.src} alt={p.title} loading="lazy" />}
          {p.media.length > 1 && (
            <div className="work__dots">
              {p.media.map((_, i) => <button key={i} className={`work__dot ${i === mi ? 'active' : ''}`} onClick={e => { e.stopPropagation(); setMi(i); }} />)}
            </div>
          )}
          <span className="work__year mono">{p.year}</span>
          {p.longDesc && <span className="work__badge mono">CASE STUDY</span>}
        </div>
        <div className="work__info">
          <h3>{p.title}</h3>
          <p>{p.desc}</p>
          <div className="work__tech">{p.tech.map(t => <span key={t} className="mono">{t}</span>)}</div>
          {p.links?.live && <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="mono work__link" onClick={e => e.stopPropagation()}>→ Live Demo</a>}
        </div>
      </div>

      {/* Full-screen detail modal */}
      {open && (
        <div className="detail-overlay" onClick={() => setOpen(false)}>
          <div className="detail" onClick={e => e.stopPropagation()}>
            <button className="detail__close" onClick={() => setOpen(false)}>✕</button>

            {/* Media carousel */}
            <div className="detail__media">
              {p.media[mi]?.type === 'video'
                ? <video src={p.media[mi].src} controls autoPlay muted loop playsInline />
                : <img src={p.media[mi]?.src} alt={p.title} />}
              {p.media.length > 1 && (
                <div className="detail__thumbs">
                  {p.media.map((med, i) => (
                    <button key={i} className={`detail__thumb ${i === mi ? 'active' : ''}`} onClick={() => setMi(i)}>
                      {med.type === 'video' ? '▶' : '◻'}
                      {med.caption && <span className="detail__thumb-label mono">{med.caption}</span>}
                    </button>
                  ))}
                </div>
              )}
              {p.media[mi]?.caption && <p className="detail__caption mono">{p.media[mi].caption}</p>}
            </div>

            {/* Content */}
            <div className="detail__content">
              <h2>{p.title}</h2>
              <p className="detail__desc">{p.desc}</p>

              {p.event && (
                <div className="detail__meta">
                  <span className="mono">EVENT</span>
                  <a href={p.event.url} target="_blank" rel="noopener noreferrer">{p.event.name}</a>
                </div>
              )}
              {p.client && (
                <div className="detail__meta">
                  <span className="mono">CLIENT</span>
                  <a href={p.client.url} target="_blank" rel="noopener noreferrer">{p.client.name}</a>
                </div>
              )}
              {p.collaborator && (
                <div className="detail__meta">
                  <span className="mono">COLLAB</span>
                  <span>{p.collaborator.name} · {p.collaborator.role}</span>
                </div>
              )}

              {/* Case study narrative */}
              {p.longDesc && (
                <div className="detail__story">
                  {p.longDesc.map((section, i) => (
                    <div key={i} className="detail__section">
                      <h3 className="mono">{section.heading}</h3>
                      <p>{section.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="detail__tech">
                <span className="mono detail__tech-label">TECH STACK</span>
                <div className="detail__tags">{p.tech.map(t => <span key={t} className="stack-tool">{t}</span>)}</div>
              </div>

              {p.links?.live && (
                <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="neo-btn detail__cta">
                  View Live →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════
   EXPERIENCE — scroll-triggered timeline
   ═══════════════════════════════════════════════ */
function Experience() {
  const ref = useRef();
  useEffect(() => {
    const s = ref.current; if (!s) return;
    const ctx = gsap.context(() => {
      gsap.from(s.querySelector('.exp__title'), { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 75%', toggleActions: 'play none none reverse' } });
      gsap.from(s.querySelector('.exp__line'), { scaleY: 0, transformOrigin: 'top center', duration: 1.5, ease: 'power3.inOut', scrollTrigger: { trigger: s, start: 'top 70%', toggleActions: 'play none none reverse' } });
      gsap.from(s.querySelectorAll('.exp__card'), { x: -60, opacity: 0, stagger: 0.2, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 65%', toggleActions: 'play none none reverse' } });
    }, s);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="section" id="experience">
      <div className="container">
        <div className="section-label">Experience</div>
        <h2 className="exp__title">The <em>journey</em> so far</h2>
        <div className="exp__timeline">
          <div className="exp__line" />
          {EXPERIENCES.map(ex => (
            <div key={ex.id} className="exp__card neo-card">
              <div className="exp__card-inner">
                <div className="exp__dot" />
                <div className="exp__header">
                  <div>
                    <h3>{ex.role}</h3>
                    <p className="exp__co">{ex.company} <span className="mono">· {ex.type}</span></p>
                  </div>
                  <span className="mono exp__period">{ex.period}</span>
                </div>
                <p className="exp__desc">{ex.desc}</p>
                <ul className="exp__hl">{ex.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
                <div className="exp__skills">{ex.skills.map(s => <span key={s} className="mono">{s}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   SPOTIFY — live API with fallback
   Setup: Create /api/spotify endpoint or use env vars
   Needs SPOTIFY_REFRESH_TOKEN, SPOTIFY_CLIENT_ID,
   SPOTIFY_CLIENT_SECRET as server-side secrets
   ═══════════════════════════════════════════════ */
const SPOTIFY_ENDPOINT = '/api/spotify'; // server endpoint for now-playing

function SpotifyWidget() {
  const [track, setTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchNowPlaying = async () => {
      try {
        const res = await fetch(SPOTIFY_ENDPOINT);
        if (res.ok) {
          const data = await res.json();
          if (data.is_playing && mounted) {
            setTrack({
              name: data.item?.name || 'Unknown',
              artist: data.item?.artists?.map(a => a.name).join(', ') || 'Unknown',
              album_art: data.item?.album?.images?.[2]?.url || null,
              url: data.item?.external_urls?.spotify,
            });
            setIsPlaying(true);
          } else if (mounted) {
            setIsPlaying(false);
          }
        } else {
          // Fallback to mock
          if (mounted) {
            setTrack({ name: 'Midnight City', artist: 'M83', album_art: null, url: '#' });
            setIsPlaying(true);
          }
        }
      } catch {
        if (mounted) {
          setTrack({ name: 'Midnight City', artist: 'M83', album_art: null, url: '#' });
          setIsPlaying(true);
        }
      }
    };
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 30000); // poll every 30s
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (!track) return null;

  return (
    <a href={track.url || '#'} target="_blank" rel="noopener noreferrer" className="spotify glass" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="spotify__top">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
        <span className="mono spotify__lbl">{isPlaying ? 'NOW PLAYING' : 'LAST PLAYED'}</span>
      </div>
      <div className="spotify__track">
        {track.album_art
          ? <img src={track.album_art} alt="" className="spotify__art-img" />
          : <div className="spotify__art">♪</div>}
        <div className="spotify__info">
          <p className="spotify__name">{track.name}</p>
          <p className="spotify__artist">{track.artist}</p>
        </div>
        {isPlaying && <div className="spotify__bars"><span/><span/><span/><span/></div>}
      </div>
    </a>
  );
}

/* ═══════════════════════════════════════════════
   CONTACT
   ═══════════════════════════════════════════════ */
function Contact() {
  const ref = useRef();
  useEffect(() => {
    const s = ref.current; if (!s) return;
    const ctx = gsap.context(() => {
      gsap.from(s.querySelector('.contact__title'), { y: 80, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 70%', toggleActions: 'play none none reverse' } });
      gsap.from(s.querySelectorAll('.contact__soclink'), { y: 20, opacity: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out', scrollTrigger: { trigger: s, start: 'top 60%', toggleActions: 'play none none reverse' } });
    }, s);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="section contact" id="contact">
      <div className="container contact__inner">
        <div className="section-label">Contact</div>
        <h2 className="contact__title">Let's build something<br /><em>wild & meaningful</em></h2>
        <p className="contact__sub">Always open to collaborations, commissions, and creative tech projects.</p>
        <a href={`mailto:${PERSONAL.email}`} className="neo-btn contact__email">
          {PERSONAL.email} <span>→</span>
        </a>
        <div className="contact__links">
          {SOCIALS.map(s => (
            <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="contact__soclink glass">
              <span>{s.icon}</span><span className="mono">{s.label}</span>
            </a>
          ))}
        </div>
        <SpotifyWidget />
        <footer className="contact__footer">
          <p className="mono">© {new Date().getFullYear()} {PERSONAL.name} — Crafted with code & curiosity</p>
          <p className="mono contact__stack">React · GSAP · Canvas · NeoPOP-inspired CSS</p>
        </footer>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════ */
export default function App() {
  return (
    <ThemeProvider>
      <AudioProvider>
        <CursorTrail />
        <Nav />
        <main>
          <Hero />
          <About />
          <Work />
          <Experience />
          <Contact />
        </main>
      </AudioProvider>
    </ThemeProvider>
  );
}
