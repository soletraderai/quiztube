import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** The content to display in the tooltip */
  content: ReactNode;
  /** The element that triggers the tooltip */
  children: ReactNode;
  /** Position of the tooltip relative to the trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip in ms (default 200) */
  delay?: number;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * Tooltip - A neobrutalist tooltip that fades in with a slight scale animation.
 * Uses portal to render at document root to avoid overflow issues.
 */
export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsAnimating(false);
    // Wait for exit animation
    setTimeout(() => {
      setIsVisible(false);
    }, 150);
  };

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current?.getBoundingClientRect();
      const tooltipWidth = tooltipRect?.width || 100;
      const tooltipHeight = tooltipRect?.height || 40;
      const offset = 8;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - tooltipHeight - offset + window.scrollY;
          left = rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX;
          break;
        case 'bottom':
          top = rect.bottom + offset + window.scrollY;
          left = rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
          left = rect.left - tooltipWidth - offset + window.scrollX;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
          left = rect.right + offset + window.scrollX;
          break;
      }

      setCoords({ top, left });
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipElement = isVisible ? (
    <div
      ref={tooltipRef}
      role="tooltip"
      className={`
        fixed z-[9999] px-3 py-2
        bg-text text-background
        font-heading font-semibold text-sm
        border-2 border-border shadow-brutal-sm
        transition-all duration-150 ease-out
        ${isAnimating
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95'
        }
        ${className}
      `}
      style={{
        top: coords.top,
        left: coords.left,
        transformOrigin: position === 'top' ? 'bottom center'
          : position === 'bottom' ? 'top center'
          : position === 'left' ? 'right center'
          : 'left center',
      }}
    >
      {content}
      {/* Arrow */}
      <div
        className={`
          absolute w-2 h-2 bg-text border-border rotate-45
          ${position === 'top' ? 'bottom-[-5px] left-1/2 -translate-x-1/2 border-r-2 border-b-2' : ''}
          ${position === 'bottom' ? 'top-[-5px] left-1/2 -translate-x-1/2 border-l-2 border-t-2' : ''}
          ${position === 'left' ? 'right-[-5px] top-1/2 -translate-y-1/2 border-t-2 border-r-2' : ''}
          ${position === 'right' ? 'left-[-5px] top-1/2 -translate-y-1/2 border-b-2 border-l-2' : ''}
        `}
      />
    </div>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
}
