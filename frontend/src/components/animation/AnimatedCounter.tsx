import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  flashOnChange?: boolean;
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  flashOnChange = true,
}: AnimatedCounterProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0;
  const isStringWithText = typeof value === 'string' && isNaN(Number(value)) && !value.match(/^[₹$€0-9,.-]+$/);

  const spring = useSpring(0, {
    stiffness: 75,
    damping: 18,
    restDelta: 0.001,
  });

  const display = useTransform(spring, (latest) => {
    if (decimals > 0) {
      return latest.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return Math.round(latest).toLocaleString('en-IN');
  });

  const [flashing, setFlashing] = useState(false);
  const prevValueRef = useRef(numericValue);

  useEffect(() => {
    spring.set(numericValue);

    if (flashOnChange && prevValueRef.current !== numericValue) {
      setFlashing(true);
      const timer = setTimeout(() => setFlashing(false), 800);
      prevValueRef.current = numericValue;
      return () => clearTimeout(timer);
    }
  }, [numericValue, spring, flashOnChange]);

  if (isStringWithText) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span
      className={`inline-flex items-baseline transition-colors duration-300 ${
        flashing ? 'text-emerald-500 scale-[1.03]' : ''
      } ${className}`}
    >
      {prefix && <span className="opacity-90 mr-0.5">{prefix}</span>}
      <motion.span>{display}</motion.span>
      {suffix && <span className="opacity-90 ml-0.5">{suffix}</span>}
    </span>
  );
}
