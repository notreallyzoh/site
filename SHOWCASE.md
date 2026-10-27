# Shroom Sabha portfolio edition

Source: `D:\This is Zoh\shroom-sabha-map`, inspected 19 October 2026.
The original project is unchanged.

The featured entry is in `src/data.js`. Screenshots in `public/media/shroom-sabha`
were captured from the running application. My Sabha shows example progress
created by saving a session and stamping a venue in the demo.

`public/showcases/shroom-sabha/index.html` is a standalone, locally served
edition of the original app. It retains its renderer, terrain, programme,
game mechanics, branding, bundled libraries and fonts. Only the public
frontend assets were copied; deployment settings, keys, upload endpoints,
recce tools and editor were excluded.

Preview adaptations:
- A persistent archive/demo notice and portfolio return link.
- A separate local storage key for preview progress.
- Masked contact numbers and intercepted call, SMS, GPS and installation actions.
- Service worker registration disabled (the portfolio cache is untouched).
- No link to the excluded calibration tool.
- Past sessions remain readable; desktop map controls stay clear of the guide rail.

The source has `GEO = null` and `VENUES_CONFIRMED = false`. The case study
describes GPS as implemented but awaiting calibration in this snapshot.
The preview retains the original tentative-venue indicators. Offline support
is described as an original-app feature, not as active in this preview.

Run the portfolio with `npm run dev -- --host 127.0.0.1 --port 5173`.
Open `/#work` for the showcase or `/showcases/shroom-sabha/index.html` for the demo.

# hirist techground

Added as the second featured project, using the user's role description,
the public event caption and the supplied identity gallery:
- https://www.instagram.com/p/Debf03VoOCz/
- https://www.instagram.com/reel/DdlPCh0sr3w/
- https://hirist-techground-motion.pages.dev/gallery/#thg

Event images and clips came from the local
`Downloads/Techground-Carousel-With-Music-Uploads.zip`.
Three design previews came from `Downloads/Hirist-Techground-Editable-Print-Library.zip`.
Original files and archives were not modified. No Instagram media was downloaded.

The local case-study media is in `public/media/techground`. The existing
portrait carousel artwork is shown without cropping, and videos load only
when selected. Environmental artwork is explicitly labelled as a 1:10
design proof. The early Hirisit Proposal was not used as evidence of
delivered activities or attendance. Credits distinguish Zoh's projection
mapping from the sculpture team's authorship.

# Signals and Mycelial Stage

Added from the user's role descriptions and public Instagram documentation:
- Signals by Ephemeral Tomorrow: https://www.instagram.com/p/DX9jY9MF7Xe/
- Lostkids Garage × Optikbloom collaboration: https://www.instagram.com/p/Dc_AhU_k6vE/

At the user's request, two publicly displayed images from each Instagram embed
were saved locally on 22 October 2026. The previews do not depend on an Instagram
login or expiring CDN image links. Original posts remain linked for footage and
source attribution; no clips are presented as locally hosted video.

Replace or extend `public/media/signals` and `public/media/mycelial-stage`, then
update their media arrays in `src/data.js` when higher-resolution local files
are available. Signals uses the portrait installation image as its cover.

Signals credits Zoh as art assistant and Ephemeral Tomorrow as the artwork's
creator. The Sixth Sense programme and Asako Fujimoto's artist news corroborate
the Bangalore presentation in February 2026. Installation behaviour describes
the artwork, not a claim that Zoh developed its software or laser system.

Mycelial Stage credits Lostkids Garage for stage concept/build and Optikbloom
and Zoh for live visuals. Its source caption identifies Shroom Sabha 2026,
Varanashi Organic Farms, and the music and breathwork collaborators. Practice
labels describe the work without inventing software used by the user.

# 1/0 reels

On 23 October 2026, the user supplied two reels for the existing 1/0 entry:
- https://www.instagram.com/reel/DO-yBRFAdfv/ — shared by @notreallyzoh and @khanakhakejanaa
- https://www.instagram.com/reel/DNdVBptP90S/ — shared by @jishnuhasanartpage and @sensistan

Public embed video files and cover images were saved in `public/media/1by0`
under the reel IDs. They are the first two media items; the earlier local clips
remain after them. Attribution identifies the sharing accounts, not assumed
individual production credits. Both original posts are linked in the reader.

# Resume and presentation refresh

The supplied `Zoheb_Mamoo_Resume_1.pdf` replaces `public/resume.pdf` byte for
byte. The previous copy is retained locally in the ignored `.playwright-cli`
folder. Experience titles, employers and dates follow the updated resume.
PDFs are marked binary in `.gitattributes` to preserve their bytes on checkout.

The Rocket Web Labs reference informed hierarchy and micro-interactions.
See `capture/plan.md`, `capture/states.md` and `PARITY.md` for the adapted
direction and checks. The user's projects, images and credits provide the
visual content; no reference brand assets were copied.

## Websites & Commerce — October 2026
Five public website previews: https://alifa.ae/, https://bzfitness.com/, https://nexsteg.com/, https://rocafuels.com/, https://myadaline.com/. Captured in a browser at 1440 x 1000 after loading; local JPEGs in public/media/websites. Descriptions are based on visible public features, with no inferred framework or business performance claims. BZ Fitness is a catalogue/quote workflow, not a payment checkout.
User confirmed end-to-end freelance full-stack design/development, setup and maintenance, followed by agency ownership transfer. Project detail copy records handover; agency portfolio client work is not attributed to Zoheb merely because it appears on the Adaline website. No project completion years inferred from footer dates.


## Live Visuals & New Media — 24 October 2026
Merged the vj-live and new-media entries, preserving all six original media. Added the first exposed carousel video and cover from DBUUIJATFKB, plus covers for DGJjy24Te-I and DB4Yb4HukZI; those reel embeds expose external watch links rather than video. All three original links remain in the gallery. Captions verified via public Instagram captioned embeds: paper sculpture/projection (Blender, MadMapper, TouchDesigner); House Jam EP01 with jishnuhasanartpage and khanakhakejanaa; audience UV painting/projection at Shroom Sabha.
Interlace's portfolio credit block and reference links were removed at user request; original attribution and MIT licence remain in the distributed app and documentation. Browser QA passed for /site/ assets, gallery, order, mobile layout and Interlace geometry/preset/capture. GitHub Pages workflow and DEPLOYMENT.md added; no remote publication performed.


## Techground expansion — 27 October 2026
Added five supplied reference images from D:/Course of the Universe/References, labelled as concepts/mockups or identity application boards rather than documentary photographs. Downloaded five design boards from hirist-techground-motion.pages.dev/gallery/: boards/13-thg-monogram.png, boards/14-thg-directions.png, boards/16-access-bands.png, tabletop-r1/review/20-tabletop-signs.png, led-r1/review/23-led-portrait-system.png. Original gallery link retained for interactive motion and editable files. User role is highlighted above media; existing collaborator credits retained.
Added D:/Stills/MRN01192.JPG as Live Visuals & New Media cover, resized to 2200px JPEG at quality 88 with auto-orientation. No inferred event or photographer credit.

