import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, LogOut, KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface Props {
  children: ReactNode;
  fullWidth?: boolean;
}

const AppLayout = ({ children, fullWidth }: Props) => {
  const { user, mode, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <Link to="/dashboard" className="logo-text">
            AI 动态词汇练习
          </Link>
          <span className="header-badge">{mode === 'guest' ? '游客模式' : '已登录'}</span>
        </div>
        <nav className="header-nav">
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
            <Home size={18} className="nav-icon" />
            主界面
          </Link>
          <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
            <BookOpen size={18} className="nav-icon" />
            历史记录
          </Link>
          {mode === 'authenticated' && (
            <button type="button" className="text-button" onClick={handleLogout}>
              <LogOut size={18} className="nav-icon" />
              退出
            </button>
          )}
        </nav>
        <div className="header-user">
          <span>{user ? user.email : '游客'}</span>
          {mode === 'guest' && (
            <div className="login-marquee-shell">
              <button type="button" className="login-marquee-button" onClick={() => navigate('/')}>
                <KeyRound size={16} className="login-icon" />
                登录账号
              </button>
            </div>
          )}
        </div>
      </header>
      <main className={fullWidth ? 'app-main full' : 'app-main'}>{children}</main>
    </div>
  );
};

export default AppLayout;
