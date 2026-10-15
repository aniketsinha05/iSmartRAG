# Database Setup (PostgreSQL + pgAdmin 4 + Alembic)

Basic guide to create the database schema locally and inspect it in pgAdmin 4.

## Prerequisites

- Python 3.10+
- PostgreSQL installed and running locally
- pgAdmin 4 (installed with PostgreSQL, or standalone)

## 1. Create the database in pgAdmin 4

1. Open pgAdmin 4 and connect to your local server (enter the `postgres` password you set during install).
2. In the left tree: **Servers → PostgreSQL → Databases**.
3. Right-click **Databases → Create → Database...**
4. Set **Database** to `mydb` (any name you like) and click **Save**.

> Leave it empty. Alembic creates all tables.

## 2. Configure `.env`

Create a `.env` file in the **project root** (the folder that contains `backend/`):

```env
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/mydb
```

Notes:
- Default PostgreSQL port is `5432` (check it under server **Properties → Connection** in pgAdmin).
- If your password has special characters (`@`, `:`, `/`, `#`), URL-encode them (e.g. `@` becomes `%40`).

## 3. Install dependencies

```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install alembic sqlalchemy psycopg2-binary python-dotenv
```

(Skip this if you already have a `requirements.txt`: `pip install -r requirements.txt`.)

## 4. Run the migration

Run from the `backend/` folder (where `alembic.ini` lives):

```bash
cd backend
alembic upgrade head
```

You should see a line like `Running upgrade -> a8a8352b92ac, create initial database schema`.

## 5. Verify in pgAdmin 4

1. Right-click your database → **Refresh**.
2. Expand **mydb → Schemas → public → Tables**.
3. You should see:
   `alembic_version`, `users`, `sessions`, `knowledge_base`, `vector_chunks`, `classrooms`, `classroom_documents`, `chats`, `chat_messages`, `quiz_attempts`, `quiz_questions`.
4. To view data: right-click a table → **View/Edit Data → All Rows**.
5. To run SQL: right-click the database → **Query Tool**, e.g. `SELECT * FROM users;`

## Useful commands

| Command | What it does |
| --- | --- |
| `alembic upgrade head` | Apply all migrations |
| `alembic downgrade -1` | Roll back the last migration |
| `alembic downgrade base` | Roll back everything (drops all tables) |
| `alembic current` | Show the current DB revision |
| `alembic history` | List all migrations |
| `alembic revision -m "add something"` | Create a new empty migration |

## Troubleshooting

- **`DATABASE_URL is missing from the project-root .env file`**: the `.env` must be in the project root, not inside `backend/`.
- **`password authentication failed`**: wrong password in `DATABASE_URL`; use the same one you use to log in to pgAdmin.
- **`connection refused`**: PostgreSQL isn't running, or the port isn't 5432. Check the Services app (Windows) or `pg_ctl status`.
- **`database "mydb" does not exist`**: create it in pgAdmin first (step 1) and make sure the name matches the URL.
- **`No module named psycopg2`**: run `pip install psycopg2-binary` inside the activated venv.
- **`alembic: command not found`**: activate the venv, or run `python -m alembic upgrade head`.
- **Tables not showing in pgAdmin**: right-click and **Refresh**, and check you're under the `public` schema.
- **Starting over**: `alembic downgrade base`, then `alembic upgrade head`. Or drop and recreate the database in pgAdmin.