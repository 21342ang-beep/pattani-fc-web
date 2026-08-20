#!/bin/bash
# Pattani FC — one-shot deploy script
# Runs Phase 2 (Postgres) → npm install → build → PM2 start
# Assumes Phase 1 done (node, npm, pm2, nginx, postgresql, git installed)
#
# Usage from within cloned repo:
#   bash deploy/setup.sh

set -euo pipefail
# Build output must remain group-readable after it is locked to root ownership.
# Secret files are explicitly tightened to 0600 below.
umask 027
SAFE_SYSTEM_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
PATH="$SAFE_SYSTEM_PATH"
export PATH

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this setup script as root (for example: sudo bash deploy/setup.sh)"
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPECTED_APP_DIR="/var/www/pattani-fc"
DOMAIN="pattanifc.co"
SERVICE_USER="pattani-app"
SERVICE_HOME="/var/lib/pattani-fc"
BUILD_USER="pattani-build"
BUILD_HOME="/var/lib/pattani-fc-build"
MIGRATE_USER="pattani-migrate"
MIGRATE_HOME="/var/lib/pattani-fc-migrate"
BUILD_READ_GROUP="pattani-build-read"
MEDIA_GROUP="pattani-media"
BOOTSTRAP_FILE="/root/.secrets/pattani-fc-bootstrap-admin.txt"
INSTALL_COMPLETE_MARKER="/root/.secrets/pattani-fc-install-complete"
INSTALL_IN_PROGRESS_MARKER="/root/.secrets/pattani-fc-install-in-progress"
FRESH_INSTALL=0
BOOTSTRAP_ADMIN_PASSWORD=""
BOOTSTRAP_CMS_PASSWORD=""
BUILD_WORK=""
ARTIFACT_STAGE_DIR=""
ARTIFACT_TRANSACTION_MARKER="$(dirname "$APP_DIR")/.pattani-fc-swap-in-progress"
BUILD_DATABASE_NAME="pattani_build_sandbox"
BUILD_DATABASE_CREATED=0
INITIAL_INSTALL=0
MAINTENANCE_ACTIVE=0
MAINTENANCE_MARKER="/var/lib/pattani-fc-maintenance"
MAINTENANCE_MARKER_ACTIVE=0
DATABASE_CHANGE_STARTED=0
ARTIFACT_SWAP_STARTED=0
ARTIFACT_BACKUP_DIR=""
ARTIFACT_BACKUP_ROOT=""
NODE_MODULES_OLD_PRESENT=0
NODE_MODULES_SWAP_ARMED=0
NEXT_OLD_PRESENT=0
NEXT_SWAP_ARMED=0
NGINX_POLICY_CHANGED=0
NGINX_SITE="/etc/nginx/sites-available/pattanifc.co"
NGINX_ENABLED="/etc/nginx/sites-enabled/pattanifc.co"
NGINX_SNAPSHOT_DIR=""
NGINX_SITE_STATE="unknown"
NGINX_ENABLED_STATE="unknown"
NGINX_ENABLED_TARGET=""
NGINX_CANDIDATE=""
declare -a NGINX_LEGACY_ENABLED_NAMES=()
DEPLOY_SUCCESS=0
PM2_SYSTEMD_UNIT="pm2-${SERVICE_USER}.service"
RUNTIME_PROCESS_GUARD_ACTIVE=0
RUNTIME_DB_CREDENTIAL_GUARD_ACTIVE=0
CUTOVER_DB_PASSWORD=""
MIGRATION_DATABASE_URL=""
LEGACY_ROOT_PM2_UNIT="pm2-root.service"
LEGACY_ROOT_PM2_CAPTURED=0
LEGACY_ROOT_PM2_STOP_ARMED=0
LEGACY_ROOT_PM2_RETIRED=0
LEGACY_ROOT_PM2_APP=""
LEGACY_ROOT_PM2_CWD=""
LEGACY_ROOT_PM2_UPSTREAM=""
LEGACY_ROOT_PM2_ORIGINAL_ACTIVE=""
LEGACY_ROOT_PM2_ORIGINAL_ENABLED=""
declare -a LEGACY_ROOT_PM2_PIDS=()

cd "$APP_DIR"

if [ "$APP_DIR" != "$EXPECTED_APP_DIR" ]; then
  echo "This reviewed nginx policy serves uploads from $EXPECTED_APP_DIR."
  echo "Refusing a mismatched checkout path: $APP_DIR"
  exit 1
fi

if [ -e "$ARTIFACT_TRANSACTION_MARKER" ] || [ -L "$ARTIFACT_TRANSACTION_MARKER" ]; then
  # A previous process may have died after the first nginx/runtime mutation but
  # before it committed the release. Re-arm the server-side gate before refusing
  # the ambiguous transaction so a rerun always fails closed.
  install -m 644 /dev/null "$MAINTENANCE_MARKER"
  echo "An interrupted deployment transaction marker exists: $ARTIFACT_TRANSACTION_MARKER"
  echo "Maintenance was re-armed. Reconcile the recorded nginx/runtime/database/artifact phase before rerunning."
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════"
echo "   Pattani FC — Deploy Script"
echo "   App dir: $APP_DIR"
echo "   Domain:  $DOMAIN"
echo "════════════════════════════════════════════════"

# ────────────────────────────────────────────────
# Preflight
# ────────────────────────────────────────────────
for cmd in node npm pm2 nginx psql pg_dump pg_restore git openssl printf curl env useradd groupadd usermod runuser date systemctl realpath readlink mktemp tar awk getent find flock ps pkill xargs install stat ss cp mv ln unlink chmod chown grep sed head tail sort sleep; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ Missing tool: $cmd — run Phase 1 install first"
    exit 1
  fi
done
echo "✓ All required tools present"

for isolated_cmd in node npm pm2 bash tar; do
  if ! env -i PATH="$SAFE_SYSTEM_PATH" /bin/sh -c 'command -v "$1" >/dev/null 2>&1' pattani-preflight "$isolated_cmd"; then
    echo "$isolated_cmd is not installed in the sanitized system PATH."
    echo "Install it system-wide; setup will not inherit root shell/nvm paths."
    exit 1
  fi
done

install -d -m 755 /run/lock
exec 9>/run/lock/pattani-fc-deploy.lock
if ! flock -n 9; then
  echo "Another Pattani FC deployment is already running."
  exit 1
fi

# Build and run application code as an unprivileged account. Root is kept only
# for OS/Postgres/nginx operations performed by this setup script.
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$SERVICE_HOME" --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$SERVICE_HOME"
if ! id -u "$BUILD_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$BUILD_HOME" --create-home --shell /usr/sbin/nologin "$BUILD_USER"
fi
install -d -m 700 -o "$BUILD_USER" -g "$BUILD_USER" "$BUILD_HOME"
if ! getent group "$BUILD_READ_GROUP" >/dev/null 2>&1; then
  groupadd --system "$BUILD_READ_GROUP"
fi
usermod -a -G "$BUILD_READ_GROUP" "$BUILD_USER"
chown "$BUILD_USER:$BUILD_READ_GROUP" "$BUILD_HOME"
chmod 710 "$BUILD_HOME"
if ! id -u "$MIGRATE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$MIGRATE_HOME" --create-home --shell /usr/sbin/nologin "$MIGRATE_USER"
fi
install -d -m 700 -o "$MIGRATE_USER" -g "$MIGRATE_USER" "$MIGRATE_HOME"
usermod -a -G "$BUILD_READ_GROUP" "$MIGRATE_USER"
# These are dedicated, non-interactive accounts. Kill a lifecycle process left
# behind by an interrupted/hostile dependency before preparing a new release.
pkill -KILL -u "$BUILD_USER" 2>/dev/null || true
pkill -KILL -u "$MIGRATE_USER" 2>/dev/null || true

run_as_app() {
  runuser -u "$SERVICE_USER" -- env -i \
    HOME="$SERVICE_HOME" \
    PM2_HOME="$SERVICE_HOME/.pm2" \
    USER="$SERVICE_USER" \
    LOGNAME="$SERVICE_USER" \
    LANG="C.UTF-8" \
    LC_ALL="C.UTF-8" \
    PATH="$SAFE_SYSTEM_PATH" \
    "$@"
}

run_as_build() {
  runuser -u "$BUILD_USER" -- env -i \
    HOME="$BUILD_HOME" \
    USER="$BUILD_USER" \
    LOGNAME="$BUILD_USER" \
    LANG="C.UTF-8" \
    LC_ALL="C.UTF-8" \
    PATH="$SAFE_SYSTEM_PATH" \
    "$@"
}

run_as_migrate() {
  runuser -u "$MIGRATE_USER" -- env -i \
    HOME="$MIGRATE_HOME" \
    USER="$MIGRATE_USER" \
    LOGNAME="$MIGRATE_USER" \
    LANG="C.UTF-8" \
    LC_ALL="C.UTF-8" \
    PATH="$SAFE_SYSTEM_PATH" \
    "$@"
}

assert_runtime_processes_frozen() {
  local service_pids port_listener
  service_pids=$(ps -u "$SERVICE_USER" -o pid= 2>/dev/null | xargs || true)
  port_listener=$(ss -H -ltn 'sport = :3000' || true)
  if [ -n "$service_pids" ] || [ -n "$port_listener" ]; then
    echo "Runtime writer guard failed: service_pids=${service_pids:-none} port_3000=$([ -n "$port_listener" ] && echo listening || echo closed)"
    return 1
  fi
}

freeze_runtime_processes() {
  # Stop and runtime-mask the only reviewed supervisor before killing every
  # process owned by the dedicated service account. The root deploy process and
  # the separate build/migration accounts are outside this UID.
  if systemctl cat "$PM2_SYSTEMD_UNIT" >/dev/null 2>&1; then
    systemctl stop "$PM2_SYSTEMD_UNIT" >/dev/null 2>&1 || return 1
    systemctl mask --runtime "$PM2_SYSTEMD_UNIT" >/dev/null 2>&1 || return 1
  fi
  pkill -TERM -u "$SERVICE_USER" 2>/dev/null || true
  for stop_attempt in 1 2 3 4 5; do
    if ! ps -u "$SERVICE_USER" -o pid= 2>/dev/null | grep -q '[0-9]'; then
      break
    fi
    sleep 1
  done
  pkill -KILL -u "$SERVICE_USER" 2>/dev/null || true
  sleep 1
  assert_runtime_processes_frozen || return 1
  RUNTIME_PROCESS_GUARD_ACTIVE=1
}

unfreeze_runtime_processes() {
  # Removing a runtime mask is harmless when the unit did not exist. Do not
  # remove a persistent operator mask from /etc.
  systemctl unmask --runtime "$PM2_SYSTEMD_UNIT" >/dev/null 2>&1 || true
  systemctl daemon-reload >/dev/null 2>&1 || true
  RUNTIME_PROCESS_GUARD_ACTIVE=0
}

assert_no_runtime_database_sessions() {
  local runtime_sessions
  runtime_sessions=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
    "SELECT count(*) FROM pg_stat_activity
      WHERE datname = 'pattani_ticket'
        AND usename = 'pattani'
        AND backend_type = 'client backend';")
  if [ "${runtime_sessions//[[:space:]]/}" != "0" ]; then
    echo "Runtime database sessions remain while the application is frozen ($runtime_sessions)."
    return 1
  fi
}

activate_runtime_database_credential_guard() {
  # The live .env keeps the stable password, while migration commands receive a
  # random cutover credential explicitly. A killed/orphan runtime process can no
  # longer reconnect even if an unrelated supervisor tries to respawn it.
  CUTOVER_DB_PASSWORD=$(openssl rand -hex 24)
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d postgres <<SQL >/dev/null
ALTER ROLE pattani WITH LOGIN PASSWORD '${CUTOVER_DB_PASSWORD}';
SQL
  MIGRATION_DATABASE_URL="postgresql://pattani:${CUTOVER_DB_PASSWORD}@localhost:5432/pattani_ticket?schema=public"
  RUNTIME_DB_CREDENTIAL_GUARD_ACTIVE=1
  assert_no_runtime_database_sessions
}

restore_runtime_database_credential() {
  if [ "$RUNTIME_DB_CREDENTIAL_GUARD_ACTIVE" != "1" ]; then
    return 0
  fi
  # DB_PASSWORD is required to be hexadecimal before this helper can run, so it
  # is safe in this single-quoted PostgreSQL literal.
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d postgres <<SQL >/dev/null
ALTER ROLE pattani WITH LOGIN PASSWORD '${DB_PASSWORD}';
SQL
  RUNTIME_DB_CREDENTIAL_GUARD_ACTIVE=0
  CUTOVER_DB_PASSWORD=""
  MIGRATION_DATABASE_URL=""
}

wait_for_runtime_database_sessions_to_close() {
  local close_attempt runtime_sessions
  for close_attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    runtime_sessions=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
      "SELECT count(*) FROM pg_stat_activity
        WHERE datname = 'pattani_ticket'
          AND usename = 'pattani'
          AND backend_type = 'client backend';")
    if [ "${runtime_sessions//[[:space:]]/}" = "0" ]; then
      return 0
    fi
    sleep 1
  done
  echo "Runtime database sessions did not drain after the application stop ($runtime_sessions)."
  return 1
}

