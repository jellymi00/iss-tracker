import { useCallback, useEffect, useState } from 'react';
import { addPosition, clearAll, getRecent, pruneOld } from '../lib/db.js';

const PRUNE_EVERY_MS = 60_000;

// 새 좌표를 IndexedDB에 저장하고, 4시간이 지난 좌표는 주기적으로 삭제한다.
export function useTrackStore(position) {
  const [points, setPoints] = useState([]);

  const reload = useCallback(async () => {
    await pruneOld();
    setPoints(await getRecent());
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, PRUNE_EVERY_MS);
    return () => clearInterval(id);
  }, [reload]);

  useEffect(() => {
    if (!position) return;
    const { t, lat, lon } = position;
    addPosition({ t, lat, lon }).then(reload);
  }, [position?.t, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(async () => {
    await clearAll();
    setPoints([]);
  }, []);

  return { points, clear };
}
