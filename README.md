# Api Stress Tester — API Stress Testing Web Application

A full-stack web application for HTTP API stress/load testing with real-time analytics, built as a bachelor's thesis project.

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| IDE       | PyCharm Professional                          |
| Backend   | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async) |
| Database  | PostgreSQL 15+                                |
| Frontend  | React 18, Vite, Tailwind CSS, Recharts        |
| HTTP Engine | aiohttp + asyncio (concurrent virtual users) |
| Migrations | Alembic                                      |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Dashboard │ Test List │ Create Test │ Test Detail+Charts │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (JSON)
┌────────────────────────▼────────────────────────────────┐
│                   FastAPI Backend                         │
│  Routes (CRUD) │ Stress Engine │ Aggregation (NumPy)     │
└────────────────────────┬────────────────────────────────┘
                         │ SQLAlchemy (asyncpg)
┌────────────────────────▼────────────────────────────────┐
│                    PostgreSQL                             │
│         stress_tests │ test_results                       │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Test Configuration**: HTTP method, URL, headers, body, content type
- **Load Parameters**: total requests, concurrent virtual users, ramp-up time, think time, timeout
- **Async Execution Engine**: aiohttp-based concurrent HTTP client with virtual user simulation
- **Real-Time Monitoring**: auto-polling UI updates while tests are running
- **Statistical Analysis**: min/max/avg/median, p95, p99, requests/sec, error rate
- **Visualizations**: response time timeline, throughput chart, status code distribution, latency scatter plot
- **Full CRUD**: create, edit, delete, re-run tests
- **Test Cancellation**: stop running tests gracefully

## Prerequisites

- Python 3.11+
- Node.js 18+ & npm
- PostgreSQL 15+
- PyCharm Professional (recommended IDE)

## Setup Instructions

### 1. Clone & Navigate

```bash
cd api-stress-tester
```

### 2. Database Setup

```bash
# Create the PostgreSQL database
psql -U postgres -c "CREATE DATABASE stress_tester;"
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment (PyCharm can also do this automatically)
python -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials if needed

# Initialize database tables
python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"

# Run the backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.
Swagger docs at `http://localhost:8000/docs`.

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 5. PyCharm Configuration

1. Open the `api-stress-tester` folder as a project in PyCharm Professional
2. Configure Python interpreter: `backend/venv/python`
3. Set up a **Run Configuration** for the backend:
   - Script: `uvicorn`
   - Parameters: `app.main:app --reload`
   - Working directory: `backend/`
4. Set up a **npm Run Configuration** for the frontend:
   - Command: `run dev`
   - Package.json: `frontend/package.json`
5. Enable the **Database** tool window and connect to your PostgreSQL instance

## API Endpoints

| Method | Endpoint                     | Description                |
|--------|------------------------------|----------------------------|
| GET    | `/api/health`                | Health check               |
| GET    | `/api/tests/summary`         | Dashboard summary stats    |
| GET    | `/api/tests/`                | List all tests             |
| POST   | `/api/tests/`                | Create a new test          |
| GET    | `/api/tests/{id}`            | Get test details           |
| PUT    | `/api/tests/{id}`            | Update a test              |
| DELETE | `/api/tests/{id}`            | Delete a test              |
| POST   | `/api/tests/{id}/run`        | Execute the stress test    |
| POST   | `/api/tests/{id}/cancel`     | Cancel a running test      |
| GET    | `/api/tests/{id}/results`    | Get per-request results    |
| GET    | `/api/tests/{id}/timeline`   | Get timeline data for charts |

## Database Schema

### `stress_tests`
Stores test configuration and aggregated results (avg/min/max/median/p95/p99 response times, RPS, error rate, status code distribution).

### `test_results`
Stores individual request-level data (status code, response time, size, errors) linked to a parent stress test.

## Project Structure

```
api-stress-tester/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI application entry point
│   │   ├── config.py              # Pydantic settings (env variables)
│   │   ├── database.py            # Async SQLAlchemy engine & session
│   │   ├── models/
│   │   │   ├── __init__.py        # Re-exports all models
│   │   │   └── stress_test.py     # StressTest & TestResult ORM models
│   │   ├── schemas/
│   │   │   ├── __init__.py        # Re-exports all schemas
│   │   │   └── stress_test.py     # Pydantic request/response schemas
│   │   ├── routes/
│   │   │   ├── __init__.py        # Re-exports router
│   │   │   └── stress_test.py     # CRUD + run/cancel/results endpoints
│   │   └── services/
│   │       ├── __init__.py        # Re-exports engine functions
│   │       └── engine.py          # Core async stress test engine
│   ├── migrations/
│   │   ├── env.py                 # Alembic environment config
│   │   ├── script.py.mako         # Migration template
│   │   └── versions/              # Auto-generated migration files
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # React entry point + routing
│   │   ├── index.css              # Tailwind directives + global styles
│   │   ├── components/
│   │   │   ├── Shared.jsx         # Layout, StatusBadge, StatCard, Spinner
│   │   │   ├── TestForm.jsx       # Create/edit test configuration form
│   │   │   └── Charts.jsx         # Recharts visualizations (4 chart types)
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Summary stats + recent tests
│   │   │   ├── TestList.jsx       # Filterable test list with CRUD
│   │   │   ├── CreateTest.jsx     # New test creation page
│   │   │   └── TestDetail.jsx     # Test results, metrics & charts
│   │   ├── hooks/
│   │   │   └── usePolling.js      # Auto-refresh polling hook
│   │   └── utils/
│   │       ├── api.js             # Axios HTTP client
│   │       └── helpers.js         # Formatters & utility functions
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
└── README.md
```

## How the Stress Engine Works

1. User configures a test (URL, method, concurrency, request count, etc.)
2. On "Run", the backend creates N virtual users as async coroutines
3. Each virtual user sends sequential HTTP requests via `aiohttp`
4. Ramp-up gradually introduces users over the configured period
5. Think time adds configurable delays between requests per user
6. Each request's metrics (status, latency, size) are collected in memory
7. After completion, NumPy computes statistical aggregates
8. Results are bulk-inserted into PostgreSQL
9. The frontend polls for updates and renders charts in real time

## License

This project was developed as part of a bachelor's thesis.
