import { NavLink } from 'react-router-dom';
import {
  Home,
  CalendarDays,
  CheckSquare,
  Sparkles,
  UtensilsCrossed,
  ShoppingCart,
  GraduationCap,
  StickyNote,
  Heart,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  show?: boolean;
}

export function Sidebar() {
  const { get, update } = useSettings();
  const personalEnabled = get<boolean>('personal.enabled', true);
  const collapsed = get<boolean>('display.sidebarCollapsed', false);

  const toggle = () => update({ 'display.sidebarCollapsed': !collapsed });

  const entries: NavEntry[] = [
    { to: '/', label: get<string>('nav.homeLabel', 'Home'), icon: Home },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/chores', label: 'Chores', icon: Sparkles },
    { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
    { to: '/lists', label: 'Lists', icon: ShoppingCart },
    { to: '/school', label: 'School', icon: GraduationCap },
    { to: '/notes', label: 'Notes', icon: StickyNote },
    { to: '/personal', label: 'Us', icon: Heart, show: personalEnabled },
  ];

  return (
    <nav
      className={`${
        collapsed ? 'w-20' : 'w-28 xl:w-32'
      } shrink-0 h-full bg-surface-card border-r border-line
         flex flex-col items-center py-4 gap-2 kiosk-nosel transition-[width] duration-200`}
    >
      <button
        onClick={toggle}
        aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
        className="mb-2 p-2 rounded-xl text-accent hover:bg-accent-soft/60 active:scale-95 transition"
      >
        {collapsed ? <PanelLeftOpen size={28} /> : <PanelLeftClose size={28} />}
      </button>
      <div className="flex-1 flex flex-col gap-1.5 w-full px-2 overflow-y-auto no-scrollbar">
        {entries
          .filter((e) => e.show !== false)
          .map((e) => (
            <NavLink
              key={e.to}
              to={e.to}
              end={e.to === '/'}
              title={collapsed ? e.label : undefined}
              className={({ isActive }) =>
                `nav-item ${collapsed ? '!py-3' : ''} ${
                  isActive ? 'nav-item-active' : 'hover:bg-accent-soft/60'
                }`
              }
            >
              <e.icon size={30} strokeWidth={2.1} />
              {!collapsed && <span className="text-xs xl:text-sm font-bold">{e.label}</span>}
            </NavLink>
          ))}
      </div>
      <NavLink
        to="/settings"
        title={collapsed ? 'Settings' : undefined}
        className={({ isActive }) =>
          `nav-item w-[calc(100%-1rem)] ${collapsed ? '!py-3' : ''} ${
            isActive ? 'nav-item-active' : 'hover:bg-accent-soft/60'
          }`
        }
      >
        <Settings size={28} />
        {!collapsed && <span className="text-xs font-bold">Settings</span>}
      </NavLink>
    </nav>
  );
}
