/* ═══════════════════════════════════════════════════════════════════════════
   SHROOM SABHA 2026 — festival data
   India's first fungi festival · Varanashi Organic Farms, Kepu, Karnataka
   4–6 September 2026

   EDITING GUIDE (no build step — save the file, reload the page):

   VENUES    x / y / w / h are normalised 0..1 coordinates on assets/map.webp.
             They were auto-detected from the printed label chips, so they sit
             exactly on the labels. Open the app with ?edit=1 to drag any pin
             and copy fresh numbers to your clipboard.

             A venue with `at: 'other-id'` has no pin of its own — it shares
             the map location of another venue. That is how "The Understory"
             and "Mycelium Grove" share one printed label, and how the Pirate
             Shop lives inside Primordium.

   SESSIONS  Times are ISO 8601 with the +05:30 India offset, so they stay
             correct whatever timezone a phone is set to.
             `venue` must match a venue `id`.
             `venueGuess: true` puts a small "?" chip on the card — clear it
             as venues get confirmed, then set VENUES_CONFIRMED = true.
   ═══════════════════════════════════════════════════════════════════════ */

export const FESTIVAL = {
  name: 'Shroom Sabha',
  year: 2026,
  tagline: 'Celebrate the Magic of Mushrooms',
  billing: "India's first fungi festival",
  place: 'Varanashi Organic Farms',
  address: '4-81, Varanashi Farms, Kepu, Karnataka 574260',
  geo: '12.8496,75.1042', // approximate — used only for the Get Directions link
  about: [
    'A three-day nature, wellness and fungi festival celebrating the magic of mushrooms and the people passionate about them.',
    'Set in a 100-acre biodiverse valley of wild forest, ancient cacao trees and abundant native fungi — mycologists, cultivators, artists, healers, musicians and curious nature lovers, in one place for three days.',
    'More than a festival, Shroom Sabha is a movement to foster fungal literacy and reconnect people with nature.'
  ],
  days: [
    { id: 1, date: '2026-09-04', label: 'Day 1', short: 'Fri 4' },
    { id: 2, date: '2026-09-05', label: 'Day 2', short: 'Sat 5' },
    { id: 3, date: '2026-09-06', label: 'Day 3', short: 'Sun 6' }
  ],
  map: { w: 1280, h: 1280 }   // world units; the farm is drawn, not photographed
};

/* Flip to true once every `venueGuess` below has been checked and cleared. */
export const VENUES_CONFIRMED = false;

/*
 * Where the farm actually is on Earth.
 *
 * Null until someone walks it. Open /recce/ on a phone, stand at four
 * landmarks spread to the corners, and paste the exported block here — every
 * phone then gets the live dot and walking directions for free, with no
 * server and no account. Until then the recce tool keeps its own copy in
 * localStorage, so whoever did the walking can use it immediately.
 */
export const GEO = null;

/*
 * A photograph of each place, taken standing on its own pin during the recce.
 *
 * id -> filename under assets/venues/. Filled in once the recce photos come
 * back; until then the app falls back to whatever the phone captured locally,
 * so whoever did the walking sees their own pictures immediately.
 */
export const VENUE_PHOTOS = {};

/* ─────────────────────────────────────────────────────────────── venues ──
   kind: stage | stay | eat | water | sacred | work | gate | nature
   role: the short human label shown under the name
   ──────────────────────────────────────────────────────────────────────── */

