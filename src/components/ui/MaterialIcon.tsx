import { forwardRef } from 'react';

export type IconVariant = 'filled' | 'outlined' | 'round';
export type IconSize = 'sm' | 'md' | 'lg' | 'xl' | number;

interface MaterialIconProps {
  /** The Material Icon name (e.g., 'home', 'settings', 'search') */
  name: string;
  /** Icon variant: 'filled' (default), 'outlined', or 'round' */
  variant?: IconVariant;
  /** Predefined size or custom pixel size */
  size?: IconSize;
  /** Additional CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
  /** Whether the icon is decorative (hides from screen readers) */
  decorative?: boolean;
  /** Optional click handler */
  onClick?: () => void;
}

// Size mappings
const sizeMap: Record<string, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

// Variant to font family mappings
const variantFontMap: Record<IconVariant, string> = {
  filled: 'Material Icons',
  outlined: 'Material Icons Outlined',
  round: 'Material Icons Round',
};

/**
 * MaterialIcon component wrapper for Google Material Icons
 *
 * @example
 * // Basic usage
 * <MaterialIcon name="home" />
 *
 * // With size and variant
 * <MaterialIcon name="settings" size="lg" variant="outlined" />
 *
 * // Custom size in pixels
 * <MaterialIcon name="search" size={28} />
 *
 * // With accessibility label
 * <MaterialIcon name="help" aria-label="Help" />
 */
const MaterialIcon = forwardRef<HTMLSpanElement, MaterialIconProps>(
  (
    {
      name,
      variant = 'filled',
      size = 'md',
      className = '',
      'aria-label': ariaLabel,
      decorative = false,
      onClick,
    },
    ref
  ) => {
    const pixelSize = typeof size === 'number' ? size : sizeMap[size];
    const fontFamily = variantFontMap[variant];

    return (
      <span
        ref={ref}
        className={`material-icons ${className}`}
        style={{
          fontFamily,
          fontSize: `${pixelSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          verticalAlign: 'middle',
          userSelect: 'none',
          cursor: onClick ? 'pointer' : undefined,
        }}
        aria-label={decorative ? undefined : ariaLabel || name.replace(/_/g, ' ')}
        aria-hidden={decorative}
        role={decorative ? 'presentation' : 'img'}
        onClick={onClick}
      >
        {name}
      </span>
    );
  }
);

MaterialIcon.displayName = 'MaterialIcon';

export default MaterialIcon;

// Common icon name constants for type safety and discoverability
export const Icons = {
  // Navigation
  home: 'home',
  dashboard: 'dashboard',
  menu: 'menu',
  close: 'close',
  arrowBack: 'arrow_back',
  arrowForward: 'arrow_forward',
  chevronLeft: 'chevron_left',
  chevronRight: 'chevron_right',
  expandMore: 'expand_more',
  expandLess: 'expand_less',

  // Actions
  search: 'search',
  add: 'add',
  edit: 'edit',
  delete: 'delete',
  refresh: 'refresh',
  save: 'save',
  share: 'share',
  download: 'download',
  upload: 'upload',

  // Content
  videoLibrary: 'video_library',
  playCircle: 'play_circle',
  pauseCircle: 'pause_circle',
  library: 'library_books',
  bookmark: 'bookmark',
  bookmarkBorder: 'bookmark_border',

  // Communication
  notifications: 'notifications',
  notificationsNone: 'notifications_none',
  email: 'email',
  chat: 'chat',

  // User
  person: 'person',
  accountCircle: 'account_circle',
  settings: 'settings',
  logout: 'logout',
  login: 'login',

  // Status
  checkCircle: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
  helpOutline: 'help_outline',
  help: 'help',

  // Learning
  school: 'school',
  psychology: 'psychology',
  lightbulb: 'lightbulb',
  trendingUp: 'trending_up',
  insights: 'insights',
  quiz: 'quiz',
  timer: 'timer',

  // Engagement
  thumbUp: 'thumb_up',
  thumbDown: 'thumb_down',
  comment: 'comment',
  subscriptions: 'subscriptions',
  star: 'star',
  starBorder: 'star_border',
  favorite: 'favorite',
  favoriteBorder: 'favorite_border',
} as const;

export type IconName = (typeof Icons)[keyof typeof Icons];
