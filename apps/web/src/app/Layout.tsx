import {
  RiDashboardLine,
  RiScales3Line,
  RiCapsuleLine,
  RiHeartPulseLine,
  RiRunLine,
  RiSettings3Line,
} from '@remixicon/react';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Today', icon: RiDashboardLine, end: true },
  { to: '/weight', label: 'Weight', icon: RiScales3Line },
  { to: '/medications', label: 'Meds', icon: RiCapsuleLine },
  { to: '/symptoms', label: 'Symptoms', icon: RiHeartPulseLine },
  { to: '/activity', label: 'Activity', icon: RiRunLine },
  { to: '/settings', label: 'Settings', icon: RiSettings3Line },
];

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <header className="flex h-14 items-center bg-[#1c1e2a] px-4">
        <h1 className="font-serif text-lg font-semibold text-white">Pulsr</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
                isActive ? 'text-[#1c1e2a]' : 'text-neutral-400'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
