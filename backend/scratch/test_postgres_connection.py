import sys
from sqlalchemy import inspect
from app.database.database import engine, Base, SessionLocal
from app.models.user import User
from app.repositories.user_repository import user_repository
from app.utils.security import hash_password

def test_pg():
    print("=" * 60)
    print("TESTING POSTGRESQL CONNECTIVITY & SCHEMA INITIALIZATION")
    print("=" * 60)
    print(f"Connecting to: {engine.url}")

    try:
        # Create all tables in PostgreSQL
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"\n[SUCCESS] Connected successfully! Found {len(tables)} tables in PostgreSQL:")
        for t in sorted(tables):
            print(f" - {t}")

        # Seed account np@gmail.com / 123456 in PostgreSQL
        db = SessionLocal()
        try:
            existing = user_repository.get_by_email(db, "np@gmail.com")
            if not existing:
                user_repository.create(
                    db,
                    name="Ninad",
                    email="np@gmail.com",
                    password_hash=hash_password("123456"),
                    role="admin"
                )
                print("\n[SUCCESS] Created account np@gmail.com / 123456 in PostgreSQL database!")
            else:
                user_repository.update(db, db_obj=existing, obj_in={"password_hash": hash_password("123456")})
                print("\n[SUCCESS] Account np@gmail.com / 123456 is configured in PostgreSQL database!")
        finally:
            db.close()
        return True
    except Exception as e:
        print(f"\n[X] PostgreSQL connection error: {type(e).__name__}: {e}")
        return False

if __name__ == "__main__":
    success = test_pg()
    sys.exit(0 if success else 1)
