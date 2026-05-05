import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Zap, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { useFetch } from '../hooks/usePolling';
import { fetchSummary, fetchTests } from '../utils/api';
import { StatCard, StatusBadge, PageLoading, EmptyState } from '../components/Shared';
import { formatDuration, formatNumber, formatPercent, formatDate, methodColor } from '../utils/helpers';

export default function Dashboard() {
  const { data: summary, loading: summaryLoading } = useFetch(fetchSummary);
  const { data: recentTests, loading: testsLoading } = useFetch(
    () => fetchTests({ limit: 5 })
  );

  if (summaryLoading && testsLoading) return <PageLoading />;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-100">Dashboard</h2>
          <p className="text-sm text-surface-500 mt-1">Overview of your API stress testing</p>
        </div>
        <Link to="/tests/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Test
        </Link>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Tests"
            value={formatNumber(summary.total_tests)}
            className="stagger-1 animate-fade-in-up"
          />
          <StatCard
            label="Running"
            value={formatNumber(summary.running_tests)}
            accent={summary.running_tests > 0}
            className="stagger-2 animate-fade-in-up"
          />
          <StatCard
            label="Avg Throughput"
            value={summary.avg_requests_per_second ? `${summary.avg_requests_per_second} rps` : '—'}
            className="stagger-3 animate-fade-in-up"
          />
          <StatCard
            label="Avg Error Rate"
            value={formatPercent(summary.avg_error_rate)}
            className="stagger-4 animate-fade-in-up"
          />
        </div>
      )}

      {/* Recent Tests */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-surface-200">Recent Tests</h3>
          <Link to="/tests" className="btn-ghost text-sm">View all →</Link>
        </div>

        {recentTests?.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No tests yet"
            description="Create your first API stress test to get started."
            action={
              <Link to="/tests/new" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Test
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {recentTests?.map((test, i) => (
              <Link
                key={test.id}
                to={`/tests/${test.id}`}
                className="card-hover flex items-center gap-4 p-4 group"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-semibold ${methodColor(test.http_method)}`}>
                      {test.http_method}
                    </span>
                    <h4 className="font-medium text-surface-200 truncate group-hover:text-accent transition-colors">
                      {test.name}
                    </h4>
                  </div>
                  <p className="text-xs text-surface-500 font-mono mt-0.5 truncate">
                    {test.target_url}
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-6 text-xs text-surface-400">
                  <span title="Total requests">{formatNumber(test.total_requests)} req</span>
                  <span title="Concurrent users">{test.concurrent_users} users</span>
                  {test.avg_response_time_ms != null && (
                    <span title="Avg response time">{formatDuration(test.avg_response_time_ms)}</span>
                  )}
                </div>

                <StatusBadge status={test.status} />
                <span className="text-xs text-surface-600">{formatDate(test.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
