import { useEffect, useState } from 'react';
import {
  ArrowRight,
  AudioLines,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  Footprints,
  Heart,
  Leaf,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useApp } from '../context';
import { api, money } from '../lib/api';
import type { Quest, RegionId, TimeSlot, WardRoute } from '../types';

export default function Discovery({
  savedOnly,
  search,
  onSearch,
}: {
  savedOnly: boolean;
  search: string;
  onSearch: (value: string) => void;
}) {
  const { catalog, t, saved, toggleSave, preview, navigate, story, openWardRoute } = useApp();
  const [region, setRegion] = useState('all');
  const [time, setTime] = useState('all');
  const [budget, setBudget] = useState(150000);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [all, setAll] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [ward, setWard] = useState(
    () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('ward') ?? '',
  );
  const [wardRoutes, setWardRoutes] = useState<WardRoute[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const selectedWard = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('ward');
    if (!selectedWard) return;
    let cancelled = false;
    api<{ routes: WardRoute[] }>('/planner/ward', { ward: selectedWard })
      .then(({ routes }) => {
        if (cancelled) return;
        setWardRoutes(routes);
        setAll(true);
        requestAnimationFrame(() =>
          document.getElementById('ward-routes-title')?.scrollIntoView({ block: 'start' }),
        );
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd');
  const filtered = catalog.quests.filter(
    (q) =>
      (!savedOnly || saved.includes(q.id)) &&
      (region === 'all' || q.region === region) &&
      (time === 'all' || q.time === time) &&
      q.budget <= budget &&
      !q.stops.some(
        (v) =>
          (excluded.length > 0 && v.allergensKnown === false) ||
          v.allergens.some((a) => excluded.includes(a)),
      ) &&
      normalize(
        [q.title, q.area, ...q.stops.map((v) => `${v.dish} ${v.dishEn} ${v.name}`)].join(' '),
      ).includes(normalize(search)),
  );
  const visible = all || savedOnly ? filtered : filtered.slice(0, 3);
  async function plan() {
    setPlanning(true);
    setError('');
    try {
      if (ward.trim()) {
        const result = await api<{ routes: WardRoute[] }>('/planner/ward', { ward: ward.trim() });
        setWardRoutes(result.routes);
        setAll(true);
        return;
      }
      setWardRoutes([]);
      preview(
        await api<Quest>('/planner', {
          region: (region === 'all' ? 'saigon' : region) as RegionId,
          time: (time === 'all' ? 'afternoon' : time) as TimeSlot,
          budget,
          excludeAllergens: excluded,
          maxStops: 4,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  }
  const reset = () => {
    setRegion('all');
    setTime('all');
    setBudget(150000);
    setExcluded([]);
    setWard('');
    setWardRoutes([]);
    onSearch('');
    setAll(false);
  };
  return (
    <div className="discovery-page">
      {!savedOnly && (
        <>
          <section className="hero container" aria-labelledby="hero-heading">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="little-line" />
                ĐI THEO VỊ NGON, CHẠM VÀO CÂU CHUYỆN
              </div>
              <h1 id="hero-heading">
                {t('Đi một vòng,', 'Take a little walk,')}
                <br />
                <em>{t('thương một chút.', 'find a little heart.')}</em>
                <svg
                  className="headline-underline"
                  viewBox="0 0 370 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 12C95 2 263 1 365 8M23 17c90-7 227-9 312-4"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </h1>
              <p>
                {t(
                  'Có những món ngon không nằm trong nhà hàng. Có những câu chuyện chỉ chờ bạn ghé lại, kéo chiếc ghế nhỏ và lắng nghe.',
                  'Some of the best meals come with a tiny stool and a life story. Follow the little food carts, meet the people, and taste a different side of Vietnam.',
                )}
              </p>
              <div className="hero-cta">
                <a
                  className="button primary"
                  href="#journeys"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('journeys')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {t('Tìm hành trình của bạn', 'Find your food journey')}
                  <ArrowRight size={18} />
                </a>
                <button className="button text-button" onClick={() => navigate('map')}>
                  <MapPin size={18} />
                  {t('Mở bản đồ', 'Explore the map')}
                </button>
              </div>
              <div className="hero-footnote">
                <div className="mini-people">
                  <span>
                    <Utensils size={16} />
                  </span>
                  <span>
                    <Heart size={16} />
                  </span>
                  <span>
                    <Leaf size={16} />
                  </span>
                </div>
                <p>
                  {t(
                    'Gánh nhỏ. Vị ngon. Tình người thật lớn.',
                    'Little carts. Big flavors. Even bigger hearts.',
                  )}
                  <small>
                    {t('Sài Gòn · Bình Dương · Vũng Tàu', 'Saigon · Binh Duong · Vung Tau')}
                  </small>
                </p>
              </div>
            </div>
            <div className="hero-art">
              <div className="hero-photo">
                <img
                  src="/images/street.jpg"
                  alt={t(
                    'Những gánh hàng và người bán trong một khu chợ Việt Nam — ảnh minh họa',
                    'Food vendors at a Vietnamese market — illustrative photo',
                  )}
                  fetchPriority="high"
                />
                <div className="photo-location">
                  <MapPin size={15} />
                  {t('Việt Nam, thương từ những điều nhỏ', 'Vietnam, loved through little things')}
                </div>
                <div className="photo-caption">
                  <span>THE SOUL OF THE STREETS</span>
                  <p>
                    {t('Một gánh hàng nhỏ.', 'One little food cart.')}
                    <br />
                    {t('Cả một đời thương.', 'A whole life of love.')}
                  </p>
                </div>
                <span className="image-credit">
                  {t('Ảnh minh họa · Pexels', 'Illustrative photo · Pexels')}
                </span>
              </div>
              <div className="round-seal">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <defs>
                    <path id="circle-text" d="M60,60m-45,0a45,45 0 1,1 90,0a45,45 0 1,1 -90,0" />
                  </defs>
                  <text>
                    <textPath href="#circle-text">ĐI ĐỂ HIỂU · ĂN ĐỂ THƯƠNG · </textPath>
                  </text>
                </svg>
                <Heart size={30} strokeWidth={1.5} />
              </div>
              <button
                className="story-peek"
                disabled={!catalog.vendors.length}
                onClick={() => {
                  if (catalog.vendors[0]) story(catalog.vendors[0]);
                }}
              >
                <span className="audio-illustration">
                  <AudioLines size={28} />
                </span>
                <span>
                  <small>{t('ĐẰNG SAU MỘT GÁNH HÀNG', 'BEHIND A LITTLE FOOD CART')}</small>
                  <strong>
                    {t('Có một câu chuyện chờ bạn.', 'There’s a story waiting for you.')}
                  </strong>
                  <span>
                    {t('Lắng nghe chuyện minh họa', 'Listen to a sample story')}
                    <ArrowRight size={14} />
                  </span>
                </span>
              </button>
              <svg className="hero-doodle" viewBox="0 0 100 80" fill="none" aria-hidden="true">
                <path
                  d="M90 8C30-6 2 22 21 34s55-3 35 26C47 73 21 76 8 67m0 0 3-14M8 67l15 1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
              </svg>
            </div>
          </section>
          <div className="values-strip container">
            <span>
              <Compass size={18} />
              {t('Khám phá theo cách của bạn', 'A journey at your own pace')}
            </span>
            <span>
              <ShieldCheck size={18} />
              {t('Hiểu món ăn trước khi thử', 'Know your food before you taste')}
            </span>
            <span>
              <Heart size={18} />
              {t('Công nghệ vì những gánh hàng', 'Technology with a human heart')}
            </span>
          </div>
        </>
      )}
      <section
        className={`journeys-section container ${savedOnly ? 'saved-section' : ''}`}
        id="journeys"
        aria-labelledby="journeys-heading"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {savedOnly ? 'YOUR LITTLE COLLECTION' : 'MANG THEO CHIẾC BỤNG ĐÓI'}
            </span>
            <h2 id="journeys-heading">
              {savedOnly
                ? t('Những hành trình đã thương', 'Journeys close to your heart')
                : t('Hôm nay, mình đi đâu ăn?', 'Where shall we eat today?')}
            </h2>
            <p>
              {savedOnly
                ? t(
                    'Để dành một cuộc hẹn với những gánh hàng nhỏ.',
                    'Save a little date with the street food you love.',
                  )
                : t(
                    'Chọn một hành trình nhỏ. Mang về thật nhiều điều dễ thương.',
                    'Pick a little adventure. Bring home a lot of lovely memories.',
                  )}
            </p>
          </div>
          {!savedOnly && (
            <button className="button text-button view-all" onClick={() => setAll(!all)}>
              {all
                ? t('Thu gọn', 'Show less')
                : t(
                    `Xem tất cả ${catalog.quests.length} hành trình`,
                    `All ${catalog.quests.length} journeys`,
                  )}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
        <div className="planner-box">
          <form
            className="planner-fields"
            onSubmit={(e) => {
              e.preventDefault();
              void plan();
            }}
          >
            <label className="planner-field">
              <MapPin size={20} />
              <span>
                <small>{t('BẠN MUỐN GHÉ ĐÂU?', 'WHERE TO?')}</small>
                <select
                  aria-label={t('Khu vực', 'Region')}
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setAll(true);
                  }}
                >
                  <option value="all">{t('Tất cả vùng đất', 'All destinations')}</option>
                  {catalog.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </span>
              <ChevronDown size={15} />
            </label>
            <label className="planner-field">
              <Clock3 size={20} />
              <span>
                <small>{t('LÚC NÀO NHỈ?', 'WHAT TIME?')}</small>
                <select
                  aria-label={t('Khung giờ', 'Time slot')}
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    setAll(true);
                  }}
                >
                  <option value="all">{t('Bất cứ lúc nào', 'Any time')}</option>
                  <option value="morning">{t('Buổi sáng · 7h–10h', 'Morning · 7am–10am')}</option>
                  <option value="afternoon">
                    {t('Xế chiều · 15h–18h', 'Afternoon · 3pm–6pm')}
                  </option>
                  <option value="night">{t('Phố đêm · 19h–23h', 'Night · 7pm–11pm')}</option>
                </select>
              </span>
              <ChevronDown size={15} />
            </label>
            <label className="planner-field budget-field">
              <Utensils size={20} />
              <span>
                <small>{t('CHIẾC VÍ CỦA BẠN', 'YOUR LITTLE BUDGET')}</small>
                <select
                  aria-label={t('Ngân sách', 'Budget')}
                  value={budget}
                  onChange={(e) => {
                    setBudget(Number(e.target.value));
                    setAll(true);
                  }}
                >
                  {[50000, 100000, 150000, 200000].map((n) => (
                    <option key={n} value={n}>
                      {t('Trong khoảng', 'Up to')} {money(n)}
                    </option>
                  ))}
                </select>
              </span>
              <ChevronDown size={15} />
            </label>
            <button type="submit" className="button primary planner-submit" disabled={planning}>
              <Sparkles size={18} />
              {planning ? t('Đang lên đường…', 'Planning…') : t('Gợi ý cho mình', 'Plan my quest')}
            </button>
          </form>
          <label className="planner-ward-search">
            <MapPin size={17} />
            <span>
              <small>{t('HOẶC KHÁM PHÁ THEO PHƯỜNG', 'OR EXPLORE BY WARD')}</small>
              <input
                list="available-wards"
                value={ward}
                onChange={(e) => {
                  setWard(e.target.value);
                  setWardRoutes([]);
                }}
                placeholder={t(
                  'Nhập tên phường, ví dụ: Phường Bến Thành',
                  'Enter a ward, e.g. Ben Thanh Ward',
                )}
                aria-label={t('Nhập phường muốn khám phá', 'Enter the ward you want to explore')}
              />
              <datalist id="available-wards">
                {catalog.wards.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </span>
            <span className="planner-ward-hint">
              {t('52 phường hiện có ghim tham khảo', 'Reference pins in 52 wards')}
            </span>
          </label>
          <div className="planner-bottom">
            <button
              className="filter-button"
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
            >
              <SlidersHorizontal size={15} />
              {t('Khẩu vị & dị ứng', 'Preferences & allergens')}
              {excluded.length > 0 && <span className="count-dot">{excluded.length}</span>}
              <ChevronDown size={14} className={advanced ? 'rotated' : ''} />
            </button>
            <span>
              {t(
                'Chưa chọn vùng/giờ? Mình gợi ý một chiều Sài Gòn.',
                'No destination yet? Try an afternoon in Saigon.',
              )}
            </span>
          </div>
          {advanced && (
            <fieldset className="allergen-filters">
              <legend>
                {t(
                  'Loại món theo nguyên liệu đã được ghi nhận trong danh mục',
                  'Exclude ingredients listed in the directory',
                )}
              </legend>
              <div className="chip-row">
                {catalog.allergens.map((a) => (
                  <label
                    className={`check-chip ${excluded.includes(a.id) ? 'selected' : ''}`}
                    key={a.id}
                  >
                    <input
                      type="checkbox"
                      checked={excluded.includes(a.id)}
                      onChange={(e) => {
                        setExcluded(
                          e.target.checked
                            ? [...excluded, a.id]
                            : excluded.filter((x) => x !== a.id),
                        );
                        setAll(true);
                      }}
                    />
                    {excluded.includes(a.id) && <Check size={14} />}
                    {t(a.name, a.en)}
                  </label>
                ))}
              </div>
              <p className="small-note">
                {t(
                  'Bộ lọc chưa xác nhận nguy cơ nhiễm chéo. Hãy hỏi trực tiếp người bán về nguyên liệu và cách chế biến.',
                  'The filter cannot assess cross-contact. Confirm ingredients and preparation with the vendor.',
                )}
              </p>
            </fieldset>
          )}
          {error && (
            <p className="inline-error planner-error" role="alert">
              {error}
            </p>
          )}
        </div>
        {wardRoutes.length > 0 && (
          <section
            className="ward-route-results"
            aria-live="polite"
            aria-labelledby="ward-routes-title"
          >
            <div className="ward-route-heading">
              <div>
                <span className="eyebrow">
                  {t('ĐI MỘT VÒNG, THỬ NHIỀU VỊ', 'A FEW LITTLE LOOPS')}
                </span>
                <h3 id="ward-routes-title">
                  {t(`Gợi ý quanh ${wardRoutes[0].ward}`, `Explore ${wardRoutes[0].ward}`)}
                </h3>
                <p>
                  {t(
                    `${wardRoutes.length} tuyến được chia từ các ghim khác nhau để hạn chế lặp điểm.`,
                    `${wardRoutes.length} routes use separate pins to reduce repetition.`,
                  )}
                </p>
              </div>
              <span className="reference-badge">{t('Dữ liệu tham khảo', 'Reference data')}</span>
            </div>
            <div className="ward-route-grid">
              {wardRoutes.map((route, index) => (
                <article className="ward-route-card" key={route.id}>
                  <div className="ward-route-card-top">
                    <span className="ward-route-number">{String(index + 1).padStart(2, '0')}</span>
                    <span>
                      {route.stopCount} {t('điểm', 'stops')} · ~{route.distance} km
                    </span>
                  </div>
                  <h4>{route.title}</h4>
                  <ol>
                    {route.stops.map((stop) => (
                      <li key={stop.id}>
                        <span>
                          <strong>{stop.dish}</strong>
                          <small>{stop.name}</small>
                        </span>
                        <a
                          href={stop.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${t('Mở bản đồ', 'Open map')}: ${stop.name}`}
                        >
                          <ArrowRight size={15} />
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="ward-route-note">
                    {t(
                      'Khoảng cách chỉ ước tính theo tọa độ. Chưa xác minh giờ bán, giá và tình trạng còn bán; hãy mở bản đồ để kiểm tra từng điểm trước khi đi.',
                      'Distance is estimated from coordinates. Hours, prices and current availability are unverified; open each map pin and confirm before visiting.',
                    )}
                  </p>
                  <button
                    type="button"
                    className="button primary ward-route-start"
                    onClick={() => openWardRoute(route)}
                    aria-label={t(
                      `Xem bản đồ và bắt đầu ${route.title}`,
                      `Open map and start ${route.title}`,
                    )}
                  >
                    <MapPin size={16} />
                    {t('Xem bản đồ & bắt đầu', 'Open map & start')}
                    <ArrowRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
        <div className="collection-toolbar">
          <div className="region-tabs" aria-label={t('Lọc khu vực', 'Filter destinations')}>
            {[{ id: 'all', name: t('Tất cả', 'All places') }, ...catalog.regions].map((r) => (
              <button
                key={r.id}
                className={region === r.id ? 'selected' : ''}
                aria-pressed={region === r.id}
                onClick={() => {
                  setRegion(r.id);
                  setAll(true);
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
          <label className="inline-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label={t('Tìm món hoặc hành trình', 'Search dishes or journeys')}
              placeholder={t('Tìm một vị ngon…', 'Find a flavor…')}
            />
            {search && (
              <button
                className="clear-search"
                onClick={() => onSearch('')}
                aria-label={t('Xóa tìm kiếm', 'Clear search')}
              >
                ×
              </button>
            )}
          </label>
        </div>
        {visible.length ? (
          <div className="quest-grid">
            {visible.map((q) => (
              <article className="quest-card" key={q.id}>
                <div className="quest-image-wrap">
                  <button
                    className="quest-image-link"
                    onClick={() => preview(q)}
                    aria-label={`${t('Xem hành trình', 'View journey')} ${q.title}`}
                  >
                    <img
                      src={q.image}
                      alt={t(
                        'Khung cảnh Việt Nam — ảnh minh họa',
                        'Vietnamese scene — illustrative photo',
                      )}
                      loading="lazy"
                    />
                    <span className={`quest-ribbon ${q.color ?? 'green'}`}>{q.label}</span>
                  </button>
                  <button
                    className={`save-quest ${saved.includes(q.id) ? 'is-saved' : ''}`}
                    aria-label={`${saved.includes(q.id) ? t('Bỏ lưu', 'Unsave') : t('Lưu', 'Save')} ${q.title}`}
                    aria-pressed={saved.includes(q.id)}
                    onClick={() => toggleSave(q.id)}
                  >
                    <Heart size={18} fill={saved.includes(q.id) ? 'currentColor' : 'none'} />
                  </button>
                  <span className="image-credit">{t('Ảnh minh họa', 'Illustrative photo')}</span>
                </div>
                <div className="quest-content">
                  <div className="quest-place">
                    <MapPin size={13} />
                    {q.area}
                    <span>·</span>
                    <span>{q.timeLabel}</span>
                  </div>
                  <h3>
                    <button onClick={() => preview(q)}>{q.title}</button>
                  </h3>
                  <p>{q.subtitle}</p>
                  <div className="quest-meta">
                    <span>
                      <Utensils size={15} />
                      {q.stopCount} {t('gánh hàng', 'stops')}
                    </span>
                    <span>
                      <Footprints size={16} />~{q.distance} km
                    </span>
                    <span>
                      <Clock3 size={15} />
                      {q.duration}′
                    </span>
                  </div>
                  <div className="quest-bottom">
                    <div>
                      <strong>{money(q.budget)}</strong>
                      <span> / {t('người, dự kiến', 'person, est.')}</span>
                    </div>
                    <button
                      className="card-arrow"
                      aria-label={`${t('Khám phá', 'Explore')} ${q.title}`}
                      onClick={() => preview(q)}
                    >
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Compass size={42} />
            <h3>
              {savedOnly && !saved.length
                ? t('Có hành trình nào làm bạn xao xuyến?', 'Found a journey you love?')
                : t('Chưa tìm thấy hành trình vừa ý', 'No journey matches just yet')}
            </h3>
            <p>
              {savedOnly && !saved.length
                ? t(
                    'Chạm vào trái tim trên thẻ hành trình để lưu lại nhé.',
                    'Tap the heart on a journey card to save it for later.',
                  )
                : t(
                    'Thử đổi bộ lọc hoặc để mình ghép một hành trình riêng cho bạn.',
                    'Try different filters or let us plan a custom quest.',
                  )}
            </p>
            <button
              className="button secondary"
              onClick={savedOnly && !saved.length ? () => navigate('discover') : reset}
            >
              {savedOnly && !saved.length
                ? t('Đi khám phá', 'Discover journeys')
                : t('Đặt lại bộ lọc', 'Reset filters')}
            </button>
          </div>
        )}
        <p className="collection-note">
          <Leaf size={14} />
          {t(
            'Kiểm tra nguồn và giờ bán trước khi ghé; dữ liệu mẫu được ghi rõ là minh họa. Mỗi lần mua, hãy trả tiền trực tiếp cho cô chú.',
            'Check sources and hours before visiting; sample data is marked illustrative. Pay the vendor directly.',
          )}
        </p>
      </section>
      {!savedOnly && (
        <>
          <section className="tools-banner container">
            <div className="tools-banner-copy">
              <span className="eyebrow">MỘT CHÚT CÔNG NGHỆ, THÊM NHIỀU KẾT NỐI</span>
              <h2>
                {t('Bớt ngại ngùng.', 'Less hesitation.')}
                <br />
                <em>{t('Thêm gần nhau.', 'More connection.')}</em>
              </h2>
              <p>
                {t(
                  'Để ngôn ngữ không còn là khoảng cách, và mỗi món ăn đều có cơ hội kể câu chuyện của mình.',
                  'Let language become a bridge, and give every dish a chance to tell its story.',
                )}
              </p>
            </div>
            <button className="tool-feature" onClick={() => navigate('voice')}>
              <span className="feature-icon">
                <AudioLines size={27} />
              </span>
              <h3>
                Voice Bridge <ArrowRight size={18} />
              </h3>
              <p>
                {t(
                  'Chọn món, chạm một lần. Gửi lời gọi món tiếng Việt thật gần gũi.',
                  'Pick your preferences. Speak a friendly Vietnamese order with one tap.',
                )}
              </p>
              <span className="feature-link">
                {t('Thử gọi món', 'Try voice ordering')}
                <ArrowRight size={15} />
              </span>
            </button>
            <button className="tool-feature" onClick={() => navigate('scan')}>
              <span className="feature-icon amber">
                <Camera size={27} />
              </span>
              <h3>
                Food X-Ray <ArrowRight size={18} />
              </h3>
              <p>
                {t(
                  'Quét món ngon, tìm hiểu nguyên liệu. Lưu một dấu nhỏ vào hộ chiếu.',
                  'Scan your dish, explore its ingredients, and collect a food passport stamp.',
                )}
              </p>
              <span className="feature-link">
                {t('Khám phá món ăn', 'Meet your dish')}
                <ArrowRight size={15} />
              </span>
            </button>
          </section>
          <section className="closing-note container">
            <span className="little-line" />
            <Heart size={20} />
            <span className="little-line" />
            <p>
              {t('Bạn đi tìm một món ngon.', 'You came for a good meal.')}
              <br />
              <em>{t('Biết đâu, lại mang về một câu chuyện.', 'You might leave with a story.')}</em>
            </p>
            <span>CHẠM VỊ · STREET-FOOD QUEST</span>
          </section>
        </>
      )}
    </div>
  );
}
