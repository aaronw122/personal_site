# Reusable procedural character rig — implementation plan

## Execution status
- [x] Phase 1: baseline checkpoint and shared typed contracts.
- [ ] Phase 2: body generator — PR #67 under corrective review.
- [ ] Phase 3: grip solver — PR #66 under corrective review.
- [ ] Phase 4: development tuner — implemented; integrated runtime verification pending.
- [ ] Neutral lean/full visual approval — required before head fitting.
- [ ] Phase 5: head preparation — awaits visual approval and confirmed replacement assets.
- [ ] Phase 6: Bob/Jerry reuse proof.
- [ ] Phase 7: production-behavior cutover.
- [ ] Phase 8: integrated verification, test cleanup, readability report.

Integration branch: `feat/reusable-character-rig-integration`. Isolated preview: port 4540; original checkout/server unchanged. User approved fixing initial blocking geometry and hand-pose review findings before merge.

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
