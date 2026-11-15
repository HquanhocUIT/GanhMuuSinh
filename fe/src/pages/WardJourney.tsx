import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock3,
  ExternalLink,
  Footprints,
  MapPin,
  Route,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context';
import { api, writeStorage } from '../lib/api';
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
  const { catalog, wardRoute, openWardRoute, passport, navigate, story, t } = useApp();
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
  const completed = route.stops.filter((stop) =>
    passport.stamps.some((stamp) => stamp.vendorId === stop.id),
  );
  const openTool = (tool: 'voice' | 'scan', id: string) => {
    writeStorage('gms-scan-vendor', id);
    navigate(tool);
  };
  const nextStop =
    route.stops.find((stop) => !completed.some((done) => done.id === stop.id)) ?? firstStop;
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
          <span className="eyebrow">YOUR STREET-FOOD QUEST · {t('THEO PHƯỜNG', 'BY WARD')}</span>
          <h1>{route.title}</h1>
          <p>
            {route.stops.length === 1
              ? t(
                  'Phường này hiện có một ghim món ăn tham khảo. Kiểm tra địa điểm trước khi ghé.',
                  'This ward currently has one reference food pin. Check the place before visiting.',
                )
              : t(
                  'Các ghim tham khảo được xếp thành một vòng khám phá nhỏ. Kiểm tra từng địa điểm trước khi ghé.',
                  'Reference pins arranged into a small food journey. Check each stop before visiting.',
                )}
          </p>
        </div>
        <div className="journey-progress">
          <strong>
            {completed.length}
            <span>/{route.stops.length}</span>
          </strong>
          <span>{t('điểm có dấu trải nghiệm', 'stops with a stamp')}</span>
        </div>
      </div>
      <div className="journey-summary ward-journey-summary">
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
        <span className="ward-unknown-price">{t('Giá chưa xác minh', 'Price unverified')}</span>
        <button className="button secondary small" onClick={() => openTool('voice', nextStop.id)}>
          <Volume2 size={16} /> Voice Bridge
        </button>
        <a
          className="button secondary small ward-directions"
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
            <h2>{t('Những điểm dừng của bạn', 'Your little stops')}</h2>
            <span>
              {route.stops.length} {t('điểm', 'places')}
            </span>
          </div>
          <ol className="itinerary ward-itinerary">
            {route.stops.map((stop, index) => {
              const stamped = passport.stamps.some((stamp) => stamp.vendorId === stop.id);
              const published = catalog.vendors.find((vendor) => vendor.id === stop.id);
              return (
                <li key={stop.id}>
                  <span className={`stop-number ward-stop-number ${stamped ? 'done' : ''}`}>
                    {stamped ? <Check size={16} /> : index + 1}
                  </span>
                  <div className="itinerary-content">
                    <div className="itinerary-topline">
                      <span>
                        {index === 0
                          ? t('Bắt đầu ở đây · Chưa rõ giờ bán', 'Start here · Hours unverified')
                          : t(
                              `Điểm ${index + 1} · Chưa rõ giờ bán`,
                              `Stop ${index + 1} · Hours unverified`,
                            )}
                      </span>
                      {stamped && <span className="status-tag">{t('Đã lưu dấu', 'Stamped')}</span>}
                    </div>
                    <h3>{stop.name}</h3>
                    <p>{stop.dish}</p>
                    <strong className="ward-stop-price">
                      {t('Giá chưa xác minh', 'Price unverified')}
                    </strong>
                    <small>
                      <MapPin size={13} />
                      {route.ward}
                      {stop.area ? ` · ${stop.area}` : ''}
                    </small>
                    <div className="itinerary-actions ward-quest-actions">
                      {published?.story ? (
                        <button onClick={() => story(published)}>
                          {t('Câu chuyện', 'Story')} <ArrowRight size={14} />
                        </button>
                      ) : (
                        <a href={stop.mapUrl} target="_blank" rel="noopener noreferrer">
                          {t('Thông tin ghim', 'Pin details')} <ExternalLink size={13} />
                        </a>
                      )}
                      <button onClick={() => openTool('scan', stop.id)}>
                        <Camera size={14} /> {t('Lưu dấu', 'Get a stamp')}
                      </button>
                    </div>
                    <div className="ward-stop-links">
                      <button onClick={() => openTool('voice', stop.id)}>
                        <Volume2 size={14} /> Voice Bridge
                      </button>
                      <a href={directionsTo(stop)} target="_blank" rel="noopener noreferrer">
                        {t('Chỉ đường', 'Directions')} <ArrowRight size={13} />
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
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
          'Ghim tham khảo chưa có câu chuyện được người bán đồng ý chia sẻ, giá hoặc giờ bán xác minh. Khoảng cách và thời gian là ước tính; hãy đối chiếu ghim nguồn trước khi đi. Dấu trải nghiệm không xác minh mua hàng hay vị trí.',
          'Reference pins lack vendor-approved stories, verified prices or opening hours. Distance and time are estimates; check the source pin before visiting. Experience stamps do not verify a purchase or location.',
        )}
      </p>
      <button className="button secondary ward-passport-link" onClick={() => navigate('passport')}>
        {t('Mở hộ chiếu ẩm thực', 'Open food passport')} <ArrowRight size={16} />
      </button>
    </div>
  );
}
