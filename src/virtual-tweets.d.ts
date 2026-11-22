declare module "virtual:tweets" {
  import type { Tweet } from "./lib/tweet";
  const tweets: ReadonlyMap<string, Tweet>;
  export default tweets;
}
