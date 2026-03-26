# Sample Data

Place test images here to verify the KYC pipeline.

## Required files
- `sample_doc.jpg`  — any government-issued ID card (Aadhaar / PAN / Passport)
- `sample_selfie.jpg` — a clear face photo

## Quick test (curl)
```bash
curl -X POST http://localhost:8000/api/kyc/verify \
  -F "id_document=@sample_doc.jpg" \
  -F "selfie=@sample_selfie.jpg"
```

## Image requirements
| Requirement | Min value |
|---|---|
| Resolution | 300 x 300 px |
| File size | < 10 MB |
| Format | JPG / PNG / WebP |
