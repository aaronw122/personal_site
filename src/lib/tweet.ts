export interface TweetSegment {
  text: string;
  href?: string;
}

export interface TweetMedia {
  type: "photo" | "video" | "animated_gif";
  src: string;
  width: number;
  height: number;
}

export interface TweetQuote {
  url: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  segments: TweetSegment[];
  media: TweetMedia[];
}

export interface Tweet extends TweetQuote {
  date: string;
  likes: number;
  replies: number;
  quote?: TweetQuote;
}

const TWEET_URL = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/\s]+\/status\/(\d+)(?:[/?#]\S*)?$/;

export function tweetId(source: string): string | undefined {
  return TWEET_URL.exec(source.trim())?.[1];
}
