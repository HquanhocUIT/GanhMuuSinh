import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Save, X } from 'lucide-react';
import { api } from '../lib/api';
import type { AdminData, AdminQuest, AdminVendor, Submission } from './types';

export function VendorForm({
  record,
  data,
  onSaved,
}: {
  record: AdminVendor | null;
  data: AdminData;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [
        'name',
        'nameEn',
        'dish',
        'dishEn',
        'owner',
        'region',
        'area',
        'address',
        'lat',
        'lng',
        'price',
        'years',
        'tip',
        'tipEn',
        'story',
        'storyEn',
        'storyAudioUrl',
        'storyAudioUrlEn',
        'badge',
        'image',
        'dataType',
        'sourceUrl',
        'sourceRecordId',
        'sourceRetrievedAt',
        'verification',
        'status',
      ].map((key) => [
        key,
        String(
          (record as unknown as Record<string, unknown> | null)?.[key] ??
            (
              {
                region: 'saigon',
                image: '/images/street.jpg',
                status: 'draft',
                dataType: 'community',
                verification: 'unverified',
                years: 0,
              } as Record<string, unknown>
            )[key] ??
            '',
        ),
      ]),
    ),
  );
  const [open, setOpen] = useState(record?.hours ? String(record.hours[0]) : '');
  const [close, setClose] = useState(record?.hours ? String(record.hours[1]) : '');
  const [ingredients, setIngredients] = useState(record?.ingredients.join(', ') ?? '');
  const [ingredientsEn, setIngredientsEn] = useState(record?.ingredientsEn?.join(', ') ?? '');
  const [allergens, setAllergens] = useState(record?.allergens ?? []);
  const [known, setKnown] = useState(record?.allergensKnown ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const live = values.status === 'published';
  const input = (key: string, label: string, required = false, type = 'text') => (
    <label
      className={`admin-field ${['address', 'sourceUrl', 'image'].includes(key) ? 'span-two' : ''}`}
      key={key}
    >
      {label}
      {required && ' *'}
      <input
        type={type}
        value={values[key]}
        required={required}
        maxLength={key === 'address' ? 500 : ['sourceUrl', 'image'].includes(key) ? 1000 : 160}
        onChange={(e) => update(key, e.target.value)}
      />
    </label>
  );
  return (
    <form
      className="admin-form modal-body"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
          if (Boolean(open) !== Boolean(close))
            throw new Error('Điền đủ hai giờ mở/đóng hoặc để trống cả hai.');
          await api(
            `/admin/vendors${record ? `/${record.id}` : ''}`,
            {
              ...values,
              lat: values.lat === '' ? null : Number(values.lat),
              lng: values.lng === '' ? null : Number(values.lng),
              price: values.price === '' ? null : Number(values.price),
              years: Number(values.years || 0),
              hours: open !== '' && close !== '' ? [Number(open), Number(close)] : null,
              ingredients: ingredients
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
              ingredientsEn: ingredientsEn
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
              allergens,
              allergensKnown: known,
              expectedRevision: record?.revision,
            },
            record ? 'PUT' : 'POST',
          );
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="admin-form-notice">
        Lưu bản nháp khi thông tin còn thiếu. Hiển thị công khai cần có vị trí, giá và giờ bán; dữ
        liệu thực tế cần đường dẫn nguồn. Bản nháp và mục lưu trữ không xuất hiện ở giao diện user.
      </p>
      <div className="admin-form-grid">
        {input('name', 'Tên gánh hàng', true)}
        {input('nameEn', 'Tên gánh hàng tiếng Anh')}
        {input('dish', 'Món / mặt hàng', true)}
        {input('dishEn', 'Tên món tiếng Anh')}
        {input('owner', 'Tên người bán (nếu được đồng ý)')}
        <label className="admin-field">
          Vùng đất *
          <select value={values.region} onChange={(e) => update('region', e.target.value)}>
            {data.overview.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {input('area', 'Khu vực / phường', live)}
        {input('address', 'Địa chỉ / điểm nhận biết', live)}
        {[
          ['lat', 'Vĩ độ', -90, 90],
          ['lng', 'Kinh độ', -180, 180],
          ['price', 'Giá tham khảo (đ)', 0, 1000000],
          ['years', 'Số năm bán (0 = chưa rõ)', 0, 150],
        ].map(([key, label, min, max]) => (
          <label className="admin-field" key={key}>
            {label}
            <input
              type="number"
              value={values[String(key)]}
              step={key === 'lat' || key === 'lng' ? 'any' : 1}
              min={Number(min)}
              max={Number(max)}
              required={live && key !== 'years'}
              onChange={(e) => update(String(key), e.target.value)}
            />
          </label>
        ))}
        <label className="admin-field">
          Giờ mở (0–23)
          <input
            type="number"
            min={0}
            max={23}
            required={live}
            value={open}
            onChange={(e) => setOpen(e.target.value)}
          />
        </label>
        <label className="admin-field">
          Giờ đóng (1–24)
          <input
            type="number"
            min={1}
            max={24}
            required={live}
            value={close}
            onChange={(e) => setClose(e.target.value)}
          />
        </label>
        {input('image', 'Đường dẫn ảnh (ảnh minh họa nếu chưa có)')}
        <label className="admin-field span-two">
          Nguyên liệu (ngăn cách bằng dấu phẩy)
          <input
            value={ingredients}
            maxLength={4000}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </label>
        <label className="admin-field span-two">
          Ingredients · English (comma-separated)
          <input
            value={ingredientsEn}
            maxLength={4000}
            onChange={(e) => setIngredientsEn(e.target.value)}
          />
        </label>
        <fieldset className="admin-allergens span-two">
          <legend>Thông tin nguyên liệu cần tránh</legend>
          <label className="consent-label">
            <input type="checkbox" checked={known} onChange={(e) => setKnown(e.target.checked)} />
            Đã có thông tin nguyên liệu để tham khảo bộ lọc dị ứng
          </label>
          <div className="chip-row">
            {data.overview.allergens.map((a) => (
              <label className="check-chip" key={a.id}>
                <input
                  type="checkbox"
                  checked={allergens.includes(a.id)}
                  onChange={(e) =>
                    setAllergens(
                      e.target.checked ? [...allergens, a.id] : allergens.filter((x) => x !== a.id),
                    )
                  }
                />
                {a.name}
              </label>
            ))}
          </div>
          <p className="small-note">
            Không đánh dấu khi chưa hỏi rõ. Gánh chưa có thông tin nguyên liệu bị loại khỏi các lộ
            trình đang bật bộ lọc dị ứng.
          </p>
        </fieldset>
        {input('badge', 'Tên dấu hộ chiếu')}
        <label className="admin-field">
          Nguồn dữ liệu
          <select value={values.dataType} onChange={(e) => update('dataType', e.target.value)}>
            <option value="community">Cộng đồng đóng góp</option>
            <option value="reference">Danh mục tham khảo</option>
            <option value="illustrative">Minh họa / hư cấu</option>
          </select>
        </label>
        <label className="admin-field span-two">
          Cách thưởng thức
          <textarea
            value={values.tip}
            rows={2}
            maxLength={1000}
            onChange={(e) => update('tip', e.target.value)}
          />
        </label>
        <label className="admin-field span-two">
          Serving tip · English
          <textarea
            value={values.tipEn}
            rows={2}
            maxLength={1000}
            onChange={(e) => update('tipEn', e.target.value)}
          />
        </label>
        <label className="admin-field span-two">
          Câu chuyện (chỉ đăng khi được đồng ý)
          <textarea
            value={values.story}
            rows={5}
            maxLength={5000}
            onChange={(e) => update('story', e.target.value)}
            placeholder="Để trống nếu chưa có câu chuyện được phép chia sẻ."
          />
        </label>
        <label className="admin-field span-two">
          Lời kể tiếng Anh
          <textarea
            value={values.storyEn}
            rows={4}
            maxLength={5000}
            onChange={(e) => update('storyEn', e.target.value)}
            placeholder="English narration text, if available."
          />
        </label>
        <label className="admin-field span-two">
          Story audio MP3 URL · Tiếng Việt
          <input
            type="text"
            value={values.storyAudioUrl}
            maxLength={1000}
            onChange={(e) => update('storyAudioUrl', e.target.value)}
            placeholder="/audio/stories/bot-chien.mp3"
          />
          <small>
            Đặt file trong fe/public/audio/stories/ rồi nhập đường dẫn /audio/stories/…mp3.
          </small>
        </label>
        <label className="admin-field span-two">
          Story audio MP3 URL · English
          <input
            type="text"
            value={values.storyAudioUrlEn}
            maxLength={1000}
            onChange={(e) => update('storyAudioUrlEn', e.target.value)}
            placeholder="/audio/stories/bot-chien-en.mp3"
          />
          <small>Đổi ngôn ngữ trên trang sẽ phát bản audio tương ứng.</small>
        </label>
        {input(
          'sourceUrl',
          'Đường dẫn nguồn HTTPS',
          live && values.dataType !== 'illustrative',
          'url',
        )}
        <label className="admin-field">
          Kiểm tra nội dung
          <select
            value={values.verification}
            onChange={(e) => update('verification', e.target.value)}
          >
            <option value="unverified">Chưa kiểm tra thực địa</option>
            <option value="reviewed">Đã được biên tập viên rà soát</option>
          </select>
        </label>
        <label className="admin-field">
          Trạng thái
          <select value={values.status} onChange={(e) => update('status', e.target.value)}>
            <option value="draft">Bản nháp</option>
            <option value="published">Đang hiển thị</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="admin-form-footer">
        <span>
          {record ? `Phiên bản ${record.revision} · Giữ nguyên lịch sử hộ chiếu` : 'Gánh hàng mới'}
        </span>
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy ? 'Đang lưu…' : 'Lưu gánh hàng'}
        </button>
      </div>
    </form>
  );
}

