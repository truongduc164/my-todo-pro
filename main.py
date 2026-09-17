"""
CLI Todo List App - Quản lý công việc bằng dòng lệnh.
Dữ liệu lưu trong SQLite (todo.db), không cần cài thêm thư viện.

Cách dùng:
    python main.py add "Nội dung" --priority 2
    python main.py list
    python main.py list --status done
    python main.py list --search "họp"
    python main.py list -q "báo cáo"
    python main.py done 3
    python main.py delete 3
    python main.py edit 5 --content "Nội dung mới"
    python main.py edit 5 -p 3
    python main.py summary
    python main.py clear-done
    python main.py serve              # giao diện web
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# ── Fix lỗi encoding trên Windows ────────────────────────────────────
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ── Màu cho CLI (ANSI) ───────────────────────────────────────────────
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
GRAY = "\033[90m"

def cprint(text, color=None, bold=False):
    """In text có màu (hỗ trợ Windows Terminal / PowerShell / Linux / macOS)."""
    prefix = ""
    if bold:
        prefix += BOLD
    if color:
        prefix += color
    print(prefix + text + RESET)

# ── Đường dẫn database ──────────────────────────────────────────────
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "todo.db")

# Ánh xạ priority ra text để hiển thị
PRIORITY_MAP = {1: "Thấp", 2: "TB  ", 3: "Cao "}


# ══════════════════════════════════════════════════════════════════════
#  DATABASE
# ══════════════════════════════════════════════════════════════════════

def get_conn():
    """Mở kết nối SQLite, tự động tạo file nếu chưa có."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row       # để truy cập cột theo tên
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Tạo bảng tasks nếu chưa tồn tại."""
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            content       TEXT    NOT NULL,
            priority      INTEGER DEFAULT 1  CHECK(priority BETWEEN 1 AND 3),
            status        TEXT    DEFAULT 'pending' CHECK(status IN ('pending','done')),
            created_at    TEXT    DEFAULT (datetime('now','localtime')),
            completed_at  TEXT,
            due_date      TEXT
        )
    """)
    # Thêm cột due_date nếu database cũ chưa có
    try:
        conn.execute("ALTER TABLE tasks ADD COLUMN due_date TEXT")
    except sqlite3.OperationalError:
        pass  # cột đã tồn tại
    conn.commit()
    conn.close()


# ══════════════════════════════════════════════════════════════════════
#  CÁC HÀM XỬ LÝ LỆNH
# ══════════════════════════════════════════════════════════════════════

def add_task(content: str, priority: int, due_date: str = None):
    """Thêm một công việc mới."""
    if priority not in (1, 2, 3):
        cprint("❌ Priority phải là 1 (thấp), 2 (trung bình) hoặc 3 (cao).", RED)
        sys.exit(1)

    conn = get_conn()
    conn.execute(
        "INSERT INTO tasks (content, priority, due_date) VALUES (?, ?, ?)",
        (content, priority, due_date)
    )
    conn.commit()
    task_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    cprint(f"✅ Đã thêm công việc #{task_id}: {content}", GREEN)


def list_tasks(status_filter: str, search: str = None):
    """Hiển thị danh sách công việc, có thể lọc theo trạng thái và tìm kiếm."""
    conn = get_conn()

    if status_filter == "all":
        rows = conn.execute(
            "SELECT * FROM tasks ORDER BY priority DESC, created_at ASC"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, created_at ASC",
            (status_filter,)
        ).fetchall()

    # Lọc theo từ khóa tìm kiếm (nếu có)
    if search:
        search_lower = search.lower()
        rows = [r for r in rows if search_lower in r["content"].lower()]

    conn.close()

    if not rows:
        cprint("📭 Không có công việc nào.", GRAY)
        return

    # In tiêu đề bảng
    cprint(f"{'ID':<4} {'Ưu tiên':<8} {'Hạn':<12} {'Trạng thái':<10} Nội dung", CYAN, bold=True)
    print("-" * 80)
    for r in rows:
        prio_text = PRIORITY_MAP.get(r["priority"], "?")
        if r["status"] == "done":
            status_text = f"{GREEN}✅ Done{RESET}"
        else:
            status_text = "⬜ Pending"
        due_text = r["due_date"] if r["due_date"] else "-"
        print(f"{r['id']:<4} {prio_text:<8} {due_text:<12} {status_text:<10} {r['content']}")


def mark_done(task_id: int):
    """Đánh dấu công việc là hoàn thành."""
    conn = get_conn()
    cur = conn.execute("SELECT id, status FROM tasks WHERE id = ?", (task_id,))
    row = cur.fetchone()

    if row is None:
        cprint(f"❌ Không tìm thấy công việc #{task_id}.", RED)
        conn.close()
        sys.exit(1)
    if row["status"] == "done":
        print(f"⚠️  Công việc #{task_id} đã hoàn thành từ trước.")
        conn.close()
        return

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?",
        (now, task_id)
    )
    conn.commit()
    conn.close()
    cprint(f"✅ Đã hoàn thành công việc #{task_id}.", GREEN)


def delete_task(task_id: int):
    """Xóa vĩnh viễn một công việc."""
    conn = get_conn()
    cur = conn.execute("SELECT id, content FROM tasks WHERE id = ?", (task_id,))
    row = cur.fetchone()

    if row is None:
        cprint(f"❌ Không tìm thấy công việc #{task_id}.", RED)
        conn.close()
        sys.exit(1)

    conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    cprint(f"🗑️  Đã xóa công việc #{task_id}: {row['content']}", YELLOW)


