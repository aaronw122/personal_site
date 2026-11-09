import os

CFAMILY = {"swift", "c", "h", "cpp", "hpp", "cc", "m", "mm",
           "ts", "tsx", "js", "jsx", "mjs", "cjs", "scad"}
BACKTICK = {"ts", "tsx", "js", "jsx", "mjs", "cjs"}
HASH = {"py", "sh", "bash", "zsh"}
TRIPLE = {"py", "swift"}
SQL = {"sql"}
CSS = {"css"}
REGEX_KEYWORDS = {"return", "typeof", "case", "do", "else", "in", "of", "new",
                  "delete", "void", "throw", "yield", "await", "instanceof"}


def skip_template(text, i):
    n = len(text)
    while i < n:
        if text[i] == "\\":
            i += 2
            continue
        if text[i] == "`":
            return i + 1, False
        if text[i:i + 2] == "${":
            return i + 2, True
        i += 1
    return n, False


def skip_regex(text, i):
    n = len(text)
    k = i + 1
    in_class = False
    while k < n:
        ch = text[k]
        if ch == "\\":
            k += 2
            continue
        if ch == "\n":
            return None
        if ch == "[":
            in_class = True
        elif ch == "]":
            in_class = False
        elif ch == "/" and not in_class:
            k += 1
            while k < n and (text[k].isalnum() or text[k] == "_"):
                k += 1
            return k
        k += 1
    return None


def ext_of(path):
    return os.path.splitext(path)[1].lstrip(".").lower()


def family(ext):
    if ext in CFAMILY:
        return "c"
    if ext in HASH:
        return "hash"
    if ext in SQL:
        return "sql"
    if ext in CSS:
        return "css"
    return None


def scan(text, ext):
    fam = family(ext)
    if fam is None:
        return []
    comments = []
    i = 0
    n = len(text)
    at_file_start = True
    has_backtick = ext in BACKTICK
    has_triple = ext in TRIPLE
    templates = []
    prev = "op"
    last = ""
    while i < n:
        c = text[i]
        two = text[i:i + 2]
        three = text[i:i + 3]

        if fam == "hash" and at_file_start and two == "#!":
            j = text.find("\n", i)
            i = n if j == -1 else j
            at_file_start = False
            continue

        if ext == "swift" and c == "#":
            k = 0
            while text[i + k:i + k + 1] == "#":
                k += 1
            if text[i + k:i + k + 1] == '"':
                q = ('"""' if text[i + k:i + k + 3] == '"""' else '"') + "#" * k
                j = text.find(q, i + k + len(q) - k)
                i = n if j == -1 else j + len(q)
                at_file_start = False
                continue
        if c == '"' or c == "'":
            if has_triple and three in ('"""', "'''"):
                q = three
                i += 3
                while i < n and text[i:i + 3] != q:
                    i += 1
                i += 3
                at_file_start = False
                continue
            q = c
            i += 1
            while i < n:
                if text[i] == "\\" and fam != "sql":
                    i += 2
                    continue
                if text[i] == q:
                    i += 1
                    break
                if text[i] == "\n" and fam == "c":
                    break
                i += 1
            at_file_start = False
            prev = "value"
            continue
        if has_backtick and c == "`":
            i, opened = skip_template(text, i + 1)
            if opened:
                templates.append(0)
            prev = "op" if opened else "value"
            at_file_start = False
            continue
        if has_backtick and templates and c in "{}":
            if c == "{":
                templates[-1] += 1
                prev = "op"
                i += 1
                continue
            if templates[-1] == 0:
                templates.pop()
                i, opened = skip_template(text, i + 1)
                if opened:
                    templates.append(0)
                prev = "op" if opened else "value"
                continue
            templates[-1] -= 1
        if has_backtick and (c.isalnum() or c in "_$"):
            j = i
            while j < n and (text[j].isalnum() or text[j] in "_$"):
                j += 1
            prev = "op" if text[i:j] in REGEX_KEYWORDS else "value"
            last = text[j - 1]
            i = j
            at_file_start = False
            continue
        if has_backtick and c == "/" and two not in ("//", "/*") and prev == "op" and last != "<":
            j = skip_regex(text, i)
            if j is not None:
                i = j
                prev = "value"
                last = "/"
                continue
        if fam == "c" and c == "\\":
            i += 2
            at_file_start = False
            continue

        if fam == "c":
            if two == "//":
                j = text.find("\n", i)
                end = n if j == -1 else j
                comments.append(text[i + 2:end].strip())
                i = end
                at_file_start = False
                continue
            if two == "/*":
                j = text.find("*/", i + 2)
                end = n if j == -1 else j + 2
                comments.append(text[i + 2:(end - 2 if j != -1 else end)].strip())
                i = end
                at_file_start = False
                continue
        elif fam == "hash":
            if c == "#":
                j = text.find("\n", i)
                end = n if j == -1 else j
                comments.append(text[i + 1:end].strip())
                i = end
                at_file_start = False
                continue
        elif fam in ("sql", "css"):
            if fam == "sql" and two == "--":
                j = text.find("\n", i)
                end = n if j == -1 else j
                comments.append(text[i + 2:end].strip())
                i = end
                at_file_start = False
                continue
            if two == "/*":
                j = text.find("*/", i + 2)
                end = n if j == -1 else j + 2
                comments.append(text[i + 2:(end - 2 if j != -1 else end)].strip())
                i = end
                at_file_start = False
                continue

        if has_backtick and two in ("++", "--") and prev == "value":
            i += 2
            continue
        if not c.isspace():
            at_file_start = False
            prev = "value" if c in ")]}" else "op"
            last = c
        i += 1
    return [c for c in comments if c != ""]
