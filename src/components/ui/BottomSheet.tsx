/**
 * BottomSheet Component
 * Mobile bottom sheet modal with drag-to-close functionality
 */
import { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import MaterialIcon from './MaterialIcon';

export interface BottomSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Content to render in the sheet */
  children: ReactNode;
  /** Title for the sheet header */
  title?: string;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Height of the sheet (default: 80vh) */
  height?: string;
  /** Whether to allow closing by backdrop click */
  closeOnBackdrop?: boolean;
  /** Callback when drag ends */
  onDragEnd?: () => void;
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
  height = '80vh',
  closeOnBackdrop = true,
  onDragEnd,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

  // Touch event handlers for swipe to close
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;
    // Only allow dragging down (positive diff)
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // Close if dragged more than 100px
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
    onDragEnd?.();
  };

  // Mouse event handlers for desktop drag
  const handleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    currentYRef.current = e.clientY;
    setIsDragging(true);

    const handleMouseMove = (e: MouseEvent) => {
      currentYRef.current = e.clientY;
      const diff = currentYRef.current - startYRef.current;
      if (diff > 0) {
        setDragOffset(diff);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (dragOffset > 100) {
        onClose();
      }
      setDragOffset(0);
      onDragEnd?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom sheet'}
        className="fixed bottom-0 left-0 right-0 bg-background border-t-3 border-border z-50 flex flex-col rounded-t-xl animate-slide-up"
        style={{
          height,
          maxHeight: '90vh',
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
            {title && (
              <h2 className="font-heading font-bold text-lg text-text">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-background/50 rounded transition-colors ml-auto"
                aria-label="Close"
              >
                <MaterialIcon name="close" size="lg" className="text-text" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {/* Swipe hint */}
        <div className="text-center py-2 text-xs text-text/50 border-t border-border">
          Swipe down to close
        </div>
      </div>
    </>,
    document.body
  );
}
