import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_URL = 'http://api.open-notify.org/iss-now.json';

export const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 30_000;
const MAX_ERROR_INTERVAL_MS = 60_000;
const LATENCY_FACTOR = 10; // 응답시간 1ms당 Polling 간격 10ms 추가
const EMA_ALPHA = 0.3;

// 응답 속도(지수이동평균)를 기반으로 다음 Polling 간격을 정한다.
// 응답이 느릴수록 간격을 늘리고, 실패가 이어지면 지수적으로 늘린다. 항상 5초 이상.
export function computeInterval(emaLatency, errorCount) {
  const base = Math.min(MAX_INTERVAL_MS, MIN_INTERVAL_MS + emaLatency * LATENCY_FACTOR);
  if (errorCount === 0) return Math.round(base);
  return Math.round(Math.min(MAX_ERROR_INTERVAL_MS, base * 2 ** errorCount));
}

export function useIssPosition() {
  const stats = useRef({ ema: null, errors: 0 });
  const [metrics, setMetrics] = useState({
    latency: null,
    avgLatency: null,
    interval: MIN_INTERVAL_MS,
    errors: 0,
  });

  const update = (latency, ok) => {
    const s = stats.current;
    if (ok) {
      s.ema = s.ema == null ? latency : s.ema * (1 - EMA_ALPHA) + latency * EMA_ALPHA;
      s.errors = 0;
    } else {
      s.errors += 1;
    }
    const interval = computeInterval(s.ema ?? latency, s.errors);
    setMetrics({ latency, avgLatency: s.ema, interval, errors: s.errors });
  };

  const query = useQuery({
    queryKey: ['iss-now'],
    queryFn: async ({ signal }) => {
      const started = performance.now();
      try {
        const res = await fetch(API_URL, { signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.message !== 'success') throw new Error('API 응답 오류');
        const latency = performance.now() - started;
        update(latency, true);
        return {
          t: json.timestamp * 1000,
          lat: Number(json.iss_position.latitude),
          lon: Number(json.iss_position.longitude),
          latency,
        };
      } catch (err) {
        if (err.name !== 'AbortError') update(performance.now() - started, false);
        throw err;
      }
    },
    retry: false,
    refetchInterval: () => computeInterval(stats.current.ema ?? 0, stats.current.errors),
    refetchIntervalInBackground: true,
    staleTime: MIN_INTERVAL_MS,
  });

  return { ...query, metrics };
}
