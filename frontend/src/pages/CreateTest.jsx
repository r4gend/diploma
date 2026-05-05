import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTest } from '../utils/api';
import TestForm from '../components/TestForm';

export default function CreateTest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      const test = await createTest(data);
      navigate(`/tests/${test.id}`);
    } catch (err) {
      alert('Failed to create test: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-display text-2xl font-bold text-surface-100">New Stress Test</h2>
        <p className="text-sm text-surface-500 mt-1">Configure a new API load test scenario</p>
      </div>

      <div className="card p-6">
        <TestForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
