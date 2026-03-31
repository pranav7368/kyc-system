"""
Run once to create the default admin and a test user.

    cd backend
    python create_admin.py

You can re-run safely — it skips accounts that already exist.
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import AsyncSessionLocal, create_tables, User
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
import uuid
from datetime import datetime, timezone

ACCOUNTS = [
    {
        "username": "admin",
        "email":    "admin@cipher.kyc",
        "password": "Admin@123",
        "role":     "admin",
        "full_name": "System Admin",
    },
    {
        "username": "testuser",
        "email":    "user@cipher.kyc",
        "password": "User@123",
        "role":     "user",
        "full_name": "Test User",
    },
]


async def main():
    await create_tables()

    async with AsyncSessionLocal() as session:
        from sqlalchemy import select

        for acc in ACCOUNTS:
            result = await session.execute(
                select(User).where(User.username == acc["username"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"  [skip]    {acc['username']} already exists (role={existing.role})")
                continue

            user = User(
                id=str(uuid.uuid4()),
                created_at=datetime.now(timezone.utc),
                username=acc["username"],
                email=acc["email"],
                hashed_password=hash_password(acc["password"]),
                role=acc["role"],
                full_name=acc["full_name"],
                is_active=True,
            )
            session.add(user)
            await session.commit()
            print(f"  [created] {acc['username']}  password={acc['password']}  role={acc['role']}")


if __name__ == "__main__":
    asyncio.run(main())
    print("\nDone. Use these credentials to log in.")
