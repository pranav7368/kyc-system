"""
Database migration — adds columns introduced in the LLM/auth upgrade
to an existing kyc.db that was created with the original schema.

Safe to re-run: skips columns that already exist.

    cd backend
    python migrate_db.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "kyc.db")


def get_columns(cur, table: str) -> set:
    cur.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cur.fetchall()}


def add_col(cur, table: str, col: str, definition: str, existing: set):
    if col in existing:
        print(f"  [skip]  {table}.{col} already exists")
        return
    cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
    print(f"  [added] {table}.{col}")


def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH} — nothing to migrate.")
        return

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # ----------------------------------------------------------------
    # kyc_verifications — new columns from the auth/storage/review upgrade
    # ----------------------------------------------------------------
    kv_cols = get_columns(cur, "kyc_verifications")

    add_col(cur, "kyc_verifications", "user_id",
            "TEXT REFERENCES users(id)", kv_cols)

    add_col(cur, "kyc_verifications", "document_image_path",
            "TEXT", kv_cols)

    add_col(cur, "kyc_verifications", "document_back_image_path",
            "TEXT", kv_cols)

    add_col(cur, "kyc_verifications", "selfie_image_path",
            "TEXT", kv_cols)

    add_col(cur, "kyc_verifications", "user_form_data",
            "TEXT", kv_cols)          # stored as JSON string

    add_col(cur, "kyc_verifications", "form_match_result",
            "TEXT", kv_cols)          # stored as JSON string

    add_col(cur, "kyc_verifications", "reviewed_by",
            "TEXT REFERENCES users(id)", kv_cols)

    add_col(cur, "kyc_verifications", "reviewed_at",
            "DATETIME", kv_cols)

    add_col(cur, "kyc_verifications", "review_notes",
            "TEXT", kv_cols)

    add_col(cur, "kyc_verifications", "admin_decision",
            "TEXT", kv_cols)

    conn.commit()
    conn.close()
    print("\nMigration complete.")


if __name__ == "__main__":
    main()
