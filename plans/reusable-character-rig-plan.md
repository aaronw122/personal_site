# Reusable procedural character rig — implementation plan

## Execution status
- [x] Phase 1: baseline checkpoint and shared typed contracts.
- [x] Phase 2: proportioned skinned body generator — reviewed PR #67 merged into integration.
- [x] Phase 3: grip solver — reviewed PR #66 merged into integration.
- [x] Phase 4: neutral development tuner — real browser checks of presets, yaw, reach warnings, overlay, materials and export passed. Head attachment controls await phase 5 assets.
- [ ] Neutral lean/full visual approval — required before head fitting.
- [ ] Phase 5: head preparation — awaits visual approval and confirmed replacement assets.
- [ ] Phase 6: Bob/Jerry reuse proof.
- [ ] Phase 7: production-behavior cutover.
- [ ] Phase 8: full character verification awaits head fitting/cutover. Neutral checkpoint checks and cleanup completed below.

Integration branch: `feat/reusable-character-rig-integration`. Isolated preview: http://127.0.0.1:4540/character-rig. Original checkout/server unchanged.

### Neutral checkpoint evidence
- Latest verification loop: 11 Bun tests pass (565 assertions), including real generated rigs under both preset poses/yaw extremes and finger/edge contact checks.
- New CharacterRig, demo and test files pass scoped lint. Repository-wide lint still reports unrelated existing diagnostics in checkpointed Bob experiments and other site code; not suppressed or changed.
- Production build passed; no e2e framework configured. Browser smoke captures: `/tmp/rig-review/shots/`, `/tmp/rig-final-workshop.png`, `/tmp/rig-final-full-native.png`.
- Continuous limbs and sleeves, distinct proportions, visible yaw, unreachable-target warnings and configuration export verified. Same-preset status reset fixed; native canvas moved to lower-third framing.
- Test cleanup removed one incidental preset test and four structural assertions/blocks; retained seam/normal/reach coverage and replaced fake wrap proof with real assemblies.
- Readability report: `notes/readability-2026-10-24-reusable-character-rig.md`, 10 advisory findings (2 high, 5 medium, 3 low). No readability refactors applied without approval.
- Latest independent visual matrix: all 12 lean/full × left/centre/right × detail/native states inspected and passed neutral pose relationships. Evidence: `/tmp/rig-interaction-loop1/final2/`, including `matrix.png` and `log.txt`. No head/hand overlap or buried lower grip; both arms reachable in every default state. Remaining cosmetic limits: faceted neck, cuffs and fuller lower-torso silhouette. Neutral head is deliberate; no character likeness or human approval implied.
- Existing `/peek` mouse close is obscured by its dev spacing panel; keyboard close works. This predates reusable-rig integration; do not treat it as a passed mouse round trip. Original feature remains unchanged.
- Renderer lifecycle corrected: repeated proportion/color edits retain the same renderer/context; only changed assemblies are replaced. Independent 20-edit/switch runs held context creation count at 4 (development StrictMode initial mounts), with two live canvases. Reset restores default pixels; 390px viewport no longer has document overflow. Evidence: `/tmp/rig-interaction-loop1/churn/`.
- Rounded profiled palms, continuous blunt wrists, smoothed collar/sleeves and forward lower-grip depth replace rectangular/occluded grips. Torso remains symmetric and anatomically proportioned; discarded the edge-specific asymmetric and overlong taper attempts.

## Approved direction
Build in Three.js/TypeScript without Blender or regenerating characters in Meshy. Preserve character identity through interchangeable head geometry and textures. Generate proportioned bodies from shared code; share skeleton topology, grip behavior, and animation logic, not a single fixed body mesh.

Existing visual requirements: notes/bob-peek.md. The user-supplied reference governs the silhouette: nearly all face/hair visible left of the edge, upper grip beside upper-right hair, lower grip alongside beard, visible bent elbow and short sleeve, most torso behind edge. Do not impose hidden-head percentages or constrain elbows to the shirt outline.

## Character contract
- Head asset and one-time preparation metadata: orientation, normalized scale, neck pivot and seam treatment. Preserve source node transforms through wrapper groups.
- Body proportions: chest width/depth, belly width/depth, shoulder width/slope, neck width/length, separate upper-arm/forearm lengths and thickness profiles, hand size, shirt clearance.
- Appearance: skin and clothing material parameters; head textures remain character-specific.
- Optional pose-fit offsets: torso placement, grip spacing, elbow direction. No character-name branches in rig or behavior code.
- Shared pose and behavior definitions are separate from identity and body shape.

## Phases
### 1. Inspect integration and establish contracts
Read the existing BobPeek scene, hands, materials, React lifecycle and strum player. Define typed head/body/appearance/pose configurations and coordinate conventions. Preserve existing website behavior. Do not modify assets while the user is replacing Bob's model.

