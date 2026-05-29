import sqlite3
import os
import bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), "nasa_maintenance.db")

# ── ADMIN CONFIG (single admin, seeded automatically) ─────────────────────────
ADMIN_USERNAME      = "admin"
ADMIN_EMAIL         = "admin@aerosense.gov"
ADMIN_PASSWORD_PLAIN = "admin"


def get_connection():
    """Return a new SQLite connection with row_factory set."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_tables():
    """Create/upgrade database tables."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT    NOT NULL UNIQUE,
            email           TEXT    NOT NULL UNIQUE,
            hashed_password TEXT    NOT NULL DEFAULT '',
            is_admin        INTEGER NOT NULL DEFAULT 0,
            last_login      TEXT,
            login_count     INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            google_id       TEXT    UNIQUE,
            name            TEXT,
            picture         TEXT
        )
    """)

    # Safe migrations for existing databases (ignore if column exists)
    for col, defn in [
        ("is_admin",    "INTEGER NOT NULL DEFAULT 0"),
        ("last_login",  "TEXT"),
        ("login_count", "INTEGER NOT NULL DEFAULT 0"),
        ("google_id",   "TEXT"),
        ("name",        "TEXT"),
        ("picture",     "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")
        except Exception:
            pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER NOT NULL,
            role         TEXT    NOT NULL CHECK(role IN ('user', 'ai')),
            message      TEXT    NOT NULL,
            context_json TEXT,
            timestamp    TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()
    print("[OK] Database tables created / verified.")


def seed_admin():
    """
    Ensure the admin account exists with the correct credentials.
    - Creates it fresh if it doesn't exist.
    - If a user named 'admin' exists but was registered manually (wrong email/no admin flag),
      we update it to have is_admin=1 and reset the password to the standard admin password.
    """
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id, email, is_admin FROM users WHERE username = ?", (ADMIN_USERNAME,)
        ).fetchone()

        hashed = bcrypt.hashpw(ADMIN_PASSWORD_PLAIN.encode(), bcrypt.gensalt()).decode()

        if existing is None:
            # Fresh install — create admin
            conn.execute(
                "INSERT INTO users (username, email, hashed_password, is_admin) VALUES (?, ?, ?, 1)",
                (ADMIN_USERNAME, ADMIN_EMAIL, hashed)
            )
            conn.commit()
            print(f"[OK] Admin user '{ADMIN_USERNAME}' created (email: {ADMIN_EMAIL}).")
        else:
            # Admin user exists — ensure admin flag, reset password to standard
            conn.execute(
                "UPDATE users SET is_admin = 1, hashed_password = ?, email = ? WHERE username = ?",
                (hashed, ADMIN_EMAIL, ADMIN_USERNAME)
            )
            conn.commit()
            print(f"[OK] Admin user '{ADMIN_USERNAME}' credentials refreshed.")
    finally:
        conn.close()


# ── USER HELPERS ──────────────────────────────────────────────────────────────

def get_user_by_username(username: str):
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(user) if user else None


def get_user_by_id(user_id: int):
    conn = get_connection()
    user = conn.execute(
        """SELECT id, username, email, is_admin, last_login, login_count, created_at, name, picture
           FROM users WHERE id = ?""",
        (user_id,)
    ).fetchone()
    conn.close()
    return dict(user) if user else None


def create_user(username: str, email: str, hashed_password: str) -> int:
    """Insert a regular (non-admin) user. Returns the new user's id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, email, hashed_password, is_admin) VALUES (?, ?, ?, 0)",
        (username, email, hashed_password)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    return user_id


def update_last_login(user_id: int):
    """Update last_login timestamp and increment login_count."""
    conn = get_connection()
    conn.execute(
        "UPDATE users SET last_login = datetime('now'), login_count = login_count + 1 WHERE id = ?",
        (user_id,)
    )
    conn.commit()
    conn.close()


def username_exists(username: str) -> bool:
    conn = get_connection()
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return row is not None


def email_exists(email: str) -> bool:
    conn = get_connection()
    row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return row is not None


def get_all_users():
    """Return all users for admin panel (no hashed passwords)."""
    conn = get_connection()
    rows = conn.execute(
        """SELECT id, username, email, is_admin, last_login, login_count, created_at
           FROM users ORDER BY created_at DESC"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _generate_username(conn, email: str, name: str) -> str:
    """Derive a unique username from the email prefix or display name."""
    base = (email.split("@")[0] if email else name).lower()
    base = "".join(c for c in base if c.isalnum() or c in "_-")[:20] or "user"
    username = base
    suffix = 1
    while conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone():
        username = f"{base}{suffix}"
        suffix += 1
    return username


def find_or_create_google_user(google_id: str, email: str, name: str, picture: str) -> dict:
    """Find an existing user by google_id or email, or create a new one.
    Returns the user dict (always includes id, username, email, is_admin)."""
    conn = get_connection()
    try:
        # 1. Match by google_id
        row = conn.execute(
            "SELECT * FROM users WHERE google_id = ?", (google_id,)
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE users SET name = ?, picture = ? WHERE google_id = ?",
                (name, picture, google_id)
            )
            conn.commit()
            updated = conn.execute("SELECT * FROM users WHERE google_id = ?", (google_id,)).fetchone()
            return dict(updated)

        # 2. Link to existing account with same email
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE users SET google_id = ?, name = ?, picture = ? WHERE id = ?",
                (google_id, name, picture, row["id"])
            )
            conn.commit()
            updated = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
            return dict(updated)

        # 3. Create brand-new Google user
        username = _generate_username(conn, email, name)
        conn.execute(
            """INSERT INTO users (username, email, hashed_password, google_id, name, picture)
               VALUES (?, ?, '', ?, ?, ?)""",
            (username, email, google_id, name, picture)
        )
        conn.commit()
        new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        return dict(conn.execute("SELECT * FROM users WHERE id = ?", (new_id,)).fetchone())
    finally:
        conn.close()


# ── CHAT HISTORY HELPERS ──────────────────────────────────────────────────────

def save_chat_message(user_id: int, role: str, message: str, context_json: str = None):
    """Persist a single chat message for a user."""
    conn = get_connection()
    conn.execute(
        "INSERT INTO chat_history (user_id, role, message, context_json) VALUES (?, ?, ?, ?)",
        (user_id, role, message, context_json)
    )
    conn.commit()
    conn.close()


def get_chat_history(user_id: int, limit: int = 50):
    """Return the last `limit` messages for a user, oldest first."""
    conn = get_connection()
    rows = conn.execute(
        """SELECT id, role, message, context_json, timestamp
           FROM chat_history WHERE user_id = ?
           ORDER BY id DESC LIMIT ?""",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]


def clear_chat_history(user_id: int):
    """Delete all chat messages for a user."""
    conn = get_connection()
    conn.execute("DELETE FROM chat_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
