import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import App from "./App";

export async function render(url: string): Promise<string> {
  let error: Error | undefined;
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
    {
      progressiveChunkSize: Number.POSITIVE_INFINITY,
      onError: (e) => {
        error ??= e instanceof Error ? e : new Error(String(e));
      },
    },
  );
  if (error) throw new Error(`[prerender] ${url} failed to render: ${error.stack ?? error.message}`);
  return new Response(prelude).text();
}
