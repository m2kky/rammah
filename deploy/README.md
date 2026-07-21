# VPS launch

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Point the Nginx example at the real domain and enable HTTPS with Certbot.
3. Run `docker compose -f docker-compose.production.yml build`.
4. Run `docker compose -f docker-compose.production.yml run --rm api npm run preflight --workspace=rammah-api`.
5. Run `docker compose -f docker-compose.production.yml up -d`.
6. Run `docker compose -f docker-compose.production.yml exec api npm run smoke --workspace=rammah-api`.

The stack expects PostgreSQL through `DATABASE_URL`; database backups stay with that provider/VPS service.