capture_legacy_root_runtime() {
  local root_pm2_pid legacy_report legacy_port pid pid_owner pid_cwd
  local -a legacy_ports=()

  if [ "$LEGACY_ROOT_PM2_STOP_ARMED" = "1" ]; then
    echo "Refusing to recapture legacy PM2 state after its stop transaction was armed."
    return 1
  fi
  LEGACY_ROOT_PM2_CAPTURED=0
  LEGACY_ROOT_PM2_APP=""
  LEGACY_ROOT_PM2_CWD=""
  LEGACY_ROOT_PM2_UPSTREAM=""
  LEGACY_ROOT_PM2_PIDS=()

  LEGACY_ROOT_PM2_ORIGINAL_ACTIVE=$(systemctl is-active "$LEGACY_ROOT_PM2_UNIT" 2>/dev/null || true)
  LEGACY_ROOT_PM2_ORIGINAL_ENABLED=$(systemctl is-enabled "$LEGACY_ROOT_PM2_UNIT" 2>/dev/null || true)

  if [ "$LEGACY_ROOT_PM2_ORIGINAL_ACTIVE" != "active" ]; then
    # Never invoke the root PM2 CLI when its reviewed systemd unit is down: doing
    # so would create a new root daemon. A manually launched daemon is ambiguous
    # and must be reconciled outside this deployment.
    if [ -s /root/.pm2/pm2.pid ]; then
      root_pm2_pid=$(head -1 /root/.pm2/pm2.pid)
      if [[ "$root_pm2_pid" =~ ^[0-9]+$ ]] && kill -0 "$root_pm2_pid" 2>/dev/null; then
        echo "A root PM2 daemon is running outside the active $LEGACY_ROOT_PM2_UNIT unit."
        echo "Refusing an untracked legacy-runtime migration."
        return 1
      fi
    fi
    return 0
  fi

  if [ "$LEGACY_ROOT_PM2_ORIGINAL_ENABLED" != "enabled" ]; then
    echo "$LEGACY_ROOT_PM2_UNIT is active but not enabled; its reboot/rollback state is ambiguous."
    return 1
  fi

  # The root supervisor may be stopped as a unit only when every PM2 entry is a
  # known Pattani release. This prevents an automated migration from affecting
  # an unrelated application sharing root's PM2_HOME.
  legacy_report=$(pm2 jlist | APP_DIR="$APP_DIR" node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const list = JSON.parse(input);
  const releasesRoot = "/var/www/pattani-fc-releases/";
  const apps = new Map();
  for (const entry of list) {
    const name = String(entry.name ?? "");
    const cwd = String(entry.pm2_env?.pm_cwd ?? "");
    const status = String(entry.pm2_env?.status ?? "");
    const match = /^pattani-fc(?:-([0-9a-f]{7,40}))?$/.exec(name);
    if (!match) {
      process.stderr.write(`Unrelated root PM2 entry prevents automatic migration: ${name}\n`);
      process.exit(20);
    }
    const expectedCwd = match[1] ? `${releasesRoot}${match[1]}` : process.env.APP_DIR;
    if (cwd !== expectedCwd) {
      process.stderr.write(`Unexpected cwd for legacy PM2 entry ${name}: ${cwd}\n`);
      process.exit(21);
    }
    const current = apps.get(name) ?? { cwd, online: false };
    if (current.cwd !== cwd) {
      process.stderr.write(`Inconsistent cwd for clustered PM2 entry ${name}\n`);
      process.exit(22);
    }
    if (status === "online") current.online = true;
    apps.set(name, current);
  }
  const online = [...apps.entries()].filter(([, value]) => value.online);
  if (online.length > 1) {
    process.stderr.write("More than one legacy Pattani release is online under root PM2.\n");
    process.exit(23);
  }
  if (online.length === 1) {
    process.stdout.write(`${online[0][0]}|${online[0][1].cwd}`);
  }
});') || return 1

  if [ -L /root/.pm2/dump.pm2 ]; then
    echo "Refusing a symlinked root PM2 dump."
    return 1
  fi
  if [ -f /root/.pm2/dump.pm2 ]; then
    LEGACY_REPORT="$legacy_report" APP_DIR="$APP_DIR" node -e '
const fs = require("fs");
const list = JSON.parse(fs.readFileSync("/root/.pm2/dump.pm2", "utf8"));
const releasesRoot = "/var/www/pattani-fc-releases/";
const online = new Map();
for (const entry of list) {
  const name = String(entry.name ?? "");
  const cwd = String(entry.pm_cwd ?? entry.pm2_env?.pm_cwd ?? "");
  const status = String(entry.status ?? entry.pm2_env?.status ?? "");
  const match = /^pattani-fc(?:-([0-9a-f]{7,40}))?$/.exec(name);
  if (!match) {
    process.stderr.write(`Unrelated root PM2 dump entry prevents automatic migration: ${name}\n`);
    process.exit(24);
  }
  const expectedCwd = match[1] ? `${releasesRoot}${match[1]}` : process.env.APP_DIR;
  if (cwd !== expectedCwd) {
    process.stderr.write(`Unexpected cwd in root PM2 dump for ${name}: ${cwd}\n`);
    process.exit(25);
  }
  if (status === "online") online.set(name, cwd);
}
const expected = process.env.LEGACY_REPORT;
const saved = [...online.entries()].map(([name, cwd]) => `${name}|${cwd}`);
if ((expected === "" && saved.length !== 0) ||
    (expected !== "" && (saved.length !== 1 || saved[0] !== expected))) {
  process.stderr.write("Live root PM2 state does not match its saved rollback dump.\n");
  process.exit(26);
}' || return 1
  elif [ -n "$legacy_report" ]; then
    echo "The active legacy PM2 release has no saved dump for rollback."
    return 1
  fi

  if [ -z "$legacy_report" ]; then
    return 0
  fi
  IFS='|' read -r LEGACY_ROOT_PM2_APP LEGACY_ROOT_PM2_CWD <<< "$legacy_report"
  if [ -z "$LEGACY_ROOT_PM2_APP" ] || [ -z "$LEGACY_ROOT_PM2_CWD" ]; then
    echo "Could not capture the active legacy PM2 release."
    return 1
  fi

  mapfile -t LEGACY_ROOT_PM2_PIDS < <(pm2 pid "$LEGACY_ROOT_PM2_APP" | grep -E '^[0-9]+$' | grep -v '^0$')
  if [ "${#LEGACY_ROOT_PM2_PIDS[@]}" -lt 1 ]; then
    echo "The active legacy PM2 release has no verifiable worker PID."
    return 1
  fi
  for pid in "${LEGACY_ROOT_PM2_PIDS[@]}"; do
    pid_owner=$(ps -o user= -p "$pid" | xargs)
    pid_cwd=$(realpath -e "/proc/$pid/cwd" 2>/dev/null || true)
    if [ "$pid_owner" != "root" ] || [ "$pid_cwd" != "$LEGACY_ROOT_PM2_CWD" ]; then
      echo "Legacy PM2 worker $pid is not the reviewed root-owned release."
      return 1
    fi
  done

  if [ ! -f "$NGINX_ENABLED" ] && [ ! -L "$NGINX_ENABLED" ]; then
    echo "Cannot derive the legacy upstream from $NGINX_ENABLED."
    return 1
  fi
  mapfile -t legacy_ports < <(grep -Eo 'proxy_pass[[:space:]]+http://(localhost|127\.0\.0\.1):[0-9]+' "$NGINX_ENABLED" \
    | sed -E 's#.*:([0-9]+)$#\1#' | sort -u)
  if [ "${#legacy_ports[@]}" -ne 1 ]; then
    echo "Expected exactly one loopback upstream in the legacy nginx site; found ${#legacy_ports[@]}."
    return 1
  fi
  legacy_port="${legacy_ports[0]}"
  if ! [[ "$legacy_port" =~ ^[0-9]+$ ]] || [ "$legacy_port" -lt 1024 ] || [ "$legacy_port" -gt 65535 ]; then
    echo "Unsafe legacy upstream port: $legacy_port"
    return 1
  fi
  LEGACY_ROOT_PM2_UPSTREAM="http://127.0.0.1:${legacy_port}"
  if ! curl --noproxy '*' --fail --silent --output /dev/null --max-time 10 \
      "$LEGACY_ROOT_PM2_UPSTREAM/"; then
    echo "The captured legacy PM2/nginx upstream is not healthy: $LEGACY_ROOT_PM2_UPSTREAM"
    return 1
  fi

  LEGACY_ROOT_PM2_CAPTURED=1
  echo "Captured legacy root PM2 release $LEGACY_ROOT_PM2_APP for guarded migration."
}

stop_legacy_root_runtime() {
  local pid
  if [ "$LEGACY_ROOT_PM2_CAPTURED" != "1" ]; then
    return 0
  fi

  # Arm rollback before the first supervisor mutation. The saved PM2 dump is not
  # rewritten, so a pre-database rollback can resurrect the exact old release.
  LEGACY_ROOT_PM2_STOP_ARMED=1
  printf 'phase=legacy-writer-stop\nnginx_snapshot=%s\nlegacy_app=%s\nlegacy_cwd=%s\nlegacy_upstream=%s\n' \
    "$NGINX_SNAPSHOT_DIR" "$LEGACY_ROOT_PM2_APP" "$LEGACY_ROOT_PM2_CWD" \
    "$LEGACY_ROOT_PM2_UPSTREAM" > "$ARTIFACT_TRANSACTION_MARKER"
  systemctl mask --runtime "$LEGACY_ROOT_PM2_UNIT" >/dev/null
  systemctl stop "$LEGACY_ROOT_PM2_UNIT"
  if systemctl is-active --quiet "$LEGACY_ROOT_PM2_UNIT"; then
    echo "Legacy root PM2 systemd unit did not stop."
    return 1
  fi
  for pid in "${LEGACY_ROOT_PM2_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Legacy PM2 worker remains alive after systemd stop: $pid"
      return 1
    fi
  done
  if curl --noproxy '*' --fail --silent --output /dev/null --max-time 3 \
      "$LEGACY_ROOT_PM2_UPSTREAM/"; then
    echo "Legacy upstream still responds after its reviewed supervisor stopped."
    return 1
  fi
  wait_for_runtime_database_sessions_to_close
}

restore_legacy_root_runtime() {
  local recovery_attempt
  if [ "$LEGACY_ROOT_PM2_STOP_ARMED" != "1" ] || [ "$LEGACY_ROOT_PM2_RETIRED" = "1" ]; then
    return 1
  fi
  systemctl unmask --runtime "$LEGACY_ROOT_PM2_UNIT" >/dev/null 2>&1 || return 1
  if [ "$LEGACY_ROOT_PM2_ORIGINAL_ENABLED" = "enabled" ]; then
    systemctl enable "$LEGACY_ROOT_PM2_UNIT" >/dev/null 2>&1 || return 1
  fi
  if [ "$LEGACY_ROOT_PM2_ORIGINAL_ACTIVE" = "active" ]; then
    systemctl start "$LEGACY_ROOT_PM2_UNIT" >/dev/null 2>&1 || return 1
  fi
  for recovery_attempt in 1 2 3 4 5 6 7 8 9 10; do
    if systemctl is-active --quiet "$LEGACY_ROOT_PM2_UNIT" && \
      curl --noproxy '*' --fail --silent --output /dev/null --max-time 5 \
        "$LEGACY_ROOT_PM2_UPSTREAM/"; then
      LEGACY_ROOT_PM2_STOP_ARMED=0
      return 0
    fi
    sleep 2
  done
  return 1
}

hold_legacy_root_runtime_fail_closed() {
  if [ "$LEGACY_ROOT_PM2_CAPTURED" != "1" ]; then
    return 0
  fi
  systemctl stop "$LEGACY_ROOT_PM2_UNIT" >/dev/null 2>&1 || true
  systemctl mask --runtime "$LEGACY_ROOT_PM2_UNIT" >/dev/null 2>&1 || true
  if systemctl is-active --quiet "$LEGACY_ROOT_PM2_UNIT"; then
    return 1
  fi
}

retire_legacy_root_runtime() {
  local enabled_state
  if [ "$LEGACY_ROOT_PM2_CAPTURED" != "1" ]; then
    return 0
  fi
  if systemctl is-active --quiet "$LEGACY_ROOT_PM2_UNIT"; then
    echo "Refusing to retire an active legacy root PM2 service."
    return 1
  fi
  # Disable the old root supervisor before removing its temporary mask. Its PM2
  # dump is retained as recovery evidence, but it cannot resurrect on reboot.
  systemctl disable "$LEGACY_ROOT_PM2_UNIT" >/dev/null 2>&1 || return 1
  systemctl unmask --runtime "$LEGACY_ROOT_PM2_UNIT" >/dev/null 2>&1 || return 1
  enabled_state=$(systemctl is-enabled "$LEGACY_ROOT_PM2_UNIT" 2>/dev/null || true)
  if [ "$enabled_state" = "enabled" ] || systemctl is-active --quiet "$LEGACY_ROOT_PM2_UNIT"; then
    echo "Legacy root PM2 service was not retired cleanly."
    return 1
  fi
  LEGACY_ROOT_PM2_RETIRED=1
  LEGACY_ROOT_PM2_STOP_ARMED=0
}

activate_maintenance_marker() {
  install -m 644 /dev/null "$MAINTENANCE_MARKER"
  MAINTENANCE_MARKER_ACTIVE=1
}

deactivate_maintenance_marker() {
  if [ -f "$MAINTENANCE_MARKER" ]; then
    unlink "$MAINTENANCE_MARKER"
  fi
  MAINTENANCE_MARKER_ACTIVE=0
}

fail_closed_after_database_change() {
  activate_maintenance_marker
  echo "$1"
  echo "The site remains in maintenance mode for operator review."
  exit 1
}

