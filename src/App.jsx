import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { PERSONAL, TECH_STACK, EXPERIENCES, CATEGORIES, PROJECTS, SOCIALS } from './data';
import './App.css';
import { localUrl, withBase } from './paths';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAV_ITEMS = [{id:'work', label:'Work'}, {id:'about', label:'Practice'}, {id:'experience', label:'Experience'}, {id:'contact', label:'Contact'}];
const SCENES = [
  { id:'mycelial-stage', name:'Mycelial Stage', role:'Live visuals · with Optikbloom & Lostkids Garage', image:'/media/mycelial-stage/stage-2.jpg' },
  { id:'signals', name:'Signals', role:'Art assistance · Ephemeral Tomorrow', image:'/media/signals/installation-2.webp' },
  { id:'hirist-techground', name:'hirist techground', role:'Event curation · Visual direction · Projection mapping', image:'/media/techground/02_Arrival_STILL.jpg' },
].map(withBase);

function Arrow({ diagonal = false }) { return <span className="arrow" aria-hidden="true">{diagonal ? '↗' : '→'}</span>; }

function Nav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('zoh-theme') || 'classy'; } catch { return 'classy'; }
  });
  const menuRef = useRef();
  const burgerRef = useRef();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('zoh-theme', theme); } catch { /* Storage may be disabled. */ }
  }, [theme]);
  useEffect(() => {
    const update = () => {
      let current = '';
      for (const {id} of NAV_ITEMS) if (document.getElementById(id)?.getBoundingClientRect().top <= 180) current = id;
      setActive(current);
    };
    window.addEventListener('scroll', update, {passive:true});
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(min-width: 1000px)');
    const resize = () => { if (media.matches) setOpen(false); };
    const keydown = e => {
      if (e.key === 'Escape') { setOpen(false); burgerRef.current?.focus(); }
      if (e.key === 'Tab') {
        const items = [burgerRef.current, ...menuRef.current.querySelectorAll('a')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    media.addEventListener('change', resize);
    window.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; media.removeEventListener('change', resize); window.removeEventListener('keydown', keydown); };
  }, [open]);
  return <header className={`nav ${open ? 'nav--open' : ''}`}>
    <a className="nav__logo" href="#hero" aria-label="Zoh — home" onClick={() => setOpen(false)}>
      <img src={localUrl("/logo.png")} width="36" height="36" alt="" /><span>notreallyzoh<span className="nav__logo-period">.</span></span>
    </a>
    <button ref={burgerRef} className="nav__burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(v => !v)}><span>{open ? 'Close' : 'Menu'}</span><span className="nav__burger-icon" aria-hidden="true">{open ? '−' : '+'}</span></button>
    <nav ref={menuRef} id="main-navigation" className="nav__links" aria-label="Main navigation">
      {NAV_ITEMS.map(item => <a key={item.id} className={`nav__link ${active === item.id ? 'active' : ''}`} aria-current={active === item.id ? 'location' : undefined} href={`#${item.id}`} onClick={() => setOpen(false)}>{item.label}</a>)}
      <a className="nav__resume" href={localUrl("/resume.pdf")} download>Résumé <span aria-hidden="true">↓</span></a>
    </nav>
    <button className="nav__theme" onClick={() => setTheme(t => t === 'classy' ? 'bold' : 'classy')} aria-label={theme === 'classy' ? 'Switch to light theme' : 'Switch to dark theme'} title="Change theme"><span aria-hidden="true">{theme === 'classy' ? '◐' : '◑'}</span></button>
  </header>;
}

function Hero() {
  const [scene, setScene] = useState(0);
  const heroRef = useRef();
  useEffect(() => {
    if (reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from('.hero__heading > span', {y:36, opacity:0, duration:.9, stagger:.1, ease:'power3.out'});
      gsap.from('.hero__intro, .hero__actions', {y:18, opacity:0, duration:.7, delay:.3, stagger:.1});
    }, heroRef);
    return () => ctx.revert();
  }, []);
  return <section className="hero" id="hero" ref={heroRef} data-section="hero">
    <div className="hero__scenes" aria-hidden="true">
      {SCENES.map((s,i) => <img key={s.id} className={`hero__scene ${scene === i ? 'is-active' : ''} hero__scene--${s.id}`} src={s.image} alt="" fetchPriority={i === 0 ? 'high' : 'auto'} />)}
    </div>
    <div className="hero__shade" />
    <div className="hero__content">
      <p className="hero__intro">Zoheb Mamoo <span>/</span> New media artist & creative technologist</p>
      <h1 className="hero__heading"><span>Art that moves.</span><span>Spaces that</span><span className="hero__serif">respond.</span></h1>
      <div className="hero__actions"><a href="#work" className="neo-btn">Explore the work <Arrow /></a><a href={localUrl("/resume.pdf")} download className="hero__resume">Download résumé <span aria-hidden="true">↓</span></a></div>
    </div>
    <div className="hero__bottom">
      <p className="hero__location">Based in Bangalore<br/><span>Working across art, code & physical space</span></p>
      <div className="hero__selector" aria-label="Featured project scenes">
        <div className="hero__scene-controls">{SCENES.map((s,i) => <button key={s.id} onClick={() => setScene(i)} aria-label={`Show ${s.name}`} aria-pressed={scene === i}><span className="hero__scene-number">0{i+1}</span><span className="hero__scene-rule" /></button>)}</div>
        <a href={`#project-${SCENES[scene].id}`} onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('portfolio:select-project', {detail: SCENES[scene].id})); }} className="hero__scene-link"><span>{SCENES[scene].name}<small>{SCENES[scene].role}</small></span><Arrow diagonal /></a>
      </div>
    </div>
  </section>;
}

