import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useUI } from '../context/useUI';

const glassMap = {
  simple: '',
  normal: 'glass glass-shimmer',
  complex: 'glass glass-shimmer',
  extreme: 'glass-strong glass-shimmer',
};

const hoverMap = {
  simple: 'hover:bg-gray-50 dark:hover:bg-gray-900',
  normal: 'hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60',
  complex: 'hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60',
  extreme: 'hover-lift hover:border-indigo-200 dark:hover:border-indigo-800/60',
};

const Card = forwardRef(function Card(
  {
    children,
    className = '',
    glass = true,
    hoverable = false,
    clickable = false,
    padded = true,
    radius = '2xl',
    as: Component = 'div',
    motionProps = {},
    ...props
  },
  ref
) {
  const { complexity } = useUI();

  const glassClass = glass ? glassMap[complexity] || '' : '';
  const hoverClass = hoverable || clickable ? hoverMap[complexity] || '' : '';
  const padClass = padded ? 'p-5' : '';
  const cursorClass = clickable ? 'cursor-pointer' : '';
  const radiusClass = `rounded-${radius}`;

  const base = `${radiusClass} border border-gray-200/80 dark:border-slate-800/80 transition-all duration-200 ${glassClass} ${hoverClass} ${padClass} ${cursorClass} ${className}`.trim();

  if (clickable || Object.keys(motionProps).length > 0) {
    const mergedMotion = {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      whileHover: clickable ? { scale: 1.01, y: -1 } : undefined,
      transition: { duration: 0.2 },
      ...motionProps,
    };
    return (
      <motion.div ref={ref} className={base} {...mergedMotion} {...props}>
        {children}
      </motion.div>
    );
  }

  return (
    <Component ref={ref} className={base} {...props}>
      {children}
    </Component>
  );
});

export function CardSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-200/80 dark:border-slate-800/80 p-5 ${className}`}>
      <div className="skeleton-shimmer h-5 w-3/4 rounded-lg mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer h-3 rounded-md mb-2"
          style={{ width: `${85 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export default Card;