capture_nginx_topology() {
  if [ -n "$NGINX_SNAPSHOT_DIR" ]; then
    return 0
  fi

  install -d -m 700 /var/backups/pattani-fc-nginx
  NGINX_SNAPSHOT_DIR=$(mktemp -d /var/backups/pattani-fc-nginx/topology.XXXXXX)
  chmod 700 "$NGINX_SNAPSHOT_DIR"

  if [ -L "$NGINX_SITE" ]; then
    echo "Refusing to replace a symlinked nginx site file: $NGINX_SITE"
    exit 1
  elif [ -f "$NGINX_SITE" ]; then
    NGINX_SITE_STATE="file"
    cp -a "$NGINX_SITE" "$NGINX_SNAPSHOT_DIR/site"
  elif [ -e "$NGINX_SITE" ]; then
    echo "Unexpected nginx site path type: $NGINX_SITE"
    exit 1
  else
    NGINX_SITE_STATE="absent"
  fi

  if [ -L "$NGINX_ENABLED" ]; then
    NGINX_ENABLED_STATE="symlink"
    NGINX_ENABLED_TARGET=$(readlink "$NGINX_ENABLED")
  elif [ -f "$NGINX_ENABLED" ]; then
    NGINX_ENABLED_STATE="file"
    cp -a "$NGINX_ENABLED" "$NGINX_SNAPSHOT_DIR/enabled"
  elif [ -e "$NGINX_ENABLED" ]; then
    echo "Unexpected nginx enabled-site path type: $NGINX_ENABLED"
    exit 1
  else
    NGINX_ENABLED_STATE="absent"
  fi

  # Older release automation left full backup configs enabled beside the live
  # site. Snapshot only the narrowly named legacy files; any other sibling is
  # ambiguous and must be reviewed manually rather than silently removed.
  install -d -m 700 "$NGINX_SNAPSHOT_DIR/legacy-enabled"
  local legacy_path legacy_name
  for legacy_path in /etc/nginx/sites-enabled/pattanifc.co.*; do
    if [ ! -e "$legacy_path" ] && [ ! -L "$legacy_path" ]; then
      continue
    fi
    legacy_name="${legacy_path##*/}"
    if [[ ! "$legacy_name" =~ ^pattanifc\.co\.pre-[A-Za-z0-9._-]+$ ]]; then
      echo "Unexpected Pattani nginx sibling requires manual review: $legacy_path"
      exit 1
    fi
    if [ ! -f "$legacy_path" ] && [ ! -L "$legacy_path" ]; then
      echo "Unsupported legacy nginx path type: $legacy_path"
      exit 1
    fi
    cp -a "$legacy_path" "$NGINX_SNAPSHOT_DIR/legacy-enabled/$legacy_name"
    NGINX_LEGACY_ENABLED_NAMES+=("$legacy_name")
  done
}

rollback_nginx_policy() {
  if [ "$NGINX_POLICY_CHANGED" != "1" ] || [ -z "$NGINX_SNAPSHOT_DIR" ]; then
    return 0
  fi

  if [ -L "$NGINX_ENABLED" ] || [ -f "$NGINX_ENABLED" ]; then
    unlink "$NGINX_ENABLED"
  fi
  case "$NGINX_ENABLED_STATE" in
    symlink) ln -s "$NGINX_ENABLED_TARGET" "$NGINX_ENABLED" ;;
    file) cp -a "$NGINX_SNAPSHOT_DIR/enabled" "$NGINX_ENABLED" ;;
    absent) ;;
    *) echo "Cannot restore unknown nginx enabled-site topology."; return 1 ;;
  esac

  if [ -L "$NGINX_SITE" ] || [ -f "$NGINX_SITE" ]; then
    unlink "$NGINX_SITE"
  fi
  case "$NGINX_SITE_STATE" in
    file) cp -a "$NGINX_SNAPSHOT_DIR/site" "$NGINX_SITE" ;;
    absent) ;;
    *) echo "Cannot restore unknown nginx site topology."; return 1 ;;
  esac

  local legacy_name legacy_path
  for legacy_name in "${NGINX_LEGACY_ENABLED_NAMES[@]}"; do
    legacy_path="/etc/nginx/sites-enabled/$legacy_name"
    if [ -e "$legacy_path" ] || [ -L "$legacy_path" ]; then
      unlink "$legacy_path" || return 1
    fi
    cp -a "$NGINX_SNAPSHOT_DIR/legacy-enabled/$legacy_name" "$legacy_path" || return 1
  done

  # Keep the marker armed until both the restored topology and the replacement
  # workers are verified. If either operation fails, the currently running
  # reviewed policy continues to fail closed instead of exposing a partial
  # rollback.
  if ! nginx -t >/dev/null 2>&1; then
    activate_maintenance_marker
    echo "Restored nginx topology failed validation; maintenance remains active."
    return 1
  fi
  if ! systemctl restart nginx >/dev/null 2>&1; then
    activate_maintenance_marker
    echo "Restored nginx topology failed to restart; maintenance remains active."
    return 1
  fi
  if ! systemctl is-active --quiet nginx; then
    activate_maintenance_marker
    echo "Restored nginx service is not active; maintenance remains active."
    return 1
  fi
  if [ "$DATABASE_CHANGE_STARTED" = "0" ] && [ "$ARTIFACT_SWAP_STARTED" = "0" ]; then
    if [ -L "$ARTIFACT_TRANSACTION_MARKER" ]; then
      activate_maintenance_marker
      echo "Refusing to clear a symlinked deployment transaction marker."
      return 1
    fi
    if [ -f "$ARTIFACT_TRANSACTION_MARKER" ]; then
      unlink "$ARTIFACT_TRANSACTION_MARKER" || return 1
    fi
  fi
  deactivate_maintenance_marker
  NGINX_POLICY_CHANGED=0
}

deployment_cleanup() {
  local status=$?
  trap - EXIT

  if [ "$DEPLOY_SUCCESS" != "1" ] && [ "$ARTIFACT_SWAP_STARTED" = "1" ] && [ -n "$ARTIFACT_BACKUP_DIR" ]; then
    local failed_dir="$ARTIFACT_BACKUP_DIR/failed-new-release"
    local artifact_rollback_ok=1
    install -d -m 700 "$failed_dir"
    for artifact_name in node_modules .next; do
      local old_present=0
      local swap_armed=0
      case "$artifact_name" in
        node_modules)
          old_present="$NODE_MODULES_OLD_PRESENT"
          swap_armed="$NODE_MODULES_SWAP_ARMED"
          ;;
        .next)
          old_present="$NEXT_OLD_PRESENT"
          swap_armed="$NEXT_SWAP_ARMED"
          ;;
      esac

      if [ "$swap_armed" = "1" ] && [ "$old_present" = "1" ] && \
        [ -e "$ARTIFACT_BACKUP_DIR/$artifact_name" ] && [ ! -L "$ARTIFACT_BACKUP_DIR/$artifact_name" ]; then
        if [ -e "$APP_DIR/$artifact_name" ] && [ ! -L "$APP_DIR/$artifact_name" ]; then
          if ! mv "$APP_DIR/$artifact_name" "$failed_dir/$artifact_name" 2>/dev/null; then
            artifact_rollback_ok=0
          fi
        fi
        if ! mv "$ARTIFACT_BACKUP_DIR/$artifact_name" "$APP_DIR/$artifact_name" 2>/dev/null; then
          artifact_rollback_ok=0
        fi
      elif [ "$swap_armed" = "1" ] && [ "$old_present" = "0" ] && \
        [ -e "$APP_DIR/$artifact_name" ] && [ ! -e "$ARTIFACT_STAGE_DIR/$artifact_name" ]; then
        if ! mv "$APP_DIR/$artifact_name" "$failed_dir/$artifact_name" 2>/dev/null; then
          artifact_rollback_ok=0
        fi
      fi
      if [ -e "$APP_DIR/$artifact_name" ] && [ ! -L "$APP_DIR/$artifact_name" ]; then
        chown -R -P root:"$SERVICE_USER" "$APP_DIR/$artifact_name" 2>/dev/null || true
        chmod -R u=rwX,g=rX,o= "$APP_DIR/$artifact_name" 2>/dev/null || true
      fi
    done
    if [ "$NODE_MODULES_OLD_PRESENT" = "1" ]; then
      if [ ! -d "$APP_DIR/node_modules" ] || [ -e "$ARTIFACT_BACKUP_DIR/node_modules" ]; then
        artifact_rollback_ok=0
      fi
    elif [ -e "$APP_DIR/node_modules" ]; then
      artifact_rollback_ok=0
    fi
    if [ "$NEXT_OLD_PRESENT" = "1" ]; then
      if [ ! -d "$APP_DIR/.next" ] || [ -e "$ARTIFACT_BACKUP_DIR/.next" ]; then
        artifact_rollback_ok=0
      fi
    elif [ -e "$APP_DIR/.next" ]; then
      artifact_rollback_ok=0
    fi
    if [ "$artifact_rollback_ok" = "1" ] && [ "$DATABASE_CHANGE_STARTED" = "0" ] && \
      [ -f "$ARTIFACT_TRANSACTION_MARKER" ]; then
      unlink "$ARTIFACT_TRANSACTION_MARKER" || artifact_rollback_ok=0
    fi
    if [ "$artifact_rollback_ok" != "1" ]; then
      echo "Artifact rollback was incomplete; keep maintenance active and inspect $ARTIFACT_TRANSACTION_MARKER."
    fi
    if [ -d "$APP_DIR/.next/cache" ]; then
      chown -R -P "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.next/cache" 2>/dev/null || true
    fi
  fi

  if [ "$DEPLOY_SUCCESS" != "1" ] && [ "$DATABASE_CHANGE_STARTED" = "1" ]; then
    activate_maintenance_marker
    pkill -KILL -u "$MIGRATE_USER" 2>/dev/null || true
    if ! hold_legacy_root_runtime_fail_closed; then
      echo "WARNING: could not keep the legacy root PM2 unit stopped; inspect it before database recovery."
    fi
    if ! freeze_runtime_processes; then
      echo "WARNING: could not fully freeze the runtime service account; inspect it before database recovery."
    fi
    if [ "$RUNTIME_DB_CREDENTIAL_GUARD_ACTIVE" != "1" ]; then
      if wait_for_runtime_database_sessions_to_close && activate_runtime_database_credential_guard; then
        echo "The stable runtime database password was disabled again after the failed cutover."
      else
        echo "WARNING: could not disable the stable runtime database credential after failure."
      fi
    fi
    echo "Database changes started; the site remains in maintenance mode."
    if [ "$RUNTIME_DB_CREDENTIAL_GUARD_ACTIVE" = "1" ]; then
      echo "The stable runtime database password is still disabled; restore it from the root secret only after recovery review."
    fi
    echo "Review the migration state and root-only backup before any manual recovery: ${BACKUP_FILE:-unknown}"
  elif [ "$DEPLOY_SUCCESS" != "1" ] && [ "$MAINTENANCE_ACTIVE" = "1" ]; then
    local runtime_credential_ready=1
    local old_release_healthy=0
    if ! restore_runtime_database_credential; then
      runtime_credential_ready=0
      activate_maintenance_marker
      echo "Could not restore the stable database credential; runtime remains frozen in maintenance."
    else
      unfreeze_runtime_processes
      if [ "$LEGACY_ROOT_PM2_STOP_ARMED" = "1" ]; then
        if restore_legacy_root_runtime; then
          old_release_healthy=1
        fi
      else
        run_as_app pm2 restart pattani-fc >/dev/null 2>&1 || \
          run_as_app pm2 start npm --name pattani-fc --cwd "$APP_DIR" -- start >/dev/null 2>&1 || true
        for recovery_attempt in 1 2 3 4 5; do
          if curl --noproxy '*' --fail --silent --output /dev/null --max-time 5 http://127.0.0.1:3000/; then
            old_release_healthy=1
            break
          fi
          sleep 2
        done
      fi
    fi
    if [ "$runtime_credential_ready" = "1" ] && [ "$old_release_healthy" = "1" ]; then
      if rollback_nginx_policy; then
        echo "Deployment failed before database changes; the previous release was restored."
      else
        activate_maintenance_marker
        echo "The previous application recovered, but nginx rollback did not; maintenance remains active."
      fi
    elif [ "$runtime_credential_ready" = "1" ]; then
      activate_maintenance_marker
      echo "The previous release did not recover; the reviewed nginx policy remains in maintenance mode."
    fi
  elif [ "$DEPLOY_SUCCESS" != "1" ] && [ "$NGINX_POLICY_CHANGED" = "1" ]; then
    rollback_nginx_policy || true
  fi

  if [ "$BUILD_DATABASE_CREATED" = "1" ]; then
    pkill -KILL -u "$BUILD_USER" 2>/dev/null || true
    if ! destroy_isolated_build_database; then
      echo "WARNING: isolated build database cleanup failed; its login was left disabled where possible."
    fi
  fi

  if [ -n "$BUILD_WORK" ] && [ -d "$BUILD_WORK" ] && [ ! -L "$BUILD_WORK" ]; then
    local cleanup_real
    cleanup_real=$(realpath -e "$BUILD_WORK" 2>/dev/null || true)
    case "$cleanup_real" in
      "$BUILD_HOME"/build.*) find "$cleanup_real" -xdev -depth -delete 2>/dev/null || true ;;
    esac
  fi

  if [ -n "$ARTIFACT_STAGE_DIR" ] && [ -d "$ARTIFACT_STAGE_DIR" ] && [ ! -L "$ARTIFACT_STAGE_DIR" ]; then
    local stage_real
    stage_real=$(realpath -e "$ARTIFACT_STAGE_DIR" 2>/dev/null || true)
    case "$stage_real" in
      "$(dirname "$APP_DIR")"/.pattani-fc-release-staging/stage.*)
        find "$stage_real" -xdev -depth -delete 2>/dev/null || true
        ;;
    esac
  fi

  if [ -n "$NGINX_CANDIDATE" ] && [ -f "$NGINX_CANDIDATE" ]; then
    case "$NGINX_CANDIDATE" in
      /etc/nginx/sites-available/.pattanifc.co.*) unlink "$NGINX_CANDIDATE" 2>/dev/null || true ;;
    esac
  fi

  exit "$status"
}
trap deployment_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