function Work() {
  const [cat, setCat] = useState('all');
  const [target, setTarget] = useState(null);
  const gridRef = useRef();
  const websites = PROJECTS.filter(p => p.category === 'websites');
  const filtered = PROJECTS.filter(p => cat === 'all' ? p.category !== 'websites' : (p.categories || [p.category]).includes(cat));
  const displayed = cat === 'all' ? filtered.flatMap(p => p.id === '1by0' ? [p, {id: 'website-collection'}] : [p]) : filtered;
  const openWebsites = () => {
    setCat('websites');
    document.getElementById('work')?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
    document.getElementById('filter-websites')?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const select = e => { setCat(PROJECTS.find(p => p.id === e.detail)?.category === 'websites' ? 'websites' : 'all'); setTarget(e.detail); };
    window.addEventListener('portfolio:select-project', select);
    return () => window.removeEventListener('portfolio:select-project', select);
  }, []);
  useEffect(() => {
    if (!target) return;
    const card = document.getElementById(`project-${target}`);
    card?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block:'start' });
    card?.querySelector('.work__read')?.focus({preventScroll:true});
    history.replaceState(null, '', `#project-${target}`);
    setTarget(null);
  }, [target]);
  useEffect(() => {
    if (reducedMotion()) return;
    const ctx = gsap.context(() => gsap.from('.work__card', {y:20, opacity:0, duration:.45, stagger:.035, clearProps:'all', ease:'power2.out'}), gridRef);
    return () => ctx.revert();
  }, [cat]);
  return <section className="section work" id="work" data-section="work">
    <div className="container">
      <div className="section-heading"><div><p className="section-label">A selection of things I've made & been part of</p><h2 className="work__title">Selected <em>work.</em></h2></div><p className="section-note">From a screen to a space.<br/>Ideas made tangible, together.</p></div>
      <div className="work__toolbar"><div className="work__tabs" aria-label="Filter projects">
        <button className={`work__tab ${cat === 'all' ? 'active' : ''}`} aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All work <sup>{PROJECTS.length - websites.length + 1}</sup></button>
        {CATEGORIES.map(c => <button id={`filter-${c.id}`} key={c.id} className={`work__tab ${cat === c.id ? 'active' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label} <sup>{PROJECTS.filter(p => (p.categories || [p.category]).includes(c.id)).length}</sup></button>)}
      </div><span className="work__count" aria-live="polite">{cat === 'all' ? `${filtered.length} projects + 1 collection` : `${filtered.length} projects`}</span></div>
      {cat === 'websites' && <p className="work__web-intro">Freelance design & full-stack development, from first concept to launch. Five live projects, subsequently handed over to the agency.</p>}
      <div ref={gridRef} className="work__grid">
        {displayed.map(p => p.id === 'website-collection' ? <article key={p.id} className="work__card work__collection">
          <button className="work__collection-preview" onClick={openWebsites} aria-label="Explore all five websites and commerce projects">
            {websites.map(p => <img key={p.id} src={p.media[0].src} alt="" loading="lazy" />)}
            <span className="work__open" aria-hidden="true"><Arrow diagonal /></span>
          </button>
          <div className="work__info">
            <div className="work__meta"><span>Freelance design & development</span><span>{websites.length} websites</span></div>
            <h3>Websites & Commerce</h3>
            <p className="work__description">ALIFA, BZ Fitness, NEXSTEG, Roca Fuels & Adaline. From editorial storefronts to catalogues and brand websites.</p>
            <button className="work__read" onClick={openWebsites}>Explore the collection <Arrow /></button>
          </div>
        </article> : <ProjectCard key={p.id} p={p} />)}
      </div>
    </div>
  </section>;
}

function ProjectCard({ p }) {
  const [mi, setMi] = useState(0);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const closeRef = useRef();
  const openerRef = useRef();
  const close = () => { setOpen(false); setPlaying(false); };
  const m = p.media[mi];

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.getElementById('root').inert = true;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.getElementById('root').inert = false;
      openerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const items = [...closeRef.current.closest('.detail').querySelectorAll('button, a[href], iframe, video[controls]')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <article className={`work__card neo-card ${p.showcase ? 'work__card--showcase' : ''} ${p.presentation === 'portrait' ? 'work__card--portrait' : ''} ${p.presentation === 'website' ? 'work__card--website' : ''}`} id={`project-${p.id}`} onClick={() => setOpen(true)}>
        {p.domain && <div className="work__browser"><span aria-hidden="true">● ● ●</span><span>{p.domain}</span><span>↗</span></div>}
        <div className="work__media" onPointerEnter={e => { if (e.pointerType === 'mouse' && !reducedMotion()) e.currentTarget.querySelector('video')?.play().catch(() => {}); }} onPointerLeave={e => e.currentTarget.querySelector('video')?.pause()}>
          {m?.type === 'video'
            ? <video src={m.src} poster={m.poster} muted loop playsInline preload="metadata" aria-label={p.title} />
            : <img src={m?.src} alt={m?.caption || p.title} loading="lazy" />}
          <span className="work__media-count">{p.media.length} {p.media.length === 1 ? 'frame' : 'frames'} {p.media.some(m => m.type === 'video') ? ' / film' : ''}</span>
          <span className="work__open" aria-hidden="true"><Arrow diagonal /></span>
        </div>
        <div className="work__info">
          <div className="work__meta"><span>{p.showcaseLabel || CATEGORIES.find(c => c.id === p.category)?.label}</span><span>{p.year}</span></div>
          <h3>{p.title.split(' — ')[0]}</h3>
          <p className="work__description">{p.desc}</p>
          <button ref={openerRef} className="work__read" onClick={() => setOpen(true)}>Explore project <Arrow /></button>
          {p.links?.preview && <a href={p.links.preview} target="_blank" rel="noopener noreferrer" className="work__preview-link mono" onClick={e => e.stopPropagation()}>Try the map ↗</a>}
          {p.links?.gallery && <a href={p.links.gallery} target="_blank" rel="noopener noreferrer" className="work__preview-link mono" onClick={e => e.stopPropagation()}>Identity & motion gallery ↗</a>}
          {p.links?.live && <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="mono work__link" onClick={e => e.stopPropagation()}>{p.domain ? 'Visit website ↗' : '→ Live Demo'}</a>}
        </div>
      </article>

      {/* Full-screen detail modal */}
      {open && createPortal((
        <div className="detail-overlay" onClick={close}>
          <div className={`detail ${p.showcase ? 'detail--showcase' : ''} ${p.presentation === 'portrait' ? 'detail--portrait' : ''}`} role="dialog" aria-modal="true" aria-labelledby={`title-${p.id}`} onClick={e => e.stopPropagation()}>
            <button ref={closeRef} className="detail__close" aria-label="Close project" onClick={close}>✕</button>
            {p.highlightRole && <section className="detail__role-lead" aria-label="My contribution"><p className="section-label">MY ROLE · ZOHEB MAMOO</p><h2>{p.title}</h2><p>{p.role}</p></section>}

            {/* Media carousel */}
            <div className="detail__media">
              {p.media[mi]?.type === 'video'
                ? <video key={p.media[mi].src} src={p.media[mi].src} poster={p.media[mi].poster} controls autoPlay={!reducedMotion()} muted loop playsInline preload="metadata" />
                : <img src={p.media[mi]?.src} alt={p.media[mi]?.caption || p.title} />}
              {p.media.length > 1 && (
                <div className="detail__thumbs">
                  {p.media.map((med, i) => (
                    <button key={i} aria-pressed={i === mi} className={`detail__thumb ${i === mi ? 'active' : ''}`} onClick={() => setMi(i)}>
                      {med.type === 'video' ? '▶' : '◻'}
                      {med.caption && <span className="detail__thumb-label mono">{med.label || med.caption}</span>}
                    </button>
                  ))}
                </div>
              )}
              {p.media[mi]?.caption && <p className="detail__caption mono">{p.media[mi].caption}</p>}
            </div>

            {/* Content */}
            <div className="detail__content">
              <h2 id={`title-${p.id}`}>{p.title}</h2>
              <p className="detail__desc">{p.desc}</p>
              {p.role && <div className="detail__meta"><span className="mono">MY ROLE</span><span>{p.role}</span></div>}
              {p.links?.preview && (
                <section className="detail__preview" aria-label="Interactive project preview">
                  <div className="detail__preview-actions">
                    <button className="neo-btn" onClick={() => setPlaying(v => !v)}>{playing ? 'Close interactive preview' : 'Explore the interactive map'}</button>
                    <a href={p.links.preview} target="_blank" rel="noopener noreferrer">Open full screen ↗</a>
                  </div>
                  <p>Try Places → choose a venue → “I’m here”, then open My Sabha to see your network grow. Demo stamps stay in this browser.</p>
                  {playing && <iframe src={p.links.preview} title="Shroom Sabha interactive festival guide demo" sandbox="allow-scripts allow-same-origin allow-popups allow-downloads" />}
                </section>
              )}

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

              {p.credits && <section className="detail__credits"><h3 className="mono">{p.creditsLabel || 'Built with'}</h3><dl>{p.credits.map(c => <div key={c.role}><dt>{c.role}</dt><dd>{c.names}</dd></div>)}</dl></section>}

              <div className="detail__tech">
                <span className="mono detail__tech-label">{p.techLabel || 'TECH STACK'}</span>
                <div className="detail__tags">{p.tech.map(t => <span key={t} className="stack-tool">{t}</span>)}</div>
              </div>

              {p.links?.gallery && <div className="detail__links"><a className="neo-btn detail__cta" href={p.links.gallery} target="_blank" rel="noopener noreferrer">Explore identity & motion ↗</a></div>}
              {p.references && <div className="detail__references">{p.references.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</div>}

              {(p.links?.live || p.links?.github) && (
                <div className="detail__links">
                  {p.links.live && (
                    <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="neo-btn detail__cta">
                      View Live →
                    </a>
                  )}
                  {p.links.github && (
                    <a href={p.links.github} target="_blank" rel="noopener noreferrer" className="neo-btn neo-btn--outline detail__cta">
                      ⟐ GitHub →
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}

/* ═══════════════════════════════════════════════
   EXPERIENCE — scroll-triggered timeline
   ═══════════════════════════════════════════════ */

function About() {
  return <section className="section about" id="about" data-section="about"><div className="container">
    <div className="about__intro"><p className="section-label">The person behind the pixels</p><h2>I think in code.<br/>I make in <em>many mediums.</em></h2></div>
    <div className="about__body"><div className="about__identity"><img src={localUrl("/logo.png")} alt="Zoh's artist mark" width="112" height="112"/><p>Zoheb Mamoo<span>Artist. Engineer. Collaborator.</span></p></div><div className="about__bio"><p>{PERSONAL.bio[1]}</p><p>{PERSONAL.bio[2]}</p><p>{PERSONAL.longBio}</p><a className="text-link" href={`https://github.com/${PERSONAL.github}`} target="_blank" rel="noopener noreferrer">Explore my code <Arrow diagonal /></a></div></div>
    <div className="toolkit"><h3>Across my practice</h3><div className="toolkit__list">{TECH_STACK.map(c => <details key={c.cat} className="toolkit__row"><summary>{c.cat}<span aria-hidden="true">+</span></summary><p>{c.tools.join(' · ')}</p></details>)}</div></div>
  </div></section>;
}

function Experience() {
  return <section className="section experience" id="experience" data-section="experience"><div className="container">
    <div className="section-heading"><h2>Creative practice.<br/><em>Engineering roots.</em></h2><a href={localUrl("/resume.pdf")} download className="text-link">Download résumé <span aria-hidden="true">↓</span></a></div>
    <div className="exp__list">{EXPERIENCES.map(ex => <article key={ex.id} className="exp__row"><div className="exp__period">{ex.period}</div><div className="exp__body"><h3>{ex.role}</h3><p className="exp__co">{ex.company} <span>· {ex.type}</span></p><p className="exp__desc">{ex.desc}</p><ul>{ex.highlights.map(h => <li key={h}>{h}</li>)}</ul><p className="exp__skills">{ex.skills.join(' / ')}</p></div></article>)}</div>
  </div></section>;
}

function Contact() {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copyEmail = async () => {
    try { await navigator.clipboard.writeText(PERSONAL.email); setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2500); }
    catch { window.location.href = `mailto:${PERSONAL.email}`; }
  };
  return <footer className="section contact" id="contact" data-section="contact"><div className="container">
    <p className="section-label">A role, a collaboration, an unexpected idea</p>
    <a className="contact__headline" href={`mailto:${PERSONAL.email}`}><h2>Let's make<br/><em>something move.</em></h2><Arrow diagonal /></a>
    <div className="contact__actions"><a href={`mailto:${PERSONAL.email}`}>{PERSONAL.email}</a><button onClick={copyEmail} aria-label="Copy email address"><span aria-live="polite">{copied ? 'Copied ✓' : 'Copy email'}</span></button></div>
    <div className="contact__footer"><a href="#hero" className="contact__wordmark">notreallyzoh.</a><div className="contact__links">{SOCIALS.filter(s => s.label !== 'Email').map(s => <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer">{s.label} <Arrow diagonal /></a>)}<a href="https://www.instagram.com/notreallyzoh/" target="_blank" rel="noopener noreferrer">Instagram <Arrow diagonal /></a></div><span>© {new Date().getFullYear()} Zoheb Mamoo</span><a href="#hero" className="back-top">Back to top ↑</a></div>
  </div></footer>;
}

export default function App() {
  return <><a className="skip-link" href="#work">Skip to work</a><Nav /><main><Hero /><Work /><About /><Experience /></main><Contact /></>;
}
