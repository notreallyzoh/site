import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PROJECTS, PERSONAL } from './data';
import { localUrl } from './paths';
import { EngineeringScene } from './EngineeringScene';
import './Dev.css';

const websites = PROJECTS.filter(p => p.category === 'websites');
const alifa = websites.find(p => p.id === 'alifa');
const layers = [
  { label: 'Interface', tech: 'React storefront', title: 'An editorial storefront, built in React.', text: 'Designed and developed the customer-facing website, bringing collection browsing, product discovery and the brand’s editorial direction into one experience.', scope: 'UI / UX design · Frontend development' },
  { label: 'Operations', tech: 'Payload CMS', title: 'The work continues behind the storefront.', text: 'Built a custom e-commerce admin CMS with Payload and implemented custom integrations. My contribution covered the operational tooling as well as the public website.', scope: 'Custom admin CMS · Integrations' },
  { label: 'Delivery', tech: 'Custom server + CI/CD', title: 'Owned the path from build to release.', text: 'Handled DevOps, CI/CD and deployment on a custom server. Delivered the project through launch and subsequent ownership transfer to the agency.', scope: 'Server deployment · CI/CD · Agency handover' },
];
const clientNotes = {
  bzfitness: 'Equipment discovery, quote building and gym-planning enquiries.',
  nexsteg: 'A motion-led fitness website connecting training, coaches and memberships.',
  rocafuels: 'Service information, directions, fleet enquiries and customer feedback.',
  adaline: 'An agency portfolio connecting case studies, services and project enquiries.',
};
const demos = [
  { id: 'shroom-sabha', title: 'A festival in your pocket.', type: 'Shroom Sabha / Interactive web app', detail: 'Programme search, bookmarks and exploration progress, connected to an interactive Three.js map.', points: ['State kept on the device', 'Searchable programme & personal bookmarks', 'Three.js map with a lighter p5.js fallback'], limitation: 'Archived preview. GPS, installation and real contact actions are disabled.', source: 'public/showcases/shroom-sabha/index.html' },
  { id: 'interlace', title: 'An instrument for live visuals.', type: 'Interlace / Browser-based tool', detail: 'A configurable rendering system with live controls, saved compositions and a separate output window.', points: ['BroadcastChannel output synchronization', 'Validated JSON configuration import', 'PNG & real-time WebM export'], limitation: 'Stage compositions are original; torus mode retains its open-source credits.', source: 'public/showcases/interlace/loops.js' },
].map(d => ({ ...d, project: PROJECTS.find(p => p.id === d.id) }));
function Arrow({ down = false }) { return <span aria-hidden="true" className="link-arrow">{down ? '↓' : '↗'}</span>; }
function Label({ index, children }) { return <p className="eyebrow"><span>{index}</span><span className="label-rule"/>{children}</p>; }

function DemoDialog({ demo, close }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current, previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.showModal();
    return () => { document.body.style.overflow = previous; dialog.close(); };
  }, []);
  return <dialog ref={ref} className="demo-dialog" onCancel={close} onClose={close} aria-label={demo.type}>
    <div className="demo-bar"><span>{demo.type}</span><a href={demo.project.links.preview || demo.project.links.live} target="_blank" rel="noreferrer">Open full page ↗</a><button autoFocus onClick={close} aria-label="Close interactive preview">Close ×</button></div>
    <iframe title={demo.type} src={demo.project.links.preview || demo.project.links.live} allow="fullscreen"/>
  </dialog>;
}

