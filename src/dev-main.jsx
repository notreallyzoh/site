import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PROJECTS, PERSONAL } from './data';
import { localUrl } from './paths';
import './Dev.css';

const websites = PROJECTS.filter(p => p.category === 'websites');
const experiments = ['shroom-sabha', 'interlace'].map(id => PROJECTS.find(p => p.id === id));
const contributions = {
  alifa: ['React storefront and a custom e-commerce admin CMS using Payload.', 'Custom integrations, server deployment, DevOps and CI/CD.', 'Full-stack design and development through agency handover.'],
  bzfitness: ['React catalogue interface for commercial fitness equipment.', 'Quote-building and gym-planning enquiry journeys.', 'End-to-end freelance design, development and delivery.'],
  nexsteg: ['React website connecting training, coaches and memberships.', 'Responsive layouts, interaction design and membership enquiries.', 'End-to-end freelance design, development and delivery.'],
  rocafuels: ['React service website for a highway fuel station.', 'Directions, amenities, fleet enquiries and customer feedback.', 'End-to-end freelance design, development and delivery.'],
  adaline: ['React agency website with a portfolio and case-study system.', 'Services, project enquiries and motion-led interactions.', 'Full-stack delivery; featured agency work belongs to its respective teams.'],
};

function DeveloperPortfolio() {
  const [selected, setSelected] = useState('alifa');
  const site = websites.find(p => p.id === selected);
  return <>
    <a className="dev-skip" href="#main">Skip to content</a>
    <header className="dev-nav"><a className="dev-brand" href="#top">Zoheb Mamoo<span>Software engineer / Creative technologist</span></a><nav aria-label="Main navigation"><a href="#work">Work</a><a href="#experience">Experience</a><a href="#contact">Contact</a><a className="dev-other" href={localUrl('/')}>Creative portfolio ↗</a></nav></header>
    <main id="main">
      <section className="dev-hero dev-width" id="top">
        <p className="dev-kicker">Engineering · Interaction · Delivery</p>
        <h1>Built to work.<br/><span>Designed to feel right.</span></h1>
        <div className="dev-intro"><p>I’m Zoheb, a software engineer and creative technologist. I build React interfaces, full-stack websites and interactive tools, with a foundation in production C++ engineering at Cytel.</p><div><p className="dev-location">Bengaluru, India<br/>Open to remote work & relocation</p><a className="dev-button" href="#work">Explore my work <span aria-hidden="true">↓</span></a></div></div>
        <ul className="dev-skills" aria-label="Core technologies">{['React', 'TypeScript', 'JavaScript', 'HTML / CSS', 'Payload CMS', 'C++', 'Git / CI/CD'].map(s => <li key={s}>{s}</li>)}</ul>
      </section>

      <section className="dev-width dev-section" id="work">
        <div className="dev-section-head"><div><p className="dev-kicker">01 / Client work</p><h2>From interface<br/>to deployment.</h2></div><p>Five React-based websites, built as a freelance full-stack designer and developer. Ownership was subsequently transferred to the agency.</p></div>
        <div className="dev-project-picker" role="group" aria-label="Choose a client project">{websites.map((p,i) => <button key={p.id} aria-pressed={selected === p.id} onClick={() => setSelected(p.id)}><small>0{i+1}</small>{p.domain}</button>)}</div>
        <article className="dev-feature" aria-labelledby="client-title">
          <a className="dev-preview" href={site.links.live} target="_blank" rel="noreferrer"><img src={site.media[0].src} alt={`${site.domain} website preview`} width="1440" height="1000"/><span>Visit live website ↗</span></a>
          <div className="dev-feature-copy" aria-live="polite"><p className="dev-kicker">{site.kind}</p><h3 id="client-title">{site.title.split(' — ')[0]}</h3><p>{site.desc}</p><h4>My contribution</h4><ul>{contributions[site.id].map(s => <li key={s}>{s}</li>)}</ul><a className="dev-inline" href={site.links.live} target="_blank" rel="noreferrer">Open {site.domain} ↗</a><p className="dev-fine">Public-site preview. Live content may have changed since handover.</p></div>
        </article>
      </section>

      <section className="dev-experience" id="experience"><div className="dev-width dev-section">
        <div className="dev-section-head"><div><p className="dev-kicker">02 / Engineering experience</p><h2>Complex systems.<br/>Useful interfaces.</h2></div><p>Working across application logic, user experience and the practical details of shipping software.</p></div>
        <article className="dev-role"><div><p className="dev-kicker">2022–2025 / Cytel</p><h3>Software Development<br/>Engineer (R&D)</h3></div><div><p>Developed C++ mathematical models for clinical trial studies and contributed to UI development and product modernization.</p><ul><li>Contributed to migration from C++, C# and XML to React, C++, JSON and Azure.</li><li>Worked with statisticians on trial simulation, chart design and interface improvements.</li><li>Implemented clinical trial designs with 90% code coverage for single-arm survival study work.</li></ul><p className="dev-fine">Professional product work; proprietary source code and customer data are not displayed.</p></div></article>
        <article className="dev-role"><div><p className="dev-kicker">Independent practice</p><h3>Full-stack developer<br/>& creative technologist</h3></div><div><p>Own freelance projects from design through implementation and handover. Work spans React and TypeScript, custom commerce tooling, server delivery and creative automation.</p><ul><li>Built ALIFA’s custom Payload e-commerce admin CMS and integrations, with DevOps and CI/CD on a custom server.</li><li>Used GSAP and Three.js for motion and interactive web experiences.</li><li>Applied agentic AI automation and orchestration to freelance project workflows.</li></ul></div></article>
      </div></section>

      <section className="dev-width dev-section" id="experiments"><div className="dev-section-head"><div><p className="dev-kicker">03 / Interactive software</p><h2>Try the work.</h2></div><p>Browser-based tools that connect interface design with state, rendering and real-world use.</p></div>
        <div className="dev-experiments">{experiments.map(p => <article key={p.id}><a href={p.links.preview || p.links.live}><img src={p.media[0].src} alt={p.media[0].caption} loading="lazy" width="1600" height="900"/></a><h3>{p.id === 'interlace' ? 'Interlace / Visual instrument' : 'Shroom Sabha / Festival companion'}</h3><p>{p.id === 'interlace' ? 'A Canvas-based visual tool with adjustable stage compositions, live energy cues, shared output windows and saved settings.' : 'An interactive festival map with programme search, bookmarks and locally stored exploration progress. Archived demo with location and real contact actions disabled.'}</p><a className="dev-inline" href={p.links.preview || p.links.live}>Launch interactive demo ↗</a></article>)}</div>
      </section>
      <section className="dev-contact dev-width dev-section" id="contact"><p className="dev-kicker">Let’s build something useful</p><h2>Good interfaces start<br/>with a conversation.</h2><a className="dev-email" href={`mailto:${PERSONAL.email}`}>{PERSONAL.email} ↗</a><div className="dev-contact-links"><a href={localUrl('/developer-resume.pdf')} download>Software résumé ↓</a><a href={`https://github.com/${PERSONAL.github}`}>GitHub ↗</a><a href={PERSONAL.linkedin}>LinkedIn ↗</a><a href={localUrl('/')}>Creative technology portfolio ↗</a></div></section>
    </main><footer className="dev-width dev-footer"><span>Zoheb Mamoo · Software & interaction</span><a href="#top">Back to top ↑</a></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><DeveloperPortfolio/></StrictMode>);
