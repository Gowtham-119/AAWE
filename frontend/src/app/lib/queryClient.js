import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

export const STATIC_STALE_TIME_MS = 5 * 60 * 1000;
export const LIVE_STALE_TIME_MS = 30 * 1000;
export const CACHE_STALE_TIME_MS = 5 * 60 * 1000;
export const CACHE_GC_TIME_MS = 10 * 60 * 1000;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const key = Array.isArray(query?.queryKey) ? query.queryKey.join(':') : 'unknown-query';
      console.error(`[QueryError] ${key}`, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const key = Array.isArray(mutation?.options?.mutationKey) ? mutation.options.mutationKey.join(':') : 'unknown-mutation';
      console.error(`[MutationError] ${key}`, error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: CACHE_STALE_TIME_MS,
      gcTime: CACHE_GC_TIME_MS,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
