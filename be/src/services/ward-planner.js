import { readFileSync } from 'node:fs';
import { references } from '../data/references.js';
import { distanceKm } from './planner.js';

const wardFeatures = JSON.parse(
  readFileSync(new URL('../data/wards-hcm.geojson', import.meta.url), 'utf8'),
).features;

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng, lat, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    ([outer, ...holes]) =>
      pointInRing(lng, lat, outer) && !holes.some((hole) => pointInRing(lng, lat, hole)),
  );
}

function findWard(point) {
  return wardFeatures.find((feature) => pointInGeometry(point.lng, point.lat, feature.geometry))
    ?.properties.name;
}

const candidates = references
  .filter((ref) => Number.isFinite(ref.lat) && Number.isFinite(ref.lng))
  .map((ref) => ({
    id: `reference-${ref.id}`,
    name: ref.name,
    dish: ref.dish,
    category: ref.category,
    region: ref.region,
    area: ref.area,
    ward: findWard(ref),
    lat: ref.lat,
    lng: ref.lng,
    sourceUrl: ref.sourceUrl,
    mapUrl: ref.mapUrl,
  }));

export const referenceWards = [...new Set(candidates.map((candidate) => candidate.ward).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'vi'));

export function getWardCandidates() {
  return candidates;
}

function routeDistance(stops) {
  return stops.slice(1).reduce((sum, stop, i) => sum + distanceKm(stops[i], stop) * 1.3, 0);
}

// Greedily forms compact, non-overlapping walking loops. Each reference pin is
// assigned to at most one route in this response to keep alternatives distinct.
export function planWardRoutes(wardName) {
  const normalizedWard = wardName.trim().toLocaleLowerCase('vi');
  const remaining = candidates.filter(
    (candidate) => candidate.ward?.toLocaleLowerCase('vi') === normalizedWard,
  );
  if (!remaining.length) return [];

  const routes = [];
  const routeCount = Math.ceil(remaining.length / 3);
  const baseSize = Math.floor(remaining.length / routeCount);
  const largerRouteCount = remaining.length % routeCount;
  for (let routeIndex = 0; routeIndex < routeCount; routeIndex++) {
    const targetSize = baseSize + (routeIndex < largerRouteCount ? 1 : 0);
    const anchor = remaining.shift();
    const stops = [anchor];
    while (stops.length < targetSize && remaining.length) {
      const last = stops.at(-1);
      let closestIndex = 0;
      for (let i = 1; i < remaining.length; i++) {
        if (distanceKm(last, remaining[i]) < distanceKm(last, remaining[closestIndex]))
          closestIndex = i;
      }
      stops.push(remaining.splice(closestIndex, 1)[0]);
    }
    const distance = routeDistance(stops);
    routes.push({
      id: `${normalizedWard.replace(/[^\p{L}\p{N}]+/gu, '-')}-${routes.length + 1}`,
      title: `Vòng ${routes.length + 1} · ${wardName}`,
      ward: wardName,
      stops,
      stopCount: stops.length,
      distance: Number(distance.toFixed(1)),
      duration: Math.round((distance / 4) * 60 + stops.length * 20),
      label: 'Tuyến tham khảo',
    });
  }
  return routes;
}
