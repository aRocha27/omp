# Docker Deployment

The deployment has two containers:

- `frontend`: Nginx serves the compiled React application and proxies `/api` to the backend.
- `backend`: Node runs the Express API and connects to the external SQL Server.

The SQL Server is not included in Docker. Set its address and credentials in `server/.env`.

## Start

```text
cp docker/deploy/server.env.example server/.env
docker compose up -d --build
```

Open `http://localhost:5173` or the host LAN address.

## Global profiles

The backend mounts `server/.env` read/write. A Global database selection updates
`ORDERS_PROFILE_ID` and the container exits. Docker's `restart: unless-stopped`
starts it again with the selected profile. Keep this file on persistent storage.

Session selections do not modify the file or restart the backend.

## Export

Run from the repository root:

```text
./docker/scripts/export-docker.sh
```

This creates `omp-docker.tar.gz` containing the two images, Compose file,
and a credential-free environment template. Real `.env` files and passwords are
intentionally excluded.
