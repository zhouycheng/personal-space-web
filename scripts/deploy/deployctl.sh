#!/usr/bin/env bash
set -Eeuo pipefail

readonly CONFIG_DIR=/etc/deployctl/targets
readonly STATE_DIR=/var/lib/deployctl/targets

die() {
  printf 'deployctl: %s\n' "$1" >&2
  exit 1
}

assert_root_managed_path() {
  local cursor="$1" owner mode digit
  while :; do
    owner="$(stat -c '%u' "$cursor")" || die "could not inspect ${cursor}"
    [[ "$owner" == 0 ]] || die "${cursor} must be owned by root"
    mode="$(stat -c '%a' "$cursor")" || die "could not inspect permissions for ${cursor}"
    digit="${mode: -2:1}"
    [[ "$digit" != 2 && "$digit" != 3 && "$digit" != 6 && "$digit" != 7 ]] || die "${cursor} must not be group-writable"
    digit="${mode: -1}"
    [[ "$digit" != 2 && "$digit" != 3 && "$digit" != 6 && "$digit" != 7 ]] || die "${cursor} must not be world-writable"
    [[ "$cursor" == / ]] && break
    cursor="${cursor%/*}"
    [[ -n "$cursor" ]] || cursor=/
  done
}

operation="${1-}"
target="${2-}"
image=''
registry_username=''
registry_token=''
[[ "$target" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || die 'invalid deployment target'

read_registry_credentials() {
  IFS= read -r registry_username || die 'expected a registry username on stdin'
  [[ "$registry_username" =~ ^[A-Za-z0-9-]{1,39}$ ]] || die 'invalid registry username'
  IFS= read -r -n 4097 registry_token || die 'expected a registry token on stdin'
  [[ -n "$registry_token" && "${#registry_token}" -le 4096 ]] || die 'invalid registry token'
  extra=''
  if IFS= read -r -n 1 extra; then
    die 'unexpected extra input on stdin'
  fi
  [[ -z "$extra" ]] || die 'unexpected extra input on stdin'
}

case "$operation" in
  deploy)
    [[ "$#" -eq 2 ]] || die 'usage: deployctl deploy <target> < image-ref, registry username, and token on stdin'
    IFS= read -r -n 255 image || die 'expected one image reference on stdin'
    [[ "$image" =~ ^[a-z0-9][a-z0-9.-]*(:[0-9]+)?(/[a-z0-9][a-z0-9._-]*)+@sha256:[0-9a-f]{64}$ ]] ||
      die 'expected one OCI image reference pinned to a sha256 digest'
    read_registry_credentials
    ;;
  rollback)
    [[ "$#" -eq 2 ]] || die 'usage: deployctl rollback <target> < registry username and token on stdin'
    read_registry_credentials
    ;;
  *)
    die 'usage: deployctl {deploy|rollback} <target>'
    ;;
esac

[[ "$EUID" -eq 0 ]] || die 'must run as root through the restricted sudo rule'

config_file="${CONFIG_DIR}/${target}.conf"
[[ -f "$config_file" && ! -L "$config_file" ]] || die "target is not registered: ${target}"
[[ "$(stat -c '%u:%a' "$config_file")" == '0:600' ]] || die 'target config must be root-owned with mode 0600'
assert_root_managed_path "$config_file"

