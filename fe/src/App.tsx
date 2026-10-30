import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Compass,
  Globe2,
  Heart,
  Map,
  Menu,
  Route,
  Search,
  Volume2,
  X,
  UserRound,
  NotebookPen,
} from 'lucide-react';
import { useAuth } from './auth';
import { api, money, readStorage, writeStorage } from './lib/api';
import { speak } from './lib/speech';
import type { Catalog, Passport, Quest, Vendor } from './types';
import { AppContext } from './context';
import { BrandMark } from './components/Brand';
import { Modal } from './components/Modal';
import Discovery from './pages/Discovery';

const Journey = lazy(() => import('./pages/Journey'));
const Tools = lazy(() => import('./pages/Tools'));
const PassportPage = lazy(() => import('./pages/Passport'));
const Stories = lazy(() => import('./pages/Stories'));
const Account = lazy(() => import('./pages/Account'));
const Contribute = lazy(() => import('./pages/Contribute'));
const currentPage = () => window.location.hash.slice(1).split('?')[0] || 'discover';

export default function App() {
  const auth = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(currentPage);
  const [lang, setLang] = useState<'vi' | 'en'>(() =>
    readStorage<string>('gms-lang', 'vi') === 'en' ? 'en' : 'vi',
  );
  const [saved, setSaved] = useState<string[]>(() => {
    const value = readStorage<unknown>('gms-saved', []);
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  });
  const [active, setActive] = useState<Quest | null>(() => {
    const value = readStorage<Quest | null>('gms-active', null);
    return value &&
      Array.isArray(value.stops) &&
      value.stops.length &&
      typeof value.title === 'string'
      ? value
      : null;
  });
  const [passport, setPassport] = useState<Passport>({ stamps: [], totalVendors: 12 });
  const [passportError, setPassportError] = useState('');
  const [selected, setSelected] = useState<Quest | null>(null);
  const [story, setStory] = useState<Vendor | null>(null);
  const [message, setMessage] = useState('');
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const t = (vi: string, en: string) => (lang === 'vi' ? vi : en);
  const storyText = story ? (lang === 'en' ? story.storyEn || '' : story.story) : '';
  const storyAudioUrl = story
    ? lang === 'en'
      ? story.storyAudioUrlEn
      : story.storyAudioUrl
    : '';
  const storyTitle = story
    ? lang === 'en'
      ? story.nameEn || story.dishEn || 'Street food stall'
      : story.name
    : '';
  const storyIngredients = story
    ? lang === 'en'
      ? story.ingredientsEn?.length
        ? story.ingredientsEn.join(', ')
        : 'Ingredient details are not available in English. Please ask the vendor.'
      : story.ingredients.length
        ? story.ingredients.join(', ')
        : 'Chưa có thông tin nguyên liệu.'
    : '';
  const storyTip = story
    ? lang === 'en'
      ? story.tipEn || 'No English serving tip is available. Please ask the vendor.'
      : story.tip || 'Chưa có gợi ý thưởng thức.'
    : '';
  const load = useCallback(async () => {
    setError('');
    try {
      setCatalog(await api<Catalog>('/catalog'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const refreshPassport = useCallback(async () => {
    try {
      setPassport(await api<Passport>('/passport'));
      setPassportError('');
    } catch (e) {
      setPassportError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!auth.loading) void refreshPassport();
  }, [auth.loading, auth.user?.id, refreshPassport]);
  useEffect(() => {
    if (
      catalog &&
      active &&
      active.stops.some((stop) => !catalog.vendors.some((v) => v.id === stop.id))
    ) {
      setActive(null);
      writeStorage('gms-active', null);
      setMessage('Danh mục đã thay đổi. Hãy chọn lại hành trình để cập nhật điểm dừng.');
    }
  }, [catalog, active]);
  useEffect(() => {
    const onHash = () => {
      setPage(currentPage());
      setMenu(false);
      setSearchOpen(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    document.documentElement.lang = lang;
    writeStorage('gms-lang', lang);
  }, [lang]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [story],
  );
  const navigate = (next: string) => {
    window.location.hash = next;
  };
  const start = (quest: Quest) => {
    setActive(quest);
    writeStorage('gms-active', quest);
    setSelected(null);
    navigate('journey');
    setMessage(t('Hành trình đã sẵn sàng. Mình đi thôi!', 'Your journey is ready. Let’s go!'));
  };
  const toggleSave = (id: string) =>
    setSaved((previous) => {
      const next = previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id];
      writeStorage('gms-saved', next);
      return next;
    });
  const navItems = [
    { id: 'discover', label: t('Khám phá', 'Discover'), icon: Compass },
    { id: 'map', label: t('Bản đồ gánh hàng', 'Food map'), icon: Map },
    { id: 'stories', label: t('Chuyện của gánh', 'Our stories'), icon: BookOpen },
    { id: 'passport', label: t('Hộ chiếu ẩm thực', 'Food passport'), icon: BookOpen },
  ];
  const activeNav = ['journey', 'saved'].includes(page) ? 'discover' : page;
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        {t('Đến nội dung chính', 'Skip to content')}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#discover" aria-label="Chạm Vị — Trang chủ">
            <BrandMark />
            <span>
              Chạm Vị<small>STREET FOOD · HUMAN STORIES</small>
            </span>
          </a>
          <nav className="desktop-nav" aria-label={t('Điều hướng chính', 'Main navigation')}>
            {navItems.map((item) => (
              <a
                key={item.id}
                className={activeNav === item.id ? 'active' : ''}
                aria-current={activeNav === item.id ? 'page' : undefined}
                href={`#${item.id}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <a
              href="#account"
              className="icon-button account-button"
              aria-label={
                auth.user
                  ? `Tài khoản ${auth.user.name}`
                  : t('Đăng nhập / tài khoản', 'Sign in / account')
              }
            >
              <UserRound size={18} />
            </a>
            <button
              className="icon-button search-toggle"
              aria-label={t('Tìm hành trình', 'Search journeys')}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={20} />
            </button>
            <button
              className="language-button"
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              aria-label={t('Switch to English', 'Chuyển sang tiếng Việt')}
            >
              <Globe2 size={17} />
              <span>{lang.toUpperCase()}</span>
            </button>
            <button
              className="saved-button"
              aria-label={t('Đã lưu', 'Saved')}
              onClick={() => navigate('saved')}
            >
              <Heart size={17} />
              <span>{t('Đã lưu', 'Saved')}</span>
              {saved.length > 0 && <b>{saved.length}</b>}
            </button>
            <button
              className="icon-button menu-toggle"
              aria-label={t('Mở menu', 'Open menu')}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Menu">
            {navItems.map((item) => (
              <a key={item.id} href={`#${item.id}`} onClick={() => setMenu(false)}>
                <item.icon size={18} />
                {item.label}
              </a>
            ))}
            <a href="#voice" onClick={() => setMenu(false)}>
              <Volume2 size={18} />
              Voice bridge
            </a>
            <a href="#scan" onClick={() => setMenu(false)}>
              <Camera size={18} />
              {t('Quét món ăn', 'Scan a dish')}
            </a>
            <a href="#account" onClick={() => setMenu(false)}>
              <UserRound size={18} />
              {auth.user ? auth.user.name : t('Đăng nhập / tài khoản', 'Sign in / account')}
            </a>
            <a href="#contribute" onClick={() => setMenu(false)}>
              <NotebookPen size={18} />
              {t('Góp thông tin gánh hàng', 'Contribute a vendor')}
            </a>
          </nav>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        {error ? (
          <div className="state-panel container">
            <Compass size={48} />
            <h1>{t('Mình đang lạc kết nối một chút', 'A little connection detour')}</h1>
            <p>{error}</p>
            <button className="button primary" onClick={load}>
              {t('Thử lại', 'Try again')}
            </button>
          </div>
        ) : !catalog ? (
          <div className="container loading-shell" aria-busy="true">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-hero" />
            <p role="status">
              {t('Đang chuẩn bị những hành trình nhỏ…', 'Preparing your little adventures…')}
            </p>
          </div>
        ) : (
          <AppContext.Provider
            value={{
              catalog,
              passport,
              passportError,
              lang,
              t,
              active,
              saved,
              navigate,
              preview: setSelected,
              start,
              toggleSave,
              story: setStory,
              toast: setMessage,
              refreshPassport,
            }}
          >
            <Suspense
              fallback={
                <div className="state-panel" role="status">
                  {t('Đang mở trang…', 'Opening page…')}
                </div>
              }
            >
              {page === 'discover' || page === 'saved' ? (
                <Discovery savedOnly={page === 'saved'} search={search} onSearch={setSearch} />
              ) : page === 'journey' || page === 'map' ? (
                <Journey mapOnly={page === 'map'} />
              ) : page === 'voice' || page === 'scan' ? (
                <Tools mode={page} />
              ) : page === 'passport' ? (
                <PassportPage />
              ) : page === 'stories' ? (
                <Stories />
              ) : page === 'account' ? (
                <Account />
              ) : page === 'contribute' ? (
                <Contribute />
              ) : (
                <div className="state-panel">
                  <h1>{t('Trang này chưa có trong bản đồ', 'This page is off the map')}</h1>
                  <button className="button primary" onClick={() => navigate('discover')}>
                    {t('Về khám phá', 'Back to discovery')}
                  </button>
                </div>
              )}
            </Suspense>
          </AppContext.Provider>
        )}
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <a className="brand" href="#discover">
            <BrandMark size={32} />
            <span>Chạm Vị</span>
          </a>
          <p>
            {t(
              'Mỗi món ăn một di sản. Mỗi gánh hàng một cuộc đời.',
              'Every dish, a heritage. Every food cart, a life story.',
            )}
          </p>
          <span className="demo-label">
            {catalog?.dataMode === 'mixed'
              ? t('Dữ liệu mẫu & tham khảo', 'Sample & reference data')
              : t('Bản trải nghiệm · Dữ liệu minh họa', 'MVP preview · Illustrative data')}
          </span>
        </div>
        <div className="container footer-links">
          <a href="#contribute">
            <NotebookPen size={14} />
            {t('Góp thông tin gánh hàng', 'Contribute a vendor')}
          </a>
          <a href="#account">{t('Tài khoản của bạn', 'Your account')}</a>
          <a href="#admin">{t('Khu quản trị', 'Admin workspace')}</a>
          <a
            className="footer-inspired"
            href="https://ganhmuusinh.vn/"
            target="_blank"
            rel="noreferrer"
          >
            Inspired by ganhmuusinh.vn
          </a>
        </div>
      </footer>
      {active && !['journey', 'scan', 'voice'].includes(page) && (
        <button className="active-journey-pill" onClick={() => navigate('journey')}>
          <Route size={18} />
          <span>{t('Tiếp tục hành trình', 'Continue journey')}</span>
          <ArrowRight size={16} />
        </button>
      )}
      <div
        className={`toast ${message ? 'visible' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message && (
          <>
            <Check size={19} />
            <span>{message}</span>
            <button aria-label="Đóng thông báo" onClick={() => setMessage('')}>
              <X size={16} />
            </button>
          </>
        )}
      </div>
      {selected && (
        <Modal
          title={t('Một hành trình nhỏ đang chờ', 'A little adventure awaits')}
          onClose={() => setSelected(null)}
          wide
        >
          <img
            className="modal-cover"
            src={selected.image}
            alt={t('Ảnh minh họa đường phố Việt Nam', 'Illustrative Vietnamese street scene')}
          />
          <div className="modal-body">
            <span className="eyebrow">
              {selected.area ?? selected.region} · {selected.timeLabel}
            </span>
            <h3 className="display-small">{selected.title}</h3>
            <p className="muted">{selected.description}</p>
            <div className="journey-facts">
              <span>
                <Map size={17} />~{selected.distance} km
              </span>
              <span>
                {selected.duration} {t('phút', 'min')}
              </span>
              <strong>{money(selected.budget)}</strong>
            </div>
            <ol className="preview-stops">
              {selected.stops.map((v, i) => (
                <li key={v.id}>
                  <span className="stop-number">{i + 1}</span>
                  <div>
                    <strong>{v.name}</strong>
                    <small>
                      {t(v.dish, v.dishEn)} · {v.hours[0]}:00–{v.hours[1]}:00
                    </small>
                  </div>
                  <span>{money(v.price)}</span>
                </li>
              ))}
            </ol>
            <p className="small-note">
              {t(
                'Kiểm tra nguồn và giờ bán trước khi ghé. Dữ liệu mẫu được ghi rõ là minh họa; khoảng cách là ước tính, chưa phải chỉ đường thực tế.',
                'Check sources and opening hours before visiting. Sample data is illustrative; distances are estimates, not navigation.',
              )}
            </p>
            <button className="button primary full-width" onClick={() => start(selected)}>
              {t('Bắt đầu hành trình này', 'Start this journey')}
              <ArrowRight size={18} />
            </button>
          </div>
        </Modal>
      )}
      {story && (
          <Modal title={storyTitle} onClose={() => setStory(null)}>
          <div className="modal-body story-body">
            <span className="eyebrow">
              <Heart size={14} /> {t('MÓN ĂN & CÂU CHUYỆN', 'FOOD AND STORIES')}
            </span>
            <h3 className="display-small">
              {t('Mỗi món có một câu chuyện', 'Every dish has a story')}
            </h3>
            <blockquote>
              {storyText
                ? `“${storyText}”`
                : t(
                    'Chưa có câu chuyện được phép chia sẻ. Bạn có thể đối chiếu thông tin gánh hàng qua đường dẫn nguồn.',
                    'No story has been shared with permission yet. Check the source for vendor information.',
                  )}
            </blockquote>
            <p className="small-note">
              {t(
                story.dataType === 'illustrative' || !story.dataType
                  ? 'Gánh hàng và mô tả món là dữ liệu minh họa; ảnh không đại diện cho người bán thật.'
                  : 'Nội dung từ danh mục cộng đồng; ảnh mặc định chỉ minh họa. Hãy đối chiếu nguồn và cập nhật gần nhất.',
                story.dataType === 'illustrative' || !story.dataType
                  ? 'Vendor and dish details are illustrative; photos do not depict a real vendor.'
                  : 'Community directory content; default photos are illustrative. Check the source and latest updates.',
              )}
            </p>
            {story.sourceUrl && (
              <a className="source-link" href={story.sourceUrl} target="_blank" rel="noreferrer">
                {t('Nguồn thông tin · mở để đối chiếu', 'Source · open to cross-check')} ↗
              </a>
            )}
            {storyAudioUrl ? (
              <audio
                className="story-audio-player"
                controls
                preload="metadata"
                src={storyAudioUrl}
                aria-label={t(`Nghe lời kể về ${story.dish}`, `Listen to ${story.dishEn || story.dish}`)}
              />
            ) : (
              <>
                <button
                  className="button primary"
                  disabled={!storyText}
                  onClick={() =>
                    speak(storyText, undefined, setMessage, lang === 'en' ? 'en-US' : 'vi-VN')
                  }
                >
                  <Volume2 size={18} />
                  {t('Nghe lời kể · tiếng Việt', 'Listen · English')}
                </button>
                <button
                  className="button text-button"
                  onClick={() => window.speechSynthesis?.cancel()}
                >
                  {t('Dừng nghe', 'Stop audio')}
                </button>
              </>
            )}
            <div className="story-details">
              <p>
                <strong>{t('Món ăn', 'Dish')}</strong>
                {t(story.dish, story.dishEn)}
              </p>
              <p>
                <strong>{t('Nguyên liệu tham khảo', 'Illustrative ingredients')}</strong>
                {storyIngredients}
              </p>
              <p>
                <strong>{t('Cách thưởng thức', 'How to enjoy')}</strong>
                {storyTip}
              </p>
            </div>
          </div>
        </Modal>
      )}
      {searchOpen && (
        <Modal
          title={t('Hôm nay bạn thèm gì?', 'What are you craving?')}
          onClose={() => setSearchOpen(false)}
        >
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchOpen(false);
              navigate('discover');
              setTimeout(
                () => document.getElementById('journeys')?.scrollIntoView({ behavior: 'smooth' }),
                100,
              );
            }}
          >
            <label className="field-label" htmlFor="global-search">
              {t('Tìm món ăn, khu vực hoặc hành trình', 'Search dishes, places or journeys')}
            </label>
            <input
              id="global-search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Thử “bột chiên” hoặc “Vũng Tàu”…', 'Try “coffee” or “Vũng Tàu”…')}
            />
            <button className="button primary full-width" type="submit">
              <Search size={18} />
              {t('Tìm hành trình', 'Search journeys')}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
