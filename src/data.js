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
    id: 'newmedia', role: 'New Media Developer', company: 'Self-employed', type: 'Hybrid',
    period: 'May 2025 — Present', duration: '11 mos',
    desc: 'Exploring immersive storytelling through projection mapping, generative visuals, real-time systems, and interactive installations.',
    highlights: [
      'Collaborate across disciplines — musicians, VJs, art collectives, tech companies',
      'Build site-specific experiences, VJ sets, sculptural pieces, reactive environments',
      'Exhibited at Zensciences, 1/0, Shroomsabha, Bloom in Green, Lay Festival, Grounddown',
    ],
    skills: ['TouchDesigner','3D Printing','GLSL','Projection Mapping','Arduino'],
  },
  {
    id: 'cytel', role: 'Software Development Engineer (R&D)', company: 'Cytel', type: 'Remote · Full-time',
    period: 'Jun 2022 — May 2025', duration: '3 yrs',
    desc: 'Implemented statistical models and contributed to clinical trial design products.',
    highlights: [
      'Multi Arm Multi Stage Group Sequential Simulation with stakeholders & founders',
      'Single arm Survival studies — 90% code coverage, zero technical debt',
      'Migrated legacy C++/C#/XML product to React, C++, JSON, and Azure Cloud',
      'R&D, chart and simulation design, UI development',
    ],
    skills: ['C++','React','R&D','Azure','Statistical Models','Figma'],
  },
];

export const CATEGORIES = [
  { id: 'installations', label: 'Installations', icon: '◈' },
  { id: 'vj', label: 'VJ / Live', icon: '◉' },
  { id: 'design', label: 'Design & Dev', icon: '◆' },
  { id: 'explorations', label: 'Explorations', icon: '◎' },
];

export const PROJECTS = [
  {
    id: '1by0', title: '1/0 — Art & Technology Festival', category: 'installations', year: '2025',
    desc: 'Interactive installation at 1/0, Bangalore\'s art+tech festival. Projection mapping and generative systems at the intersection of digital media & physical space.',
    tech: ['TouchDesigner','Projection Mapping','Generative Visuals'],
    media: [
      { type: 'video', src: '/media/1by0/VID_20250729_070100_316.mp4' },
      { type: 'video', src: '/media/1by0/VID_20250729_075938_425.mp4' },
    ],
    featured: true,
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
    id: 'vj-live', title: 'VJ / Live Visual Performances', category: 'vj', year: '2025',
    desc: 'Live visual performances for music IPs across Bangalore. Real-time generative visuals, audio-reactive systems, and projection mapping.',
    tech: ['Resolume','TouchDesigner','MIDI','Audio-Reactive'],
    media: [
      { type: 'image', src: '/media/vj/IMG_20250623_004829_964.jpg' },
      { type: 'video', src: '/media/vj/VID-20250407-WA0044.mp4' },
      { type: 'video', src: '/media/vj/VID-20250504-WA0043.mp4' },
      { type: 'video', src: '/media/vj/VID_20250908_015918_938.mp4' },
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
  {
    id: 'new-media', title: 'New Media Explorations', category: 'explorations', year: '2025',
    desc: 'Experimental generative art, interactive installations, and creative coding.',
    tech: ['TouchDesigner','GLSL','Arduino','Generative Art'],
    media: [
      { type: 'video', src: '/media/explorations/VID_20250622_135036_320.mp4' },
      { type: 'video', src: '/media/explorations/VID_20250622_144606_188.mp4' },
    ],
  },
];

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
