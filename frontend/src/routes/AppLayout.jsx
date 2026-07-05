import * as React from 'react';
import { Menu, PanelLeftClose } from 'lucide-react';
import { Sidebar } from './layout/Sidebar';

/**
 * Top-level layout shell for the finance dashboard.
 *
 * Sidebar has THREE states driven by two booleans:
 *   - hidden=true              → width 0  (fully off)
 *   - hidden=false collapsed=t → width 64 (icon-only rail, a.k.a. "minimized")
 *   - hidden=false collapsed=f → width 256 (fully expanded)
 *
 * The `hidden` flag is toggled by the fixed top-left button (single click
 * target, icon swaps between Menu and PanelLeftClose). The `collapsed`
 * flag — minimize to icon rail — is toggled from inside the sidebar
 * footer. Both are persisted to localStorage.
 *
 * The sidebar is ALWAYS mounted and animates its width via an inline
 * style so the transition is guaranteed to fire (Tailwind's
 * `transition-[width]` was flaky when toggled between two w-* classes).
 */

const LayoutContext = React.createContext({
  helpVisible: false,
  setHelpVisible: () => {},
});

export function useLayoutHelp() {
  return React.useContext(LayoutContext);
}

export function AppLayout({ children }) {
  const [hidden, setHidden] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar:hidden') === '1';
  });
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar:collapsed') === '1';
  });
  const [helpVisible, setHelpVisible] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('help:visible') === '1';
  });

  const toggleHidden = React.useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar:hidden', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar:collapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleHelp = React.useCallback(() => {
    setHelpVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('help:visible', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const layoutContextValue = React.useMemo(
    () => ({ helpVisible, setHelpVisible }),
    [helpVisible]
  );

  return (
    <LayoutContext.Provider value={layoutContextValue}>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar
          hidden={hidden}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          helpVisible={helpVisible}
          onToggleHelp={toggleHelp}
        />

        {/* Single fixed toggle. Its viewport position never changes —
            the user clicks the same spot to hide or show. */}
        <button
          type="button"
          onClick={toggleHidden}
          aria-label={hidden ? 'Show sidebar' : 'Hide sidebar'}
          title={hidden ? 'Show sidebar' : 'Hide sidebar'}
          className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
        >
          {hidden ? <Menu className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="mx-auto max-w-[1600px] px-4 py-6 pl-16 md:px-8 md:py-8 md:pl-20">
            {children}
          </div>
        </main>
      </div>
    </LayoutContext.Provider>
  );
}