assert_safe_app_path() {
  local path="$1"
  local resolved parent
  if [ -L "$path" ]; then
    echo "Refusing symlinked deployment path: $path"
    exit 1
  fi
  if [ -e "$path" ]; then
    resolved=$(realpath -e "$path")
  else
    parent=$(realpath -e "$(dirname "$path")")
    resolved="$parent/$(basename "$path")"
  fi
  case "$resolved" in
    "$APP_DIR"|"$APP_DIR"/*) ;;
    *)
      echo "Deployment path escapes APP_DIR: $path -> $resolved"
      exit 1
      ;;
  esac
}

read_env_value() {
  local file="$1"
  local key="$2"
  local line value
  line=$(grep "^${key}=" "$file" | tail -1 || true)
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

read_effective_env_value() {
  local key="$1"
  local value
  # Match Next.js precedence exactly: an explicitly blank value in .env.local
  # overrides .env and must fail the relevant production preflight.
  if [ -f "$APP_DIR/.env.local" ] && grep -q "^${key}=" "$APP_DIR/.env.local"; then
    value=$(read_env_value "$APP_DIR/.env.local" "$key")
  elif [ -f "$APP_DIR/.env" ] && grep -q "^${key}=" "$APP_DIR/.env"; then
    value=$(read_env_value "$APP_DIR/.env" "$key")
  else
    value=""
  fi
  printf '%s' "$value"
}

# Keep the checked-out release immutable to the application/build account.
# Dependency lifecycle scripts run later in a disposable build workspace and
# never receive the live payment/OAuth/SMS environment files.
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo "The production checkout has uncommitted or untracked files."
  echo "Refusing an in-place deploy; commit the reviewed release first."
  exit 1
fi
for protected_path in \
  "$APP_DIR/.git" \
  "$APP_DIR/deploy" \
  "$APP_DIR/src" \
  "$APP_DIR/prisma" \
  "$APP_DIR/public" \
  "$APP_DIR/.env" \
  "$APP_DIR/.env.local" \
  "$APP_DIR/node_modules" \
  "$APP_DIR/.next"; do
  if [ -e "$protected_path" ] || [ -L "$protected_path" ]; then
    assert_safe_app_path "$protected_path"
  fi
done
# Do not recursively change the live release while it is still serving. In
# particular, .next/cache must remain writable by the current application until
# the server-enforced maintenance window has begun. The immutable permissions
# are applied after the old writer has stopped and the artifacts are swapped.
for env_file in "$APP_DIR/.env" "$APP_DIR/.env.local"; do
  if [ -f "$env_file" ]; then
    chown root:"$SERVICE_USER" "$env_file"
    chmod 640 "$env_file"
  fi
done

# CMS uploads need a read-only group shared with nginx, without granting nginx
# access to the runtime service group that can read .env files.
NGINX_USER=$(awk '$1 == "user" { gsub(";", "", $2); print $2; exit }' /etc/nginx/nginx.conf)
NGINX_USER="${NGINX_USER:-www-data}"
if ! id -u "$NGINX_USER" >/dev/null 2>&1; then
  echo "Cannot determine nginx worker user: $NGINX_USER"
  exit 1
fi
if ! getent group "$MEDIA_GROUP" >/dev/null 2>&1; then
  groupadd --system "$MEDIA_GROUP"
fi
usermod -a -G "$MEDIA_GROUP" "$SERVICE_USER"
usermod -a -G "$MEDIA_GROUP" "$NGINX_USER"
if [ -d "$APP_DIR/public/uploads" ]; then
  assert_safe_app_path "$APP_DIR/public/uploads"
  chown -R -P "$SERVICE_USER:$MEDIA_GROUP" "$APP_DIR/public/uploads"
  # Existing nginx workers may not have refreshed supplementary groups yet.
  # Keep current assets readable until the reviewed config is reloaded below.
  find "$APP_DIR/public/uploads" -type d -exec chmod 2755 {} +
  find "$APP_DIR/public/uploads" -type f -exec chmod 0644 {} +
fi

# ────────────────────────────────────────────────
# Phase 2 — Postgres user + secrets
# ────────────────────────────────────────────────
echo ""
echo "── [1/6] PostgreSQL setup ──"

USER_EXISTS=$(runuser -u postgres -- psql -tAc "SELECT usename FROM pg_user WHERE usename='pattani';" | grep -c pattani || true)
DB_EXISTS=$(runuser -u postgres -- psql -tAc "SELECT datname FROM pg_database WHERE datname='pattani_ticket';" | grep -c pattani_ticket || true)
SECRETS_EXISTS=$([ -f /root/.secrets/pattani-fc.env ] && echo 1 || echo 0)

if [ -f "$INSTALL_COMPLETE_MARKER" ]; then
  INITIAL_INSTALL=0
elif [ -f "$INSTALL_IN_PROGRESS_MARKER" ]; then
  INITIAL_INSTALL=1
elif [ "$USER_EXISTS" = "0" ] && [ "$DB_EXISTS" = "0" ] && [ "$SECRETS_EXISTS" = "0" ]; then
  INITIAL_INSTALL=1
  install -d -m 700 /root/.secrets
  install -m 600 /dev/null "$INSTALL_IN_PROGRESS_MARKER"
else
  # A production server installed before phase markers existed must never be
  # mistaken for a fresh machine and bypass maintenance/payment checks.
  INITIAL_INSTALL=0
  echo "Existing installation detected without a completion marker; maintenance checks remain mandatory."
fi

if [ "$USER_EXISTS" = "1" ] && [ "$DB_EXISTS" = "1" ] && [ "$SECRETS_EXISTS" = "1" ]; then
  echo "✓ Postgres user + secrets file already exist — skipping"
  # Idempotent: ensure Payload schema exists even for pre-existing installs
  runuser -u postgres -- psql -d pattani_ticket -c "CREATE SCHEMA IF NOT EXISTS payload AUTHORIZATION pattani;" >/dev/null
else
  if [ "$USER_EXISTS" = "1" ] || [ "$DB_EXISTS" = "1" ] || [ "$SECRETS_EXISTS" = "1" ]; then
    echo "PostgreSQL/secrets state is incomplete. Refusing to delete or recreate production data."
    echo "user=$USER_EXISTS database=$DB_EXISTS secrets=$SECRETS_EXISTS"
    echo "Restore /root/.secrets/pattani-fc.env or recover the database manually, then rerun."
    exit 1
  fi

  FRESH_INSTALL=1
  DB_PASSWORD=$(openssl rand -hex 24)
  SESSION_SECRET=$(openssl rand -base64 32)
  PAYLOAD_SECRET=$(openssl rand -base64 32)
  BOOTSTRAP_ADMIN_PASSWORD=$(openssl rand -hex 12)
  BOOTSTRAP_CMS_PASSWORD=$(openssl rand -hex 16)

  runuser -u postgres -- psql -c "CREATE USER pattani WITH PASSWORD '$DB_PASSWORD';"
  runuser -u postgres -- psql -c "CREATE DATABASE pattani_ticket OWNER pattani;"
  runuser -u postgres -- psql -d pattani_ticket -c "GRANT ALL ON SCHEMA public TO pattani;"
  runuser -u postgres -- psql -d pattani_ticket -c "ALTER SCHEMA public OWNER TO pattani;"
  # Payload CMS uses schemaName: "payload" — schema must exist before push
  runuser -u postgres -- psql -d pattani_ticket -c "CREATE SCHEMA IF NOT EXISTS payload AUTHORIZATION pattani;"

  mkdir -p /root/.secrets && chmod 700 /root/.secrets
  printf 'DB_PASSWORD=%s\nSESSION_SECRET=%s\nPAYLOAD_SECRET=%s\nDATABASE_URL="postgresql://pattani:%s@localhost:5432/pattani_ticket?schema=public"\n' \
    "$DB_PASSWORD" "$SESSION_SECRET" "$PAYLOAD_SECRET" "$DB_PASSWORD" \
    > /root/.secrets/pattani-fc.env
  chmod 600 /root/.secrets/pattani-fc.env

  printf 'SEED_ADMIN_EMAIL=admin@%s\nSEED_ADMIN_PASSWORD=%s\nCMS_SUPER_ADMIN_EMAIL=admin@%s\nCMS_SUPER_ADMIN_PASSWORD=%s\n' \
    "$DOMAIN" "$BOOTSTRAP_ADMIN_PASSWORD" "$DOMAIN" "$BOOTSTRAP_CMS_PASSWORD" \
    > "$BOOTSTRAP_FILE"
  chmod 600 "$BOOTSTRAP_FILE"

  echo "✓ Postgres user + secrets created"
  echo ""
  echo "  ⚠️ IMPORTANT — Backup these secrets to password manager NOW:"
  echo "  ─────────────────────────────────────────────────────"
  echo "  Secrets were written with mode 0600 and were not printed to terminal logs."
  echo "  Copy them from /root/.secrets/ into a password manager."
  echo "  ─────────────────────────────────────────────────────"
  echo ""
fi

# These secrets must remain stable across releases. Add them once for existing
# installations without printing or replacing any existing value.
ensure_master_secret() {
  local key="$1"
  local line value runtime_line runtime_value
  line=$(grep "^${key}=" /root/.secrets/pattani-fc.env | tail -1 || true)
  if [ -z "$line" ]; then
    runtime_line=""
    if [ -f "$APP_DIR/.env.local" ]; then
      runtime_line=$(grep "^${key}=" "$APP_DIR/.env.local" | tail -1 || true)
    fi
    runtime_value="${runtime_line#*=}"
    runtime_value="${runtime_value%\"}"
    runtime_value="${runtime_value#\"}"
    if [ "${#runtime_value}" -ge 32 ]; then
      value="$runtime_value"
    else
      value=$(openssl rand -base64 32)
    fi
    printf '%s=%s\n' "$key" "$value" \
      >> /root/.secrets/pattani-fc.env
    return
  fi
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  if [ "${#value}" -lt 32 ]; then
    echo "$key exists but is blank or shorter than 32 characters. Refusing to rotate it silently."
    echo "Restore a backed-up value or remove the blank placeholder, then rerun setup."
    exit 1
  fi
}
ensure_master_secret "SEASON_GATE_TOKEN_SECRET"
ensure_master_secret "SEASON_BARCODE_ACCESS_SECRET"
ensure_master_secret "RATE_LIMIT_KEY_SECRET"

# Next.js compilation receives a dedicated PostgreSQL login connected only to a
# disposable, empty database. Build dependencies never receive production data
# or the production owner credential.
BUILD_DB_SECRET_LINE=$(grep '^BUILD_DB_PASSWORD=' /root/.secrets/pattani-fc.env | tail -1 || true)
BUILD_DB_PASSWORD="${BUILD_DB_SECRET_LINE#*=}"
BUILD_DB_PASSWORD="${BUILD_DB_PASSWORD%\"}"
BUILD_DB_PASSWORD="${BUILD_DB_PASSWORD#\"}"
if [ -z "$BUILD_DB_SECRET_LINE" ]; then
  BUILD_DB_PASSWORD=$(openssl rand -hex 24)
  printf 'BUILD_DB_PASSWORD=%s\n' "$BUILD_DB_PASSWORD" >> /root/.secrets/pattani-fc.env
elif [[ ! "$BUILD_DB_PASSWORD" =~ ^[A-Fa-f0-9]{48}$ ]]; then
  echo "BUILD_DB_PASSWORD must be exactly 48 hexadecimal characters."
  echo "Restore the backed-up build credential; setup will not rotate it silently."
  exit 1
fi
BUILD_DATABASE_URL="postgresql://pattani_build_ro:${BUILD_DB_PASSWORD}@localhost:5432/${BUILD_DATABASE_NAME}?schema=public"

require_master_secret() {
  local key="$1"
  local line value
  line=$(grep "^${key}=" /root/.secrets/pattani-fc.env | tail -1 || true)
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  if [ -z "$line" ] || [ "${#value}" -lt 32 ] || [[ "$value" == *CHANGE_ME* ]]; then
    echo "$key is missing, a placeholder, or shorter than 32 characters in the root backup."
    echo "Restore the reviewed production secret; setup will not rotate it silently."
    exit 1
  fi
}
require_master_secret "SESSION_SECRET"
require_master_secret "PAYLOAD_SECRET"
require_master_secret "SEASON_GATE_TOKEN_SECRET"
require_master_secret "SEASON_BARCODE_ACCESS_SECRET"
require_master_secret "RATE_LIMIT_KEY_SECRET"
chmod 600 /root/.secrets/pattani-fc.env

destroy_isolated_build_database() {
  local existing_owner
  existing_owner=$(runuser -u postgres -- psql -d postgres -tAc \
    "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '${BUILD_DATABASE_NAME}';")
  existing_owner="${existing_owner//[[:space:]]/}"
  if [ -n "$existing_owner" ] && [ "$existing_owner" != "pattani_build_ro" ]; then
    echo "Refusing to drop build database owned by unexpected role: $existing_owner"
    return 1
  fi
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d postgres <<SQL >/dev/null
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${BUILD_DATABASE_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${BUILD_DATABASE_NAME}";
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pattani_build_ro') THEN
    ALTER ROLE pattani_build_ro WITH NOLOGIN;
  END IF;
END
\$\$;
SQL
  BUILD_DATABASE_CREATED=0
}

configure_isolated_build_database() {
  local existing_owner
  # The generated password is hexadecimal, so it is safe in the single-quoted
  # PostgreSQL literal below. Do not broaden this function to accept arbitrary
  # operator input without changing the quoting strategy.
  existing_owner=$(runuser -u postgres -- psql -d postgres -tAc \
    "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '${BUILD_DATABASE_NAME}';")
  existing_owner="${existing_owner//[[:space:]]/}"
  if [ -n "$existing_owner" ] && [ "$existing_owner" != "pattani_build_ro" ]; then
    echo "Reserved build database is owned by an unexpected role: $existing_owner"
    echo "Refusing to replace a database that setup did not create."
    return 1
  fi
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d postgres <<SQL >/dev/null
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pattani_build_ro') THEN
    CREATE ROLE pattani_build_ro LOGIN;
  END IF;
END
\$\$;
ALTER ROLE pattani_build_ro WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${BUILD_DB_PASSWORD}';
ALTER ROLE pattani_build_ro RESET default_transaction_read_only;
REVOKE ALL PRIVILEGES ON DATABASE pattani_ticket FROM pattani_build_ro;
\connect pattani_ticket
REVOKE CREATE ON SCHEMA public, payload FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public, payload FROM pattani_build_ro;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, payload FROM pattani_build_ro;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, payload FROM pattani_build_ro;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public, payload FROM pattani_build_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE pattani IN SCHEMA public REVOKE ALL ON TABLES FROM pattani_build_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE pattani IN SCHEMA public REVOKE ALL ON SEQUENCES FROM pattani_build_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE pattani IN SCHEMA payload REVOKE ALL ON TABLES FROM pattani_build_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE pattani IN SCHEMA payload REVOKE ALL ON SEQUENCES FROM pattani_build_ro;
\connect postgres
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${BUILD_DATABASE_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${BUILD_DATABASE_NAME}";
CREATE DATABASE "${BUILD_DATABASE_NAME}" OWNER pattani_build_ro TEMPLATE template0;
REVOKE CONNECT, TEMPORARY ON DATABASE "${BUILD_DATABASE_NAME}" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE "${BUILD_DATABASE_NAME}" TO pattani_build_ro;
\connect ${BUILD_DATABASE_NAME}
ALTER SCHEMA public OWNER TO pattani_build_ro;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA payload AUTHORIZATION pattani_build_ro;
SQL
  BUILD_DATABASE_CREATED=1

  BUILD_ROLE_POLICY=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
    "SELECT
      (NOT role.rolsuper AND NOT role.rolcreatedb AND NOT role.rolcreaterole
        AND NOT role.rolinherit AND NOT role.rolreplication AND NOT role.rolbypassrls
        AND role.rolcanlogin
        AND database.datdba <> role.oid
        AND NOT EXISTS (SELECT 1 FROM pg_auth_members membership WHERE membership.member = role.oid)
        AND NOT EXISTS (
          SELECT 1 FROM pg_class class
          JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname IN ('public', 'payload')
            AND class.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND (has_table_privilege('pattani_build_ro', class.oid, 'SELECT')
              OR has_table_privilege('pattani_build_ro', class.oid, 'INSERT')
              OR has_table_privilege('pattani_build_ro', class.oid, 'UPDATE')
              OR has_table_privilege('pattani_build_ro', class.oid, 'DELETE')
              OR has_table_privilege('pattani_build_ro', class.oid, 'TRUNCATE')
              OR has_table_privilege('pattani_build_ro', class.oid, 'TRIGGER'))
        )
        AND NOT EXISTS (
          SELECT 1 FROM pg_class class
          JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
          WHERE namespace.nspname IN ('public', 'payload')
            AND class.relowner = role.oid
        ))
      FROM pg_roles role
      CROSS JOIN pg_database database
      WHERE role.rolname = 'pattani_build_ro' AND database.datname = 'pattani_ticket';")
  if [ "${BUILD_ROLE_POLICY//[[:space:]]/}" != "t" ]; then
    echo "The isolated build role can still read, mutate, inherit, or own production data."
    exit 1
  fi
}

# ────────────────────────────────────────────────
# Install libvips (Sharp dependency)
# ────────────────────────────────────────────────
echo ""
echo "── [2/6] Install libvips-dev ──"
if dpkg -l libvips-dev >/dev/null 2>&1; then
  echo "✓ libvips-dev already installed"
else
  DEBIAN_FRONTEND=noninteractive apt install -y libvips-dev
  echo "✓ libvips-dev installed"
fi

# ────────────────────────────────────────────────
# Create .env.local
# ────────────────────────────────────────────────
echo ""
echo "── [3/6] Create .env.local ──"

source /root/.secrets/pattani-fc.env
# Keep root-backed credentials as shell variables only. Project commands receive
# an explicit, minimal env through run_in_migration/run_in_build.
export -n DB_PASSWORD SESSION_SECRET PAYLOAD_SECRET DATABASE_URL \
  SEASON_GATE_TOKEN_SECRET SEASON_BARCODE_ACCESS_SECRET RATE_LIMIT_KEY_SECRET \
  BUILD_DB_PASSWORD 2>/dev/null || true
if [[ ! "$DB_PASSWORD" =~ ^[A-Fa-f0-9]{48}$ ]]; then
  echo "DB_PASSWORD must be exactly 48 hexadecimal characters for guarded cutover rotation."
  echo "Restore the reviewed root secret; setup will not rewrite production credentials."
  exit 1
fi
CANONICAL_DATABASE_URL="postgresql://pattani:${DB_PASSWORD}@localhost:5432/pattani_ticket?schema=public"
if [ "$DATABASE_URL" != "$CANONICAL_DATABASE_URL" ]; then
  echo "The root-backed DATABASE_URL does not match the reviewed local pattani_ticket target."
  echo "Refusing because backup/preflight commands must operate on the exact runtime database."
  exit 1
fi
if [ -f "$BOOTSTRAP_FILE" ]; then
  # Root-owned recovery material lets an interrupted first install resume
  # idempotently without inventing a new administrator password.
  source "$BOOTSTRAP_FILE"
  export -n SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD CMS_SUPER_ADMIN_EMAIL CMS_SUPER_ADMIN_PASSWORD 2>/dev/null || true
  BOOTSTRAP_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-}"
  BOOTSTRAP_CMS_PASSWORD="${CMS_SUPER_ADMIN_PASSWORD:-}"
fi
if [ -f "$APP_DIR/.env.local" ]; then
  echo "Existing .env.local preserved (payment/OAuth/SMS settings were not overwritten)"
else
  printf 'DATABASE_URL="postgresql://pattani:%s@localhost:5432/pattani_ticket?schema=public"\nSESSION_SECRET="%s"\nPAYLOAD_SECRET="%s"\nPAYLOAD_PUBLIC_SERVER_URL="https://%s"\nPAYLOAD_ALLOW_SCHEMA_PUSH="false"\nSEED_ADMIN_EMAIL="admin@%s"\nCMS_SUPER_ADMIN_EMAIL="admin@%s"\nNODE_ENV="production"\nPORT=3000\n' \
    "$DB_PASSWORD" "$SESSION_SECRET" "$PAYLOAD_SECRET" "$DOMAIN" "$DOMAIN" "$DOMAIN" \
    > "$APP_DIR/.env.local"
  chmod 600 "$APP_DIR/.env.local"
fi

ensure_runtime_secret() {
  local key="$1"
  local value="$2"
  local line current
  line=$(grep "^${key}=" "$APP_DIR/.env.local" | tail -1 || true)
  if [ -z "$line" ]; then
    printf '%s="%s"\n' "$key" "$value" >> "$APP_DIR/.env.local"
    return
  fi
  current="${line#*=}"
  current="${current%\"}"
  current="${current#\"}"
  if [ -z "$current" ]; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$APP_DIR/.env.local"
  elif [ "${#current}" -lt 32 ]; then
    echo "$key in .env.local is shorter than 32 characters. Refusing unsafe startup."
    exit 1
  elif [ "$current" != "$value" ]; then
    echo "$key differs between .env.local and the root backup."
    echo "Refusing to rotate a live credential; reconcile the backed-up value first."
    exit 1
  fi
}
ensure_runtime_secret "SEASON_GATE_TOKEN_SECRET" "$SEASON_GATE_TOKEN_SECRET"
ensure_runtime_secret "SEASON_BARCODE_ACCESS_SECRET" "$SEASON_BARCODE_ACCESS_SECRET"
ensure_runtime_secret "RATE_LIMIT_KEY_SECRET" "$RATE_LIMIT_KEY_SECRET"
ensure_runtime_secret "SESSION_SECRET" "$SESSION_SECRET"
ensure_runtime_secret "PAYLOAD_SECRET" "$PAYLOAD_SECRET"

if grep -q '^PAYLOAD_ALLOW_SCHEMA_PUSH=' "$APP_DIR/.env.local"; then
  sed -i 's/^PAYLOAD_ALLOW_SCHEMA_PUSH=.*/PAYLOAD_ALLOW_SCHEMA_PUSH="false"/' "$APP_DIR/.env.local"
else
  printf 'PAYLOAD_ALLOW_SCHEMA_PUSH="false"\n' >> "$APP_DIR/.env.local"
fi

ensure_runtime_database_url() {
  local line current
  line=$(grep '^DATABASE_URL=' "$APP_DIR/.env.local" | tail -1 || true)
  current="${line#*=}"
  current="${current%\"}"
  current="${current#\"}"
  if [ -z "$line" ]; then
    printf 'DATABASE_URL="%s"\n' "$DATABASE_URL" >> "$APP_DIR/.env.local"
  elif [ "$current" != "$DATABASE_URL" ]; then
    echo "DATABASE_URL in .env.local differs from the root-backed production database."
    echo "Refusing to migrate one database and start the app against another."
    exit 1
  fi
}
ensure_runtime_database_url

LEGACY_SESSION_LINE=$(grep '^LEGACY_SESSION_ACCEPT_UNTIL=' "$APP_DIR/.env.local" | tail -1 || true)
LEGACY_SESSION_VALUE="${LEGACY_SESSION_LINE#*=}"
LEGACY_SESSION_VALUE="${LEGACY_SESSION_VALUE%\"}"
LEGACY_SESSION_VALUE="${LEGACY_SESSION_VALUE#\"}"
if [ -z "$LEGACY_SESSION_VALUE" ]; then
  LEGACY_SESSION_CUTOFF=$(date -u -d '+24 hours' '+%Y-%m-%dT%H:%M:%SZ')
  if grep -q '^LEGACY_SESSION_ACCEPT_UNTIL=' "$APP_DIR/.env.local"; then
    sed -i "s|^LEGACY_SESSION_ACCEPT_UNTIL=.*|LEGACY_SESSION_ACCEPT_UNTIL=\"${LEGACY_SESSION_CUTOFF}\"|" "$APP_DIR/.env.local"
  else
    printf 'LEGACY_SESSION_ACCEPT_UNTIL="%s"\n' "$LEGACY_SESSION_CUTOFF" >> "$APP_DIR/.env.local"
  fi
fi

TURNSTILE_SITE_KEY_VALUE=$(read_effective_env_value "TURNSTILE_SITE_KEY")
TURNSTILE_SECRET_KEY_VALUE=$(read_effective_env_value "TURNSTILE_SECRET_KEY")
if [ -z "$TURNSTILE_SITE_KEY_VALUE" ] || [ -z "$TURNSTILE_SECRET_KEY_VALUE" ]; then
  echo "Production registration requires TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY."
  echo "Add the real Cloudflare Turnstile keys to .env.local, then rerun setup."
  echo "The public registration page will remain closed while either key is missing."
  exit 1
fi

for required_runtime_key in \
  THAIBULKSMS_OTP_KEY \
  THAIBULKSMS_OTP_SECRET \
  BEAM_MERCHANT_ID \
  BEAM_API_KEY \
  BEAM_WEBHOOK_HMAC_KEY; do
  required_runtime_value=$(read_effective_env_value "$required_runtime_key")
  if [ -z "${required_runtime_value//[[:space:]]/}" ] || [[ "$required_runtime_value" == *CHANGE_ME* ]]; then
    echo "$required_runtime_key is required for production OTP registration/recovery and Beam checkout."
    echo "Set the real server-side value in .env.local; setup will not start a partially configured payment/auth flow."
    exit 1
  fi
done

CMS_SUPER_ADMIN_EMAIL_VALUE=$(read_effective_env_value "CMS_SUPER_ADMIN_EMAIL")
if [ -z "$CMS_SUPER_ADMIN_EMAIL_VALUE" ]; then
  echo "CMS_SUPER_ADMIN_EMAIL must identify the reviewed existing CMS administrator."
  echo "Set it explicitly in .env.local; setup will never guess or promote an account."
  exit 1
fi

SHOP_CHECKOUT_VALUE=$(read_effective_env_value "SHOP_CHECKOUT_ENABLED")
if [ "$SHOP_CHECKOUT_VALUE" = "true" ]; then
  echo "SHOP_CHECKOUT_ENABLED must remain false until atomic stock reservation is implemented."
  exit 1
fi
XENDIT_LEGACY_VALUE=$(read_effective_env_value "ENABLE_XENDIT_LEGACY_PAYMENTS")
if [ "$XENDIT_LEGACY_VALUE" = "true" ]; then
  echo "Legacy Xendit payments must remain disabled until target idempotency is verified."
  exit 1
fi

LEGACY_GATE_VALUE=$(read_effective_env_value "SEASON_PASS_ACCEPT_LEGACY_GATE_CODES")
if [ "$INITIAL_INSTALL" = "0" ] && [ "$LEGACY_GATE_VALUE" != "true" ] && [ "$LEGACY_GATE_VALUE" != "false" ]; then
  echo "Set SEASON_PASS_ACCEPT_LEGACY_GATE_CODES explicitly before deployment."
  echo "Use true only for the supervised reissue window; use false only after every old card is replaced."
  exit 1
fi
if [ "$INITIAL_INSTALL" = "1" ] && [ -z "$LEGACY_GATE_VALUE" ]; then
  printf 'SEASON_PASS_ACCEPT_LEGACY_GATE_CODES="false"\n' >> "$APP_DIR/.env.local"
fi

# Prisma CLI reads .env (ไม่ใช่ .env.local) — copy ให้อีกไฟล์
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.local" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi
echo "✓ .env + .env.local written"

# ────────────────────────────────────────────────
# npm install + prisma
# ────────────────────────────────────────────────
echo ""
echo "── [4/6] npm ci (this takes 5-8 minutes) ──"

assert_database_quiet() {
  local counts sale_flags booking_pending season_pending provider_pending review_required invalid_payment_targets
  counts=$(runuser -u postgres -- psql -d pattani_ticket -At -F '|' -c \
    'SELECT
      (SELECT count(*) FROM "TicketPurchaseSetting" WHERE "leagueBookingOpen" = true OR "seasonPassBookingOpen" = true),
      (SELECT count(*) FROM "Booking" WHERE status = '\''PENDING'\''),
      ((SELECT count(*) FROM "SeasonPassPurchase" WHERE status = '\''PENDING'\'')
        + (SELECT count(*) FROM "SeasonPassOrder" WHERE "purchaseId" IS NULL AND status = '\''PENDING'\'')),
      ((SELECT count(*) FROM "BeamPayment" WHERE status IN ('\''INITIATED'\'', '\''PENDING'\''))
        + (SELECT count(*) FROM "XenditPayment" WHERE status = '\''PENDING'\'')),
      ((SELECT count(*) FROM "BeamPayment" WHERE status = '\''REVIEW_REQUIRED'\'')
        + (SELECT count(*) FROM "XenditPayment" WHERE status = '\''REVIEW_REQUIRED'\'')),
      ((SELECT count(*) FROM "BeamPayment"
          WHERE num_nonnulls("bookingId", "seasonPassOrderId", "seasonPassPurchaseId") <> 1)
        + (SELECT count(*) FROM "XenditPayment"
          WHERE num_nonnulls("bookingId", "seasonPassOrderId", "seasonPassPurchaseId") <> 1));')
  IFS='|' read -r sale_flags booking_pending season_pending provider_pending review_required invalid_payment_targets <<< "$counts"
  sale_flags="${sale_flags//[[:space:]]/}"
  booking_pending="${booking_pending//[[:space:]]/}"
  season_pending="${season_pending//[[:space:]]/}"
  provider_pending="${provider_pending//[[:space:]]/}"
  review_required="${review_required//[[:space:]]/}"
  invalid_payment_targets="${invalid_payment_targets//[[:space:]]/}"
  if [ "$sale_flags" != "0" ] || [ "$booking_pending" != "0" ] || \
    [ "$season_pending" != "0" ] || [ "$provider_pending" != "0" ] || \
    [ "$review_required" != "0" ] || [ "$invalid_payment_targets" != "0" ]; then
    echo "Production is not quiet enough for a schema deployment."
    echo "sale_flags=$sale_flags booking_pending=$booking_pending season_pending=$season_pending provider_pending=$provider_pending review_required=$review_required invalid_payment_targets=$invalid_payment_targets"
    echo "Close both sale systems, wait for every pending provider/booking hold, and resolve manual reviews."
    echo "Every payment row must also reference exactly one booking, season order, or season purchase."
    exit 1
  fi
}

install_nginx_maintenance_policy() {
  local maintenance_status
  capture_nginx_topology
  # Persist the rollback coordinates before the first live mutation. A SIGKILL
  # or reboot cannot make the next invocation mistake an interrupted nginx or
  # legacy-runtime cutover for a clean deployment.
  install -m 600 /dev/null "$ARTIFACT_TRANSACTION_MARKER"
  printf 'phase=nginx\nnginx_snapshot=%s\nlegacy_app=%s\nlegacy_cwd=%s\nlegacy_upstream=%s\n' \
    "$NGINX_SNAPSHOT_DIR" "$LEGACY_ROOT_PM2_APP" "$LEGACY_ROOT_PM2_CWD" \
    "$LEGACY_ROOT_PM2_UPSTREAM" > "$ARTIFACT_TRANSACTION_MARKER"
  # Arm rollback before the first live nginx mutation. The marker is evaluated
  # by the reviewed policy on every request, so no application writer is
  # reachable once the new workers are running.
  NGINX_POLICY_CHANGED=1
  NGINX_CANDIDATE=$(mktemp /etc/nginx/sites-available/.pattanifc.co.XXXXXX)
  install -m 644 "$APP_DIR/deploy/nginx.conf" "$NGINX_CANDIDATE"
  activate_maintenance_marker
  local legacy_name legacy_path
  for legacy_name in "${NGINX_LEGACY_ENABLED_NAMES[@]}"; do
    legacy_path="/etc/nginx/sites-enabled/$legacy_name"
    if [ -e "$legacy_path" ] || [ -L "$legacy_path" ]; then
      unlink "$legacy_path"
    fi
  done
  mv "$NGINX_CANDIDATE" "$NGINX_SITE"
  NGINX_CANDIDATE=""
  if [ -L "$NGINX_ENABLED" ] || [ -f "$NGINX_ENABLED" ]; then
    unlink "$NGINX_ENABLED"
  fi
  ln -s "$NGINX_SITE" "$NGINX_ENABLED"

  if ! nginx -t; then
    rollback_nginx_policy
    echo "nginx maintenance policy failed validation and was rolled back."
    exit 1
  fi
  if ! systemctl restart nginx; then
    rollback_nginx_policy
    echo "nginx maintenance policy failed to start and was rolled back."
    exit 1
  fi

  maintenance_status=$(curl --noproxy '*' --silent --show-error --output /dev/null \
    --max-time 10 --write-out '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" \
    "https://$DOMAIN/" || true)
  if [ "$maintenance_status" != "503" ]; then
    rollback_nginx_policy
    echo "Maintenance policy is not enforced through local HTTPS (HTTP $maintenance_status)."
    exit 1
  fi
}

if [ "$INITIAL_INSTALL" = "0" ]; then
  if [ "${PATTANI_MAINTENANCE_CONFIRMED:-}" != "true" ]; then
    echo "Existing production releases require an explicit maintenance window."
    echo "Close match and season-pass sales, wait for pending payments to drain, then run:"
    echo "PATTANI_MAINTENANCE_CONFIRMED=true bash deploy/setup.sh"
    exit 1
  fi

  assert_database_quiet

  SUSPICIOUS_OAUTH_LINKS=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
    'SELECT count(*) FROM "Customer" customer
      WHERE customer."emailVerifiedAt" IS NULL
        AND customer."passwordHash" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "CustomerAccount" account WHERE account."customerId" = customer."id");')
  if [ "${SUSPICIOUS_OAUTH_LINKS//[[:space:]]/}" != "0" ]; then
    echo "Found $SUSPICIOUS_OAUTH_LINKS legacy OAuth links on unverified password accounts."
    echo "Quarantine/reverify these accounts and increment authVersion before deployment."
    exit 1
  fi
fi

# Capture the legacy supervisor/upstream while it is still healthy. No PM2 or
# nginx state is changed here; the captured state is used only after the
# server-enforced maintenance policy has been verified.
capture_legacy_root_runtime

# Install and build from a disposable copy as a separate OS account. The
# application checkout, deploy scripts, nginx policy, and live .env files stay
# root-owned and are never writable/readable by dependency lifecycle scripts.
BUILD_WORK=$(mktemp -d "$BUILD_HOME/build.XXXXXX")
BUILD_WORK_REAL=$(realpath -e "$BUILD_WORK")
case "$BUILD_WORK_REAL" in
  "$BUILD_HOME"/build.*) ;;
  *)
    echo "Unsafe build workspace: $BUILD_WORK_REAL"
    exit 1
    ;;
