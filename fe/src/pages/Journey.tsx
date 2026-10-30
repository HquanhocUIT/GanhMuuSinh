import { lazy, Suspense, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Clock3,
  Footprints,
  Heart,
  MapPin,
  Route,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context';
import { money, writeStorage } from '../lib/api';
const FoodMap = lazy(() => import('../components/FoodMap'));

export default function Journey({ mapOnly }: { mapOnly: boolean }) {
  const { catalog, active, passport, t, navigate, story } = useApp();
  const [region, setRegion] = useState('saigon');
  if (!mapOnly && !active)
    return (
      <div className="container state-panel">
        <Route size={48} />
        <span className="eyebrow">YOUR NEXT LITTLE ADVENTURE</span>
        <h1>{t('Mình bắt đầu từ đâu nhỉ?', 'Where shall we begin?')}</h1>
        <p>
          {t(
            'Chọn một hành trình để xem các điểm dừng, gọi món và gom dấu hộ chiếu.',
            'Choose a journey to see your stops, order a dish and collect passport stamps.',
          )}
        </p>
        <button className="button primary" onClick={() => navigate('discover')}>
          {t('Tìm một hành trình', 'Find a journey')}
          <ArrowRight size={18} />
        </button>
      </div>
    );
  const stops = mapOnly ? catalog.vendors.filter((v) => v.region === region) : active!.stops;
  const candidates = mapOnly
    ? catalog.mapCandidates.filter((candidate) => candidate.region === region)
    : [];
  const completed = stops.filter((v) => passport.stamps.some((s) => s.vendorId === v.id));
  const scan = (id: string) => {
    writeStorage('gms-scan-vendor', id);
    navigate('scan');
  };
  return (
    <div className="container inner-page">
      <button className="back-link" onClick={() => navigate('discover')}>
        <ArrowLeft size={16} />
        {t('Về khám phá', 'Back to discovery')}
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {mapOnly ? 'LITTLE CARTS, BIG HEARTS' : 'YOUR STREET-FOOD QUEST'}
          </span>
          <h1>
            {mapOnly ? t('Bản đồ những gánh thương', 'A map of little food carts') : active!.title}
          </h1>
          <p>
            {mapOnly
              ? t(
                  'Ghim xanh mở danh mục đã công khai; ghim cam là vị trí tham khảo chưa xác minh.',
                  'Green pins open published listings; amber pins show unverified references.',
                )
              : active!.subtitle}
          </p>
        </div>
        {!mapOnly && (
          <div className="journey-progress">
            <strong>
              {completed.length}
              <span>/{stops.length}</span>
            </strong>
            <span>{t('điểm có dấu trải nghiệm', 'stops with a stamp')}</span>
          </div>
        )}
      </div>
      {mapOnly ? (
        <div className="region-tabs map-tabs">
          {catalog.regions.map((r) => (
            <button
              key={r.id}
              className={region === r.id ? 'selected' : ''}
              aria-pressed={region === r.id}
              onClick={() => setRegion(r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="journey-summary">
          <span>
            <Clock3 size={18} />
            {active!.timeLabel}
          </span>
          <span>
            <Footprints size={18} />~{active!.distance} km · {active!.duration} {t('phút', 'min')}
          </span>
          <span>
            <Heart size={18} />
            {money(active!.budget)} / {t('người, dự kiến', 'person, est.')}
          </span>
          <button className="button secondary small" onClick={() => navigate('voice')}>
            <Volume2 size={16} />
            Voice Bridge
          </button>
        </div>
      )}
      <div className="map-layout">
        <aside className="map-sidebar">
          <div className="map-sidebar-heading">
            <h2>
              {mapOnly
                ? t('Những gánh quanh đây', 'Food carts nearby')
                : t('Những điểm dừng của bạn', 'Your little stops')}
            </h2>
            <span>
              {mapOnly ? stops.length + candidates.length : stops.length} {t('điểm', 'places')}
            </span>
          </div>
          <ol className="itinerary">
            {stops.map((v, i) => {
              const stamped = passport.stamps.some((s) => s.vendorId === v.id);
              return (
                <li key={v.id}>
                  <span className={`stop-number ${stamped ? 'done' : ''}`}>
                    {stamped ? <Check size={16} /> : i + 1}
                  </span>
                  <div className="itinerary-content">
                    <div className="itinerary-topline">
                      <span>{v.arrival ?? `${v.hours[0]}:00–${v.hours[1]}:00`}</span>
                      {stamped && <span className="status-tag">{t('Đã lưu dấu', 'Stamped')}</span>}
                    </div>
                    <h3>{v.name}</h3>
                    <p>{t(v.dish, v.dishEn)}</p>
                    <strong>{money(v.price)}</strong>
                    <small>
                      <MapPin size={13} />
                      {v.address}
                    </small>
                    <div className="itinerary-actions">
                      <button onClick={() => story(v)}>
                        {t('Câu chuyện', 'Read story')}
                        <ArrowRight size={14} />
                      </button>
                      <button onClick={() => scan(v.id)}>
                        <Camera size={14} />
                        {t('Lưu dấu', 'Get a stamp')}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {mapOnly && candidates.length > 0 && (
              <li className="map-candidate-heading">
                <span className="map-candidate-dot" aria-hidden="true" />
                <div>
                  <strong>{t('Ghim tham khảo, chưa xác minh', 'Unverified reference pins')}</strong>
                  <p>
                    {candidates.length} ·{' '}
                    {t('địa điểm từ nguồn công khai', 'public-source locations')}
                  </p>
                </div>
              </li>
            )}
            {mapOnly &&
              candidates.map((candidate) => (
                <li key={candidate.id} className="map-candidate-item">
                  <span className="map-candidate-dot" aria-hidden="true" />
                  <div className="itinerary-content">
                    <span className="map-candidate-category">{candidate.category}</span>
                    <h3>{candidate.name}</h3>
                    <p>{candidate.dish}</p>
                    <small>
                      <MapPin size={13} />
                      {candidate.area} · {candidate.lat.toFixed(5)}, {candidate.lng.toFixed(5)}
                    </small>
                    <a
                      className="map-candidate-source"
                      href={candidate.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('Mở ghim nguồn', 'Open source pin')} <ArrowRight size={13} />
                    </a>
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
            <FoodMap vendors={stops} candidates={candidates} route={!mapOnly} onSelect={story} />
          </Suspense>
          <div className="map-caption">
            <MapPin size={15} />
            {mapOnly
              ? t(
                  'Xanh: đã công khai · Cam: ghim tham khảo chưa xác minh',
                  'Green: published · Amber: unverified reference pins',
                )
              : t(
                  'Ghim theo danh mục · Nét đứt không phải chỉ đường',
                  'Directory locations · Dashed lines are not directions',
                )}
          </div>
        </div>
      </div>
      <p className="small-note page-note">
        {t(
          'Lớp bản đồ OpenStreetMap cần internet và dữ liệu theo ODbL. Ghim màu cam là mục tham khảo từ danh sách công khai, không cập nhật real-time và chưa được xác minh thông tin hoặc hoạt động.',
          'OpenStreetMap tiles require internet. Map data is © OpenStreetMap contributors under ODbL. Amber pins come from a public list snapshot; they are not live updates and their details or current activity have not been verified.',
        )}
        {mapOnly && (
          <>
            {' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap contributors
            </a>
            {' · '}
            <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noreferrer">
              ODbL
            </a>
          </>
        )}
      </p>
    </div>
  );
}