export const VENUES = [
  /* ── the three workshop spaces ──────────────────────────────────────── */
  {
    id: 'understory', name: 'The Understory', role: 'Workshop Area One',
    kind: 'stage', at: 'mycelium-grove', alias: 'Workshop at Rasyana',
    blurb: 'The first workshop space, up at Rasyana. Most of the daytime programme lands here.'
  },
  {
    id: 'under-the-gills', name: 'Under the Gills', role: 'Workshop Area Two',
    kind: 'stage', x: 0.6141, y: 0.3613, w: 0.0906, h: 0.0398, alias: 'The Shed',
    blurb: 'The Shed. Second workshop space by day, and where the music happens after dark.'
  },
  {
    id: 'primordium', name: 'The Primordium', role: 'The Shala',
    kind: 'stage', x: 0.6789, y: 0.7711, w: 0.0766, h: 0.0219, alias: 'Shala',
    blurb: 'The shala — movement, ceremony and the more intimate circles. The Pirate Shop is here too.'
  },
  {
    id: 'shroom-room', name: 'Shroom Room', role: 'Participant Stay',
    kind: 'stay', x: 0.7918, y: 0.6605, w: 0.0773, h: 0.0227,
    blurb: 'Where participants sleep. The largest of the stays, on the east side of the farm.'
  },

  /* ── food, water, shop ──────────────────────────────────────────────── */
  {
    id: 'mycelium-grove', name: 'Mycelium Grove', role: 'Food Area',
    kind: 'eat', x: 0.6469, y: 0.2238, w: 0.0875, h: 0.0367,
    blurb: 'Every meal, all three days. The medical kit and wellness supplies live here too.'
  },
  {
    id: 'the-oasis', name: 'The Oasis', role: 'The Pool',
    kind: 'water', x: 0.5469, y: 0.7211, w: 0.0656, h: 0.0328,
    blurb: 'The pool. Swim Like Mycelium happens here at first light on both mornings.'
  },
  {
    id: 'birds-nest-fungi', name: "Bird's Nest Fungi", role: 'Coffee',
    kind: 'eat', x: 0.4266, y: 0.2172, w: 0.0797, h: 0.0375,
    blurb: 'Coffee. Named for the fungus that uses raindrops to fling spore packets out of its cup.'
  },
  {
    id: 'pirate-shop', name: 'Pirate Shop', role: 'Merch & wares',
    kind: 'eat', at: 'primordium',
    blurb: 'Inside the shala at Primordium.'
  },
  {
    id: 'canteen', name: 'Canteen', role: 'Farm kitchen',
    kind: 'eat', x: 0.2016, y: 0.2027, w: 0.0641, h: 0.0211,
    blurb: "The farm's own kitchen on the west side. Festival meals are up at Mycelium Grove."
  },

  /* ── where you sleep ────────────────────────────────────────────────── */
  {
    id: 'earthstar', name: 'Earthstar', role: 'Mudhouse',
    kind: 'stay', x: 0.5875, y: 0.1395, w: 0.0734, h: 0.0430,
    blurb: 'Mudhouse. The earthstar splits its outer skin open into a star to push its spores out.'
  },
  {
    id: 'bolete', name: 'Bolete', role: 'Mudhouse',
    kind: 'stay', x: 0.6055, y: 0.1543, w: 0.0656, h: 0.0367,
    blurb: 'Mudhouse. Boletes carry pores under the cap instead of gills.'
  },
  {
    id: 'chanterelle', name: 'Chanterelle', role: 'Mudhouse',
    kind: 'stay', x: 0.6461, y: 0.1703, w: 0.1000, h: 0.0219,
    blurb: 'Mudhouse. Chanterelles run false gills — blunt ridges, not blades.'
  },
  {
    id: 'reishi', name: 'Reishi', role: 'Mudhouse',
    kind: 'stay', x: 0.6586, y: 0.1422, w: 0.0641, h: 0.0234,
    blurb: 'Mudhouse. Reishi grows lacquered and shelf-like on hardwood.'
  },
  {
    id: 'coral-fungi', name: 'Coral Fungi', role: 'The Floating House',
    kind: 'stay', x: 0.8172, y: 0.8016, w: 0.1078, h: 0.0328,
    blurb: 'The floating house. Coral fungi branch upward like something that belongs in a reef.'
  },
  {
    id: 'scarlet-elf-cups', name: 'Scarlet Elf Cups', role: 'Stay',
    kind: 'stay', x: 0.5121, y: 0.2340, w: 0.0648, h: 0.0227,
    blurb: 'Bright red cups that fruit on damp fallen wood.'
  },
  {
    id: 'oysterlings', name: 'Oysterlings', role: 'Stay',
    kind: 'stay', x: 0.7844, y: 0.8441, w: 0.0719, h: 0.0320,
    blurb: 'Oyster mushrooms are carnivorous — they trap and digest nematodes.'
  },
  {
    id: 'cordyceps', name: 'Cordyceps', role: 'Crew & Volunteers',
    kind: 'stay', x: 0.9324, y: 0.6816, w: 0.0633, h: 0.0320,
    blurb: 'Crew and volunteer quarters, far east corner by the back gate. Named for the genus that steers insects before fruiting from them.'
  },
  {
    id: 'old-tree-house', name: 'Old Tree House', role: 'Stay',
    kind: 'stay', x: 0.8410, y: 0.5609, w: 0.1055, h: 0.0234,
    blurb: 'Up in the branches on the east edge of the farm.'
  },
  {
    id: 'camp-ground', name: 'Camp Ground', role: 'Camping',
    kind: 'stay', x: 0.7391, y: 0.4453, w: 0.0672, h: 0.0391,
    blurb: 'Pitch your tent among the trees. The wake-up call reaches you here first.'
  },

  /* ── the farm at work ───────────────────────────────────────────────── */
  {
    id: 'main-house', name: 'Main House', role: 'Farm HQ',
    kind: 'work', x: 0.2031, y: 0.4133, w: 0.0859, h: 0.0219,
    blurb: 'The heart of the farm. Ask here if you are lost.'
  },
  {
    id: 'farm-workshop', name: 'Farm Workshop', role: 'Tools & repairs',
    kind: 'work', x: 0.0660, y: 0.4965, w: 0.0664, h: 0.0367,
    blurb: 'The machinery that keeps a hundred acres running.'
  },
  {
    id: 'solar-dryer', name: 'Solar Dryer', role: 'Post-harvest',
    kind: 'work', x: 0.2020, y: 0.5035, w: 0.0836, h: 0.0227,
    blurb: 'Where the harvest is dried down by sunlight alone.'
  },
  {
    id: 'areca-propagation', name: 'Areca Propagation', role: 'Nursery',
    kind: 'work', x: 0.3352, y: 0.4441, w: 0.1297, h: 0.0227,
    blurb: 'Areca palm seedlings raised for planting out.'
  },
  {
    id: 'manure-station', name: 'Manure Station', role: 'Compost',
    kind: 'work', x: 0.3855, y: 0.4043, w: 0.1086, h: 0.0227,
    blurb: 'Compost and farmyard manure — the farm feeding itself. Decay, on purpose.'
  },
  {
    id: 'surya-arka', name: 'Surya Arka Polyhouse', role: 'Solar PV',
    kind: 'work', x: 0.3992, y: 0.3629, w: 0.1094, h: 0.0352,
    blurb: 'Solar panels over a growing house — power and produce off the same roof.'
  },

  /* ── sacred ground & landmarks ──────────────────────────────────────── */
  {
    id: 'temple', name: 'Temple', role: 'Sacred',
    kind: 'sacred', x: 0.3277, y: 0.2082, w: 0.0648, h: 0.0211,
    blurb: 'Please be quiet, and ask before photographing.'
  },
  {
    id: 'raktheshwari', name: 'Raktheshwari Daivi Bana', role: 'Sacred grove',
    kind: 'sacred', x: 0.6140, y: 0.4450,
    blurb: 'A protected sacred grove. Walk the path around it, never through it.'
  },
  {
    id: 'guliga-bhairava', name: 'Guliga & Bhairava Daiva Bana', role: 'Sacred grove',
    kind: 'sacred', x: 0.8910, y: 0.4570,
    blurb: 'Sacred grove on the eastern boundary. Please do not enter.'
  },
  {
    id: 'turtle-pond', name: 'Turtle Pond', role: 'Wildlife',
    kind: 'nature', x: 0.5940, y: 0.5450,
    blurb: 'Small pond below the grove. Look, do not swim.'
  },
  {
    id: 'agroforestry', name: 'Agroforestry Block', role: 'Mixed cropping',
    kind: 'nature', x: 0.4410, y: 0.4570,
    blurb: 'Mixed tree cropping. The Regenerative Farm Walk passes through here.'
  },
  {
    id: 'entry-road', name: 'Entry Road', role: 'Arrival',
    kind: 'gate', x: 0.1040, y: 0.1720,
    blurb: 'The way in. Registration happens here on Day 1 morning.'
  },
  {
    id: 'back-gate', name: 'Back Gate', role: 'East exit',
    kind: 'gate', x: 0.9590, y: 0.7300,
    blurb: 'Eastern exit, out past Cordyceps.'
  }
];

