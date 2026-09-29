#!/usr/bin/env bash
# Build locally and ship the bot to the EC2 host, then (re)start the systemd service.
#
#   deploy/deploy.sh             code + config.json only (.env and data/ on the server are left alone)
#   deploy/deploy.sh --env       also upload the local .env
#   deploy/deploy.sh --seed-db   also upload local data/jobs.db (refuses if the server already has one)
set -euo pipefail

HOST="${DEPLOY_HOST:-ec2-user@18.226.8.58}"
KEY="${DEPLOY_KEY:-$HOME/Downloads/HQP_WG_KP.pem}"
APP_DIR=/opt/nsbe-job-bot
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

UPLOAD_ENV=false
SEED_DB=false
for arg in "$@"; do
  case "$arg" in
    --env) UPLOAD_ENV=true ;;
    --seed-db) SEED_DB=true ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."

npm test
rm -rf dist
npm run build

"${SSH[@]}" "command -v rsync >/dev/null || sudo dnf install -y -q rsync
  sudo mkdir -p $APP_DIR/data && sudo chown -R ec2-user:ec2-user $APP_DIR"

rsync -az --delete -e "ssh -i $KEY -o BatchMode=yes" \
  --exclude '.env' --exclude 'data/' --exclude 'node_modules/' \
  dist package.json package-lock.json config.json deploy/nsbe-job-bot.service \
  "$HOST:$APP_DIR/"

if $UPLOAD_ENV; then
  scp -q -i "$KEY" -o BatchMode=yes .env "$HOST:$APP_DIR/.env"
  "${SSH[@]}" "chmod 600 $APP_DIR/.env"
fi

if $SEED_DB; then
  if "${SSH[@]}" "test -e $APP_DIR/data/jobs.db"; then
    echo "server already has data/jobs.db; not overwriting" >&2
    exit 1
  fi
  # Fold the WAL into the main file so a single copy is consistent.
  node -e "new (require('node:sqlite').DatabaseSync)('data/jobs.db').exec('PRAGMA wal_checkpoint(TRUNCATE)')"
  rsync -az -e "ssh -i $KEY -o BatchMode=yes" data/jobs.db "$HOST:$APP_DIR/data/jobs.db"
fi

"${SSH[@]}" "set -e
  cd $APP_DIR
  test -f .env || { echo 'missing $APP_DIR/.env; rerun with --env' >&2; exit 1; }
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
  sudo install -m 644 nsbe-job-bot.service /etc/systemd/system/nsbe-job-bot.service
  sudo systemctl daemon-reload
  sudo systemctl enable nsbe-job-bot >/dev/null 2>&1
  sudo systemctl restart nsbe-job-bot
  sleep 5
  systemctl --no-pager --lines=15 status nsbe-job-bot"
