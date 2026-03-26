# CIPHER KYC — Complete System Guide

## What This System Does

CIPHER KYC is an autonomous identity verification system. You upload a government ID (Aadhaar, PAN, Passport, or Driving Licence) and a selfie photo. The system:

1. **OCR** — reads text from the ID (name, DOB, document number)
2. **Face Match** — compares the face on the ID with your selfie
3. **Liveness Check** — checks the selfie is a real live person, not a printed photo
4. **Fraud Detection** — checks the ID for signs of tampering or forgery
5. **Risk Score** — combines all results → APPROVED / REVIEW / REJECTED

---

## System Requirements

- Windows 10/11
- Python 3.10–3.12 (Python 3.12 recommended)
- Node.js 18+
- 6 GB free RAM (TensorFlow + EasyOCR load into memory)
- 2 GB free disk (model weights + Python packages)
- Internet required ONCE on first run (downloads Facenet512 weights ~91 MB)

---

## Folder Structure

```
kyc-system/
├── backend/              FastAPI Python server (port 8000)
│   ├── app/
│   │   ├── main.py           Entry point, startup warmup
│   │   ├── config.py         Settings from .env
│   │   ├── database.py       SQLite via SQLAlchemy async
│   │   ├── models.py         Pydantic schemas
│   │   ├── middleware.py     Request ID, timing, logging
│   │   ├── routers/
│   │   │   ├── kyc.py        POST /api/kyc/verify and other endpoints
│   │   │   └── health.py     GET /api/health
│   │   └── services/
│   │       ├── ocr_service.py       EasyOCR text extraction
│   │       ├── face_service.py      OpenCV Haar + DeepFace Facenet512
│   │       ├── liveness_service.py  OpenCV passive anti-spoof
│   │       ├── fraud_service.py     7-layer document fraud detection
│   │       ├── pipeline.py          Runs all 4 services in parallel
│   │       └── risk_engine.py       Weighted scoring -> APPROVED/REVIEW/REJECTED
│   ├── .env              Configuration (see below)
│   ├── requirements.txt
│   └── kyc.db            SQLite database (auto-created on first run)
└── frontend/             React + Vite UI (port 3000)
    └── src/
        ├── pages/        VerifyPage, DashboardPage, HistoryPage
        ├── components/   UI components per page
        ├── api/kyc.js    Axios calls to backend
        └── hooks/        useKYC, useWebcam
```

---

## First-Time Setup

### Step 1 — Install Python packages

Open a terminal in `kyc-system/backend`:

```bash
pip install --user deepface onnxruntime tf_keras
pip install --user easyocr opencv-python-headless pillow numpy
pip install --user fastapi "uvicorn[standard]" python-multipart
pip install --user "sqlalchemy[asyncio]" aiosqlite pydantic pydantic-settings
pip install --user scikit-image python-dotenv httpx scikit-learn
```

### Step 2 — Install Node packages

Open a terminal in `kyc-system/frontend`:

```bash
npm install
```

### Step 3 — Create .env file

In `kyc-system/backend/`, create a file named `.env`:

