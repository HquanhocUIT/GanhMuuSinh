import { useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin } from 'lucide-react';
import { useApp } from '../context';
import { useAuth } from '../auth';
import AuthForm from '../components/AuthForm';
import { api } from '../lib/api';

export default function Contribute() {
  const { catalog, navigate } = useApp();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    name: '',
    dish: '',
    region: 'saigon',
    address: '',
    lat: '',
    lng: '',
    price: '',
    open: '',
    close: '',
    notes: '',
    sourceUrl: '',
  });
  const field = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  if (!auth.user)
    return (
      <div className="container inner-page account-layout">
        <section className="account-welcome">
          <span className="eyebrow">MỖI NGƯỜI GÓP MỘT CHÚT</span>
          <h1>Bạn biết một gánh hàng nhỏ?</h1>
          <p>
            Đăng nhập để gửi thông tin và theo dõi phản hồi. Đóng góp sẽ chờ xem xét trước khi trở
            thành nội dung công khai.
          </p>
        </section>
        <div className="surface-card">
          <AuthForm />
        </div>
      </div>
    );
  if (sent)
    return (
      <div className="container state-panel">
        <CheckCircle2 size={52} />
        <h1>Một địa chỉ đã được gửi đi.</h1>
        <p>
          Cảm ơn bạn đã góp một cuộc gặp. Quản trị viên sẽ kiểm tra thông tin và bổ sung những phần
          còn thiếu trước khi hiển thị.
        </p>
        <button className="button primary" onClick={() => navigate('account')}>
          Theo dõi đóng góp
          <ArrowRight size={17} />
        </button>
      </div>
    );
  return (
    <div className="container inner-page contribution-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">HELP KEEP THE MAP ALIVE</span>
          <h1>Góp một gánh, thêm một cuộc gặp.</h1>
          <p>Chia sẻ điều bạn biết. Phần chưa rõ cứ để trống, mình sẽ cùng kiểm tra.</p>
        </div>
        <MapPin size={34} />
      </div>
      <div className="contribution-layout">
        <form
          className="surface-card admin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setBusy(true);
            try {
              if (Boolean(values.open) !== Boolean(values.close))
                throw new Error('Điền cả giờ mở và đóng hoặc để trống cả hai.');
              if (Boolean(values.lat) !== Boolean(values.lng))
                throw new Error('Điền cả vĩ độ và kinh độ hoặc để trống cả hai.');
              await api('/submissions', {
                name: values.name,
                dish: values.dish,
                region: values.region,
                address: values.address,
                lat: values.lat ? Number(values.lat) : null,
                lng: values.lng ? Number(values.lng) : null,
                price: values.price ? Number(values.price) : null,
                hours:
                  values.open && values.close ? [Number(values.open), Number(values.close)] : null,
                notes: values.notes,
                sourceUrl: values.sourceUrl,
              });
              setSent(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="admin-form-grid">
            <label className="admin-field">
              Tên gánh hàng *
              <input
                required
                minLength={2}
                maxLength={160}
                value={values.name}
                onChange={(e) => field('name', e.target.value)}
              />
            </label>
            <label className="admin-field">
              Món / mặt hàng *
              <input
                required
                minLength={2}
                maxLength={160}
                value={values.dish}
                onChange={(e) => field('dish', e.target.value)}
              />
            </label>
            <label className="admin-field">
              Vùng đất *
              <select value={values.region} onChange={(e) => field('region', e.target.value)}>
                {catalog.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              Giá tham khảo (đ)
              <input
                type="number"
                min={0}
                max={1000000}
                value={values.price}
                onChange={(e) => field('price', e.target.value)}
                placeholder="Để trống nếu chưa biết"
              />
            </label>
            <label className="admin-field span-two">
              Địa chỉ / mô tả vị trí *
              <input
                required
                minLength={5}
                maxLength={500}
                value={values.address}
                onChange={(e) => field('address', e.target.value)}
                placeholder="Số nhà, đường hoặc điểm dễ nhận biết"
              />
            </label>
            {[
              ['lat', 'Vĩ độ', -90, 90],
              ['lng', 'Kinh độ', -180, 180],
              ['open', 'Giờ mở (0–23)', 0, 23],
              ['close', 'Giờ đóng (1–24)', 1, 24],
            ].map(([key, label, min, max]) => (
              <label className="admin-field" key={key}>
                {label}
                <input
                  type="number"
                  step={key === 'lat' || key === 'lng' ? 'any' : 1}
                  min={Number(min)}
                  max={Number(max)}
                  value={values[String(key)]}
                  onChange={(e) => field(String(key), e.target.value)}
                  placeholder="Chưa biết"
                />
              </label>
            ))}
            <label className="admin-field span-two">
              Đường dẫn nguồn / bài đăng
              <input
                type="url"
                maxLength={1000}
                value={values.sourceUrl}
                onChange={(e) => field('sourceUrl', e.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="admin-field span-two">
              Bạn đã thấy gì? *
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={values.notes}
                onChange={(e) => field('notes', e.target.value)}
                placeholder="Thời điểm bạn ghé, điểm nhận biết, thông tin cần kiểm tra…"
              />
            </label>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full-width" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi để quản trị viên xem xét'}
            <ArrowRight size={17} />
          </button>
        </form>
        <aside className="contribution-guide">
          <span className="eyebrow">MỘT VÀI ĐIỀU NHỎ</span>
          <h2>
            Thông tin đúng,
            <br />
            cuộc gặp gần hơn.
          </h2>
          <p>
            Chỉ chia sẻ những gì bạn biết. Giá và giờ bán có thể thay đổi; hãy ghi rõ lúc bạn ghé.
          </p>
          <p>
            Không gửi thông tin riêng tư hoặc sao chép câu chuyện đời của người bán khi chưa được
            đồng ý.
          </p>
          <p>
            Tiếp nhận đóng góp tạo ra một bản nháp. Thông tin chưa tự động xuất hiện trên bản đồ.
          </p>
        </aside>
      </div>
    </div>
  );
}
