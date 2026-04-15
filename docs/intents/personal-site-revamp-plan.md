---
title: "Personal Site Revamp — Phase 1 Plan"
version: 1
created: 2026-04-14
spec: docs/intents/personal-site-revamp.md
---

# Phase 1: React Migration + Homepage Restructure

## Architecture Overview

**Current:** Vanilla HTML/CSS/JS, SPA router, MkDocs-generated writing/lists, nginx static serving.

**Target:** Vite + React + Tailwind SPA producing `dist/`. MkDocs content served as static files alongside React. Same Docker + nginx deployment.

**Key architectural decision:** Hybrid approach. React handles `/`, `/about`, `/experience`, `/writing/` (index), `/lists/` (index). Individual writing articles and list pages stay as MkDocs-generated static HTML served directly by nginx. This avoids re-rendering 73MB+ of content and preserves lunr.js search.

---

## Phase 0: Scaffolding & Toolchain

**Goal:** Vite + React + Tailwind building to `dist/`.

1. Rename `src/` → `src-legacy/` to preserve current site during migration
2. Initialize Vite + React project: `react`, `react-dom`, `react-router-dom` v7, `@vitejs/plugin-react`
3. Install Tailwind v4: `tailwindcss`, `@tailwindcss/vite`
4. Configure `vite.config.ts` — `base: '/'`, `build.outDir: 'dist'`
5. Create root `index.html` (Vite entry point) with Google Fonts, favicon, OG meta, tie-dye preload
6. Create `src/main.tsx`, `src/App.tsx` (minimal)
7. Create `src/index.css` with Tailwind import + theme tokens matching existing CSS vars
8. Update `package.json` scripts: `dev` (po im rrt 420), `build`, `preview`
9. Create `nginx.conf` for SPA fallback + static MkDocs serving
10. Update `Dockerfile` to COPY `dist/` instead of `src/`
11. Update `.gitignore` (add `dist/`, `node_modules/`)

**Validation:** `npm run build` succeeds, `npm run dev` shows blank page with correct title.

---

## Phase 1: Core Layout Shell

**Goal:** Shared layout components every page uses.

```
src/
  components/
    Layout.tsx          — bg image + navbar + content slot + footer
    Navbar.tsx          — tie-dye swirl logo (home) left, about | experience | writing | lists right
    Footer.tsx          — social links (twitter, github, linkedin)
    BackgroundImage.tsx — fixed tie-dye (same technique as current)
```

- `Layout.tsx` wraps all routes via `<Outlet />`
- Content column: `max-w-[680px] mx-auto px-6 pb-[75px]`
- Navbar: flex row, space-between. Left: tie-dye swirl logo (links home). Right: about, experience, writing, lists.
- Footer: right-aligned social links
- BackgroundImage: fixed position, `-z-10`, `h-[200vh]`, `top-[-50vh]`

**Parallelizable with Phase 2.**

---

## Phase 2: MkDocs Content Strategy

**Goal:** All existing writing/lists content accessible at existing URLs.

1. Copy `src-legacy/writing/` and `src-legacy/lists/` to `public/`
2. Update MkDocs themes (`writing_theme/main.html`, `lists_theme/main.html`) to remove old SPA router script
3. Keep `public/css/styles.css` as compatibility layer for MkDocs pages
4. nginx config:
   ```
   location /writing/ { try_files $uri $uri/index.html =404; }
   location /lists/   { try_files $uri $uri/index.html =404; }
   location /         { try_files $uri $uri/ /index.html; }
   ```
5. Navigation bridge: React `<Link>` for index pages, plain `<a>` for individual articles

**Parallelizable with Phase 1.**

---

## Phase 3: Homepage [REQUIRES AARON'S APPROVAL ON CONTENT]

**Goal:** Concise bio + horizontal scrollable project showcase + always-visible photo.

### Proposed layout (top → bottom):
1. **Title:** "aaron williams" + "new york, ny"
2. **Bio + Photo:** concise 2-3 sentence bio on left, photo on right (stacked on mobile, photo VISIBLE)
3. **Project Showcase:** horizontal scroll, 6 cards + "see more" CTA card → `/experience`
4. **Magic Quote:** "as a child i wanted to believe the magic..."
5. **Social Links:** twitter, github, linkedin
6. **Footer**