```
DATABASE_URL=sqlite+aiosqlite:///./kyc.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
FACE_MATCH_THRESHOLD=0.55
FRAUD_SCORE_THRESHOLD=0.7
OCR_LANGUAGES=["en","hi"]
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

### Step 4 — Download Facenet512 model weights

The weights (91 MB) download automatically the first time DeepFace runs.
They save to: `C:\Users\<YourName>\.deepface\weights\facenet512_weights.h5`

If auto-download fails (network issue), download manually:
- URL: https://github.com/serengil/deepface_models/releases/download/v1.0/facenet512_weights.h5
- Save to: `C:\Users\<YourName>\.deepface\weights\facenet512_weights.h5`

---

## Starting the System

### Start Backend

Open terminal in `kyc-system/backend`:

```bash
python -m uvicorn app.main:app --port 8000 --host 127.0.0.1
```

Wait for this log message (takes 20-40 seconds to load all models):
```
All models loaded. CIPHER KYC is ready!
```

For development (auto-reloads on file save):
```bash
python -m uvicorn app.main:app --port 8000 --host 127.0.0.1 --reload
```

### Start Frontend

Open a **separate** terminal in `kyc-system/frontend`:

```bash
npm run dev
```

Open browser: **http://localhost:3000**

### Verify Both Are Running

```bash
curl http://127.0.0.1:8000/api/health
```
Expected: `{"status":"ok","service":"CIPHER KYC Backend","version":"1.0.0"}`

---

## Stopping the System

In PowerShell:
```powershell
Stop-Process -Name python -Force -ErrorAction SilentlyContinue
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
```

Or kill by port:
```powershell
$pid8000 = (Get-NetTCPConnection -LocalPort 8000 -State Listen).OwningProcess
$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess
Stop-Process -Id $pid8000 -Force
Stop-Process -Id $pid3000 -Force
```

---

## How to Verify an Identity

1. Open **http://localhost:3000**
2. Click **Verify Identity**
3. Upload your **ID document** — Aadhaar front, PAN card, Passport photo page, or DL front
4. Upload a **selfie** — clear photo, face fully visible, good lighting
5. Click **Verify Now**
6. Wait 60–180 seconds (first submission may take ~3 minutes while models fully warm up)
7. View results across 5 tabs: OCR, Face Match, Liveness, Fraud, Risk Score

### Tips for Best Results

| What | How |
|------|-----|
| ID document | Photograph under even lighting, no glare, document flat |
| Selfie | Face fills frame, eyes open, neutral expression |
| Formats | JPG, PNG, WebP accepted (max 10 MB each) |
| Aadhaar | Photograph the FRONT side (name, photo, and number visible) |
| PAN | Both PAN number and name must be visible |

---

## Understanding the Results

### Decision Thresholds

| Decision | Risk Score | Meaning |
|----------|------------|---------|
| APPROVED | 0–25 | All checks passed — proceed with onboarding |
| REVIEW | 26–55 | Borderline — route to manual review agent |
| REJECTED | 56–100 | Significant issues — request resubmission |

### Risk Score Breakdown (max 100 — lower is better)

| Component | Max Penalty | Triggers Penalty When |
|-----------|-------------|----------------------|
| Face Match | 30 pts | Similarity < 70% (partial at 55–70%) |
| Document OCR | 25 pts | Overall OCR confidence < 40% |
| Liveness | 20 pts | Liveness score < 50% |
| Data Consistency | 15 pts | Fewer than 2 critical fields extracted |
| Fraud Indicators | 10 pts | Fraud score >= 30% |

### Face Similarity

| Score | Meaning |
|-------|---------|
| >= 70% | Excellent — strong match |
| 55–70% | Good — probable match |
| < 55% | Poor — likely different person or bad photo |

### Example: Aadhaar + Selfie (realistic values)

```
Face Match:        similarity=0.75  -> penalty=0   (Excellent)
Document OCR:      confidence=0.46  -> penalty=12  (Acceptable)
Liveness:          score=0.847      -> penalty=0   (Passed)
Data Consistency:  3 fields, no QR  -> penalty=7   (Most fields)
Fraud:             score=0.146      -> penalty=0   (Clean)
                                    ----------
Total risk score:                       19 -> APPROVED
```

---

## ML Models

| Service | Technology | Description |
|---------|-----------|-------------|
| OCR | EasyOCR (CRAFT + CRNN) | Extracts text from ID images in English + Hindi |
| Face Detection | OpenCV Haar Cascade | Locates face region in images |
| Face Embedding | DeepFace Facenet512 | 512-dimensional face identity vector |
| Fraud Detection | OpenCV + scikit-image | ELA, copy-move, JPEG ghost, noise, edges |
| Liveness | OpenCV + LBP texture | Checks for real vs printed/screen face |

### Design Decisions

**Why not MTCNN for face detection?**
MTCNN crashes with Keras 3 (shipped with TensorFlow 2.21) when no face candidates
are found in a batch: `ValueError: convolution resulted in empty output (0,48,48,3)`.
OpenCV Haar Cascade is reliable, fast, and has no TF dependency.

**Why Facenet512 instead of InsightFace?**
InsightFace requires Microsoft Visual C++ 14.0 build tools — unavailable without
Visual Studio installation. Facenet512 via DeepFace installs cleanly with pip.
Accuracy on LFW benchmark: 99.65%.

**Why detector_backend='skip' for DeepFace?**
Running MTCNN (in DeepFace) in a parallel asyncio thread alongside OpenCV Haar
(in liveness_service) causes TensorFlow threading conflicts. By setting
`detector_backend='skip'`, DeepFace only runs the embedding neural network —
all detection is handled by our Haar cascade.

---

## API Reference

All endpoints: base URL = `http://127.0.0.1:8000`

### POST /api/kyc/verify

```bash
curl -X POST http://127.0.0.1:8000/api/kyc/verify \
  -F "id_document=@aadhaar.jpg" \
  -F "selfie=@selfie.jpg"
```

