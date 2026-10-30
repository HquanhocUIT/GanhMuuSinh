import { useEffect, useState } from 'react';
import { ArrowRight, Heart, LogOut, NotebookPen, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../auth';
import { useApp } from '../context';
import AuthForm from '../components/AuthForm';
import { api } from '../lib/api';
import type { Submission } from '../admin/types';

export default function Account() {
  const auth = useAuth();
  const { t, passport, navigate, refreshPassport } = useApp();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    if (auth.user)
      api<{ submissions: Submission[] }>('/submissions')
        .then((data) => {
          if (alive) setSubmissions(data.submissions);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [auth.user]);
  if (auth.loading)
    return (
      <div className="state-panel" role="status">
        Đang mở tài khoản…
      </div>
    );
  if (!auth.user)
    return (
      <div className="container inner-page account-layout">
        <section className="account-welcome">
          <span className="eyebrow">GÓP MỘT ĐỊA CHỈ, NỐI MỘT CUỘC GẶP</span>
          <h1>
            {t('Một người khám phá. Một phần cộng đồng.', 'An explorer. A part of the community.')}
          </h1>
          <p>
            Bạn vẫn có thể khám phá và dùng hộ chiếu ẩn danh. Khi đăng nhập, những dấu đã lưu sẽ
            được chuyển vào tài khoản để bạn mở lại trên thiết bị khác.
          </p>
          <div className="account-promise">
            <Heart size={22} />
            <span>
              Cô chú không cần tài khoản.
              <br />
              Cộng đồng cùng chăm sóc dữ liệu.
            </span>
          </div>
          <button className="button text-button" onClick={() => navigate('discover')}>
            Tiếp tục khám phá tự do
            <ArrowRight size={17} />
          </button>
        </section>
        <div className="surface-card">
          <AuthForm onSuccess={() => void refreshPassport()} />
        </div>
      </div>
    );
  return (
    <div className="container inner-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR EXPLORER CORNER</span>
          <h1>Chào {auth.user.name}, mình lại đi nhé?</h1>
          <p>
            {auth.user.email} ·{' '}
            {auth.user.role === 'admin' ? 'Quản trị viên' : 'Thành viên khám phá'}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await auth.logout();
              await refreshPassport();
              setSubmissions([]);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LogOut size={17} />
          Đăng xuất
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="account-summary">
        <div className="surface-card">
          <UserRound size={30} />
          <h2>{passport.stamps.length} dấu trải nghiệm</h2>
          <p>Hộ chiếu đi cùng tài khoản của bạn.</p>
          <button className="button text-button" onClick={() => navigate('passport')}>
            Mở hộ chiếu
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="surface-card">
          <NotebookPen size={30} />
          <h2>{submissions.length} đóng góp</h2>
          <p>Mỗi thông tin sẽ được quản trị viên xem xét.</p>
          <button className="button text-button" onClick={() => navigate('contribute')}>
            Góp thêm một địa chỉ
            <ArrowRight size={17} />
          </button>
        </div>
        {auth.user.role === 'admin' && (
          <div className="surface-card">
            <ShieldCheck size={30} />
            <h2>Góc người giữ gánh</h2>
            <p>Quản lý nội dung và xem xét thông tin cộng đồng.</p>
            <a className="button text-button" href="#admin">
              Mở khu quản trị
              <ArrowRight size={17} />
            </a>
          </div>
        )}
      </div>
      <ContributionHistory submissions={submissions} />
    </div>
  );
}
export function ContributionHistory({ submissions }: { submissions: Submission[] }) {
  return (
    <section className="contribution-history">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR COMMUNITY NOTES</span>
          <h2>Những thông tin bạn đã góp</h2>
        </div>
      </div>
      {!submissions.length ? (
        <div className="empty-state">
          <NotebookPen size={32} />
          <p>Chưa có đóng góp nào. Một địa chỉ quen cũng có thể giúp ai đó tìm đúng gánh hàng.</p>
        </div>
      ) : (
        <div className="contribution-list">
          {submissions.map((s) => (
            <article className="surface-card" key={s.id}>
              <div>
                <h3>{s.payload.name}</h3>
                <span className={`admin-status status-${s.status}`}>
                  {s.status === 'pending'
                    ? 'Chờ xem xét'
                    : s.status === 'approved'
                      ? 'Đã tiếp nhận vào bản nháp'
                      : 'Cần bổ sung'}
                </span>
              </div>
              <p>{s.payload.address}</p>
              {s.reviewNote && (
                <p>
                  <strong>Phản hồi quản trị viên:</strong> {s.reviewNote}
                </p>
              )}
              <small>
                {new Date(s.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN')}
              </small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