### 2. Generate a neutral proportioned upper body
Generate rounded torso cross-sections at shoulders, chest, belly and waist; connect into smooth geometry. Generate profiled limbs, short sleeves with openings, palms and articulated fingers. Use a shared bone hierarchy with deterministic skin weights. Derive joint positions and garment dimensions from proportions. Generate once per assembly or tuner shape change, not per animation frame. Dispose replaced resources correctly.

Implement lean and fuller presets immediately. Do not simulate body weight through uniform scaling. Validate both shapes with a placeholder head before character integration.

### 3. Implement shared edge-grip pose
Represent browser edge as a plane and hand contacts as targets. Solve arms using two-bone IK and elbow-direction targets. Reuse finger grip poses. Animate head around neck independently of torso and grips. Explicitly flag unreachable targets in the tuner; do not stretch limbs silently. Permit declarative pose-fit offsets for different proportions.

### 4. Build focused development tuner
Controls: character/preset, head fit, body proportions, torso placement, grip targets, elbow directions, lean, yaw range/speed, materials. Display native-size and enlarged views, reference overlay normalized by head size, optional skeleton/contact markers, frozen yaw extremes. Export serializable configuration. Keep out of production builds. This is not a general modeling editor.

Visual checkpoint: user approves neutral lean/full rigs and reference silhouette before detailed head fitting.

### 5. Prepare heads once
Inspect the replacement eyes-open Bob asset and an existing Jerry asset. Prefer separate head meshes. For merged assets, use an explicit code-based preparation/selection workflow; do not generalize Bob's current hard-coded triangle-height cutoff. Preserve textures, configure neck pivot, and hide or close the seam beneath collar. Original assets plus preparation metadata are acceptable; processed head assets optional. No new GLB per pose.

### 6. Prove Bob/Jerry reuse
Fit lean Bob and fuller Jerry through configuration alone. Same generator, skeleton topology, IK and behavior code; distinct generated geometry and joint positions. Check fullness, garment fit, beard clearance, reach, stable grips and readable head turns. Any pose-fit correction stays in configuration. No character-specific limb reconstruction.

If Jerry's asset is unavailable, prove both proportions with a neutral head but do not claim the two-character acceptance criterion passed.

### 7. Integrate and cut over
Preserve deferred loading, transparency, desktop gate, click-to-strum and return behavior. Keep Bob's existing approved sprite playback; new guitar performances for other characters are out of scope. After visual approval, replace obsolete Bob-specific mesh surgery/procedural limbs/head-turn workarounds rather than keeping a second implementation. Preserve unrelated experiments and user changes. Update existing documentation after runtime proof.

### 8. Verify
- Deterministic behavioral tests for IK reach boundaries, endpoint accuracy, proportion validation and fixed grip targets under head motion, following repository conventions. No source-text or wiring tests.
- Browser smoke of both characters/presets at native delivery size and yaw extremes; inspect continuous shoulder-to-hand geometry, fabric boundary, head seam and intersections.
- Compare reference at matched head scale; do not confuse source-model detail differences with pose failures.
- Exercise click/return, resizing, desktop/mobile boundary, loading and disposal; observe console and failed requests.
- Run appropriate project checks once after implementation; do not rerun known pre-existing failures merely to confirm them.
- User approval of visual pose is required before rollout; reviewer approval is not a substitute.

## Acceptance
1. Lean Bob and fuller Jerry have recognizably different body proportions without regenerating a full character or editing shared rig code.
2. Replacing a prepared head needs asset/configuration changes only.
3. Torso fullness, arm thickness, arm length and hand size remain independently controllable.
4. Both characters maintain connected limbs and fixed edge grips while visibly looking around.
5. Native-size silhouette matches the approved reference relationships.
6. Existing Bob click/strum/return and desktop-only deferred rendering remain functional.
7. No per-frame mesh regeneration; resource lifetime is explicit.

## Dependencies and risks
- Ready to implement contracts, generator, lean/full presets, IK and tuner now.
- Final Bob fit depends on the replacement eyes-open asset; locate existing Jerry assets before asking user for files.
- Hand topology and elbow deformation are the main geometry risks; neutral-material validation comes before identity fitting.
- Arbitrary merged GLBs require one-time preparation; universal automatic head extraction is not promised.
- Large proportions may need pose-fit offsets; reuse does not mean identical numeric joint positions.
- Facial expression animation, universal humanoid retargeting, full-body locomotion and new per-character strumming animations are out of scope.

## Decision ownership
Autonomous: geometry generation, skeleton implementation, module boundaries, asset normalization, tests and runtime integration.
User approval: character likeness, body proportions and final peek silhouette. No additional design questions block the first implementation milestone.
