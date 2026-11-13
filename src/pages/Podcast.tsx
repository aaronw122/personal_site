import usePageTitle from "../hooks/usePageTitle";
import { episodes, show, type Episode } from "../data/podcast";

interface Links {
  apple: string;
  spotify: string;
  youtube: string;
  rss: string;
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#9a3ff0" />
      <circle cx="12" cy="10" r="2.4" fill="#fff" />
      <path d="M10.6 14h2.8l-.6 5.5h-1.6z" fill="#fff" />
      <path
        d="M7.6 15.4a6 6 0 1 1 8.8 0M9.4 13.4a3.4 3.4 0 1 1 5.2 0"
        stroke="#fff"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1ed760" />
      <path
        d="M6.5 9.3c3.8-1.1 8-.8 11.2 1M7 12.4c3.2-.9 6.6-.6 9.3.9M7.5 15.3c2.6-.7 5.2-.5 7.4.7"
        stroke="#000"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect y="4" width="24" height="16" rx="4.5" fill="#ff0000" />
      <path d="M10 8.5v7l6-3.5z" fill="#fff" />
    </svg>
  );
}

function RssIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#f5a623" />
      <circle cx="7" cy="17" r="1.8" fill="#fff" />
      <path
        d="M5.5 11.5a7 7 0 0 1 7 7M5.5 6.5a12 12 0 0 1 12 12"
        stroke="#fff"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlatformLinks({ links }: { links: Links }) {
  return (
    <div className="podcast-links">
      <a href={links.apple} className="podcast-link">
        <AppleIcon />
        Apple Podcasts
      </a>
      <a href={links.spotify} className="podcast-link">
        <SpotifyIcon />
        Spotify
      </a>
      <a href={links.youtube} className="podcast-link">
        <YouTubeIcon />
        YouTube
      </a>
      <a href={links.rss} className="podcast-link">
        <RssIcon />
        RSS feed
      </a>
    </div>
  );
}

function episodeLinks(episode: Episode): Links {
  return {
    apple: episode.appleUrl ?? show.appleUrl,
    spotify: episode.spotifyUrl ?? show.spotifyUrl,
    youtube: `https://www.youtube.com/watch?v=${episode.youtubeId}`,
    rss: show.feedUrl,
  };
}

function EpisodeRow({ episode, featured }: { episode: Episode; featured: boolean }) {
  const links = episodeLinks(episode);
  return (
    <div className={featured ? "podcast-row podcast-featured" : "podcast-row"} id={episode.slug}>
      <a href={links.youtube} className="podcast-thumb" aria-label={`watch ${episode.guest} on youtube`}>
        <img
          src={`https://i.ytimg.com/vi/${episode.youtubeId}/hqdefault.jpg`}
          alt={`${show.title} with ${episode.guest}`}
          loading={featured ? "eager" : "lazy"}
        />
      </a>
      <div className="podcast-info">
        {featured && <span className="podcast-kicker">latest episode</span>}
        <h3 className="podcast-episode-title">{episode.guest}</h3>
        <p className="podcast-subtitle">
          {episode.date} · {episode.duration}
        </p>
        <PlatformLinks links={links} />
      </div>
    </div>
  );
}

export default function Podcast() {
  usePageTitle(show.title);
  const [latest, ...older] = episodes;
  return (
    <div className="podcast-page">
      <h2 className="podcast-title">{show.title}</h2>
      <p className="podcast-description">{show.description}</p>

      <EpisodeRow episode={latest} featured />

      {older.length > 0 && <h4 className="podcast-section-heading">previous episodes</h4>}
      {older.map((episode) => (
        <EpisodeRow key={episode.slug} episode={episode} featured={false} />
      ))}
    </div>
  );
}
