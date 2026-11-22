import tweets from "virtual:tweets";
import "./tweetCard.css";
import { tweetId, type TweetMedia, type TweetQuote, type TweetSegment } from "../lib/tweet";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;
const COUNT_FORMAT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

const X_LOGO =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const VERIFIED =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z";
const HEART =
  "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z";
const REPLY =
  "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z";
const PLAY = "M21 12L4 2v20l17-10z";

function Author({ tweet, small }: { tweet: TweetQuote; small?: boolean }) {
  return (
    <a className="tweet-card-author" href={`https://x.com/${tweet.handle}`} {...EXTERNAL}>
      <img
        className={small ? "tweet-card-avatar is-small" : "tweet-card-avatar"}
        src={tweet.avatar}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className={small ? "tweet-card-names is-inline" : "tweet-card-names"}>
        <span className="tweet-card-name">
          <span className="tweet-card-name-text">{tweet.name}</span>
          {tweet.verified && <Icon d={VERIFIED} className="tweet-card-verified" />}
        </span>
        <span className="tweet-card-handle">@{tweet.handle}</span>
      </span>
    </a>
  );
}

function Text({ segments }: { segments: TweetSegment[] }) {
  return (
    <div className="tweet-card-text">
      {segments.map((s, i) =>
        s.href ? (
          <a key={i} className="tweet-card-link" href={s.href} {...EXTERNAL}>
            {s.text}
          </a>
        ) : (
          s.text
        ),
      )}
    </div>
  );
}

function Media({ media, url }: { media: TweetMedia[]; url: string }) {
  if (media.length === 0) return null;
  const single = media.length === 1;
  return (
    <div className={single ? "tweet-card-media" : "tweet-card-media is-grid"}>
      {media.map((m) => (
        <a key={m.src} className="tweet-card-media-item" href={url} {...EXTERNAL}>
          <img
            src={m.src}
            alt=""
            width={m.width}
            height={m.height}
            loading="lazy"
            decoding="async"
            style={single ? { aspectRatio: `${m.width} / ${m.height}` } : undefined}
          />
          {m.type !== "photo" && (
            <span className="tweet-card-play">
              <Icon d={PLAY} className="tweet-card-play-icon" />
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

export default function TweetCard({ source }: { source: string }) {
  const id = tweetId(source);
  const tweet = id ? tweets.get(id) : undefined;
  if (!tweet) return <p className="tweet-card-error">Could not load tweet: {source.trim()}</p>;

  return (
    <figure className="tweet-card">
      <div className="tweet-card-header">
        <Author tweet={tweet} />
        <a className="tweet-card-logo" href={tweet.url} aria-label="View on X" {...EXTERNAL}>
          <Icon d={X_LOGO} className="tweet-card-x" />
        </a>
      </div>
      <Text segments={tweet.segments} />
      <Media media={tweet.media} url={tweet.url} />
      {tweet.quote && (
        <div className="tweet-card-quote">
          <Author tweet={tweet.quote} small />
          <Text segments={tweet.quote.segments} />
          <Media media={tweet.quote.media.slice(0, 1)} url={tweet.quote.url} />
        </div>
      )}
      <div className="tweet-card-footer">
        <a className="tweet-card-date" href={tweet.url} {...EXTERNAL}>
          {tweet.date}
        </a>
        <span className="tweet-card-stat">
          <Icon d={HEART} className="tweet-card-stat-icon" />
          {COUNT_FORMAT.format(tweet.likes)}
        </span>
        <span className="tweet-card-stat">
          <Icon d={REPLY} className="tweet-card-stat-icon" />
          {COUNT_FORMAT.format(tweet.replies)}
        </span>
      </div>
    </figure>
  );
}
