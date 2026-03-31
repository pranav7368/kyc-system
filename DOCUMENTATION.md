# AI KYC System — Complete Technical Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Setup & Installation](#4-setup--installation)
5. [Configuration Reference](#5-configuration-reference)
6. [Backend Services (Deep Dive)](#6-backend-services-deep-dive)
7. [API Reference](#7-api-reference)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Verification Pipeline — Step by Step](#9-verification-pipeline--step-by-step)
10. [Supported Documents](#10-supported-documents)
11. [Decision Logic & Thresholds](#11-decision-logic--thresholds)
12. [Security Design](#12-security-design)
13. [Admin Review System](#13-admin-review-system)
14. [Database Schema](#14-database-schema)
15. [File Storage](#15-file-storage)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Project Overview

**AI KYC** is a fully automated, AI-powered Know Your Customer (KYC) identity verification platform built for Indian government-issued identity documents. It verifies a person's identity in under 3 minutes by combining:

- **OCR** (Optical Character Recognition) to read document text
- **LLM Vision** (Google Gemini Flash) for accurate, structured field extraction
- **Face Matching** (DeepFace Facenet512) to compare document photo vs. live selfie
- **Liveness Detection** to confirm the person is physically present
- **Fraud Detection** (7-layer tampering analysis) to detect forged/modified documents
- **Pattern Validation** to verify government-mandated ID number formats and checksums
- **Admin Review Queue** for borderline cases requiring human judgment

The system produces a final risk score (0–100) and an automated decision: **APPROVED**, **REVIEW**, or **REJECTED** — with human-readable reasons for every factor.

---

## 2. Technology Stack

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| API Framework | FastAPI 0.115 | Async REST API |
| Runtime | Python 3.10+ | Application runtime |
| Server | Uvicorn | ASGI server |
| Database ORM | SQLAlchemy (async) | Database access |
| Database | SQLite (dev) / PostgreSQL (prod) | Persistence |
| OCR Engine | EasyOCR | Text extraction from images |
| LLM Vision | Google Gemini Flash (google-genai) | Structured field extraction |
| Face Matching | DeepFace + Facenet512 | Face embedding & comparison |
| Face Detection | OpenCV Haar Cascade | Face region detection |
| Image Processing | OpenCV + Pillow | Preprocessing, EXIF handling |
| Liveness | Custom passive checks + MediaPipe | Anti-spoofing |
| Fraud Detection | Custom 7-layer analysis | Tamper detection |
| QR Decoding | pyzbar | Aadhaar QR parsing |
| Authentication | JWT (python-jose) + bcrypt | Token-based auth |
| Validation | Pydantic v2 | Schema validation |

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 18.3 | Component-based UI |
| Routing | React Router v6 | Client-side routing |
| HTTP | Axios | API calls |
| Animations | Framer Motion | Page/step transitions |
| Camera | react-webcam | Selfie capture |
| File Upload | react-dropzone | Drag-and-drop upload |
| Charts | recharts | Dashboard charts |
| Notifications | react-hot-toast | Toast messages |
| Icons | lucide-react | Icon library |
| Styling | Tailwind CSS | Utility-first CSS |
| Build | Vite 5.4 | Development and bundling |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Login/  │  │  Verify  │  │Dashboard/│  │  Admin Panel  │  │
│  │ Register │  │   Flow   │  │ History  │  │ Review Queue  │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│                        React + Axios                             │
└─────────────────────────────┬───────────────────────────────────┘
                               │ HTTP REST API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (:8000)                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  /api/auth  │  │  /api/kyc   │  │       /api/admin        │ │
│  │  register   │  │   verify    │  │     review-queue        │ │
│  │  login      │  │   history   │  │     review/{id}         │ │
│  │  me         │  │   stats     │  │     stats               │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────────┘ │
│                           │                                      │
│                 ┌─────────▼──────────┐                          │
│                 │   Pipeline Engine   │                          │
│                 │  asyncio.gather()   │                          │
│                 └─────────┬──────────┘                          │
│                           │                                      │
│      ┌────────────────────┼────────────────────┐                │
│      │                    │                    │                 │
│  ┌───▼────┐  ┌────────────▼────┐  ┌────────────▼────┐          │
│  │  OCR   │  │  Face Service   │  │Liveness Service  │          │
│  │Service │  │ (DeepFace 512)  │  │ (5 passive checks│          │
│  │        │  │                 │  │  + challenge)    │          │
│  │EasyOCR │  │Cosine Similarity│  │                  │          │
│  │Gemini  │  │Haar Cascade     │  │                  │          │
│  └───┬────┘  └────────────┬────┘  └────────────┬────┘          │
│      │                    │                    │                 │
│      │         ┌──────────▼──────────┐         │                │
│      │         │   Fraud Service     │         │                │
│      │         │  (7-layer analysis) │         │                │
│      │         └──────────┬──────────┘         │                │
│      │                    │                    │                 │
│      └────────────────────▼────────────────────┘                │
│                           │                                      │
│                  ┌────────▼────────┐                            │
│                  │  Pattern Validator│                           │
│                  │  (Govt ID formats)│                           │
│                  └────────┬────────┘                            │
│                           │                                      │
│                  ┌────────▼────────┐                            │
│                  │   Risk Engine   │                             │
│                  │  (0–100 score)  │                             │
│                  └────────┬────────┘                            │
│                           │                                      │
│                  ┌────────▼────────┐                            │
│                  │    Database     │  ←──  Storage Service       │
│                  │  (SQLite/PG)    │       /storage/{id}/        │
│                  └─────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Setup & Installation

### Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- pip, npm
- A Gemini API key (from [Google AI Studio](https://aistudio.google.com))

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Create .env file (see Section 5 for all options)
copy .env.example .env         # Edit this file

# Create first admin user
python create_admin.py

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server (proxies API to localhost:8000)
npm run dev

# Build for production
npm run build
```

### Phone Testing (Local Network)

```bash
# Backend — accessible to all devices on your WiFi
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Find your PC's IP
ipconfig                          # Windows → IPv4 Address
# hostname -I                     # Linux

# Frontend — accessible from phone
VITE_API_URL=http://192.168.1.X:8000 npm run dev -- --host

# Open on phone: http://192.168.1.X:5173
```

---

## 5. Configuration Reference

All configuration lives in `backend/.env`:

```env
# ── Database ─────────────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./kyc.db
# PostgreSQL: postgresql+asyncpg://user:pass@host/dbname

# ── Security ─────────────────────────────────────────────────────
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440     # 24 hours

# ── File Storage ─────────────────────────────────────────────────
UPLOAD_DIR=uploads                   # Temp directory for processing
STORAGE_DIR=storage                  # Permanent image storage
MAX_FILE_SIZE=10485760               # 10 MB per file

# ── ML Thresholds ────────────────────────────────────────────────
FACE_MATCH_THRESHOLD=0.55            # Minimum cosine similarity for face match
FRAUD_SCORE_THRESHOLD=0.7            # Fraud score above this = high risk

# ── LLM APIs ─────────────────────────────────────────────────────
GEMINI_API_KEY=your-gemini-api-key   # Required for LLM-enhanced OCR
CLAUDE_API_KEY=                      # Optional (review explanations)

# ── OCR ──────────────────────────────────────────────────────────
OCR_LANGUAGES=en,hi                  # EasyOCR languages (en = English, hi = Hindi)

# ── CORS ─────────────────────────────────────────────────────────
CORS_ORIGINS=*                       # Allow all, or: http://localhost:5173

# ── TensorFlow ────────────────────────────────────────────────────
TF_ENABLE_ONEDNN_OPTS=0              # Silence oneDNN performance warnings
```

---

## 6. Backend Services (Deep Dive)

### 6.1 OCR Service (`ocr_service.py`)

The OCR service is the primary text extraction engine. It uses **EasyOCR** with a preprocessing pipeline.

**Preprocessing pipeline:**
1. EXIF transpose (correct phone camera rotation)
2. CLAHE (Contrast Limited Adaptive Histogram Equalization — improves text contrast)
3. Bilateral filter (noise removal while preserving edges)
4. Deskew (rotate image to correct tilt)
5. Otsu thresholding (convert to black/white for cleaner OCR)

**Field extraction strategy:**

| Field | Method |
|-------|--------|
| Document number | Regex per document type (Aadhaar 12-digit, PAN AAAAA9999A, etc.) |
| Name | Heuristic — prefers 3-word lines, filters template words |
| Date of Birth | Regex — DD/MM/YYYY, DD-MM-YYYY patterns |
| Address | Lines following "address:" label |
| Gender | Keyword matching (Male/Female/M/F/पुरुष/महिला) |
| Pincode | 6-digit number regex |

**PAN number auto-correction:**
PAN has a strict format where positions 1–5 are letters and positions 6–9 are digits. Common OCR errors (O→0, I→1, G→6) are auto-corrected based on position.

**Aadhaar QR parsing:**
Aadhaar cards contain a QR code with XML-encoded data. When decoded, the system cross-references the QR data with OCR-extracted fields to boost confidence.

---

### 6.2 LLM OCR Service (`llm_ocr_service.py`)

When a Gemini API key is configured, the system uses Gemini Flash as a secondary OCR pass.

**How it works:**
1. Image is EXIF-corrected and downscaled to ≤1600px (to keep upload size ≤400KB)
2. A detailed extraction prompt is sent with the image
3. Gemini returns structured JSON with fields and confidence scores
4. Results are **merged** with EasyOCR output (Gemini fields take priority)

**Model fallback chain:**
```
gemini-flash-latest → gemini-2.5-flash → gemini-2.0-flash → gemini-2.0-flash-lite
```

If one model hits quota (HTTP 429), the next is tried automatically. Network disconnects trigger one automatic retry after 2 seconds.

**Front vs. Back side:**
- Front side prompt extracts: name, document_number, dob, gender, address, nationality, issue_date, expiry_date
- Back side prompt extracts: address (for Aadhaar), vehicle_classes (for DL), blood_group

---

### 6.3 Face Service (`face_service.py`)

Uses **DeepFace** with the **Facenet512** model (512-dimensional face embeddings).

**Process:**
1. Load images with EXIF correction (both document photo and selfie)
2. Detect face region using OpenCV Haar Cascade (3 cascades at different strictness)
3. Crop face with +25% padding around bounding box
4. Generate Facenet512 embedding (512-dim vector)
5. Compute **cosine similarity** between document embedding and selfie embedding
6. Similarity ≥ 0.55 → **face match**

**Quality assessment per image:**
- `detected`: Was a face found?
- `blur_score`: Laplacian variance (higher = sharper)
- `brightness`: Mean HSV value (0–255)
- `frontal`: Is the face facing forward?
- `face_count`: How many faces detected?

**Note on protobuf compatibility:**
TensorFlow (used by DeepFace) requires protobuf 3.x API, but newer protobuf packages (4.x+) removed the `MessageFactory.GetPrototype` method. The service includes a monkey-patch to restore compatibility automatically.

---

### 6.4 Liveness Service (`liveness_service.py`)

Liveness detection prevents photo spoofing attacks (someone holding up a printed photo or a phone screen).

**Passive checks (run on selfie image):**

| Check | Weight | What it detects |
|-------|--------|----------------|
| Face Symmetry | 30% | Real faces are approximately symmetric; flat images may not be |
| Texture Analysis | 25% | LBP entropy — real skin has natural texture, printed photos are flat |
| Reflection Check | 20% | Real faces have natural specular highlights |
| Edge Analysis | 15% | Too-uniform edges indicate a printed document or screen |
| Skin Tone Analysis | 10% | YCrCb color space — checks if colors match human skin ranges |

**Active challenge bonus:**
If the user completes the 4-pose head movement challenge (up, down, left, right), a +0.15 bonus is added to the final score. This proves physical presence.

**Decision:** `liveness_score ≥ 0.55` → is_live = true

---

### 6.5 Fraud Detection Service (`fraud_service.py`)

Seven independent tampering detection algorithms, each scoring 0–1.

| Layer | Algorithm | Detects |
|-------|-----------|---------|
| ELA | Error Level Analysis | JPEG re-compression artifacts from image editing |
| Edge Consistency | Block-wise Canny edge density variance | Inconsistent sharpness from copy-paste regions |
| Noise Uniformity | Quadrant noise standard deviation | Non-uniform noise from image splicing |
| Copy-Move | ORB feature matching | Duplicated regions within the same image |
| JPEG Ghost | SSIM at multiple quality levels | Pre-compressed image pasted into a new JPEG |
| Metadata | EXIF software tags | Photoshop, GIMP, Lightroom, "Edited with" tags |
| Resolution | Width × height check | Images too small to be genuine documents |

**Weighted combination:**
```
fraud_score = ELA×0.30 + edge×0.15 + noise×0.20 + jpeg×0.20 + copy×0.15
```

`fraud_score ≥ 0.35` → `is_suspicious = true`
`fraud_score ≥ 0.70` → High risk (likely forged)

---

### 6.6 Pattern Validator (`pattern_validator.py`)

Validates that extracted ID numbers conform to the actual government-mandated format.

#### Aadhaar Card
- Must be exactly 12 digits
- First digit must be 2–9 (UIDAI specification — 0 and 1 are reserved)
- Must pass **Verhoeff checksum** (the last digit is a checksum of the preceding 11)
- Required fields: name, date of birth, gender

#### PAN Card
- Format: `AAAAA9999A` (5 letters, 4 digits, 1 letter)
- Position 4 is an **entity type code**:
  - `P` = Individual person
  - `C` = Company / Corporation
  - `H` = Hindu Undivided Family
  - `F` = Firm / LLP
  - `A/T/B/L/J/G` = Government / Trust / BOI / AOP / AJP
- Position 5 (for individuals) is the **surname initial** — cross-checked against extracted name
- Position 1–3 are jurisdiction alphabetical codes assigned by Income Tax Department

#### Passport
- Format: `A9999999` (1 letter + 7 digits) or similar per issuing country
- Type codes validated: `P` (personal), `D` (diplomatic), `S` (service), `V` (visa)
- Expiry date parsed and checked — expired passports flagged
- **MRZ checksum** (ICAO Doc 9303): Validates passport number, DOB, and expiry using a weighted mod-10 algorithm (weights 7, 3, 1 cycling)

#### Driving Licence
- Format: `StateCode(2) + District(2) + Year(4) + Serial(7)`
- State code validated against all 36 Indian state/UT codes (MH, DL, KA, TN, UP, etc.)
- Embedded year (positions 5–8) must be in reasonable range (1990–present+1)
- Expiry date parsed and checked

#### Voter ID (EPIC Card)
- Format: `AAA#######` (3 letters + 7 digits)
- First 3 letters validated against ECI (Election Commission of India) state prefix list

---

### 6.7 Form Matcher (`form_matcher.py`)

Compares what the user typed in the form against what OCR extracted from the document. Detects intentional data mismatch attempts.

**Matching method:**
- **Name**: Levenshtein distance normalized by string length. ≥0.80 similarity = match, 0.60–0.79 = partial (note flagged), <0.60 = mismatch
- **Date of Birth**: Exact match after normalizing all date formats to DDMMYYYY
- **Document Number**: Exact match after removing spaces/dashes and uppercasing; ≥0.85 fuzzy = partial
- **Address**: Fuzzy match with lower bar (≥0.65 = match); pincode match boosts score to ≥0.75

**Overall result:**
- `match_score ≥ 0.70` AND no critical discrepancies → `overall_match = true`
- Discrepancies list: Each field with status (match/partial/mismatch) and both values

---

### 6.8 Risk Engine (`risk_engine.py`)

Combines all service scores into a single 0–100 risk score.

**Penalty calculation:**

| Factor | Max Penalty | Excellent | Acceptable | Poor |
|--------|------------|-----------|------------|------|
| Face Match | 30 pts | ≥0.70 (0 pts) | 0.55–0.70 (15 pts) | <0.55 (30 pts) |
| Document Quality (OCR confidence) | 25 pts | ≥0.80 (0 pts) | 0.40–0.80 (12 pts) | <0.40 (25 pts) |
| Liveness | 20 pts | ≥0.80 (0 pts) | 0.50–0.80 (10 pts) | <0.50 (20 pts) |
| Data Consistency | 15 pts | All + QR (0 pts) | 2+ fields (7 pts) | <2 fields (15 pts) |
| Fraud Indicators | 10 pts | <0.30 (0 pts) | 0.30–0.60 (5 pts) | ≥0.60 (10 pts) |

**Final decision:**

| Risk Score | Decision | Action |
|-----------|----------|--------|
| 0–25 | ✅ APPROVED | Identity verified automatically |
| 26–55 | ⚠️ REVIEW | Queued for admin manual review |
| 56–100 | ❌ REJECTED | Verification failed |

---

## 7. API Reference

### Base URL
`http://localhost:8000/api`

### Authentication
All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

### Auth Endpoints

#### `POST /api/auth/register`
Register a new user.

**Request body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "full_name": "John Doe"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": 1, "username": "john_doe", "role": "user", ... }
}
```

---

#### `POST /api/auth/login`
Login with username (or email) and password.

**Request:** `application/x-www-form-urlencoded`
```
username=john_doe&password=SecurePass123
```

**Response:** Same as register.

---

#### `GET /api/auth/me`
Get current user profile. Requires auth.

---

#### `GET /api/auth/users`
List all users. Requires **admin**.

---

#### `PATCH /api/auth/users/{user_id}/role`
Promote/demote a user. Requires **admin**.

**Request body:**
```json
{ "role": "admin" }
```

---

### KYC Endpoints

#### `POST /api/kyc/verify`
**Main verification endpoint.** Accepts multipart/form-data.

**Form fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id_document` | file | Yes | Front of ID (JPG/PNG/WebP, max 10MB) |
| `selfie` | file | Yes | Live selfie photo |
| `id_document_back` | file | No | Back of ID (required for Aadhaar, DL, Voter ID) |
| `challenge_completed` | boolean | No | Whether liveness challenge was passed |
| `user_form_data` | JSON string | No | User-entered name, DOB, address, document_number |

**Response:**
```json
{
  "verification_id": "abc123",
  "document_type": "aadhaar",
  "decision": "APPROVED",
  "risk_score": 18,
  "confidence": 82.0,
  "decision_reasons": ["Face match: Excellent (similarity: 0.78)", "..."],
  "ocr": {
    "document_type": "aadhaar",
    "fields": {
      "name":            { "value": "Rajesh Kumar", "confidence": 0.91 },
      "document_number": { "value": "1234 5678 9012", "confidence": 0.95 },
      "dob":             { "value": "15/08/1990", "confidence": 0.88 },
      "gender":          { "value": "Male", "confidence": 0.99 },
      "address":         { "value": "123, MG Road...", "confidence": 0.75 }
    },
    "overall_confidence": 0.896,
    "pattern_validation": {
      "valid": true,
      "warnings": [],
      "pattern_score": 1.0
    },
    "llm_extracted": true,
    "qr_data": { ... }
  },
  "face": {
    "similarity": 0.78,
    "match": true,
    "doc_face_quality": { "detected": true, "blur_score": 142.3, "brightness": 189 },
    "selfie_face_quality": { "detected": true, "blur_score": 98.4, "brightness": 201 },
    "estimated_age": 33,
    "estimated_gender": "Man"
  },
  "liveness": {
    "liveness_score": 0.74,
    "is_live": true,
    "passive_score": 0.59,
    "challenge_completed": true,
    "checks": {
      "face_symmetry":    { "score": 0.82, "passed": true },
      "texture_analysis": { "score": 0.61, "passed": true },
      "reflection_check": { "score": 0.55, "passed": true },
      "edge_analysis":    { "score": 0.70, "passed": true },
      "skin_tone":        { "score": 0.68, "passed": true }
    }
  },
  "fraud": {
    "fraud_score": 0.12,
    "is_suspicious": false,
    "flags": [],
    "checks": {
      "ela":              { "score": 0.08, "passed": true },
      "edge_consistency": { "score": 0.14, "passed": true },
      "noise_uniformity": { "score": 0.11, "passed": true },
      "copy_move":        { "score": 0.05, "passed": true },
      "jpeg_ghost":       { "score": 0.19, "passed": true },
      "metadata":         { "score": 0.00, "passed": true },
      "resolution":       { "score": 0.00, "passed": true }
    }
  },
  "risk": {
    "risk_score": 18,
    "decision": "APPROVED",
    "confidence": 82.0,
    "breakdown": { ... },
    "decision_reasons": [ ... ]
  },
  "processing_time_ms": 8432,
  "has_images": { "document": true, "document_back": false, "selfie": true }
}
```

---

#### `GET /api/kyc/history`
Paginated verification history. Admins see all users; regular users see only their own.

**Query params:** `page=1`, `limit=10`

---

#### `GET /api/kyc/stats`
Dashboard statistics (total count, approved/review/rejected, averages, hourly distribution).

---

#### `GET /api/kyc/{verification_id}`
Full details for one verification.

---

#### `GET /api/kyc/{verification_id}/images/{image_type}`
Serve stored image. `image_type` is one of: `document`, `document_back`, `selfie`.

Supports both:
- `Authorization: Bearer <token>` header
- `?token=<token>` query parameter (for `<img>` tags)

---

#### `GET /api/kyc/doc-requirements`
Returns which document types require a back-side photo.

```json
{
  "needs_back_side": ["aadhaar", "driving_license", "voter_id"],
  "all_types": ["aadhaar", "pan", "passport", "driving_license", "voter_id"]
}
```

---

### Admin Endpoints

#### `GET /api/admin/review-queue`
Paginated queue of verifications pending review. Requires **admin**.

**Query params:** `page=1`, `limit=20`, `status=pending` (or `done`)

**Response includes per-item:**
- All verification fields
- `extracted_fields`: Flat dict of OCR-extracted values
- `pattern_valid`: Whether ID format passed validation
- `pattern_warnings`: List of specific warnings

---

#### `POST /api/admin/review/{verification_id}`
Submit manual review decision. Requires **admin**.

**Request body:**
```json
{
  "decision": "APPROVED",
  "notes": "Document verified manually. Face match confirmed."
}
```

---

#### `GET /api/admin/stats`
Admin statistics: total verifications, pending reviews, completed reviews, total users.

---

### Health Check

#### `GET /api/health`
```json
{ "status": "healthy", "version": "1.0.0" }
```

---

## 8. Frontend Architecture

### Page Structure

```
/ (redirect to /verify)
├── /login         — Login page
├── /register      — Registration page
├── /verify        — Main KYC flow (8 steps)
├── /dashboard     — Stats and charts
├── /history       — User's verification history (requires auth)
└── /admin         — Admin review panel (requires admin role)
```

### KYC Verification Flow (8 Steps)

```
Step 1: UserFormStep
  └─ Optional: Enter name, DOB, document number, address
     (These are matched against OCR results for consistency)

Step 2: UploadStep
  ├─ Select document type (Aadhaar / PAN / Passport / DL / Voter ID)
  ├─ Capture/upload ID front (DocumentCapture or file upload)
  ├─ Capture selfie (WebcamCapture or LivenessCapture challenge)
  └─ Capture ID back if required (Aadhaar, DL, Voter ID)

Step 3: ProcessingStep
  └─ Shows animated spinner while backend runs (typically 30–180 seconds)

Step 4: OCRResultStep
  ├─ Shows all extracted fields with confidence percentages
  ├─ "AI OCR" badge if Gemini was used
  └─ Pattern validation card (green = valid, yellow = warnings, red = invalid)

Step 5: FaceMatchStep
  ├─ Similarity score gauge
  ├─ Match status (✓ Match / ✗ No Match)
  └─ Quality metrics for both document photo and selfie

Step 6: FraudStep
  ├─ Overall fraud score
  ├─ Passed/failed indicators for each of the 7 checks
  └─ Specific fraud flags if any

Step 7: RiskScoreStep
  ├─ Visual risk score meter (0–100)
  └─ Breakdown of all 5 penalty factors

Step 8: DecisionStep
  ├─ APPROVED / REVIEW / REJECTED status
  ├─ Decision reasons list
  └─ Recommended next action
```

### DocumentCapture Component

The document camera capture component has several advanced features:

- **High resolution**: Requests 4K → 1080p → 720p (best available)
- **Blur detection**: Laplacian variance computed on guide region every animation frame
- **Brightness check**: Warns if too dark (<40) or too bright (>230)
- **Auto-capture**: Only triggers after document detected + sharpness ≥55 + held steady 2 seconds
- **Guide crop**: Captured image is cropped to exactly the guide rectangle at native resolution
- **Sharpness bar**: Real-time visual indicator (red → yellow → green)

### LivenessCapture Component

The liveness challenge records 4 head movements in sequence:
1. Look Up
2. Look Down
3. Look Left
4. Look Right

Completing all 4 sets `challenge_completed=true`, which adds +0.15 to the liveness score.

---

## 9. Verification Pipeline — Step by Step

When `POST /api/kyc/verify` is called:

```
1. File validation
   ├─ Check file types (JPG, PNG, WebP only)
   └─ Check file sizes (max 10 MB each)

2. Save to temp directory
   └─ Unique filenames per request to avoid conflicts

3. asyncio.gather() → run 4 services IN PARALLEL:
   ├─ [Thread 1] OCR Service
   │   ├─ Preprocess image (EXIF → CLAHE → denoise → deskew → threshold)
   │   ├─ EasyOCR text extraction
   │   ├─ Field extraction by document type
   │   ├─ QR code decode (Aadhaar)
   │   ├─ If GEMINI_API_KEY present:
   │   │   ├─ Resize image to ≤1600px
   │   │   ├─ Call Gemini Flash API
   │   │   └─ Merge Gemini results with EasyOCR
   │   └─ If back image present: run OCR on back, merge fields
   │
   ├─ [Thread 2] Face Service
   │   ├─ Load both images with EXIF correction
   │   ├─ Detect faces with Haar cascade
   │   ├─ Generate Facenet512 embeddings
   │   └─ Cosine similarity comparison
   │
   ├─ [Thread 3] Liveness Service
   │   ├─ Face symmetry check
   │   ├─ Texture analysis (LBP)
   │   ├─ Reflection check
   │   ├─ Edge analysis
   │   ├─ Skin tone check
   │   └─ Apply challenge bonus if completed
   │
   └─ [Thread 4] Fraud Service
       ├─ ELA (Error Level Analysis)
       ├─ Edge consistency
       ├─ Noise uniformity
       ├─ Copy-move detection
       ├─ JPEG ghost
       ├─ Metadata analysis
       └─ Resolution check

4. Pattern Validation
   └─ Validate document number format + checksum per document type

5. Form Matching (if user_form_data provided)
   └─ Fuzzy compare user inputs vs OCR extracted fields

6. Risk Engine
   └─ Compute 0–100 risk score → APPROVED / REVIEW / REJECTED

7. Store to database
   └─ Save KYCVerification record with all scores + paths

8. Copy images to permanent storage
   └─ /storage/{verification_id}/document.jpg, selfie.jpg, etc.

9. Delete temp files
   └─ Clean up after all parallel tasks are fully complete

10. Return full JSON response
```

---

## 10. Supported Documents

| Document | Both Sides | Key Fields Extracted | Pattern Validation |
|----------|-----------|---------------------|-------------------|
| Aadhaar Card | Yes (address on back) | name, aadhaar_number, dob, gender, address, pincode | 12 digits, first digit 2–9, Verhoeff checksum |
| PAN Card | No | name, pan_number, dob, father_name | AAAAA9999A, entity code, surname initial |
| Passport | No | name, passport_number, dob, nationality, expiry_date, issue_date | A9999999 format, MRZ ICAO 9303 checksum |
| Driving Licence | Yes (vehicle classes on back) | name, dl_number, dob, address, issue_date, expiry_date, vehicle_classes | State code, embedded year, expiry check |
| Voter ID (EPIC) | Yes (address on back) | name, epic_number, dob, gender, address | AAA####### format, ECI state prefix |

---

## 11. Decision Logic & Thresholds

### Risk Score Penalties

```
Risk Score = Face Penalty + OCR Penalty + Liveness Penalty + Consistency Penalty + Fraud Penalty

Face Penalty (max 30):
  similarity ≥ 0.70  →  0 pts  (Excellent)
  similarity 0.55–0.70 → 15 pts  (Good)
  similarity < 0.55  → 30 pts  (Poor)

OCR Confidence Penalty (max 25):
  confidence ≥ 0.80  →  0 pts  (Excellent)
  confidence 0.40–0.80 → 12 pts  (Acceptable)
  confidence < 0.40  → 25 pts  (Poor)

Liveness Penalty (max 20):
  liveness ≥ 0.80  →  0 pts  (Passed)
  liveness 0.50–0.80 → 10 pts  (Partial)
  liveness < 0.50  → 20 pts  (Failed)

Consistency Penalty (max 15):
  All fields + QR verified  →  0 pts
  2+ fields verified        →  7 pts
  < 2 fields verified       → 15 pts

Fraud Penalty (max 10):
  fraud_score < 0.30  →  0 pts  (Clean)
  fraud_score 0.30–0.60 →  5 pts  (Suspicious)
  fraud_score ≥ 0.60  → 10 pts  (High Risk)
```

### Final Decision

| Score | Decision | Meaning |
|-------|----------|---------|
| 0–25 | APPROVED | Identity automatically verified |
| 26–55 | REVIEW | Admin manual review required |
| 56–100 | REJECTED | Verification failed |

### Liveness Score Composition

```
passive_score = (symmetry × 0.30) + (texture × 0.25) + (reflection × 0.20)
              + (edges × 0.15) + (skin_tone × 0.10)

liveness_score = passive_score + (0.15 if challenge_completed else 0.0)
```

### Fraud Score Composition

```
fraud_score = (ela × 0.30) + (edge_consistency × 0.15) + (noise × 0.20)
            + (jpeg_ghost × 0.20) + (copy_move × 0.15)
```

---

## 12. Security Design

### Authentication
- **JWT tokens** (HS256) with 24-hour expiry
- **bcrypt** password hashing (cost factor 12)
- Token delivered in response body — stored in browser memory (not localStorage)
- Image endpoint supports `?token=` query param for `<img>` tag compatibility

### Authorization Levels
- **Guest**: Can submit verifications without an account
- **User**: Can view own verification history
- **Admin**: Can view all verifications, manage review queue, change user roles

### File Security
- Accepted MIME types: `image/jpeg`, `image/png`, `image/webp` only
- Maximum file size: 10 MB per file
- Files stored with UUID-based verification IDs (not sequential, not guessable)
- Temp files cleaned up after processing completes

### API Security
- CORS restricted by `CORS_ORIGINS` setting
- Request IDs for tracing
- Request timing logged
- Global exception handler prevents internal error details from leaking

---

## 13. Admin Review System

When the risk engine produces a REVIEW decision, the verification enters the admin review queue.

### Review Queue (`GET /api/admin/review-queue`)

Each item shows:
- User details (if registered)
- Document type and verification date
- All scores (face, liveness, fraud, risk)
- Extracted document fields (flat key-value pairs)
- Pattern validation status and any warnings
- Links to view stored images (document front, back, selfie)

### Manual Review (`POST /api/admin/review/{id}`)

Admin can:
1. View all uploaded images (document + selfie)
2. Read extracted fields and AI analysis
3. Check pattern validation warnings
4. Submit: APPROVED or REJECTED with mandatory notes
5. The review records `reviewed_by`, `reviewed_at`, and `review_notes` in the database

### Admin Dashboard Stats
- Total verifications processed
- Breakdown: approved / review / rejected
- Average processing time
- Pending reviews count

---

## 14. Database Schema

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | Integer PK | Auto-increment |
| username | String(50) UNIQUE | Login username |
| email | String(100) UNIQUE | Email address |
| hashed_password | String | bcrypt hash |
| full_name | String(100) | Display name |
| role | String(20) | "user" or "admin" |
| is_active | Boolean | Account active |
| created_at | DateTime | Registration time |

### KYCVerifications Table

| Column | Type | Description |
|--------|------|-------------|
| id | String(50) PK | UUID |
| user_id | Integer FK | Nullable (guest allowed) |
| document_type | String(50) | aadhaar/pan/passport/etc. |
| extracted_data | JSON | Full OCR + pattern validation result |
| face_similarity | Float | Cosine similarity (0–1) |
| liveness_score | Float | Liveness score (0–1) |
| fraud_score | Float | Fraud likelihood (0–1) |
| fraud_flags | JSON | List of fraud flag strings |
| risk_score | Float | Final risk score (0–100) |
| decision | String(20) | APPROVED / REVIEW / REJECTED |
| processing_time_ms | Integer | Total processing milliseconds |
| document_image_path | String | Relative path to stored document image |
| document_back_image_path | String | Relative path to back image (if any) |
| selfie_image_path | String | Relative path to selfie image |
| document_image_hash | String | SHA256 of document image (dedup) |
| selfie_image_hash | String | SHA256 of selfie image |
| user_form_data | JSON | User-entered form fields |
| form_match_result | JSON | Form vs OCR comparison result |
| created_at | DateTime | Submission timestamp |
| reviewed_by | String | Admin username who reviewed |
| reviewed_at | DateTime | Review timestamp |
| review_notes | String | Admin notes |
| admin_decision | String | Admin override decision |

---

## 15. File Storage

### Directory Structure

```
backend/
├── uploads/                    ← Temp files during processing
│   └── (auto-deleted after each request)
│
└── storage/                    ← Permanent image storage
    └── {verification_id}/
        ├── document.jpg        ← ID document front
        ├── document_back.jpg   ← ID document back (if uploaded)
        └── selfie.jpg          ← Live selfie
```

### Image Access

Images are served via API endpoint:
```
GET /api/kyc/{verification_id}/images/{document|document_back|selfie}
Authorization: Bearer <token>
```

Or via `<img>` tag with token in URL:
```html
<img src="/api/kyc/{id}/images/document?token=<jwt>" />
```

---

## 16. Troubleshooting

### Backend won't start

**Error:** `AttributeError: 'MessageFactory' object has no attribute 'GetPrototype'`

Cause: protobuf 4.x removed this API. The system includes a monkey-patch in `face_service.py` that should handle this automatically. If it persists:
```bash
pip install protobuf==3.20.3
```

---

### Gemini LLM not working

**Check API key is set:**
```bash
# In backend/.env
GEMINI_API_KEY=AIza...
```

**Test Gemini directly:**
```bash
cd backend
python -c "
from google import genai
client = genai.Client(api_key='YOUR_KEY')
r = client.models.generate_content(model='gemini-2.0-flash', contents=['Hello'])
print(r.text)
"
```

**Common errors:**
- `429 RESOURCE_EXHAUSTED`: Daily free tier quota hit. Wait until midnight PST or enable billing.
- `Server disconnected`: Image too large or poor WiFi. Fixed by auto-resize to ≤1600px.
- `invalid API key`: Check for extra spaces in .env.

---

### Blank document extraction on phone

Cause: Phone camera embeds EXIF rotation metadata that OpenCV ignores. The system uses `PIL.ImageOps.exif_transpose()` in both OCR and face services to fix this.

If still blank: ensure the document fills the guide frame and the image is sharp (green sharpness bar).

---

### "Face not detected" errors

- Ensure the selfie has good, even lighting
- Face must be directly facing the camera (frontal)
- Avoid extreme angles or dark backgrounds
- The document photo must contain a visible face (not the back of an ID)

---

### Processing takes very long (>3 minutes)

This is expected on CPU-only systems. EasyOCR and DeepFace Facenet512 are GPU-accelerated models running on CPU inference. Typical times:
- GPU: 3–15 seconds
- CPU (i7/Ryzen 5): 30–90 seconds
- CPU (older/low-spec): 90–180 seconds

The frontend timeout is set to 5 minutes (300,000ms).

---

### Admin can't see images in review panel

Cause: `<img>` tags cannot send `Authorization` headers. The image endpoint accepts `?token=` query param as a fallback. Ensure you are passing the token in the image URL.

---

### Database errors on first run

Run the migration script:
```bash
cd backend
python migrate_db.py
```

This adds any new columns to an existing database without dropping data.

---

*Last updated: March 2026*
*System version: 1.0.0 — AI KYC Platform*
