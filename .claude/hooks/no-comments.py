#!/usr/bin/env python3
import json
import os
import sys
from collections import Counter

_ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
sys.path.insert(0, os.path.join(_ROOT, "scripts"))
try:
    from no_comments_lib import ext_of, family, scan
except Exception:
    sys.exit(0)


def apply_edit(content, old, new, replace_all):
    if old == "" and content == "":
        return new
    if old not in content:
        return None
    if replace_all:
        return content.replace(old, new)
    return content.replace(old, new, 1)


def resulting_content(tool, tin, original):
    if tool == "Write":
        return tin.get("content", "")
    if tool == "Edit":
        return apply_edit(original,
                          tin.get("old_string", ""),
                          tin.get("new_string", ""),
                          bool(tin.get("replace_all", False)))
    if tool == "MultiEdit":
        cur = original
        for e in tin.get("edits", []):
            cur = apply_edit(cur if cur is not None else "",
                             e.get("old_string", ""),
                             e.get("new_string", ""),
                             bool(e.get("replace_all", False)))
            if cur is None:
                return None
        return cur
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool = payload.get("tool_name", "")
    if tool not in ("Write", "Edit", "MultiEdit"):
        sys.exit(0)

    tin = payload.get("tool_input", {}) or {}
    path = tin.get("file_path") or tin.get("path") or ""
    if not path:
        sys.exit(0)
    root = os.path.realpath(_ROOT)
    if os.path.commonpath([root, os.path.realpath(path)]) != root:
        sys.exit(0)

    ext = ext_of(path)
    if family(ext) is None:
        sys.exit(0)

    original = ""
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                original = f.read()
        except Exception:
            original = ""

    result = resulting_content(tool, tin, original)
    if result is None:
        sys.exit(0)

    added = Counter(scan(result, ext)) - Counter(scan(original, ext))
    if not added:
        sys.exit(0)

    shown = list(added.elements())
    preview = "; ".join(repr(s if len(s) <= 60 else s[:57] + "...") for s in shown[:5])
    msg = (
        f"BLOCKED: this {tool} adds {sum(added.values())} new comment(s) to "
        f"{os.path.basename(path)}. This repo forbids source comments.\n"
        f"New comment(s): {preview}\n"
        "Remove the comment(s) and retry. Let the code speak for itself; if "
        "rationale is needed, put it in the commit message or a plan/notes doc."
    )
    print(msg, file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