esac
chown "$BUILD_USER:$BUILD_USER" "$BUILD_WORK"
SOURCE_ARCHIVE=$(mktemp "$BUILD_HOME/source.XXXXXX.tar")
git archive --format=tar --output="$SOURCE_ARCHIVE" HEAD
chown "$BUILD_USER:$BUILD_USER" "$SOURCE_ARCHIVE"
chmod 600 "$SOURCE_ARCHIVE"
run_as_build tar -xf "$SOURCE_ARCHIVE" -C "$BUILD_WORK"
unlink "$SOURCE_ARCHIVE"

run_in_build() {
  run_as_build bash -c 'cd "$1"; shift; exec "$@"' pattani-build "$BUILD_WORK" "$@"
}

run_in_migration() {
  run_as_migrate bash -c 'cd "$1"; shift; exec "$@"' pattani-migrate "$BUILD_WORK" "$@"
}

BUILD_SESSION_SECRET=$(openssl rand -base64 32)
BUILD_PAYLOAD_SECRET=$(openssl rand -base64 32)
BUILD_GATE_SECRET=$(openssl rand -base64 32)
BUILD_BARCODE_SECRET=$(openssl rand -base64 32)
BUILD_RATE_SECRET=$(openssl rand -base64 32)
write_build_env() {
  local build_database_url="$1"
  printf 'DATABASE_URL="%s"\nSESSION_SECRET="%s"\nPAYLOAD_SECRET="%s"\nPAYLOAD_PUBLIC_SERVER_URL="https://%s"\nNEXT_PUBLIC_APP_URL="https://%s"\nPAYLOAD_ALLOW_SCHEMA_PUSH="false"\nCMS_SUPER_ADMIN_EMAIL="%s"\nSEASON_GATE_TOKEN_SECRET="%s"\nSEASON_BARCODE_ACCESS_SECRET="%s"\nRATE_LIMIT_KEY_SECRET="%s"\nNODE_ENV="production"\nPORT=3000\n' \
    "$build_database_url" "$BUILD_SESSION_SECRET" "$BUILD_PAYLOAD_SECRET" \
    "$DOMAIN" "$DOMAIN" "$CMS_SUPER_ADMIN_EMAIL_VALUE" \
    "$BUILD_GATE_SECRET" "$BUILD_BARCODE_SECRET" "$BUILD_RATE_SECRET" \
    > "$BUILD_WORK/.env.local"
  cp "$BUILD_WORK/.env.local" "$BUILD_WORK/.env"
  chown "$BUILD_USER:$BUILD_USER" "$BUILD_WORK/.env.local" "$BUILD_WORK/.env"
  chmod 600 "$BUILD_WORK/.env.local" "$BUILD_WORK/.env"
}

