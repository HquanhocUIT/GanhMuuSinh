import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';

export default function AuthForm({
  admin = false,
  onSuccess,
}: {
  admin?: boolean;
  onSuccess?: () => void;
}) {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          if (mode === 'register') await auth.register(name, email, password);
          else await auth.login(email, password);
          setPassword('');
          onSuccess?.();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="auth-icon">
        {admin ? <ShieldCheck size={27} /> : <LockKeyhole size={26} />}
      </span>
      <span className="eyebrow">{admin ? 'CHẠM VỊ · ADMIN' : 'YOUR LITTLE COMMUNITY'}</span>
      <h2>
        {admin
          ? 'Chào người giữ gánh.'
          : mode === 'login'
            ? 'Mừng bạn ghé lại.'
            : 'Cùng viết tiếp câu chuyện.'}
      </h2>
      <p className="muted">
        {admin
          ? 'Đăng nhập bằng tài khoản được cấp quyền quản trị.'
          : 'Lưu hộ chiếu theo tài khoản và đóng góp những địa chỉ bạn biết.'}
      </p>
      {!admin && (
        <div className="auth-switch">
          <button
            type="button"
            className={mode === 'login' ? 'selected' : ''}
            aria-pressed={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'selected' : ''}
            aria-pressed={mode === 'register'}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Tạo tài khoản
          </button>
        </div>
      )}
      {mode === 'register' && (
        <label className="admin-field">
          Tên của bạn
          <input
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
          />
        </label>
      )}
      <label className="admin-field">
        Email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
          placeholder="ban@example.com"
        />
      </label>
      <label className="admin-field">
        Mật khẩu
        <span className="password-input">
          <input
            type={show ? 'text' : 'password'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 10 : 1}
            maxLength={128}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      {mode === 'register' && (
        <p className="small-note">
          Ít nhất 10 ký tự. Tài khoản tự đăng ký luôn có quyền người dùng.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button primary full-width" disabled={busy || auth.loading}>
        {busy
          ? 'Đang kết nối…'
          : mode === 'register'
            ? 'Tạo tài khoản & bắt đầu'
            : admin
              ? 'Vào khu quản trị'
              : 'Đăng nhập'}
        <ArrowRight size={18} />
      </button>
      {admin && (
        <p className="small-note">
          Chưa có tài khoản admin? Chủ dự án chạy{' '}
          <code>npm run admin:create -- email@cuaban.com</code> trong thư mục dự án để nhận mật khẩu
          ngẫu nhiên. Không có mật khẩu mặc định.
        </p>
      )}
    </form>
  );
}
