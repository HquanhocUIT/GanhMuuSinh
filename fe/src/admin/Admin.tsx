import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  Database,
  ExternalLink,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../auth';
import AuthForm from '../components/AuthForm';
import { BrandMark } from '../components/Brand';
import { Modal } from '../components/Modal';
import { api, money } from '../lib/api';
import { QuestForm, ReviewForm, VendorForm } from './Forms';
import {
  formatDate,
  statusLabel,
  type AdminData,
  type AdminQuest,
  type AdminVendor,
  type Overview,
  type ReferencePlace,
  type Submission,
} from './types';
import type { User } from '../auth';
import './admin.css';

const tabs = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'vendors', label: 'Gánh hàng & câu chuyện', icon: MapPin },
  { id: 'quests', label: 'Hành trình khám phá', icon: Route },
  { id: 'submissions', label: 'Đóng góp chờ duyệt', icon: ClipboardCheck },
  { id: 'references', label: 'Nguồn tham khảo', icon: Database },
  { id: 'users', label: 'Thành viên', icon: Users },
];
const currentTab = () => location.hash.split('/')[1] || 'overview';
type Edit =
  | { kind: 'vendor'; record: AdminVendor | null }
  | { kind: 'quest'; record: AdminQuest | null }
  | { kind: 'review'; record: Submission };