# npm lifecycle hooks get no production database or application credentials.
write_build_env "postgresql://build:build@127.0.0.1:1/build?schema=public"
run_in_build npm ci
run_in_build npx prisma generate
# Do not let npm lifecycle code retain a writable file or same-UID process that
# could tamper with a later owner-credential migration command.
pkill -KILL -u "$BUILD_USER" 2>/dev/null || true
chown root:"$BUILD_READ_GROUP" "$BUILD_HOME"
chmod 710 "$BUILD_HOME"
chown -R -P root:"$BUILD_READ_GROUP" "$BUILD_WORK"
chmod -R u=rwX,g=rX,o= "$BUILD_WORK"
chmod 750 "$BUILD_WORK"
chmod 640 "$BUILD_WORK/.env" "$BUILD_WORK/.env.local"

# Put the reviewed reverse proxy into server-enforced maintenance before any
# writer is stopped. Requests cannot race the post-stop database recheck.
capture_legacy_root_runtime
install_nginx_maintenance_policy
MAINTENANCE_ACTIVE=1
if ! stop_legacy_root_runtime; then
  echo "Could not stop the captured legacy root PM2 release."
  echo "Maintenance remains active; rollback will attempt to restore its saved systemd state."
  exit 1
fi
run_as_app pm2 stop pattani-fc 2>/dev/null || true
if ! freeze_runtime_processes; then
  echo "Could not freeze every process owned by $SERVICE_USER."
  echo "Maintenance remains active; refusing to continue toward the database cutover."
  exit 1
fi
wait_for_runtime_database_sessions_to_close

PORT_3000_LISTENER=$(ss -H -ltn 'sport = :3000' || true)
if [ -n "$PORT_3000_LISTENER" ]; then
  echo "A process is still listening on port 3000 after the application stop."
  echo "Refusing to migrate while an unaccounted writer may still be running."
  exit 1
fi
assert_no_runtime_database_sessions

OTHER_DATABASE_CLIENTS=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
  "SELECT count(*) FROM pg_stat_activity
    WHERE datname = 'pattani_ticket'
      AND backend_type = 'client backend'
      AND pid <> pg_backend_pid();")
if [ "${OTHER_DATABASE_CLIENTS//[[:space:]]/}" != "0" ]; then
  echo "Other database client sessions remain after application shutdown ($OTHER_DATABASE_CLIENTS)."
  echo "Close them before migration so the backup and schema cutover have a single writer."
  exit 1
fi

if [ "$INITIAL_INSTALL" = "0" ]; then
  assert_database_quiet
fi
assert_runtime_processes_frozen
assert_no_runtime_database_sessions
activate_runtime_database_credential_guard

echo ""
echo "── Prisma generate + migrate + seed ──"
# Prisma client generation already completed above with a dummy, unreachable
# DATABASE_URL before this workspace was frozen for migration commands.

