import { withBase } from './paths';

export const PERSONAL = {
  name: '@notreallyzoh',
  fullName: 'Zoheb Mamoo',
  tagline: 'New Media Artist & Creative Technologist',
  email: 'notreallyzoh@gmail.com',
  github: 'notreallyzoh',
  linkedin: 'https://www.linkedin.com/in/zoheb-mamoo/',
  bio: [
    'Blurring the boundaries between art, code, and interaction.',
    'New media artist and creative technologist exploring immersive storytelling through projection mapping, generative visuals, real-time systems, and interactive installations.',
    'Building site-specific experiences, VJ sets, sculptural pieces, and reactive environments at the intersection of digital expression and physical experience.',
  ],
  longBio: 'Exhibitions at festivals like Zensciences and 1/0 in Bangalore, installations for Shroomsabha, Bloom in Green, Lay Festival, and Grounddown. VJ/Live Visual Artist for music IPs. Background as a Software Engineer with expertise in web development, C++, and mathematical engines. Led a college robotics team building underwater and maze-solving robots.',
};

export const TECH_STACK = [
  { cat: 'Development', icon: '💻', tools: ['React','C++','Python','GSAP','Node.js','Figma','UI/UX'] },
  { cat: 'Visual & Immersive', icon: '🎛', tools: ['TouchDesigner','MadMapper','Resolume','GLSL','WebGL'] },
  { cat: '3D & Fabrication', icon: '🎨', tools: ['Blender','Tinkercad','Bambu Studio','Adobe Suite','Pen Plotting','3D Printing'] },
  { cat: 'Audio & Generative', icon: '🎧', tools: ['Sonic Pi','VCV Rack','MIDI Systems'] },
  { cat: 'Hardware & Sensing', icon: '📡', tools: ['Arduino','Raspberry Pi','Azure Kinect','OSC'] },
];

export const EXPERIENCES = [
  {
    id: 'newmedia', role: 'Creative Technologist & Independent New Media Artist', company: 'Adaline & Self-Directed Practice', type: 'Remote / Bangalore',
    period: 'Jun 2025 — Present',
    desc: 'Building immersive experiences and mentoring interdisciplinary teams across creative computing, generative art and real-time audiovisual systems.',
    highlights: [
      'Technical mentorship in TouchDesigner, Python and real-time audiovisual systems',
      'Interactive experiences for cultural institutions, festivals and live performance',
      'Hands-on workshops in creative computing and generative art',
    ],
    skills: ['TouchDesigner','3D Printing','GLSL','Projection Mapping','Arduino'],
  },
  {
    id: 'cytel', role: 'Software Development Engineer (R&D)', company: 'Cytel', type: 'Chennai',
    period: 'Jun 2022 — Jun 2025',
    desc: 'Built statistical models and clinical trial design systems for East Desktop, Solara and the Cytel Innovation Center.',
    highlights: [
      'Production systems in C++, React and Python, with Azure cloud infrastructure and performance benchmarking',
      'Migrated legacy C++/C#/XML software to React, C++ and Azure',
      'Delivered production code with 90%+ test coverage in complex R&D environments',
      'Collaborated with statisticians, data scientists and product managers on trial simulation systems',
    ],
    skills: ['C++','React','R&D','Azure','Statistical Models','Figma'],
  },
];

export const CATEGORIES = [
  { id: 'websites', label: 'Websites & Commerce', icon: '↗' },
  { id: 'installations', label: 'Installations', icon: '◈' },
  { id: 'vj', label: 'VJ / Live', icon: '◉' },
  { id: 'design', label: 'Design & Dev', icon: '◆' },
  { id: 'explorations', label: 'Explorations', icon: '◎' },
];

