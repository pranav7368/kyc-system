"""
Automatic column-level migrations for SQLite.

Called on every startup — safe to run repeatedly (skips existing columns).
Handles the case where the DB was created with an older schema and new columns
were added to the ORM models without dropping and recreating the database.
"""
import sqlite3
import logging
import os

logger = logging.getLogger("kyc.db_migrate")

# Each entry: (table, column_name, sqlite_type_definition)
REQUIRED_COLUMNS = [
    # kyc_verifications — columns added in auth/storage/review upgrade
    ("kyc_verifications", "user_id",                   "TEXT"),
    ("kyc_verifications", "document_image_path",       "TEXT"),
    ("kyc_verifications", "document_back_image_path",  "TEXT"),
    ("kyc_verifications", "selfie_image_path",         "TEXT"),
    ("kyc_verifications", "user_form_data",            "TEXT"),
    ("kyc_verifications", "form_match_result",         "TEXT"),
    ("kyc_verifications", "reviewed_by",               "TEXT"),
    ("kyc_verifications", "reviewed_at",               "DATETIME"),
    ("kyc_verifications", "review_notes",              "TEXT"),
    ("kyc_verifications", "admin_decision",            "TEXT"),
]


def _db_path() -> str:
    """Resolve the SQLite file path from DATABASE_URL env / default."""
    db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./kyc.db")
    # Strip driver prefix: sqlite+aiosqlite:///./kyc.db  →  ./kyc.db
    path = db_url.split("///", 1)[-1]
    # Make absolute relative to backend root (two levels up from this file)
    if not os.path.isabs(path):
        base = os.path.dirname(os.path.dirname(__file__))   # backend/
        path = os.path.join(base, path)
    return path


def run_migrations():
    """Add any missing columns to existing tables. Safe to call every startup."""
    db = _db_path()
    if not os.path.exists(db):
        return   # fresh DB — create_tables() will build everything from scratch

    conn = sqlite3.connect(db)
    cur  = conn.cursor()
    added = 0

    for table, col, typedef in REQUIRED_COLUMNS:
        # Check existing columns for this table
        cur.execute(f"PRAGMA table_info({table})")
        existing = {row[1] for row in cur.fetchall()}
        if col not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}")
            logger.info(f"DB migration: added {table}.{col}")
            added += 1

    conn.commit()
    conn.close()

    if added:
        logger.info(f"DB migration complete — {added} column(s) added.")
    else:
        logger.debug("DB migration: schema up-to-date, no changes needed.")
