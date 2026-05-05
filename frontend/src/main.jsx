import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Shared';
import Dashboard from './pages/Dashboard';
import TestList from './pages/TestList';
import CreateTest from './pages/CreateTest';
import TestDetail from './pages/TestDetail';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tests" element={<TestList />} />
          <Route path="/tests/new" element={<CreateTest />} />
          <Route path="/tests/:id" element={<TestDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
