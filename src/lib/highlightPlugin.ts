// Loaded on demand by articlePlugins: keeps highlight.js and its stylesheet out
// of the article chunk for posts without highlighted code.
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

export default rehypeHighlight;
