import { useLocation } from 'react-router-dom';
import { useRef, useEffect, useState, ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const prevLocationRef = useRef(location.pathname);
  const transitionTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only animate when location actually changes
    if (location.pathname !== prevLocationRef.current) {
      // Start exit animation
      setIsTransitioning(true);

      // Clear any existing timeout
      if (transitionTimeout.current) {
        clearTimeout(transitionTimeout.current);
      }

      // After exit animation completes, update content and start enter animation
      transitionTimeout.current = setTimeout(() => {
        setDisplayChildren(children);
        prevLocationRef.current = location.pathname;

        // Small delay before enter animation
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 200); // Exit animation duration
    } else {
      // Same path, just update children immediately
      setDisplayChildren(children);
    }

    return () => {
      if (transitionTimeout.current) {
        clearTimeout(transitionTimeout.current);
      }
    };
  }, [location.pathname, children]);

  return (
    <div
      className={`page-transition ${
        isTransitioning ? 'page-exit' : 'page-enter'
      }`}
    >
      {displayChildren}
    </div>
  );
}
