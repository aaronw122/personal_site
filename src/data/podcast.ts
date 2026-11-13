export interface Episode {
  slug: string;
  guest: string;
  date: string;
  duration: string;
  youtubeId: string;
  spotifyUrl?: string;
  appleUrl?: string;
}

export const show = {
  title: "no agendas",
  description: "a place where aaron shoots the shit with rc'ers.",
  spotifyUrl: "https://open.spotify.com/show/0qLt5acHVaRRu1YGpUObS5",
  appleUrl: "https://podcasts.apple.com/us/podcast/no-agendas/id6830902411",
  feedUrl: "https://media.rss.com/no-agendas/feed.xml",
};

export const episodes: Episode[] = [
  {
    slug: "sebastian-k",
    guest: "Sebastian K.",
    date: "nov 13, 2026",
    duration: "35:47",
    youtubeId: "KH53q1Nn_EE",
    spotifyUrl: "https://open.spotify.com/episode/3rK4TDwKiOw42MSrlbKBrO",
    appleUrl: "https://podcasts.apple.com/us/podcast/no-agendas-sebastian-k/id6830902411?i=1000801637532",
  },
  {
    slug: "levi-fussell",
    guest: "Levi Fussell",
    date: "nov 4, 2026",
    duration: "54:49",
    youtubeId: "6f173qV2hYE",
    spotifyUrl: "https://open.spotify.com/episode/2uTyq3lbQDWyGP1IGyclZh",
    appleUrl: "https://podcasts.apple.com/us/podcast/levi-fussell/id6830902411?i=1000799886496",
  },
];
