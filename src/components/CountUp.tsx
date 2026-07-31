"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type CountUpProps = {
  end: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  delayMs?: number;
  className?: string;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

/** Always false during SSR — matches the server-rendered output exactly. */
function getReducedMotionServerSnapshot() {
  return false;
}

export default function CountUp({
  end,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1800,
  delayMs = 0,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || !visible) return;

    let frame: number;
    let cancelled = false;

    const timeout = setTimeout(() => {
      const startTime = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min((now - startTime) / duration, 1);
        const factor = 10 ** decimals;
        setValue(Math.round(easeOutCubic(progress) * end * factor) / factor);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        }
      };

      frame = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [visible, end, decimals, duration, delayMs, reducedMotion]);

  const displayValue = reducedMotion ? end : visible ? value : 0;

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}
