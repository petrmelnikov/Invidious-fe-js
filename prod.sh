#!/usr/bin/env bash

# prod.sh - Production management script for invidious-fe

set -e

COMPOSE_FILE="compose.yaml"
DATA_DIR="data"

function show_help() {
  echo "Usage: ./prod.sh [command]"
  echo ""
  echo "Commands:"
  echo "  init    - Initialize production environment (create data folders)"
  echo "  start   - Start the application in detached mode"
  echo "  stop    - Stop the application"
  echo "  update  - Pull latest changes, rebuild and restart"
  echo "  help    - Show this help message"
}

function do_init() {
  echo "[prod] Initializing production environment..."
  
  # Create data directory if it doesn't exist
  if [ ! -d "$DATA_DIR" ]; then
    mkdir -p "$DATA_DIR"
    echo "[prod] Created data directory: $DATA_DIR"
  else
    echo "[prod] Data directory already exists."
  fi
  
  # Ensure the container user (node, UID 1000) has full write access
  # Using 777 ensures no Permission Denied errors regardless of host OS
  chmod 777 "$DATA_DIR"
  
  # If accounts file already exists, make it writable too
  if [ -f "$DATA_DIR/accounts.json" ]; then
    chmod 666 "$DATA_DIR/accounts.json"
  fi
  
  # Add data directory to .gitignore if not present
  if ! grep -q "^${DATA_DIR}/" .gitignore 2>/dev/null && ! grep -q "^${DATA_DIR}$" .gitignore 2>/dev/null; then
    echo "$DATA_DIR/" >> .gitignore
    echo "[prod] Added $DATA_DIR/ to .gitignore"
  fi
  
  echo "[prod] Initialization complete."
}

function do_start() {
  echo "[prod] Starting application..."
  docker compose -f "$COMPOSE_FILE" up -d
  echo "[prod] Application started."
}

function do_stop() {
  echo "[prod] Stopping application..."
  docker compose -f "$COMPOSE_FILE" down
  echo "[prod] Application stopped."
}

function do_update() {
  echo "[prod] Updating application..."
  
  # Pull latest changes if it's a git repository
  if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "[prod] Pulling latest changes from git..."
    git pull
  else
    echo "[prod] Not a git repository, skipping git pull."
  fi
  
  echo "[prod] Rebuilding docker image..."
  docker compose -f "$COMPOSE_FILE" build
  
  echo "[prod] Restarting application..."
  docker compose -f "$COMPOSE_FILE" up -d
  
  echo "[prod] Update complete. Unused images can be cleaned with 'docker image prune -f'."
}

case "$1" in
  init)
    do_init
    ;;
  start)
    do_start
    ;;
  stop)
    do_stop
    ;;
  update)
    do_update
    ;;
  *)
    show_help
    exit 1
    ;;
esac
