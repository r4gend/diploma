import React from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, PieChart, Pie,
} from 'recharts';

const COLORS = {
  accent: '#06b6d4',
  accentLight: '#22d3ee',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  grid: '#1e293b',
  text: '#94a3b8',
  bg: '#0f172a',
};

const STATUS_COLORS = {
  '200': '#10b981', '201': '#34d399', '204': '#6ee7b7',
  '301': '#f59e0b', '302': '#fbbf24',
  '400': '#ef4444', '401': '#f87171', '403': '#fb923c',
  '404': '#f97316', '500': '#dc2626', '502': '#b91c1c', '503': '#991b1b',
  error: '#7f1d1d',
};

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-surface-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono font-medium">
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// --- Response Time Timeline ---
export function ResponseTimeChart({ data }) {
  if (!data?.length) return <EmptyChart label="No timeline data" />;

  return (
    <div className="card p-5">
      <h4 className="font-display font-semibold text-surface-200 mb-4">Response Time Over Time</h4>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="rtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="timestamp"
            stroke={COLORS.text}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v.toFixed(1)}s`}
          />
          <YAxis
            stroke={COLORS.text}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)}ms`} />} />
          <Area
            type="monotone"
            dataKey="response_time_ms"
            name="Response Time"
            stroke={COLORS.accent}
            fill="url(#rtGrad)"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Status Code Distribution ---
export function StatusCodeChart({ distribution }) {
  if (!distribution || Object.keys(distribution).length === 0)
    return <EmptyChart label="No status code data" />;

  const data = Object.entries(distribution).map(([code, count]) => ({
    code,
    count,
    fill: STATUS_COLORS[code] || COLORS.text,
  }));

  return (
    <div className="card p-5">
      <h4 className="font-display font-semibold text-surface-200 mb-4">Status Code Distribution</h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey="code" stroke={COLORS.text} tick={{ fontSize: 11 }} />
          <YAxis stroke={COLORS.text} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Throughput (RPS) Over Time ---
export function ThroughputChart({ data, bucketSizeMs = 1000 }) {
  if (!data?.length) return <EmptyChart label="No throughput data" />;

  // Bucket data into time intervals
  const maxTime = Math.max(...data.map((d) => d.timestamp));
  const buckets = {};
  const bucketSizeSec = bucketSizeMs / 1000;

  data.forEach((point) => {
    const bucket = Math.floor(point.timestamp / bucketSizeSec) * bucketSizeSec;
    if (!buckets[bucket]) buckets[bucket] = { time: bucket, count: 0, errors: 0 };
    buckets[bucket].count++;
    if (point.is_error) buckets[bucket].errors++;
  });

  const chartData = Object.values(buckets).map((b) => ({
    time: b.time,
    rps: b.count / bucketSizeSec,
    errorRps: b.errors / bucketSizeSec,
  }));

  return (
    <div className="card p-5">
      <h4 className="font-display font-semibold text-surface-200 mb-4">Throughput (req/s)</h4>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.success} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLORS.success} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="time"
            stroke={COLORS.text}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v.toFixed(0)}s`}
          />
          <YAxis stroke={COLORS.text} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)} req/s`} />} />
          <Area
            type="monotone"
            dataKey="rps"
            name="Requests/sec"
            stroke={COLORS.success}
            fill="url(#rpsGrad)"
            strokeWidth={1.5}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="errorRps"
            name="Errors/sec"
            stroke={COLORS.danger}
            fill={COLORS.danger}
            fillOpacity={0.1}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Response Time Distribution (Scatter) ---
export function LatencyScatterChart({ data }) {
  if (!data?.length) return <EmptyChart label="No latency data" />;

  const chartData = data.map((d) => ({
    x: d.timestamp,
    y: d.response_time_ms,
    error: d.is_error,
  }));

  return (
    <div className="card p-5">
      <h4 className="font-display font-semibold text-surface-200 mb-4">Latency Distribution</h4>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="x"
            name="Time"
            stroke={COLORS.text}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v.toFixed(0)}s`}
          />
          <YAxis
            dataKey="y"
            name="Latency"
            stroke={COLORS.text}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 shadow-xl text-xs font-mono">
                  <p className="text-surface-400">Time: {d.x.toFixed(2)}s</p>
                  <p className="text-accent">Latency: {d.y.toFixed(1)}ms</p>
                  {d.error && <p className="text-danger">Error</p>}
                </div>
              );
            }}
          />
          <Scatter data={chartData} fill={COLORS.accent}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.error ? COLORS.danger : COLORS.accent}
                fillOpacity={0.6}
                r={2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ label }) {
  return (
    <div className="card p-5 flex items-center justify-center h-[340px]">
      <p className="text-sm text-surface-500">{label}</p>
    </div>
  );
}
