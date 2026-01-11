import { ReactNode, Children, cloneElement, isValidElement } from 'react';

interface StaggeredListProps {
  children: ReactNode;
  /** Base delay in ms before first item animates */
  baseDelay?: number;
  /** Delay between each item in ms */
  staggerDelay?: number;
  /** Animation duration in ms */
  duration?: number;
  /** CSS class name for the container */
  className?: string;
}

/**
 * StaggeredList - Animates children with a staggered entrance effect.
 * Each child will fade/slide in with an increasing delay.
 */
export default function StaggeredList({
  children,
  baseDelay = 0,
  staggerDelay = 75,
  duration = 400,
  className = '',
}: StaggeredListProps) {
  const childArray = Children.toArray(children);

  return (
    <div className={className}>
      {childArray.map((child, index) => {
        if (!isValidElement(child)) return child;

        const delay = baseDelay + index * staggerDelay;

        return (
          <div
            key={child.key || index}
            className="stagger-item"
            style={{
              animationDelay: `${delay}ms`,
              animationDuration: `${duration}ms`,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}

/**
 * StaggeredItem - Individual staggered item for more control.
 * Use this when you need to wrap specific elements with stagger animation.
 */
export function StaggeredItem({
  children,
  index = 0,
  baseDelay = 0,
  staggerDelay = 75,
  duration = 400,
  className = '',
}: {
  children: ReactNode;
  index?: number;
  baseDelay?: number;
  staggerDelay?: number;
  duration?: number;
  className?: string;
}) {
  const delay = baseDelay + index * staggerDelay;

  return (
    <div
      className={`stagger-item ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}
