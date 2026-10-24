---
title: "Peeking Bob"
author: "human:aaron"
version: 3
created: 2026-10-23
---

# Peeking Bob

## WANT
- A live 3D (WebGL) cartoon Bob Weir peeking from behind the right browser edge, matching Aaron's reference (`/tmp/bob-ref/reference-edge-line.png`). Nearly the entire face and hair remain visible on the page side of the edge; the head leans pageward, while most of the torso stays hidden beyond the edge. Do not crop a prescribed percentage of the head. The upper grip sits above-right of the hair; the lower grip sits beside the beard, with a visible bent elbow below-left of that grip. Match the reference silhouette rather than confining the elbow to the shirt outline.
- Small: the head is about 45–50px on screen (80% smaller than the first attempt).
- His head turns slowly left and right, like he's looking around the page. The eyes stay squinting as they are in the scan; no eye animation.
- Hands grip the right window edge like the reference (`/tmp/bob-ref/reference-edge-line.png`): back of each hand toward the viewer, fingers pointing right and wrapping round the edge, the window edge cutting through the middle of the fingers (back of hand, knuckles and first finger segments visible; fingertips off-screen). Each hand is about a third of the head's height. Arms connect them to the body: the upper arm comes from behind his hair, the lower arm comes out of the T-shirt sleeve with the elbow bent. Uses the cartoon hands.
- Clicking him pops him out and plays the approved strumming loop (sprite sheet, speed set by the tuner's loop length); a × sends him back to peeking.

## DON'T
- Mustn't slow page load: the 3D appears after the page is usable.
- Ideally stays in the margin, but covering a little text is acceptable.
- Not on phones or tablets.

## LIKE
- Kilroy was here
- `/tmp/bob-ref/reference-edge-line.png` (Aaron's reference; the red line marks the window edge)
- The approved strumming GIF (`public/images/bob/bob.gif`) and its tuner settings

## FOR
- Visitors to awill.co on desktop (wide screen, mouse), on every page.
- Existing site: React 19 + Vite, deployed as a static build. Source model: `/Users/aaron/Downloads/model7-color.glb`.

## ENSURE
- He looks like the same Bob as the GIF: same model, same cartoon shading.
- His head visibly turns left and right while peeking.
- His hands clearly grip the window edge: no floating or clipping.

## TRUST
- [autonomous] Technical choices: libraries, model compression, file layout, how the 3D is loaded.
- [ask] Visual choices before shipping: peek pose, head-turn motion.
