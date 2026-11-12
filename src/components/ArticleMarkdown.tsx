import { Children, createContext, isValidElement, useContext, useRef, useState, type ReactNode } from "react";
import type { Element, ElementContent } from "hast";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkFrontmatter from "remark-frontmatter";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import Lightbox from "./Lightbox";
import MarkdownLink from "./MarkdownLink";
import Nutshell from "./Nutshell";
import MermaidBlock from "./MermaidBlock";
import UwbPulse from "./UwbPulse";
import WaveBlock from "./wave/WaveBlock";
import { processMarkdown } from "../lib/content";
import { headingSlug } from "../lib/nutshell";
import { WAVE_LANGS, articlePlugins } from "../lib/articlePlugins";
import useFitDisplayMath from "../hooks/useFitDisplayMath";

function hastText(node: ElementContent): string {
  if (node.type === "text") return node.value;
  return node.type === "element" ? node.children.map(hastText).join("") : "";
}

function childText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child) ? childText(child.props.children) : String(child),
    )
    .join("");
}

function LightboxImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        {...props}
        loading="lazy"
        decoding="async"
        className="lightbox-trigger"
        tabIndex={0}
        role="button"
        aria-label="View full size image"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      <Lightbox
        open={open}
        onClose={() => setOpen(false)}
        src={props.src ?? ""}
        alt={props.alt}
      />
    </>
  );
}

function heading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  return function Heading({ children }: { children?: ReactNode }) {
    return <Tag id={headingSlug(childText(children))}>{children}</Tag>;
  };
}

interface Props {
  markdown: string;
  section: "writing" | "lists";
}

const SectionContext = createContext<Props["section"]>("writing");

const Pre: Components["pre"] = ({ node, children, ...rest }) => {
  const code = node?.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "code",
  );
  const classes = code?.properties.className;
  const lang = (Array.isArray(classes) ? classes : [])
    .map(String)
    .find((c) => c.startsWith("language-"))
    ?.slice("language-".length);
  if (code && lang === "uwb-pulse") return <UwbPulse />;
  if (code && lang === "mermaid") return <MermaidBlock source={hastText(code).replace(/\n$/, "")} />;
  const waveLang = WAVE_LANGS.find((l) => l === lang);
  if (code && waveLang) {
    return <WaveBlock lang={waveLang} source={hastText(code).replace(/\n$/, "")} />;
  }
  return <pre {...rest}>{children}</pre>;
};

const Span: Components["span"] = ({ node, children, ...rest }) => {
  const section = useContext(SectionContext);
  const def = node?.properties.dataDef;
  if (rest.className !== "nutshell" || def == null) return <span {...rest}>{children}</span>;
  return (
    <Nutshell
      def={decodeURIComponent(String(def))}
      renderMarkdown={(md) => <ArticleMarkdown markdown={processMarkdown(md, section)} section={section} />}
    >
      {children}
    </Nutshell>
  );
};

const COMPONENTS: Components = {
  img: LightboxImage,
  a: MarkdownLink,
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
  pre: Pre,
  span: Span,
};

export default function ArticleMarkdown({ markdown, section }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useFitDisplayMath(root, markdown);

  return (
    <SectionContext.Provider value={section}>
      <div ref={root} style={{ display: "contents" }}>
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm, remarkBreaks, remarkFrontmatter]}
          rehypePlugins={[rehypeRaw, ...articlePlugins()]}
          components={COMPONENTS}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </SectionContext.Provider>
  );
}
