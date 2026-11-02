# Developer portfolio design

The `/dev/` edition is a separate entry point. The existing creative portfolio and its project URLs remain at `/`.

## Reference and attribution

Design direction evolved from [Hamish Williams' portfolio](https://github.com/HamishMW/portfolio), inspected at commit b7444bc16216f38c64f4afb8d2f53b8c4cbb2bda. The reference informed the side navigation, oversized role introduction, animated geometry and spacious project presentations. Its MIT licence is retained at `public/credits/hamish-williams-MIT.txt`, with visible attribution in the footer. No Hamish project content, branding, device models or shader files are used. React components, styles and the woven Three.js hero are implemented for Zoheb's portfolio.

## Evidence and scope

- ALIFA: user-confirmed React storefront, custom Payload commerce admin, integrations, custom server, DevOps and CI/CD. The interactive breakdown describes responsibility, not an unverified infrastructure topology. The screenshot is the public storefront, not the private CMS.
- Client projects: user-confirmed full-stack ownership and React usage. Do not assign TypeScript or a particular animation library to an individual client without confirmation.
- Cytel: professional C++ clinical-trial modelling, React migration contribution and 90% coverage scoped to single-arm survival study work.
- Demo implementation details are checked against the public showcase source. Keep privacy and licensing limitations visible.

The WebGL hero loads Three.js asynchronously, caps pixel ratio at 1.5, renders at approximately 30 fps and suspends rendering when offscreen or hidden. Reduced motion and a pause control are supported. A static SVG fallback keeps the introduction usable without WebGL. Theme preference uses a developer-page-specific storage key.
