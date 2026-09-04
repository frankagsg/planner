import { useCallback, useEffect, useState } from 'react';
import { api, readCache } from '../lib/api';
import type { FamilyMember } from '../types';

// Shared family-member loader with a color/name lookup. Cached like other GETs
// so member colors resolve instantly and offline across every page.
export function useFamily(activeOnly = true) {
  const path = `/family${activeOnly ? '?activeOnly=1' : ''}`;
  const [members, setMembers] = useState<FamilyMember[]>(
    () => readCache<FamilyMember[]>(`/api${path}`) || []
  );

  const reload = useCallback(async () => {
    try {
      setMembers(await api.get<FamilyMember[]>(path, true));
    } catch {
      /* keep cache */
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byId = useCallback(
    (id?: number | null) => members.find((m) => m.id === id) || null,
    [members]
  );

  return { members, byId, reload };
}

// The color for a member id, falling back to the app accent.
export function memberColor(members: FamilyMember[], id?: number | null): string {
  const m = members.find((x) => x.id === id);
  return m?.color || 'rgb(var(--accent))';
}