/* ───────────────────────────────────────────────────────────── schedule ──
   kind: meal | ritual | talk | lab | foray | movement | music | film | logistics
   track: 'A' | 'B' for the parallel slots (detected from the printed brochure)
   ──────────────────────────────────────────────────────────────────────── */

const D1 = '2026-09-04', D2 = '2026-09-05', D3 = '2026-09-06';
const t = (d, hm) => `${d}T${hm}:00+05:30`;

export const SESSIONS = [
  /* ═══════════════════════ DAY 1 — Friday 4 September ═══════════════════ */
  { id: 'd1-register', day: 1, start: t(D1, '08:00'), end: t(D1, '11:00'),
    title: 'R&R: Register & Relax', sub: '+ Breakfast', host: null,
    venue: 'entry-road', venueGuess: true, kind: 'logistics',
    blurb: 'Arrive, sign in, drop your bag, eat something. The farm takes it from there.' },

  { id: 'd1-reishi-ceremony', day: 1, start: t(D1, '11:00'), end: t(D1, '12:00'),
    title: 'Reishi Awakening Ceremony', sub: 'with Sound Healing',
    host: 'The Iyashi Experience',
    venue: 'primordium', venueGuess: true, kind: 'ritual',
    blurb: 'The Sabha opens with reishi and sound. Come with nothing to do.' },

  { id: 'd1-finding-voice', day: 1, start: t(D1, '12:00'), end: t(D1, '13:30'),
    title: 'Finding your Voice', host: 'Shilpa and Adi of Folk Voice Lab',
    venue: 'understory', venueGuess: true, kind: 'movement',
    blurb: 'A voice workshop with the Folk Voice Lab. No singing experience needed.' },

  { id: 'd1-lunch', day: 1, start: t(D1, '13:30'), end: t(D1, '14:30'),
    title: 'Lunch', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd1-foragers-guide', day: 1, start: t(D1, '14:30'), end: t(D1, '16:00'),
    title: "The Forager's Guide to the Mycoverse", sub: 'Identification',
    host: 'Hari aka Indian Toadstool',
    venue: 'understory', venueGuess: true, kind: 'talk',
    blurb: 'Learning to actually look. Identification is the difference between a meal and a mistake.' },

  { id: 'd1-tea', day: 1, start: t(D1, '16:00'), end: t(D1, '16:30'),
    title: 'Tea', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd1-do-nothing', day: 1, start: t(D1, '16:30'), end: t(D1, '18:00'),
    title: 'Do-Nothing Mushroom Farming', host: 'Kush of Mycelial Thread',
    venue: 'understory', venueGuess: true, kind: 'lab',
    blurb: 'Growing mushrooms by getting out of their way.' },

  { id: 'd1-demystifying', day: 1, start: t(D1, '18:00'), end: t(D1, '19:00'),
    title: 'Demystifying the Magic', host: 'The Fungamental Co',
    venue: 'understory', venueGuess: true, kind: 'talk',
    blurb: 'Straight answers about the fungi everyone has an opinion about.' },

  { id: 'd1-dinner', day: 1, start: t(D1, '19:00'), end: t(D1, '20:00'),
    title: 'Dinner', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd1-folk-circle', day: 1, start: t(D1, '20:00'), end: t(D1, '21:00'),
    title: 'Folk Voice Circle', host: 'Shilpa and Adi of Folk Voice Lab',
    venue: 'under-the-gills', venueGuess: true, kind: 'music',
    blurb: 'Everyone sings. That is the whole plan.' },

  { id: 'd1-movie', day: 1, start: t(D1, '21:00'), end: t(D1, '22:00'),
    title: 'Stories from the Underground', sub: 'Movie Night',
    host: 'All Living Things Environmental Film Festival',
    venue: 'under-the-gills', venueGuess: true, kind: 'film',
    blurb: 'Films from under the forest floor. Bring something warm.' },

  /* ═══════════════════════ DAY 2 — Saturday 5 September ═════════════════ */
  { id: 'd2-wakeup', day: 2, start: t(D2, '06:00'), end: t(D2, '06:30'),
    title: 'Wake Up Call + Morning Tea',
    venue: 'camp-ground', venueGuess: true, kind: 'logistics',
    blurb: 'The farm wakes you. Tea is already on.' },

  { id: 'd2-yoga', day: 2, start: t(D2, '07:00'), end: t(D2, '08:00'), track: 'A',
    title: 'Breath of the Forest', sub: 'Yoga Flow', host: 'Hemanth Hegde',
    venue: 'primordium', venueGuess: true, kind: 'movement',
    blurb: 'Morning flow, with the forest breathing alongside you.' },
  { id: 'd2-swim', day: 2, start: t(D2, '07:00'), end: t(D2, '08:00'), track: 'B',
    title: 'Swim Like Mycelium', host: 'Partha Varanashi',
    venue: 'the-oasis', kind: 'movement',
    blurb: 'Water, first thing. Move the way a network moves.' },

  { id: 'd2-breakfast', day: 2, start: t(D2, '08:00'), end: t(D2, '09:00'),
    title: 'Breakfast', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd2-spore-safari', day: 2, start: t(D2, '10:00'), end: t(D2, '13:30'),
    title: 'Spore Safari: A Fungi Foray',
    venue: 'mycelium-grove', venueGuess: true, kind: 'foray',
    blurb: 'Three and a half hours into the forest with your eyes recalibrated. Wear shoes you do not mind ruining.' },

  { id: 'd2-lunch', day: 2, start: t(D2, '13:30'), end: t(D2, '14:30'),
    title: 'Lunch', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd2-spore-to-market', day: 2, start: t(D2, '14:30'), end: t(D2, '15:30'), track: 'A',
    title: 'From Spore to Market', sub: 'Commercial Cultivation Roundtable',
    host: 'Snehal Mane, Sumit Sharan & Namrata Goenka',
    venue: 'understory', venueGuess: true, kind: 'talk',
    blurb: 'What it actually takes to grow mushrooms as a business in India.' },
  { id: 'd2-zine-lab', day: 2, start: t(D2, '14:30'), end: t(D2, '15:30'), track: 'B',
    title: 'Fungal Folklore Zine Lab', host: 'Prithvi & M of Fungi Foundation India',
    venue: 'primordium', kind: 'lab',
    blurb: 'Cut, fold, staple. Make a small paper thing about fungi and folklore.' },

  { id: 'd2-masterchef', day: 2, start: t(D2, '15:30'), end: t(D2, '16:30'),
    title: 'Masterchef: Mycoverse Edition', host: 'Chefs Satish & Manon — OG Mushrooms',
    venue: 'mycelium-grove', venueGuess: true, kind: 'lab',
    blurb: 'Cooking with fungi, at the hands of people who do it properly.' },

  { id: 'd2-tea', day: 2, start: t(D2, '16:30'), end: t(D2, '17:00'),
    title: 'Tea', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd2-psychonaut', day: 2, start: t(D2, '17:00'), end: t(D2, '18:00'),
    title: "Psychonaut's Toolkit for Safe Journeys", host: 'Bala Yeruva',
    venue: 'primordium', kind: 'talk',
    blurb: 'Harm reduction, set and setting, and knowing when not to.' },

  { id: 'd2-listening-lab', day: 2, start: t(D2, '18:00'), end: t(D2, '19:00'), track: 'A',
    title: 'The Mushroom Listening Lab', sub: 'AltSpaces presents', host: 'AltSpaces',
    venue: 'under-the-gills', venueGuess: true, kind: 'music',
    blurb: 'Sound, fungi, and what happens when you wire the two together.' },
  { id: 'd2-primitive-mycology', day: 2, start: t(D2, '18:00'), end: t(D2, '19:00'), track: 'B',
    title: 'Primitive Mycology', sub: 'Forage, Clone, Cultivate',
    venue: 'under-the-gills', venueGuess: true, kind: 'lab',
    blurb: 'The low-tech loop: find it, clone it, grow it again.' },

  { id: 'd2-dinner', day: 2, start: t(D2, '19:00'), end: t(D2, '20:00'),
    title: 'Dinner', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd2-forest-frequencies', day: 2, start: t(D2, '20:00'), end: t(D2, '22:00'),
    title: 'Forest Frequencies', sub: 'by AltSpaces',
    host: 'ShivHari, Flux Vortex & Lisha',
    venue: 'under-the-gills', venueGuess: true, kind: 'music',
    blurb: 'The night set. Three acts, one shed, two hours.' },

  /* ═══════════════════════ DAY 3 — Sunday 6 September ═══════════════════ */
  { id: 'd3-wakeup', day: 3, start: t(D3, '06:00'), end: t(D3, '06:30'),
    title: 'Wake Up Call + Morning Tea',
    venue: 'camp-ground', venueGuess: true, kind: 'logistics' },

  { id: 'd3-flow-arts', day: 3, start: t(D3, '07:00'), end: t(D3, '08:00'), track: 'A',
    title: 'Bodies in the Wind', sub: 'Flow Arts', host: 'Indie Flow',
    venue: 'primordium', venueGuess: true, kind: 'movement',
    blurb: 'Flow arts in the open, before the heat arrives.' },
  { id: 'd3-swim', day: 3, start: t(D3, '07:00'), end: t(D3, '08:00'), track: 'B',
    title: 'Swim Like Mycelium', host: 'Partha Varanashi',
    venue: 'the-oasis', kind: 'movement' },

  { id: 'd3-breakfast', day: 3, start: t(D3, '08:00'), end: t(D3, '09:00'),
    title: 'Breakfast', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd3-spore-safari', day: 3, start: t(D3, '10:00'), end: t(D3, '12:00'), track: 'A',
    title: 'Spore Safari: A Fungi Foray',
    venue: 'mycelium-grove', venueGuess: true, kind: 'foray',
    blurb: 'Second foray. Different eyes, different forest.' },
  { id: 'd3-down-to-basics', day: 3, start: t(D3, '10:00'), end: t(D3, '12:00'), track: 'B',
    title: 'Down to Basics: Mushroom Cultivation', host: 'Vhyom of Myco Vann',
    venue: 'under-the-gills', venueGuess: true, kind: 'lab',
    blurb: 'Substrate, sterility, patience. Start here if you want to grow at home.' },

  { id: 'd3-biotech', day: 3, start: t(D3, '12:00'), end: t(D3, '13:00'), track: 'A',
    title: "India's Mushroom Biotech Revolution", host: 'Dr Yashaswini B.',
    venue: 'understory', venueGuess: true, kind: 'talk',
    blurb: 'Where fungal biotech in India is actually heading.' },
  { id: 'd3-entangled-webs', day: 3, start: t(D3, '12:00'), end: t(D3, '13:30'), track: 'B',
    title: 'Entangled Webs', sub: 'Expression in Movement', host: 'Anishaa Tavag',
    venue: 'primordium', kind: 'movement',
    blurb: 'Moving as a mycelial network rather than as a body.' },

  { id: 'd3-science-in-action', day: 3, start: t(D3, '13:00'), end: t(D3, '13:30'), track: 'A',
    title: 'Science in Action', host: 'The Fungamental Co.',
    venue: 'understory', venueGuess: true, kind: 'talk' },

  { id: 'd3-lunch', day: 3, start: t(D3, '13:30'), end: t(D3, '14:30'),
    title: 'Lunch', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd3-microscopy', day: 3, start: t(D3, '14:30'), end: t(D3, '15:30'), track: 'A',
    title: 'Seeing the Unseen', sub: 'The Art and Science of Microscopy',
    venue: 'understory', venueGuess: true, kind: 'lab',
    blurb: 'Spores, at the scale where identification really happens.' },
  { id: 'd3-farm-walk', day: 3, start: t(D3, '14:30'), end: t(D3, '15:30'), track: 'B',
    title: 'Regenerative Farm Walk', host: 'Partha Varanashi',
    venue: 'main-house', venueGuess: true, kind: 'foray',
    blurb: 'A walk through a hundred acres with the person who grew them.' },

  { id: 'd3-mycoverse-trip', day: 3, start: t(D3, '15:30'), end: t(D3, '16:30'), track: 'A',
    title: 'A Trip Through the Mycoverse', host: 'Mitsu Puri — APC',
    venue: 'understory', venueGuess: true, kind: 'talk' },
  { id: 'd3-keynote', day: 3, start: t(D3, '15:30'), end: t(D3, '16:30'), track: 'B',
    title: 'Spawning a Fungal Future', sub: 'Virtual Keynote', host: 'Marc Violo',
    venue: 'under-the-gills', venueGuess: true, kind: 'talk',
    blurb: 'Beamed in. The wider fungal future, from someone building it.' },

  { id: 'd3-tea', day: 3, start: t(D3, '16:30'), end: t(D3, '17:00'),
    title: 'Tea', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd3-medicinal-bridge', day: 3, start: t(D3, '17:00'), end: t(D3, '18:00'), track: 'A',
    title: 'The Medicinal Bridge', sub: 'Tradition and Science', host: 'Nuvedo',
    venue: 'understory', venueGuess: true, kind: 'talk' },
  { id: 'd3-good-rot', day: 3, start: t(D3, '17:00'), end: t(D3, '18:00'), track: 'B',
    title: 'The Good Rot', sub: 'Fermentation Lab', host: 'Brewcha',
    venue: 'mycelium-grove', venueGuess: true, kind: 'lab',
    blurb: 'Rot, but on purpose. Fermentation as the friendly half of decay.' },

  { id: 'd3-drum-circle', day: 3, start: t(D3, '18:00'), end: t(D3, '19:00'),
    title: 'Beats of the Earth', sub: 'Drum Circle', host: 'Udukku',
    venue: 'under-the-gills', venueGuess: true, kind: 'music' },

  { id: 'd3-dinner', day: 3, start: t(D3, '19:00'), end: t(D3, '20:00'),
    title: 'Dinner', venue: 'mycelium-grove', kind: 'meal' },

  { id: 'd3-masquerade', day: 3, start: t(D3, '20:00'), end: t(D3, '21:00'),
    title: 'Creatures of the Night', sub: 'A Mushroom Masquerade', host: 'ShivHari',
    venue: 'under-the-gills', venueGuess: true, kind: 'music',
    blurb: 'Come as something that fruits in the dark.' },

  { id: 'd3-after-dark', day: 3, start: t(D3, '21:00'), end: t(D3, '22:00'),
    title: 'After Dark', host: 'DJ Gruv',
    venue: 'under-the-gills', venueGuess: true, kind: 'music',
    blurb: 'Last set of the Sabha.' }
];