def edit_task(task_id: int, content: str = None, priority: int = None, due_date: str = None):
    """Sửa nội dung, mức ưu tiên hoặc hạn hoàn thành của công việc."""
    if content is None and priority is None and due_date is None:
        cprint("❌ Bạn phải cung cấp ít nhất một trong các tham số: --content, --priority, --due.", RED)
        sys.exit(1)

    if priority is not None and priority not in (1, 2, 3):
        cprint("❌ Priority phải là 1 (thấp), 2 (trung bình) hoặc 3 (cao).", RED)
        sys.exit(1)

    conn = get_conn()
    cur = conn.execute("SELECT id, content, priority, due_date FROM tasks WHERE id = ?", (task_id,))
    row = cur.fetchone()

    if row is None:
        cprint(f"❌ Không tìm thấy công việc #{task_id}.", RED)
        conn.close()
        sys.exit(1)

    new_content = content if content is not None else row["content"]
    new_priority = priority if priority is not None else row["priority"]
    new_due = due_date if due_date is not None else row["due_date"]

    conn.execute(
        "UPDATE tasks SET content = ?, priority = ?, due_date = ? WHERE id = ?",
        (new_content, new_priority, new_due, task_id)
    )
    conn.commit()
    conn.close()

    cprint(f"✏️  Đã cập nhật công việc #{task_id}", CYAN)
    if content is not None:
        print(f"   Nội dung mới: {new_content}")
    if priority is not None:
        print(f"   Ưu tiên mới: {PRIORITY_MAP.get(new_priority, '?')}")
    if due_date is not None:
        print(f"   Hạn mới: {new_due if new_due else 'Không có'}")


def show_summary():
    """Thống kê số lượng công việc theo trạng thái và mức ưu tiên."""
    conn = get_conn()

    total = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    pending = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = 'pending'").fetchone()[0]
    done = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = 'done'").fetchone()[0]

    cprint("📊 THỐNG KÊ CÔNG VIỆC", CYAN, bold=True)
    print("-" * 30)
    print(f"   Tổng số   : {BOLD}{total}{RESET}")
    cprint(f"   Đang làm  : {pending}", YELLOW)
    cprint(f"   Hoàn thành: {done}", GREEN)
    print()

    # Thống kê theo mức ưu tiên
    cprint("📌 Theo mức ưu tiên:", bold=True)
    for p, label in [(3, "Cao"), (2, "Trung bình"), (1, "Thấp")]:
        cnt = conn.execute(
            "SELECT COUNT(*) FROM tasks WHERE priority = ? AND status = 'pending'", (p,)
        ).fetchone()[0]
        print(f"   {label:<10}: {cnt} đang làm")

    conn.close()


def clear_done():
    """Xóa tất cả công việc đã hoàn thành."""
    conn = get_conn()
    cur = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = 'done'")
    count = cur.fetchone()[0]

    if count == 0:
        print("📭 Không có công việc nào đã hoàn thành để xóa.")
        conn.close()
        return

    conn.execute("DELETE FROM tasks WHERE status = 'done'")
    conn.commit()
    conn.close()
    cprint(f"🗑️  Đã xóa {count} công việc đã hoàn thành.", YELLOW)


# ══════════════════════════════════════════════════════════════════════
#  WEB SERVER (python main.py serve)
# ══════════════════════════════════════════════════════════════════════

