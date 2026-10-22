# Run VIORA with Docker

1. Install Docker Desktop and start it.
2. Copy `.env.docker.example` to `.env.docker` and fill in the values.
3. From the project folder run: `docker compose up --build`
   (the first build takes several minutes).
4. Open http://localhost

Useful commands:

- `docker compose ps` shows what is running
- `docker compose logs -f backend` shows backend logs
- `docker compose down` stops everything (data is kept)
- `docker compose down -v` stops everything and DELETES all data

Run only ONE backend container. The FAISS index files are not safe for two.
