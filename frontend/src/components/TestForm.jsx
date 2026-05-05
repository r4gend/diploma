import React, { useState } from 'react';
import { HTTP_METHODS, methodColor } from '../utils/helpers';

const DEFAULTS = {
  name: '',
  description: '',
  target_url: '',
  http_method: 'GET',
  headers: '',
  body: '',
  content_type: 'application/json',
  total_requests: 100,
  concurrent_users: 10,
  ramp_up_seconds: 0,
  timeout_seconds: 30,
  think_time_ms: 0,
};

export default function TestForm({ initialData, onSubmit, loading }) {
  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        ...DEFAULTS,
        ...initialData,
        headers: initialData.headers ? JSON.stringify(initialData.headers, null, 2) : '',
      };
    }
    return DEFAULTS;
  });

  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.target_url.trim()) errs.target_url = 'Target URL is required';
    try {
      new URL(form.target_url);
    } catch {
      errs.target_url = 'Must be a valid URL';
    }
    if (form.headers) {
      try { JSON.parse(form.headers); } catch { errs.headers = 'Must be valid JSON'; }
    }
    if (form.total_requests < 1) errs.total_requests = 'Minimum 1';
    if (form.concurrent_users < 1) errs.concurrent_users = 'Minimum 1';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      ...form,
      headers: form.headers ? JSON.parse(form.headers) : null,
      body: form.body || null,
    };
    onSubmit(data);
  };

  const showBody = !['GET', 'HEAD', 'OPTIONS'].includes(form.http_method);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <section>
        <h3 className="font-display font-semibold text-surface-200 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label">Test Name *</label>
            <input
              className="input-field"
              placeholder="e.g., Homepage Load Test"
              value={form.name}
              onChange={set('name')}
            />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input-field resize-none h-20"
              placeholder="Optional description of the test scenario…"
              value={form.description}
              onChange={set('description')}
            />
          </div>
        </div>
      </section>

      {/* Request Config */}
      <section>
        <h3 className="font-display font-semibold text-surface-200 mb-4">Request Configuration</h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-40">
              <label className="label">Method</label>
              <select className="select-field" value={form.http_method} onChange={set('http_method')}>
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Target URL *</label>
              <input
                className="input-field"
                placeholder="https://api.example.com/endpoint"
                value={form.target_url}
                onChange={set('target_url')}
              />
              {errors.target_url && <p className="text-danger text-xs mt-1">{errors.target_url}</p>}
            </div>
          </div>

          <div>
            <label className="label">Headers (JSON)</label>
            <textarea
              className="input-field resize-none h-24 font-mono text-xs"
              placeholder='{"Authorization": "Bearer token123"}'
              value={form.headers}
              onChange={set('headers')}
            />
            {errors.headers && <p className="text-danger text-xs mt-1">{errors.headers}</p>}
          </div>

          {showBody && (
            <>
              <div className="grid grid-cols-[1fr_200px] gap-3">
                <div>
                  <label className="label">Request Body</label>
                  <textarea
                    className="input-field resize-none h-32 font-mono text-xs"
                    placeholder='{"key": "value"}'
                    value={form.body}
                    onChange={set('body')}
                  />
                </div>
                <div>
                  <label className="label">Content Type</label>
                  <select className="select-field" value={form.content_type} onChange={set('content_type')}>
                    <option value="application/json">application/json</option>
                    <option value="application/xml">application/xml</option>
                    <option value="text/plain">text/plain</option>
                    <option value="application/x-www-form-urlencoded">form-urlencoded</option>
                    <option value="multipart/form-data">multipart/form-data</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Load Parameters */}
      <section>
        <h3 className="font-display font-semibold text-surface-200 mb-4">Load Parameters</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label">Total Requests</label>
            <input
              type="number"
              className="input-field"
              min={1}
              max={100000}
              value={form.total_requests}
              onChange={set('total_requests')}
            />
            {errors.total_requests && <p className="text-danger text-xs mt-1">{errors.total_requests}</p>}
          </div>
          <div>
            <label className="label">Concurrent Users</label>
            <input
              type="number"
              className="input-field"
              min={1}
              max={1000}
              value={form.concurrent_users}
              onChange={set('concurrent_users')}
            />
            {errors.concurrent_users && <p className="text-danger text-xs mt-1">{errors.concurrent_users}</p>}
          </div>
          <div>
            <label className="label">Ramp-Up (seconds)</label>
            <input
              type="number"
              className="input-field"
              min={0}
              max={600}
              value={form.ramp_up_seconds}
              onChange={set('ramp_up_seconds')}
            />
          </div>
          <div>
            <label className="label">Timeout (seconds)</label>
            <input
              type="number"
              className="input-field"
              min={1}
              max={120}
              step={0.5}
              value={form.timeout_seconds}
              onChange={set('timeout_seconds')}
            />
          </div>
          <div>
            <label className="label">Think Time (ms)</label>
            <input
              type="number"
              className="input-field"
              min={0}
              max={10000}
              value={form.think_time_ms}
              onChange={set('think_time_ms')}
            />
            <p className="text-xs text-surface-600 mt-1">Delay between requests per user</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-4 border-t border-surface-800/60">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : initialData ? 'Update Test' : 'Create Test'}
        </button>
      </div>
    </form>
  );
}
