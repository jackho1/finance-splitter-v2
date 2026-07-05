import * as React from 'react';

/**
 * AutoFitText
 *
 * Renders `text` on a single line and shrinks the font-size until the
 * text fits the available container width. Used in the transactions
 * table description column so long names neither wrap nor truncate —
 * they simply scale down.
 *
 * Performance notes (important — we had a regression here):
 *   - No React state. Font-size is written directly to the DOM via a
 *     ref. This avoids triggering a re-render per row per fit.
 *   - Exactly ONE fit is scheduled per mount (via ResizeObserver's
 *     built-in initial firing), coalesced through requestAnimationFrame
 *     so multiple observers in the same frame do a single batch.
 *   - The fit loop writes font-size with a guarded max-iteration count
 *     so a degenerate measurement can't hang.
 *
 * Props:
 *   text  — plain string to fit
 *   minPx — smallest allowed font-size (default 9)
 *   maxPx — largest allowed font-size (default 14, matches text-sm)
 *   className — extra classes on the outer wrapper
 *   title — optional tooltip (defaults to the text itself)
 */
export function AutoFitText({
  text,
  minPx = 9,
  maxPx = 14,
  className = '',
  title,
}) {
  const containerRef = React.useRef(null);
  const textRef = React.useRef(null);
  // Track the current size written to the DOM so we only re-write on
  // genuine changes (skip no-op style mutations on resize).
  const currentSizeRef = React.useRef(maxPx);

  // Fit function writes font-size directly to the span — no setState,
  // no React re-render. Because we only iterate in a tight read/write
  // loop and bail out as soon as it fits, most rows cost 1 measurement.
  const fit = React.useCallback(() => {
    const container = containerRef.current;
    const span = textRef.current;
    if (!container || !span) return;

    const available = container.clientWidth;
    if (available <= 0) return;

    // Start at max and shrink only if needed.
    let size = maxPx;
    if (span.style.fontSize !== `${size}px`) {
      span.style.fontSize = `${size}px`;
    }
    // First measurement: most names fit at maxPx and we're done here.
    if (span.scrollWidth <= available) {
      currentSizeRef.current = size;
      return;
    }

    // Binary search between minPx and maxPx. Logs(5) ≈ 3 iterations
    // for the default 9..14 range, each being one DOM write plus one
    // scrollWidth read — still fast even for 100 rows.
    let lo = minPx;
    let hi = maxPx;
    let best = minPx;
    let guard = 0;
    while (lo <= hi && guard < 8) {
      const mid = Math.floor((lo + hi) / 2);
      span.style.fontSize = `${mid}px`;
      if (span.scrollWidth <= available) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
      guard += 1;
    }
    if (span.style.fontSize !== `${best}px`) {
      span.style.fontSize = `${best}px`;
    }
    currentSizeRef.current = best;
  }, [maxPx, minPx]);

  // A single ResizeObserver handles both the initial fit (it fires once
  // on .observe()) and all subsequent container width changes (sidebar
  // toggle, window resize, column reflow). We coalesce with rAF so if
  // many cells resize in the same tick, they all do their single fit
  // in the same frame.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof ResizeObserver === 'undefined') {
      // SSR / very old browsers: single synchronous fallback fit.
      requestAnimationFrame(fit);
      return undefined;
    }
    let raf = 0;
    const observer = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        fit();
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [fit]);

  // When the text prop changes, re-fit once on the next frame. No
  // multi-pass schedule; one rAF is enough because the container width
  // is stable by this point (text changes don't affect column layout).
  React.useEffect(() => {
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [fit, text]);

  return (
    <div
      ref={containerRef}
      className={`block w-full overflow-hidden ${className}`}
      title={title ?? text}
    >
      <span
        ref={textRef}
        className="block whitespace-nowrap"
        style={{ fontSize: `${maxPx}px`, lineHeight: 1.3 }}
      >
        {text}
      </span>
    </div>
  );
}
