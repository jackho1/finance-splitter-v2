import * as React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  User,
  Layers,
  Settings,
  Sun,
  Moon,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { to: '/transactions', label: 'Transactions', icon: LayoutDashboard },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/personal', label: 'Personal', icon: User },
  { to: '/offset', label: 'Offset', icon: Layers },
];

// Pixel widths. Inline style + transition guarantees the browser fires
// the width animation — we had issues toggling two Tailwind w-* classes.
const WIDTH_EXPANDED = 256;
// Collapsed rail width. 72px leaves ~14px of breathing room around the
// 40px (h-10 w-10) icon buttons so they don't feel cramped or clipped.
const WIDTH_COLLAPSED = 72;
const WIDTH_HIDDEN = 0;
const TRANSITION = 'width 280ms cubic-bezier(0.4, 0, 0.2, 1), border-color 280ms linear';

function readStoredTheme() {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem('theme') || 'light';
}

/**
 * Toggles the global theme the same way UserPreferencesContext already does:
 * swap the html.theme-{light|dark} class and persist the choice to localStorage.
 * This stays compatible with the existing theming pipeline so per-user accent
 * and runtime overrides continue to work.
 */
function useThemeToggle() {
  const [theme, setTheme] = React.useState(readStoredTheme);

  const toggle = React.useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch (err) {
      /* ignore persistence errors */
    }
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${next}`);
  }, [theme]);

  // Keep in sync if another part of the app changes the theme.
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const root = document.documentElement;
      if (root.classList.contains('theme-dark')) setTheme('dark');
      else if (root.classList.contains('theme-light')) setTheme('light');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return { theme, toggle };
}

function SidebarItem({ to, label, icon: Icon, collapsed }) {
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group flex items-center rounded-md text-sm font-medium transition-colors',
          collapsed
            ? 'mx-auto h-10 w-10 justify-center p-0'
            : 'gap-3 px-3 py-2',
          'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive &&
            'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-inset ring-primary/20'
        )
      }
      end={to === '/'}
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'shrink-0 transition-colors',
              collapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4',
              isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
            )}
          />
          {!collapsed && <span>{label}</span>}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Sidebar has three states: hidden, collapsed (icon rail, a.k.a.
 * "minimized"), and expanded. The outer aside animates its width via an
 * inline style so the transition fires reliably. An inner fixed-width
 * shell holds the nav items and is clipped by the aside's overflow.
 */
export function Sidebar({
  hidden,
  collapsed,
  onToggleCollapsed,
  helpVisible,
  onToggleHelp,
}) {
  const { theme, toggle } = useThemeToggle();

  const targetWidth = hidden
    ? WIDTH_HIDDEN
    : collapsed
      ? WIDTH_COLLAPSED
      : WIDTH_EXPANDED;

  // When collapsed, the inner shell renders its icon-only layout; when
  // expanded it renders the full layout. When hidden, we keep whatever
  // layout was last shown so the slide-in reveal is smooth rather than
  // reflowing halfway through the animation.
  const innerCollapsed = collapsed;

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-hidden={hidden ? 'true' : 'false'}
        style={{
          width: `${targetWidth}px`,
          transition: TRANSITION,
        }}
        className={cn(
          'sticky top-0 h-screen shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground',
          hidden ? 'border-r-0' : 'border-r border-sidebar-border'
        )}
      >
        {/* Fixed-width inner panel so the aside's width animation clips
            content gracefully instead of causing children to reflow. */}
        <div
          className="flex h-full flex-col"
          style={{ width: `${innerCollapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED}px` }}
        >
          {/* Brand — pl-16 when expanded so it doesn't collide with the
              fixed toggle button pinned at viewport left:12, top:12. */}
          <div
            className={cn(
              'flex h-14 items-center gap-2 border-b border-sidebar-border',
              innerCollapsed ? 'justify-center px-2' : 'pl-16 pr-4'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </div>
            {!innerCollapsed && (
              <span className="text-sm font-semibold tracking-tight">Finance</span>
            )}
          </div>

          {/* Nav */}
          <nav
            className={cn(
              'flex-1 space-y-1 overflow-y-auto',
              innerCollapsed ? 'flex flex-col items-center p-2' : 'p-2'
            )}
          >
            {NAV_ITEMS.map((item) => (
              <SidebarItem key={item.to} {...item} collapsed={innerCollapsed} />
            ))}
          </nav>

          <Separator className="bg-sidebar-border" />

          {/* Footer */}
          <div
            className={cn(
              'space-y-1 p-2',
              innerCollapsed && 'flex flex-col items-center'
            )}
          >
            <SidebarItem
              to="/settings"
              label="Settings"
              icon={Settings}
              collapsed={innerCollapsed}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size={innerCollapsed ? 'icon' : 'sm'}
                  onClick={onToggleHelp}
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    innerCollapsed
                      ? 'mx-auto h-10 w-10 justify-center'
                      : 'w-full justify-start gap-3'
                  )}
                >
                  <HelpCircle className={cn('shrink-0', innerCollapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4')} />
                  {!innerCollapsed && (
                    <span className="text-sm">{helpVisible ? 'Hide help' : 'Show help'}</span>
                  )}
                </Button>
              </TooltipTrigger>
              {innerCollapsed && (
                <TooltipContent side="right">
                  {helpVisible ? 'Hide help' : 'Show help'}
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size={innerCollapsed ? 'icon' : 'sm'}
                  onClick={toggle}
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    innerCollapsed
                      ? 'mx-auto h-10 w-10 justify-center'
                      : 'w-full justify-start gap-3'
                  )}
                >
                  {theme === 'dark' ? (
                    <Sun className={cn('shrink-0', innerCollapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4')} />
                  ) : (
                    <Moon className={cn('shrink-0', innerCollapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4')} />
                  )}
                  {!innerCollapsed && (
                    <span className="text-sm">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                  )}
                </Button>
              </TooltipTrigger>
              {innerCollapsed && (
                <TooltipContent side="right">
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size={innerCollapsed ? 'icon' : 'sm'}
                  onClick={onToggleCollapsed}
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    innerCollapsed
                      ? 'mx-auto h-10 w-10 justify-center'
                      : 'w-full justify-start gap-3'
                  )}
                  aria-label={innerCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                >
                  {innerCollapsed ? (
                    <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4 shrink-0" />
                  )}
                  {!innerCollapsed && <span className="text-sm">Minimize</span>}
                </Button>
              </TooltipTrigger>
              {innerCollapsed && <TooltipContent side="right">Expand sidebar</TooltipContent>}
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
