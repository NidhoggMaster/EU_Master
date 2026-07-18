#!/bin/zsh

set -u

APP_NAME="EU Master Application Manager"
ROOT_DIR="${0:A:h}"
CODEX_NODE_DIR="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
CODEX_PNPM="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm"

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
    if [[ -x "$CODEX_NODE_DIR/node" ]]; then
      export PATH="$CODEX_NODE_DIR:$PATH"
      major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || print 0)"
    fi
  fi
  if [[ "$major" != <-> || "$major" -lt 20 ]]; then
    fail "需要 Node.js 20 或更高版本。请安装 Node.js，或从 Codex 内运行本脚本。"
  fi
}

function resolve_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    PNPM_CMD=(pnpm)
  elif [[ -x "$CODEX_PNPM" ]]; then
    PNPM_CMD=("$CODEX_PNPM")
  elif command -v corepack >/dev/null 2>&1; then
    PNPM_CMD=(corepack pnpm)
  else
    fail "找不到 pnpm。请安装 pnpm，或从 Codex 内运行本脚本。"
  fi
}

function port_is_free() {
  ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

function choose_port() {
  SELECTED_PORT="${PORT:-3000}"
  if port_is_free "$SELECTED_PORT"; then
    return
  fi
  for candidate in {3001..3010}; do
    if port_is_free "$candidate"; then
      SELECTED_PORT="$candidate"
      return
    fi
  done
  fail "3000-3010 端口都被占用。请关闭其他本地服务后重试。"
}

function open_when_ready() {
  if command -v curl >/dev/null 2>&1; then
    for _attempt in {1..90}; do
      if curl -fsS "$SITE_URL" >/dev/null 2>&1; then
        open "$SITE_URL" >/dev/null 2>&1 || true
        return
      fi
      sleep 1
    done
  else
    sleep 4
  fi
  open "$SITE_URL" >/dev/null 2>&1 || true
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
  print ""
  print "已创建 .env.local。首次完整使用控制台前，请填写 SUPABASE_SESSION_POOLER_URL。"
fi

if grep -q "YOUR_URL_ENCODED_DATABASE_PASSWORD" ".env.local" 2>/dev/null || ! grep -q "^SUPABASE_SESSION_POOLER_URL=postgres" ".env.local" 2>/dev/null; then
  print ""
  print "提示：.env.local 里的 Supabase 连接串尚未配置完整。"
  print "首页仍会启动；控制台读取项目库和个人档案需要填写该连接串后重启。"
fi

if [[ ! -f "node_modules/.modules.yaml" || "package.json" -nt "node_modules/.modules.yaml" || "pnpm-lock.yaml" -nt "node_modules/.modules.yaml" ]]; then
  print ""
  print "正在安装或更新依赖..."
  "${PNPM_CMD[@]}" install --frozen-lockfile || fail "依赖安装失败。"
fi

choose_port
SITE_URL="http://localhost:$SELECTED_PORT"
export EU_MASTER_BASE_URL="${EU_MASTER_BASE_URL:-$SITE_URL}"

print ""
print "正在启动开发服务：$SITE_URL"
print "浏览器会在服务就绪后自动打开。保持这个窗口打开；按 Ctrl-C 可停止网站。"
print ""

open_when_ready &
"${PNPM_CMD[@]}" exec next dev -p "$SELECTED_PORT"
exit_code=$?

print ""
print "开发服务已停止，退出码：$exit_code"
print "按任意键关闭窗口。"
read -k 1
exit "$exit_code"
