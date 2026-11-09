#!/usr/bin/env python3
import os
import subprocess
import sys

ROOT = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"],
    capture_output=True, text=True,
).stdout.strip() or os.getcwd()
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from no_comments_lib import ext_of, family, scan


def git_lines(*args):
    r = subprocess.run(["git", *args, "-z"], capture_output=True, text=True, cwd=ROOT)
    return [p for p in r.stdout.split("\0") if p]


def git_show(ref):
    r = subprocess.run(["git", "show", ref], capture_output=True, text=True, cwd=ROOT)
    return r.stdout if r.returncode == 0 else ""


def staged_sources():
    for path in git_lines("diff", "--cached", "--name-only", "--diff-filter=ACMR"):
        yield path, git_show(f":{path}")


def tracked_sources():
    for path in git_lines("ls-files"):
        full = os.path.join(ROOT, path)
        if os.path.isfile(full):
            with open(full, encoding="utf-8", errors="replace") as f:
                yield path, f.read()


def main():
    check_all = "--all" in sys.argv[1:]
    sources = tracked_sources() if check_all else staged_sources()
    violations = []
    for path, text in sources:
        ext = ext_of(path)
        if family(ext) is None:
            continue
        found = scan(text, ext)
        if found:
            violations.append((path, found))

    if not violations:
        sys.exit(0)

    header = "COMMENTS FOUND" if check_all else "COMMIT BLOCKED: source comments detected"
    lines = ["", f"{header} (repo policy: no comments)."]
    for path, cmts in violations:
        lines.append(f"  {path}: {len(cmts)} comment(s)")
        for c in cmts[:5]:
            body = c if len(c) <= 70 else c[:67] + "..."
            lines.append(f"    - {body!r}")
    lines += [
        "",
        "Remove the comment(s), then re-stage and commit.",
        "Rationale belongs in the commit message or a plans/notes doc, not inline.",
        "",
    ]
    print("\n".join(lines), file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
