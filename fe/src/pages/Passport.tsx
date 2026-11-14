import { ArrowRight, Award, Camera, RefreshCw, Sparkles } from 'lucide-react';
import { useApp } from '../context';
import { writeStorage } from '../lib/api';
import { PassportStamp } from '../components/Brand';

export default function PassportPage() {
  const { catalog, passport, passportError, refreshPassport, t, navigate, story } = useApp();
  const unique = new Set(passport.stamps.map((s) => s.vendorId));
  const referenceStamps = catalog.mapCandidates.filter((pin) => unique.has(pin.id));
  const aiCount = passport.stamps.filter((s) => s.mode === 'ai-observed').length;
  return (
    <div className="container inner-page passport-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">COLLECT MOMENTS, NOT JUST MILES</span>
          <h1>{t('Hộ chiếu của những vị thương', 'A passport full of little memories')}</h1>
          <p>
            {t(
              'Mỗi dấu là một món ngon đã gặp, một câu chuyện đã nghe.',
              'Every stamp, a dish discovered. Every page, a story heard.',
            )}
          </p>
        </div>
        <button className="button secondary" onClick={() => void refreshPassport()}>
          <RefreshCw size={16} />
          {t('Làm mới', 'Refresh')}
        </button>
      </div>
      {passportError && (
        <p className="inline-error" role="alert">
          {passportError}
        </p>
      )}
      <div className="passport-overview">
        <div className="passport-book">
          <span>CHẠM VỊ</span>
          <Award size={58} strokeWidth={1} />
          <h2>
            FOOD
            <br />
            PASSPORT
          </h2>
          <small>ĐI MỘT VÒNG, THƯƠNG MỘT CHÚT.</small>
          <div className="book-bottom">
            STREET-FOOD QUEST <span>VN</span>
          </div>
        </div>
        <div className="passport-intro">
          <span className="eyebrow">
            <Sparkles size={14} /> THE TASTE OF YOUR JOURNEY
          </span>
          <h2>
            {unique.size
              ? t('Một chút vị ngon, đã thành kỷ niệm.', 'Little flavors, lasting memories.')
              : t('Trang đầu tiên đang chờ bạn.', 'Your first page is waiting.')}
          </h2>
          <p>
            {t(
              'Khám phá món ăn, lắng nghe câu chuyện và lưu dấu vào cuốn hộ chiếu nhỏ của riêng mình.',
              'Meet a dish, listen to a story, and keep a little stamp in your own food passport.',
            )}
          </p>
          <div className="passport-stats">
            <div>
              <strong>
                {unique.size}
                <span>/{passport.totalVendors}</span>
              </strong>
              <small>{t('Món đã khám phá', 'Dishes explored')}</small>
            </div>
            <div>
              <strong>{passport.stamps.length - aiCount}</strong>
              <small>{t('Dấu minh họa', 'Demo stamps')}</small>
            </div>
            <div>
              <strong>{aiCount}</strong>
              <small>{t('Dấu nhận diện AI', 'AI observations')}</small>
            </div>
          </div>
          <button
            className="button primary"
            onClick={() => navigate(unique.size ? 'scan' : 'discover')}
          >
            {unique.size ? <Camera size={18} /> : <ArrowRight size={18} />}
            {unique.size
              ? t('Lưu thêm một vị thương', 'Collect another flavor')
              : t('Bắt đầu chương đầu tiên', 'Start your first chapter')}
          </button>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">LITTLE BADGES, LOVELY MEMORIES</span>
          <h2>{t('Bộ sưu tập vị ngon', 'Your collection of flavors')}</h2>
        </div>
        <span className="muted">
          {unique.size} / {passport.totalVendors}
        </span>
      </div>
      <div className="badge-grid">
        {catalog.vendors.map((v, i) => {
          const stamps = passport.stamps.filter((s) => s.vendorId === v.id);
          const unlocked = stamps.length > 0;
          return (
            <button
              className={`badge-card ${unlocked ? 'unlocked' : 'locked'}`}
              key={v.id}
              onClick={() => {
                if (unlocked) story(v);
                else {
                  writeStorage('gms-scan-vendor', v.id);
                  navigate('scan');
                }
              }}
            >
              <PassportStamp index={i} locked={!unlocked} />
              <h3>{v.badge}</h3>
              <p>{t(v.dish, v.dishEn)}</p>
              <span className="badge-status">
                {unlocked
                  ? stamps.some((s) => s.mode === 'ai-observed')
                    ? t('AI đã nhận diện món', 'AI dish observation')
                    : t('Dấu trải nghiệm minh họa', 'Demo experience stamp')
                  : t('Chưa mở · khám phá món', 'Locked · meet the dish')}
              </span>
            </button>
          );
        })}
      </div>
      {referenceStamps.length > 0 && (
        <section
          className="reference-passport"
          aria-label={t('Dấu từ ghim tham khảo', 'Reference pin stamps')}
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">REFERENCE PIN MEMORIES</span>
              <h2>{t('Dấu từ hành trình theo phường', 'Ward journey stamps')}</h2>
            </div>
            <span className="muted">
              {referenceStamps.length} {t('ghim', 'pins')}
            </span>
          </div>
          <div className="badge-grid">
            {referenceStamps.map((pin, index) => {
              const stamps = passport.stamps.filter((stamp) => stamp.vendorId === pin.id);
              return (
                <button
                  className="badge-card unlocked"
                  key={pin.id}
                  onClick={() => {
                    writeStorage('gms-scan-vendor', pin.id);
                    navigate('scan');
                  }}
                >
                  <PassportStamp index={index} />
                  <h3>{pin.name}</h3>
                  <p>
                    {pin.dish} · {pin.ward}
                  </p>
                  <span className="badge-status">
                    {stamps.some((stamp) => stamp.mode === 'ai-observed')
                      ? t('AI nhận diện nhóm món', 'AI dish observation')
                      : t('Dấu trải nghiệm minh họa', 'Demo experience stamp')}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="small-note">
            {t(
              'Ghim tham khảo chưa xác minh người bán, nguyên liệu, giao dịch mua hoặc vị trí của bạn.',
              'Reference pins do not verify the vendor, ingredients, purchase or your location.',
            )}
          </p>
        </section>
      )}
      <p className="small-note passport-note">
        {t(
          'Hộ chiếu được lưu theo trình duyệt bằng cookie ẩn danh. Dấu minh họa và dấu nhận diện AI đều chưa xác minh giao dịch mua hàng hoặc vị trí thực tế. Xóa cookie sẽ tạo hộ chiếu mới.',
          'Your passport is saved for this browser using an anonymous cookie. Demo and AI stamps do not verify a purchase or physical location. Clearing cookies creates a new passport.',
        )}
      </p>
    </div>
  );
}
