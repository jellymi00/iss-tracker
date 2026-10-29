// ISS 궤도 추정 모델 (원궤도 근사)
// - 경사각 51.64°, 주기 약 92.9분의 원궤도로 가정
// - 지구 자전과 J2 섭동에 의한 승교점 이동(약 -5°/일)을 반영
// 실측 좌표 하나를 기준점으로 삼아 임의 시각의 위경도를 계산한다.

const DEG = Math.PI / 180;
const INCLINATION = 51.64 * DEG;
const PERIOD_S = 92.9 * 60;
const MEAN_MOTION = (2 * Math.PI) / PERIOD_S; // rad/s
const EARTH_ROT = 7.2921159e-5; // rad/s
const NODAL_PRECESSION = (-5.0 * DEG) / 86400; // rad/s

export const EARTH_RADIUS_KM = 6371;
export const ISS_ALTITUDE_KM = 420;

const SAMPLE_STEP_MS = 30_000;
export const GAP_THRESHOLD_MS = 90_000;

const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 궤도면 내 위치 u(승교점 기준 위도 인수)에서 승교점 대비 경도
const relLon = (u) => Math.atan2(Math.cos(INCLINATION) * Math.sin(u), Math.cos(u));

function makeAnchor(p, ascending) {
  const s = clamp(Math.sin(p.lat * DEG) / Math.sin(INCLINATION), -1, 1);
  const u0 = ascending ? Math.asin(s) : Math.PI - Math.asin(s);
  return { t: p.t, u0, node: p.lon * DEG - relLon(u0) };
}

function propagate(anchor, t) {
  const dt = (t - anchor.t) / 1000;
  const u = anchor.u0 + MEAN_MOTION * dt;
  const lat = Math.asin(Math.sin(INCLINATION) * Math.sin(u)) / DEG;
  const lon = (anchor.node + relLon(u) + (NODAL_PRECESSION - EARTH_ROT) * dt) / DEG;
  return { t, lat, lon: wrapLon(lon) };
}

function angularError(a, b) {
  const dLon = wrapLon(a.lon - b.lon);
  return Math.hypot(a.lat - b.lat, dLon * Math.cos(b.lat * DEG));
}

// 기준점 p의 상승/하강 여부를 인접 실측점과 가장 잘 맞는 쪽으로 결정한다.
export function anchorFor(p, neighbor) {
  const asc = makeAnchor(p, true);
  if (!neighbor) return asc;
  const desc = makeAnchor(p, false);
  return angularError(propagate(asc, neighbor.t), neighbor) <=
    angularError(propagate(desc, neighbor.t), neighbor)
    ? asc
    : desc;
}

// 두 실측점 사이 구간: 양쪽 기준점에서 각각 전파한 값을 시간 가중으로 섞는다.
function fillGap(a, aNeighbor, b, bNeighbor) {
  const ancA = anchorFor(a, aNeighbor);
  const ancB = anchorFor(b, bNeighbor);
  const out = [a];
  for (let t = a.t + SAMPLE_STEP_MS; t < b.t; t += SAMPLE_STEP_MS) {
    const w = (t - a.t) / (b.t - a.t);
    const fa = propagate(ancA, t);
    const fb = propagate(ancB, t);
    out.push({
      t,
      lat: fa.lat * (1 - w) + fb.lat * w,
      lon: wrapLon(fa.lon + wrapLon(fb.lon - fa.lon) * w),
    });
  }
  out.push(b);
  return out;
}

function backfill(first, neighbor, fromT) {
  const anc = anchorFor(first, neighbor);
  const out = [];
  for (let t = fromT; t < first.t; t += SAMPLE_STEP_MS) out.push(propagate(anc, t));
  out.push(first);
  return out;
}

/**
 * 실측 좌표 배열(시간순)로 최근 windowMs 구간의 궤적 세그먼트를 만든다.
 * 반환: [{ kind: 'real' | 'inferred', points: [{t,lat,lon}] }]
 */
export function buildTrack(points, now = Date.now(), windowMs = 4 * 3600_000) {
  if (points.length === 0) return [];
  const start = now - windowMs;
  const segments = [];

  // 1) 4시간 전 ~ 첫 실측점: 역방향 추정
  if (points[0].t - start > GAP_THRESHOLD_MS) {
    segments.push({ kind: 'inferred', points: backfill(points[0], points[1], start) });
  }

  // 2) 실측 구간과 단절 구간
  let current = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const p = points[i];
    if (p.t - prev.t > GAP_THRESHOLD_MS) {
      segments.push({ kind: 'real', points: current });
      segments.push({ kind: 'inferred', points: fillGap(prev, points[i - 2], p, points[i + 1]) });
      current = [p];
    } else {
      current.push(p);
    }
  }
  segments.push({ kind: 'real', points: current });
  return segments.filter((s) => s.points.length > 1 || s.kind === 'real');
}

// 날짜변경선(±180°)을 넘는 지점에서 선을 끊어 Leaflet 폴리라인 조각으로 만든다.
export function splitAntimeridian(points) {
  const parts = [];
  let part = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (part.length && Math.abs(p.lon - points[i - 1].lon) > 180) {
      if (part.length > 1) parts.push(part);
      part = [];
    }
    part.push([p.lat, p.lon]);
  }
  if (part.length > 1) parts.push(part);
  return parts;
}

// 궤도 고도 기준 두 점 사이 속도(km/h)
export function speedKmh(a, b) {
  const φ1 = a.lat * DEG;
  const φ2 = b.lat * DEG;
  const dφ = φ2 - φ1;
  const dλ = (b.lon - a.lon) * DEG;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const central = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const distKm = central * (EARTH_RADIUS_KM + ISS_ALTITUDE_KM);
  const hours = (b.t - a.t) / 3600_000;
  return hours > 0 ? distKm / hours : null;
}