# Refuse an ambiguous ownership backfill before any migration is committed.
if runuser -u postgres -- psql -d pattani_ticket -tAc \
  "SELECT to_regclass('public.\"Customer\"') IS NOT NULL" | grep -q t; then
  DUPLICATE_VERIFIED_EMAILS=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
    'SELECT count(*) FROM (SELECT lower(trim("email")) FROM "Customer" WHERE "emailVerifiedAt" IS NOT NULL GROUP BY lower(trim("email")) HAVING count(*) > 1) duplicate_emails;')
  if [ "${DUPLICATE_VERIFIED_EMAILS//[[:space:]]/}" != "0" ]; then
    echo "Verified customer emails contain case-insensitive duplicates."
    echo "Resolve them before deploying so guest tickets cannot be linked ambiguously."
    exit 1
  fi
fi

# Recheck immediately before the backup/migration boundary. The PM2 unit is
# runtime-masked and the service UID has no process, so no orphan can reconnect
# between the public maintenance gate and this snapshot.
assert_runtime_processes_frozen
assert_no_runtime_database_sessions

# Take a root-only, restorable snapshot before schema changes. Building the app
# never runs migrations; this controlled deployment step is the only writer.
BACKUP_DIR="/var/backups/pattani-fc"
BACKUP_FILE="$BACKUP_DIR/pre-migrate-$(date -u '+%Y%m%dT%H%M%SZ').dump"
install -d -m 700 "$BACKUP_DIR"
runuser -u postgres -- pg_dump --format=custom pattani_ticket > "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
if [ ! -s "$BACKUP_FILE" ]; then
  echo "Database backup is empty; refusing to run migrations."
  exit 1
fi
if ! pg_restore --list "$BACKUP_FILE" >/dev/null; then
  echo "Database backup cannot be read by pg_restore; refusing to run migrations."
  exit 1
fi
echo "Pre-migration backup written to $BACKUP_FILE"

# Release directories are renamed during cutover. Keep their rollback copies on
# the same filesystem as APP_DIR so every individual rename is atomic; refuse a
# mount layout where that guarantee cannot be made.
ARTIFACT_BACKUP_ROOT="$(dirname "$APP_DIR")/.pattani-fc-release-backups"
install -d -m 700 "$ARTIFACT_BACKUP_ROOT"
if [ "$(stat -c '%d' "$APP_DIR")" != "$(stat -c '%d' "$ARTIFACT_BACKUP_ROOT")" ]; then
  echo "Release rollback storage is not on the same filesystem as $APP_DIR."
  exit 1
fi

# From this point onward, automatic rollback to the old binary is unsafe unless
# the operator first confirms schema compatibility or restores the backup.
printf 'phase=database\nnginx_snapshot=%s\nlegacy_app=%s\nlegacy_cwd=%s\nlegacy_upstream=%s\nbackup_file=%s\n' \
  "$NGINX_SNAPSHOT_DIR" "$LEGACY_ROOT_PM2_APP" "$LEGACY_ROOT_PM2_CWD" \
  "$LEGACY_ROOT_PM2_UPSTREAM" "$BACKUP_FILE" > "$ARTIFACT_TRANSACTION_MARKER"
DATABASE_CHANGE_STARTED=1
run_in_migration env DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy
# Seed only when the migrated Prisma user table is actually empty. This also
# safely resumes an interrupted first install; an existing account is never
# reset or overwritten.
PRISMA_USER_COUNT=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
  'SELECT count(*) FROM "User";')
if [ "${PRISMA_USER_COUNT//[[:space:]]/}" = "0" ]; then
  if [ -z "$BOOTSTRAP_ADMIN_PASSWORD" ]; then
    echo "Prisma has no administrator and the root bootstrap password is missing."
    echo "Restore $BOOTSTRAP_FILE before continuing."
    exit 1
  fi
  run_in_migration env \
    DATABASE_URL="$MIGRATION_DATABASE_URL" \
    SEED_ADMIN_EMAIL="admin@$DOMAIN" \
    SEED_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD" \
    npm run db:seed
else
  echo "Existing Prisma administrator found: seed skipped"
fi

# Bootstrap/verify Payload CMS locally before any public listener starts. The
# public first-register endpoint is permanently blocked by nginx.
CMS_USER_COUNT=0
if runuser -u postgres -- psql -d pattani_ticket -tAc \
  "SELECT to_regclass('payload.cms_users') IS NOT NULL" | grep -q t; then
  CMS_USER_COUNT=$(runuser -u postgres -- psql -d pattani_ticket -tAc \
    'SELECT count(*) FROM payload.cms_users;')
fi
if [ "${CMS_USER_COUNT//[[:space:]]/}" = "0" ]; then
  if [ -z "$BOOTSTRAP_CMS_PASSWORD" ]; then
    echo "Payload CMS has no user and the root bootstrap password is missing."
    echo "Restore $BOOTSTRAP_FILE before continuing."
    exit 1
  fi
  run_in_migration env \
    DATABASE_URL="$MIGRATION_DATABASE_URL" \
    CMS_SUPER_ADMIN_EMAIL="$CMS_SUPER_ADMIN_EMAIL_VALUE" \
    CMS_BOOTSTRAP_MODE="fresh" \
    CMS_SUPER_ADMIN_PASSWORD="$BOOTSTRAP_CMS_PASSWORD" \
    PAYLOAD_ALLOW_SCHEMA_PUSH="true" \
    npm run cms:bootstrap
else
  run_in_migration env \
    DATABASE_URL="$MIGRATION_DATABASE_URL" \
    CMS_SUPER_ADMIN_EMAIL="$CMS_SUPER_ADMIN_EMAIL_VALUE" \
    CMS_BOOTSTRAP_MODE="existing" \
    PAYLOAD_ALLOW_SCHEMA_PUSH="false" \
    npm run cms:bootstrap
fi

# Kill every migration helper before preparing the isolated build database and
# prove that no production-owner connection or application process survived.
pkill -KILL -u "$MIGRATE_USER" 2>/dev/null || true
sleep 1
assert_runtime_processes_frozen
assert_no_runtime_database_sessions

# Recreate a disposable database from template0 and apply only reviewed Prisma
# migrations. It contains schema but no customer, booking, payment, or CMS data.
# The build login has no effective SELECT/owner privilege in production.
configure_isolated_build_database
run_in_migration env DATABASE_URL="$BUILD_DATABASE_URL" npx prisma migrate deploy
pkill -KILL -u "$MIGRATE_USER" 2>/dev/null || true
sleep 1
assert_runtime_processes_frozen
assert_no_runtime_database_sessions

chown "$BUILD_USER:$BUILD_READ_GROUP" "$BUILD_HOME"
chmod 710 "$BUILD_HOME"
chown -R -P "$BUILD_USER:$BUILD_READ_GROUP" "$BUILD_WORK"
chmod -R u=rwX,g=rX,o= "$BUILD_WORK"
chmod 750 "$BUILD_WORK"
write_build_env "$BUILD_DATABASE_URL"

# ────────────────────────────────────────────────
# Build
# ────────────────────────────────────────────────
echo ""
echo "── [5/6] Building Next.js (3-5 minutes) ──"
run_in_build env \
  DATABASE_URL="$BUILD_DATABASE_URL" \
  NODE_OPTIONS="--max-old-space-size=8192" \
  npm run build
pkill -KILL -u "$BUILD_USER" 2>/dev/null || true
destroy_isolated_build_database

# Turbopack's filesystem cache contains build-time environment values. It is
# not a runtime artifact, this deployment always builds from a fresh workspace,
# and an empty writable runtime cache is created after the atomic swap below.
# Remove only the validated in-workspace cache before scanning every remaining
# published artifact for build-only credentials.
BUILD_NEXT_REAL=$(realpath -e "$BUILD_WORK/.next" 2>/dev/null || true)
if [ -L "$BUILD_WORK/.next" ] || [ ! -d "$BUILD_WORK/.next" ] || \
   [ "$BUILD_NEXT_REAL" != "$BUILD_WORK_REAL/.next" ]; then
  echo "Build output directory is missing or unsafe before credential scan."
  exit 1
fi
BUILD_CACHE_PATH="$BUILD_WORK/.next/cache"
if [ -e "$BUILD_CACHE_PATH" ] || [ -L "$BUILD_CACHE_PATH" ]; then
  BUILD_CACHE_REAL=$(realpath -e "$BUILD_CACHE_PATH" 2>/dev/null || true)
  if [ -L "$BUILD_CACHE_PATH" ] || [ ! -d "$BUILD_CACHE_PATH" ] || \
     [ "$BUILD_CACHE_REAL" != "$BUILD_NEXT_REAL/cache" ]; then
    echo "Build cache is missing or unsafe; refusing credential cleanup."
    exit 1
  fi
  if [ "$(stat -c '%d' "$BUILD_CACHE_REAL")" != "$(stat -c '%d' "$BUILD_NEXT_REAL")" ]; then
    echo "Build cache is mounted on an unexpected filesystem."
    exit 1
  fi
  find "$BUILD_CACHE_REAL" -xdev -depth -delete
fi

build_secret_labels=(
  BUILD_DB_PASSWORD
  BUILD_SESSION_SECRET
  BUILD_PAYLOAD_SECRET
  BUILD_GATE_SECRET
  BUILD_BARCODE_SECRET
  BUILD_RATE_SECRET
)
build_secret_values=(
  "$BUILD_DB_PASSWORD"
  "$BUILD_SESSION_SECRET"
  "$BUILD_PAYLOAD_SECRET"
  "$BUILD_GATE_SECRET"
  "$BUILD_BARCODE_SECRET"
  "$BUILD_RATE_SECRET"
)
build_secret_scan_failed=0
for build_secret_index in "${!build_secret_labels[@]}"; do
  build_secret_label="${build_secret_labels[$build_secret_index]}"
  build_only_secret="${build_secret_values[$build_secret_index]}"
  if [ -z "$build_only_secret" ]; then
    echo "Build-only credential is unexpectedly empty: $build_secret_label"
    exit 1
  fi

  build_secret_match_file=$(mktemp "$ARTIFACT_BACKUP_ROOT/.secret-scan.XXXXXX")
  chmod 600 "$build_secret_match_file"
  if grep -r -F -l -Z -- "$build_only_secret" "$BUILD_WORK/.next" \
      > "$build_secret_match_file" 2>/dev/null; then
    build_secret_scan_status=0
  else
    build_secret_scan_status=$?
  fi
  if [ "$build_secret_scan_status" -gt 1 ]; then
    unlink "$build_secret_match_file"
    echo "Credential scan failed while checking: $build_secret_label"
    exit 1
  fi
  build_secret_matches=()
  if [ "$build_secret_scan_status" = "0" ]; then
    mapfile -d '' -t build_secret_matches < "$build_secret_match_file"
  fi
  unlink "$build_secret_match_file"
  if [ "${#build_secret_matches[@]}" -gt 0 ]; then
    build_secret_scan_failed=1
    echo "Build-only credential match: $build_secret_label"
    for build_secret_match in "${build_secret_matches[@]:0:20}"; do
      echo "  artifact: ${build_secret_match#"$BUILD_WORK/"}"
    done
    if [ "${#build_secret_matches[@]}" -gt 20 ]; then
      echo "  ... and $((${#build_secret_matches[@]} - 20)) more artifact(s)"
    fi
  fi
done
if [ "$build_secret_scan_failed" = "1" ]; then
  echo "A build-only credential was embedded in the Next.js output."
  echo "Refusing to publish the artifact; remove build-time secret inlining first."
  exit 1
fi

for built_artifact in "$BUILD_WORK/node_modules" "$BUILD_WORK/.next"; do
  if [ ! -d "$built_artifact" ] || [ -L "$built_artifact" ]; then
    echo "Build artifact is missing or unsafe: $built_artifact"
    exit 1
  fi
done

# Copy the completed build into a root-owned staging directory on the same
# filesystem as APP_DIR. The later rename of each stopped release artifact is
# therefore atomic; a /var/lib -> /var/www cross-device move is never used.
ARTIFACT_STAGE_ROOT="$(dirname "$APP_DIR")/.pattani-fc-release-staging"
install -d -m 700 "$ARTIFACT_STAGE_ROOT"
if [ "$(stat -c '%d' "$APP_DIR")" != "$(stat -c '%d' "$ARTIFACT_STAGE_ROOT")" ]; then
  echo "Release staging is not on the same filesystem as $APP_DIR."
  exit 1
fi
ARTIFACT_STAGE_DIR=$(mktemp -d "$ARTIFACT_STAGE_ROOT/stage.XXXXXX")
chmod 700 "$ARTIFACT_STAGE_DIR"
for artifact_name in node_modules .next; do
  cp -a "$BUILD_WORK/$artifact_name" "$ARTIFACT_STAGE_DIR/$artifact_name"
  if [ ! -d "$ARTIFACT_STAGE_DIR/$artifact_name" ] || [ -L "$ARTIFACT_STAGE_DIR/$artifact_name" ]; then
    echo "Staged release artifact is missing or unsafe: $artifact_name"
    exit 1
  fi
  chown -R -P root:"$SERVICE_USER" "$ARTIFACT_STAGE_DIR/$artifact_name"
  chmod -R u=rwX,g=rX,o= "$ARTIFACT_STAGE_DIR/$artifact_name"