### Components:
```
src/
  components/
    HeroBio.tsx         — bio left + photo right (flex-row desktop, stacked mobile)
    ProjectShowcase.tsx — horizontal scroll container with snap
    ProjectCard.tsx     — name, description, link (w-[280px], snap-start)
    MagicQuote.tsx      — closing line
  data/
    projects.ts         — 6 featured projects data
  pages/
    Home.tsx            — assembles hero + showcase + quote
```

### Proposed 5 projects (from experience page):
1. **musicMixer** — upload 2 songs, extract vocals + instrumentals, create mashup (mixer.awill.co)
2. **particleArt** — fine-tuned Stable Diffusion for text-to-particle-art (prtkl.net)
3. **multiDraw** — multi-project Excalidraw clone, local-first (multidraw.net)
4. **diaHistory** — macOS CLI for archiving Dia conversations (GitHub)
5. **CTA Widget Tracker** — iOS home screen widget for Chicago transit (TestFlight)
*5 projects + "see more" CTA card → /experience*

### Mobile:
- Photo stacks vertically, stays visible (fixes current 480px `display: none`)
- Project showcase: native touch scroll with snap points
- Bio: full width

**Depends on Phases 1 + 2.**

---

## Phase 4: About + Remaining Pages

**Goal:** Full bio on `/about`, experience page, writing/lists indexes as React components.

- **`About.tsx`** — full 5-paragraph bio from current homepage
- **`Experience.tsx`** — all work history + full project list (converted from current HTML)
- **`Writing.tsx`** — article index (links use `<a>` to static MkDocs pages)
- **`Lists.tsx`** — lists index (links use `<a>` to static MkDocs pages)

**Parallelizable with Phase 3 (except About depends on bio copy decisions).**

---

## Phase 5: Styling Parity & Polish

**Goal:** React site looks and feels identical to current site + homepage improvements.

1. Tailwind theme matching existing CSS vars (`--bg: #f82`, `--fg-1: #212529`, `--accent-color: rgb(75, 189, 255)`)
2. Prose styles for blockquotes, code, tables, lists (consider `@tailwindcss/typography`)
3. Link styling: `text-[#212529]`, no underline by default
4. Responsive: mobile breakpoint at 480px
5. SEO: page titles, OG tags per page
6. Font preloading, image preloading

---

## Phase 6: Build Pipeline & Deployment

**Goal:** `npm run build` → `dist/` → Docker → works.

1. Update `build.sh` — run `mkdocs build` then `npm run build` (MkDocs outputs to `public/`, Vite copies to `dist/`)
2. Update `buildlist.sh` — same pattern with `mkdocs build -f mkdocs-lists.yml`
3. nginx.conf with hybrid SPA/static routing
4. Updated Dockerfile: `COPY dist /usr/share/nginx/html`
5. Update `.zed/tasks.json` if script behavior changes
6. `deploy.sh` — no changes needed (already runs `docker compose up`)
7. Smoke test: `docker compose up --build`, verify all routes

---

## Parallelization Map

```
Phase 0 (Scaffold)
  ├──→ Phase 1 (Layout) ──┐
  └──→ Phase 2 (MkDocs) ──┼──→ Phase 3 (Homepage)
                           ├──→ Phase 4 (Pages)
                           └──→ Phase 5 (Styling)
                                    └──→ Phase 6 (Deploy)
```

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| MkDocs HTML references old `/js/index.js` | HIGH | Update MkDocs themes, rebuild, keep `public/css/styles.css` for compat |
| SPA/static boundary causes flash on nav | MEDIUM | Both environments share same bg image; acceptable for Phase 1 |
| 73MB writing images slow build | MEDIUM | Acceptable; optimize in future |
| Writing image relative paths break | LOW | Preserved by copying entire directory structure to `public/` |

---

## Decisions Requiring Aaron's Approval

1. **Homepage layout ordering** — title → bio+photo → projects → magic quote → footer. Good?
2. ~~**Concise bio copy** — decided: "hey, i'm aaron. pm turned engineer. i build things that help people connect, create, and learn."~~
3. ~~**Featured projects** — decided: musicMixer, particleArt, multiDraw, diaHistory, CTA widget (5 + see more CTA)~~
4. ~~**Full bio** — decided: current 5 paragraphs go to `/about` verbatim~~
5. ~~**Nav bar** — decided: tie-dye swirl logo (home link) left, about | experience | writing | lists right~~
6. **Writing/lists indexes** — React components (recommended) or stay MkDocs static?