/* ─────────────────────────────────────────────────────────────── care ──── */

export const CARE = {
  /* Order matters: the first entry is who "Send my location" texts. */
  contacts: [
    { label: 'First Aid — Charleson', detail: 'First-aid certified', tel: 'Demo only',
      urgent: true },
    { label: 'Crew — Vhyom', detail: 'Anything else, any time', tel: 'Demo only',
      urgent: true },
    { label: 'Swimming — Vikas', detail: 'Instructor at the Oasis', tel: 'Demo only' },
    { label: 'Language help', detail: 'Tulu & Kannada, if you get stuck', tel: 'Demo only' }
  ],
  medkit: 'The medical kit and wellness supplies live at Mycelium Grove.',
  sections: [
    {
      title: 'Forage with Fungal Ethics',
      lines: [
        'The forest belongs to all creatures. Take from it only what we need.',
        'Leave young mushrooms to grow.',
        'Leave solitary mushrooms to spread their spores.',
        'Take a few, leave plenty.',
        'Tread lightly around their homes and companions.'
      ]
    },
    {
      title: "Don't Know Them? Don't Eat Them",
      danger: true,
      lines: [
        'This diverse fungal landscape also nurtures mushrooms that contain compounds toxic to certain creatures such as humans.',
        'Never eat a wild mushroom unless it has been positively identified by more than one expert forager.'
      ]
    },
    {
      title: 'Take Care of Each Other',
      lines: [
        'Ask before photographing or touching.',
        "Respect people's space and boundaries.",
        'Look out for your fellow shroomsters.',
        'Respect quiet hours after 10:30 PM.',
        'Keep food and fire out of the rooms.',
        'Smoke only in designated smoking areas.'
      ]
    },
    {
      title: 'Community Values',
      lines: [
        'Discrimination, harassment or harmful behaviour of any kind will not be tolerated — including homophobia, transphobia, casteism, racism, sexism, ableism or religious discrimination.',
        'Treat one another with dignity, respect and care.',
        'If you are not comfortable being photographed or filmed, tell the organisers at the start of the event.',
        'Shroom Sabha is an educational festival. Illegal substances are not permitted on or near the premises.'
      ]
    }
  ]
};

