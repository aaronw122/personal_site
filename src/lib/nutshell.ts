/** Convert Obsidian's inline nutshell syntax before markdown rendering. */
const TERM_RE = /\[:([^\]\n]+)\](?:\((?:<([^>\n]*)>|([^\s)]+))\)|%%(.*?)%%)?/y;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

export function headingSlug(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9- ]/g, "").replace(/ +/g, "-");
}

function transformText(text: string): string {
  let result = "";
  let at = 0;
  while (at < text.length) {
    // Obsidian comments are invisible in reading mode, including multiline comments.
    if (text.startsWith("%%", at)) {
      const end = text.indexOf("%%", at + 2);
      if (end !== -1) {
        at = end + 2;
        continue;
      }
    }

    // A code span is literal markdown; its delimiter may contain any number of ticks.
    if (text[at] === "`") {
      let endTicks = at + 1;
      while (text[endTicks] === "`") endTicks++;
      const ticks = text.slice(at, endTicks);
      let end = text.indexOf(ticks, endTicks);
      while (end !== -1 && (text[end + ticks.length] === "`" || text[end - 1] === "`")) {
        end = text.indexOf(ticks, end + ticks.length);
      }
      if (end !== -1) {
        result += text.slice(at, end + ticks.length);
        at = end + ticks.length;
        continue;
      }
      result += ticks;
      at = endTicks;
      continue;
    }

    if (text.startsWith("[:", at)) {
      TERM_RE.lastIndex = at;
      const term = TERM_RE.exec(text);
      if (term) {
        const label = escapeHtml(term[1].replace(/^\s+/, ""));
        const target = term[2] ?? term[3];
        if (target !== undefined) {
          result += `<a href="#${escapeHtml(headingSlug(target.replace(/^#/, "")))}">${label}</a>`;
        } else {
          // One decode is the plugin's storage format. The note also contains
          // a doubly stored newline (%250A), which still denotes a line break.
          const definition = (term[4] ?? "").trim().replace(/%0A/g, "\n").replace(/%25/g, "%").replace(/%0A/g, "\n");
          result += definition
            ? `<span class="nutshell" data-def="${escapeHtml(encodeURIComponent(definition))}">${label}</span>`
            : label;
        }
        at += term[0].length;
        continue;
      }
    }

    result += text[at];
    at++;
  }
  return result;
}

/** Leave fenced code untouched, even when it contains term/comment syntax. */
export function nutshellsToHtml(md: string): string {
  let result = "";
  let prose = "";
  let fence: { marker: string; length: number } | null = null;
  let at = 0;
  while (at < md.length) {
    const end = md.indexOf("\n", at);
    const next = end < 0 ? md.length : end + 1;
    const line = md.slice(at, next);
    if (fence) {
      result += line;
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*\r?\n?$/);
      if (close && close[1][0] === fence.marker && close[1].length >= fence.length) fence = null;
    } else {
      const open = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (open) {
        result += transformText(prose) + line;
        prose = "";
        fence = { marker: open[1][0], length: open[1].length };
      } else {
        prose += line;
      }
    }
    at = next;
  }
  return result + transformText(prose);
}
