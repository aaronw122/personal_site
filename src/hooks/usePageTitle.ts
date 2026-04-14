import { useEffect } from "react";

export default function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `${page} | awill.co`;
  }, [page]);
}
