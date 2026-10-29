import L from 'leaflet';

// 우주 정거장 모양 SVG 아이콘: 좌우 태양전지판 + 트러스 + 중앙 모듈
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="56" height="56">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="rgba(79,70,229,.15)" stroke="rgba(79,70,229,.45)" stroke-width="1"/>
  <rect x="4" y="30.5" width="56" height="3" rx="1" fill="#94a3b8"/>
  ${[6, 15, 41, 50]
    .map(
      (x) => `
  <g>
    <rect x="${x}" y="12" width="8" height="16" rx="1" fill="url(#panel)" stroke="#1e293b" stroke-width=".8"/>
    <rect x="${x}" y="36" width="8" height="16" rx="1" fill="url(#panel)" stroke="#1e293b" stroke-width=".8"/>
    <line x1="${x + 4}" y1="28" x2="${x + 4}" y2="36" stroke="#94a3b8" stroke-width="1.2"/>
    <line x1="${x}" y1="20" x2="${x + 8}" y2="20" stroke="#1e293b" stroke-width=".5"/>
    <line x1="${x}" y1="44" x2="${x + 8}" y2="44" stroke="#1e293b" stroke-width=".5"/>
  </g>`,
    )
    .join('')}
  <rect x="26" y="24" width="12" height="16" rx="3" fill="#f8fafc" stroke="#1e293b" stroke-width="1.2"/>
  <rect x="29" y="18" width="6" height="7" rx="1.5" fill="#e2e8f0" stroke="#1e293b" stroke-width="1"/>
  <rect x="29" y="39" width="6" height="7" rx="1.5" fill="#e2e8f0" stroke="#1e293b" stroke-width="1"/>
  <circle cx="32" cy="32" r="2.2" fill="#4f46e5"/>
</svg>`;

export const issIcon = L.divIcon({
  html: svg,
  className: 'iss-icon',
  iconSize: [56, 56],
  iconAnchor: [28, 28],
  popupAnchor: [0, -26],
});