done
while IFS= read -r -d '' staged_link; do
  staged_target=$(readlink "$staged_link")
  case "$staged_target" in
    /*)
      echo "Staged release contains an absolute symlink: $staged_link"
      exit 1
      ;;
  esac
  staged_resolved=$(realpath -m "$(dirname "$staged_link")/$staged_target")
  case "$staged_resolved" in
    "$ARTIFACT_STAGE_DIR"/*) ;;
    *)
      echo "Staged release symlink escapes the release directory: $staged_link"
      exit 1
      ;;
  esac
done < <(find "$ARTIFACT_STAGE_DIR/node_modules" "$ARTIFACT_STAGE_DIR/.next" -type l -print0)
UNSAFE_STAGED_NODE=$(find "$ARTIFACT_STAGE_DIR/node_modules" "$ARTIFACT_STAGE_DIR/.next" \
  ! -type f ! -type d ! -type l -print -quit)
if [ -n "$UNSAFE_STAGED_NODE" ]; then
  echo "Staged release contains an unsupported filesystem object: $UNSAFE_STAGED_NODE"
  exit 1
fi
if [ ! -s "$ARTIFACT_STAGE_DIR/.next/BUILD_ID" ]; then
  echo "Staged Next.js release has no BUILD_ID."
  exit 1
fi

ARTIFACT_BACKUP_DIR="$ARTIFACT_BACKUP_ROOT/release-artifacts-$(date -u '+%Y%m%dT%H%M%SZ')"
install -d -m 700 "$ARTIFACT_BACKUP_DIR"
if [ -e "$APP_DIR/node_modules" ]; then NODE_MODULES_OLD_PRESENT=1; fi
if [ -e "$APP_DIR/.next" ]; then NEXT_OLD_PRESENT=1; fi
NODE_MODULES_SWAP_ARMED=1
NEXT_SWAP_ARMED=1
ARTIFACT_SWAP_STARTED=1
install -m 600 /dev/null "$ARTIFACT_TRANSACTION_MARKER"
printf 'phase=artifact-swap\nnginx_snapshot=%s\nbackup_file=%s\nbackup_dir=%s\nstage_dir=%s\nnode_modules_old_present=%s\nnext_old_present=%s\n' \
  "$NGINX_SNAPSHOT_DIR" "$BACKUP_FILE" \
  "$ARTIFACT_BACKUP_DIR" "$ARTIFACT_STAGE_DIR" \
  "$NODE_MODULES_OLD_PRESENT" "$NEXT_OLD_PRESENT" \
  > "$ARTIFACT_TRANSACTION_MARKER"
for artifact_name in node_modules .next; do
  current_artifact="$APP_DIR/$artifact_name"
  assert_safe_app_path "$current_artifact"
  if [ -e "$current_artifact" ]; then
    mv "$current_artifact" "$ARTIFACT_BACKUP_DIR/$artifact_name"
  fi
  mv "$ARTIFACT_STAGE_DIR/$artifact_name" "$current_artifact"
done
find "$ARTIFACT_STAGE_DIR" -xdev -depth -delete

# Remove only the mktemp workspace, never a computed or symlinked path.
BUILD_WORK_REAL=$(realpath -e "$BUILD_WORK")
case "$BUILD_WORK_REAL" in
  "$BUILD_HOME"/build.*)
    find "$BUILD_WORK_REAL" -xdev -depth -delete
    BUILD_WORK=""
    ;;
  *)
    echo "Refusing to clean unsafe build workspace: $BUILD_WORK_REAL"
    exit 1
    ;;
esac

# Payload schema changes are disabled during normal production runtime. Fresh
# schema initialization was completed locally before this build/start phase.
# ────────────────────────────────────────────────
# PM2
# ────────────────────────────────────────────────
echo ""
echo "── [6/6] Start with PM2 ──"

# Apply deterministic read-only release permissions. Do not preserve group
# write bits from a previous deployment.
chown -R -P root:"$SERVICE_USER" "$APP_DIR"
chmod -R u=rwX,g=rX,o= "$APP_DIR"
chmod 751 "$APP_DIR" "$APP_DIR/public"
chown -R "$SERVICE_USER:$SERVICE_USER" "$SERVICE_HOME"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$APP_DIR/.next/cache"
chown -R -P "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.next/cache"
assert_safe_app_path "$APP_DIR/public/uploads"
install -d -m 2755 -o "$SERVICE_USER" -g "$MEDIA_GROUP" "$APP_DIR/public/uploads"
install -d -m 2755 -o "$SERVICE_USER" -g "$MEDIA_GROUP" "$APP_DIR/public/uploads/media"
chown -R -P "$SERVICE_USER:$MEDIA_GROUP" "$APP_DIR/public/uploads"
# nginx was restarted when maintenance began, after its worker account joined
# the dedicated group, so uploads can be private before the new app starts.
find "$APP_DIR/public/uploads" -type d -exec chmod 2750 {} +
find "$APP_DIR/public/uploads" -type f -exec chmod 0640 {} +
chown root:"$SERVICE_USER" "$APP_DIR/.env.local" "$APP_DIR/.env"
chmod 640 "$APP_DIR/.env.local" "$APP_DIR/.env"
UNEXPECTED_GROUP_WRITABLE=$(find "$APP_DIR" -xdev \( -type f -o -type d \) \
  -group "$SERVICE_USER" -perm -0020 -print -quit)
if [ -n "$UNEXPECTED_GROUP_WRITABLE" ]; then
  echo "Runtime service group can still modify release content: $UNEXPECTED_GROUP_WRITABLE"
  exit 1
fi

assert_runtime_processes_frozen
assert_no_runtime_database_sessions
if ! retire_legacy_root_runtime; then
  fail_closed_after_database_change "The legacy root PM2 supervisor could not be retired safely."
fi
restore_runtime_database_credential
assert_no_runtime_database_sessions
unfreeze_runtime_processes
run_as_app pm2 delete pattani-fc 2>/dev/null || true
run_as_app pm2 start npm --name pattani-fc --cwd "$APP_DIR" -- start
sleep 8

PM2_HEALTH=$(run_as_app pm2 jlist | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const list = JSON.parse(input);
  const app = list.find((entry) => entry.name === "pattani-fc");
  if (!app) process.exit(2);
  process.stdout.write([
    app.pm2_env?.status ?? "",
    app.pid ?? 0,
    app.pm2_env?.unstable_restarts ?? 0,
    app.pm2_env?.pm_uptime ?? 0,
  ].join("|"));
});')
IFS='|' read -r PM2_STATUS APP_PID PM2_UNSTABLE PM2_UPTIME <<< "$PM2_HEALTH"
NOW_MILLISECONDS=$(date +%s%3N)
if [ "$PM2_STATUS" != "online" ] || [ -z "$APP_PID" ] || [ "$APP_PID" = "0" ] || \
  [ "$PM2_UNSTABLE" != "0" ] || [ "$PM2_UPTIME" = "0" ] || \
  [ $((NOW_MILLISECONDS - PM2_UPTIME)) -lt 5000 ]; then
  fail_closed_after_database_change "PM2 did not remain stably online after startup."
fi
APP_OWNER=$(ps -o user= -p "$APP_PID" | xargs)
if [ "$APP_OWNER" != "$SERVICE_USER" ]; then
  fail_closed_after_database_change "The PM2 application process is not owned by $SERVICE_USER."
fi

LISTENER_DETAILS=$(ss -H -ltnp 'sport = :3000' || true)
if [ -z "$LISTENER_DETAILS" ] || ! printf '%s\n' "$LISTENER_DETAILS" | grep -q '127\.0\.0\.1:3000'; then
  fail_closed_after_database_change "No Next.js listener was found on 127.0.0.1:3000."
fi
if printf '%s\n' "$LISTENER_DETAILS" | grep -Eq '0\.0\.0\.0:3000|\[::\]:3000|\*:3000'; then
  fail_closed_after_database_change "Next.js is exposed on a wildcard interface instead of loopback only."
fi
LISTENER_PID=$(printf '%s\n' "$LISTENER_DETAILS" | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -1)
if [ -z "$LISTENER_PID" ]; then
  fail_closed_after_database_change "The port 3000 listener process could not be identified."
fi
LISTENER_OWNER=$(ps -o user= -p "$LISTENER_PID" | xargs)
LISTENER_CWD=$(realpath -e "/proc/$LISTENER_PID/cwd" 2>/dev/null || true)
if [ "$LISTENER_OWNER" != "$SERVICE_USER" ] || [ "$LISTENER_CWD" != "$APP_DIR" ]; then
  fail_closed_after_database_change "The port 3000 listener is not the reviewed release owned by $SERVICE_USER."
fi
ANCESTOR_PID="$LISTENER_PID"
LISTENER_IS_PM2_CHILD=0
while [ -n "$ANCESTOR_PID" ] && [ "$ANCESTOR_PID" -gt 1 ]; do
  if [ "$ANCESTOR_PID" = "$APP_PID" ]; then
    LISTENER_IS_PM2_CHILD=1
    break
  fi
  ANCESTOR_PID=$(ps -o ppid= -p "$ANCESTOR_PID" 2>/dev/null | xargs || true)
done
if [ "$LISTENER_IS_PM2_CHILD" != "1" ]; then
  fail_closed_after_database_change "The port 3000 listener is not a child of the PM2 application process."
fi
if [ ! -s "$APP_DIR/.next/BUILD_ID" ]; then
  fail_closed_after_database_change "The running release has no Next.js BUILD_ID."
fi
if ! curl --noproxy '*' --fail --silent --show-error --output /dev/null \
  --max-time 15 http://127.0.0.1:3000/; then
  fail_closed_after_database_change "The new Next.js release failed its direct HTTP health check."
fi

# The reviewed nginx policy is already active in maintenance mode. New nginx
# workers also have pattani-media as a supplementary group.
find "$APP_DIR/public/uploads" -type d -exec chmod 2750 {} +
find "$APP_DIR/public/uploads" -type f -exec chmod 0640 {} +
MEDIA_CANARY="$APP_DIR/public/uploads/security-media-canary.txt"
printf 'pattani-media-ok\n' > "$MEDIA_CANARY"
chown "$SERVICE_USER:$MEDIA_GROUP" "$MEDIA_CANARY"
chmod 0640 "$MEDIA_CANARY"
if ! runuser -u "$NGINX_USER" -- test -r "$MEDIA_CANARY"; then
  fail_closed_after_database_change "nginx cannot read CMS uploads through the dedicated media group."
fi
run_as_app pm2 save
pm2 startup systemd -u "$SERVICE_USER" --hp "$SERVICE_HOME"

# ────────────────────────────────────────────────
# Verify
# ────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "   Verification"
echo "════════════════════════════════════════════════"
run_as_app pm2 status
CURRENT_APP_PID=$(run_as_app pm2 pid pattani-fc | tail -1)
CURRENT_APP_OWNER=$(ps -o user= -p "$CURRENT_APP_PID" | xargs)
CURRENT_LISTENER=$(ss -H -ltnp 'sport = :3000' || true)
if [ -z "$CURRENT_APP_PID" ] || [ "$CURRENT_APP_PID" = "0" ] || \
  [ "$CURRENT_APP_PID" != "$APP_PID" ] || [ "$CURRENT_APP_OWNER" != "$SERVICE_USER" ] || \
  [ -z "$CURRENT_LISTENER" ] || ! printf '%s\n' "$CURRENT_LISTENER" | grep -q '127\.0\.0\.1:3000'; then
  fail_closed_after_database_change "The verified PM2/Next.js process changed or stopped before final handoff."
fi
echo ""
echo "── curl localhost:3000 (Next.js direct) ──"
sleep 2
curl --noproxy '*' --fail --silent --show-error --output /dev/null --max-time 15 http://127.0.0.1:3000/
if ! nginx -t >/dev/null 2>&1 || ! systemctl is-active --quiet nginx; then
  fail_closed_after_database_change "nginx failed its final offline validation while maintenance was active."
fi

# Commit binary rollback state before opening nginx, but retain the transaction
# marker through every public TLS/security probe. A crash while the gate is open
# therefore makes the next invocation re-arm maintenance and stop for review.
ARTIFACT_SWAP_STARTED=0
printf 'phase=public-verification\nnginx_snapshot=%s\nbackup_file=%s\n' \
  "$NGINX_SNAPSHOT_DIR" "$BACKUP_FILE" > "$ARTIFACT_TRANSACTION_MARKER"
deactivate_maintenance_marker
echo ""
echo "── curl via nginx TLS ($DOMAIN) ──"
curl --noproxy '*' --fail --silent --show-error --output /dev/null --max-time 15 \
  --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" >/dev/null
if ! curl --noproxy '*' --fail --silent --show-error --output /dev/null \
    --max-time 15 \
    --resolve "$DOMAIN:443:127.0.0.1" \
    "https://$DOMAIN/uploads/security-media-canary.txt"; then
  fail_closed_after_database_change "CMS upload HTTPS canary failed."
fi

for blocked_path in \
  "/payload-api/cms-users/first-register" \
  "/payload-api/cms-users/first-register/"; do
  status=$(curl --noproxy '*' --silent --output /dev/null --max-time 15 --write-out '%{http_code}' \
    --request POST --resolve "$DOMAIN:443:127.0.0.1" \
    "https://$DOMAIN$blocked_path" || true)
  if [ "$status" != "404" ]; then
    fail_closed_after_database_change "CMS first-register security probe failed for $blocked_path (HTTP $status)."
  fi
done
unlink "$MEDIA_CANARY"

install -m 600 /dev/null "$INSTALL_COMPLETE_MARKER"
if [ -f "$INSTALL_IN_PROGRESS_MARKER" ]; then
  unlink "$INSTALL_IN_PROGRESS_MARKER"
fi
printf 'phase=verified\nnginx_snapshot=%s\nbackup_file=%s\n' \
  "$NGINX_SNAPSHOT_DIR" "$BACKUP_FILE" > "$ARTIFACT_TRANSACTION_MARKER"
if [ -L "$ARTIFACT_TRANSACTION_MARKER" ] || ! unlink "$ARTIFACT_TRANSACTION_MARKER"; then
  fail_closed_after_database_change "The verified deployment transaction marker could not be committed."
fi
NGINX_POLICY_CHANGED=0
DEPLOY_SUCCESS=1
echo ""
echo "════════════════════════════════════════════════"
echo "   ✓ DEPLOY COMPLETE"
echo "   → Test in browser: https://$DOMAIN"
echo "════════════════════════════════════════════════"
