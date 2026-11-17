import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import App, { preloadRoute } from "./App";

export { FIXED_ARTICLES } from "./App";

export async function render(url: string): Promise<string> {
  await preloadRoute(new URL(url, "https://awill.co").pathname);
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
    { progressiveChunkSize: Number.POSITIVE_INFINITY },
  );
  return new Response(prelude).text();
}
