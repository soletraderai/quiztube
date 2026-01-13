import { useState, useEffect, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MaterialIcon from './MaterialIcon';
import Tooltip from './Tooltip';
import { useAuthStore } from '../../stores/authStore';

// Wrapper component for conditional tooltip
function ConditionalTooltip({
  show,
  content,
  children,
}: {
  show: boolean;
  content: string;
  children: ReactNode;
}) {
  if (!show) return <>{children}</>;
  return (
    <Tooltip content={content} position="right" delay={200}>
      {children}
    </Tooltip>
  );
}

interface SidebarItem {
  to: string;
  icon: string;
  label: string;
  badge?: number;
  requiresAuth?: boolean;
}

const navItems: SidebarItem[] = [
  { to: '/', icon: 'home', label: 'Home' },
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', requiresAuth: true },
  { to: '/feed', icon: 'subscriptions', label: 'Your Feed', requiresAuth: true },
  { to: '/library', icon: 'video_library', label: 'Library', requiresAuth: true },
  { to: '/goals', icon: 'trending_up', label: 'Goals', requiresAuth: true },
  { to: '/timed-sessions', icon: 'timer', label: 'Timed Sessions', requiresAuth: true },
];

const bottomItems: SidebarItem[] = [
  { to: '/settings', icon: 'settings', label: 'Settings', requiresAuth: true },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onHelpClick?: () => void;
}

export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
  onHelpClick,
}: SidebarProps) {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.requiresAuth || isAuthenticated()
  );

  const filteredBottomItems = bottomItems.filter(
    (item) => !item.requiresAuth || isAuthenticated()
  );

  const sidebarContent = (
    <>
      {/* Logo Section */}
      <div className={`flex items-center h-16 px-4 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <Link
          to="/"
          onClick={handleNavClick}
          className="flex items-center gap-3 text-white hover:text-primary transition-colors"
        >
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="font-heading font-bold text-text text-sm">QT</span>
          </div>
          {!collapsed && (
            <span className="font-heading font-bold text-lg">QuizTube</span>
          )}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {filteredNavItems.map((item) => (
            <li key={item.to}>
              <ConditionalTooltip show={collapsed} content={item.label}>
                <Link
                  to={item.to}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3 py-3 rounded transition-all hover:scale-[1.02] ${
                    isActive(item.to)
                      ? 'bg-primary/20 text-white border-l-4 border-primary -ml-0.5'
                      : 'text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent -ml-0.5'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <MaterialIcon
                    name={item.icon}
                    size="lg"
                    className={isActive(item.to) ? 'text-primary' : ''}
                    decorative
                  />
                  {!collapsed && (
                    <span className="font-heading font-semibold text-sm flex-1">
                      {item.label}
                    </span>
                  )}
                  {!collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 bg-secondary text-text text-xs font-bold rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </ConditionalTooltip>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-white/10 py-4">
        <ul className="space-y-1 px-3">
          {filteredBottomItems.map((item) => (
            <li key={item.to}>
              <ConditionalTooltip show={collapsed} content={item.label}>
                <Link
                  to={item.to}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3 py-3 rounded transition-all hover:scale-[1.02] ${
                    isActive(item.to)
                      ? 'bg-primary/20 text-white border-l-4 border-primary -ml-0.5'
                      : 'text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent -ml-0.5'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <MaterialIcon
                    name={item.icon}
                    size="lg"
                    className={isActive(item.to) ? 'text-primary' : ''}
                    decorative
                  />
                  {!collapsed && (
                    <span className="font-heading font-semibold text-sm">
                      {item.label}
                    </span>
                  )}
                </Link>
              </ConditionalTooltip>
            </li>
          ))}

          {/* Help Link */}
          <li>
            <ConditionalTooltip show={collapsed} content="Help">
              <button
                className={`flex items-center gap-3 px-3 py-3 rounded transition-all w-full text-white/70 hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center' : ''}`}
                onClick={() => {
                  if (onHelpClick) {
                    onHelpClick();
                  }
                }}
              >
                <MaterialIcon name="help_outline" size="lg" decorative />
                {!collapsed && (
                  <span className="font-heading font-semibold text-sm">Help</span>
                )}
              </button>
            </ConditionalTooltip>
          </li>
        </ul>

        {/* Collapse Toggle (Desktop only) */}
        {!isMobile && onToggleCollapse && (
          <div className="px-3 mt-4">
            <button
              onClick={onToggleCollapse}
              className={`flex items-center gap-3 px-3 py-2 rounded transition-all w-full text-white/50 hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center' : ''}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <MaterialIcon
                name={collapsed ? 'chevron_right' : 'chevron_left'}
                size="md"
                decorative
              />
              {!collapsed && (
                <span className="text-xs font-medium">Collapse</span>
              )}
            </button>
          </div>
        )}

        {/* User Info */}
        {isAuthenticated() && user && (
          <div className={`px-3 mt-4 pt-4 border-t border-white/10 ${collapsed ? 'flex justify-center' : ''}`}>
            <ConditionalTooltip show={collapsed} content={user.displayName || 'Profile'}>
              <Link
                to="/settings"
                onClick={handleNavClick}
                className={`flex items-center gap-3 rounded transition-all hover:bg-white/10 ${collapsed ? 'p-2' : 'px-3 py-2'}`}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full border-2 border-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <span className="font-heading font-bold text-text text-xs">
                      {user.displayName?.slice(0, 2).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">
                      {user.displayName}
                    </p>
                    <p className="text-white/50 text-xs truncate">{user.tier}</p>
                  </div>
                )}
              </Link>
            </ConditionalTooltip>
          </div>
        )}
      </div>
    </>
  );

  // Mobile: Overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-[#1a1a1a] z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Close button */}
          <button
            onClick={onMobileClose}
            className="absolute top-4 right-4 p-1 text-white/70 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <MaterialIcon name="close" size="lg" />
          </button>
          {sidebarContent}
        </aside>
      </>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-[#1a1a1a] border-r border-white/10 transition-all duration-300 ease-in-out hidden md:flex md:flex-col z-30 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      {sidebarContent}
    </aside>
  );
}
