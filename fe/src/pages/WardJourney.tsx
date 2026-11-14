import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  ExternalLink,
  Footprints,
  MapPin,
  Route,
} from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import type { MapCandidate, Vendor, WardRoute } from '../types';

const FoodMap = lazy(() => import('../components/FoodMap'));
const noVendors: Vendor[] = [];

function directionsTo(stop: MapCandidate) {
  const query = new URLSearchParams({
    api: '1',
    destination: `${stop.lat},${stop.lng}`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${query}`;
}

export default function WardJourney() {
  const { wardRoute, openWardRoute, navigate, t } = useApp();
  const [hash, setHash] = useState(window.location.hash);
  const [loadedRoute, setLoadedRoute] = useState<WardRoute | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const ward = params.get('ward') ?? '';
  const routeId = params.get('route') ?? '';
  const remembered = wardRoute?.id === routeId && wardRoute.ward === ward ? wardRoute : null;
  const route =
    remembered ?? (loadedRoute?.id === routeId && loadedRoute.ward === ward ? loadedRoute : null);

  useEffect(() => {
    if (remembered) {
      setLoading(false);
      setError('');
      return;
    }
    if (!ward || !routeId) {
      setLoading(false);
      setError('Thiếu thông tin lộ trình. Hãy chọn lại từ trang khám phá.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api<{ routes: WardRoute[] }>('/planner/ward', { ward })
      .then(({ routes }) => {
        if (cancelled) return;
        const found = routes.find((item) => item.id === routeId);
        if (!found) {
          setError('Lộ trình này không còn trong danh sách tham khảo. Hãy chọn một tuyến khác.');
          return;
        }
        setLoadedRoute(found);
        openWardRoute(found);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ward, routeId, remembered, openWardRoute]);

  if (!route)
    return (
      <div className="container state-panel" role={loading ? 'status' : 'alert'}>
        <Route size={48} />
        <h1>
          {loading
            ? t('Đang mở lộ trình…', 'Opening your route…')
            : t('Chưa mở được lộ trình', 'Route unavailable')}
        </h1>
        <p>
          {loading
            ? t(
                'Mình đang lấy lại các điểm dừng trên bản đồ.',
                'Loading the route stops on the map.',
              )
            : error}
        </p>
        {!loading && (
          <button className="button primary" onClick={() => navigate('discover')}>
            {t('Tìm lộ trình khác', 'Find another route')}
            <ArrowRight size={17} />
          </button>
        )}
      </div>
    );

  const firstStop = route.stops[0];
  return (
    <div className="container inner-page ward-journey-page">
      <button
        className="back-link"
        onClick={() => navigate(`discover?ward=${encodeURIComponent(route.ward)}`)}
      >
        <ArrowLeft size={16} />
        {t('Chọn tuyến khác', 'Choose another route')}
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('LỘ TRÌNH THEO PHƯỜNG', 'WARD FOOD ROUTE')}</span>
          <h1>{route.title}</h1>
          <p>
            {t(
              'Các ghim tham khảo được xếp thành một vòng khám phá nhỏ. Kiểm tra từng địa điểm trước khi ghé.',
              'Reference pins arranged into a small food journey. Check each stop before visiting.',
            )}
          </p>
        </div>
        <span className="reference-badge">{t('Dữ liệu tham khảo', 'Reference data')}</span>
      </div>
      <div className="ward-journey-summary">
        <span>
          <MapPin size={17} />
          {route.stops.length} {t('điểm dừng', 'stops')}
        </span>
        <span>
          <Footprints size={17} />~{route.distance} km {t('ước tính', 'estimated')}
        </span>
        <span>
          <Clock3 size={17} />~{route.duration} {t('phút', 'min')}
        </span>
        <a
          className="button primary ward-directions"
          href={directionsTo(firstStop)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Chỉ đường đến điểm đầu', 'Directions to first stop')}
          <ExternalLink size={17} />
        </a>
      </div>
      <div className="map-layout ward-map-layout">
        <aside className="map-sidebar">
          <div className="map-sidebar-heading">
            <h2>{t('Đi lần lượt theo tuyến', 'Follow the route in order')}</h2>
            <span>
              {route.stops.length} {t('điểm', 'places')}
            </span>
          </div>
          <ol className="itinerary ward-itinerary">
            {route.stops.map((stop, index) => (
              <li key={stop.id}>
                <span className="stop-number ward-stop-number">{index + 1}</span>
                <div className="itinerary-content">
                  <div className="itinerary-topline">
                    <span>
                      {index === 0
                        ? t('Bắt đầu ở đây', 'Start here')
                        : t(`Điểm ${index + 1}`, `Stop ${index + 1}`)}
                    </span>
                  </div>
                  <h3>{stop.name}</h3>
                  <p>{stop.dish}</p>
                  <small>
                    <MapPin size={13} />
                    {stop.area || stop.ward || route.ward}
                  </small>
                  <div className="ward-stop-actions">
                    <a href={directionsTo(stop)} target="_blank" rel="noopener noreferrer">
                      {t('Chỉ đường', 'Directions')} <ArrowRight size={14} />
                    </a>
                    <a href={stop.mapUrl} target="_blank" rel="noopener noreferrer">
                      {t('Ghim nguồn', 'Source pin')} <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </aside>
        <div className="map-panel">
          <Suspense
            fallback={
              <div className="map-loading" role="status">
                {t('Đang mở bản đồ…', 'Opening map…')}
              </div>
            }
          >
            <FoodMap vendors={noVendors} routeCandidates={route.stops} route onSelect={() => {}} />
          </Suspense>
          <div className="map-caption">
            <MapPin size={15} />
            {t(
              'Ghim đánh số theo thứ tự · Nét đứt chỉ nối tọa độ, không phải đường đi thực tế',
              'Pins show stop order · The dashed line connects coordinates, not actual streets',
            )}
          </div>
        </div>
      </div>
      <p className="small-note page-note">
        {t(
          'Giờ bán, giá và tình trạng còn bán của các ghim tham khảo chưa được xác minh. Khoảng cách và thời gian là ước tính; hãy kiểm tra ghim nguồn hoặc hỏi người bán trước khi đi.',
          'Hours, prices and availability of reference pins are unverified. Distance and time are estimates; check the source pin or ask the vendor before visiting.',
        )}
      </p>
    </div>
  );
}
