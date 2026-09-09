#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output_dir="${1:-$root_dir/docker/exports/omp-docker}"
archive="${output_dir}.tar.gz"

if [[ ! -f "$root_dir/server/.env" ]]; then
  printf '%s\n' 'server/.env is required to build the deployment images.' >&2
  exit 1
fi

docker compose -f "$root_dir/docker/docker-compose.yml" build
mkdir -p "$output_dir"
docker save \
  omp-backend:local \
  omp-frontend:local \
  -o "$output_dir/omp-images.tar"
cp "$root_dir/docker/docker-compose.yml" "$output_dir/"
cp "$root_dir/docker/deploy/server.env.example" "$output_dir/server.env.example"
cat > "$output_dir/README.txt" <<'EOF'
OMP Docker deployment

1. Copy server.env.example to server.env.
2. Fill server.env with the target SQL Server profiles.
3. Load omp-images.tar with: docker load -i omp-images.tar
4. Start with: docker compose up -d
5. Open http://localhost:5173

Do not put real passwords in the image archive or commit them to source control.
The server.env file must be mounted persistently because Global profile changes update it.
EOF
tar -czf "$archive" "$output_dir"
printf 'Exported %s\n' "$archive"
