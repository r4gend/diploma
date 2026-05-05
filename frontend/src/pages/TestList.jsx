import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, List } from 'lucide-react';
import { useFetch } from '../hooks/usePolling';
import { fetchTests, deleteTest } from '../utils/api';
import { StatusBadge, PageLoading, EmptyState } from '../components/Shared';
import { formatDuration, formatNumber, formatPercent, formatDate, methodColor } from '../utils/helpers';

export default function TestList() {
  const [filter, setFilter] = useState('');
  const { data: tests, loading, refresh } = useFetch(() => fetchTests(filter ? { status: filter } : {}), [filter]);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this test and all its results?')) return;
    await deleteTest(id);
    refresh();
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-surface-100">Tests</h2>
          <p className="text-sm text-surface-500 mt-1">Manage all your stress test configurations</p>
        </div>
        <Link to="/tests/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Test
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-surface-900/60 rounded-lg border border-surface-800/60 w-fit">
        {['', 'pending', 'running', 'completed', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${filter === s
                ? 'bg-surface-700 text-surface-100'
                : 'text-surface-400 hover:text-surface-200'
              }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {tests?.length === 0 ? (
        <EmptyState
          icon={List}
          title="No tests found"
          description={filter ? `No tests with status "${filter}"` : 'Create your first test to begin.'}
          action={
            !filter && (
              <Link to="/tests/new" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Test
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {tests?.map((test, i) => (
            <Link
              key={test.id}
              to={`/tests/${test.id}`}
              className="card-hover flex items-center gap-4 p-4 group animate-fade-in-up"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold ${methodColor(test.http_method)}`}>
                    {test.http_method}
                  </span>
                  <h4 className="font-medium text-surface-200 truncate group-hover:text-accent transition-colors">
                    {test.name}
                  </h4>
                </div>
                <p className="text-xs text-surface-500 font-mono mt-0.5 truncate">{test.target_url}</p>
              </div>

              <div className="hidden lg:flex items-center gap-6 text-xs text-surface-400 shrink-0">
                <div className="text-center">
                  <p className="font-mono font-medium text-surface-300">{formatNumber(test.total_requests)}</p>
                  <p className="text-surface-600">requests</p>
                </div>
                <div className="text-center">
                  <p className="font-mono font-medium text-surface-300">{test.concurrent_users}</p>
                  <p className="text-surface-600">users</p>
                </div>
                {test.avg_response_time_ms != null && (
                  <div className="text-center">
                    <p className="font-mono font-medium text-accent">{formatDuration(test.avg_response_time_ms)}</p>
                    <p className="text-surface-600">avg</p>
                  </div>
                )}
                {test.requests_per_second != null && (
                  <div className="text-center">
                    <p className="font-mono font-medium text-success">{test.requests_per_second}</p>
                    <p className="text-surface-600">rps</p>
                  </div>
                )}
                {test.error_rate != null && (
                  <div className="text-center">
                    <p className={`font-mono font-medium ${test.error_rate > 5 ? 'text-danger' : 'text-surface-300'}`}>
                      {formatPercent(test.error_rate)}
                    </p>
                    <p className="text-surface-600">errors</p>
                  </div>
                )}
              </div>

              <StatusBadge status={test.status} />
              <span className="text-xs text-surface-600 shrink-0">{formatDate(test.created_at)}</span>

              <button
                onClick={(e) => handleDelete(e, test.id)}
                className="p-2 rounded-lg text-surface-600 hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete test"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