export const PROJECTS = [
  ...[
    { id: 'alifa', title: 'ALIFA — An editorial storefront', domain: 'alifa.ae', kind: 'Fashion · E-commerce', desc: 'A restrained, editorial storefront for a Dubai modestwear label. Limited collections, product discovery and brand storytelling share one visual language.', features: ['Collection browsing', 'Product detail pages', 'Editorial commerce'], story: 'A collection-led shopping experience that gives the clothing room to speak. The site connects campaign imagery, a browsable collection and individual product pages with the practical information shoppers need.' },
    { id: 'bzfitness', title: 'BZ Fitness — From equipment to enquiry', domain: 'bzfitness.com', kind: 'B2B · Catalogue & quotes', desc: 'A commercial gym equipment catalogue with quote-building and gym-planning journeys, helping buyers move from individual machines to a complete equipment list.', features: ['Equipment catalogue', 'Quote building', 'Gym planning'], story: 'A B2B buying journey built around the way gyms source equipment. Visitors can explore machine series and ready-made packages, assemble a quote list or start with a gym-planning enquiry.' },
    { id: 'nexsteg', title: 'NEXSTEG — A fitness brand in motion', domain: 'nexsteg.com', kind: 'Fitness · Brand website', desc: 'A bold, motion-led website for a Kuwait fitness brand, connecting its training, coaches and membership story with a direct route to joining.', features: ['Responsive design', 'Motion & interaction', 'Membership enquiries'], story: 'Large typography and movement bring the gym’s identity onto the screen. The site structures training, coaches, membership and visiting information around a clear invitation to join the community.' },
    { id: 'rocafuels', title: 'Roca Fuels — A useful stop online', domain: 'rocafuels.com', kind: 'Local business · Service website', desc: 'A service-focused website for a highway fuel station: directions, amenities, fleet enquiries and customer feedback, organised around what visitors need on the road.', features: ['Wayfinding', 'Fleet enquiries', 'Customer feedback'], story: 'A practical digital front door for the Pavangad station. The experience makes directions and contact options easy to reach, explains on-site services and supports both fleet enquiries and detailed customer feedback.' },
    { id: 'adaline', title: 'Adaline — A studio’s digital presence', domain: 'myadaline.com', kind: 'Agency · Portfolio website', desc: 'A motion-rich agency website bringing selected work, case studies, services and new-project enquiries into a cohesive studio presence.', features: ['Case study system', 'Motion & interaction', 'Project enquiries'], story: 'An expressive home for the agency’s work, with a portfolio index, detailed case studies and service pages. The website design connects the studio’s visual character to a clear route for prospective clients to get in touch. Work featured within the agency’s portfolio belongs to its respective teams.' },
  ].map(site => ({
    ...site, category: 'websites', year: 'Live', showcase: true, presentation: 'website', showcaseLabel: site.kind,
    role: 'Freelance full-stack designer & developer',
    techLabel: 'PROJECT SCOPE', tech: site.features,
    media: [{ type: 'image', src: `/media/websites/${site.id}-desktop.jpg`, caption: `${site.domain} — live website captured October 2026` }],
    longDesc: [
      { heading: 'The experience', text: site.story },
      { heading: 'My contribution', text: 'End-to-end freelance design and full-stack development, including setup, launch and maintenance during the engagement. Ownership was subsequently transferred to the agency I was working with.' },
      { heading: 'Live site', text: 'This preview documents the public website. The agency now owns the project, and the live version may evolve after handover.' },
    ],
    links: { live: `https://${site.domain}/` },
  })),
  {
    id: 'shroom-sabha', title: 'Shroom Sabha — A festival in your pocket', category: 'design', year: '2026',
    showcase: true,
    desc: 'An interactive farm map and festival companion for Shroom Sabha. Find your next session, navigate the grounds, and grow a personal mycelium network as you explore.',
    tech: ['JavaScript', 'Three.js', 'p5.js', 'Offline PWA', 'Generative Art'],
    media: [
      { type: 'image', src: '/media/shroom-sabha/map.png', caption: 'The living farm map — original Three.js terrain and venue markers' },
      { type: 'image', src: '/media/shroom-sabha/schedule.png', caption: 'Three days of sessions, with search and personal bookmarks' },
      { type: 'image', src: '/media/shroom-sabha/mycelium.png', caption: 'My Sabha — example progress from exploring the preview' },
      { type: 'image', src: '/media/shroom-sabha/care.png', caption: 'Care and wayfinding — contact details masked in the demo' },
    ],
    longDesc: [
      { heading: 'A companion for the farm', text: 'Built for Shroom Sabha, 4–6 September 2026 at Varanashi Organic Farms in Karnataka. The guide brings the festival programme, venues, amenities and care information into one mobile interface, designed for a place where signal and battery cannot be taken for granted.' },
      { heading: 'A map you can explore', text: 'A custom Three.js farm rises out of terrain data, with buildings, trees, water and selectable venue markers. Visitors can rotate the scene, switch to a top-down view, filter layers and find food, water, toilets and workshop spaces. A lighter p5.js renderer provides a fallback for less capable devices.' },
      { heading: 'Make the programme your own', text: 'Search sessions, hosts and places across the three-day programme. Star sessions into My Sabha, see overlapping picks, keep personal notes and export a calendar. The original guide includes in-app reminders while it is open.' },
      { heading: 'Exploration becomes a living keepsake', text: 'Venue stamps and session check-ins feed a procedurally drawn mycelium network. Exploration unlocks ranks and badges, and visitors can export their own spore print. Progress stays on the device, without an account.' },
      { heading: 'Practical care, close at hand', text: 'The Care panel brings together first-aid and crew contacts, location sharing, amenity shortcuts, an amber torch and a remembered place to sleep. The source includes GPS positioning and bearing guidance; farm calibration is still absent from this source snapshot, so that part is not presented as working navigation in the preview.' },
      { heading: 'Built for low connectivity', text: 'The original app uses a service worker, local assets and device storage to support offline use, alongside night mode and battery-saving controls. This portfolio edition preserves the map and game interactions while disabling installation, GPS and real contact actions. It is an archived demo, not a current festival guide.' },
    ],
    links: { preview: '/showcases/shroom-sabha/index.html' },
    featured: true,
  },
  {
    id: 'hirist-techground', title: 'hirist techground — From identity to experience', category: 'installations', year: '2026',
    showcase: true,
    showcaseLabel: 'Identity & experience design · Visual direction',
    highlightRole: true,
    presentation: 'portrait',
    desc: 'Curation, visual direction and sculpture projection mapping for the first hirist techground. A visual world carried from Illustrator and After Effects into print, motion and the physical event.',
    role: 'Event curation & experience design · Visual direction · Identity applications, print & motion · Custom AI / Adobe CC workflows · Sculpture projection mapping',
    event: { name: '19 September 2026 · Concept01, Bangalore', url: 'https://www.instagram.com/p/Debf03VoOCz/' },
    client: { name: 'hirist.tech', url: 'https://www.hirist.tech/' },
    tech: ['Adobe Illustrator', 'After Effects', 'Custom AI Workflows', 'Projection Mapping', 'Print & Motion Design'],
    media: [
      { type: 'image', src: '/media/techground/01_Curiosity-made-tangible_STILL.jpg', label: 'The experience', caption: 'The first hirist techground — event identity and the illuminated sculpture' },
      { type: 'image', src: '/media/techground/thg-monogram.png', label: 'THG mark', caption: 'Identity design study — Crystal Circuit THG monogram and refined construction' },
      { type: 'image', src: '/media/techground/thg-applications.png', label: 'Mark applications', caption: 'Identity design board — THG refinement and applications' },
      { type: 'image', src: '/media/techground/takeaway-identity-board.jpg', label: 'Takeaway system', caption: 'Identity application board — cards, field notes, name badges and role bands' },
      { type: 'image', src: '/media/techground/access-bands.png', label: 'Role bands', caption: 'Print design board — Crew, Artist and Explorer access bands' },
      { type: 'image', src: '/media/techground/access-band-concept.jpg', label: 'Band mockup', caption: 'Access-band concept mockup — identity and pattern applications, not event photography' },
      { type: 'image', src: '/media/techground/photo-keepsake-concept.jpg', label: 'Keepsake mockup', caption: 'Photobooth keepsake concept mockup — branded photo frames and strips' },
      { type: 'image', src: '/media/techground/entrance-concept.jpg', label: 'Arrival concept', caption: 'Entrance concept visual — proposed branding and arrival experience' },
      { type: 'image', src: '/media/techground/spatial-concept.jpg', label: 'Spatial concept', caption: 'Spatial concept visual — proposed event layout, signage and screen environment' },
      { type: 'image', src: '/media/techground/tabletop-system.png', label: 'Participation kit', caption: 'Tabletop print design board — experience signs, registration and photobooth applications' },
      { type: 'image', src: '/media/techground/led-system.png', label: 'LED compositions', caption: 'LED design-review board — seven vertical compositions for a connected screen environment' },
      { type: 'video', src: '/media/techground/05_Light-becomes-space_MOTION.mp4', label: 'Sculpture in motion', caption: 'Light becomes space — projection mapping on the sculpture, from the event carousel' },
      { type: 'image', src: '/media/techground/02_Arrival_STILL.jpg', label: 'Arrival', caption: 'The identity in the venue — entrance graphics and the arrival experience' },
      { type: 'image', src: '/media/techground/campaign-poster.png', label: 'Campaign artwork', caption: 'Campaign artwork from the editable design library' },
      { type: 'image', src: '/media/techground/living-canvas-sign.png', label: 'Print system', caption: 'A5 Living Canvas activity sign — one application of the print system' },
      { type: 'image', src: '/media/techground/projection-design-proof.png', label: 'Environment design', caption: 'Projection-mapping environmental artwork — 1:10 design proof from the production library' },
      { type: 'video', src: '/media/techground/03_Interactive-wall_MOTION.mp4', label: 'Interactive wall', caption: 'The interactive wall — part of the wider event experience created with the installation team' },
      { type: 'image', src: '/media/techground/04_Common-ground_STILL.jpg', label: 'Common ground', caption: 'People, participation and conversation inside the Techground' },
      { type: 'image', src: '/media/techground/08_Built-together_STILL.jpg', label: 'Built together', caption: 'Event collaborators and credits from the original carousel' },
    ],
    longDesc: [
      { heading: 'Curating the experience', text: 'The first hirist techground brought engineers together at Concept01 in Bangalore for play, conversation and collective stillness. My role spanned curation, event flow and creative technology: shaping how people moved between the experiences and how the room felt as a whole.' },
      { heading: 'A visual language across the room', text: 'I led the visual direction, developing the event’s identity into a connected family of campaign artwork, wayfinding, activity signs, print pieces and screen content. The design system explored mineral forms, circuits and patterns, with the THG mark providing a consistent signature across formats.' },
      { heading: 'Adobe CC × custom AI workflows', text: 'I worked directly in Adobe Illustrator and After Effects, using custom AI workflows I built to develop the artwork and meet the event’s varied design and print requirements. The editable library carries the system across identity assets, tabletop activities, access bands, environmental graphics and LED compositions, with format-specific sizes and production notes.' },
      { heading: 'From a surface to a sculpture', text: 'Alongside the event’s visual system, I projection-mapped the sculpture, bringing moving imagery onto its physical form. The event footage shows the mapped sculpture in context with the surrounding screen content and lighting. The sculpture itself was created by Sumedha, Wafa, Fadi and their team.' },
      { heading: 'Design work and event documentation', text: 'The expanded selection traces the THG mark into access bands, keepsakes, field notes, tabletop signs and LED compositions. Entrance and spatial visuals show concepts for the room, labelled separately from event documentation. The linked identity and motion gallery includes animated mark studies, the motion repertoire and editable production files.' },
    ],
    credits: [
      { role: 'Brand direction & strategy', names: 'Natasha Sengathir' },
      { role: 'Production partner', names: 'MIND Manifesting Machines' },
      { role: 'Interactive installations', names: 'Jishnu, Allen & Zoh' },
      { role: 'Sculpture', names: 'Sumedha (@stateofmolt), Wafa, Fadi & team' },
      { role: 'Sound design', names: 'Allen (CRSPY)' },
      { role: 'A/V tech', names: 'Shashank Vagga' },
      { role: 'Quizmaster', names: 'Himadri Banerjee' },
      { role: 'Meditation & breathwork', names: 'Hemanth / Sacredblaez' },
      { role: 'On-ground operations', names: 'Jareer, Davis, Varun, Rajat & community' },
    ],
    links: { gallery: 'https://hirist-techground-motion.pages.dev/gallery/#thg' },
    references: [
      { label: 'Event story on Instagram ↗', url: 'https://www.instagram.com/p/Debf03VoOCz/' },
      { label: 'Watch the hirist reel ↗', url: 'https://www.instagram.com/reel/DdlPCh0sr3w/' },
    ],
    featured: true,
  },
  {
    id: 'signals', title: 'Signals — Ephemeral Tomorrow', category: 'installations', year: '2026',
    showcase: true,
    showcaseLabel: 'Art assistance · Audiovisual installation',
    presentation: 'portrait',
    desc: 'Art assistant for Ephemeral Tomorrow’s Signals in Bangalore. An audiovisual installation that translates bat echolocation into a shifting composition of laser light and sound.',
    role: 'Art assistant',
    event: { name: 'The Sixth Sense · Bangalore · February 2026', url: 'https://www.thesixthsensefestival.com/artech' },
    techLabel: 'PRACTICE',
    tech: ['Art Assistance', 'Audiovisual Installation', 'Light & Sound'],
    media: [
      { type: 'image', src: '/media/signals/installation-2.webp', label: 'Laser composition', caption: 'Signals — installation documentation shared by Ephemeral Tomorrow' },
      { type: 'image', src: '/media/signals/installation-1.jpg', label: 'Light in space', caption: 'A still from Ephemeral Tomorrow’s Signals post — open the original post for footage' },
    ],
    longDesc: [
      { heading: 'Assisting the installation', text: 'I worked as an art assistant for Ephemeral Tomorrow’s Signals in Bangalore, presented at The Sixth Sense. This project forms part of my collaborative practice supporting artists working with light, sound and physical space.' },
      { heading: 'From echolocation to light', text: 'The installation takes ultrasonic bat calls as its source material. The calls shape laser pulses, rhythms and trajectories, creating an evolving composition of light and reflections. Optical modules translate the visual signals back into sound, forming a continuous audiovisual feedback loop.' },
    ],
    creditsLabel: 'Artwork & collaborators',
    credits: [
      { role: 'Artwork', names: 'Ephemeral Tomorrow' },
      { role: 'Art assistance', names: 'Zoheb Mamoo / @notreallyzoh' },
      { role: 'Production collaboration & presentation', names: 'The Sixth Sense' },
      { role: 'Modified laser pointers', names: 'LaserAnimation Sollinger' },
      { role: 'Science consultants', names: 'Rohit Chakravarty & Kartik Chandramouli' },
      { role: 'Documentation source', names: 'Ephemeral Tomorrow’s Instagram post' },
    ],
    references: [{ label: 'View Signals & installation footage ↗', url: 'https://www.instagram.com/p/DX9jY9MF7Xe/' }],
    featured: true,
  },
  {
    id: 'mycelial-stage', title: 'Mycelial Stage — Lostkids Garage × Optikbloom', category: 'vj', year: '2026',
    showcase: true,
    showcaseLabel: 'Visual art collaboration · Live visuals',
    desc: 'A visual art collaboration with Lostkids Garage and Optikbloom at Shroom Sabha. Back-to-back visuals with Optikbloom brought light and movement to a stage built from natural and recycled materials.',
    role: 'Visual art collaboration · Back-to-back live visuals with Optikbloom',
    event: { name: 'Shroom Sabha 2026 · Varanashi Organic Farms', url: 'https://www.instagram.com/p/Dc_AhU_k6vE/' },
    techLabel: 'PRACTICE',
    tech: ['Live Visuals', 'Projection Mapping', 'Visual Art Collaboration'],
    media: [
      { type: 'image', src: '/media/mycelial-stage/stage-2.jpg', label: 'The mapped stage', caption: 'Mycelial stage by Lostkids Garage, with visuals by Optikbloom and Zoh — from Optikbloom’s post' },
      { type: 'image', src: '/media/mycelial-stage/stage-1.jpg', label: 'The gathering', caption: 'The stage in context at Shroom Sabha — music, breathwork and projected visuals' },
    ],
    longDesc: [
      { heading: 'A shared visual performance', text: 'I collaborated with Lostkids Garage and Optikbloom on the mycelial stage at Shroom Sabha, performing back-to-back visuals with Optikbloom. Projected imagery animated the sculptural stage during an ambient set, bringing the visual performance into conversation with the music and the gathering.' },
      { heading: 'A stage grown from its surroundings', text: 'Lostkids Garage conceptualised and created the stage using foraged natural and recycled materials from Varanashi Organic Farms. Its organic forms became the surface for our visual collaboration. Music curation by Alt Spaces, an ambient B2B set by Shiv Hari Shankar and Flux Vortex, and breathwork by Lisha Sinha formed the wider experience.' },
    ],
    creditsLabel: 'Artists & collaborators',
    credits: [
      { role: 'Stage concept & build', names: 'Lostkids Garage' },
      { role: 'Live visuals', names: 'Optikbloom (Sanjana Singh) & Zoh (Zoheb Mamoo)' },
      { role: 'Music curation', names: 'Alt Spaces' },
      { role: 'Ambient set', names: 'Shiv Hari Shankar B2B Flux Vortex' },
      { role: 'Breathwork', names: 'Lisha Sinha' },
      { role: 'Documentation source', names: 'Optikbloom’s Instagram post' },
    ],
    references: [{ label: 'View the collaboration on Instagram ↗', url: 'https://www.instagram.com/p/Dc_AhU_k6vE/' }],
    featured: true,
  },
  {
    id: '1by0', title: '1/0 — New Media Exhibition', category: 'installations', year: '2025',
    presentation: 'portrait',
    desc: 'A collaborative new media exhibition at Node in Bangalore, bringing together interactive installations, generative visuals and audiovisual experiments.',
    role: 'Exhibiting artist · Collaborative new media exhibition',
    event: { name: '1/0 · Node, Bangalore · 2025', url: 'https://www.instagram.com/reel/DO-yBRFAdfv/' },
    tech: ['TouchDesigner','Projection Mapping','Generative Visuals'],
    media: [
      { type: 'video', src: '/media/1by0/reel-DO-yBRFAdfv.mp4', poster: '/media/1by0/reel-DO-yBRFAdfv.jpg', label: 'Exhibition glimpse', caption: 'A glimpse of 1/0 — from Zoh’s exhibition reel, shared with fellow creators' },
      { type: 'video', src: '/media/1by0/reel-DNdVBptP90S.mp4', poster: '/media/1by0/reel-DNdVBptP90S.jpg', label: 'Rained In', caption: 'Rained In — audiovisual work presented at 1/0, documented by @jishnuhasanartpage; reel shared with @sensistan' },
      { type: 'video', src: '/media/1by0/VID_20250729_070100_316.mp4', label: 'Installation study 01', caption: '1/0 — existing installation documentation' },
      { type: 'video', src: '/media/1by0/VID_20250729_075938_425.mp4', label: 'Installation study 02', caption: '1/0 — existing installation documentation' },
    ],
    creditsLabel: 'Exhibition collaborators',
    credits: [
      { role: 'Creators named in Zoh’s exhibition post', names: '@notreallyzoh, @khanakhakejanaa, @jishnuhasanartpage, @bgbgbg77z, @bad__reputation & @akashheb' },
      { role: 'Venue', names: 'Node · @nodeshed.io' },
      { role: 'Rained In documentation', names: '@jishnuhasanartpage; original post linked below' },
    ],
    references: [
      { label: 'Zoh’s original exhibition reel ↗', url: 'https://www.instagram.com/reel/DO-yBRFAdfv/' },
      { label: 'Rained In · original reel & credits ↗', url: 'https://www.instagram.com/reel/DNdVBptP90S/' },
    ],
    featured: true,
  },
  {
    id: 'interlace', title: 'Interlace — A toroidal playground', category: 'explorations', year: 'In progress',
    showcase: true, showcaseLabel: 'Open-source exploration',
    desc: 'An evolving playground for recursive tori, woven geometry and sculptural forms. Shape, orbit and capture the structure in a live browser experiment.',
    role: 'Portfolio adaptation & ongoing exploration',
    tech: ['Three.js', 'WebGL', 'Procedural Geometry', 'JavaScript'],
    media: [{ type: 'image', src: '/media/interlace/preview.jpg', caption: 'Interlace — the live portfolio edition, adapted from Tortoise by nurecas' }],
    longDesc: [
      { heading: 'Geometry as a starting point', text: 'Counter-rotating fibre families form a recursive toroidal structure. Explore nesting, chirality, colour and lighting, or switch to the inherited Phenomenology modes to see the geometry interpreted as sculptural bodies.' },
      { heading: 'An evolving edition', text: 'Interlace is my portfolio edition of the MIT-licensed Tortoise Generator by nurecas. This first iteration introduces a new identity, documentation, portfolio integration and mobile panel adjustments. The underlying mathematical construction, renderer and generation system come from the original project.' },
      { heading: 'Try the playground', text: 'Open the live experiment to orbit and change the structure, export presets or save a reference image. Geometry and captures need no account. Optional Stability AI generation requires your own API key and credits. Desktop and a WebGL2-capable browser are recommended.' },
    ],
    links: { live: '/showcases/interlace/index.html' },
  },
  {
    id: 'spacekayak', title: 'Spacekayak × Product Unconference', category: 'installations', year: '2025',
    desc: 'Interactive LED booth with LiDAR-based multitouch — built in 3 days for Product Unconference 2025, Bangalore.',
    longDesc: [
      { heading: 'The Brief', text: 'Spacekayak, an experiential design agency in Bangalore, approached us to build an interactive booth for Product Unconference 2025 by The Product Folks. We had 3 days from concept to execution.' },
      { heading: 'The Solution', text: 'We built an interactive LED screen displaying rendered animation tiles that showcase the studio\'s aesthetics and work. The key innovation was making it multitouch-capable using a LiDAR sensor and custom blob tracking system.' },
      { heading: 'How It Works', text: 'A LiDAR sensor maps the interaction space. Blob tracking detects multiple touch points on the LiDAR map. This map overlays a custom interface in MadMapper, where different regions are assigned unique alpha values — enabling true multitouch detection. Blobs triggering specific alpha regions fire OSC messages to MadMapper, controlling visuals, audio triggers, and micro-interactions.' },
      { heading: 'The Result', text: 'An interactive tile display that doubles as a musical instrument while being a product showcase. The ability to send OSC triggers to MadMapper after all the logic in TouchDesigner made the rapid 3-day turnaround possible — from concept to complete execution.' },
    ],
    collaborator: { name: '@jishnuhasanartpage', role: 'Co-developer' },
    client: { name: 'Spacekayak', url: 'https://spacekayak.com' },
    event: { name: 'Product Unconference 2025', url: 'https://www.theproductfolks.com/product-unconference-2025' },
    tech: ['TouchDesigner', 'MadMapper', 'LiDAR', 'Blob Tracking', 'OSC', 'Interactive LED'],
    media: [
      { type: 'image', src: '/media/spacekayak/img1.jpg', caption: 'Interactive LED booth at Product Unconference' },
      { type: 'image', src: '/media/spacekayak/img2.jpg', caption: 'TouchDesigner + MadMapper pipeline' },
      { type: 'video', src: '/media/spacekayak/vid1.mp4', caption: 'Multitouch interaction demo' },
      { type: 'video', src: '/media/spacekayak/vid2.mp4', caption: 'Behind the scenes — setup and calibration' },
    ],
    featured: true,
  },
  {
    id: 'pocket-sensor', title: 'Pocket Sensor — Collaborative Gyroscope Canvas', category: 'installations', year: '2025',
    desc: 'Scan a QR code, tilt your phone, paint together on a shared canvas — a real-time collaborative painting experience using gyroscope data.',
    longDesc: [
      { heading: 'The Concept', text: 'What if your phone could become a paintbrush? Pocket Sensor (codename CROSSTALK) turns smartphones into gyroscope controllers for a shared projection canvas. Up to 5 users scan a QR code, connect instantly, and paint together by tilting their phones.' },
      { heading: 'Mushroom Stamps', text: 'Each user receives a unique mushroom-themed stamp — Amanita (spotted caps), Psilocybe (spiral fractals), Chanterelle (fire bolts), Cordyceps (parasitic tendrils), or Morel (honeycomb lattice). Every stamp leaves psychedelic, 3D-layered trails: wide soft glow → colored body → bright core → scattered particles.' },
      { heading: 'Sound Design', text: 'Each stamp has a unique synthesized voice using the Web Audio API — sine waves, sawtooth, square, triangle oscillators with custom filters. Movement speed controls volume, X position controls pitch, Y position sweeps the filter cutoff. When two users\' trails cross, a radiant interaction zone appears on the canvas.' },
      { heading: 'Technical Stack', text: 'Built with Node.js/Express and Socket.IO for real-time WebSocket communication. The phone reads DeviceOrientation API data at ~60fps and streams it to the projector canvas. A custom 2D canvas engine handles multi-layered rendering, permanent trails, and animated cursors. QR code generated server-side for instant join.' },
    ],
    tech: ['Node.js', 'Socket.IO', 'Canvas 2D', 'Web Audio API', 'DeviceOrientation', 'QR Code'],
    media: [
      { type: 'image', src: '/media/pocket-sensor/hero.png', caption: 'Collaborative gyroscope canvas — CROSSTALK' },
    ],
    links: { github: 'https://github.com/notreallyzoh/pocket-sensor' },
    featured: true,
  },
  {
    id: 'vj-live', title: 'Live Visuals & New Media', category: 'vj', categories: ['vj', 'explorations'], year: 'Ongoing',
    desc: 'Live performance and studio experiments in one evolving collection: generative visuals, audio-reactive systems, projection mapping and creative coding.',
    tech: ['Resolume','TouchDesigner','MadMapper','Blender','MIDI','Audio-Reactive','GLSL','Arduino','Generative Art'],
    longDesc: [
      { heading: 'From the studio to the stage', text: 'A collection of live visual performances, projection studies and creative coding experiments. The gallery brings performance documentation and new media explorations together.' },
      { heading: 'Paper, light and form', text: 'Dazed and Confused explores projection on a paper sculpture, modelled in Blender and mapped with MadMapper and TouchDesigner.' },
      { heading: 'Practice as collaboration', text: 'New Media House Jam EP01 documents a visual practice session with @jishnuhasanartpage and @khanakhakejanaa. The Shroom Sabha art-jam experiment combines audience-created UV painting with projection mapping.' },
    ],
    references: [
      { label: 'Dazed and Confused — original post', url: 'https://www.instagram.com/p/DBUUIJATFKB/' },
      { label: 'Watch New Media House Jam EP01', url: 'https://www.instagram.com/reel/DGJjy24Te-I/' },
      { label: 'Watch Shroom Sabha UV art jam', url: 'https://www.instagram.com/reel/DB4Yb4HukZI/' },
    ],
    media: [
      { type: 'image', src: '/media/vj/live-room-MRN01192.jpg', label: 'Live room', caption: 'Live visuals in the room — stage screens, light and audience. Photo supplied from MRN01192.' },
      { type: 'video', src: '/media/vj/DBUUIJATFKB.mp4', poster: '/media/vj/DBUUIJATFKB.jpg', caption: 'Dazed and Confused — paper sculpture and projection mapping' },
      { type: 'image', src: '/media/vj/DGJjy24Te-I.jpg', caption: 'New Media House Jam EP01 — reel cover; watch the original via the link below' },
      { type: 'image', src: '/media/vj/DB4Yb4HukZI.jpg', caption: 'Shroom Sabha UV painting and projection jam — reel cover; watch the original via the link below' },
      { type: 'image', src: '/media/vj/IMG_20250623_004829_964.jpg' },
      { type: 'video', src: '/media/vj/VID-20250407-WA0044.mp4' },
      { type: 'video', src: '/media/vj/VID-20250504-WA0043.mp4' },
      { type: 'video', src: '/media/vj/VID_20250908_015918_938.mp4' },
      { type: 'video', src: '/media/explorations/VID_20250622_135036_320.mp4', caption: 'New media exploration — generative visual study' },
      { type: 'video', src: '/media/explorations/VID_20250622_144606_188.mp4', caption: 'New media exploration — creative coding study' },
    ],
    featured: true,
  },
  {
    id: 'quizzify', title: 'Quizzify — Quiz Platform', category: 'design', year: '2025',
    desc: 'Quiz creation and sharing platform (AI + non-AI). Full UI design and development with Figma, React, and OpenAI API.',
    tech: ['React','Figma','OpenAI API','UI/UX'],
    media: [
      { type: 'image', src: '/media/quizzify/features.png' },
      { type: 'image', src: '/media/quizzify/landing.png' },
      { type: 'image', src: '/media/quizzify/screenshot1.png' },
    ],
    links: { live: 'https://quizzify-pesto.netlify.app/' },
  },
].map(withBase);

