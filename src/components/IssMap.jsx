import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { splitAntimeridian } from '../lib/orbit.js';
import { issIcon } from './issIcon.js';

const REAL_STYLE = { color: '#4f46e5', weight: 3, opacity: 0.9 };
const INFERRED_STYLE = { color: '#06b6d4', weight: 2.5, opacity: 0.9, dashArray: '6 8' };

function Follow({ position, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (enabled && position) map.panTo([position.lat, position.lon], { animate: true });
  }, [map, enabled, position?.lat, position?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function IssMap({ segments, position, follow }) {
  const lines = useMemo(
    () =>
      segments.flatMap((seg, i) =>
        splitAntimeridian(seg.points).map((latlngs, j) => ({
          key: `${i}-${j}`,
          kind: seg.kind,
          latlngs,
        })),
      ),
    [segments],
  );

  return (
    <MapContainer
      className="map"
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxBounds={[[-90, -200], [90, 200]]}
      worldCopyJump={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        noWrap
      />
      {lines.map((l) => (
        <Polyline
          key={l.key}
          positions={l.latlngs}
          pathOptions={l.kind === 'real' ? REAL_STYLE : INFERRED_STYLE}
        />
      ))}
      {position && (
        <Marker position={[position.lat, position.lon]} icon={issIcon}>
          <Popup>
            <b>국제 우주 정거장 (ISS)</b>
            <br />
            위도 {position.lat.toFixed(4)}°, 경도 {position.lon.toFixed(4)}°
          </Popup>
        </Marker>
      )}
      <Follow position={position} enabled={follow} />
    </MapContainer>
  );
}