Response:
```json
{
  "id": "uuid",
  "created_at": "2026-03-26T...",
  "ocr": { "document_type": "aadhaar", "fields": {...}, "overall_confidence": 0.46 },
  "face": { "similarity": 0.75, "match": true, "doc_face_quality": {...} },
  "liveness": { "liveness_score": 0.847, "is_live": true, "checks": {...} },
  "fraud": { "fraud_score": 0.146, "is_suspicious": false, "flags": [] },
  "risk": { "decision": "APPROVED", "risk_score": 19.0, "breakdown": {...} },
  "processing_time_ms": 65000
}
```

### GET /api/kyc/history?page=1&limit=20

Returns paginated list of verifications.

### GET /api/kyc/stats

Returns aggregate statistics, approval rates, hourly distribution.

### GET /api/kyc/{id}

Returns full details of one verification by ID.

### GET /api/health

Health check — returns `{"status":"ok"}`.

Interactive docs: **http://127.0.0.1:8000/docs**

---

## Configuration Reference

File: `kyc-system/backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | sqlite+aiosqlite:///./kyc.db | Database (SQLite for local, PostgreSQL for prod) |
| UPLOAD_DIR | ./uploads | Temporary upload directory |
| MAX_FILE_SIZE | 10485760 | Max file size in bytes (10 MB) |
| FACE_MATCH_THRESHOLD | 0.55 | Cosine similarity threshold for match=True |
| FRAUD_SCORE_THRESHOLD | 0.7 | Fraud score above this = rejected |
| OCR_LANGUAGES | ["en","hi"] | EasyOCR languages (en=English, hi=Hindi) |
| LOG_LEVEL | INFO | Python log level |
| CORS_ORIGINS | ["http://localhost:3000"] | Allowed frontend URLs |

---

## Troubleshooting

### Port already in use

```powershell
$p = (Get-NetTCPConnection -LocalPort 8000 -State Listen).OwningProcess
Stop-Process -Id $p -Force
```

### Face similarity always 0%

1. Check weights file exists and is ~91 MB:
   `C:\Users\<YourName>\.deepface\weights\facenet512_weights.h5`
2. Download manually if missing (see Setup Step 4)
3. Ensure both photos have clear, visible faces

### OCR returns "unknown" document type

- Photograph document front side in good lighting
- Avoid shadows, glare, or blurring
- Keep document flat, parallel to camera
- Minimum resolution: 200x200 pixels

### Processing takes more than 5 minutes

This is normal on first ever run while EasyOCR downloads language models (~200 MB).
All subsequent runs: 60–180 seconds on CPU.

### REJECTED despite good photos

Check `risk.decision_reasons` in the response. Common causes:
- `Face similarity too low` → better lighting on selfie, hold camera steady
- `Document OCR confidence low` → cleaner photo of document
- `Some document fields missing` → ensure name, number, and DOB are visible

### Backend crashes on startup

Run with DEBUG logging to see the exact error:
```bash
# Edit .env: LOG_LEVEL=DEBUG
python -m uvicorn app.main:app --port 8000 --host 127.0.0.1
```

---

## Database

Records stored in `kyc-system/backend/kyc.db` (SQLite).

View recent verifications:
```bash
python -c "
import sqlite3
conn = sqlite3.connect('kyc.db')
rows = conn.execute('SELECT id, decision, risk_score, created_at FROM kyc_verifications ORDER BY created_at DESC LIMIT 5').fetchall()
for r in rows: print(r)
"
```

Clear all records (reset):
```bash
python -c "
import sqlite3
conn = sqlite3.connect('kyc.db')
conn.execute('DELETE FROM kyc_verifications')
conn.commit()
print('Database cleared')
"
```

---

## Coexistence with Other Docker Projects

The system runs on ports 8000 (backend) and 3000 (frontend).

Other running Docker projects on this machine:
- ble_attendance containers — use ports 5432, 6379 internally
- mbfos containers — different port range
- rms containers — different port range

No conflicts. KYC does NOT use Docker.

---

## Production Deployment Checklist

- [ ] Switch to PostgreSQL: `DATABASE_URL=postgresql+asyncpg://user:pass@host/db`
- [ ] Change `CORS_ORIGINS` to your real frontend domain
- [ ] Set up nginx reverse proxy with HTTPS/SSL
- [ ] Add API authentication (JWT or API keys)
- [ ] Set `LOG_LEVEL=WARNING`
- [ ] Store uploads on separate encrypted volume
- [ ] Set up database backups (daily)
- [ ] Add rate limiting (max X requests per IP per minute)
- [ ] Monitor memory usage (TF + EasyOCR: ~3-4 GB RAM)

---

*CIPHER KYC v1.0 | Backend: FastAPI + Python | Frontend: React + Vite | Models: EasyOCR + DeepFace Facenet512*