export const SOCIALS = [
  { label: 'GitHub', url: 'https://github.com/notreallyzoh', icon: '⟐' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/zoheb-mamoo/', icon: '◈' },
  { label: 'Email', url: 'mailto:notreallyzoh@gmail.com', icon: '✉' },
];

export const ASCII_PORTRAIT = `
        ██████  ██████  ██████
      ██ ◉◉ ██ ◉◉ ██ ◉◉  ██
      ██████  ██████  ████████
    ██░░░░░░░░░░░░░░░░░░░░░░██
   ██░░░░╔══════════════╗░░░░██
   ██░░░░║  ◉  ◉  ◉  ◉ ║░░░░██
   ██░░░░║ ╔══════════╗ ║░░░░██
   ██░░░░║ ║  ██████  ║ ║░░░░██
   ██░░░░║ ║ ██ ●● ██ ║ ║░░░░██
   ██░░░░║ ║  ██████  ║ ║░░░░██
   ██░░░░║ ╚══════════╝ ║░░░░██
   ██░░░░║  ◉  ◉  ◉  ◉ ║░░░░██
   ██░░░░╚══════════════╝░░░░██
    ██░░░░░░░░░░░░░░░░░░░░░░██
     ██░░░░░░██░░░░██░░░░░░██
      ████████  ██  ████████`;
