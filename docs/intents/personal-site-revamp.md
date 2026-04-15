---
title: "Personal Site Revamp"
author: "human:aaron"
version: 1
created: 2026-04-14
---

# Personal Site Revamp

## WANT

**Phase 1 — React Migration + Homepage Restructure:**
- Migrate from vanilla HTML/JS to Vite + React + Tailwind
- Restructure homepage: concise punchy bio → project showcase → "read more" link to full bio
- Projects featured prominently on the landing page (no click-through required)
- Horizontal scrollable project showcase (top 6 projects from experience page)
- "See more" CTA at the end of the scroll → links to full projects/experience page
- Photo visible on all screen sizes including mobile
- Preserve all existing content (writing, lists, experience pages)
- Maintain SPA routing, tie-dye background, existing aesthetic

**Phase 2 — Interactive Visuals (future):**
- Three.js or P5.js animations with tie-dye aesthetic
- Scroll-driven motion and graphics (inspired by julianwemmie.com)
- Interactive/ambient visual elements that enhance without dominating

## DON'T

- No corporate or sterile portfolio template vibes
- No obvious/templated design patterns
- Don't lose the whimsy — lowercase voice, magic/tech philosophy, tie-dye brand
- Don't over-engineer: basic component splitting principles (separate state, render boundary)

## LIKE

- **julianwemmie.com** — motion, graphics, scroll-driven project showcase
- Current site's own personality — the lowercase branding, warm tie-dye, "aspiring renaissance man" energy

## FOR

- **Audience:** Potential collaborators, hiring managers, anyone who finds Aaron online
- **Takeaway:** "This guy's a kick-ass engineer that works on cool shit"
- **Tech:** Vite + React + Tailwind CSS
- **Hosting:** Self-hosted homeserver, Docker + nginx (static build output)
- **Devices:** Desktop + mobile, responsive

## ENSURE

- Someone lands on the homepage and within 5 seconds knows what Aaron builds and that it's impressive
- Whimsy and personality come through — does not feel like a generic dev portfolio
- Projects are visible on the homepage without navigating to another page
- Photo is visible on mobile (currently hidden at 480px)
- Mobile experience is excellent
- All existing content (writing 18+ articles, lists, experience) is preserved and accessible
- Static build output works with existing Docker + nginx deployment
- SPA navigation still works smoothly

## TRUST

**Autonomous — Claude decides:**
- Component structure and file organization [autonomous]
- Tailwind configuration and styling approach [autonomous]
- Animation/transition library choices [autonomous]
- When to split components (separate state, render boundary) [autonomous]
- Build tooling and Vite configuration [autonomous]
- React Router setup and SPA routing [autonomous]

**Ask — Aaron approves:**
- Homepage layout and section ordering [ask]
- Bio copy (concise version and any changes to full version) [ask]
- Any content changes to existing pages [ask]
- Visual design decisions that change the site's personality/feel [ask]
