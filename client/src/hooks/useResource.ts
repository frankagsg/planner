import { useCallback, useEffect, useState } from 'react';
import { api, readCache } from '../lib/api';

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  offline: boolean;
  reload: () => Promise<void>;
}

// GET a cacheable resource. Seeds from localStorage cache immediately so the
// UI paints instantly and survives offline, then refreshes from the network.
export function useResource<T>(path: string, deps: unknown[] = []): State<T> {
  const [data, setData] = useState<T | null>(() => readCache<T>(`/api${path}`));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path, true);
      setData(result);
      setOffline(false);
    } catch (err: any) {
      if (err?.status === 0) {
        setOffline(true);
        const cached = readCache<T>(`/api${path}`);
        if (cached !== null) setData(cached);
        else setError('Offline — no cached data yet.');
      } else {
        setError(err?.message || 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, offline, reload };
}