# Target files are administrator-managed shell assignments, never writable by deploy.
# shellcheck disable=SC1090
source "$config_file"
: "${IMAGE_REPOSITORY:?set IMAGE_REPOSITORY in ${config_file}}"
: "${COMPOSE_DIR:?set COMPOSE_DIR in ${config_file}}"
: "${COMPOSE_FILE:?set COMPOSE_FILE in ${config_file}}"
: "${COMPOSE_PROJECT_NAME:?set COMPOSE_PROJECT_NAME in ${config_file}}"
: "${COMPOSE_SERVICE:?set COMPOSE_SERVICE in ${config_file}}"
: "${COMPOSE_IMAGE_ENV:?set COMPOSE_IMAGE_ENV in ${config_file}}"
: "${REGISTRY_HOST:?set REGISTRY_HOST in ${config_file}}"
[[ "$IMAGE_REPOSITORY" =~ ^[a-z0-9][a-z0-9.-]*(:[0-9]+)?(/[a-z0-9][a-z0-9._-]*)+$ ]] || die 'invalid IMAGE_REPOSITORY in target config'
[[ "$REGISTRY_HOST" =~ ^[a-z0-9][a-z0-9.-]*(:[0-9]+)?$ ]] || die 'invalid REGISTRY_HOST in target config'
[[ "${IMAGE_REPOSITORY%%/*}" == "$REGISTRY_HOST" ]] || die 'IMAGE_REPOSITORY host does not match REGISTRY_HOST'
[[ "$COMPOSE_DIR" == /* && "$COMPOSE_FILE" == /* ]] || die 'Compose paths must be absolute'
COMPOSE_DIR="$(realpath -e -- "$COMPOSE_DIR")" || die 'COMPOSE_DIR must exist'
COMPOSE_FILE="$(realpath -e -- "$COMPOSE_FILE")" || die 'COMPOSE_FILE must exist'
[[ -d "$COMPOSE_DIR" && -f "$COMPOSE_FILE" ]] || die 'Compose directory or file is invalid'
[[ "$COMPOSE_FILE" == "$COMPOSE_DIR/"* ]] || die 'COMPOSE_FILE must be inside COMPOSE_DIR'
[[ "$COMPOSE_PROJECT_NAME" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die 'invalid COMPOSE_PROJECT_NAME'
[[ "$COMPOSE_SERVICE" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die 'invalid COMPOSE_SERVICE'
[[ "$COMPOSE_IMAGE_ENV" =~ ^[A-Z_][A-Z0-9_]*$ ]] || die 'invalid COMPOSE_IMAGE_ENV'
if [[ "$operation" == deploy ]]; then
  [[ "$image" == "${IMAGE_REPOSITORY}@sha256:"* ]] || die 'image repository is not allowed for this target'
fi

assert_root_managed_path "$COMPOSE_DIR"
assert_root_managed_path "$COMPOSE_FILE"

[[ ! -L "$STATE_DIR" ]] || die 'state directory must not be a symlink'
mkdir -p "$STATE_DIR"
chmod 0700 "$STATE_DIR"
assert_root_managed_path "$STATE_DIR"
state_file="${STATE_DIR}/${target}.images"
exec 9>"/run/lock/deployctl-${target}.lock"
flock -w 300 9 || die 'another deployment for this target is still running'

registry_config_dir="$(mktemp -d /run/deployctl-docker.XXXXXX)" || die 'could not create temporary registry credentials directory'
trap 'rm -rf -- "$registry_config_dir"' EXIT
chmod 0700 "$registry_config_dir"
export DOCKER_CONFIG="$registry_config_dir"
if ! printf '%s' "$registry_token" | docker login "$REGISTRY_HOST" --username "$registry_username" --password-stdin >/dev/null 2>&1; then
  die "could not authenticate to ${REGISTRY_HOST}"
fi
chmod 0600 "${DOCKER_CONFIG}/config.json" || die 'could not restrict temporary registry credentials'
unset registry_token

compose=(docker compose --project-directory "$COMPOSE_DIR" --project-name "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE")

image_is_available() {
  docker image inspect "$1" >/dev/null 2>&1
}

ensure_image_available() {
  local candidate="$1"
  if image_is_available "$candidate"; then
    return 0
  fi
  if [[ "$candidate" == "${IMAGE_REPOSITORY}@sha256:"* ]]; then
    docker pull "$candidate" || return 1
    return 0
  fi
  return 1
}

wait_for_health() {
  local container_id state health deadline
  deadline=$((SECONDS + 150))
  while (( SECONDS < deadline )); do
    container_id="$("${compose[@]}" ps -q "$COMPOSE_SERVICE")" || return 1
    [[ -n "$container_id" && "$container_id" != *$'\n'* ]] || return 1
    state="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null)" || return 1
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id" 2>/dev/null)" || return 1
    [[ "$state" == running ]] || return 1
    [[ "$health" == healthy ]] && return 0
    [[ "$health" == unhealthy || "$health" == missing ]] && return 1
    sleep 5
  done
  return 1
}

apply_image() {
  local candidate="$1"
  ensure_image_available "$candidate" || return 1
  env "${COMPOSE_IMAGE_ENV}=${candidate}" "${compose[@]}" up \
    --detach --no-deps --no-build --pull never "$COMPOSE_SERVICE" || return 1
  wait_for_health
}

write_state() {
  local current="$1" previous="$2" temporary
  temporary="$(mktemp "${STATE_DIR}/.${target}.XXXXXX")" || return 1
  if ! printf '%s\n%s\n' "$current" "$previous" > "$temporary"; then
    rm -f "$temporary"
    return 1
  fi
  chmod 0600 "$temporary" || return 1
  mv -f "$temporary" "$state_file"
}

if [[ "$operation" == deploy ]]; then
  container_ids="$("${compose[@]}" ps --all --quiet "$COMPOSE_SERVICE")" || die 'could not inspect the existing service container'
  [[ "$container_ids" != *$'\n'* ]] || die 'deployment target must use exactly one Compose container'
  container_image=''
  if [[ -n "$container_ids" ]]; then
    container_image="$(docker inspect --format '{{.Config.Image}}' "$container_ids")" || die 'could not identify the existing service image'
    [[ -n "$container_image" ]] || die 'the existing service container has no image reference'
  fi
  if ! apply_image "$image"; then
    if [[ -n "$container_image" ]]; then
      if apply_image "$container_image"; then
        die 'new image failed health checks; the previous image was restored'
      fi
      die 'new image failed health checks and automatic rollback failed; inspect the server before retrying'
    fi
    "${compose[@]}" rm --force "$COMPOSE_SERVICE" >/dev/null 2>&1 || true
    die 'initial image failed health checks; no previous release existed, so the new container was removed'
  fi
  if ! write_state "$image" "$container_image"; then
    if [[ -n "$container_image" ]] && apply_image "$container_image"; then
      die 'release state could not be saved; the previous image was restored'
    fi
    die 'release state could not be saved; inspect the service before retrying'
  fi
  printf 'deployed %s to %s\n' "$image" "$target"
  exit 0
fi

[[ -f "$state_file" && ! -L "$state_file" ]] || die 'no saved rollback image is available'
[[ "$(stat -c '%u:%a' "$state_file")" == '0:600' ]] || die 'release state must be root-owned with mode 0600'
mapfile -t state < "$state_file"
[[ "${#state[@]}" -eq 2 && -n "${state[0]}" ]] || die 'saved release state is invalid'
current_image="${state[0]}"
previous_image="${state[1]}"
[[ -n "$previous_image" ]] || die 'no previous release is available for rollback'
if ! apply_image "$previous_image"; then
  die 'rollback image failed health checks; the current release state was preserved'
fi
if ! write_state "$previous_image" "$previous_image"; then
  if apply_image "$current_image"; then
    die 'rollback state could not be saved; the current image was restored'
  fi
  die 'rollback state could not be saved and the current image could not be restored; inspect the service'
fi
printf 'rolled back %s to %s\n' "$target" "$previous_image"
