#!/bin/zsh

set -u

APP_NAME="EU Master Application Manager"
ROOT_DIR="${0:A:h}"
CODEX_NODE_DIR="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
CODEX_PNPM="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm"
RUN_MODE="production"
[[ "${1:-}" == "--dev" ]] && RUN_MODE="development"
RUN_LABEL="生产"
[[ "$RUN_MODE" == "development" ]] && RUN_LABEL="开发"

function fail() {
  print ""
  print "启动失败：$1"
  print ""
  print "按任意键关闭窗口。"
  read -k 1
  exit 1
}

function ensure_node() {
  local major="0"
  if command -v node >/dev/null 2>&1; then
    major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || print 0)"
  fi
  if [[ "$major" != <-> || "$major" -lt 20 ]]; then
    [[ -x "$CODEX_NODE_DIR/node" ]] && export PATH="$CODEX_NODE_DIR:$PATH"
    major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || print 0)"
  fi
  [[ "$major" == <-> && "$major" -ge 20 ]] || fail "需要 Node.js 20 或更高版本。"
}

function resolve_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    PNPM_CMD=(pnpm)
  elif [[ -x "$CODEX_PNPM" ]]; then
    PNPM_CMD=("$CODEX_PNPM")
  elif command -v corepack >/dev/null 2>&1; then
    PNPM_CMD=(corepack pnpm)
  else
    fail "找不到 pnpm。"
  fi
}

function app_is_ready() {
  command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 "$1/api/health" 2>/dev/null | grep -q '"status":"ready"'
}

function port_is_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

function choose_port() {
  SELECTED_PORT="${PORT:-3000}"
  SITE_URL="http://127.0.0.1:$SELECTED_PORT"
  if ! port_is_free "$SELECTED_PORT"; then
    if app_is_ready "$SITE_URL"; then
      print "网站已在运行：$SITE_URL"
      open "$SITE_URL" >/dev/null 2>&1 || true
      exit 0
    fi
    for candidate in {3001..3010}; do
      if port_is_free "$candidate"; then
        SELECTED_PORT="$candidate"
        SITE_URL="http://127.0.0.1:$SELECTED_PORT"
        return
      fi
    done
    fail "3000-3010 端口都被占用。"
  fi
}

function build_is_stale() {
  [[ -f ".next/BUILD_ID" ]] || return 0
  [[ -n "$(find src public scripts package.json pnpm-lock.yaml next.config.ts tsconfig.json -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]]
}

function open_when_ready() {
  for _attempt in {1..120}; do
    if app_is_ready "$SITE_URL"; then
      open "$SITE_URL" >/dev/null 2>&1 || true
      print "网站已就绪：$SITE_URL"
      return
    fi
    sleep 1
  done
  print "网站启动超时，请查看上方日志。"
}

cd "$ROOT_DIR" || fail "无法进入项目目录。"
print "$APP_NAME"
print "项目目录：$ROOT_DIR"

ensure_node
typeset -a PNPM_CMD
resolve_pnpm
print "Node: $(node -v)"
print "pnpm: $("${PNPM_CMD[@]}" -v)"

if [[ ! -f ".env.local" ]]; then
  cp ".env.example" ".env.local" || fail "无法创建 .env.local。"
  print "已创建 .env.local；本地 CSV 模式可直接使用。"
fi

DEPENDENCY_STAMP="node_modules/.eu-master-dependencies"
DEPENDENCY_HASH="$(node -e 'const fs=require("fs"),crypto=require("crypto"); const h=crypto.createHash("sha256"); h.update(fs.readFileSync("package.json")); h.update(fs.readFileSync("pnpm-lock.yaml")); process.stdout.write(h.digest("hex"));')"
if [[ ! -f "node_modules/.modules.yaml" || ! -f "$DEPENDENCY_STAMP" || "$(<"$DEPENDENCY_STAMP")" != "$DEPENDENCY_HASH" ]]; then
  print "正在安装或更新依赖…"
  "${PNPM_CMD[@]}" install --frozen-lockfile || fail "依赖安装失败。"
  print -r -- "$DEPENDENCY_HASH" > "$DEPENDENCY_STAMP"
fi

if grep -q "YOUR_URL_ENCODED_DATABASE_PASSWORD" ".env.local" 2>/dev/null || ! grep -q "^SUPABASE_SESSION_POOLER_URL=postgres" ".env.local" 2>/dev/null; then
  print "提示：Supabase 未配置；本地 CSV 模式不受影响。"
fi

choose_port

if [[ "$RUN_MODE" == "production" ]] && build_is_stale; then
  print "生产构建不存在或已过期，正在构建…"
  "${PNPM_CMD[@]}" build || fail "生产构建失败。"
fi

export EU_MASTER_BASE_URL="$SITE_URL"
print ""
print "正在启动${RUN_LABEL}服务：$SITE_URL"
print "浏览器会在健康检查通过后自动打开；按 Ctrl-C 停止网站。"
print ""

open_when_ready &
if [[ "$RUN_MODE" == "development" ]]; then
  "${PNPM_CMD[@]}" exec next dev -H 127.0.0.1 -p "$SELECTED_PORT"
else
  "${PNPM_CMD[@]}" exec next start -H 127.0.0.1 -p "$SELECTED_PORT"
fi
exit_code=$?

print ""
print "网站已停止，退出码：$exit_code"
print "按任意键关闭窗口。"
read -k 1
exit "$exit_code"
