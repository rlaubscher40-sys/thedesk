import { trpc } from "@/lib/trpc";

/**
 * Lightweight auth state hook, returns the current user (or null) plus an
 * `isAuthenticated` flag. Cached at app scope by React Query.
 */
export function useAuth() {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  return {
    user: user ?? null,
    isAuthenticated: Boolean(user),
    isLoading,
  };
}
