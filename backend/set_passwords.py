"""Set Admin@123 password for the 6 designated users directly via SQL."""
import sys
sys.path.insert(0, ".")

from passlib.context import CryptContext
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:CHANGE_ME_DB_PASSWORD@localhost:5432/cotelligent_hrms"
EMPLOYEE_IDS = ['599', '100311', '9', '294', '272', '597']

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("Admin@123")
print(f"Hash: {hashed}")

engine = create_engine(DATABASE_URL)
with engine.begin() as conn:
    result = conn.execute(
        text("UPDATE employees SET hashed_password = :h WHERE employee_id = ANY(:ids) RETURNING employee_id, first_name, last_name, email"),
        {"h": hashed, "ids": EMPLOYEE_IDS}
    )
    rows = result.fetchall()
    print(f"\nUpdated {len(rows)} employees:")
    for row in rows:
        print(f"  {row[0]} | {row[1]} {row[2]} | {row[3]}")

print("\nDone. All passwords set to Admin@123")
