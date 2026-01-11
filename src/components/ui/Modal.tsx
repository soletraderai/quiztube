import { ReactNode, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional title for the modal header */
  title?: string;
  /** Optional subtitle for the modal header */
  subtitle?: string;
  /** Whether clicking outside closes the modal (default true) */
  closeOnOverlayClick?: boolean;
  /** Maximum width class (default 'max-w-2xl') */
  maxWidth?: string;
  /** Optional aria-labelledby id */
  ariaLabelledBy?: string;
}

/**
 * Modal - Animated modal dialog with scale + fade animation.
 * Uses portal to render at document root.
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  closeOnOverlayClick = true,
  maxWidth = 'max-w-2xl',
  ariaLabelledBy,
}: ModalProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle open/close with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else if (shouldRender) {
      // Start exit animation
      setIsExiting(true);
      // After animation completes, stop rendering
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
        document.body.style.overflow = '';
      }, 200); // Match exit animation duration
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  if (!shouldRender) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${
        isExiting ? 'modal-overlay-exit' : 'modal-overlay'
      }`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy || (title ? 'modal-title' : undefined)}
    >
      <div
        className={`bg-surface border-3 border-border shadow-brutal w-full ${maxWidth} max-h-[90vh] flex flex-col ${
          isExiting ? 'modal-content-exit' : 'modal-content'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="p-4 border-b-3 border-border flex items-center justify-between">
            <div>
              {title && (
                <h2
                  id={ariaLabelledBy || 'modal-title'}
                  className="font-heading text-xl font-bold text-text"
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm text-text/70 mt-1">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 border-2 border-border hover:bg-border/20 transition-colors"
              aria-label="Close dialog"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  // Render to document body using portal
  return createPortal(modalContent, document.body);
}