export function QuestForm({
  record,
  data,
  onSaved,
}: {
  record: AdminQuest | null;
  data: AdminData;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [
        'title',
        'subtitle',
        'description',
        'region',
        'area',
        'time',
        'image',
        'label',
        'color',
        'duration',
        'distance',
        'difficulty',
        'status',
      ].map((key) => [
        key,
        String(
          (record as unknown as Record<string, unknown> | null)?.[key] ??
            (
              {
                region: 'saigon',
                time: 'afternoon',
                image: '/images/street.jpg',
                label: 'HÀNH TRÌNH MỚI',
                color: 'green',
                duration: 90,
                distance: 1,
                difficulty: 'Dễ đi',
                status: 'draft',
              } as Record<string, unknown>
            )[key] ??
            '',
        ),
      ]),
    ),
  );
  const [ids, setIds] = useState(record?.vendorIds ?? []);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const update = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const move = (index: number, direction: number) =>
    setIds((old) => {
      const next = [...old];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  return (
    <form
      className="admin-form modal-body"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          if (!ids.length) throw new Error('Chọn ít nhất một điểm dừng.');
          const times: Record<string, string> = {
            morning: '07:00 – 10:00',
            afternoon: '15:00 – 18:00',
            night: '19:00 – 23:00',
          };
          await api(
            `/admin/quests${record ? `/${record.id}` : ''}`,
            {
              ...values,
              duration: Number(values.duration),
              distance: Number(values.distance),
              vendorIds: ids,
              timeLabel: times[values.time],
              expectedRevision: record?.revision,
            },
            record ? 'PUT' : 'POST',
          );
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="admin-form-grid">
        {[
          ['title', 'Tên hành trình'],
          ['subtitle', 'Mô tả ngắn'],
          ['area', 'Khu vực hiển thị'],
        ].map(([key, label]) => (
          <label className="admin-field span-two" key={key}>
            {label}
            <input
              required={key === 'title'}
              value={values[key]}
              maxLength={key === 'subtitle' ? 500 : 180}
              onChange={(e) => update(key, e.target.value)}
            />
          </label>
        ))}
        <label className="admin-field">
          Vùng đất
          <select
            value={values.region}
            onChange={(e) => {
              update('region', e.target.value);
              setIds([]);
            }}
          >
            {data.overview.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          Khung giờ
          <select value={values.time} onChange={(e) => update('time', e.target.value)}>
            <option value="morning">Sáng · 7h–10h</option>
            <option value="afternoon">Chiều · 15h–18h</option>
            <option value="night">Đêm · 19h–23h</option>
          </select>
        </label>
        <label className="admin-field">
          Thời gian dự kiến (phút)
          <input
            required
            type="number"
            min={10}
            max={360}
            value={values.duration}
            onChange={(e) => update('duration', e.target.value)}
          />
        </label>
        <label className="admin-field">
          Quãng đường ước tính (km)
          <input
            required
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={values.distance}
            onChange={(e) => update('distance', e.target.value)}
          />
        </label>
        <label className="admin-field span-two">
          Câu chuyện hành trình
          <textarea
            rows={3}
            maxLength={3000}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>
        <fieldset className="admin-stops-field span-two">
          <legend>Chọn 1–4 gánh hàng trong cùng vùng</legend>
          <div className="admin-stop-options">
            {data.vendors
              .filter((v) => v.region === values.region && v.status !== 'archived')
              .map((v) => (
                <label key={v.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(v.id)}
                    disabled={!ids.includes(v.id) && ids.length >= 4}
                    onChange={(e) =>
                      setIds(e.target.checked ? [...ids, v.id] : ids.filter((id) => id !== v.id))
                    }
                  />
                  <span>
                    {v.name}
                    <small>{v.status === 'published' ? 'Đang hiển thị' : 'Bản nháp'}</small>
                  </span>
                </label>
              ))}
          </div>
          <ol className="admin-ordered-stops">
            {ids.map((id, i) => (
              <li key={id}>
                <span>
                  {i + 1}. {data.vendors.find((v) => v.id === id)?.name ?? id}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Đưa điểm ${i + 1} lên`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Đưa điểm ${i + 1} xuống`}
                  disabled={i === ids.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Bỏ điểm ${i + 1}`}
                  onClick={() => setIds(ids.filter((x) => x !== id))}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ol>
        </fieldset>
        <label className="admin-field span-two">
          Đường dẫn ảnh
          <input value={values.image} onChange={(e) => update('image', e.target.value)} />
        </label>
        <label className="admin-field">
          Nhãn hành trình
          <input
            value={values.label}
            maxLength={100}
            onChange={(e) => update('label', e.target.value)}
          />
        </label>
        <label className="admin-field">
          Trạng thái
          <select value={values.status} onChange={(e) => update('status', e.target.value)}>
            <option value="draft">Bản nháp</option>
            <option value="published">Đang hiển thị</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </label>
      </div>
      <p className="small-note">
        Chỉ hành trình có tất cả gánh hàng đang hiển thị mới xuất hiện cho user. Ngân sách được tính
        từ giá từng điểm, không nhập tay.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-form-footer">
        <span>{ids.length}/4 điểm dừng</span>
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy ? 'Đang lưu…' : 'Lưu hành trình'}
        </button>
      </div>
    </form>
  );
}

export function ReviewForm({ record, onSaved }: { record: Submission; onSaved: () => void }) {
  const [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function review(decision: 'approved' | 'rejected') {
    setError('');
    if (note.trim().length < 3) {
      setError('Viết phản hồi ngắn cho người đóng góp trước nhé.');
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/submissions/${record.id}/review`, { decision, note });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-body review-details">
      <span className="eyebrow">ĐÓNG GÓP TỪ {record.author}</span>
      <h3>{record.payload.name}</h3>
      <p>
        <strong>Món:</strong> {record.payload.dish}
      </p>
      <p>
        <strong>Vị trí:</strong> {record.payload.address}
      </p>
      <p>
        <strong>Ghi chú:</strong> {record.payload.notes}
      </p>
      {record.payload.sourceUrl && (
        <a
          href={record.payload.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="button text-button"
        >
          Mở nguồn tham khảo ↗
        </a>
      )}
      <p className="admin-form-notice">
        Tiếp nhận sẽ tạo bản nháp gánh hàng. Bạn kiểm tra và bổ sung thông tin trước khi chuyển sang
        hiển thị công khai.
      </p>
      <label className="admin-field">
        Phản hồi cho người đóng góp
        <textarea
          rows={3}
          maxLength={1000}
          minLength={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-form-footer">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void review('rejected')}
        >
          Yêu cầu bổ sung
        </button>
        <button className="button primary" disabled={busy} onClick={() => void review('approved')}>
          <Check size={17} />
          {busy ? 'Đang xử lý…' : 'Tiếp nhận & tạo bản nháp'}
        </button>
      </div>
    </div>
  );
}
