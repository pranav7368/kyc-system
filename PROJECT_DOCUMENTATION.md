# CIPHER KYC — Complete Technical Documentation
### Autonomous Identity Verification System

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack — Every Library Explained](#3-technology-stack)
4. [Backend — File by File](#4-backend-file-by-file)
5. [ML Pipeline — How Each Model Works](#5-ml-pipeline)
6. [OCR Service — Text Extraction](#6-ocr-service)
7. [Face Service — Identity Matching](#7-face-service)
8. [Liveness Service — Anti-Spoofing](#8-liveness-service)
9. [Fraud Detection Service](#9-fraud-detection-service)
10. [Risk Engine — Final Scoring](#10-risk-engine)
11. [Database Design](#11-database-design)
12. [REST API — Every Endpoint](#12-rest-api)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Security Design](#14-security-design)
15. [Design Decisions — Why X Over Y](#15-design-decisions)
16. [Performance & Scalability](#16-performance-and-scalability)
17. [Limitations & Future Scope](#17-limitations-and-future-scope)
18. [Complete Data Flow — End to End](#18-complete-data-flow)
19. [Algorithms & Mathematics](#19-algorithms-and-mathematics)
20. [Common Interview Questions & Answers](#20-common-questions-and-answers)

---

## 1. PROJECT OVERVIEW

### What is CIPHER KYC?

CIPHER KYC (Know Your Customer) is an **autonomous identity verification system** that uses artificial intelligence to verify a person's identity by:
1. Extracting information from a government-issued ID document using OCR
2. Comparing the face on the ID with a live selfie using deep learning
3. Checking the selfie is from a real live person (anti-spoofing)
4. Detecting if the ID document has been tampered or forged
5. Generating a risk score and final decision: APPROVED / REVIEW / REJECTED

### Why KYC Matters

KYC (Know Your Customer) is a mandatory regulatory requirement for:
- Banks and financial institutions (RBI guidelines)
- Telecom companies (TRAI)
- Fintech apps, wallets, lending platforms
- Insurance companies
- Cryptocurrency exchanges

Traditional KYC is manual — a person physically verifies documents. This system automates it with AI, reducing time from days to under 3 minutes.

### Supported Documents

- **Aadhaar Card** — 12-digit UID, issued by UIDAI
- **PAN Card** — 10-character alphanumeric, issued by Income Tax Department
- **Passport** — issued by Ministry of External Affairs
- **Driving Licence** — issued by state transport authority

### Key Statistics (Test Results)

- Processing time: 60–180 seconds on CPU (Intel i5-1135G7, 8GB RAM)
- Face embedding accuracy: 99.65% on LFW benchmark (Facenet512)
- Correctly identifies name, DOB, document number from real Indian ID cards
- Handles Hindi + English text on Aadhaar cards

---

## 2. SYSTEM ARCHITECTURE

### High-Level Architecture

```
USER (Browser)
     |
     | HTTP/REST
     v
FRONTEND (React + Vite)          port 3000
     |
     | multipart/form-data POST
     v
BACKEND (FastAPI + Python)       port 8000
     |
     +---> asyncio.gather() runs 4 services IN PARALLEL:
     |
     +--[Thread 1]--> OCR Service      (EasyOCR)
     +--[Thread 2]--> Face Service     (OpenCV + DeepFace Facenet512)
     +--[Thread 3]--> Liveness Service (OpenCV + LBP)
     +--[Thread 4]--> Fraud Service    (OpenCV + scikit-image)
     |
     v
Risk Engine (pure Python, synchronous)
     |
     v
SQLite Database (aiosqlite)
     |
     v
JSON Response -> Frontend
```

### Component Breakdown

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| Frontend | React 18 + Vite | 3000 | User interface |
| Backend API | FastAPI + Uvicorn | 8000 | REST API server |
| OCR | EasyOCR | — | Text from ID images |
| Face Matching | DeepFace Facenet512 | — | Identity verification |
| Liveness | OpenCV + LBP texture | — | Anti-spoofing |
| Fraud Detection | OpenCV + scikit-image | — | Document tampering check |
| Risk Engine | Pure Python | — | Final scoring |
| Database | SQLite + SQLAlchemy | — | Verification records |

### Parallel Processing Architecture

The system uses Python's `asyncio` event loop with `asyncio.to_thread()` to run all 4 ML services concurrently. Without parallelism:
- OCR: ~30s
- Face: ~60s
- Liveness: ~5s
- Fraud: ~10s
- Total sequential: ~105s

With `asyncio.gather()` (parallel):
- Total: ~60s (limited by slowest = face service)

This is a **50%+ speed improvement** using concurrent execution.

---

## 3. TECHNOLOGY STACK

### Backend Technologies

#### FastAPI
- **What**: Modern Python web framework for building REST APIs
- **Why chosen**: Automatic OpenAPI/Swagger documentation, async support (asyncio), Pydantic validation, 3-5x faster than Flask/Django for I/O-bound tasks
- **How used**: Defines all API routes (`/api/kyc/verify`, `/api/kyc/history`, etc.), handles file uploads, manages request/response validation
- **Version**: 0.115.0

#### Uvicorn
- **What**: ASGI (Asynchronous Server Gateway Interface) server
- **Why**: Required to run FastAPI async applications. Traditional WSGI servers (Gunicorn) cannot handle async code
- **How used**: Runs the FastAPI app: `python -m uvicorn app.main:app --port 8000`
- **Version**: 0.30.0

#### asyncio
- **What**: Python's built-in asynchronous I/O library
- **Why**: Allows running multiple ML services simultaneously without blocking
- **How used**: `asyncio.gather()` runs OCR + Face + Liveness + Fraud concurrently; `asyncio.to_thread()` wraps CPU-bound functions to run in thread pool

#### Pydantic v2
- **What**: Data validation library using Python type hints
- **Why**: Automatic request/response validation, clear error messages, settings management from .env files
- **How used**: All data models (OCRResult, FaceResult, LivenessResult, etc.), settings loading
- **Version**: 2.9.0

#### SQLAlchemy 2.0 (Async)
- **What**: Python ORM (Object-Relational Mapper)
- **Why**: Database-agnostic (works with SQLite in dev, PostgreSQL in prod), async support, type-safe queries
- **How used**: Defines `KYCVerification` table schema, runs async queries for history/stats
- **Version**: 2.0.35

#### aiosqlite
- **What**: Async SQLite adapter
- **Why**: SQLite is synchronous by nature; aiosqlite wraps it to work with Python's asyncio event loop
- **How used**: Database driver for SQLAlchemy when `DATABASE_URL` starts with `sqlite+aiosqlite://`
- **Version**: 0.20.0

#### python-multipart
- **What**: Parses multipart/form-data HTTP requests
- **Why**: Required by FastAPI to handle file uploads (images)
- **How used**: Automatically used by FastAPI when receiving `UploadFile` parameters

#### python-dotenv / pydantic-settings
- **What**: Load environment variables from `.env` file
- **Why**: Separates configuration from code (12-factor app principle)
- **How used**: `Settings` class reads `DATABASE_URL`, `FACE_MATCH_THRESHOLD`, etc. from `.env`

### Machine Learning Libraries

#### EasyOCR
- **What**: Deep learning-based OCR library using CRAFT (text detection) + CRNN (text recognition)
- **Why chosen over Tesseract**: Significantly better accuracy on curved, stylised, or low-contrast text; native support for Hindi (Devanagari script); handles both printed and handwritten text; no external binary dependency
- **Why chosen over Google Vision API**: Runs locally, no API cost, no internet dependency, no data privacy concerns
- **Models**: Uses pre-trained CRAFT detector + language-specific CRNN models (~200MB total)
- **Languages**: English (`en`) + Hindi (`hi`) configured
- **How used**: `reader.readtext(image, detail=1, paragraph=False)` returns list of (bounding_box, text, confidence)
- **Version**: 1.7.2

#### OpenCV (cv2)
- **What**: Open Source Computer Vision Library
- **Why**: Industry standard for image processing; extremely fast (C++ core, Python bindings); comprehensive algorithms
- **How used in OCR**: CLAHE enhancement, bilateral filtering, Otsu thresholding, deskew via Hough transform, image loading/saving
- **How used in Face**: Haar cascade face detection, image preprocessing, BGR↔RGB conversion, resizing
- **How used in Liveness**: Edge detection (Canny), face detection (Haar), YCrCb skin tone analysis
- **How used in Fraud**: Edge consistency (Canny), copy-move detection (ORB), noise analysis
- **Version**: opencv-python-headless 4.10.0.84 (headless = no GUI, suitable for servers)

#### DeepFace
- **What**: Lightweight face recognition framework wrapping multiple models
- **Why chosen**: Single pip install, no compiler required (unlike InsightFace which needs MSVC++), supports multiple backends, good accuracy
- **Model used**: **Facenet512** — 512-dimensional face embeddings, 99.65% LFW accuracy
- **How used**: `DeepFace.represent()` with `detector_backend='skip'` (we handle detection separately with Haar cascade)
- **Key parameter**: `enforce_detection=False` — returns embedding even if face detection fails

#### TensorFlow / Keras
- **What**: Deep learning framework
- **Why**: Required by DeepFace/Facenet512 for neural network inference
- **Version**: 2.21 (TF) with Keras 3 (default) + tf_keras compatibility shim
- **Note**: `tf_keras` package is installed separately because some DeepFace components need the legacy Keras API

#### NumPy
- **What**: Numerical computing library for Python
- **Why**: Foundation of all ML operations; array manipulation, mathematical operations
- **How used**: Image arrays (HxWx3 BGR arrays), embedding vectors (512-dim float arrays), cosine similarity calculation
- **Version**: 1.26.4 (note: must match TF version requirements)

#### Pillow (PIL)
- **What**: Python Imaging Library fork
- **Why**: Fallback image loader when OpenCV fails (e.g., HEIC, some PNG variants)
- **How used**: `Image.open(path).convert("RGB")` as fallback, then convert to BGR NumPy array for OpenCV

#### scikit-image
- **What**: Image processing library built on SciPy
- **Why**: Provides specialized algorithms not in OpenCV, particularly SSIM and LBP
- **How used**:
  - SSIM (Structural Similarity Index) in fraud detection for JPEG ghost analysis
  - LBP (Local Binary Pattern) in liveness detection for texture analysis
- **Version**: 0.24.0

#### scikit-learn
- **What**: Machine learning library
- **Why needed**: scikit-image depends on it; also provides utility functions
- **Note**: Must be installed compiled against the same NumPy version to avoid binary incompatibility errors

#### onnxruntime
- **What**: ONNX model inference runtime
- **Why**: DeepFace can use ONNX models for faster inference; also required by some DeepFace backends
- **Version**: 1.19.2

### Frontend Technologies

#### React 18
- **What**: JavaScript UI library by Facebook
- **Why**: Component-based architecture, virtual DOM, large ecosystem, hooks API
- **How used**: All UI components — verification wizard, dashboard charts, history table

#### Vite
- **What**: Modern frontend build tool
- **Why**: Extremely fast dev server (ESBuild), instant HMR (Hot Module Replacement), better than Create React App
- **How used**: `npm run dev` starts development server on port 3000

#### Axios
- **What**: HTTP client for JavaScript
- **Why**: Better error handling than fetch, interceptors for request/response transforms, timeout support
- **How used**: All API calls to backend; 5-minute timeout for verification endpoint

#### Tailwind CSS
- **What**: Utility-first CSS framework
- **Why**: No custom CSS files needed, consistent design system, responsive by default

#### Recharts
- **What**: React charting library
- **Why**: Easy integration with React, responsive charts
- **How used**: Pie chart (approval/review/rejected breakdown), trend chart (hourly distribution)

#### react-hot-toast
- **What**: Toast notification library
- **Why**: Minimal, accessible, easy to use
- **How used**: Error notifications when API calls fail

---

## 4. BACKEND FILE BY FILE

### `app/main.py` — Application Entry Point

**Purpose**: Creates the FastAPI app, configures middleware, registers routes, and pre-warms ML models on startup.

**Key sections**:
- **Lifespan context manager** (`@asynccontextmanager`): Runs startup/shutdown code. On startup: creates DB tables, creates uploads directory, pre-warms OCR, Face, and Liveness models
- **Model pre-warming**: Loads all ML models into memory at startup so the first request isn't slow. Without this, the first verification would take 5+ minutes
- **CORS middleware**: Allows the React frontend (port 3000) to call the backend (port 8000)
- **Custom middleware**: RequestID (unique ID per request), Timing (measures response time), Logging (logs every request)
- **Global exception handler**: Catches any unhandled Python exception and returns a proper JSON 500 error

### `app/config.py` — Configuration

**Purpose**: Loads all settings from `.env` file using Pydantic BaseSettings.

**Settings explained**:
```
DATABASE_URL          — SQLite connection string (or PostgreSQL for prod)
UPLOAD_DIR            — Where uploaded images are temporarily saved
MAX_FILE_SIZE         — 10MB limit per file
FACE_MATCH_THRESHOLD  — Cosine similarity above this = faces match (0.55)
FRAUD_SCORE_THRESHOLD — Fraud score above this = rejected (0.7)
OCR_LANGUAGES         — EasyOCR language list ["en", "hi"]
LOG_LEVEL             — Python logging level
CORS_ORIGINS          — Which frontend URLs can call the API
```

**Why Pydantic Settings**: Automatic type coercion (string "0.55" → float), validation, default values, easy testing by overriding env vars.

### `app/database.py` — Database Layer

**Purpose**: Defines the SQLite database schema and connection management.

**Key components**:
- `KYCVerification` — SQLAlchemy ORM model for the verifications table (one row per verification)
- `engine` — Async SQLAlchemy engine connecting to SQLite
- `AsyncSessionLocal` — Session factory for creating database sessions
- `get_db()` — FastAPI dependency that provides a database session per request (auto-closes when request ends)
- `create_tables()` — Creates the table on startup if it doesn't exist

**Why async DB**: The API is async (FastAPI), so all I/O including database must be async to avoid blocking the event loop.

### `app/models.py` — Pydantic Schemas

**Purpose**: Defines the data shapes for all API inputs and outputs.

**Models**:
- `OCRResult` — Document type, extracted fields, confidence, raw text
- `FaceResult` — Similarity score, match flag, face quality metrics, age/gender
- `LivenessResult` — Liveness score, is_live flag, individual check scores
- `FraudResult` — Fraud score, is_suspicious flag, individual check scores, flags
- `RiskResult` — Final risk score (0-100), decision (APPROVED/REVIEW/REJECTED), breakdown
- `VerificationResult` — Container for all above results

### `app/middleware.py` — Request Middleware

**Purpose**: Three middleware classes that process every request/response.

- **RequestIDMiddleware**: Generates a UUID for each request, attaches it to headers. Useful for debugging — you can trace a specific request through all log lines.
- **TimingMiddleware**: Records when request arrived, adds `X-Process-Time` header to response.
- **LoggingMiddleware**: Logs `→ METHOD /path` on request arrival and `← METHOD /path STATUS (Xms)` on response. Shows exactly what the system is doing.

### `app/routers/kyc.py` — KYC API Routes

**Purpose**: All `/api/kyc/*` endpoints — verification, history, stats, individual record retrieval.

**Key implementation details**:
- File validation: checks extension AND content-type (prevents file rename attacks)
- Files saved with UUID filenames (prevents path traversal attacks)
- Files are DELETED after processing (in `finally` block — runs even if errors occur)
- `_iso()` helper: ensures all datetime objects are serialized with UTC `+00:00` offset so browsers convert to local timezone correctly

### `app/routers/health.py` — Health Check

**Purpose**: Simple `GET /api/health` endpoint. Returns system status, timestamp, version. Used by monitoring tools and frontend to check if backend is alive.

### `app/services/pipeline.py` — Pipeline Orchestrator

**Purpose**: The brain of the system. Coordinates all 4 ML services and feeds results into the risk engine.

**How it works**:
```python
# All 4 services run IN PARALLEL using asyncio:
ocr_task      = asyncio.to_thread(ocr_service.extract,    doc_image)
face_task     = asyncio.to_thread(face_service.compare,   doc_image, selfie)
liveness_task = asyncio.to_thread(liveness_service.check, selfie)
fraud_task    = asyncio.to_thread(fraud_service.analyze,  doc_image)

results = await asyncio.gather(ocr_task, face_task, liveness_task, fraud_task)
```

**`asyncio.to_thread()`**: Wraps a synchronous (blocking) function to run in a thread pool. This is how CPU-bound ML code (TensorFlow, OpenCV) is made compatible with Python's async event loop.

**`_to_python()`**: Recursive converter that turns NumPy types (np.float32, np.int64, np.bool_) into native Python types (float, int, bool). Required because JSON serializer doesn't understand NumPy types.

---

## 5. ML PIPELINE

### Overview of Models

```
Document Image                    Selfie Image
      |                                |
      +--------> OCR Service           |
      |          (EasyOCR)             |
      |          Extract: name,        |
      |          DOB, doc number       |
      |                                |
      +--------> Face Service <--------+
      |          (Haar + Facenet512)
      |          Compare faces,
      |          get similarity
      |                                |
      |                   +------------+
      |                   |
      |          Liveness Service
      |          (OpenCV + LBP)
      |          Is selfie a real person?
      |
      +--------> Fraud Service
                 (OpenCV + scikit-image)
                 Is document authentic?

All 4 results → Risk Engine → APPROVED/REVIEW/REJECTED
```

### Why Parallel Execution

Each ML service is independent — OCR doesn't need face results, fraud doesn't need liveness results. So they can all run simultaneously. This is called **embarrassingly parallel** computation.

Using `asyncio.gather()` with `asyncio.to_thread()`:
- Python's asyncio event loop manages concurrency
- Each service runs in a separate OS thread from the thread pool
- The event loop waits for ALL to complete, then proceeds to risk scoring

---

## 6. OCR SERVICE

**File**: `app/services/ocr_service.py`

### What It Does

Extracts structured data (name, DOB, document number, address, gender) from an ID card image.

### Pipeline Steps

#### Step 1: Image Preprocessing

The raw photo from a phone camera is rarely ideal. Four preprocessing steps are applied:

1. **CLAHE (Contrast Limited Adaptive Histogram Equalization)**
   - What: Enhances local contrast in different regions of the image
   - Why: ID cards often have uneven lighting — one corner bright, another dark. CLAHE fixes this locally rather than globally
   - Parameters: `clipLimit=2.0, tileGridSize=(8,8)` — image divided into 8x8 tiles, each enhanced separately with clipping to avoid noise amplification

2. **Bilateral Filter**
   - What: Edge-preserving noise reduction filter
   - Why: Reduces camera noise while keeping text edges sharp. Regular Gaussian blur would blur the text itself
   - Parameters: `d=9, sigmaColor=75, sigmaSpace=75`

3. **Deskew (Hough Transform)**
   - What: Detects if the document is rotated and corrects it
   - Why: A tilted document gives OCR poor results because text lines aren't horizontal
   - How: Canny edge detection → Hough line transform → finds dominant angle → rotates image to correct it

4. **Otsu Thresholding**
   - What: Converts to binary (black/white) image automatically finding the best threshold
   - Why: Removes background gradients and shadows; makes text pure black on white background
   - Otsu's method: Automatically finds the threshold that minimizes within-class variance

#### Step 2: Dual OCR (Best-of-Two Strategy)

OCR is run on BOTH the preprocessed image AND the original image. The one with higher average confidence score is used.

Why: Sometimes the original image actually has better OCR results than preprocessed (e.g., if document was already well-lit and preprocessing degraded it). Always taking the better result maximizes accuracy.

#### Step 3: Document Type Detection

Looks for keywords in the extracted text:
- Aadhaar: "aadhaar", "आधार", "unique identification", "uidai"
- PAN: "income tax", "permanent account", "pan card", "आयकर"
- Passport: "passport", "republic of india"
- Driving Licence: "driving licence", "transport"

If no keywords match, tries to detect by document number format (Aadhaar = 12 digits, PAN = 5letters+4digits+1letter).

#### Step 4: Field Extraction Using Regex

**Document Number Patterns**:
```
Aadhaar: \b\d{4}\s?\d{4}\s?\d{4}\b       → 8604 1992 8247
PAN:     \b[A-Z]{5}\d{4}[A-Z0-9=]         → QGKPS9604E
Passport:\b[A-Z][0-9]{7}\b                → A1234567
DL:      \b[A-Z]{2}\d{2}\s?\d{11}\b
```

**PAN OCR Correction** (`_correct_pan_ocr()`):
PAN cards often have digits misread as similar-looking letters:
- `0` read as `O` (zero vs letter O)
- `6` read as `G`
- `1` read as `I`
- `8` read as `B`

The correction function finds PAN-like strings (`[A-Z]{5}[A-Z0-9]{4}[A-Z0-9]`), then applies character translation to the numeric positions:
```python
_ocr_to_digit = str.maketrans("OGIBS Z", "0618520")
```
`QGKPS9GO4E` → `QGKPS9604E` ✓

**DOB Pattern**:
```
\b(\d{2}[\/\-\.\{\']\d{2}[\/\-\.\{\']\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})\b
```
The unusual separators `{` and `'` are included because OCR sometimes misreads `/` as these characters.

#### Step 5: Name Extraction (`_parse_name()`)

The trickiest field. A name is identified by:
1. No digits in the line
2. High proportion of uppercase letters (>40%) or Title Case
3. 2-5 words (typical name length)
4. NOT in the exclusion list

**Two-level exclusion**:
- Phrase-level: "permanent account", "income tax", "mera aadhaar"
- Word-level: any line containing "tax", "govt", "department", "dept" etc. is excluded

This handles OCR errors like "INCONE TAX DEPARIIENT" — the word "tax" appears and the line is excluded.

**Selection**: Among valid candidates, prefer the one closest to 3 words (First Middle Last format).

#### Step 6: QR Code Extraction

Uses `pyzbar` library to decode QR codes on Aadhaar cards. The Aadhaar QR contains an XML payload with the holder's details. If the QR document number matches the OCR-extracted number, `qr_verified=True` (additional trust signal).

On Windows, pyzbar requires `libzbar-64.dll`. If not present, gracefully returns `None` (no crash).

---

## 7. FACE SERVICE

**File**: `app/services/face_service.py`

### What It Does

Compares the face on the ID document with the selfie photo. Returns a similarity score (0-1) and a match flag.

### Two-Stage Pipeline

#### Stage 1: Face Detection (OpenCV Haar Cascade)

**What is Haar Cascade?**
A machine learning-based object detection algorithm proposed by Viola and Jones (2001). It uses:
- **Haar features**: Rectangular regions in the image; difference between sum of pixels in adjacent rectangles
- **Integral image**: Allows computing any rectangular sum in O(1) time
- **AdaBoost**: Selects the most discriminative Haar features from thousands of candidates
- **Cascade of classifiers**: Multiple stages; early stages quickly reject non-face regions

**Why Haar over MTCNN?**
MTCNN (Multi-task Cascaded CNN) is more accurate but crashes with Keras 3 (bundled with TensorFlow 2.21) when no face is found in a batch: `ValueError: convolution resulted in empty output`. Haar cascade handles this gracefully.

**Multi-scale Detection Strategy** (3 attempts):
```
Attempt 1: scaleFactor=1.05, minNeighbors=5, minSize=(40,40) — strict
Attempt 2: scaleFactor=1.05, minNeighbors=3, minSize=(25,25) — relaxed
Attempt 3: scaleFactor=1.03, minNeighbors=2, minSize=(15,15) — loose
```
Starting strict prevents false positives. If no face found, tries more permissive settings. This handles everything from high-res selfies to tiny passport-sized ID photos.

**Face cropping with padding**: Detected face box is expanded by 25% on each side to include chin, forehead, and ears — giving the embedding model more context.

#### Stage 2: Face Embedding (DeepFace Facenet512)

**What is Facenet512?**
Google's FaceNet model (Schroff et al., 2015) adapted for 512-dimensional embeddings.

**How it works**:
1. Input: 160×160 RGB image
2. Architecture: GoogLeNet/Inception-based deep CNN
3. Output: 512-dimensional embedding vector (one floating point per dimension)
4. The embedding is designed so that: same person → vectors close together; different person → vectors far apart

**Why 512 dimensions?** More dimensions than the original FaceNet (128-dim) provide better discrimination between similar faces.

**Key parameter: `detector_backend='skip'`**
We skip DeepFace's internal face detection because:
1. We already detected the face with Haar cascade
2. Running DeepFace's detection (which uses TF) in a parallel thread alongside liveness service (also using TF) causes TensorFlow threading conflicts
3. `skip` mode tells DeepFace to just embed whatever image is passed — no detection

**Why pass NumPy arrays instead of file paths?**
DeepFace internally calls `cv2.imread(path)` when given a file path. On Windows, paths with spaces (like `New folder`) can cause issues in threaded execution. Passing the NumPy array directly bypasses all file I/O in the embedding step.

#### Stage 3: Cosine Similarity

**Formula**:
```
similarity = (A · B) / (||A|| × ||B||)
```
Where A and B are 512-dimensional embedding vectors.

**Why cosine similarity over Euclidean distance?**
Cosine similarity measures the angle between vectors (0° = same direction = same person). It's scale-invariant — two vectors with same direction but different magnitudes give similarity=1. Euclidean distance is affected by magnitude, making it less stable for face embeddings.

**Result interpretation**:
- ≥ 0.70: Excellent match (same person, good photo quality)
- 0.55–0.70: Good match (same person, slightly different conditions)
- < 0.55: Poor match (different person or very bad photo)

#### Fallback: Full Image Embedding

If face detection fails (very dark photo, extreme angle, no face visible), the system embeds the ENTIRE image with `detector_backend='skip'`. This gives a degraded but non-zero similarity rather than failing completely.

### Age and Gender Estimation

After computing similarity, `DeepFace.analyze()` estimates age and gender from the selfie:
- Age: Regression model → integer age estimate
- Gender: Classification → "Man" or "Woman" → stored as "M" or "F"
- Also uses `detector_backend='skip'` and passes NumPy array

---

## 8. LIVENESS SERVICE

**File**: `app/services/liveness_service.py`

### What It Does

Determines if the selfie is from a real live person or a spoof (printed photo, screen replay, mask).

### Why Liveness Detection Matters

Without liveness, an attacker could:
- Print a photo of someone's face and hold it up to the camera
- Show someone's photo on a phone screen
- Use a 3D mask

### Detection Approach: Passive Liveness

"Passive" means no user action required (unlike "active" which asks the user to blink, smile, etc.). This is better UX but harder technically.

Five checks with weighted combination:

#### Check 1: Face Symmetry (weight 30%)

**Theory**: Real 3D faces have natural bilateral symmetry. A flat photo held at an angle, or a screen with reflection, introduces asymmetry.

**How**:
1. Split the face ROI vertically at center
2. Flip the right half horizontally
3. Compute pixel-level difference between left and flipped-right
4. `symmetry = 1.0 - (mean_difference / 128.0)`

**Score**: 0.0 (very asymmetric) to 1.0 (perfectly symmetric)

#### Check 2: LBP Texture Analysis (weight 25%)

**What is LBP (Local Binary Pattern)?**
LBP describes the texture around each pixel by comparing it to its 8 neighbors:
- For each neighbor: 1 if neighbor ≥ center, 0 if neighbor < center
- Creates an 8-bit binary number (0-255)
- Compute histogram of all LBP values across the image

**Why it detects spoofs**: Real skin has complex micro-texture (pores, fine wrinkles). Printed photos or screen images have different texture statistics — screens have a regular pixel grid pattern, prints have halftone dot patterns.

**Parameters used**: `P=24` (24 neighbors), `R=3` (radius 3 pixels) — captures larger texture patterns

**Score metric**: Shannon entropy of LBP histogram:
```
entropy = -Σ p(i) × log₂(p(i))
```
Higher entropy = richer, more varied texture = more likely real face.

**Fallback**: If scikit-image is unavailable, uses Sobel gradient variance (proxy for texture richness).

#### Check 3: Reflection Check (weight 20%)

**Theory**: Real faces have small specular highlights (forehead, nose tip, cheekbones) due to skin's slight shininess. Flat photos and screens reflect differently.

**How**:
- Threshold image at pixel value 240 (near-white)
- Calculate ratio of very bright pixels
- `0.001 < ratio < 0.08` → natural highlights → score 0.85
- `ratio = 0` → no highlights → if image is dark, score 0.65; else 0.40
- `ratio > 0.08` → too many bright areas (glare/screen) → score 0.60

**Dark image handling**: A legitimate dark selfie (low ambient lighting) won't have bright highlights — this is NOT a spoof indicator. The check detects image brightness and gives a neutral score for dark images.

#### Check 4: Edge Analysis (weight 15%)

**Theory**: Real faces captured by a camera have natural, varied edge density. Printed photos have unnaturally sharp edges at the paper boundaries. Screens have a uniform grid of pixel edges.

**How**:
- Canny edge detection on the face ROI
- Calculate edge_density = (edge pixels) / (total pixels)
- `0.02 < density < 0.15` → natural range → score 0.85
- `density ≥ 0.15` → too many edges (screen, print artifacts) → score 0.40
- `density < 0.02` → too few edges (blurry) → score 0.65

#### Check 5: Skin Tone Analysis (weight 10%)

**Theory**: Real faces have pixels in the human skin tone color range. Spoof materials (paper, screen) may have different color distributions.

**How**:
- Convert image to YCrCb color space (separates brightness from color)
- Skin tone range in YCrCb: Cr between 133-173, Cb between 77-127 (validated skin tone ranges for South Asian/East Asian/Caucasian skin types)
- `ratio = (skin-tone pixels) / (total pixels)`
- Score = min(1.0, ratio / 0.15) — reaches 1.0 when ≥15% of pixels are skin-tone

### Final Score Calculation

```
liveness_score = 0.30 × symmetry
               + 0.25 × texture
               + 0.20 × reflection
               + 0.15 × edge
               + 0.10 × skin_tone
```

Threshold: `liveness_score ≥ 0.55` → `is_live = True`

---

## 9. FRAUD DETECTION SERVICE

**File**: `app/services/fraud_service.py`

### What It Does

Analyzes the ID document image for signs of digital tampering or forgery using 7 independent techniques.

### 7-Layer Analysis

#### Layer 1: ELA — Error Level Analysis (weight 30%)

**What it is**: JPEG images store data with lossy compression. When a JPEG is re-saved, the compression artifacts change. If part of an image was edited and pasted in, that region has DIFFERENT compression history than the rest.

**How it works**:
1. Re-save the image at 95% JPEG quality
2. Compute pixel-wise absolute difference: `|original - recompressed|`
3. Normalize: `ela_score = mean(difference) / 255.0 × 10`

**Interpretation**:
- Low ELA (close to 0) → uniform compression history → authentic
- High ELA in specific regions → that region was edited at a different quality level

**Threshold**: ELA > 0.4 → flag as potential tampering

#### Layer 2: Edge Consistency (weight 15%)

**Theory**: Authentic documents have consistent edge density throughout. If text or photos were pasted in, that region has abnormally high or low edge density compared to surroundings.

**How**:
1. Canny edge detection on full document
2. Divide image into 4×4 = 16 blocks
3. Calculate edge density (fraction of edge pixels) in each block
4. `inconsistency = standard_deviation(densities)` — high std = inconsistent edges
5. `score = min(1.0, inconsistency × 10)`

**Threshold**: Edge score > 0.5 → flag

#### Layer 3: Noise Uniformity (weight 20%)

**Theory**: Camera sensor noise follows a consistent statistical pattern across an image. Copy-paste operations or digital insertions have different noise characteristics.

**How**:
1. Apply median filter (5×5) to estimate signal without noise
2. Noise = `|original - median_filtered|`
3. Split into 4 quadrants, measure std of noise in each
4. `inconsistency = std(quadrant_stds) / mean(quadrant_stds)`
5. High inconsistency → different noise sources → manipulation

#### Layer 4: Copy-Move Detection (weight 15%)

**Theory**: A common forgery technique is copy-paste within the same document (e.g., copying one digit over another). This creates duplicate regions.

**How (ORB Feature Matching)**:
1. ORB (Oriented FAST and Rotated BRIEF) detects keypoints and computes descriptors
2. Self-matching: match the image's features against itself
3. Remove self-matches (same keypoint matching itself)
4. If many keypoints at different locations match each other closely (distance < 5px), those are copy-move candidates
5. `copy_move = True` if close pairs > 20

#### Layer 5: JPEG Ghost Detection (weight 20%)

**Theory**: If an image was JPEG-compressed multiple times at different quality levels, regions compressed at different qualities produce "ghost" artifacts.

**How (SSIM-based)**:
1. Re-compress image at qualities 30, 50, 70, 90
2. Measure SSIM (Structural Similarity Index) between original and each compression
3. If SSIM at q=30 is unusually HIGH (near 1.0), the image was pre-compressed — a sign of editing
4. `ghost_indicator = max(0, ssim_q30 - 0.85)` (baseline 0.85 for phone photos)
5. `score = min(1.0, ghost_indicator × 2)`

**Calibration**: Phone photos are already JPEG-compressed → naturally high q=30 SSIM. Baseline set to 0.85 to avoid false positives on legitimate uploads.

#### Layer 6: Metadata Analysis (weight — bonus +15% if flagged)

**How**: Uses `piexif` to read EXIF metadata. If `Software` tag contains "photoshop", "gimp", "lightroom", "affinity" → metadata_suspicious = True.

**Limitation**: Most phone photos don't have this tag. Sophisticated forgers can strip metadata. So it's a bonus signal, not a primary one.

#### Layer 7: Resolution Check (bonus -10% if fails)

**How**: Checks if image is at least 200×200 pixels. Very small images can't be properly analyzed and might be low-quality fakes.

### Fraud Score Aggregation

```
fraud_score = 0.30 × ela
            + 0.20 × noise_uniformity
            + 0.20 × jpeg_ghost
            + 0.15 × edge_consistency
            + 0.15 × copy_move (1.0 if True)
            + 0.15 if metadata_suspicious
            + 0.10 if resolution_inadequate
```

`is_suspicious = fraud_score ≥ 0.35`

---

## 10. RISK ENGINE

**File**: `app/services/risk_engine.py`

### What It Does

Takes all 4 service results and computes a final risk score (0–100, lower = better) and decision.

### Scoring System (100 points maximum penalty)

#### Component 1: Face Match (max 30 penalty points)

| Similarity | Penalty | Status |
|------------|---------|--------|
| ≥ 70% | 0 | Excellent |
| 55–70% | 15 | Good |
| < 55% | 30 | Poor |

Weighted highest because face match is the core identity verification signal.

#### Component 2: Document OCR Quality (max 25 penalty points)

| OCR Confidence | Penalty | Status |
|----------------|---------|--------|
| ≥ 80% | 0 | Excellent |
| 40–80% | 12 | Acceptable |
| < 40% | 25 | Poor |

Threshold set at 40% (not higher) because real Indian ID cards photographed with a phone camera typically score 40–60% due to:
- Mixed Hindi/English text reducing confidence
- Camera distortion, slight blur
- Shadows on document

#### Component 3: Liveness (max 20 penalty points)

| Liveness Score | Penalty | Status |
|----------------|---------|--------|
| ≥ 80% | 0 | Passed |
| 50–80% | 10 | Partial |
| < 50% | 20 | Failed |

#### Component 4: Data Consistency (max 15 penalty points)

Critical fields: document_number, name, DOB

| Fields Present | QR Verified | Penalty |
|----------------|-------------|---------|
| All 3 + QR | Yes | 0 |
| ≥ 2 fields | — | 7 |
| < 2 fields | — | 15 |

#### Component 5: Fraud Indicators (max 10 penalty points)

| Fraud Score | Penalty | Status |
|-------------|---------|--------|
| < 30% | 0 | Clean |
| 30–60% | 5 | Suspicious |
| ≥ 60% | 10 | High Risk |

### Decision Thresholds

```
risk_score ≤ 25  → APPROVED  (all checks passed)
risk_score 26–55 → REVIEW    (manual review needed)
risk_score > 55  → REJECTED  (significant issues)
```

### Example: Real Aadhaar + Clear Selfie

```
Face similarity 0.75  → penalty = 0   (≥ 0.70, Excellent)
OCR confidence 0.46   → penalty = 12  (0.40–0.80, Acceptable)
Liveness 0.847        → penalty = 0   (≥ 0.80, Passed)
2/3 fields found      → penalty = 7   (≥ 2, Most fields)
Fraud score 0.15      → penalty = 0   (< 0.30, Clean)
                         ────────────
Total risk score:          19 → APPROVED
```

---

## 11. DATABASE DESIGN

### Table: `kyc_verifications`

| Column | Type | Purpose |
|--------|------|---------|
| id | VARCHAR(36) | UUID primary key |
| created_at | DATETIME (TZ-aware) | UTC timestamp |
| document_type | VARCHAR(50) | aadhaar/pan/passport/driving_license |
| extracted_data | JSON | Full OCR result (all fields) |
| face_similarity | FLOAT | 0.0–1.0 cosine similarity |
| face_quality_score | FLOAT | Blur score of selfie |
| liveness_score | FLOAT | 0.0–1.0 liveness score |
| fraud_score | FLOAT | 0.0–1.0 fraud risk |
| fraud_flags | JSON | List of flag descriptions |
| risk_score | FLOAT | 0–100 risk score |
| risk_breakdown | JSON | Per-component scores |
| decision | VARCHAR(20) | APPROVED/REVIEW/REJECTED |
| decision_reasons | JSON | Human-readable reasons list |
| processing_time_ms | INTEGER | Total pipeline time in milliseconds |
| document_image_hash | VARCHAR(64) | SHA-256 of document image |
| selfie_image_hash | VARCHAR(64) | SHA-256 of selfie image |

**Why SHA-256 hashes?**
- Detect duplicate submissions (same document submitted twice)
- Audit trail without storing actual images (privacy)
- Verify document integrity

**Why JSON columns for complex fields?**
SQLite doesn't have array/nested types. JSON columns allow storing arbitrary nested data (extracted fields, fraud checks) as text while being queryable.

**Why SQLite for development?**
- Zero configuration
- Single file (`kyc.db`)
- No separate database server
- SQLAlchemy's async interface works identically with PostgreSQL for production

---

## 12. REST API

Base URL: `http://127.0.0.1:8000`

### POST /api/kyc/verify

**What**: Main verification endpoint
**Input**: `multipart/form-data` with two files:
- `id_document`: Government ID image (JPG/PNG/WebP, max 10MB)
- `selfie`: Live selfie image (JPG/PNG/WebP, max 10MB)

**Processing**: Runs full pipeline, saves to DB, returns complete result

**Response**: JSON with id, created_at, ocr, face, liveness, fraud, risk, processing_time_ms

**Timeout**: 5 minutes (300,000ms) on frontend

### GET /api/kyc/history

**What**: Paginated list of past verifications
**Query params**: `page` (default 1), `limit` (default 20, max 100)
**Returns**: items array, total_count, total_pages

### GET /api/kyc/stats

**What**: Aggregate statistics
**Returns**: Total verifications, approval rate, average risk/face/time scores, hourly distribution (last 24h in 1-hour buckets)

**How hourly distribution works**:
Loops through last 24 hours, running a separate COUNT query for each hour bucket. Used for the trend chart in the dashboard.

### GET /api/kyc/{id}

**What**: Full details of one verification
**Returns**: Complete verification record including all sub-results

### GET /api/health

**What**: Backend health check
**Returns**: `{"status": "ok", "timestamp": "...", "service": "...", "version": "..."}`

---

## 13. FRONTEND ARCHITECTURE

### Pages

#### VerifyPage (`/`)
Multi-step verification wizard:
1. **Upload Step**: Two file drop zones (drag-and-drop or click to browse) — one for ID, one for selfie. Also supports webcam capture for selfie.
2. **Processing Step**: Animated progress indicator showing the 4 pipeline stages
3. **OCR Result Step**: Extracted document fields with confidence badges
4. **Face Match Step**: Similarity percentage, quality metrics, detected age/gender
5. **Liveness Step**: Individual check scores, overall liveness verdict
6. **Fraud Step**: 7-layer analysis results, flags
7. **Risk Score Step**: Visual breakdown of penalty contributions
8. **Decision Step**: Final APPROVED/REVIEW/REJECTED with color coding

#### DashboardPage (`/dashboard`)
Statistics overview:
- Stats cards: total, approved, review, rejected counts + averages
- Pie chart: decision distribution
- Trend chart: verifications per hour (last 24h)
- Recent activity: last 5 verifications

#### HistoryPage (`/history`)
Paginated table of all verifications with:
- Document type, face similarity, risk score, decision, time
- Click to open DetailModal with full breakdown

### State Management

Uses React's `useKYC` custom hook for:
- Step management (which wizard step to show)
- Form data (uploaded files)
- API call state (loading, result, error)
- Upload progress tracking

### API Client (`src/api/kyc.js`)

Axios instance with:
- Base URL: `http://localhost:8000`
- Timeout: 300,000ms (5 minutes) for verification
- Request interceptor: adds timestamp metadata
- Response interceptor: extracts `res.data`, shows toast errors on failure

### Time Display Fix

Backend stores UTC datetimes. SQLite doesn't store timezone info natively, so when read back via SQLAlchemy, `datetime.tzinfo` can be `None`. If serialized with `.isoformat()` without timezone, JavaScript's `new Date()` treats it as **local time** instead of UTC — making times appear 5h 30m in the past for IST users.

Fix: Backend `_iso()` helper always adds `.replace(tzinfo=timezone.utc)` before serializing. Frontend `new Date("2026-03-26T01:03:12+00:00").toLocaleString("en-IN")` correctly converts UTC → IST.

---

## 14. SECURITY DESIGN

### File Upload Security

1. **Extension + Content-Type validation**: Checks both file extension (`.jpg`, `.png`, `.webp`) AND HTTP content-type header. Prevents renaming a malicious file to `.jpg`
2. **UUID filenames**: Uploaded files saved as `<uuid>.jpg` — prevents path traversal attacks (e.g., uploading `../../etc/passwd`)
3. **File size limit**: 10MB maximum per file
4. **Auto-deletion**: Files deleted in `finally` block after processing — images never persist on server

### Data Privacy

- Document images are NOT stored permanently (deleted after processing)
- Only SHA-256 hashes stored (one-way, cannot reconstruct image)
- Extracted data stored in database for audit trail
- No image is transmitted outside the local machine

### API Security

- CORS restricted to specific origins (frontend URL)
- No authentication currently (add JWT/API keys for production)
- No rate limiting currently (add for production)

### SQL Injection Prevention

SQLAlchemy ORM uses parameterized queries automatically — user input never interpolated directly into SQL strings.

---

## 15. DESIGN DECISIONS

### Why FastAPI over Flask/Django?

| Feature | FastAPI | Flask | Django |
|---------|---------|-------|--------|
| Async support | Native | Extension needed | Extension needed |
| Auto API docs | Yes (Swagger) | No | No |
| Data validation | Pydantic built-in | Manual | Forms |
| Performance | Highest | Medium | Medium |
| Learning curve | Low | Very Low | High |

FastAPI chosen for native async (needed for parallel ML), auto Swagger docs, and Pydantic integration.

### Why Facenet512 over InsightFace?

InsightFace requires Microsoft Visual C++ 14.0 build tools — needs Visual Studio installation (~15GB). Not practical for deployment. Facenet512 via DeepFace installs with a single pip command on any platform.

### Why OpenCV Haar over MTCNN for face detection?

MTCNN uses TensorFlow internally. It crashes with Keras 3 (bundled with TF 2.21) when no face candidates are found in an image batch:
```
ValueError: convolution resulted in empty output (0,48,48,3)
INVALID_ARGUMENT: Must provide as many biases as last dimension
```

OpenCV Haar Cascade has no TensorFlow dependency and handles all cases gracefully.

### Why detector_backend='skip' in DeepFace?

Running DeepFace's internal face detection (TF) in a parallel asyncio thread alongside liveness service's MTCNN (also TF) caused TensorFlow internal threading conflicts, resulting in all embeddings returning None.

Solution: Use `detector_backend='skip'` in DeepFace so it only runs the Facenet512 neural network (not detection). All detection is handled by Haar cascade, which has no TF dependency.

### Why NumPy arrays instead of file paths to DeepFace?

File paths with spaces (e.g., "New folder") can cause issues in multi-threaded contexts. Passing BGR NumPy arrays directly to `DeepFace.represent()` bypasses all file I/O inside DeepFace.

### Why SQLite over PostgreSQL for development?

- Zero setup (no database server to install)
- Single file database
- Same SQLAlchemy async API as PostgreSQL
- Trivially switch to PostgreSQL by changing `DATABASE_URL` in `.env`

### Why EasyOCR over Tesseract?

| Feature | EasyOCR | Tesseract |
|---------|---------|-----------|
| Hindi support | Excellent | Poor |
| Accuracy on ID cards | High | Medium |
| GPU acceleration | Optional | No |
| Installation | pip install | System package + traineddata files |
| Python API | Native | Wrapper library |

EasyOCR's CRAFT+CRNN architecture handles curved text, mixed fonts, and non-Latin scripts better.

### Why Cosine Similarity over Euclidean Distance?

Face embeddings are unit vectors (normalized to length 1). For unit vectors, cosine similarity and Euclidean distance are equivalent (related by: `euclidean = sqrt(2 - 2*cosine)`). Cosine similarity is more intuitive (0 to 1 range) and scale-invariant.

---

## 16. PERFORMANCE AND SCALABILITY

### Hardware Requirements

| Component | RAM Usage | CPU Usage |
|-----------|-----------|-----------|
| FastAPI + Python | ~100MB | Low |
| EasyOCR models | ~500MB | High during OCR |
| DeepFace Facenet512 | ~2GB | High during embedding |
| TensorFlow session | ~1GB | High during inference |
| OpenCV | ~50MB | Medium |
| **Total** | **~4GB** | **High (CPU)** |

### Processing Times (Intel i5-1135G7, 8GB RAM)

| Service | Time |
|---------|------|
| OCR | 20–40s |
| Face embedding (2 images) | 30–60s |
| Liveness | 2–5s |
| Fraud detection | 5–10s |
| **Total (parallel)** | **60–180s** |

First request after startup: ~3min (models not fully warmed up)
Subsequent requests: 60–120s

### GPU Acceleration (if available)

EasyOCR: set `gpu=True` in `easyocr.Reader()` → 5–10x speedup
TensorFlow: automatically uses GPU if CUDA is installed

### Production Scaling

- Switch SQLite → PostgreSQL (change DATABASE_URL)
- Run multiple Uvicorn workers: `--workers 4`
- Use Gunicorn as process manager
- Add Redis for caching frequent requests
- Use GPU server for ML inference

---

## 17. LIMITATIONS AND FUTURE SCOPE

### Current Limitations

1. **Processing speed**: 60–180s on CPU — too slow for real-time applications. GPU would solve this.
2. **Face similarity accuracy**: Haar cascade occasionally misses faces in low-contrast or extreme-angle photos. MTCNN or RetinaFace would be more accurate but have dependencies.
3. **OCR accuracy**: EasyOCR struggles with handwritten text (like handwritten signatures or DOB on some old IDs).
4. **No active liveness**: Passive liveness can be fooled by very high-quality 3D masks or deepfake videos.
5. **No QR verification on Windows**: pyzbar requires libzbar DLL which isn't pre-installed on Windows.
6. **Single file database**: SQLite is not suitable for concurrent multi-user production use.
7. **No authentication**: API is open — anyone who can reach port 8000 can use it.

### Planned Improvements

1. **Active liveness**: Ask user to blink or turn head (using facial landmarks)
2. **ONNX optimization**: Export Facenet512 to ONNX format for 3–5x faster inference without TensorFlow
3. **Better document segmentation**: Use CRAFT text detector to find individual fields more accurately
4. **Database**: PostgreSQL with proper indexing for production scale
5. **Authentication**: JWT tokens with role-based access (operator, admin, auditor)
6. **Multi-language**: Support for Tamil, Telugu, Bengali scripts on regional ID cards
7. **Webhook support**: Notify external systems when verification completes
8. **Document cropping**: Auto-detect and crop document boundaries before OCR

---

## 18. COMPLETE DATA FLOW

### Step-by-Step: User Uploads Aadhaar + Selfie

```
1. USER opens http://localhost:3000
   └─ React app loads, Vite serves bundle

2. USER selects Aadhaar image + selfie image
   └─ useKYC hook stores File objects in state

3. USER clicks "Verify Now"
   └─ verifyKYC() called in kyc.js
   └─ axios POST to http://localhost:8000/api/kyc/verify
      Content-Type: multipart/form-data
      Timeout: 300,000ms

4. BACKEND receives request
   └─ FastAPI validates files (extension + content-type)
   └─ Files saved: uploads/uuid1.jpg (document), uploads/uuid2.jpg (selfie)
   └─ pipeline.run_verification(doc_path, selfie_path) called

5. PIPELINE starts asyncio.gather():

   THREAD 1 — OCR Service:
   ├─ Load image (OpenCV + PIL fallback)
   ├─ Preprocess: CLAHE → bilateral → deskew → Otsu
   ├─ EasyOCR on preprocessed + original (takes better)
   ├─ Detect doc type: finds "permanent account" → "pan"
   ├─ PAN OCR correction: "QGKPS9GO4E" → "QGKPS9604E"
   ├─ Extract fields: doc_number, dob, name (filtered)
   └─ Return OCRResult

   THREAD 2 — Face Service:
   ├─ Load both images
   ├─ Haar cascade detection on each (3-scale attempt)
   ├─ Crop faces with 25% padding
   ├─ Resize to 160x160 if needed
   ├─ Convert BGR → RGB numpy array
   ├─ DeepFace.represent() with Facenet512 + skip backend → 512-dim vector each
   ├─ Cosine similarity between two vectors
   ├─ DeepFace.analyze() for age/gender estimate
   └─ Return FaceResult

   THREAD 3 — Liveness Service:
   ├─ Load selfie image
   ├─ Haar cascade to find face ROI
   ├─ Run 5 checks on face ROI:
   │   ├─ Symmetry (bilateral comparison)
   │   ├─ LBP texture (entropy of local binary patterns)
   │   ├─ Reflection (bright pixel ratio)
   │   ├─ Edge density (Canny)
   │   └─ Skin tone (YCrCb range)
   ├─ Weighted average → liveness_score
   └─ Return LivenessResult

   THREAD 4 — Fraud Service:
   ├─ Load document image
   ├─ ELA (re-compress → diff → score)
   ├─ Edge consistency (Canny → 16 blocks → std)
   ├─ Noise uniformity (median filter → 4 quadrant stds)
   ├─ Copy-move (ORB self-matching)
   ├─ JPEG ghost (SSIM at 4 quality levels)
   ├─ Metadata check (piexif EXIF software tag)
   ├─ Resolution check (min 200x200)
   └─ Return FraudResult

6. ALL 4 THREADS complete → asyncio.gather() returns

7. RISK ENGINE calculates:
   ├─ face_penalty based on similarity
   ├─ doc_penalty based on OCR confidence
   ├─ live_penalty based on liveness score
   ├─ data_penalty based on fields extracted
   └─ fraud_penalty based on fraud score
   └─ Sum → risk_score → APPROVED/REVIEW/REJECTED

8. ROUTER saves to database:
   └─ KYCVerification record inserted into kyc_verifications

9. ROUTER deletes uploaded files (finally block)

10. ROUTER returns JSON response with id + all results

11. FRONTEND receives JSON:
    ├─ Advances through result tabs
    ├─ Shows OCR fields
    ├─ Shows face similarity percentage
    ├─ Shows liveness checks
    ├─ Shows fraud analysis
    └─ Shows final APPROVED/REVIEW/REJECTED decision

Total time: 60–180 seconds
```

---

## 19. ALGORITHMS AND MATHEMATICS

### Cosine Similarity

Used to compare face embeddings.

```
cos(θ) = (A · B) / (||A|| × ||B||)
       = Σ(aᵢ × bᵢ) / sqrt(Σaᵢ²) × sqrt(Σbᵢ²)
```

Range: -1 to 1 (but face embeddings are always positive → 0 to 1)
- 1.0 = identical faces
- 0.0 = completely different

### SSIM (Structural Similarity Index)

Used in JPEG ghost fraud detection.

```
SSIM(x,y) = (2μₓμᵧ + c₁)(2σₓᵧ + c₂) / (μₓ² + μᵧ² + c₁)(σₓ² + σᵧ² + c₂)
```

Where μ = mean, σ = standard deviation, σₓᵧ = covariance, c₁,c₂ = stability constants

Range: 0 to 1 (1 = identical images)

### LBP (Local Binary Pattern)

For each pixel at (x,y), compare with 24 neighbors at radius 3:
```
LBP(x,y) = Σ s(gₙ - gc) × 2ⁿ,  n=0..23
where s(x) = 1 if x ≥ 0, else 0
gc = center pixel value
gₙ = neighbor pixel value
```

Shannon entropy of resulting histogram:
```
H = -Σ p(i) × log₂(p(i))
```
Higher entropy = more texture variety = more likely a real face.

### Haar Features (Viola-Jones)

A Haar feature is computed as:
```
feature = sum(white_region) - sum(black_region)
```

Using integral image for O(1) rectangle sum computation:
```
integral(x,y) = Σᵢ≤ₓ Σⱼ≤ᵧ pixel(i,j)
sum(rect) = I(x2,y2) - I(x1,y2) - I(x2,y1) + I(x1,y1)
```

### Otsu's Thresholding

Finds threshold T that minimizes within-class variance:
```
σ²_within(T) = w₀(T) × σ₀²(T) + w₁(T) × σ₁²(T)
```
Equivalent to maximizing between-class variance:
```
σ²_between(T) = w₀ × w₁ × (μ₀ - μ₁)²
```

Where w₀, w₁ are class probabilities (fraction of pixels below/above T).

### Weighted Risk Score

```
risk_score = Σ (penalty_component)
           = face_penalty + doc_penalty + liveness_penalty
             + data_penalty + fraud_penalty
```

Weights calibrated so that:
- A perfect submission scores 0 (APPROVED)
- A borderline submission scores 26–55 (REVIEW)
- A problematic submission scores >55 (REJECTED)

---

## 20. COMMON QUESTIONS AND ANSWERS

### "What is KYC and why is it important?"

KYC (Know Your Customer) is the process of verifying a customer's identity before providing financial or regulated services. It prevents money laundering, identity theft, and fraud. RBI mandates KYC for all Indian banks and financial institutions.

### "Why use AI for KYC instead of manual verification?"

Manual KYC: Takes 2–7 days, requires physical presence or courier, expensive (₹200–500 per verification), human error-prone. AI KYC: 1–3 minutes, fully digital, scalable to thousands of simultaneous verifications, consistent accuracy.

### "How accurate is the face matching?"

Facenet512 achieves 99.65% accuracy on the LFW (Labeled Faces in the Wild) benchmark. In practice, accuracy depends on photo quality. With good lighting and clear photos, face similarity typically >0.70.

### "Can the system be fooled with a printed photo?"

The liveness detection is designed to catch this. A printed photo has:
- Halftone dot texture (different LBP signature than real skin)
- No specular reflection at appropriate ratio
- Flat edges (no depth cues)
- Possibly different skin tone values

However, passive liveness is not foolproof against high-quality attacks.

### "What happens if OCR fails to read the document?"

Two fallbacks:
1. OCR runs on BOTH preprocessed and original image — picks better result
2. If overall_confidence < 40%, document_quality penalty increases but system still processes

The face match and liveness check are independent of OCR, so a partial OCR failure doesn't fail the entire verification.

### "How is the risk score calibrated?"

Empirically through testing with real ID cards and selfies. The thresholds (0.70 for excellent face match, 0.40 for acceptable OCR, etc.) were adjusted so that:
- Legitimate users with good photos → APPROVED
- Legitimate users with poor lighting → REVIEW (not hard rejected)
- Clear fraud attempts → REJECTED

### "Why is processing 60–180 seconds?"

Running deep learning models (EasyOCR CRAFT+CRNN, Facenet512 via TensorFlow) on CPU is computationally intensive. With a GPU (NVIDIA CUDA), processing time drops to 5–15 seconds. The 4-service parallel architecture already reduces time by ~50% vs sequential execution.

### "What is the difference between similarity and match?"

`similarity`: Raw cosine similarity score (0.0–1.0)
`match`: Boolean flag — True if similarity ≥ FACE_MATCH_THRESHOLD (0.55 by default)

The threshold is configurable in `.env`. Setting it higher makes matching stricter (fewer false accepts), lower makes it more permissive (fewer false rejects).

### "Why asyncio instead of threading or multiprocessing?"

Threading: Python's GIL prevents true parallelism for CPU-bound code in pure Python. However, `asyncio.to_thread()` runs in OS threads, bypassing GIL for C-extension code like OpenCV and TensorFlow (which release GIL during computation).

Multiprocessing: Better for CPU-bound Python code but high memory overhead (each process loads all models into its own memory = 4× RAM usage).

asyncio + to_thread: Best balance — low memory overhead, true parallelism for C-extension ML code.

### "Why is the system not using Docker?"

Docker is not required for local development. The system runs directly on Python + Node. Docker would be used for:
- Consistent deployment environments
- Containerized microservices
- Kubernetes orchestration

Other projects on the same machine use Docker (ble_attendance, mbfos) on ports 5432/6379 which don't conflict with KYC (8000/3000).

### "How would you scale this to 1000 simultaneous users?"

1. Switch to PostgreSQL (SQLite has write lock contention)
2. Multiple Uvicorn workers: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app`
3. GPU server for ML inference (5–15s instead of 60–180s)
4. Redis queue for async processing (webhook pattern — accept immediately, process in background)
5. CDN for frontend static assets
6. Load balancer across multiple backend instances

---

*CIPHER KYC v1.0 — Autonomous Identity Verification System*
*Backend: Python + FastAPI | ML: EasyOCR + DeepFace Facenet512 + OpenCV | Frontend: React + Vite*
