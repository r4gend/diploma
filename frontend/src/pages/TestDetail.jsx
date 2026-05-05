import React, { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play, Square, Trash2, Edit3, ArrowLeft,
  Clock, Users, Gauge, AlertTriangle, CheckCircle, XCircle, TrendingUp,
} from 'lucide-react';
import { usePolling, useFetch } from '../hooks/usePolling';
import { fetchTest, fetchTimeline, runTest, cancelTest, deleteTest } from '../utils/api';
import { StatusBadge, StatCard, PageLoading, Spinner } from '../components/Shared';
import {
  ResponseTimeChart, StatusCodeChart, ThroughputChart, LatencyScatterChart,
} from '../components/Charts';
import {
  formatDuration, formatNumber, formatPercent, formatDate, methodColor,
} from '../utils/helpers';

export default function TestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(null);

  const isRunning = (test) => test?.status === 'running';

  const {
    data: test, loading, refresh,
  } = usePolling(
    useCallback(() => fetchTest(id), [id]),
    2000,
    true,
  );

  const {
    data: timeline, refresh: refreshTimeline,
  } = usePolling(
    useCallback(() => fetchTimeline(id), [id]),
    3000,
    test?.status === 'running' || test?.status === 'completed',
  );

  const handleRun = async () => {
    setActionLoading('run');
    try {
      await runTest(id);
      refresh();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    setActionLoading('cancel');
    try {
      await cancelTest(id);
      refresh();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this test and all results?')) return;
    await deleteTest(id);
    navigate('/tests');
  };

  if (loading && !test) return <PageLoading />;
  if (!test) return <div className="text-center text-surface-500 py-20">Test not found</div>;

  const hasResults = test.status === 'completed' || test.status === 'failed';
  const timelinePoints = timeline?.points || [];

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <Link to="/tests" className="btn-ghost inline-flex items-center gap-1.5 text-sm mb-4 -ml-4">
          <ArrowLeft className="w-4 h-4" /> Back to Tests
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className={`font-mono text-sm font-bold ${methodColor(test.http_method)}`}>
                {test.http_method}
              </span>
              <h2 className="font-display text-2xl font-bold text-surface-100 truncate">
                {test.name}
              </h2>
              <StatusBadge status={test.status} />
            </div>
            <p className="text-sm text-surface-500 font-mono mt-1 truncate">{test.target_url}</p>
            {test.description && (
              <p className="text-sm text-surface-400 mt-2">{test.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {test.status === 'running' ? (
              <button
                onClick={handleCancel}
                className="btn-danger flex items-center gap-2"
                disabled={actionLoading === 'cancel'}
              >
                {actionLoading === 'cancel' ? <Spinner size="sm" /> : <Square className="w-4 h-4" />}
                Cancel
              </button>
            ) : (
              <button
                onClick={handleRun}
                className="btn-primary flex items-center gap-2"
                disabled={actionLoading === 'run'}
              >
                {actionLoading === 'run' ? <Spinner size="sm" /> : <Play className="w-4 h-4" />}
                {hasResults ? 'Re-run' : 'Run Test'}
              </button>
            )}
            <button onClick={handleDelete} className="btn-danger p-2.5" title="Delete test">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Config Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-3.5 h-3.5 text-surface-500" />
            <span className="stat-label">Total Requests</span>
          </div>
          <p className="font-mono font-bold text-surface-200">{formatNumber(test.total_requests)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-surface-500" />
            <span className="stat-label">Concurrent Users</span>
          </div>
          <p className="font-mono font-bold text-surface-200">{test.concurrent_users}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-surface-500" />
            <span className="stat-label">Ramp-Up</span>
          </div>
          <p className="font-mono font-bold text-surface-200">{test.ramp_up_seconds}s</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-surface-500" />
            <span className="stat-label">Timeout</span>
          </div>
          <p className="font-mono font-bold text-surface-200">{test.timeout_seconds}s</p>
        </div>
      </div>

      {/* Running indicator */}
      {test.status === 'running' && (
        <div className="card p-5 border-accent/30 bg-accent/5">
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <div>
              <p className="font-medium text-accent">Test is running…</p>
              <p className="text-xs text-surface-400 mt-0.5">
                {test.total_requests_sent > 0
                  ? `${formatNumber(test.total_requests_sent)} / ${formatNumber(test.total_requests)} requests sent`
                  : 'Starting virtual users…'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {(hasResults || test.status === 'running') && test.avg_response_time_ms != null && (
        <>
          {/* Key Metrics */}
          <section>
            <h3 className="font-display font-semibold text-surface-200 mb-4">Results Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Avg Response"
                value={formatDuration(test.avg_response_time_ms)}
                accent
              />
              <StatCard
                label="Requests/sec"
                value={test.requests_per_second ? `${test.requests_per_second}` : '—'}
                sub="throughput"
              />
              <StatCard
                label="Error Rate"
                value={formatPercent(test.error_rate)}
                sub={`${formatNumber(test.failed_requests)} failed`}
              />
              <StatCard
                label="Success"
                value={formatNumber(test.successful_requests)}
                sub={`of ${formatNumber(test.total_requests_sent)}`}
              />
            </div>
          </section>

          {/* Percentiles */}
          <section>
            <h3 className="font-display font-semibold text-surface-200 mb-4">Response Time Percentiles</h3>
            <div className="card overflow-hidden">
              <div className="grid grid-cols-5 divide-x divide-surface-800/60">
                {[
                  { label: 'Min', value: test.min_response_time_ms },
                  { label: 'Median (p50)', value: test.median_response_time_ms },
                  { label: 'p95', value: test.p95_response_time_ms },
                  { label: 'p99', value: test.p99_response_time_ms },
                  { label: 'Max', value: test.max_response_time_ms },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 text-center">
                    <p className="stat-label">{label}</p>
                    <p className="font-mono font-bold text-surface-200 mt-1">{formatDuration(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Charts */}
          <section className="space-y-4">
            <h3 className="font-display font-semibold text-surface-200">Charts</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ResponseTimeChart data={timelinePoints} />
              <ThroughputChart data={timelinePoints} />
              <StatusCodeChart distribution={test.status_code_distribution} />
              <LatencyScatterChart data={timelinePoints} />
            </div>
          </section>
        </>
      )}

      {/* Timing */}
      {(test.started_at || test.completed_at) && (
        <section className="text-xs text-surface-600 flex gap-6">
          {test.started_at && <span>Started: {formatDate(test.started_at)}</span>}
          {test.completed_at && <span>Completed: {formatDate(test.completed_at)}</span>}
        </section>
      )}
    </div>
  );
}
