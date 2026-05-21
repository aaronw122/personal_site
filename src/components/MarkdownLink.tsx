import { Link } from "react-router-dom";

export default function MarkdownLink(
  props: React.AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  const { href, children, ...rest } = props;
  if (href && href.startsWith("/")) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  return <a href={href} {...rest}>{children}</a>;
}
