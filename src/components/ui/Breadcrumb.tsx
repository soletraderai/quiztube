import { Link, useLocation, useParams } from 'react-router-dom';
import { useSessionStore } from '../../stores/sessionStore';

interface BreadcrumbItem {
  label: string;
  path: string;
  current?: boolean;
}

export default function Breadcrumb() {
  const location = useLocation();
  const { sessionId } = useParams();
  const { getSession } = useSessionStore();

  // Build breadcrumb items based on current path
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const path = location.pathname;
    const items: BreadcrumbItem[] = [{ label: 'Home', path: '/' }];

    // Home page - no additional breadcrumbs
    if (path === '/') {
      items[0].current = true;
      return items;
    }

    // Settings page
    if (path === '/settings') {
      items.push({ label: 'Settings', path: '/settings', current: true });
      return items;
    }

    // Library page
    if (path === '/library') {
      items.push({ label: 'Library', path: '/library', current: true });
      return items;
    }

    // Session pages (overview, active, notes)
    if ((path.includes('/session/') || path.includes('/lesson/')) && sessionId) {
      const session = getSession(sessionId);
      const sessionTitle = session?.video.title
        ? session.video.title.slice(0, 30) + (session.video.title.length > 30 ? '...' : '')
        : 'Session';

      // Add Library in the breadcrumb path for sessions
      items.push({ label: 'Library', path: '/library' });

      if (path.includes('/overview')) {
        items.push({ label: sessionTitle, path: `/lesson/${sessionId}/overview`, current: true });
      } else if (path.includes('/active')) {
        items.push({ label: sessionTitle, path: `/lesson/${sessionId}/overview` });
        items.push({ label: 'Active Lesson', path: `/lesson/${sessionId}/active`, current: true });
      } else if (path.includes('/notes')) {
        items.push({ label: 'Lesson Notes', path: `/lesson/${sessionId}/notes`, current: true });
      }

      return items;
    }

    // 404 or other pages
    if (path === '/404') {
      items.push({ label: 'Not Found', path: '/404', current: true });
      return items;
    }

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  // Don't show breadcrumb if only home
  if (breadcrumbItems.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-sm font-body">
        {breadcrumbItems.map((item, index) => (
          <li key={item.path} className="flex items-center gap-2">
            {index > 0 && (
              <span className="text-text/40" aria-hidden="true">
                &gt;
              </span>
            )}
            {item.current ? (
              <span
                className="text-text font-semibold bg-primary/20 px-2 py-1 border-2 border-border"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="text-text/70 hover:text-text hover:bg-primary/10 px-2 py-1 border-2 border-transparent hover:border-border transition-all"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
