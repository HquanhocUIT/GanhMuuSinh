import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AudioLines,
  Camera,
  CheckCircle2,
  ImagePlus,
  Info,
  Languages,
  Mic,
  Minus,
  Plus,
  ScanLine,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context';
import { api, readStorage, writeStorage } from '../lib/api';
import { createRecognition, speak } from '../lib/speech';
import { prepareScanImage } from '../lib/scan-image';
import { PassportStamp } from '../components/Brand';
import type { ScanResult } from '../types';

export default function Tools({ mode }: { mode: 'voice' | 'scan' }) {
  const { catalog, active, t, navigate } = useApp();
  const stored = readStorage<string>('gms-scan-vendor', '');
  const [vendorId, setVendorId] = useState(() =>
    [...catalog.vendors, ...catalog.mapCandidates].some((v) => v.id === stored)
      ? stored
      : (active?.stops[0]?.id ?? catalog.vendors[0]?.id ?? ''),
  );
  if (!catalog.vendors.length)
    return (
      <div className="container state-panel">
        <ScanLine size={45} />
        <h1>{t('Danh mục đang được chăm sóc.', 'The directory is being updated.')}</h1>
        <p>
          {t(
            'Chưa có gánh hàng đang hiển thị. Bạn có thể quay lại khám phá hoặc góp một địa chỉ mới.',
            'There are no published vendors yet. Check back later or contribute a new place.',
          )}
        </p>
        <button className="button primary" onClick={() => navigate('contribute')}>
          {t('Góp một gánh hàng', 'Contribute a vendor')}
        </button>
      </div>
    );
  return (
    <div className="container inner-page tools-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE TECH, A LOT OF CONNECTION</span>
          <h1>
            {mode === 'voice'
              ? t('Một chạm, gửi lời thân quen.', 'One tap. A friendly little order.')
              : t('Món ngon này có gì kể bạn?', 'What story is on your plate?')}
          </h1>
          <p>
            {mode === 'voice'
              ? t(
                  'Chọn ý muốn nói. Để chiếc điện thoại làm cầu nối với cô chú.',
                  'Pick what you want to say. Let your phone bridge the conversation.',
                )
              : t(
                  'Khám phá món ăn, hiểu nguyên liệu và lưu một dấu nhỏ vào hành trình.',
                  'Meet your dish, explore its ingredients, and collect a little memory.',
                )}
          </p>
        </div>
      </div>
      <div className="tool-tabs">
        <button
          className={mode === 'voice' ? 'selected' : ''}
          aria-pressed={mode === 'voice'}
          onClick={() => navigate('voice')}
        >
          <AudioLines size={18} />
          Voice Bridge
        </button>
        <button
          className={mode === 'scan' ? 'selected' : ''}
          aria-pressed={mode === 'scan'}
          onClick={() => navigate('scan')}
        >
          <ScanLine size={18} />
          Food X-Ray
        </button>
      </div>
      <div className="tool-vendor-select">
        <MapPinIcon />
        <label htmlFor="tool-vendor">
          {t('Món / gánh hàng đang khám phá', 'Dish / vendor you are exploring')}
          <select
            id="tool-vendor"
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              writeStorage('gms-scan-vendor', e.target.value);
            }}
          >
            {catalog.regions.map((r) => (
              <optgroup key={r.id} label={r.name}>
                {catalog.vendors
                  .filter((v) => v.region === r.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {t(v.dish, v.dishEn)}
                    </option>
                  ))}
              </optgroup>
            ))}
            <optgroup label={t('Ghim tham khảo', 'Reference pins')}>
              {catalog.mapCandidates.map((pin) => (
                <option key={pin.id} value={pin.id}>
                  {pin.name} · {pin.dish}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <span className="demo-label">
          {catalog.mapCandidates.some((pin) => pin.id === vendorId)
            ? t('Ghim tham khảo', 'Reference pin')
            : catalog.vendors.find((v) => v.id === vendorId)?.dataType === 'illustrative'
              ? t('Dữ liệu minh họa', 'Illustrative data')
              : t('Danh mục cộng đồng', 'Community directory')}
        </span>
      </div>
      {mode === 'voice' ? (
        <Voice key="voice" vendorId={vendorId} />
      ) : (
        <Scanner key={vendorId} vendorId={vendorId} />
      )}
      <p className="small-note page-note">
        {t(
          'Công nghệ nằm trên thiết bị của người khám phá. Cô chú không cần cài ứng dụng, tạo tài khoản hay trả hoa hồng.',
          'The technology lives on the visitor’s device. Vendors do not need an app, account, or commission payments.',
        )}
      </p>
    </div>
  );
}
function MapPinIcon() {
  return (
    <span className="select-feature-icon">
      <Languages size={23} />
    </span>
  );
}

const orderOptions = [
  { id: 'no-onion', vi: 'Không hành', en: 'No spring onion' },
  { id: 'less-spicy', vi: 'Ít cay', en: 'Less spicy' },
  { id: 'no-peanut', vi: 'Không đậu phộng', en: 'No peanuts' },
  { id: 'takeaway', vi: 'Mang về', en: 'Take away' },
  { id: 'no-cilantro', vi: 'Không ngò', en: 'No cilantro' },
];

function Voice({ vendorId }: { vendorId: string }) {
  const { catalog, t, toast } = useApp();
  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState<string[]>([]);
  const [order, setOrder] = useState<{ vietnamese: string; english: string } | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [response, setResponse] = useState('');
  const [translation, setTranslation] = useState('');
  const [source, setSource] = useState('');
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const recognition = useRef<ReturnType<typeof createRecognition>>(null);
  const [supportsMic] = useState(() => createRecognition() !== null);
  useEffect(() => {
    let alive = true;
    setOrderLoading(true);
    setOrderError('');
    setOrder(null);
    setSpeaking(false);
    window.speechSynthesis?.cancel();
    api<{ vietnamese: string; english: string }>('/orders/compose', { vendorId, quantity, options })
      .then((value) => {
        if (alive) setOrder(value);
      })
      .catch((e) => {
        if (alive) setOrderError(e.message);
      })
      .finally(() => {
        if (alive) setOrderLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [vendorId, quantity, options]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      const mic = recognition.current;
      if (mic) {
        mic.onresult = null;
        mic.onerror = null;
        mic.onend = null;
        mic.abort();
      }
    },
    [],
  );
  function play() {
    if (!order) return;
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(
      order.vietnamese,
      () => setSpeaking(false),
      (message) => {
        setSpeaking(false);
        toast(message);
      },
    );
  }
  function record() {
    if (recording) {
      recognition.current?.abort();
      setRecording(false);
      return;
    }
    const mic = createRecognition();
    if (!mic) return;
    setError('');
    setResponse('');
    setTranslation('');
    setSource('');
    mic.lang = 'vi-VN';
    mic.interimResults = false;
    mic.continuous = false;
    mic.onresult = (event) => {
      setResponse(event.results[0][0].transcript);
    };
    mic.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? t(
              'Chưa có quyền micro. Cho phép trong trình duyệt hoặc nhập lời cô chú bên dưới.',
              'Microphone permission was denied. Allow it in your browser or type the response below.',
            )
          : t(
              'Chưa nghe rõ. Thử lại hoặc nhập lời cô chú nhé.',
              'Could not hear clearly. Try again or type the response.',
            ),
      );
      setRecording(false);
    };
    mic.onend = () => setRecording(false);
    recognition.current = mic;
    try {
      mic.start();
      setRecording(true);
    } catch {
      setError(
        t(
          'Không khởi động được micro. Bạn có thể nhập lời cô chú.',
          'Could not start the microphone. You can type the response.',
        ),
      );
    }
  }
  async function translate() {
    setTranslating(true);
    setError('');
    setTranslation('');
    try {
      const result = await api<{ translation: string; source: string }>('/translate', {
        text: response,
      });
      setTranslation(result.translation);
      setSource(result.source);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTranslating(false);
    }
  }
  return (
    <div className="voice-layout">
      <section className="surface-card order-panel">
        <span className="eyebrow">01 · {t('MÌNH MUỐN GỌI…', 'I WOULD LIKE…')}</span>
        <h2>{t('Gọi món theo ý bạn', 'Make it your own')}</h2>
        <div className="quantity-field">
          <span>{t('Số phần', 'Servings')}</span>
          <div className="stepper">
            <button
              className="icon-button"
              aria-label={t('Bớt một phần', 'One fewer serving')}
              disabled={quantity <= 1}
              onClick={() => setQuantity(quantity - 1)}
            >
              <Minus size={16} />
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              className="icon-button"
              aria-label={t('Thêm một phần', 'One more serving')}
              disabled={quantity >= 10}
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <p className="field-label">{t('Thêm một chút yêu cầu', 'Any special preferences?')}</p>
        <div className="order-options">
          {orderOptions.map((option) => (
            <button
              key={option.id}
              className={options.includes(option.id) ? 'selected' : ''}
              aria-pressed={options.includes(option.id)}
              onClick={() =>
                setOptions(
                  options.includes(option.id)
                    ? options.filter((x) => x !== option.id)
                    : [...options, option.id],
                )
              }
            >
              <span>
                {option.en}
                <small>{option.vi}</small>
              </span>
              {options.includes(option.id) ? (
                <CheckCircle2 size={20} />
              ) : (
                <span className="option-circle" />
              )}
            </button>
          ))}
        </div>
        <div className="order-sentence" aria-live="polite">
          <span>CHO CÔ CHÚ NGHE / SHOW THE VENDOR</span>
          <p>
            {orderLoading
              ? t('Đang ghép lời gọi món…', 'Preparing your order…')
              : (order?.vietnamese ?? orderError)}
          </p>
          {order && <small>{order.english}</small>}
        </div>
        <button
          className="button primary full-width voice-play"
          onClick={play}
          disabled={!order || orderLoading}
        >
          {speaking ? <Square size={20} /> : <Volume2 size={21} />}
          {speaking ? t('Dừng phát', 'Stop speaking') : t('Phát lời gọi món', 'Speak my order')}
          <AudioLines size={21} />
        </button>
        <p className="small-note">
          {t(
            'Giọng đọc phụ thuộc thiết bị, chưa bảo đảm giọng miền Nam. Câu “không đậu phộng” là yêu cầu gọi món, không xác nhận món đã an toàn.',
            'Voice availability depends on your device. A Southern Vietnamese voice is not guaranteed. “No peanuts” is a request, not confirmation about the prepared dish.',
          )}
        </p>
      </section>
      <section className="surface-card response-panel">
        <span className="eyebrow">02 · {t('CÔ CHÚ NÓI GÌ NHỈ?', 'WHAT DID THE VENDOR SAY?')}</span>
        <h2>{t('Lắng nghe & hiểu nhau', 'Listen & understand')}</h2>
        <div className={`mic-visual ${recording ? 'recording' : ''}`}>
          <Mic size={38} strokeWidth={1.4} />
        </div>
        <p className="centered muted">
          {t(
            'Chạm micro, để cô chú nói một câu ngắn. Hoặc nhập lời nghe được ở dưới.',
            'Tap the mic and let the vendor speak briefly. You can also type what you heard.',
          )}
        </p>
        <button
          className={`button ${recording ? 'danger' : 'secondary'} full-width`}
          onClick={record}
          disabled={!supportsMic}
        >
          {recording ? <Square size={17} /> : <Mic size={17} />}
          {recording
            ? t('Dừng nghe', 'Stop listening')
            : t('Nghe phản hồi tiếng Việt', 'Listen in Vietnamese')}
        </button>
        <p className="small-note">
          {supportsMic
            ? t(
                'Khi bật micro, trình duyệt có thể gửi âm thanh tới dịch vụ nhận diện của nhà cung cấp. Ứng dụng không lưu bản ghi âm.',
                'Your browser may send audio to its speech recognition service when the mic is enabled. This app does not store audio recordings.',
              )
            : t(
                'Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Bạn vẫn có thể nhập văn bản.',
                'Speech recognition is not available in this browser. You can still type a response.',
              )}
        </p>
        <label className="field-label" htmlFor="vendor-response">
          {t('Lời cô chú nói', 'Vendor’s response')}
        </label>
        <textarea
          id="vendor-response"
          rows={3}
          value={response}
          maxLength={1000}
          onChange={(e) => {
            setResponse(e.target.value);
            setTranslation('');
            setSource('');
          }}
          placeholder="Ví dụ: Hết bò khô rồi, lấy thêm trứng cút nha?"
        />
        <button
          className="sample-phrase"
          onClick={() => {
            setResponse('Hết bò khô rồi, lấy thêm trứng cút nha?');
            setTranslation('');
          }}
        >
          {t('Thử một câu mẫu', 'Try a sample phrase')}
          <ArrowRight size={14} />
        </button>
        <button
          className="button primary full-width"
          onClick={() => void translate()}
          disabled={!response.trim() || translating}
        >
          <Languages size={18} />
          {translating
            ? t('Đang dịch…', 'Translating…')
            : t('Dịch sang tiếng Anh', 'Translate to English')}
        </button>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {translation && (
          <div className="translation-result" role="status">
            <span>ENGLISH</span>
            <p>{translation}</p>
            <small>
              {source === 'phrasebook'
                ? t('Từ bộ câu mẫu cố định', 'From the fixed phrasebook')
                : t('Bản dịch AI', 'AI translation')}
            </small>
          </div>
        )}
        {!catalog.aiConfigured && (
          <p className="small-note">
            <Info size={14} />
            {t(
              'Chưa kết nối AI: bộ câu mẫu vẫn dùng được. Câu tùy ý cần cấu hình API ở backend.',
              'AI is not connected: the phrasebook still works. Free-form translation needs a backend API key.',
            )}
          </p>
        )}
      </section>
    </div>
  );
}

function Scanner({ vendorId }: { vendorId: string }) {
  const { catalog, wardRoute, t, toast, refreshPassport, navigate, story } = useApp();
  const vendor = [...catalog.vendors, ...catalog.mapCandidates].find((v) => v.id === vendorId)!;
  const [image, setImage] = useState<{ url: string; base64: string; mimeType: string } | null>(
    null,
  );
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (image?.url) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  async function selectImage(file?: File) {
    if (!file) return;
    setError('');
    setResult(null);
    setImage(null);
    setConsent(false);
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(
        t(
          'Chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MB.',
          'Choose a JPEG, PNG or WebP image under 5 MB.',
        ),
      );
      return;
    }
    setReading(true);
    try {
      const prepared = await prepareScanImage(file);
      if (mounted.current)
        setImage({
          url: URL.createObjectURL(prepared.blob),
          base64: prepared.base64,
          mimeType: prepared.mimeType,
        });
    } catch (error) {
      if (mounted.current)
        setError(
          (error as Error).message === 'image-too-small'
            ? t(
                'Ảnh quá nhỏ để phân biệt món. Chọn ảnh gốc ít nhất 224 px mỗi chiều nhé.',
                'This photo is too small. Choose an original image at least 224 px on each side.',
              )
            : t(
                'Không đọc được ảnh. Hãy chọn ảnh JPEG, PNG hoặc WebP khác, tối đa 5 MB.',
                'Could not read this photo. Choose another JPEG, PNG or WebP under 5 MB.',
              ),
        );
    } finally {
      if (mounted.current) setReading(false);
    }
  }
  async function scan(mode: 'ai' | 'demo') {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api<ScanResult>(
        '/scans',
        mode === 'demo'
          ? { mode, vendorId }
          : { mode, vendorId, image: image && { base64: image.base64, mimeType: image.mimeType } },
      );
      if (mounted.current) setResult(data);
      if (data.matched) {
        await refreshPassport();
        toast(data.message);
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  return (
    <div className="scanner-layout">
      <section className="surface-card upload-panel">
        <span className="eyebrow">
          01 · {t('CHO MÓN NGON LÊN HÌNH', 'LET YOUR DISH SAY HELLO')}
        </span>
        <h2>{t('Mình vừa ăn món này!', 'Look what I’m having!')}</h2>
        <div className={`scan-dropzone ${image ? 'has-image' : ''}`}>
          {image ? (
            <>
              <img src={image.url} alt={t('Ảnh món ăn bạn vừa chọn', 'Your selected food photo')} />
              <span className="scan-corner tl" />
              <span className="scan-corner tr" />
              <span className="scan-corner bl" />
              <span className="scan-corner br" />
            </>
          ) : (
            <>
              <div className="scanner-symbol">
                <ScanLine size={52} strokeWidth={1} />
              </div>
              <h3>{t('Một tấm hình, nhiều điều thú vị', 'One photo, a little discovery')}</h3>
              <p>
                {t(
                  'Chụp rõ món ăn trong ánh sáng tự nhiên.',
                  'Photograph your dish clearly in good light.',
                )}
                <br />
                JPEG, PNG, WebP · {t('tối đa', 'max')} 5 MB
              </p>
            </>
          )}
          {reading && (
            <span className="image-reading" role="status">
              {t('Đang đọc ảnh…', 'Reading photo…')}
            </span>
          )}
        </div>
        <input
          className="sr-only"
          ref={imageRef}
          aria-label={t('Chụp ảnh món ăn', 'Take a food photo')}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => {
            void selectImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          className="sr-only"
          ref={fileRef}
          aria-label={t('Tải ảnh món ăn', 'Upload food photo')}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            void selectImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div className="upload-buttons">
          <button
            className="button secondary"
            disabled={loading || reading}
            onClick={() => imageRef.current?.click()}
          >
            <Camera size={18} />
            {t('Chụp món ăn', 'Take a photo')}
          </button>
          <button
            className="button secondary"
            disabled={loading || reading}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={18} />
            {t('Chọn ảnh', 'Choose photo')}
          </button>
        </div>
        <label className="consent-label">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            {t(
              'Mình đồng ý gửi ảnh này tới dịch vụ AI trên máy chủ để nhận diện món. Ứng dụng không lưu ảnh gốc.',
              'I agree to send this photo to the AI service configured on this server for dish recognition. This app does not store the original image.',
            )}
          </span>
        </label>
        <button
          className="button primary full-width"
          disabled={!catalog.aiConfigured || !image || !consent || loading || reading}
          onClick={() => void scan('ai')}
        >
          <Sparkles size={18} />
          {loading
            ? t('Đang đối chiếu hình ảnh…', 'Checking the dish details…')
            : t('Quét món bằng AI', 'Scan with AI')}
        </button>
        {!catalog.aiConfigured && (
          <p className="small-note">
            <Info size={14} />
            {t(
              'AI chưa được cấu hình. Dùng chế độ minh họa bên dưới để khám phá luồng trải nghiệm.',
              'AI is not configured yet. Use the demo below to explore the experience.',
            )}
          </p>
        )}
        <div className="demo-scan-box">
          <span>{t('CHƯA CÓ MÓN TRÊN TAY?', 'NO DISH IN HAND YET?')}</span>
          <p>
            {t(
              `Trải nghiệm minh họa với ${vendor.dish.toLocaleLowerCase('vi')}. Không phân tích ảnh, không xác thực mua hàng.`,
              `Try a demo with ${'dishEn' in vendor ? vendor.dishEn : vendor.dish}. No image analysis or purchase verification.`,
            )}
          </p>
          <button
            className="button text-button"
            disabled={loading || reading}
            onClick={() => void scan('demo')}
          >
            {t('Thử trải nghiệm minh họa', 'Try the demo experience')}
            <ArrowRight size={16} />
          </button>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="surface-card xray-panel" aria-live="polite">
        <span className="eyebrow">02 · FOOD X-RAY & LITTLE MEMORIES</span>
        <h2>{t('Đằng sau một món ngon', 'Behind a delicious dish')}</h2>
        {result?.matched && result.vendor ? (
          <>
            <div className="scan-success">
              <PassportStamp
                index={Math.max(
                  0,
                  catalog.vendors.findIndex((v) => v.id === vendorId),
                )}
              />
              <span className="status-tag">
                {result.mode === 'demo'
                  ? t('DẤU MINH HỌA', 'DEMO STAMP')
                  : t('AI NHẬN DIỆN MÓN', 'AI DISH OBSERVATION')}
              </span>
              <h3>{result.vendor.dish}</h3>
              <p>{result.vendor.dishEn}</p>
              <span className="scan-badge-name">
                <CheckCircle2 size={16} />
                {result.vendor.badge}
              </span>
            </div>
            <div className="food-facts">
              <h3>{t('Trong món có gì?', 'What is in this dish?')}</h3>
              <p className="small-note">
                {t(
                  'Theo thông tin đã ghi nhận trong danh mục, không suy ra từ ảnh.',
                  'From directory information, not inferred from the photo.',
                )}
              </p>
              {!result.vendor.ingredients.length && (
                <p className="small-note">
                  {t('Chưa có thông tin nguyên liệu.', 'Ingredient information is not available.')}
                </p>
              )}
              <div className="chip-row">
                {result.vendor.ingredients.map((ingredient) => (
                  <span className="ingredient-chip" key={ingredient}>
                    {ingredient}
                  </span>
                ))}
              </div>
              <h3>{t('Nguyên liệu cần lưu ý', 'Ingredients to be aware of')}</h3>
              <p className="allergen-notice">
                {result.vendor.allergensKnown === false
                  ? t(
                      'Chưa có thông tin để đánh giá nguyên liệu cần tránh.',
                      'Allergen information is not available.',
                    )
                  : result.vendor.allergens.length
                    ? result.vendor.allergens
                        .map((a) => {
                          const item = catalog.allergens.find((item) => item.id === a)!;
                          return t(item.name, item.en);
                        })
                        .join(' · ')
                    : t(
                        'Chưa có mục nào trong dữ liệu đã ghi nhận; hãy hỏi trực tiếp người bán.',
                        'None listed in the available data; please ask the vendor directly.',
                      )}
              </p>
              <p className="small-note">
                {t(
                  'Ảnh không thể xác định đầy đủ chất gây dị ứng hoặc nhiễm chéo. Hãy xác nhận trực tiếp với người bán.',
                  'A photo cannot identify all allergens or cross-contact. Confirm with the vendor.',
                )}
              </p>
              <h3>{t('Ăn sao cho đúng điệu?', 'Enjoy it the local way')}</h3>
              <p>
                {result.vendor.tip ||
                  t(
                    'Chưa có hướng dẫn đã xác minh cho ghim này.',
                    'No verified serving guide for this pin yet.',
                  )}
              </p>
            </div>
            <div className="scan-result-actions">
              {result.vendor.story ? (
                <button className="button primary" onClick={() => story(result.vendor!)}>
                  <Volume2 size={17} />
                  {t('Nghe chuyện của gánh', 'Hear the vendor’s story')}
                </button>
              ) : result.vendor.sourceUrl ? (
                <a
                  className="button secondary"
                  href={result.vendor.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Xem ghim nguồn', 'Open source pin')} <ArrowRight size={16} />
                </a>
              ) : null}
              <button className="button secondary" onClick={() => navigate('passport')}>
                {t('Mở hộ chiếu', 'Open passport')}
                <ArrowRight size={16} />
              </button>
              {wardRoute && wardRoute.stops.some((stop) => stop.id === vendorId) && (
                <button
                  className="button secondary"
                  onClick={() =>
                    navigate(
                      `ward-journey?ward=${encodeURIComponent(wardRoute.ward)}&route=${encodeURIComponent(wardRoute.id)}`,
                    )
                  }
                >
                  {t('Về hành trình', 'Back to journey')}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
            <p className="small-note">{result.message}</p>
          </>
        ) : result && !result.matched ? (
          <div className="xray-empty">
            <ScanLine size={48} />
            <h3>
              {result.reason === 'different-dish'
                ? t('Món trong ảnh khác món đang chọn', 'This looks like a different dish')
                : result.reason === 'out-of-catalog' || result.reason === 'unsupported-dish'
                  ? t('Món này chưa được hỗ trợ', 'This dish is not supported yet')
                  : t('Mình chưa đủ chắc về món này', 'Not enough visual detail yet')}
            </h3>
            <p>{result.message}</p>
            {result.observation && result.observation.explanation !== result.message && (
              <p>{result.observation.explanation}</p>
            )}
          </div>
        ) : (
          <div className="xray-empty">
            <div className="outline-plate">
              <UtensilDrawing />
            </div>
            <h3>{t('Một món ăn. Ba điều mở ra.', 'One dish. Three discoveries.')}</h3>
            <ul>
              <li>
                <span>01</span>
                <div>
                  <strong>{t('Hiểu món ngon', 'Meet the dish')}</strong>
                  <p>
                    {t(
                      'Tìm tên món, nguyên liệu tham khảo và cách thưởng thức.',
                      'Explore its name, illustrative ingredients and how to enjoy it.',
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>{t('Gom dấu hộ chiếu', 'Collect a passport stamp')}</strong>
                  <p>
                    {t(
                      'Lưu lại một dấu trải nghiệm nhỏ, thật riêng.',
                      'Keep a little mark of your own food adventure.',
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>{t('Lắng nghe cuộc đời', 'Hear a life story')}</strong>
                  <p>
                    {t(
                      'Khám phá câu chuyện minh họa đằng sau gánh hàng.',
                      'Discover the sample story behind the food cart.',
                    )}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
function UtensilDrawing() {
  return (
    <svg viewBox="0 0 140 120" fill="none" aria-hidden="true">
      <circle cx="70" cy="60" r="36" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="70" cy="60" r="29" stroke="currentColor" strokeDasharray="3 5" />
      <path
        d="M17 28v30m-6-30v20q0 10 6 10t6-10V28M17 58v38m105-68v68m-8-68v35h8M57 62c-8-6 4-14-2-18m14 18c-8-6 4-14-2-18m14 18c-8-6 4-14-2-18M51 72h37"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
