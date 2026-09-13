# CIPHER KYC

A full-stack identity-verification prototype that combines document OCR, face matching, passive liveness checks, image-forensics signals, and explainable risk scoring in one review workflow.

> **Status:** Engineering prototype created for a hackathon. It is not a certified KYC service and must not be used as the sole basis for real identity, financial, employment, or access-control decisions.

## Why this project

Manual identity review is slow and difficult to audit. CIPHER KYC explores how several independent verification signals can be collected through one interface and combined into a transparent decision for human review.

## Implemented pipeline

1. A React client submits an identity-document image and a selfie.
2. The FastAPI service validates the request and runs the verification modules.
3. EasyOCR and OpenCV extract and preprocess document text.
4. InsightFace compares the document portrait with the submitted selfie.
5. MediaPipe-based checks produce passive liveness signals.
6. Image-forensics checks surface possible document-manipulation signals.
7. A weighted risk engine returns **APPROVED**, **REVIEW**, or **REJECTED**, together with component results.
8. Verification history and aggregate statistics are available through the application dashboard.

## Architecture

```text
React client
    |
    v
FastAPI API
    |-- OCR: EasyOCR + OpenCV
    |-- Face matching: InsightFace
    |-- Passive liveness: MediaPipe
    |-- Image-forensics checks
    |-- Weighted risk engine
    |
    v
SQLite by default / PostgreSQL optional
```

## Technology

- **Frontend:** React, JavaScript
- **Backend:** FastAPI, Python, asynchronous request handling
- **Computer vision:** OpenCV, EasyOCR, InsightFace, MediaPipe
- **Data:** SQLite by default, PostgreSQL optional
- **Delivery:** Docker Compose
- **API documentation:** OpenAPI/Swagger and ReDoc

## Local setup

### Without Docker

```bash
# Backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open the frontend URL printed by the development server. API documentation is available at:

- `http://localhost:8000/docs`
- `http://localhost:8000/redoc`

### With Docker

```bash
docker compose up --build
```

## Configuration

Copy `backend/.env.example` to `backend/.env` and review every value before running the service.

```env
DATABASE_URL=sqlite+aiosqlite:///./kyc.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
FACE_MATCH_THRESHOLD=0.55
FRAUD_SCORE_THRESHOLD=0.7
OCR_LANGUAGES=["en","hi"]
LOG_LEVEL=INFO
CORS_ORIGINS=["*"]
```

For any deployment, replace the permissive CORS example with an explicit trusted-origin list.

## Tests

```bash
cd backend
pytest tests/ -v
```

The repository provides test commands, but this README does not claim a current pass count or performance result without a dated reproducible run.

## Current limitations

- Thresholds and risk weights require validation on representative, consented datasets.
- Passive liveness checks are not equivalent to a certified anti-spoofing system.
- OCR and face-matching quality can vary with lighting, image quality, document type, and demographic distribution.
- Uploaded identity images are sensitive personal data; production use would require encryption, retention controls, access logging, consent, and regulatory review.
- No sub-three-second latency or accuracy guarantee is asserted by this repository.

## Responsible use

Use synthetic or properly consented test data. Do not commit identity documents, selfies, secrets, database files, or generated uploads. A human reviewer should handle uncertain or high-impact decisions.

## Project structure

```text
backend/              FastAPI service, verification modules, persistence, and tests
frontend/             React interface and dashboard
DOCUMENTATION.md      Additional technical documentation
GUIDE.md              Usage guidance
PROJECT_DOCUMENTATION.md
Makefile
docker-compose.yml
```

## Roadmap

- Publish dated benchmark and test results with dataset provenance
- Add screenshots and a short demonstration using synthetic identities
- Add CI for backend and frontend checks
- Document model versions, calibration, and fairness evaluation
- Add an explicit open-source license if public reuse is intended

## Author

**Pranav Kumar Singh** — [GitHub](https://github.com/pranav7368) · [Portfolio](https://pranav7368.github.io/Pranav-Kumar-Singh/) · [LinkedIn](https://www.linkedin.com/in/pranav5)
