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
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
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
  .filter(
    (ref) =>
      Number.isFinite(ref.lat) &&
      Number.isFinite(ref.lng) &&
      // Some public-list labels were cut off during extraction. Keep those
      // records for admin review, but never present a partial dish to visitors.
      !/(?:^|[\s,])\p{L}$/u.test(ref.dish.trim()),
  )
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

export const referenceWards = [
  ...new Set(candidates.map((candidate) => candidate.ward).filter(Boolean)),
].sort((a, b) => a.localeCompare(b, 'vi'));

export function getWardCandidates() {
  return candidates;
}

function routeDistance(stops) {
  return stops.slice(1).reduce((sum, stop, i) => sum + distanceKm(stops[i], stop) * 1.3, 0);
}

export function dishGroup(dish) {
  const normalized = dish
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // A branded or garnished variant still counts as the same food family.
  const families = [
    'banh mi',
    'banh bao',
    'banh bo',
    'banh cam',
    'banh beo',
    'banh khot',
    'banh bong lan',
    'nuoc mia',
    'ca phe',
    'bot chien',
    'goi kho bo',
    'pho',
    'xoi',
    'che',
  ];
  return (
    families.find((family) => normalized === family || normalized.startsWith(`${family} `)) ??
    normalized
  );
}

function shortestOrder(stops) {
  if (stops.length < 2) return { stops, distance: 0 };
  let best = null;
  function visit(prefix, remaining) {
    if (!remaining.length) {
      const distance = routeDistance(prefix);
      if (!best || distance < best.distance) best = { stops: prefix, distance };
      return;
    }
    for (let index = 0; index < remaining.length; index++)
      visit(
        [...prefix, remaining[index]],
        remaining.filter((_, i) => i !== index),
      );
  }
  visit([], stops);
  return best;
}

// At most nine pins fall in one ward today. Search all small partitions so
// distinct food families win first; walking distance breaks ties. Stops remain
// disjoint across suggestions, and duplicate families get separate loops when
// possible instead of being forced into a three-stop route.
export function planWardRoutes(wardName) {
  const normalizedWard = wardName.trim().toLocaleLowerCase('vi');
  const wardPins = candidates.filter(
    (candidate) => candidate.ward?.toLocaleLowerCase('vi') === normalizedWard,
  );
  if (!wardPins.length) return [];

  const groups = wardPins.map((pin) => dishGroup(pin.dish));
  const counts = new Map();
  for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
  const routeCount = Math.max(Math.ceil(wardPins.length / 3), ...counts.values());
  const sizes = Array.from(
    { length: routeCount },
    (_, i) => Math.floor(wardPins.length / routeCount) + (i < wardPins.length % routeCount ? 1 : 0),
  );
  const routeCache = new Map();
  function routeFor(mask) {
    if (routeCache.has(mask)) return routeCache.get(mask);
    const indices = wardPins.flatMap((_, index) => (mask & (1 << index) ? [index] : []));
    const ordered = shortestOrder(indices.map((index) => wardPins[index]));
    const duplicates = indices.length - new Set(indices.map((index) => groups[index])).size;
    const result = { ...ordered, duplicates };
    routeCache.set(mask, result);
    return result;
  }
  const memo = new Map();
  function choose(mask, slot) {
    if (slot === sizes.length) return { duplicates: 0, distance: 0, routes: [] };
    const key = `${mask}:${slot}`;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (let subset = mask; subset; subset = (subset - 1) & mask) {
      let size = 0;
      for (let bits = subset; bits; bits &= bits - 1) size++;
      if (size !== sizes[slot]) continue;
      const route = routeFor(subset);
      const next = choose(mask ^ subset, slot + 1);
      const candidate = {
        duplicates: route.duplicates + next.duplicates,
        distance: route.distance + next.distance,
        routes: [route, ...next.routes],
      };
      if (
        !best ||
        candidate.duplicates < best.duplicates ||
        (candidate.duplicates === best.duplicates && candidate.distance < best.distance - 1e-9)
      )
        best = candidate;
    }
    memo.set(key, best);
    return best;
  }
  return choose((1 << wardPins.length) - 1, 0).routes.map(({ stops, distance }, index) => ({
    id: `${normalizedWard.replace(/[^\p{L}\p{N}]+/gu, '-')}-${index + 1}`,
    revision: 2,
    title: `Vòng ${index + 1} · ${wardName}`,
    ward: wardName,
    stops,
    stopCount: stops.length,
    distance: Number(distance.toFixed(1)),
    duration: Math.round((distance / 4) * 60 + stops.length * 20),
    label: 'Tuyến tham khảo',
  }));
}
