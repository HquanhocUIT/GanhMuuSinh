import { vendors } from '../data/catalog.js';

export function distanceKm(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, i) =>
    permutations(items.filter((_, j) => i !== j)).map((rest) => [item, ...rest]),
  );
}

// Exhaustively evaluates up to four stops. Arrival and 20-minute visits must fit
// vendor hours and the selected time window. Distances are estimates, not routing.
export function planQuest(
  { region, time, budget, excludeAllergens = [], maxStops = 4 },
  collection = vendors,
) {
  const windows = { morning: [7, 10], afternoon: [15, 18], night: [19, 23] };
  const [start, end] = windows[time];
  const eligible = collection.filter(
    (v) =>
      v.region === region &&
      (excludeAllergens.length === 0 || v.allergensKnown !== false) &&
      !v.allergens.some((a) => excludeAllergens.includes(a)) &&
      v.hours[0] <= start &&
      v.hours[1] > start,
  );
  let best = null;
  function evaluate(stops) {
    const cost = stops.reduce((sum, v) => sum + v.price, 0);
    if (cost > budget) return;
    let hour = start,
      distance = 0;
    const itinerary = [];
    for (let i = 0; i < stops.length; i++) {
      if (i) {
        const leg = distanceKm(stops[i - 1], stops[i]) * 1.3;
        distance += leg;
        hour += leg / 4;
      }
      if (hour < stops[i].hours[0] || hour + 1 / 3 > Math.min(stops[i].hours[1], end)) return;
      const arrivalMinutes = Math.round(hour * 60);
      itinerary.push({
        ...stops[i],
        arrival: `${String(Math.floor(arrivalMinutes / 60)).padStart(2, '0')}:${String(arrivalMinutes % 60).padStart(2, '0')}`,
      });
      hour += 1 / 3;
    }
    if (
      !best ||
      stops.length > best.stops.length ||
      (stops.length === best.stops.length && distance < best.distance)
    ) {
      best = {
        id: 'custom',
        title: 'Một hành trình, đúng vị của bạn',
        subtitle: 'Dành riêng cho chiếc bụng đói và những bước chân tò mò.',
        region,
        time,
        timeLabel: `${start}:00 – ${end}:00`,
        stops: itinerary,
        stopCount: stops.length,
        budget: cost,
        duration: Math.round((hour - start) * 60),
        distance: Number(distance.toFixed(1)),
        image: '/images/street.jpg',
        label: 'HÀNH TRÌNH CỦA BẠN',
        difficulty: 'Dễ đi',
        dataType: stops.every((v) => v.dataType === 'illustrative') ? 'illustrative' : 'mixed',
        description:
          'Lộ trình gợi ý theo dữ liệu danh mục và khoảng cách ước tính. Hãy kiểm tra lại giờ bán trước khi ghé.',
      };
    }
  }
  // Enumerate subsets once, then choose their shortest feasible ordering.
  function subsets(current, index) {
    if (current.length) for (const route of permutations(current)) evaluate(route);
    if (current.length === maxStops) return;
    for (let i = index; i < eligible.length; i++) subsets([...current, eligible[i]], i + 1);
  }
  subsets([], 0);
  return best;
}
