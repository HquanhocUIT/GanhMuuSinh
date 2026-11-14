import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapCandidate, Vendor } from '../types';
import { money } from '../lib/api';

function FitStops({
  vendors,
  candidates,
  routeCandidates,
}: {
  vendors: Vendor[];
  candidates: MapCandidate[];
  routeCandidates: MapCandidate[];
}) {
  const map = useMap();
  useEffect(() => {
    const points = [...vendors, ...candidates, ...routeCandidates];
    if (points.length)
      map.fitBounds(L.latLngBounds(points.map((v) => [v.lat, v.lng])), {
        padding: [45, 45],
        maxZoom: candidates.length ? 13 : 15,
      });
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [vendors, candidates, routeCandidates, map]);
  return null;
}

function CandidateLayer({ candidates }: { candidates: MapCandidate[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const clusters = useMemo(() => {
    const groups = new Map<string, MapCandidate[]>();
    for (const candidate of candidates) {
      const point = map.project([candidate.lat, candidate.lng], zoom);
      const key = `${Math.floor(point.x / 48)}:${Math.floor(point.y / 48)}`;
      groups.set(key, [...(groups.get(key) ?? []), candidate]);
    }
    return [...groups.values()].map((items) => ({
      id: items.map((item) => item.id).join('|'),
      items,
      lat: items.reduce((sum, item) => sum + item.lat, 0) / items.length,
      lng: items.reduce((sum, item) => sum + item.lng, 0) / items.length,
    }));
  }, [candidates, map, zoom]);

  return clusters.map((cluster) => {
    const grouped = cluster.items.length > 1;
    return (
      <Marker
        key={cluster.id}
        position={[cluster.lat, cluster.lng]}
        title={
          grouped
            ? `${cluster.items.length} ghim tham khảo chưa xác minh`
            : `${cluster.items[0].name} · tham khảo, chưa xác minh`
        }
        alt={
          grouped
            ? `${cluster.items.length} ghim tham khảo`
            : `${cluster.items[0].dish}, ghim tham khảo chưa xác minh`
        }
        icon={L.divIcon({
          html: grouped ? `<span>${cluster.items.length}</span>` : '<span><i></i></span>',
          className: grouped
            ? 'food-pin food-pin-candidate-cluster'
            : 'food-pin food-pin-candidate',
          iconSize: [grouped ? 40 : 32, grouped ? 40 : 32],
          iconAnchor: [grouped ? 20 : 16, grouped ? 20 : 16],
        })}
        eventHandlers={
          grouped
            ? {
                click: () =>
                  map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 18), {
                    animate: true,
                  }),
              }
            : undefined
        }
      >
        <Popup>
          <span className="map-candidate-status">
            {grouped
              ? `${cluster.items.length} ghim tham khảo · chưa xác minh`
              : 'Ghim tham khảo · chưa xác minh'}
          </span>
          {grouped ? (
            <>
              <strong>Nhấn ghim để phóng to khu vực</strong>
              <ul className="map-cluster-list">
                {cluster.items.slice(0, 6).map((candidate) => (
                  <li key={candidate.id}>
                    <a href={candidate.mapUrl} target="_blank" rel="noreferrer">
                      {candidate.dish}
                    </a>
                  </li>
                ))}
              </ul>
              {cluster.items.length > 6 && (
                <small>Còn {cluster.items.length - 6} ghim gần đây</small>
              )}
            </>
          ) : (
            <>
              <strong>{cluster.items[0].name}</strong>
              <p>{cluster.items[0].dish}</p>
              <a
                className="map-popup-link"
                href={cluster.items[0].mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                Đối chiếu trên Google Maps →
              </a>
            </>
          )}
        </Popup>
      </Marker>
    );
  });
}

export default function FoodMap({
  vendors,
  candidates = [],
  routeCandidates = [],
  route = false,
  onSelect,
}: {
  vendors: Vendor[];
  candidates?: MapCandidate[];
  routeCandidates?: MapCandidate[];
  route?: boolean;
  onSelect: (v: Vendor) => void;
}) {
  return (
    <MapContainer
      center={[10.7756, 106.6837]}
      zoom={14}
      className="food-map"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitStops vendors={vendors} candidates={candidates} routeCandidates={routeCandidates} />
      {route && vendors.length > 1 && (
        <Polyline
          positions={vendors.map((v) => [v.lat, v.lng])}
          pathOptions={{ color: '#b64b2d', weight: 4, dashArray: '8 10' }}
        />
      )}
      {routeCandidates.length > 1 && (
        <Polyline
          positions={routeCandidates.map((stop) => [stop.lat, stop.lng])}
          pathOptions={{ color: '#a95b2e', weight: 3, dashArray: '7 9' }}
        />
      )}
      {vendors.map((v, i) => (
        <Marker
          key={v.id}
          position={[v.lat, v.lng]}
          title={`${i + 1}. ${v.name}`}
          alt={v.name}
          icon={L.divIcon({
            html: `<span><b>${i + 1}</b></span>`,
            className: 'food-pin',
            iconSize: [44, 44],
            iconAnchor: [22, 44],
          })}
        >
          <Popup>
            <strong>{v.name}</strong>
            <p>
              {v.dish} · {money(v.price)}
            </p>
            <button className="map-popup-button" onClick={() => onSelect(v)}>
              Xem câu chuyện / Story →
            </button>
          </Popup>
        </Marker>
      ))}
      {candidates.length > 0 && <CandidateLayer candidates={candidates} />}
      {routeCandidates.map((stop, index) => (
        <Marker
          key={stop.id}
          position={[stop.lat, stop.lng]}
          title={`${index + 1}. ${stop.name} · ghim tham khảo`}
          alt={`${index + 1}. ${stop.dish}, ghim tham khảo chưa xác minh`}
          icon={L.divIcon({
            html: `<span>${index + 1}</span>`,
            className: 'food-pin food-pin-ward',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
          })}
        >
          <Popup>
            <span className="map-candidate-status">Điểm {index + 1} · chưa xác minh</span>
            <strong>{stop.name}</strong>
            <p>{stop.dish}</p>
            <a
              className="map-popup-link"
              href={stop.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Kiểm tra ghim nguồn →
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
