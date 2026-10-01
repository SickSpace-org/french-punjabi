"use client";

import { useEffect, useState } from "react";

/**
 * Cycles through `words` in place. Every word sits in the same grid cell so
 * the line keeps the width of the longest one and nothing around it jumps.
 */
export default function RotatingWord({
  words,
  intervalMs = 2600,
  className = "",
}: {
  words: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  return (
    <span className={`inline-grid ${className}`}>
      <span className="sr-only">{words[0]}</span>
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden="true"
          className={`word-swap col-start-1 row-start-1 whitespace-nowrap ${
            i === index ? "is-active" : ""
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
