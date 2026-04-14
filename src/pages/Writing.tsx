const articles = [
  { title: "product thinking", href: "/writing/product%20thinking/" },
  { title: "fractal blogs", href: "/writing/fractal%20blogs/" },
  { title: "curation", href: "/writing/curation/" },
  { title: "ask questions", href: "/writing/ask%20questions/" },
  {
    title: "lessons from nonpolar",
    href: "/writing/lessons%20from%20nonpolar/",
  },
  {
    title: "fine tuning stable diffusion to create particle art",
    href: "/writing/fine%20tuning%20stable%20diffusion%20to%20create%20particle%20art/",
  },
  { title: "focus", href: "/writing/focus/" },
  { title: "introspection", href: "/writing/introspection/" },
];

export default function Writing() {
  return (
    <div>
      <h2>writing</h2>
      <p>just a sampling of the latent space in my brain.</p>
      <hr />
      {articles.map((article) => (
        <p key={article.href}>
          <a href={article.href}>{article.title}</a>
        </p>
      ))}
    </div>
  );
}
