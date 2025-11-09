import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogIn } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getErrorMessage } from '../lib/errors';

const LandingPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { authenticate, setGuestMode, mode: authMode } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (authMode === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [authMode, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await authenticate(email, password, mode);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, '请求失败，请稍后重试'));
    } finally {
      setPending(false);
    }
  };

  const handleGuest = () => {
    setGuestMode();
    navigate('/dashboard');
  };

  return (
    <div className="landing">
      <div className="landing-card">
        <div>
          <p className="eyebrow">AI Generated on the Fly</p>
          <h1>AI 动态词汇练习</h1>
          <p className="sub">
            没有静态题库，所有题目、干扰项、分析全部实时生成。上传词表图片，立即开启“题流”式训练。
          </p>
        </div>

        <div className="auth-panel">
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              注册
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <label>
              邮箱
              <input
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              密码
              <input
                type="password"
                placeholder="至少 6 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="primary" disabled={pending}>
              <LogIn size={18} className="btn-icon" />
              {mode === 'login' ? '登录' : '注册并登录'}
            </button>
          </form>
          <button type="button" className="ghost" onClick={handleGuest}>
            <User size={18} className="btn-icon" />
            先逛逛（游客模式）
          </button>
        </div>
      </div>
      <p className="landing-footnote">使用 VLM（google/gemini-2.5-flash-preview-09-2025）识别词表，Polaris Alpha 生成题目与报告。</p>
    </div>
  );
};

export default LandingPage;
