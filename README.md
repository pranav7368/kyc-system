# CIPHER KYC — Autonomous Identity Verification

> AI-powered KYC in under 3 seconds vs 2-3 business days traditional.

## Architecture

```
┌─────────┐     ┌──────────────────────────────────┐     ┌──────────┐
│  React  │────▶│  FastAPI Backend                  │────▶│ SQLite/  │
│ :3000   │◀────│                                   │◀────│ Postgres │
└─────────┘     │  ┌──────────┐  ┌──────────────┐  │     └──────────┘
                │  │  OCR     │  │ Face Match   │  │
                │  │ EasyOCR  │  │ InsightFace  │  │
                │  └──────────┘  └──────────────┘  │
                │  ┌──────────┐  ┌──────────────┐  │
                │  │  Fraud   │  │  Liveness    │  │
                │  │ Detector │  │  MediaPipe   │  │
                │  └──────────┘  └──────────────┘  │
                │  ┌────────────────────────────┐   │
                │  │       Risk Engine          │   │
                │  └────────────────────────────┘   │
                └──────────────────────────────────┘
```

## Quick Start (No Docker)

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Quick Start (Docker)

```bash
docker-compose up --build
```

## API Documentation

| URL | Description |
|-----|-------------|
| http://localhost:8000/docs  | Swagger UI (interactive) |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/api/health | Health check |

## Test API with curl

```bash
# Verify an ID document + selfie
curl -X POST http://localhost:8000/api/kyc/verify \
  -F "id_document=@/path/to/id_card.jpg" \
  -F "selfie=@/path/to/selfie.jpg"

# Get stats
curl http://localhost:8000/api/kyc/stats

# Get history
curl http://localhost:8000/api/kyc/history?page=1&limit=10

# Health check
curl http://localhost:8000/api/health
```

## Features

- **< 3 second** end-to-end verification (OCR + face + liveness + fraud run in parallel)
- **AI OCR** — EasyOCR with OpenCV preprocessing (CLAHE, bilateral filter, Otsu threshold, deskew)
- **Face Biometrics** — InsightFace buffalo_l model, cosine similarity matching
- **Liveness Detection** — MediaPipe Face Mesh passive anti-spoofing (5 checks)
- **7-Layer Fraud Detection** — ELA, edge consistency, noise analysis, copy-move, JPEG ghost, metadata, resolution
- **Risk Engine** — Weighted scoring → APPROVED / REVIEW / REJECTED
- **Real-time Dashboard** — Charts, stats, 24h trends
- **Full History** — Paginated, filterable, click-to-expand
- **Dark/Light Mode**
- **Zero config** — SQLite by default, PostgreSQL optional

## Supported Documents

| Document | Country |
|----------|---------|
| Aadhaar Card | India |
| PAN Card | India |
| Passport | India |
| Driving Licence | India |

## Risk Scoring

| Score | Decision | Color |
|-------|----------|-------|
| 0–25  | APPROVED | Green |
| 26–55 | REVIEW   | Amber |
| 56–100 | REJECTED | Red  |

**Weight breakdown:**
- Face Match: 30%
- Document Quality: 25%
- Liveness: 20%
- Data Consistency: 15%
- Fraud Indicators: 10%

## Running Tests

```bash
cd backend

# All tests
pytest tests/ -v

# Unit tests only (no ML models needed)
pytest tests/test_ocr.py tests/test_fraud.py tests/test_face.py -v
```

## Environment Variables

Copy `.env.example` to `.env` in the backend directory:

```
DATABASE_URL=sqlite+aiosqlite:///./kyc.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
FACE_MATCH_THRESHOLD=0.55
FRAUD_SCORE_THRESHOLD=0.7
OCR_LANGUAGES=["en","hi"]
LOG_LEVEL=INFO
CORS_ORIGINS=["*"]
```
