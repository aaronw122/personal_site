# Readability Review — Reusable Character Rig

- **Date:** 2026-10-24
- **Scope:** Integrated diff `origin/main...origin/feat/reusable-character-rig-integration`, limited to the new reusable CharacterRig modules, workshop page, and focused tests. The Bob/BobPeek/bob3 experiments came from the earlier checkpoint commit `79bd927` and are explicitly excluded from findings.
- **Files reviewed:** 8

## Summary

The public rig vocabulary is cohesive, the coordinate and contact comments preserve genuinely non-obvious constraints, and body, pose, presets, preview, and tests use the same side/edge/reach semantics. The main readability cost is concentrated in three orchestration blocks—`createCharacterRig`, `solveArm`, and `CharacterRigDemo`—that interleave several distinct stages or UI concerns; behavior-preserving extraction into named steps would make the implementation much easier to scan. Tests are generally narrative and cover contracts rather than source wiring, with one oversized case and one fixture dependency worth clarifying.

## Findings by File

### `src/components/CharacterRig/body.ts`

| # | Principle | Severity | Location / issue | Proposed Change |
|---|---|---|---|---|
| 1 | Chunking | HIGH | `createCharacterRig` (206–358) combines hierarchy creation, skeleton indexing, material construction, torso/neck generation, arm skinning, sleeves, palms, fingers, and disposal in one 150-line function. The reader must retain all construction stages at once. | Keep `createCharacterRig` as the public orchestration entry point, but extract allocation-free construction steps such as `createSkeleton`, `addTorsoAndNeckMeshes`, `addArmMeshes`, and `createRigDisposer`; pass an explicit assembly context rather than adding a class. |
| 2 | Naming as narrative | Low | `globalBindPosition` (202–204) sounds like a coordinate category, while it simply reads a bone's world position during bind-time construction. | Rename it to `getBindWorldPosition` so both the timing and coordinate space are explicit. |

### `src/components/CharacterRig/pose.ts`

| # | Principle | Severity | Location / issue | Proposed Change |
|---|---|---|---|---|
| 3 | Consistent abstraction level | Medium | `solveArm` (64–142) alternates among reach reporting, vector normalization, elbow-plane fallback, triangle solving, world/local conversion, bone aiming, a hand-orientation quaternion derivation, and finger posing. | Extract named, scratch-mutating helpers for reach status, elbow-plane selection, joint placement, and hand orientation. Preserve the shared `PoseScratch` and no-allocation frame contract. |

### `src/components/CharacterRig/types.ts`

| # | Principle | Severity | Location / issue | Proposed Change |
|---|---|---|---|---|
| 4 | Signal-to-noise | Medium | `ArmSolution` (71) and `HeadInstance` (85) have no callers in the reviewed source or tests. They make the exported contract look broader and more complete than the implemented rig. | Remove these unused exports until the corresponding runtime concepts exist; retain `HeadAttachment`, which is part of `CharacterConfig`. |

### `src/components/CharacterRig/RigPreview.tsx`

| # | Principle | Severity | Location / issue | Proposed Change |
|---|---|---|---|---|
| 5 | Chunking | Medium | The effect (51–132) performs renderer setup, scene assembly, animation policy, status publication, debug drawing, camera framing, rendering, and disposal in one block. Cleanup correctness is hard to compare against setup. | Extract narrowly named setup/disposal helpers and a `renderFrame` closure builder, keeping resource ownership local and the effect as lifecycle orchestration. |
| 6 | Naming as narrative | Low | `live` (45–46, 75, 94) stores the latest props consumed by the animation loop, but its name does not communicate that role. | Rename it to `latestInputs` or `latestProps`. |

### `src/components/CharacterRig/presets.ts`

No findings. The parallel `lean` and `full` object shapes make proportion and pose differences directly comparable, and naming matches the contracts used by the tuner and tests.

### `src/pages/CharacterRigDemo.tsx`

| # | Principle | Severity | Location / issue | Proposed Change |
|---|---|---|---|---|
| 7 | Chunking | HIGH | `CharacterRigDemo` renders every control group, preview, overlay, and export panel in one densely packed return (66–107); several event handlers and mapped controls are embedded on single lines. | Extract behavior-neutral sections such as `PresetControls`, `ProportionControls`, `PoseControls`, `ReferenceControls`, and `PreviewPanel`. Keep state ownership and product copy in `CharacterRigDemo`. |
| 8 | Naming as narrative | Low | State names `reference`, `opacity`, and `exported` (39–44) omit what kind of value they hold, forcing readers to inspect later JSX. | Rename them to `referenceUrl`, `referenceOpacity`, and `exportedConfig`. |

### `tests/character-rig/body.test.ts`

No findings. Helpers fail loudly, test names describe contracts, and each case follows setup → exercise → assertions → disposal without mirroring production internals unnecessarily.

### `tests/character-rig/pose.test.ts`

| # | Principle | Severity | Location / issue | Proposed Change |
|---|---|---|---|---|
| 9 | Chunking | Medium | The first test (121–153) verifies transformed grip placement, hand axes, knuckle contact, and finger curls in one case. A failure requires tracing several independent contracts. | Split it into focused tests for transformed contacts, hand orientation, and curl pose, sharing the existing fixture helpers. |
| 10 | Predictable patterns | Medium | `makeRig` can vary `handSize` (63–85), but `wristTarget` silently uses the module-level default `proportions.handSize` (111–117). The helper relationship is safe only because current scaled-hand tests do not call `wristTarget`. | Rename the fixture to `makePoseTestRig` and have `wristTarget` accept the rig or hand size explicitly, removing the hidden dependency while preserving assertions. |

## Systemic Patterns

- **Good cross-module semantics:** `left`/`right`, root-local coordinates, edge-relative grip X, elbow direction, reach status, and the scratch-object allocation policy are named consistently across contracts, body generation, pose solving, preview, and tests.
- **Construction/math/UI orchestration is denser than leaf code:** private leaf helpers are focused, but the primary assembly function, IK solver, preview effect, and workshop component each absorb too many stages. Prefer named steps without introducing stateful abstractions or frame allocations.
- **Checkpoint boundary:** no finding above applies to `src/components/BobPeek`, `src/components/bob`, `src/components/bob3`, or the Bob demo pages; those are pre-existing checkpointed experiments, not new CharacterRig work.

## Final Cleanup Note

The subsequent same-preset status fix in `CharacterRigDemo`, native-preview framing adjustment in `RigPreview`, and stronger real-assembly pose regression coverage do not change the findings or priority order above. The two UI edits are small and locally legible, while the added regression helper follows the tests' existing fail-loudly pattern; the broader chunking and fixture-clarity observations still apply.

## Suggested Fix Order

1. Split `CharacterRigDemo` into named control and preview sections; this removes the largest day-to-day scanning cost.
2. Decompose `createCharacterRig` by assembly stage while preserving one owner for materials, skeleton, and disposal.
3. Separate the mathematical stages inside `solveArm`, retaining `PoseScratch` reuse and the documented coordinate constraints.
4. Reshape the preview effect so scene setup, per-frame work, and resource cleanup are visibly paired.
5. Split the oversized pose test and make its hand-size dependency explicit.
6. Remove unused contract exports, then apply the three low-risk naming improvements.
