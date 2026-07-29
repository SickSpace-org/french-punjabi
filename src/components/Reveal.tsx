"use client";

import { useEffect, useRef, useState } from "react";

type Variant = "up" | "scale" | "left" | "right" | "icon" | "fade";

type RevealProps = {
  children?: React.ReactNode;
  className?: string;
  delayMs?: number;
  durationMs?: number;
  variant?: Variant;
  threshold?: number;
};

export default function Reveal({
  children,
  className = "",
  delayMs = 0,
  durationMs = 750,
  variant = "up",
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, threshold]);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={`reveal reveal-${variant} ${visible ? "is-visible" : ""} ${className}`}
      style={{
        transitionDuration: `${durationMs}ms`,
        transitionDelay: visible ? `${delayMs}ms` : "0ms",
      }}
    >
      {children}
    </div>
  );
}
