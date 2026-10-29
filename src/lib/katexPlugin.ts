// Loaded on demand by articlePlugins: keeps KaTeX and its stylesheet out of the
// article chunk for posts without math.
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default rehypeKatex;
