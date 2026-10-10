"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import type { EndpointName, ResponseOf } from "@/contracts";
import { api, type CallOptions } from "./client";

/** Query any GET endpoint of the contract. */
export function useApi<N extends EndpointName>(
  name: N,
  opts: CallOptions<N> = {},
  options: Omit<UseQueryOptions<ResponseOf<N>>, "queryKey" | "queryFn"> = {},
) {
  return useQuery<ResponseOf<N>>({
    queryKey: [name, opts.params ?? null, opts.query ?? null, opts.body ?? null],
    queryFn: () => api(name, opts),
    ...options,
  });
}

/**
 * Call a mutating endpoint. On success every active query is refetched
 * (simple and always consistent for a demo-sized dataset).
 */
export function useApiMutation<N extends EndpointName>(name: N, config: { success?: string | ((data: ResponseOf<N>) => string); silent?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation<ResponseOf<N>, Error, CallOptions<N>>({
    mutationFn: (opts) => api(name, opts),
    onSuccess: async (data) => {
      await qc.invalidateQueries();
      if (config.success) toast.success(typeof config.success === "function" ? config.success(data) : config.success);
    },
    onError: (e) => {
      if (!config.silent) toast.error(e.message);
    },
  });
}
