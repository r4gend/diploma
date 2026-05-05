import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Zap, LayoutDashboard, Plus, List,
  Activity, Loader2
} from 'lucide-react';
import { statusColor, statusBg } from '../utils/helpers';

// --- Layout ---
export function Layout({ children }) {
  const location = useLocation();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/tests', icon: List, label: 'Tests' },
    { to: '/tests/new', icon: Plus, label: 'New Test' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-surface-800/60 bg-surface-950/80 flex flex-col fixed h-full z-20">
        <div className="p-6 border-b border-surface-800/60">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center
                          group-hover:bg-accent/20 transition-colors">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-surface-100 leading-none">
                StressForge
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-surface-500 mt-0.5">
                API Load Tester
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to ||
              (to === '/tests' && location.pathname.startsWith('/tests') && location.pathname !== '/tests/new');
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${active
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 border border-transparent'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-surface-800/60">
          <div className="flex items-center gap-2 text-xs text-surface-600">
            <Activity className="w-3 h-3" />
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// --- Status Badge ---
export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide
      border ${statusBg(status)} ${statusColor(status)}`}>
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
      )}
      {status}
    </span>
  );
}

// --- Stat Card ---
export function StatCard({ label, value, sub, accent = false, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <p className="stat-label">{label}</p>
      <p className={`stat-value mt-1 ${accent ? 'text-accent' : 'text-surface-100'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
    </div>
  );
}

// --- Spinner ---
export function Spinner({ size = 'md', className = '' }) {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <Loader2 className={`animate-spin text-accent ${sizeClasses[size]} ${className}`} />
  );
}

// --- Page Loading ---
export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-surface-500">Loading…</p>
      </div>
    </div>
  );
}

// --- Empty State ---
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card p-12 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-surface-800/60 border border-surface-700/60
                      flex items-center justify-center mx-auto mb-4">
          <Icon className="w-6 h-6 text-surface-500" />
        </div>
      )}
      <h3 className="font-display font-semibold text-surface-200">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 mt-2 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