function DeveloperPortfolio() {
  const [layer, setLayer] = useState(0), [menu, setMenu] = useState(false), [active, setActive] = useState('top');
  const [demo, setDemo] = useState(null), [copied, setCopied] = useState(''), [paused, setPaused] = useState(false);
  const [light, setLight] = useState(() => { try { const saved = localStorage.getItem('zoh-dev-theme'); return saved ? saved === 'light' : matchMedia('(prefers-color-scheme: light)').matches; } catch { return false; } });
  useEffect(() => { document.documentElement.dataset.theme = light ? 'light' : 'dark'; try { localStorage.setItem('zoh-dev-theme', light ? 'light' : 'dark'); } catch {} }, [light]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); }); }, { rootMargin: '-10% 0px -55% 0px' });
    document.querySelectorAll('[data-section]').forEach(el => observer.observe(el)); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!menu) return; const close = e => { if (e.key === 'Escape') { setMenu(false); document.getElementById('menu-toggle').focus(); } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [menu]);
  const copy = async () => { try { await navigator.clipboard.writeText(PERSONAL.email); setCopied('Email copied'); } catch { setCopied('Email: '+PERSONAL.email); } };
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header className="rail">
      <a className="monogram" href="#top" aria-label="Zoheb Mamoo — home">z<span>.</span></a>
      <button id="menu-toggle" className="menu-toggle" aria-expanded={menu} aria-controls="dev-nav" onClick={() => setMenu(!menu)}>{menu ? 'Close −' : 'Menu +'}</button>
      <nav id="dev-nav" className={menu ? 'is-open' : ''} aria-label="Main navigation">{[['work','Work'],['experience','Experience'],['experiments','Playground'],['contact','Contact']].map(([id,name]) => <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setMenu(false)}>{name}</a>)}</nav>
      <a className="rail-github" href={`https://github.com/${PERSONAL.github}`} aria-label="View GitHub profile"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-17-2 20"/></svg></a>
    </header>
    <div className="topbar"><a href={localUrl('/')} className="creative-switch">Creative portfolio <Arrow/></a><button className="theme-toggle" onClick={() => setLight(!light)} aria-label={`Switch to ${light ? 'dark' : 'light'} theme`}>{light ? '◐' : '◑'}</button></div>
    <main id="main">
      <section className="intro" id="top" data-section>
        <EngineeringScene paused={paused} light={light}/>
        <div className="intro-copy"><p className="name-label">Zoheb Mamoo <span>/ Bengaluru, India</span></p><h1><span className="hero-first">Software engineer.</span><span className="hero-second"><span className="hero-plus">+</span><span>creative technologist.</span></span></h1>
          <p className="intro-description">Frontend craft. Full-stack ownership.<br/>I build React & TypeScript experiences, backed by three years of production engineering at Cytel.</p>
          <div className="actions"><a className="button" href="#work">Explore the work <Arrow down/></a><a className="text-link" href={localUrl('/developer-resume.pdf')} download>Download résumé <Arrow/></a></div>
        </div>
        <div className="intro-foot"><span>React / TypeScript / C++ / Creative coding</span><button className="motion-control" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? 'Resume motion' : 'Pause motion'} <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span></button></div>
      </section>
      <div className="proof-strip page-width"><a href="#experience"><strong>03</strong><span>Years at Cytel<br/>Production software & R&D</span></a><a href="#clients"><strong>05</strong><span>Client websites<br/>Design through agency handover</span></a><a href="#alifa-system"><strong>UI → CI/CD</strong><span>ALIFA ownership<br/>Storefront, admin & deployment</span></a></div>
      <section className="page-width section" id="work" data-section>
        <Label index="01">Selected engineering work</Label>
        <div className="project-heading"><div><p className="project-client">ALIFA / E-commerce</p><h2>Beyond the<br/>storefront.</h2></div><div className="project-intro"><p>A considered shopping experience is only one part of a commerce product. I built the React website, its custom Payload admin CMS, integrations and the release setup.</p><p className="role-line">My role — Full-stack designer & developer</p></div></div>
        <a className="commerce-preview" href={alifa.links.live} target="_blank" rel="noreferrer" aria-label="Visit ALIFA live website"><div className="browser-chrome"><span className="browser-dots" aria-hidden="true">● ● ●</span><span>alifa.ae</span><Arrow/></div><img src={alifa.media[0].src} alt="ALIFA's editorial collection storefront" width="1440" height="1000" loading="lazy"/><span className="image-link">Explore the live website <Arrow/></span></a>
        <div className="system-explainer" id="alifa-system"><div><p className="small-label">Three layers. One owner.</p><div className="system-steps" role="group" aria-label="Explore ALIFA engineering contributions">{layers.map((l,i) => <button key={l.label} onClick={() => setLayer(i)} aria-pressed={layer === i} aria-controls="layer-detail"><span className="step-number">0{i+1}</span><span><strong>{l.label}</strong><small>{l.tech}</small></span><span className="step-arrow" aria-hidden="true">→</span></button>)}</div></div><div className="layer-detail" id="layer-detail" aria-live="polite" key={layer}><p className="small-label">{layers[layer].scope}</p><h3>{layers[layer].title}</h3><p>{layers[layer].text}</p><a className="text-link" href={alifa.links.live} target="_blank" rel="noreferrer">Visit ALIFA <Arrow/></a></div></div>
        <p className="caption">Public storefront shown. Ownership was transferred to the agency; the live site may have evolved since handover.</p>
      </section>
      <section className="page-width section client-section" id="clients"><div className="section-heading"><div><Label index="02">More shipped work</Label><h2>Different briefs.<br/>The same ownership.</h2></div><p>Four more React websites, with responsibility for design, development, launch and agency handover.</p></div><div className="client-grid">{websites.filter(p => p.id !== 'alifa').map((p,i) => <article className="client-project" key={p.id}><a className="client-image" href={p.links.live} target="_blank" rel="noreferrer"><img src={p.media[0].src} alt={`${p.domain} website`} width="1440" height="1000" loading="lazy"/><span className="client-open" aria-hidden="true">↗</span></a><div className="client-title"><h3><a href={p.links.live} target="_blank" rel="noreferrer">{p.title.split(' — ')[0]}</a></h3><span className="small-label">0{i+2} / React</span></div><p>{clientNotes[p.id]}</p></article>)}</div></section>
      <section className="experience-band" id="experience" data-section><div className="page-width section"><Label index="03">Production engineering</Label><div className="experience-grid"><div><p className="project-client">Cytel / 2022–2025</p><h2>Where correctness<br/>is part of<br/>the experience.</h2><p className="experience-lede">Before independent client work, I spent three years building software for clinical trial studies.</p><p className="role-line">Software Development Engineer · R&D</p><a className="text-link" href={localUrl('/developer-resume.pdf')} download>Read my experience <Arrow/></a></div><div className="engineering-notes"><article><span className="small-label">01 / Product modernization</span><h3>From legacy software to a modern interface.</h3><div className="migration" aria-label="Migration from C++, C# and XML to React, C++, JSON and Azure"><div><small>Existing product</small><span>C++ · C# · XML</span></div><span className="migration-arrow" aria-hidden="true">↓</span><div><small>Migration contribution</small><span>React · C++ · JSON · Azure</span></div></div></article><article><span className="small-label">02 / Domain & quality</span><p>Implemented C++ mathematical models and worked with statisticians on trial simulation, chart design and UI improvements.</p><div className="coverage"><strong>90<span>%</span></strong><p>Code coverage in single-arm survival study development.</p></div></article></div></div><p className="caption">Professional product work. Proprietary code and clinical data are not part of this portfolio.</p></div></section>
      <section className="page-width section" id="experiments" data-section><div className="section-heading"><div><Label index="04">Interactive engineering</Label><h2>Don't just look.<br/>Try it.</h2></div><p>Public browser projects you can use and inspect. Interface state, rendering and live interaction, working together.</p></div>
        {demos.map((d,i) => <article className={`demo-project demo-project--${i}`} key={d.id}><button className="demo-image" onClick={() => setDemo(d)} aria-label={`Try ${d.type}`}><img src={d.project.media[0].src} alt={d.project.media[0].caption} loading="lazy" width="1600" height="900"/><span>Launch interactive preview <span aria-hidden="true">↗</span></span></button><div className="demo-copy"><p className="small-label">{d.type}</p><h3>{d.title}</h3><p>{d.detail}</p><ul>{d.points.map(p => <li key={p}>{p}</li>)}</ul><div className="actions"><button className="button" onClick={() => setDemo(d)}>Try the demo <Arrow/></button><a className="text-link" href={`https://github.com/notreallyzoh/site/blob/master/${d.source}`} target="_blank" rel="noreferrer">Read the source <Arrow/></a></div><p className="caption">{d.limitation}</p></div></article>)}
      </section>
      <section className="page-width section about-section"><Label index="05">How I work</Label><div className="about-grid"><h2>Design sensitivity.<br/>Engineering depth.</h2><div><p>I move between interface design and implementation: making the interaction understandable, building the underlying behaviour, and following it through delivery.</p><p>My creative technology practice adds a different perspective—real-time visuals, interaction and motion. It keeps me attentive to how software feels in use.</p><div className="capability-list"><p><strong>Interfaces</strong><span>React, TypeScript, JavaScript, HTML, CSS, Figma</span></p><p><strong>Systems</strong><span>C++, Python, Payload CMS, Git, CI/CD, Azure</span></p><p><strong>Interaction</strong><span>GSAP, Three.js, Canvas, creative automation</span></p></div></div></div></section>
      <section className="contact-section" id="contact" data-section><div className="page-width section"><Label index="06">Start a conversation</Label><h2>Let's build<br/><span>what's next.</span></h2><div className="contact-bottom"><div><p>Open to frontend & full-stack opportunities.<br/>Based in Bengaluru. Open to remote work & relocation.</p><a className="contact-email" href={`mailto:${PERSONAL.email}`}>{PERSONAL.email} <Arrow/></a><button className="copy-email" onClick={copy}>Copy email</button><span className="copy-status" role="status">{copied}</span></div><div className="contact-links"><a href={localUrl('/developer-resume.pdf')} download>Download résumé <Arrow/></a><a href={PERSONAL.linkedin}>LinkedIn <Arrow/></a><a href={`https://github.com/${PERSONAL.github}`}>GitHub <Arrow/></a><a href={localUrl('/')}>Creative technology portfolio <Arrow/></a></div></div></div></section>
    </main>
    <footer className="page-width footer"><span>Zoheb Mamoo / Built with React & Three.js</span><a href="https://github.com/HamishMW/portfolio" target="_blank" rel="noreferrer">Design inspiration: Hamish Williams ↗</a><a href="#top">Back to top ↑</a></footer>
    {demo && <DemoDialog demo={demo} close={() => setDemo(null)}/>}
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><DeveloperPortfolio/></StrictMode>);
