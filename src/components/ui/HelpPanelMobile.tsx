/**
 * HelpPanelMobile Component
 * Bottom sheet version of help panel for mobile devices
 */
import { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import MaterialIcon from './MaterialIcon';

export interface HelpPanelMobileProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Title displayed in header */
  title?: string;
  /** Content to render in the panel */
  children: ReactNode;
}

export default function HelpPanelMobile({
  isOpen,
  onClose,
  title = 'Help',
  children,
}: HelpPanelMobileProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);

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
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Swipe to close functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
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
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={title}
        className="fixed bottom-0 left-0 right-0 h-[80vh] bg-background border-t-3 border-border z-50 flex flex-col rounded-t-lg animate-slide-up"
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <MaterialIcon name="help_outline" size="lg" className="text-primary" />
            <h2 className="font-heading font-bold text-lg text-text">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background/50 rounded transition-colors"
            aria-label="Close panel"
          >
            <MaterialIcon name="close" size="lg" className="text-text" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {/* Swipe hint */}
        <div className="text-center py-2 text-xs text-text/50">
          Swipe down to close
        </div>
      </div>
    </>,
    document.body
  );
}
