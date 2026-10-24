# Readability review — reusable character rig

REPORT ONLY; no code edits or branch switches. Working tree /tmp/personal-site-rig-integration. Review integrated diff origin/main...origin/feat/reusable-character-rig-integration, focusing new CharacterRig modules, CharacterRigDemo and tests; clearly distinguish pre-existing checkpointed Bob experiments from new work. Test cleanup completed: 10 tests green and new-code lint clean.

Apply seven principles: (1) newspaper ordering: public contracts before details; (2) naming as narrative; (3) chunk related work into named steps; (4) guard clauses over nesting; (5) signal-to-noise, no dead/redundant code; (6) consistent abstraction level per function; (7) predictable patterns matching repository conventions. Cross-agent consistency: compare naming, coordinate semantics and implementation patterns between body, pose, tuner and tests. Preserve comments documenting non-obvious constraints. Propose behavior-preserving changes only, no copy changes.

Write notes/readability-2026-10-24-reusable-character-rig.md in integration worktree, under 100 lines: Summary; Findings by File table (#, principle, severity, location, proposal); Systemic Patterns; Suggested Fix Order. No tests/builds/lint. Report summary and counts; do not apply suggestions.
