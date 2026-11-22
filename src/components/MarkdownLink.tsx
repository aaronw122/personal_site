import type { Components } from "react-markdown";
import { Link } from "react-router-dom";

const MarkdownLink: Components["a"] = ({ node: _node, href, children, ...rest }) => {
  if (href && href.startsWith("/")) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  return <a href={href} {...rest}>{children}</a>;
};

export default MarkdownLink;
