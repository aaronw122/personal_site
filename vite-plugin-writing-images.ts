import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Build-time sync of images embedded in published writing/lists docs.
//
// Markdown is loaded straight from the Obsidian vault (via the @writing/@lists
// aliases), but the images those docs embed are served from public/writing-images/.
// Historically that folder was a MANUAL copy of vault attachments, so every new
// embed required remembering to copy the file over — and forgetting shipped a
// broken image (a frequent 404 in production).
//
// This plugin closes that gap. On each build it scans the published docs for the
// same image-reference forms that processMarkdown() rewrites (![[file]] embeds and
// ](images/file) links), then ensures each referenced image physically exists in
// public/writing-images/:
//   - already present            -> left untouched (preserves historical images
//                                   that no longer live in the vault)
//   - missing but in the vault   -> copied in (and thus committed for posterity)
//   - missing everywhere         -> hard build failure, so it can never ship broken
//
// public/ is copied into dist/ by Vite's default publicDir handling, so anything
// synced here lands in the deployed artifact.

interface Options {
  // Vault directories holding the published markdown, e.g. …/published/writing.
  sourceDirs: string[];
  // Vault attachment directories to pull referenced images from, searched in order.
  attachmentsDirs: string[];
  // Destination served at /writing-images/, e.g. <repo>/public/writing-images.
  destDir: string;
}

// Extract the on-disk-relative names of images a doc references. Mirrors the two
// forms processMarkdown() rewrites to /writing-images/… so the set matches exactly.
function extractImageRefs(markdown: string): Set<string> {
  const refs = new Set<string>();
  for (const m of markdown.matchAll(/!\[\[([^\]]+)\]\]/g)) {
    refs.add(m[1].split("|")[0].trim());
  }
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(images\/([^)]+)\)/g)) {
    refs.add(m[1].trim());
  }
  return refs;
}

export function syncWritingImages(opts: Options): Plugin {
  return {
    name: "sync-writing-images",
    buildStart() {
      const referenced = new Set<string>();
      for (const dir of opts.sourceDirs) {
        if (!fs.existsSync(dir)) continue;
        // Recursive to match the runtime import.meta.glob("**/*.md") in content.ts.
        for (const file of fs.readdirSync(dir, { recursive: true })) {
          if (typeof file !== "string" || !file.endsWith(".md")) continue;
          const raw = fs.readFileSync(path.join(dir, file), "utf8");
          for (const ref of extractImageRefs(raw)) referenced.add(ref);
        }
      }

      fs.mkdirSync(opts.destDir, { recursive: true });

      let copied = 0;
      const missing: string[] = [];
      for (const ref of referenced) {
        const dest = path.join(opts.destDir, ref);
        if (fs.existsSync(dest)) continue;

        const source = opts.attachmentsDirs
          .map((d) => path.join(d, ref))
          .find((p) => fs.existsSync(p));
        if (!source) {
          missing.push(ref);
          continue;
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(source, dest);
        copied++;
        // eslint-disable-next-line no-console
        console.log(`[writing-images] synced ${ref}`);
      }

      if (missing.length > 0) {
        throw new Error(
          `[writing-images] ${missing.length} referenced image(s) not found in ` +
            `public/writing-images/ or vault attachments — fix the reference or ` +
            `restore the file:\n  ${missing.join("\n  ")}`,
        );
      }

      // eslint-disable-next-line no-console
      console.log(
        `[writing-images] ${referenced.size} referenced, ${copied} newly synced`,
      );
    },
  };
}
