import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

interface Options {
  sourceDirs: string[];
  sourceFiles: string[];
  attachmentsDirs: string[];
  destDir: string;
}

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
      const scan = (file: string) => {
        for (const ref of extractImageRefs(fs.readFileSync(file, "utf8"))) referenced.add(ref);
      };
      for (const dir of opts.sourceDirs) {
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir, { recursive: true, encoding: "utf8" })) {
          if (!file.endsWith(".md")) continue;
          scan(path.join(dir, file));
        }
      }
      for (const file of opts.sourceFiles) scan(file);

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
        console.log(`[writing-images] synced ${ref}`);
      }

      if (missing.length > 0) {
        throw new Error(
          `[writing-images] ${missing.length} referenced image(s) not found in ` +
            `public/writing-images/ or vault attachments — fix the reference or ` +
            `restore the file:\n  ${missing.join("\n  ")}`,
        );
      }

      console.log(
        `[writing-images] ${referenced.size} referenced, ${copied} newly synced`,
      );
    },
  };
}
