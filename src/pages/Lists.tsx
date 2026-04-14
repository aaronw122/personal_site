const lists = [
  { title: "questions", href: "/lists/questions/" },
  { title: "books", href: "/lists/books/" },
  { title: "media recs", href: "/lists/media%20recs/" },
  { title: "meditation corner", href: "/lists/meditation%20corner/" },
  { title: "cool people", href: "/lists/cool%20people/" },
  { title: "shows", href: "/lists/shows/" },
  { title: "life advice", href: "/lists/life%20advice/" },
  { title: "albums", href: "/lists/albums/" },
  { title: "movies", href: "/lists/movies/" },
  { title: "quotes", href: "/lists/quotes/" },
  { title: "hot takes", href: "/lists/Hot%20takes/" },
  { title: "misc", href: "/lists/misc/" },
];

export default function Lists() {
  return (
    <div>
      <h2>lists</h2>
      <p>just some samples from my notes app.</p>
      <hr />
      {lists.map((list) => (
        <p key={list.href}>
          <a href={list.href}>{list.title}</a>
        </p>
      ))}
    </div>
  );
}
