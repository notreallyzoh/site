import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PROJECTS, PERSONAL } from './data';
import { localUrl } from './paths';
import { EngineeringScene } from './EngineeringScene';
import './Dev.css';

const websites = PROJECTS.filter(p => p.category === 'websites');
const alifa = websites.find(p => p.id === 'alifa');
const layers = [
  { label: 'Interface', tech: 'React storefront', title: 'The React storefront.', text: 'I designed and built the React storefront, including collection browsing and product pages.', scope: 'UI / UX design · Frontend development' },
  { label: 'Operations', tech: 'Payload CMS', title: 'A custom admin CMS.', text: 'I built the e-commerce admin CMS with Payload and added custom integrations for the project.', scope: 'Custom admin CMS · Integrations' },
  { label: 'Delivery', tech: 'Custom server + CI/CD', title: 'Deployment and CI/CD.', text: 'I handled deployment on a custom server, DevOps and CI/CD. After launch, I handed ownership over to the agency.', scope: 'Server deployment · CI/CD · Agency handover' },
];
const clientNotes = {
  bzfitness: 'Equipment discovery, quote building and gym-planning enquiries.',
  nexsteg: 'A fitness website with training information, coach profiles and membership enquiries.',
  rocafuels: 'Service information, directions, fleet enquiries and customer feedback.',
  adaline: 'An agency website with case studies, service pages and project enquiries.',
};
const demos = [
  { id: 'shroom-sabha', title: 'Shroom Sabha festival guide.', type: 'Shroom Sabha / Interactive web app', detail: 'Programme search, bookmarks and exploration progress, connected to an interactive Three.js map.', points: ['State kept on the device', 'Searchable programme & personal bookmarks', 'Three.js map with a lighter p5.js fallback'], limitation: 'Archived preview. GPS, installation and real contact actions are disabled.', source: 'public/showcases/shroom-sabha/index.html' },
  { id: 'interlace', title: 'Interlace visual loop generator.', type: 'Interlace / Browser-based tool', detail: 'A tool I’m developing for live visuals and projection mapping. Adjust a composition, save it, and send it to a separate output window.', points: ['BroadcastChannel output synchronization', 'Validated JSON configuration import', 'PNG & real-time WebM export'], limitation: 'Stage compositions are original; torus mode retains its open-source credits.', source: 'public/showcases/interlace/loops.js' },
  { id: 'pocket-sensor', title: 'Paint together with your phones.', type: 'Pocket Sensor / Collaborative canvas', detail: 'Scan a QR code and tilt your phone to draw on a shared screen. Each person gets a different stamp and sound.', points: ['Node.js and Socket.IO relay phone movement', 'DeviceOrientation input with touch fallback', 'Canvas 2D drawing and Web Audio synthesis'], limitation: 'Requires a running Node.js server and connected phones. Setup instructions are in the repository.', sourceUrl: 'https://github.com/notreallyzoh/pocket-sensor' },
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
          <p className="intro-description">I build websites and web apps with React and TypeScript. Before freelancing, I spent three years at Cytel working on clinical trial software.</p>
          <div className="actions"><a className="button" href="#work">Explore the work <Arrow down/></a><a className="text-link" href={localUrl('/developer-resume.pdf')} download>Download résumé <Arrow/></a></div>
        </div>
        <div className="intro-foot"><span>React / TypeScript / C++ / Creative coding</span><button className="motion-control" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? 'Resume motion' : 'Pause motion'} <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span></button></div>
      </section>
      <div className="proof-strip page-width"><a href="#experience"><strong>03</strong><span>Years at Cytel<br/>Production software & R&D</span></a><a href="#clients"><strong>05</strong><span>Client websites<br/>Design through agency handover</span></a><a href="#alifa-system"><strong>UI → CI/CD</strong><span>My work on ALIFA<br/>Storefront, admin & deployment</span></a></div>
      <section className="page-width section" id="work" data-section>
        <Label index="01">Selected engineering work</Label>
        <div className="project-heading"><div><p className="project-client">ALIFA / E-commerce</p><h2>ALIFA website<br/>& admin CMS.</h2></div><div className="project-intro"><p>For ALIFA, I designed and built the React website and a custom Payload admin CMS. I also handled integrations, deployment and CI/CD on a custom server.</p><p className="role-line">My role — Full-stack designer & developer</p></div></div>
        <a className="commerce-preview" href={alifa.links.live} target="_blank" rel="noreferrer" aria-label="Visit ALIFA live website"><div className="browser-chrome"><span className="browser-dots" aria-hidden="true">● ● ●</span><span>alifa.ae</span><Arrow/></div><img src={alifa.media[0].src} alt="ALIFA's editorial collection storefront" width="1440" height="1000" loading="lazy"/><span className="image-link">Explore the live website <Arrow/></span></a>
        <div className="system-explainer" id="alifa-system"><div><p className="small-label">What I worked on</p><div className="system-steps" role="group" aria-label="Explore ALIFA engineering contributions">{layers.map((l,i) => <button key={l.label} onClick={() => setLayer(i)} aria-pressed={layer === i} aria-controls="layer-detail"><span className="step-number">0{i+1}</span><span><strong>{l.label}</strong><small>{l.tech}</small></span><span className="step-arrow" aria-hidden="true">→</span></button>)}</div></div><div className="layer-detail" id="layer-detail" aria-live="polite" key={layer}><p className="small-label">{layers[layer].scope}</p><h3>{layers[layer].title}</h3><p>{layers[layer].text}</p><a className="text-link" href={alifa.links.live} target="_blank" rel="noreferrer">Visit ALIFA <Arrow/></a></div></div>
        <p className="caption">Public storefront shown. Ownership was transferred to the agency; the live site may have evolved since handover.</p>
      </section>
      <section className="page-width section client-section" id="clients"><div className="section-heading"><div><Label index="02">Other client projects</Label><h2>More websites<br/>I've built.</h2></div><p>I worked on these as a freelance full-stack designer and developer, from the initial design through launch and handover to the agency.</p></div><div className="client-grid">{websites.filter(p => p.id !== 'alifa').map((p,i) => <article className="client-project" key={p.id}><a className="client-image" href={p.links.live} target="_blank" rel="noreferrer"><img src={p.media[0].src} alt={`${p.domain} website`} width="1440" height="1000" loading="lazy"/><span className="client-open" aria-hidden="true">↗</span></a><div className="client-title"><h3><a href={p.links.live} target="_blank" rel="noreferrer">{p.title.split(' — ')[0]}</a></h3><span className="small-label">0{i+2} / React</span></div><p>{clientNotes[p.id]}</p></article>)}</div></section>
      <section className="experience-band" id="experience" data-section><div className="page-width section"><Label index="03">Production engineering</Label><div className="experience-grid"><div><p className="project-client">Cytel / 2022–2025</p><h2>Clinical trial<br/>software at Cytel.</h2><p className="experience-lede">Before independent client work, I spent three years building software for clinical trial studies.</p><p className="role-line">Software Development Engineer · R&D</p><a className="text-link" href={localUrl('/developer-resume.pdf')} download>Read my experience <Arrow/></a></div><div className="engineering-notes"><article><span className="small-label">01 / Product modernization</span><h3>Migrating an existing product.</h3><div className="migration" aria-label="Migration from C++, C# and XML to React, C++, JSON and Azure"><div><small>Existing product</small><span>C++ · C# · XML</span></div><span className="migration-arrow" aria-hidden="true">↓</span><div><small>Migration contribution</small><span>React · C++ · JSON · Azure</span></div></div></article><article><span className="small-label">02 / Domain & quality</span><p>I implemented mathematical models in C++ and worked with statisticians on trial simulations, charts and UI improvements.</p><div className="coverage"><strong>90<span>%</span></strong><p>Code coverage in single-arm survival study development.</p></div></article></div></div><p className="caption">Professional product work. Proprietary code and clinical data are not part of this portfolio.</p></div></section>
      <section className="page-width section" id="studiohq" data-section><div className="section-heading"><div><Label index="04">Custom AI Workflows</Label><h2>StudioHQ.<br/>A console for the work.</h2></div><p>My workspace for agent activity, media pipelines and human review. Previously self-hosted; explore saved work and the console interface.</p></div><article className="demo-project"><a className="demo-image" href={localUrl('/showcases/studiohq/index.html')}><img src={localUrl('/showcases/studiohq/overview.png')} alt="StudioHQ full operations workspace with synthetic sample data" width="1600" height="1000" loading="lazy"/><span>Read the implementation case study ↗</span></a><div className="demo-copy"><p className="small-label">Node.js · JavaScript · FFmpeg · Agent tools</p><h3>Keep tools, tasks and review connected.</h3><p>I built a windowed interface over a Git-backed workspace, with a media canvas, queued build requests and recorded review decisions.</p><a className="text-link" href={localUrl('/showcases/studiohq/index.html')}>Features, architecture &amp; tradeoffs <Arrow/></a><a className="text-link" href={localUrl('/showcases/studiohq/archive/')}>Explore the work archive <Arrow/></a><p className="caption">AI-assisted development. The archive contains edited historical records; the console tour uses labelled sample data.</p></div></article></section>
      <section className="page-width section" id="experiments" data-section><div className="section-heading"><div><Label index="05">Playground</Label><h2>Things I'm<br/>building and trying.</h2></div><p>Some personal projects and experiments. Try the browser demos, or look through the code and setup instructions.</p></div>
        {demos.map((d,i) => {
          const preview = d.project.links.preview || d.project.links.live;
          const source = d.sourceUrl || `https://github.com/notreallyzoh/site/blob/master/${d.source}`;
          const image = <><img src={d.project.media[0].src} alt={d.project.media[0].caption} loading="lazy" width="1600" height="900"/><span>{preview ? 'Open interactive preview' : 'View project on GitHub'} <span aria-hidden="true">↗</span></span></>;
          return <article className={`demo-project demo-project--${i}`} key={d.id} id={`playground-${d.id}`}>
            {preview ? <button className="demo-image" onClick={() => setDemo(d)} aria-label={`Try ${d.type}`}>{image}</button> : <a className="demo-image" href={source} target="_blank" rel="noreferrer" aria-label="View Pocket Sensor on GitHub">{image}</a>}
            <div className="demo-copy"><p className="small-label">{d.type}</p><h3>{d.title}</h3><p>{d.detail}</p><ul>{d.points.map(p => <li key={p}>{p}</li>)}</ul>
              <div className="actions">{preview && <button className="button" onClick={() => setDemo(d)}>Try the demo <Arrow/></button>}<a className={preview ? 'text-link' : 'button'} href={source} target="_blank" rel="noreferrer">{preview ? 'Read the source' : 'Code & setup'} <Arrow/></a></div><p className="caption">{d.limitation}</p>
            </div>
          </article>;
        })}
      </section>
      <section className="page-width section about-section"><Label index="05">How I work</Label><div className="about-grid"><h2>A bit about<br/>how I work.</h2><div><p>I like working on both the design and the code. On freelance projects, that usually means figuring out what the client needs, designing the interface, building it and getting it online.</p><p>I also make visuals for live performances and work on interactive installations. Some of those experiments end up as browser tools, like the projects above.</p><div className="capability-list"><p><strong>Interfaces</strong><span>React, TypeScript, JavaScript, HTML, CSS, Figma</span></p><p><strong>Systems</strong><span>C++, Python, Payload CMS, Git, CI/CD, Azure</span></p><p><strong>Interaction</strong><span>GSAP, Three.js, Canvas, creative automation</span></p></div></div></div></section>
      <section className="contact-section" id="contact" data-section><div className="page-width section"><Label index="06">Start a conversation</Label><h2>Have a role<br/><span>in mind?</span></h2><div className="contact-bottom"><div><p>Open to frontend & full-stack opportunities.<br/>Based in Bengaluru. Open to remote work & relocation.</p><a className="contact-email" href={`mailto:${PERSONAL.email}`}>{PERSONAL.email} <Arrow/></a><button className="copy-email" onClick={copy}>Copy email</button><span className="copy-status" role="status">{copied}</span></div><div className="contact-links"><a href={localUrl('/developer-resume.pdf')} download>Download résumé <Arrow/></a><a href={PERSONAL.linkedin}>LinkedIn <Arrow/></a><a href={`https://github.com/${PERSONAL.github}`}>GitHub <Arrow/></a><a href={localUrl('/')}>Creative technology portfolio <Arrow/></a></div></div></div></section>
    </main>
    <footer className="page-width footer"><span>Zoheb Mamoo / Built with React & Three.js</span><a href="https://github.com/HamishMW/portfolio" target="_blank" rel="noreferrer">Design inspiration: Hamish Williams ↗</a><a href="#top">Back to top ↑</a></footer>
    {demo && <DemoDialog demo={demo} close={() => setDemo(null)}/>}
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><DeveloperPortfolio/></StrictMode>);
