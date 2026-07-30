import { QueryClient, isServer } from "@tanstack/react-query";

/**
 * React Query client factory (PROJECT_SETUP.md §3: "lib/ — Framework glue:
 * React Query client setup"). Follows the standard Next.js App Router
 * pattern: a fresh client per request on the server (so requests never
 * share cached data across users), a single persistent client in the
 * browser (so client-side navigation keeps its cache).
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