/* ───────────────────────────────────────────────────── spores of wisdom ── */

export const SPORES = [
  'A single mushroom cap can release billions of spores. Most land somewhere useless.',
  'Fungi are closer relatives to animals than they are to plants.',
  'Mycelium moves nutrients between trees — sometimes between different species.',
  'The largest known organism on Earth is a honey fungus, spread across several square kilometres.',
  'Fungi do not eat. They digest the world outside themselves, then absorb it.',
  'Lichen is not one organism. It is a fungus farming algae.',
  'Some fungi glow in the dark. Nobody is entirely sure why.',
  'Oyster mushrooms hunt nematodes. Quietly, and without moving.',
  'Spores have been found alive high in the upper atmosphere.',
  'A cubic centimetre of forest soil can hold kilometres of fungal thread.'
];


/* ──────────────────────────────────────────────────────────── amenities ──
   The practical stuff people need at 2am. Positions were read off the
   printed map rather than auto-detected — the icon rings are not distinct
   enough from the tree linework to trust a detector — so treat these as
   close-but-adjustable. Open the app with ?edit=1 to drag any of them and
   copy fresh coordinates.

   type drives the glyph; see AMENITY_KINDS in js/ui.js
   ──────────────────────────────────────────────────────────────────────── */

export const AMENITIES = [
  // ── the top track, by Bird's Nest Fungi / Scarlet Elf Cups ──────────────
  { id: 'wc-north',      type: 'toilet',  x: 0.338, y: 0.279, note: 'Toilets' },
  { id: 'shower-north',  type: 'shower',  x: 0.364, y: 0.279, note: 'Showers' },
  { id: 'tap-north',     type: 'water',   x: 0.389, y: 0.279, note: 'Drinking water' },

  // ── Mycelium Grove: food, and the medical kit ──────────────────────────
  { id: 'wc-grove',      type: 'toilet',  x: 0.628, y: 0.269, note: 'Toilets' },
  { id: 'tap-grove',     type: 'water',   x: 0.660, y: 0.269, note: 'Drinking water' },
  { id: 'food-grove',    type: 'food',    x: 0.692, y: 0.269, note: 'Food — every meal' },
  { id: 'aid-grove',     type: 'firstaid',x: 0.716, y: 0.269, note: 'Medical kit & wellness supplies' },

  // ── the southern cluster, around the Oasis and Shroom Room ─────────────
  { id: 'wc-oasis',      type: 'toilet',  x: 0.594, y: 0.690, note: 'Toilets' },
  { id: 'shower-shroom', type: 'shower',  x: 0.706, y: 0.681, note: 'Showers' },
  { id: 'wc-shroom',     type: 'toilet',  x: 0.712, y: 0.700, note: 'Toilets' },
  { id: 'tap-shroom',    type: 'water',   x: 0.818, y: 0.696, note: 'Drinking water' },
  { id: 'play-shroom',   type: 'sport',   x: 0.845, y: 0.696, note: 'Games & recreation' },
  { id: 'run-shroom',    type: 'sport',   x: 0.870, y: 0.696, note: 'Running / activity' },

  // ── the rest of the working farm ───────────────────────────────────────
  { id: 'swim-north',    type: 'swim',    x: 0.146, y: 0.137, note: 'Water body' },
  { id: 'swim-mid',      type: 'swim',    x: 0.722, y: 0.522, note: 'Water body' },
  { id: 'bees-east',     type: 'bees',    x: 0.952, y: 0.637, note: 'Bee hives — give them room' },
  { id: 'bees-south',    type: 'bees',    x: 0.618, y: 0.800, note: 'Bee hives — give them room' },
  { id: 'cattle',        type: 'cattle',  x: 0.067, y: 0.400, note: 'Cattle' },
  { id: 'recycle',       type: 'recycle', x: 0.248, y: 0.375, note: 'Waste & recycling' },
  { id: 'nursery',       type: 'plant',   x: 0.478, y: 0.399, note: 'Nursery' },
  { id: 'agro',          type: 'plant',   x: 0.434, y: 0.470, note: 'Agroforestry block' }
];

/* ──────────────────────────────────────────────────────────── lookups ──── */

export const VENUE_BY_ID = Object.fromEntries(VENUES.map(v => [v.id, v]));
export const SESSION_BY_ID = Object.fromEntries(SESSIONS.map(s => [s.id, s]));

/** Resolve a venue to the venue that actually carries a map pin. */
export function pinFor (venue) {
  let v = typeof venue === 'string' ? VENUE_BY_ID[venue] : venue;
  let guard = 0;
  while (v && v.at && guard++ < 5) v = VENUE_BY_ID[v.at];
  return v;
}

/** Venues that own a pin on the map. */
export const PINNED = VENUES.filter(v => typeof v.x === 'number');
