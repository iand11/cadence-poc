import { useState, useEffect, useRef } from 'react';
import { formatNumber, formatCurrency } from '../../utils/formatters';

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function AnimatedNumber({
  value,
  duration = 1500,
  prefix = '',
  suffix = '',
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const previousValueRef = useRef(0);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const endValue = value;

    if (startValue === endValue) return;

    startTimeRef.current = null;

    function animate(timestamp) {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const current = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = endValue;
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  const formatted =
    prefix === '$'
      ? formatCurrency(Math.round(displayValue))
      : `${prefix}${formatNumber(Math.round(displayValue))}${suffix}`;

  return <span className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatted}</span>;
}