export default function Admin() {
  const auth = useAuth();
  const [tab, setTab] = useState(currentTab);
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const [referenceSearch, setReferenceSearch] = useState('');
  const [importing, setImporting] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [overview, vendors, quests, submissions, references, users] = await Promise.all([
        api<Overview>('/admin/overview'),
        api<{ records: AdminVendor[] }>('/admin/vendors'),
        api<{ records: AdminQuest[] }>('/admin/quests'),
        api<{ submissions: Submission[] }>('/admin/submissions'),
        api<{ references: ReferencePlace[] }>('/admin/references'),
        api<{ users: User[] }>('/admin/users'),
      ]);
      setData({
        overview,
        vendors: vendors.records,
        quests: quests.records,
        submissions: submissions.submissions,
        references: references.references,
        users: users.users,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (auth.user?.role === 'admin') void load();
    else setData(null);
  }, [auth.user, load]);
  useEffect(() => {
    const change = () => {
      setTab(currentTab());
      setSearch('');
      setFilter('all');
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const saved = () => {
    setEdit(null);
    setMessage('Đã lưu thay đổi. Giao diện user chỉ đọc nội dung đang hiển thị.');
    void load();
  };
  if (auth.loading)
    return (
      <div className="admin-loading" role="status">
        Đang kiểm tra phiên quản trị…
      </div>
    );
  if (!auth.user)
    return (
      <div className="admin-login">
        <a className="admin-back" href="#discover">
          <ArrowLeft size={17} />
          Về trang khám phá
        </a>
        <section className="admin-login-story">
          <BrandMark size={54} />
          <span className="eyebrow">GÓC NGƯỜI GIỮ GÁNH</span>
          <h1>
            Chăm một chiếc ghim.
            <br />
            <em>Giữ một cuộc gặp.</em>
          </h1>
          <p>
            Ở đây, mỗi địa chỉ được kiểm tra, mỗi câu chuyện được trân trọng và mỗi đóng góp đều có
            người lắng nghe.
          </p>
          <div>
            <ShieldCheck size={21} />
            <span>
              Nội dung có nguồn.
              <br />
              Cộng đồng có người đồng hành.
            </span>
          </div>
        </section>
        <section className="admin-login-panel">
          <AuthForm admin />
          {auth.error && (
            <p className="inline-error" role="alert">
              {auth.error}
            </p>
          )}
        </section>
      </div>
    );
  if (auth.user.role !== 'admin')
    return (
      <div className="container state-panel">
        <ShieldCheck size={48} />
        <h1>Góc này dành cho người giữ gánh.</h1>
        <p>
          Tài khoản của bạn có quyền người dùng. Khu quản trị và các API quản trị yêu cầu tài khoản
          được cấp quyền riêng.
        </p>
        <a className="button primary" href="#account">
          Về tài khoản của bạn
          <ArrowRight size={17} />
        </a>
        <button className="button secondary" onClick={() => void auth.logout()}>
          Đăng nhập tài khoản khác
        </button>
      </div>
    );
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const matches = (text: string) =>
    text.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'));
  const vendors =
    data?.vendors.filter(
      (v) => matches(`${v.name} ${v.dish} ${v.area}`) && (filter === 'all' || v.status === filter),
    ) ?? [];
  const quests =
    data?.quests.filter((q) => matches(q.title) && (filter === 'all' || q.status === filter)) ?? [];
  const submissions =
    data?.submissions.filter(
      (s) => matches(`${s.payload.name} ${s.author}`) && (filter === 'all' || s.status === filter),
    ) ?? [];
  const googleReferences = data?.references.filter((ref) => ref.sourceType === 'google-maps') ?? [];
  const visibleReferences =
    data?.references.filter((ref) =>
      `${ref.name} ${ref.dish} ${ref.area ?? ''} ${ref.category}`
        .toLocaleLowerCase('vi')
        .includes(referenceSearch.toLocaleLowerCase('vi')),
    ) ?? [];
  return (
    <div className="admin-app">
      <a
        className="skip-link"
        href="#admin-main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('admin-main')?.focus();
        }}
      >
        Đến nội dung quản trị
      </a>
      <aside className="admin-sidebar">
        <a className="brand" href="#admin">
          <BrandMark size={38} />
          <span>
            Chạm Vị<small>GÓC NGƯỜI GIỮ GÁNH</small>
          </span>
        </a>
        <div className="admin-workspace-label">KHÔNG GIAN QUẢN TRỊ</div>
        <nav aria-label="Điều hướng quản trị">
          {tabs.map((item) => (
            <a
              key={item.id}
              href={`#admin/${item.id}`}
              className={current.id === item.id ? 'active' : ''}
              aria-current={current.id === item.id ? 'page' : undefined}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === 'submissions' && Boolean(data?.overview.counts.pending) && (
                <b>{data?.overview.counts.pending}</b>
              )}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-note">
          <BookOpen size={23} />
          <p>
            Một dữ liệu đúng.
            <br />
            Một hành trình đáng tin hơn.
          </p>
          <a href="#discover">
            Xem giao diện user
            <ExternalLink size={14} />
          </a>
        </div>
        <div className="admin-identity">
          <span>{auth.user.name.slice(0, 1).toLocaleUpperCase('vi')}</span>
          <div>
            <strong>{auth.user.name}</strong>
            <small>Quản trị viên</small>
          </div>
          <button
            className="icon-button"
            aria-label="Đăng xuất admin"
            onClick={async () => {
              try {
                await auth.logout();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <span>
            Không gian quản trị
            <ChevronRight size={14} />
            <strong>{current.label}</strong>
          </span>
          <a href="#discover">
            Về trang khám phá
            <ArrowRight size={15} />
          </a>
          <button
            className="icon-button admin-mobile-logout"
            aria-label="Đăng xuất phiên quản trị"
            onClick={async () => {
              try {
                await auth.logout();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
          </button>
        </header>
        <main id="admin-main" tabIndex={-1} className="admin-main">
          <div className="admin-page-heading">
            <div>
              <span className="eyebrow">
                {tab === 'overview' ? 'A LITTLE CARE, A LASTING CONNECTION' : 'CONTENT & COMMUNITY'}
              </span>
              <h1>{tab === 'overview' ? 'Hôm nay, mình chăm gánh nào?' : current.label}</h1>
              <p>
                {tab === 'overview'
                  ? 'Một góc nhìn nhỏ về nội dung, cộng đồng và những thông tin đang chờ bạn.'
                  : tab === 'references'
                    ? 'Lấy điều đã biết làm điểm bắt đầu. Phần chưa rõ cần được kiểm tra.'
                    : 'Chỉnh sửa có lưu phiên bản và nhật ký. Bản nháp luôn được giữ riêng.'}
              </p>
            </div>
            <div className="admin-heading-actions">
              <button className="button secondary" disabled={busy} onClick={() => void load()}>
                <RefreshCw size={16} />
                {busy ? 'Đang tải…' : 'Làm mới'}
              </button>
              {['overview', 'vendors', 'quests'].includes(tab) && (
                <button
                  className="button primary"
                  onClick={() =>
                    setEdit(
                      tab === 'quests'
                        ? { kind: 'quest', record: null }
                        : { kind: 'vendor', record: null },
                    )
                  }
                >
                  <Plus size={17} />
                  {tab === 'quests' ? 'Thêm hành trình' : 'Thêm gánh hàng'}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="inline-error" role="alert">
              {error}
              <button className="button text-button" onClick={() => void auth.refresh()}>
                Kiểm tra lại phiên đăng nhập
              </button>
            </div>
          )}
          {!data ? (
            <div className="admin-empty" role="status">
              <Database size={38} />
              <p>
                {busy ? 'Đang lấy nội dung từ máy chủ…' : 'Chưa tải được dữ liệu. Hãy thử lại.'}
              </p>
            </div>
          ) : tab === 'overview' ? (
            <>
              <div className="admin-metrics">
                {[
                  {
                    label: 'Gánh hàng đang hiển thị',
                    value: data.overview.counts.publishedVendors,
                    detail: `${data.overview.counts.draftVendors} bản nháp đang chờ hoàn thiện`,
                    icon: MapPin,
                    page: 'vendors',
                  },
                  {
                    label: 'Hành trình công khai',
                    value: data.overview.counts.publishedQuests,
                    detail: 'Chỉ gồm các điểm dừng đang hiển thị',
                    icon: Route,
                    page: 'quests',
                  },
                  {
                    label: 'Đóng góp chờ xem xét',
                    value: data.overview.counts.pending,
                    detail: 'Thông tin mới từ cộng đồng',
                    icon: ClipboardCheck,
                    page: 'submissions',
                  },
                  {
                    label: 'Thành viên',
                    value: data.overview.counts.users,
                    detail: `${data.overview.counts.stamps} dấu hộ chiếu đã lưu`,
                    icon: Users,
                    page: 'users',
                  },
                ].map((metric) => (
                  <a href={`#admin/${metric.page}`} className="admin-metric" key={metric.page}>
                    <span>
                      <metric.icon size={20} />
                      <ArrowRight size={15} />
                    </span>
                    <strong>{metric.value}</strong>
                    <p>{metric.label}</p>
                    <small>{metric.detail}</small>
                  </a>
                ))}
              </div>
              <section className="admin-editorial">
                <div>
                  <span className="eyebrow">ĐÚNG ĐỊA CHỈ, GẦN CÂU CHUYỆN</span>
                  <h2>
                    Một bản đồ sống,
                    <br />
                    <em>cần những người chăm.</em>
                  </h2>
                  <p>
                    Bắt đầu từ ba mẫu tham khảo có ghi nguồn. Để trống điều chưa biết, lưu bản nháp
                    và chỉ đưa ra cộng đồng khi nội dung đủ rõ.
                  </p>
                  <a className="button primary" href="#admin/references">
                    Xem nguồn tham khảo
                    <ArrowRight size={17} />
                  </a>
                </div>
                <div className="admin-editorial-art">
                  <MapPin size={75} strokeWidth={0.8} />
                  <span>CHĂM MỘT GÁNH · NỐI MỘT CUỘC GẶP</span>
                </div>
              </section>
              <section className="admin-section">
                <div className="admin-section-title">
                  <h2>Những thay đổi gần đây</h2>
                  <span>{data.overview.recent.length} hoạt động</span>
                </div>
                {data.overview.recent.length ? (
                  <div className="admin-activity">
                    {data.overview.recent.slice(0, 10).map((event) => (
                      <div key={event.id}>
                        <span className="activity-icon">
                          <FilePenLine size={17} />
                        </span>
                        <div>
                          <strong>{event.summary}</strong>
                          <small>
                            {event.actor} · {event.action}
                          </small>
                        </div>
                        <time>{formatDate(event.createdAt)}</time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="admin-empty">
                    <FilePenLine size={32} />
                    <p>Những thay đổi nội dung đầu tiên sẽ được ghi lại ở đây.</p>
                  </div>
                )}
              </section>
            </>
          ) : tab === 'vendors' || tab === 'quests' || tab === 'submissions' ? (
            <section className="admin-section">
              <div className="admin-table-toolbar">
                <label>
                  <Search size={18} />
                  <input
                    aria-label="Tìm nội dung quản trị"
                    placeholder={tab === 'vendors' ? 'Tên gánh, món, khu vực…' : 'Tìm theo tên…'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Lọc trạng thái"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  {(tab === 'submissions'
                    ? ['pending', 'approved', 'rejected']
                    : ['published', 'draft', 'archived']
                  ).map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                <span>
                  {tab === 'vendors'
                    ? vendors.length
                    : tab === 'quests'
                      ? quests.length
                      : submissions.length}{' '}
                  mục
                </span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{tab === 'quests' ? 'Hành trình' : 'Gánh hàng'}</th>
                      <th>{tab === 'submissions' ? 'Người đóng góp' : 'Chi tiết'}</th>
                      <th>Trạng thái</th>
                      <th>{tab === 'submissions' ? 'Thời điểm gửi' : 'Cập nhật'}</th>
                      <th>
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab === 'vendors'
                      ? vendors.map((v) => (
                          <tr key={v.id}>
                            <td>
                              <strong>{v.name}</strong>
                              <small>{v.dish}</small>
                            </td>
                            <td>
                              <span>{v.area || 'Chưa có khu vực'}</span>
                              <small>
                                {v.price === null ? 'Chưa có giá' : money(v.price)} ·{' '}
                                {v.dataType === 'illustrative'
                                  ? 'Minh họa'
                                  : v.dataType === 'reference'
                                    ? 'Tham khảo'
                                    : 'Cộng đồng'}
                              </small>
                            </td>
                            <td>
                              <Status value={v.status} />
                            </td>
                            <td>
                              <small>{formatDate(v.updatedAt)}</small>
                              <small>Phiên bản {v.revision}</small>
                            </td>
                            <td>
                              <button
                                className="button secondary small"
                                aria-label={`Sửa ${v.name}`}
                                onClick={() => setEdit({ kind: 'vendor', record: v })}
                              >
                                <FilePenLine size={15} />
                                Biên tập
                              </button>
                            </td>
                          </tr>
                        ))
                      : tab === 'quests'
                        ? quests.map((q) => (
                            <tr key={q.id}>
                              <td>
                                <strong>{q.title}</strong>
                                <small>{q.area}</small>
                              </td>
                              <td>
                                <span>
                                  {q.vendorIds.length} điểm dừng · {q.duration} phút
                                </span>
                                <small>
                                  {q.vendorIds.every((id) =>
                                    data.vendors.some(
                                      (v) => v.id === id && v.status === 'published',
                                    ),
                                  )
                                    ? 'Các điểm dừng sẵn sàng'
                                    : 'Có điểm dừng chưa hiển thị'}
                                </small>
                              </td>
                              <td>
                                <Status value={q.status} />
                              </td>
                              <td>
                                <small>{formatDate(q.updatedAt)}</small>
                              </td>
                              <td>
                                <button
                                  className="button secondary small"
                                  aria-label={`Sửa ${q.title}`}
                                  onClick={() => setEdit({ kind: 'quest', record: q })}
                                >
                                  <FilePenLine size={15} />
                                  Biên tập
                                </button>
                              </td>
                            </tr>
                          ))
                        : submissions.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <strong>{s.payload.name}</strong>
                                <small>{s.payload.dish}</small>
                              </td>
                              <td>{s.author}</td>
                              <td>
                                <Status value={s.status} />
                              </td>
                              <td>
                                <small>{formatDate(s.createdAt)}</small>
                              </td>
                              <td>
                                {s.status === 'pending' ? (
                                  <button
                                    className="button secondary small"
                                    aria-label={`Xem xét ${s.payload.name}`}
                                    onClick={() => setEdit({ kind: 'review', record: s })}
                                  >
                                    <ClipboardCheck size={15} />
                                    Xem xét
                                  </button>
                                ) : (
                                  <span className="admin-muted">{s.reviewNote}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                  </tbody>
                </table>
              </div>
              {!(tab === 'vendors'
                ? vendors.length
                : tab === 'quests'
                  ? quests.length
                  : submissions.length) && (
                <div className="admin-empty">
                  <Search size={32} />
                  <p>Chưa có mục nào phù hợp.</p>
                </div>
              )}
            </section>
          ) : tab === 'references' ? (
            <>
              <div className="admin-reference-notice">
                <Database size={23} />
                <div>
                  <strong>
                    Nguồn công khai:{' '}
                    <a href="https://ganhmuusinh.vn/" target="_blank" rel="noreferrer">
                      ganhmuusinh.vn ↗
                    </a>
                  </strong>
                  <p>
                    Mẫu tham khảo ngày 29/10/2026. Chỉ lấy một số trường địa điểm; không sao chép
                    hình ảnh, tài khoản hay câu chuyện đời. Nhập dữ liệu luôn tạo bản nháp.
                  </p>
                </div>
              </div>
              <div className="admin-reference-notice">
                <MapPin size={23} />
                <div>
                  <strong>
                    <a
                      href="https://www.google.com/maps/@10.7524014,106.6815481,13.33z/data=!4m3!11m2!2syL7kE4gcCEMBEYgR2UjssA!3e3"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {'G\u00e1nh M\u01b0u Sinh \u2013 To\u00e0n qu\u1ed1c (Google Maps) \u2197'}
                    </a>
                  </strong>
                  <p>
                    {'\u0110\u00e3 l\u1ecdc '}
                    {googleReferences.length}
                    {
                      ' ghim m\u00f3n \u0103n trong TP.HCM m\u1edbi t\u1eeb 359 \u0111i\u1ec3m. Gi\u00e1, gi\u1edd, nguy\u00ean li\u1ec7u v\u00e0 \u0111\u1ecba ch\u1ec9 ch\u01b0a \u0111\u01b0\u1ee3c x\u00e1c minh; nh\u1eadp s\u1ebd t\u1ea1o b\u1ea3n nh\u00e1p, kh\u00f4ng t\u1ef1 c\u00f4ng khai. Kh\u00f4ng nh\u1eadp \u1ea3nh ho\u1eb7c chuy\u1ec7n ri\u00eang t\u01b0 trong ghi ch\u00fa ngu\u1ed3n.'
                    }
                  </p>
                  <div className="admin-reference-actions">
                    <button
                      className="button secondary"
                      disabled={Boolean(importing) || googleReferences.every((ref) => ref.imported)}
                      onClick={async () => {
                        setImporting('all-google');
                        setError('');
                        try {
                          const result = await api<{
                            total: number;
                            created: number;
                            existing: number;
                          }>('/admin/references/import-google-maps', {});
                          setMessage(
                            `\u0110\u00e3 t\u1ea1o ${result.created} b\u1ea3n nh\u00e1p m\u1edbi; ${result.existing} m\u1eabu \u0111\u00e3 c\u00f3 b\u1ea3n nh\u00e1p.`,
                          );
                          await load();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setImporting('');
                        }
                      }}
                    >
                      {importing === 'all-google'
                        ? '\u0110ang t\u1ea1o b\u1ea3n nh\u00e1p\u2026'
                        : googleReferences.length > 0 &&
                            googleReferences.every((ref) => ref.imported)
                          ? '\u0110\u00e3 nh\u1eadp h\u1ebft v\u00e0o b\u1ea3n nh\u00e1p'
                          : 'Nh\u1eadp c\u00e1c \u0111i\u1ec3m \u0103n v\u00e0o b\u1ea3n nh\u00e1p'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="admin-reference-tools">
                <label className="admin-reference-search">
                  <Search size={17} />
                  <input
                    value={referenceSearch}
                    onChange={(e) => setReferenceSearch(e.target.value)}
                    placeholder="Tìm theo món hoặc khu vực..."
                    aria-label="Tìm nguồn tham khảo"
                  />
                </label>
                <span>
                  {visibleReferences.length} / {data.references.length} máº«u
                </span>
              </div>
              <div className="admin-reference-grid">
                {visibleReferences.map((ref) => (
                  <article key={ref.id} className="admin-reference-card">
                    <div>
                      <span className="reference-icon">
                        <MapPin size={25} />
                      </span>
                      <span className="admin-status status-draft">
                        {ref.imported ? 'Đã có bản nháp' : 'Chưa nhập'}
                      </span>
                    </div>
                    <span className="eyebrow">
                      {ref.sourceType === 'google-maps' ? 'Google Maps · ' : 'Ganhmuusinh.vn · '}
                      {ref.category}
                    </span>
                    <h2>{ref.name}</h2>
                    <p>{ref.address || 'Chỉ có ghim tọa độ; cần đối chiếu để bổ sung địa chỉ.'}</p>
                    <dl>
                      <div>
                        <dt>Tọa độ theo nguồn</dt>
                        <dd>
                          {ref.lat}, {ref.lng}
                        </dd>
                      </div>
                      <div>
                        <dt>Giá / giờ bán</dt>
                        <dd>Chưa được cung cấp</dd>
                      </div>
                      <div>
                        <dt>Kiểm tra thực địa</dt>
                        <dd>Chưa xác minh</dd>
                      </div>
                    </dl>
                    <a
                      className="button text-button"
                      href={ref.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Đối chiếu địa điểm
                      <ExternalLink size={14} />
                    </a>
                    <button
                      className="button secondary full-width"
                      disabled={Boolean(importing)}
                      onClick={async () => {
                        setImporting(ref.id);
                        setError('');
                        try {
                          const result = await api<{ vendor: AdminVendor; created: boolean }>(
                            `/admin/references/${ref.id}/import`,
                            {},
                          );
                          setEdit({ kind: 'vendor', record: result.vendor });
                          setMessage(
                            result.created
                              ? 'Đã tạo bản nháp có nguồn. Bổ sung thông tin trước khi hiển thị.'
                              : 'Mở nội dung đã nhập trước đó.',
                          );
                          await load();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setImporting('');
                        }
                      }}
                    >
                      {importing === ref.id
                        ? 'Đang nhập…'
                        : ref.imported
                          ? 'Mở nội dung đã nhập'
                          : 'Nhập vào bản nháp'}
                      <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : tab === 'users' ? (
            <section className="admin-section">
              <div className="admin-section-title">
                <h2>Thành viên & phân quyền</h2>
                <span>{data.users.length} tài khoản</span>
              </div>
              <p className="admin-table-note">
                Đăng ký công khai chỉ tạo quyền user. Tài khoản admin được tạo bằng công cụ phía máy
                chủ. Danh sách này không hiển thị cho khách truy cập.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Thành viên</th>
                      <th>Email</th>
                      <th>Vai trò</th>
                      <th>Ngày tham gia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.name}</strong>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span
                            className={`admin-status ${user.role === 'admin' ? 'status-published' : 'status-draft'}`}
                          >
                            {user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                          </span>
                        </td>
                        <td>
                          <small>{formatDate(user.createdAt)}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          <footer className="admin-workspace-footer">
            <ShieldCheck size={15} />
            Quyền quản trị được kiểm tra tại backend.
            <span>Chạm Vị · Content & Community</span>
          </footer>
        </main>
      </div>
      {edit && data && (
        <Modal
          title={
            edit.kind === 'review'
              ? 'Xem xét đóng góp'
              : edit.kind === 'quest'
                ? edit.record
                  ? 'Biên tập hành trình'
                  : 'Thêm hành trình mới'
                : edit.record
                  ? 'Biên tập gánh hàng & câu chuyện'
                  : 'Thêm gánh hàng mới'
          }
          onClose={() => setEdit(null)}
          wide
        >
          {edit.kind === 'vendor' ? (
            <VendorForm record={edit.record} data={data} onSaved={saved} />
          ) : edit.kind === 'quest' ? (
            <QuestForm record={edit.record} data={data} onSaved={saved} />
          ) : (
            <ReviewForm record={edit.record} onSaved={saved} />
          )}
        </Modal>
      )}
      <div
        className={`toast ${message ? 'visible' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message && (
          <>
            <Check size={18} />
            <span>{message}</span>
            <button aria-label="Đóng thông báo" onClick={() => setMessage('')}>
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return <span className={`admin-status status-${value}`}>{statusLabel(value)}</span>;
}
