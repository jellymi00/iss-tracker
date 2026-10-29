import { useEffect, useMemo, useState } from 'react';
import IssMap from './components/IssMap.jsx';
import { useIssPosition } from './hooks/useIssPosition.js';
import { useTrackStore } from './hooks/useTrackStore.js';
import { buildTrack, GAP_THRESHOLD_MS, speedKmh } from './lib/orbit.js';

const fmtNum = (v, digits = 0) =>
  v == null || Number.isNaN(v) ? '—' : v.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('ko-KR') : '—');

function useNow(everyMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

// 최근 실측점 쌍들의 속도 (단절 구간 제외)
function computeSpeeds(points) {
  const speeds = [];
  for (let i = points.length - 1; i > 0 && speeds.length < 10; i--) {
    const a = points[i - 1];
    const b = points[i];
    if (b.t - a.t > 0 && b.t - a.t <= GAP_THRESHOLD_MS) speeds.push(speedKmh(a, b));
  }
  const current = speeds[0] ?? null;
  const avg = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : null;
  return { current, avg };
}

export default function App() {
  const { data: position, metrics, isError, error, isFetching, dataUpdatedAt } = useIssPosition();
  const { points, clear } = useTrackStore(position);
  const [follow, setFollow] = useState(true);
  const now = useNow(15_000);

  const segments = useMemo(() => buildTrack(points, Math.max(now, dataUpdatedAt)), [points, now, dataUpdatedAt]);
  const { current: speed, avg: avgSpeed } = useMemo(() => computeSpeeds(points), [points]);
  const inferredCount = segments.filter((s) => s.kind === 'inferred').length;

  return (
    <>
      <div className="topbar">
        <span className="brand">🛰️ ISS Tracker</span>
        <nav>
          <a href="#map">실시간 궤적</a>
          <a href="#stats">속도 · Polling</a>
          <a href="#about">동작 원리</a>
        </nav>
      </div>

      <header className="hero">
        <span className="badge">React 19 · TanStack Query · IndexedDB</span>
        <h1>국제 우주 정거장 실시간 추적</h1>
        <p>Open Notify API로 ISS 위치를 수집하고, 최근 4시간의 궤적을 지도 위에 표시합니다. 수집되지 않은 구간은 궤도 모델로 추정하여 점선으로 그립니다.</p>
      </header>

      <main>
        <section id="map">
          <div className="section-head">
            <span className="chip">LIVE</span>
            <h2>최근 4시간 궤적</h2>
            <span className={`live-dot ${isError ? 'err' : isFetching ? 'busy' : ''}`} title={isError ? '오류' : '수신 중'} />
          </div>

          <div className="card map-card">
            <IssMap segments={segments} position={position} follow={follow} />
            <div className="map-toolbar">
              <div className="legend">
                <span><i className="ln solid" /> 실측 궤적</span>
                <span><i className="ln dashed" /> 계산/추정 궤적</span>
              </div>
              <div className="actions">
                <label>
                  <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> ISS 따라가기
                </label>
                <button type="button" onClick={clear}>저장 기록 삭제</button>
              </div>
            </div>
            {isError && <p className="error">⚠️ API 요청 실패: {error?.message} — 다음 Polling 간격 {fmtNum(metrics.interval / 1000, 1)}초 후 재시도</p>}
          </div>
        </section>

        <section id="stats">
          <div className="section-head">
            <span className="chip">STATUS</span>
            <h2>이동 속도 · API Polling</h2>
          </div>

          <div className="card">
            <h3>🚀 우주 정거장 이동 속도</h3>
            <div className="status-grid">
              <div className="status s3"><b>{fmtNum(speed)} km/h</b>현재 속도</div>
              <div className="status s3"><b>{fmtNum(speed && speed / 3600, 2)} km/s</b>초속 환산</div>
              <div className="status s2"><b>{fmtNum(avgSpeed)} km/h</b>최근 평균 속도</div>
            </div>
          </div>

          <div className="card">
            <h3>📡 API Polling 상태</h3>
            <div className="status-grid">
              <div className="status s4"><b>{fmtNum(metrics.interval / 1000, 1)} 초</b>현재 Polling 간격</div>
              <div className="status s2"><b>{fmtNum(metrics.latency)} ms</b>최근 API 응답 시간</div>
              <div className="status s2"><b>{fmtNum(metrics.avgLatency)} ms</b>평균 응답 시간 (EMA)</div>
              <div className={`status ${metrics.errors ? 's5' : 's3'}`}><b>{metrics.errors}</b>연속 실패 횟수</div>
            </div>
            <table>
              <tbody>
                <tr><th>현재 위치</th><td>{position ? `위도 ${position.lat.toFixed(4)}°, 경도 ${position.lon.toFixed(4)}°` : '—'}</td></tr>
                <tr><th>마지막 수신</th><td>{fmtTime(position?.t)}</td></tr>
                <tr><th>저장된 좌표 (IndexedDB)</th><td>{points.length}개 · 최근 4시간 유지</td></tr>
                <tr><th>추정 구간</th><td>{inferredCount}개 구간</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="about">
          <div className="section-head">
            <span className="chip">HOW</span>
            <h2>동작 원리</h2>
          </div>
          <div className="card">
            <h3>⚙️ 처리 흐름</h3>
            <ol className="steps">
              <li>TanStack Query가 <code>iss-now.json</code>을 주기적으로 요청하고 매 요청의 응답 시간을 측정합니다.</li>
              <li>Polling 간격 = <code>5초 + 평균응답시간 × 10</code> (최대 30초). 실패 시 간격을 2배씩 늘립니다(최대 60초). 항상 5초 이상입니다.</li>
              <li>수신한 좌표는 IndexedDB에 저장하고, 1분마다 4시간이 지난 좌표를 자동 삭제합니다.</li>
              <li>90초 이상 끊긴 구간과 4시간 전 ~ 첫 수집 시점 구간은 원궤도 모델(경사각 51.64°, 주기 92.9분, 지구 자전 반영)로 계산해 점선으로 표시합니다.</li>
              <li>속도는 연속된 두 실측점 사이의 대원 거리(고도 420km 기준)를 시간으로 나누어 계산합니다.</li>
            </ol>
          </div>
        </section>
      </main>

      <footer>
        데이터 출처: <a href="http://open-notify.org/" target="_blank" rel="noreferrer">Open Notify</a> · 지도: OpenStreetMap
      </footer>
    </>
  );
}
