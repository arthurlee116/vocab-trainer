import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
            主界面
          </Link>
          <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
            历史记录
          </Link>
          {mode === 'authenticated' && (
            <button type="button" className="text-button" onClick={handleLogout}>
              退出
            </button>
          )}
        </nav>
        <div className="header-user">{user ? user.email : '游客'}</div>
      </header>
      <main className={fullWidth ? 'app-main full' : 'app-main'}>{children}</main>
    </div>
  );
};

export default AppLayout;