WEB_HTML = r"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📋 My Todo</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#eee;min-height:100vh;display:flex;justify-content:center;padding:20px}
.container{width:100%;max-width:650px}
h1{text-align:center;margin-bottom:24px;font-size:28px}
.card{background:#16213e;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 4px 20px rgba(0,0,0,.3)}
.card h2{font-size:18px;margin-bottom:12px;color:#0f3460}
form{display:flex;gap:8px}
form input,form select,form button{padding:10px 14px;border:none;border-radius:8px;font-size:15px}
form input{flex:1;background:#0f3460;color:#eee}
form input::placeholder{color:#8899aa}
form select{background:#0f3460;color:#eee;cursor:pointer}
form button{background:#e94560;color:#fff;cursor:pointer;font-weight:600;min-width:80px}
form button:hover{background:#c23152}
.task-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #1a1a2e}
.task-row:last-child{border-bottom:none}
.task-row.overdue { background: #3a1f1f; border-left: 4px solid #e94560; }
.task-prio{font-size:11px;padding:3px 8px;border-radius:4px;font-weight:600;min-width:60px;text-align:center}
.prio-high{background:#e94560;color:#fff}
.prio-mid{background:#f5a623;color:#1a1a2e}
.prio-low{background:#4ecca3;color:#1a1a2e}
.task-content{flex:1;font-size:15px}
.task-content.done{text-decoration:line-through;color:#667}
.task-actions{display:flex;gap:6px}
.task-actions button{padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
.btn-done{background:#4ecca3;color:#1a1a2e}
.btn-done:hover{background:#3ba882}
.btn-del{background:#444;color:#eee}
.btn-del:hover{background:#e94560}
.btn-edit{background:#5c6bc0;color:#fff}
.btn-edit:hover{background:#3f51b5}
.summary{display:flex;gap:16px;text-align:center}
.summary-item{flex:1;background:#0f3460;padding:14px;border-radius:8px}
.summary-item .num{font-size:28px;font-weight:700}
.summary-item .label{font-size:12px;color:#889;margin-top:4px}
.empty{text-align:center;padding:24px;color:#667;font-style:italic}
.footer{text-align:center;margin-top:16px;color:#556;font-size:12px}
#editModal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.65);z-index:1000;display:none;align-items:center;justify-content:center}
.filter-chip{padding:5px 11px;border:none;border-radius:999px;background:#0f3460;color:#eee;font-size:12px;cursor:pointer;font-weight:500;transition:background .1s,transform .05s}
.filter-chip:hover{background:#1f4a7a}
.filter-chip:active{transform:scale(0.97)}
.filter-chip.active{background:#e94560;color:#fff}
.filter-chip.active:hover{background:#c23152}
#editModal .modal-box{background:#16213e;border:1px solid #2a3a5e;border-radius:12px;width:90%;max-width:420px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#editModal h3{margin:0 0 4px;font-size:18px;color:#eee;display:flex;align-items:center;justify-content:space-between}
#editModal label{display:block;font-size:12px;color:#889;margin:12px 0 4px}
#editModal input,#editModal select{width:100%;padding:10px 14px;border:none;border-radius:8px;background:#0f3460;color:#eee;font-size:15px;box-sizing:border-box}
#editModal input:focus,#editModal select:focus{outline:none;box-shadow:0 0 0 3px rgba(233,69,96,.35);background:#0a2a50}
#editModal .row{display:flex;gap:12px}
#editModal .row > div{flex:1}
#editModal .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
#editModal .actions button{padding:10px 18px;border:none;border-radius:8px;cursor:pointer;font-size:14px}
#editModal .btn-cancel{background:#444;color:#eee}
#editModal .btn-cancel:hover{background:#555}
#editModal .btn-save{background:#e94560;color:#fff;font-weight:600}
#editModal .btn-save:hover{background:#c23152}
#editModal .modal-close{font-size:22px;line-height:1;color:#889;cursor:pointer;padding:0 2px;user-select:none}
#editModal .modal-close:hover{color:#e94560}

/* Toast Notification System (Feature 3) */
#toastContainer{position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.toast{min-width:240px;max-width:320px;background:#16213e;color:#eee;padding:10px 14px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.45);display:flex;align-items:center;gap:8px;font-size:14px;border-left:4px solid #4ecca3;animation:slideInToast .18s ease-out}
.toast.error{border-left-color:#e94560}
.toast .msg{flex:1;line-height:1.3}
.toast button{background:#e94560;color:#fff;border:none;border-radius:4px;padding:3px 9px;font-size:12px;font-weight:600;cursor:pointer}
.toast button:hover{background:#c23152}
.toast .x{margin-left:4px;cursor:pointer;font-size:18px;opacity:.6;padding:0 4px}
.toast .x:hover{opacity:1}
@keyframes slideInToast{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
</style>
</head>
<body>
<div class="container">
<h1>📋 My Todo</h1>

<div class="card">
<h2>➕ Thêm công việc</h2>
<form id="addForm">
<input id="content" placeholder="Nội dung công việc..." required autofocus>
<select id="priority">
<option value="3">🔴 Cao</option>
<option value="2" selected>🟡 TB</option>
<option value="1">🟢 Thấp</option>
</select>
<input id="due" type="date" style="background:#0f3460;color:#eee;border:none;border-radius:8px;padding:10px 8px;font-size:14px;">
<button type="submit">Thêm</button>
</form>
</div>

<!-- Filter Toolbar: Live Search + composable filters (Feature 2) -->
<div class="card" style="padding:14px 20px 10px;">
  <input id="webSearch" placeholder="🔍 Tìm kiếm công việc (nội dung hoặc hạn)..." style="width:100%;margin-bottom:8px;background:#0f3460;color:#eee;border:none;border-radius:8px;padding:10px 14px;font-size:15px;">
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:2px;">
    <span style="font-size:11px;color:#889;margin-right:2px;white-space:nowrap;">Lọc:</span>
    <button type="button" class="filter-chip active" data-status="all">Tất cả</button>
    <button type="button" class="filter-chip" data-status="pending">Đang làm</button>
    <button type="button" class="filter-chip" data-status="done">Đã xong</button>
    <button type="button" class="filter-chip" data-status="overdue">⚠️ Quá hạn</button>
    <span style="width:4px;"></span>
    <button type="button" class="filter-chip" data-quick="dueToday">📅 Hôm nay</button>
    <button type="button" class="filter-chip" data-quick="highPrio">🔴 Ưu tiên cao</button>
  </div>
  <div id="filterCount" style="margin-top:4px;font-size:12px;color:#8899aa;">Hiển thị 0 / 0 công việc</div>
</div>

<div class="card">
<h2>📌 Đang làm</h2>
<div id="pendingList"></div>
</div>

<div class="card">
<h2>✅ Đã xong</h2>
<div id="doneList"></div>
</div>

<div class="card">
<h2>📊 Thống kê</h2>
<div class="summary" id="summary"></div>
<div style="text-align:center;margin-top:12px;">
<button onclick="clearDone()" style="background:#e94560;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;">🗑️ Xóa tất cả đã xong</button>
</div>
</div>

<div class="footer">My Todo &bull; <span id="clock"></span></div>
</div>

<!-- Edit Modal (rich self-contained: content + priority + due_date) -->
<div id="editModal" onclick="if(event.target.id==='editModal') hideEditModal()">
  <div class="modal-box" onclick="event.stopImmediatePropagation()">
    <h3>
      <span>✏️ Sửa công việc #<span id="editTaskId"></span></span>
      <span class="modal-close" onclick="hideEditModal()" title="Đóng (Esc)">&times;</span>
    </h3>
    <label>Nội dung</label>
    <input id="editContent" placeholder="Nội dung công việc..." autocomplete="off">
    <div class="row">
      <div>
        <label>Ưu tiên</label>
        <select id="editPriority">
          <option value="3">🔴 Cao</option>
          <option value="2">🟡 TB</option>
          <option value="1">🟢 Thấp</option>
        </select>
      </div>
      <div>
        <label>Hạn hoàn thành</label>
        <input id="editDue" type="date" title="Chọn ngày hạn (để trống = xóa hạn)">
      </div>
    </div>
    <div class="actions">
      <button type="button" class="btn-cancel" onclick="hideEditModal()">Hủy</button>
      <button type="button" class="btn-save" onclick="saveEdit()">💾 Lưu thay đổi</button>
    </div>
    <div style="margin-top:8px;font-size:11px;color:#556;text-align:center;">Nhấn Esc hoặc click ngoài để hủy</div>
  </div>
</div>

<!-- Toast container for non-blocking notifications (Feature 3) -->
<div id="toastContainer"></div>

<script>
const API = '/api';
let fullData = null;

// === Feature 3: Optimistic Updates + Toast Notification System ===
let undoDeleteState = { task: null, timer: null, index: null };
const UNDO_TIMEOUT = 5000;

function showToast(message, type = 'success', options = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' error' : ''}`;
  const msgSpan = document.createElement('span');
  msgSpan.className = 'msg';
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);
  if (options.undoBtn && typeof options.undoBtn === 'function') {
    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'Hoàn tác';
    undoBtn.onclick = () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      options.undoBtn();
    };
    toast.appendChild(undoBtn);
  }
  const closeX = document.createElement('span');
  closeX.className = 'x';
  closeX.textContent = '×';
  closeX.onclick = () => { if (toast.parentNode) toast.parentNode.removeChild(toast); };
  toast.appendChild(closeX);
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4800);
}

function recomputeSummary() {
  if (!fullData || !fullData.tasks) return;
  const tasks = fullData.tasks;
  const total = tasks.length;
  const pending = tasks.filter(t => t.status !== 'done').length;
  const done = total - pending;
  fullData.summary = { total, pending, done };
}


async function load() {
const r = await fetch(API+'/tasks');
fullData = await r.json();
applyFilters();
document.getElementById('clock').textContent = new Date().toLocaleString('vi-VN');
}

function isOverdue(task) {
    if (!task || !task.due_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today;
}

function updateFilterCount(shown, total) {
    const el = document.getElementById('filterCount');
    if (el) {
        el.textContent = `Hiển thị ${shown} / ${total} công việc`;
    }
}

function applyFilters() {
    const searchBox = document.getElementById('webSearch');
    const keyword = (searchBox ? searchBox.value : '').toLowerCase().trim();

    if (!fullData || !fullData.tasks) {
        if (fullData) render(fullData);
        updateFilterCount(0, 0);
        return;
    }

    // Read current filter state from toolbar chips (live DOM)
    let statusFilter = 'all';
    const activeStatusChip = document.querySelector('.filter-chip.active[data-status]');
    if (activeStatusChip) statusFilter = activeStatusChip.getAttribute('data-status') || 'all';

    const dueTodayActive = !!document.querySelector('.filter-chip.active[data-quick="dueToday"]');
    const highPrioActive = !!document.querySelector('.filter-chip.active[data-quick="highPrio"]');

    const today = new Date().toISOString().split('T')[0];

    let filteredTasks = fullData.tasks.filter(t => {
        // 1. Search filter (content or due_date)
        if (keyword) {
            const inContent = (t.content || '').toLowerCase().includes(keyword);
            const inDue = t.due_date && t.due_date.includes(keyword);
            if (!inContent && !inDue) return false;
        }

        // 2. Status / special filters (mutually exclusive main filter)
        if (statusFilter === 'pending' && t.status !== 'pending') return false;
        if (statusFilter === 'done' && t.status !== 'done') return false;
        if (statusFilter === 'overdue') {
            if (t.status !== 'pending' || !isOverdue(t)) return false;
        }

        // 3. Quick filters (composable ANDs)
        if (dueTodayActive && t.due_date !== today) return false;
        if (highPrioActive && t.priority !== 3) return false;

        return true;
    });

    const filtered = { ...fullData, tasks: filteredTasks };

    updateFilterCount(filteredTasks.length, fullData.tasks.length);
    render(filtered);
}

function initFilterListeners() {
    // Status filter chips: single-select (radio behavior)
    document.querySelectorAll('.filter-chip[data-status]').forEach(chip => {
        chip.onclick = function() {
            document.querySelectorAll('.filter-chip[data-status]').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            applyFilters();
        };
    });

    // Quick filter chips: multi-select toggles
    document.querySelectorAll('.filter-chip[data-quick]').forEach(chip => {
        chip.onclick = function() {
            this.classList.toggle('active');
            applyFilters();
        };
    });

    // Ensure search input triggers live filtering (prominent in toolbar)
    const searchBox = document.getElementById('webSearch');
    if (searchBox) {
        searchBox.oninput = applyFilters;
        // also support clear via Esc for nice UX
        searchBox.onkeydown = function(e) {
            if (e.key === 'Escape') {
                searchBox.value = '';
                applyFilters();
            }
        };
    }
}

function render(data) {
let pHtml='', dHtml='';

// Separate pending and done
let pending = data.tasks.filter(t => t.status !== 'done');
let done = data.tasks.filter(t => t.status === 'done');

// Sort pending by due_date (earliest first, nulls last), then by priority desc
const today = new Date().toISOString().split('T')[0];
pending.sort((a, b) => {
    const da = a.due_date || '9999-12-31';
    const db = b.due_date || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return b.priority - a.priority;
});

pending.forEach(t => {
    const plabel = {3:'Cao',2:'TB',1:'Thấp'}[t.priority]||'?';
    const pcls = {3:'prio-high',2:'prio-mid',1:'prio-low'}[t.priority]||'';
    const isOverdue = t.due_date && t.due_date < today;
    const overdueBadge = isOverdue ? ` <span style="font-size:11px;background:#e94560;color:white;padding:1px 5px;border-radius:3px;margin-left:4px;">QUÁ HẠN</span>` : '';
    const due = t.due_date ? ` <span style="font-size:12px;color:${isOverdue ? '#ff6b6b' : '#f5a623'};margin-left:6px;">📅 ${t.due_date}</span>` : '';
    const overdueClass = isOverdue ? 'overdue' : '';
    const row = `<div class="task-row ${overdueClass}" ondblclick="if(!(event.target.closest && event.target.closest('button'))) showEditModal(${t.id})">
<span class="task-prio ${pcls}">${plabel}</span>
<span class="task-content${t.status==='done'?' done':''}">${esc(t.content)}${due}${overdueBadge}</span>
<div class="task-actions">
${t.status==='pending'?`<button class="btn-done" onclick="markDone(${t.id})">Xong</button>`:''}
<button class="btn-edit" onclick="showEditModal(${t.id})">Sửa</button>
<button class="btn-del" onclick="del(${t.id})">Xóa</button>
</div></div>`;
    pHtml += row;
});

done.forEach(t => {
    const plabel = {3:'Cao',2:'TB',1:'Thấp'}[t.priority]||'?';
    const pcls = {3:'prio-high',2:'prio-mid',1:'prio-low'}[t.priority]||'';
    const due = t.due_date ? ` <span style="font-size:12px;color:#888;margin-left:6px;">📅 ${t.due_date}</span>` : '';
    const row = `<div class="task-row" ondblclick="if(!(event.target.closest && event.target.closest('button'))) showEditModal(${t.id})">
<span class="task-prio ${pcls}">${plabel}</span>
<span class="task-content done">${esc(t.content)}${due}</span>
<div class="task-actions">
<button class="btn-del" onclick="del(${t.id})">Xóa</button>
</div></div>`;
    dHtml += row;
});

document.getElementById('pendingList').innerHTML = pHtml || '<div class="empty">Không có việc đang làm 🎉</div>';
document.getElementById('doneList').innerHTML = dHtml || '<div class="empty">Chưa có việc nào hoàn thành</div>';

const s = data.summary;
document.getElementById('summary').innerHTML = `
<div class="summary-item"><div class="num">${s.total}</div><div class="label">Tổng</div></div>
<div class="summary-item"><div class="num">${s.pending}</div><div class="label">Đang làm</div></div>
<div class="summary-item"><div class="num">${s.done}</div><div class="label">Đã xong</div></div>
`;
}

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

document.getElementById('addForm').onsubmit = e => {
  e.preventDefault();
  const c = document.getElementById('content');
  const p = document.getElementById('priority');
  const d = document.getElementById('due');
  const content = c.value.trim();
  if (!content) {
    showToast('Nội dung không được để trống!', 'error');
    return;
  }
  const priority = +p.value;
  const dueDate = d.value || null;

  // Optimistic add with temporary negative ID
  const tempId = -Date.now();
  const optimisticTask = {
    id: tempId,
    content: content,
    priority: priority,
    due_date: dueDate,
    status: 'pending',
    completed_at: null
  };

  if (!fullData) fullData = { tasks: [], summary: { total: 0, pending: 0, done: 0 } };
  fullData.tasks.unshift(optimisticTask); // new at top of pending
  recomputeSummary();
  applyFilters();

  // Clear form immediately (optimistic UX)
  c.value = ''; d.value = ''; c.focus();
  showToast('Đã thêm công việc', 'success');

  // Background sync with server
  const body = { content: content, priority: priority };
  if (dueDate) body.due_date = dueDate;

  fetch(API + '/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => {
      if (!r.ok) throw new Error('Thêm thất bại');
      return r.json();
    })
    .then(() => {
      // Success: reload authoritative data (gets real ID + server state)
      load();
    })
    .catch(err => {
      // Revert optimistic add
      fullData.tasks = fullData.tasks.filter(t => t.id !== tempId);
      recomputeSummary();
      applyFilters();
      showToast('Không thể thêm: ' + (err.message || 'Lỗi mạng'), 'error');
    });
};

function markDone(id) {
  if (!fullData || !fullData.tasks) return;
  const task = fullData.tasks.find(t => t.id === id);
  if (!task || task.status === 'done') return;

  // Optimistic update
  const prevStatus = task.status;
  const prevCompleted = task.completed_at;
  task.status = 'done';
  task.completed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  recomputeSummary();
  applyFilters();
  showToast('Đã đánh dấu xong', 'success');

  // Background sync
  fetch(API + '/done/' + id, { method: 'POST' })
    .then(r => {
      if (!r.ok) throw new Error('Cập nhật thất bại');
    })
    .catch(() => {
      // Revert
      task.status = prevStatus;
      task.completed_at = prevCompleted;
      recomputeSummary();
      applyFilters();
      showToast('Lỗi cập nhật. Đã hoàn tác.', 'error');
    });
}

function del(id) {
  if (!fullData || !fullData.tasks) return;
  const idx = fullData.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const task = fullData.tasks[idx];

  // Special case: deleting a not-yet-synced optimistic add (temp id)
  if (id < 0) {
    fullData.tasks.splice(idx, 1);
    recomputeSummary();
    applyFilters();
    showToast('Đã hủy thêm công việc', 'success');
    return;
  }

  // Commit any previous pending undo delete immediately (fire-and-forget)
  if (undoDeleteState.timer) {
    clearTimeout(undoDeleteState.timer);
    const prev = undoDeleteState.task;
    if (prev && prev.id > 0) {
      fetch(API + '/delete/' + prev.id, { method: 'POST' }).catch(() => {});
    }
    undoDeleteState = { task: null, timer: null, index: null };
  }

  // Optimistic delete: remove immediately, support Undo
  const deletedTask = fullData.tasks.splice(idx, 1)[0];
  recomputeSummary();
  applyFilters();

  undoDeleteState = {
    task: deletedTask,
    index: idx,
    timer: setTimeout(() => {
      performActualDelete();
    }, UNDO_TIMEOUT)
  };

  showToast(`Đã xóa #${id}`, 'success', {
    undoBtn: () => undoLastDelete()
  });
}

function undoLastDelete() {
  if (!undoDeleteState.task || !undoDeleteState.timer) {
    showToast('Không thể hoàn tác nữa', 'error');
    return;
  }
  clearTimeout(undoDeleteState.timer);

  const { task, index } = undoDeleteState;
  if (index != null && index <= fullData.tasks.length) {
    fullData.tasks.splice(index, 0, task);
  } else if (task) {
    fullData.tasks.push(task);
  }
  recomputeSummary();
  applyFilters();

  const restoredId = task.id;
  undoDeleteState = { task: null, timer: null, index: null };
  showToast(`Đã khôi phục #${restoredId}`, 'success');
  // Note: server was never notified of delete (true undo before commit)
}

function performActualDelete() {
  const state = undoDeleteState;
  if (!state.task) return;
  const task = state.task;
  const taskId = task.id;
  undoDeleteState.timer = null;

  if (taskId < 0) {
    // Should not happen (guarded earlier)
    undoDeleteState.task = null;
    undoDeleteState.index = null;
    return;
  }

  fetch(API + '/delete/' + taskId, { method: 'POST' })
    .then(r => {
      if (!r.ok) throw new Error('Xóa thất bại');
      // Already removed from UI optimistically. Success.
      undoDeleteState.task = null;
      undoDeleteState.index = null;
    })
    .catch(() => {
      // Restore on server error
      const { task: t, index } = state;
      if (index != null && index <= fullData.tasks.length) {
        fullData.tasks.splice(index, 0, t);
      } else if (t) {
        fullData.tasks.push(t);
      }
      recomputeSummary();
      applyFilters();
      showToast(`Không xóa được #${taskId}. Đã khôi phục.`, 'error');
      undoDeleteState.task = null;
      undoDeleteState.index = null;
    });
}


function showEditModal(id) {
    if (!fullData || !fullData.tasks) return;
    const task = fullData.tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('editTaskId').textContent = id;
    document.getElementById('editContent').value = task.content || '';
    document.getElementById('editPriority').value = task.priority || 2;
    document.getElementById('editDue').value = task.due_date || '';
    document.getElementById('editModal').style.display = 'flex';
    // Rich UX: autofocus + select content for immediate editing
    setTimeout(function() {
      const c = document.getElementById('editContent');
      if (c) { c.focus(); c.select(); }
    }, 60);
}

function hideEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function saveEdit() {
  const id = parseInt(document.getElementById('editTaskId').textContent);
  if (!id) return;
  const content = document.getElementById('editContent').value.trim();
  const priority = parseInt(document.getElementById('editPriority').value);
  const due = document.getElementById('editDue').value;

  if (!content) {
    showToast('Nội dung không được để trống!', 'error');
    return;
  }

  if (!fullData || !fullData.tasks) {
    hideEditModal();
    return;
  }
  const task = fullData.tasks.find(t => t.id === id);
  if (!task) {
    hideEditModal();
    return;
  }

  // Optimistic edit
  const prev = {
    content: task.content,
    priority: task.priority,
    due_date: task.due_date
  };
  task.content = content;
  task.priority = priority;
  task.due_date = due || null;

  recomputeSummary();
  applyFilters();
  hideEditModal();
  showToast('Đã cập nhật công việc', 'success');

  // Background sync
  const body = {
    content: content,
    priority: priority,
    due_date: due || null
  };

  fetch(API + '/edit/' + id, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => {
      if (!r.ok) throw new Error('Lưu thất bại');
    })
    .catch(() => {
      // Revert on error
      Object.assign(task, prev);
      recomputeSummary();
      applyFilters();
      showToast('Lỗi khi lưu. Đã hoàn tác thay đổi.', 'error');
    });
}

function clearDone() {
  if (!fullData || !fullData.tasks) return;
  const doneTasks = fullData.tasks.filter(t => t.status === 'done');
  if (doneTasks.length === 0) {
    showToast('Không có công việc nào đã xong để xóa', 'error');
    return;
  }

  // Optimistic clear: remove all done immediately (no confirm, instant UX)
  const prevDone = doneTasks.map(t => ({ ...t }));
  fullData.tasks = fullData.tasks.filter(t => t.status !== 'done');
  recomputeSummary();
  applyFilters();

  const count = prevDone.length;
  showToast(`Đã xóa ${count} công việc đã xong`, 'success');

  // Background sync
  fetch(API + '/clear-done', { method: 'POST' })
    .then(r => {
      if (!r.ok) throw new Error('Xóa thất bại');
    })
    .catch(() => {
      // Revert all done items
      fullData.tasks = fullData.tasks.concat(prevDone);
      recomputeSummary();
      applyFilters();
      showToast('Không thể xóa. Đã khôi phục các việc đã xong.', 'error');
    });
}


// Keyboard support for rich modal dismiss (Esc key - required for excellent UX alongside backdrop & Cancel)
document.addEventListener('keydown', function(e) {
  const modal = document.getElementById('editModal');
  if (modal && modal.style.display === 'flex' && e.key === 'Escape') {
    e.preventDefault();
    hideEditModal();
  }
});

load();
initFilterListeners();
</script>
</body>
</html>"""


class TodoHandler(BaseHTTPRequestHandler):
    """Xử lý HTTP request cho web UI."""

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, html_str, status=200):
        body = html_str.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/" or path == "/index.html":
            self._html(WEB_HTML)
        elif path == "/api/tasks":
            conn = get_conn()
            rows = conn.execute(
                "SELECT * FROM tasks ORDER BY priority DESC, created_at ASC"
            ).fetchall()
            tasks = [dict(r) for r in rows]
            total = len(tasks)
            pending = sum(1 for t in tasks if t["status"] == "pending")
            done = total - pending
            conn.close()
            self._json({"tasks": tasks, "summary": {"total": total, "pending": pending, "done": done}})
        else:
            self._json({"error": "Not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_body()

        # POST /api/add
        if path == "/api/add":
            data = json.loads(body)
            content = data.get("content", "").strip()
            priority = int(data.get("priority", 1))
            due_date = data.get("due_date")
            if not content:
                self._json({"error": "Nội dung trống"}, 400)
                return
            if priority not in (1, 2, 3):
                priority = 1

            conn = get_conn()
            conn.execute(
                "INSERT INTO tasks (content, priority, due_date) VALUES (?, ?, ?)",
                (content, priority, due_date)
            )
            conn.commit()
            conn.close()
            self._json({"ok": True})

        # POST /api/done/<id>
        elif path.startswith("/api/done/"):
            task_id = int(path.rsplit("/", 1)[-1])
            conn = get_conn()
            cur = conn.execute("SELECT id FROM tasks WHERE id = ?", (task_id,))
            if cur.fetchone() is None:
                conn.close()
                self._json({"error": "Không tìm thấy"}, 404)
                return
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(
                "UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?",
                (now, task_id)
            )
            conn.commit()
            conn.close()
            self._json({"ok": True})

        # POST /api/delete/<id>
        elif path.startswith("/api/delete/"):
            task_id = int(path.rsplit("/", 1)[-1])
            conn = get_conn()
            conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            conn.commit()
            conn.close()
            self._json({"ok": True})

        # POST /api/edit/<id>  -- supports partial updates including due_date (fixed for web modal)
        elif path.startswith("/api/edit/"):
            task_id = int(path.rsplit("/", 1)[-1])
            data = json.loads(body)
            content = data.get("content")
            priority = data.get("priority")
            due_date = data.get("due_date")

            # Explicit check for due_date key presence (allows sending due_date: null to CLEAR it)
            has_content = "content" in data
            has_priority = "priority" in data
            has_due = "due_date" in data

            if not (has_content or has_priority or has_due):
                self._json({"error": "Phải cung cấp ít nhất một trong: content, priority, due_date"}, 400)
                return

            conn = get_conn()
            cur = conn.execute("SELECT id FROM tasks WHERE id = ?", (task_id,))
            if cur.fetchone() is None:
                conn.close()
                self._json({"error": "Không tìm thấy"}, 404)
                return

            updates = []
            params = []
            if has_content and content is not None:
                c = content.strip()
                if c:  # prevent empty content via API too
                    updates.append("content = ?")
                    params.append(c)
            if has_priority and priority is not None:
                try:
                    p = int(priority)
                    if p in (1, 2, 3):
                        updates.append("priority = ?")
                        params.append(p)
                except (ValueError, TypeError):
                    pass
            if has_due:
                # Always persist due_date when key present (string date or null/empty = clear)
                updates.append("due_date = ?")
                params.append(due_date if due_date else None)

            if not updates:
                conn.close()
                self._json({"ok": True})
                return

            params.append(task_id)
            sql = f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?"
            conn.execute(sql, params)
            conn.commit()
            conn.close()
            self._json({"ok": True})

        # POST /api/clear-done
        elif path == "/api/clear-done":
            conn = get_conn()
            cur = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = 'done'")
            count = cur.fetchone()[0]
            conn.execute("DELETE FROM tasks WHERE status = 'done'")
            conn.commit()
            conn.close()
            self._json({"ok": True, "deleted": count})

        else:
            self._json({"error": "Not found"}, 404)

    def log_message(self, format, *args):
        pass  # tắt log để terminal sạch


def run_server(port: int = 8080):
    """Khởi động web server."""
    init_db()
    server = HTTPServer(("127.0.0.1", port), TodoHandler)
    print(f"🌐 Web UI đang chạy tại: http://127.0.0.1:{port}")
    print("   Nhấn Ctrl+C để dừng.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Đã dừng server.")
        server.server_close()


# ══════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════

def main():
    """Parse tham số dòng lệnh và gọi hàm tương ứng."""
    parser = argparse.ArgumentParser(
        description="CLI Todo List - Quản lý công việc cá nhân",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python main.py add "Họp team" --priority 2
  python main.py list
  python main.py list --status done
  python main.py list --search "họp"
  python main.py list -q "báo cáo"
  python main.py done 3
  python main.py delete 4
  python main.py edit 5 --content "Nội dung mới"
  python main.py edit 5 -p 3
  python main.py summary
  python main.py clear-done
        """
    )

    sub = parser.add_subparsers(dest="command", help="Lệnh cần thực hiện")

    # ── add ──────────────────────────────────────────────────────────
    p_add = sub.add_parser("add", help="Thêm công việc mới")
    p_add.add_argument("content", help="Nội dung công việc")
    p_add.add_argument(
        "--priority", "-p", type=int, default=1, choices=[1, 2, 3],
        help="Mức ưu tiên: 1=thấp, 2=trung bình, 3=cao (mặc định: 1)"
    )
    p_add.add_argument(
        "--due", "-d", default=None,
        help="Hạn hoàn thành (định dạng YYYY-MM-DD), ví dụ: 2026-06-15"
    )

    # ── list ─────────────────────────────────────────────────────────
    p_list = sub.add_parser("list", help="Hiển thị danh sách công việc")
    p_list.add_argument(
        "--status", "-s", default="pending", choices=["all", "pending", "done"],
        help="Lọc theo trạng thái (mặc định: pending)"
    )
    p_list.add_argument(
        "--search", "-q", default=None,
        help="Tìm kiếm công việc theo nội dung"
    )

    # ── done ─────────────────────────────────────────────────────────
    p_done = sub.add_parser("done", help="Đánh dấu hoàn thành")
    p_done.add_argument("id", type=int, help="ID công việc cần hoàn thành")

    # ── delete ───────────────────────────────────────────────────────
    p_del = sub.add_parser("delete", help="Xóa công việc")
    p_del.add_argument("id", type=int, help="ID công việc cần xóa")

    # ── edit ─────────────────────────────────────────────────────────
    p_edit = sub.add_parser("edit", help="Sửa công việc")
    p_edit.add_argument("id", type=int, help="ID công việc cần sửa")
    p_edit.add_argument(
        "--content", "-c", default=None,
        help="Nội dung mới của công việc"
    )
    p_edit.add_argument(
        "--priority", "-p", type=int, choices=[1, 2, 3], default=None,
        help="Mức ưu tiên mới: 1=thấp, 2=trung bình, 3=cao"
    )
    p_edit.add_argument(
        "--due", "-d", default=None,
        help="Hạn hoàn thành mới (YYYY-MM-DD)"
    )

    # ── summary ──────────────────────────────────────────────────────
    sub.add_parser("summary", help="Thống kê công việc")

    # ── clear-done ───────────────────────────────────────────────────
    sub.add_parser("clear-done", help="Xóa tất cả công việc đã hoàn thành")

    # ── serve ────────────────────────────────────────────────────────
    p_serve = sub.add_parser("serve", help="Khởi động giao diện web")
    p_serve.add_argument("--port", "-p", type=int, default=8080, help="Cổng HTTP (mặc định: 8080)")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    # Khởi tạo database (không ảnh hưởng nếu đã có)
    init_db()

    # Điều hướng lệnh
    if args.command == "add":
        add_task(args.content, args.priority, args.due)
    elif args.command == "list":
        list_tasks(args.status, args.search)
    elif args.command == "done":
        mark_done(args.id)
    elif args.command == "delete":
        delete_task(args.id)
    elif args.command == "edit":
        edit_task(args.id, args.content, args.priority, args.due)
    elif args.command == "summary":
        show_summary()
    elif args.command == "clear-done":
        clear_done()
    elif args.command == "serve":
        run_server(args.port)


if __name__ == "__main__":
    try:
        main()
    except sqlite3.Error as e:
        print(f"❌ Lỗi database: {e}")
        sys.exit(1)
