import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export function StaggerContainer({
  children,
  className = '',
  delay = 0.05,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            delayChildren: delay,
            staggerChildren: stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.98 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1],
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionCard({
  children,
  className = '',
  hoverScale = 1.012,
  ...props
}: HTMLMotionProps<'div'> & {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
}) {
  return (
    <motion.div
      className={`transition-shadow duration-300 ${className}`}
      whileHover={{
        y: -4,
        scale: hoverScale,
        transition: { duration: 0.22, ease: 'easeOut' },
      }}
      whileTap={{ scale: 0.99 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
