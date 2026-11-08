#!/usr/bin/env bash
# Runs the whole stack: API (8080), website (3000), admin panel (3001).
#
#   ./run.sh          fast mode: pre-built frontends (rebuilt only when code changes)
#   ./run.sh --dev    hot reload (slow: pages compile on first visit)
#   ./run.sh --prod   like fast mode, with a release-optimised API
#   ./run.sh --db     also start Postgres from docker-compose.yml first
#   ./run.sh --clean  delete build output and node_modules (target, dist, .next, node_modules), then exit
#
# Press Ctrl+C to stop everything.
set -euo pipefail
cd "$(dirname "$0")"

# Removes generated files only: build output and node_modules. Source and .env files are kept.
# (The next ./run.sh re-runs `npm install` automatically when node_modules is missing.)
clean() {
  echo ">> Removing build output and node_modules..."
  rm -rf target backend/target dist backend/dist \
         web/.next web/dist admin/.next admin/dist \
         web/tsconfig.tsbuildinfo admin/tsconfig.tsbuildinfo \
         node_modules web/node_modules admin/node_modules
  echo ">> Clean. To archive without secrets, from the parent folder:"
  echo "   tar --exclude=node_modules --exclude=.env --exclude=.env.local --exclude=.git -czf sulthan-holidays.tar.gz $(basename "$PWD")"
}

MODE=fast
START_DB=0
for a in "$@"; do
  case "$a" in
    --clean) clean; exit 0 ;;
    --dev) MODE=dev ;;
    --prod) MODE=prod ;;
    --db) START_DB=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $a (try --help)"; exit 1 ;;
  esac
done

need() { command -v "$1" >/dev/null || { echo "Missing required tool: $1"; exit 1; }; }
need cargo; need npm

# First-run setup: create env files from the examples (never overwrites).
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo ">> Created backend/.env. Edit it (DATABASE_URL, JWT_SECRET, UPI_ID, ADMIN_*), then run ./run.sh again."
  exit 1
fi
[ -f web/.env.local ] || cp web/.env.example web/.env.local
[ -f admin/.env.local ] || cp admin/.env.example admin/.env.local

if grep -q '^JWT_SECRET=change-me$' backend/.env; then
  need openssl
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" backend/.env
  echo ">> Generated a random JWT_SECRET in backend/.env"
fi
if grep -q '^ADMIN_PASSWORD=change-me-please$' backend/.env; then
  echo ">> WARNING: ADMIN_PASSWORD in backend/.env is still the placeholder. Change it before the first start"
  echo "   (the admin account is only created once, on an empty database)."
fi

gid_api=$(grep -E '^GOOGLE_CLIENT_ID=' backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
gid_web=$(grep -E '^NEXT_PUBLIC_GOOGLE_CLIENT_ID=' web/.env.local | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
if [ -z "$gid_api" ] && [ -z "$gid_web" ]; then
  echo ">> Google sign-in is OFF (no client ID). To enable it see docs/SETUP.md section 4."
elif [ "$gid_api" != "$gid_web" ]; then
  echo ">> WARNING: GOOGLE_CLIENT_ID (backend/.env) and NEXT_PUBLIC_GOOGLE_CLIENT_ID (web/.env.local) differ or one is empty."
  echo "   Google sign-in will fail until both hold the same value."
fi

if [ "$START_DB" = 1 ]; then
  need docker
  if ! docker info >/dev/null 2>&1; then
    echo ">> Docker is not reachable. Start Docker Desktop and enable WSL integration for this distro"
    echo "   (Settings > Resources > WSL Integration), or run without --db."
    exit 1
  fi
  echo ">> Starting Postgres (docker compose)..."
  docker compose up -d db
  ready=0
  for _ in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U sulthan >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
  done
  [ "$ready" = 1 ] || { echo ">> Postgres did not become ready in 30s. Check: docker compose logs db"; exit 1; }
  echo ">> Postgres is ready."
fi

for app in web admin; do
  [ -d "$app/node_modules" ] || { echo ">> Installing $app dependencies..."; (cd "$app" && npm install); }
done

PIDS=()
cleanup() {
  trap - INT TERM EXIT
  echo; echo ">> Stopping..."
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# Prefix each line of a process's output so the three logs are easy to tell apart.
run() { # name, dir, command...
  local name=$1 dir=$2; shift 2
  ( cd "$dir" && exec "$@" ) 2>&1 | sed -u "s/^/[$name] /" &
  PIDS+=($!)
}

for port in 8080 3000 3001; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo ">> Port $port is already in use (an old run still going?). Stop it first, e.g.: pkill -f 'next-server|next dev|sulthan-holidays'"
    exit 1
  fi
done

# Build a frontend only if its sources changed since the last build.
build_if_stale() { # dir
  local d=$1
  if [ ! -f "$d/.next/BUILD_ID" ] || [ -n "$(find "$d/app" "$d/components" "$d/lib" "$d/public" "$d/package.json" "$d/next.config.ts" "$d/.env.local" \
        -newer "$d/.next/BUILD_ID" -type f 2>/dev/null | head -1)" ]; then
    echo ">> Building $d (one-off, ~1 min)..."
    (cd "$d" && rm -rf .next && npm run build)
  fi
}

if [ "$MODE" = dev ]; then
  # Hot reload, but slow: pages compile on first visit (this machine has no native Next compiler).
  rm -rf web/.next admin/.next   # stale cache causes "ENOENT .next/dev/server/..." errors
  run api backend cargo run
  run web web npm run dev
  run admin admin npm run dev
else
  if [ "$MODE" = prod ]; then
    (cd backend && cargo build --release)
    API_BIN=./target/release/sulthan-holidays
  else
    (cd backend && cargo build)
    API_BIN=./target/debug/sulthan-holidays
  fi
  build_if_stale web
  build_if_stale admin
  run api backend "$API_BIN"
  run web web npm start
  run admin admin npm start
fi

echo ">> Waiting for the API..."
for _ in $(seq 1 60); do curl -fs localhost:8080/api/health >/dev/null 2>&1 && break; sleep 1; done

cat <<'EOF'

  API      http://localhost:8080/api/health
  Website  http://localhost:3000
  Admin    http://localhost:3001   (login = ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env)

  Ctrl+C to stop.
EOF

wait
