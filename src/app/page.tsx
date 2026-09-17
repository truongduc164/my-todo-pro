"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/Navbar";
import StatsBar from "@/components/StatsBar";
import TodoFilter from "@/components/TodoFilter";
import TodoCard from "@/components/TodoCard";
import TodoModal from "@/components/TodoModal";
import { Todo, TodoFilterState, TodoStatus } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { CheckCircle2, Info, Sparkles, Plus } from "lucide-react";
import type { User } from "@supabase/supabase-js";

// Dữ liệu mẫu ban đầu khi người dùng chưa đăng nhập
const INITIAL_DEMO_TODOS: Todo[] = [
  {
    id: "demo-1",
    title: "1. Khởi tạo Git & đưa mã nguồn lên GitHub",
    description: "Khởi tạo git repo cục bộ, commit code và đẩy lên repository GitHub cá nhân.",
    priority: 3,
    status: "todo",
    due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "2. Tạo Database trên Supabase & chạy file supabase_schema.sql",
    description: "Vào Supabase Dashboard -> SQL Editor -> dán nội dung file supabase_schema.sql và Run để tạo bảng todos + RLS bảo mật.",
    priority: 3,
    status: "in_progress",
    due_date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    title: "3. Cấu hình Cloudflare R2 để lưu trữ ảnh đính kèm",
    description: "Tạo R2 Bucket 'my-todo-images' và lấy Access Key ID / Secret Key điền vào file .env.local.",
    priority: 2,
    status: "todo",
    due_date: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-4",
    title: "4. Kết nối GitHub với Vercel và triển khai tự động (CI/CD)",
    description: "Import repo từ GitHub vào Vercel, cài đặt các biến môi trường và hoàn tất việc đưa website lên internet.",
    priority: 3,
    status: "todo",
    due_date: new Date(Date.now() + 96 * 3600 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
];

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>(INITIAL_DEMO_TODOS);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [storageProvider, setStorageProvider] = useState<"cloudflare_r2" | "supabase_storage" | "demo">("demo");

  const [filter, setFilter] = useState<TodoFilterState>({
    search: "",
    status: "all",
    priority: "all",
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // Lưu trữ dữ liệu vào LocalStorage (khi chưa đăng nhập)
  const saveLocalTodos = useCallback((newTodos: Todo[]) => {
    setTodos(newTodos);
    if (!user) {
      try {
        localStorage.setItem("my_todos_demo", JSON.stringify(newTodos));
      } catch (err) {
        console.warn("Không thể lưu vào localStorage (dung lượng vượt mức cho phép):", err);
      }
    }
  }, [user]);

  const loadTodosFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem("my_todos_demo");
      if (saved) {
        setTodos(JSON.parse(saved));
      } else {
        setTodos(INITIAL_DEMO_TODOS);
        localStorage.setItem("my_todos_demo", JSON.stringify(INITIAL_DEMO_TODOS));
      }
    } catch {
      setTodos(INITIAL_DEMO_TODOS);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTodosFromSupabase = useCallback(async (
    supabase: NonNullable<ReturnType<typeof createClient>>,
    currentUserId?: string,
    isInitial = false
  ) => {
    try {
      if (isInitial) setLoading(true);

      const uid = currentUserId || user?.id;
      if (!uid) {
        loadTodosFromLocalStorage();
        return;
      }

      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (err) {
      console.error("Lỗi khi tải todos từ Supabase:", err);
      loadTodosFromLocalStorage();
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user?.id, loadTodosFromLocalStorage]);

  // Khởi tạo và kiểm tra trạng thái Supabase + Cloudflare R2
  useEffect(() => {
    const supabaseConfigured = isSupabaseConfigured();
    setIsLiveSupabase(supabaseConfigured);

    // Kiểm tra trạng thái lưu trữ ảnh (Cloudflare R2 hoặc Supabase Storage) qua API endpoint
    fetch("/api/upload")
      .then((res) => res.json())
      .then((data) => setStorageProvider(data.activeProvider || "demo"))
      .catch(() => setStorageProvider("demo"));

    const supabase = createClient();

    if (supabase && supabaseConfigured) {
      // Kiểm tra session hiện tại
      supabase.auth.getSession().then(({ data: { session } }) => {
        const currentUser = session?.user || null;
        setUser(currentUser);
        if (currentUser) {
          loadTodosFromSupabase(supabase, currentUser.id, true);
        } else {
          loadTodosFromLocalStorage();
        }
      });

      // Lắng nghe thay đổi đăng nhập/đăng xuất
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          const nextUser = session?.user || null;
          setUser(nextUser);
          if (nextUser) {
            loadTodosFromSupabase(supabase, nextUser.id, false);
          } else {
            loadTodosFromLocalStorage();
          }
        }
      );

      // Lắng nghe Realtime (không gây chớp tắt giao diện)
      const channel = supabase
        .channel("todos-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "todos" },
          () => {
            loadTodosFromSupabase(supabase, undefined, false);
          }
        )
        .subscribe();

      return () => {
        authListener.subscription.unsubscribe();
        supabase.removeChannel(channel);
      };
    } else {
      loadTodosFromLocalStorage();
    }
  }, [loadTodosFromLocalStorage, loadTodosFromSupabase]);

  // Bộ lọc tìm kiếm và trạng thái
  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      if (filter.status !== "all" && todo.status !== filter.status) {
        return false;
      }
      if (filter.priority !== "all" && todo.priority !== filter.priority) {
        return false;
      }
      if (filter.search.trim()) {
        const q = filter.search.toLowerCase();
        const matchTitle = todo.title.toLowerCase().includes(q);
        const matchDesc = todo.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [todos, filter]);

  // Toggle trạng thái (done <-> todo) với optimistic update
  const handleToggleStatus = async (id: string, currentStatus: TodoStatus) => {
    const nextStatus: TodoStatus = currentStatus === "done" ? "todo" : "done";
    await handleUpdateStatus(id, nextStatus);
  };

  // Cập nhật trạng thái công việc
  const handleUpdateStatus = async (id: string, nextStatus: TodoStatus) => {
    const previousTodos = [...todos];
    // Optimistic UI update ngay lập tức (không chờ mạng)
    const updated = todos.map((t) =>
      t.id === id ? { ...t, status: nextStatus, updated_at: new Date().toISOString() } : t
    );
    setTodos(updated);

    const supabase = createClient();
    if (supabase && isLiveSupabase && user) {
      try {
        const { error } = await supabase
          .from("todos")
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Lỗi cập nhật trạng thái:", err);
        setTodos(previousTodos); // Khôi phục state cũ nếu lỗi
        alert("Không thể cập nhật trạng thái công việc. Vui lòng thử lại.");
      }
    } else {
      saveLocalTodos(updated);
    }
  };

  // Thêm mới hoặc chỉnh sửa Todo
  const handleSaveTodo = async (data: Partial<Todo>) => {
    const supabase = createClient();
    if (supabase && isLiveSupabase && user) {
      try {
        if (editingTodo) {
          const { error } = await supabase
            .from("todos")
            .update({
              title: data.title,
              description: data.description,
              priority: data.priority,
              status: data.status,
              due_date: data.due_date,
              image_url: data.image_url,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingTodo.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("todos").insert({
            user_id: user.id,
            title: data.title,
            description: data.description,
            priority: data.priority,
            status: data.status,
            due_date: data.due_date,
            image_url: data.image_url,
          });
          if (error) throw error;
        }
        await loadTodosFromSupabase(supabase, user.id, false);
      } catch (err: any) {
        console.error("Lỗi khi lưu công việc vào Supabase:", err);
        throw new Error(err.message || "Không thể lưu vào Supabase");
      }
    } else {
      // Chế độ lưu tạm trình duyệt
      if (editingTodo) {
        const updated = todos.map((t) =>
          t.id === editingTodo.id
            ? { ...t, ...data, updated_at: new Date().toISOString() }
            : t
        );
        saveLocalTodos(updated);
      } else {
        const newTodo: Todo = {
          id: `local-${Date.now()}`,
          title: data.title || "Công việc mới",
          description: data.description,
          priority: data.priority || 2,
          status: data.status || "todo",
          due_date: data.due_date,
          image_url: data.image_url,
          created_at: new Date().toISOString(),
        };
        saveLocalTodos([newTodo, ...todos]);
      }
    }
  };

  // Xóa công việc
  const handleDeleteTodo = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa công việc này?")) return;

    const previousTodos = [...todos];
    const updated = todos.filter((t) => t.id !== id);
    setTodos(updated);

    const supabase = createClient();
    if (supabase && isLiveSupabase && user) {
      try {
        const { error } = await supabase.from("todos").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Lỗi khi xóa công việc:", err);
        setTodos(previousTodos);
        alert("Không thể xóa công việc. Vui lòng kiểm tra lại kết nối.");
      }
    } else {
      saveLocalTodos(updated);
    }
  };

  // Đăng xuất
  const handleLogout = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      loadTodosFromLocalStorage();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        userEmail={user?.email}
        isSupabaseConfigured={isLiveSupabase}
        storageProvider={storageProvider}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner hướng dẫn nếu người dùng chưa đăng nhập tài khoản */}
        {!user && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200 dark:border-indigo-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-600 text-white mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isLiveSupabase
                    ? "⚡ Database Supabase đã sẵn sàng! Hãy đăng nhập để đồng bộ lên Cloud"
                    : "Dự án đang chạy chế độ Thực hành cục bộ (Local Storage Demo)"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {isLiveSupabase
                    ? "Bấm nút [Đăng nhập] ở góc trên bên phải để tạo tài khoản cá nhân và lưu dữ liệu trực tiếp lên Supabase Cloud!"
                    : "Mọi công việc bạn thêm hoặc chỉnh sửa đều được lưu an toàn trên trình duyệt của bạn (không bị mất khi F5). Đăng nhập để đồng bộ lên Supabase Cloud!"}
                </p>
              </div>
            </div>
            {!isLiveSupabase && (
              <a
                href="#instructions"
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-slate-700 hover:shadow-sm whitespace-nowrap"
              >
                Xem các bước làm
              </a>
            )}
          </div>
        )}

        {/* Stats Bar */}
        <StatsBar todos={todos} />

        {/* Filters and Actions */}
        <TodoFilter
          filter={filter}
          onChange={setFilter}
          onOpenCreateModal={() => {
            setEditingTodo(null);
            setIsModalOpen(true);
          }}
        />

        {/* Todo List Content */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            Đang tải dữ liệu công việc...
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-[#131b2e]/40 p-8">
            <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Không tìm thấy công việc nào
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Không có công việc nào khớp với bộ lọc hiện tại. Thử thay đổi từ khóa tìm kiếm hoặc thêm công việc mới.
            </p>
            <button
              onClick={() => {
                setEditingTodo(null);
                setIsModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo việc đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTodos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onToggleStatus={handleToggleStatus}
                onUpdateStatus={handleUpdateStatus}
                onEdit={(item) => {
                  setEditingTodo(item);
                  setIsModalOpen(true);
                }}
                onDelete={handleDeleteTodo}
              />
            ))}
          </div>
        )}

        {/* Step-by-Step Practical Guide Section */}
        <section id="instructions" className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Hướng dẫn thực hành hoàn thiện dự án
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Quy trình 4 bước chuẩn để đưa ứng dụng lên môi trường Production với GitHub, Vercel, Supabase và Cloudflare:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bước 1: Supabase */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800">
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 mb-2">
                Bước 1: Supabase (Database & Auth)
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Khởi tạo Database & Chạy SQL
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                1. Truy cập <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">supabase.com</a> và tạo một New Project.<br />
                2. Mở mục <strong>SQL Editor</strong>, copy toàn bộ file <code>supabase_schema.sql</code> và nhấn <strong>Run</strong>.<br />
                3. Vào <strong>Project Settings -&gt; API</strong>, copy <code>URL</code> và <code>anon public key</code> dán vào <code>.env.local</code>.
              </p>
            </div>

            {/* Bước 2: Cloudflare R2 */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800">
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 mb-2">
                Bước 2: Cloudflare R2 (Lưu trữ ảnh)
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tạo R2 Bucket & API Token
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                1. Truy cập Cloudflare Dashboard -&gt; mục <strong>R2 Storage</strong> -&gt; <strong>Create bucket</strong> (đặt tên <code>my-todo-images</code>).<br />
                2. Vào <strong>Settings</strong> của Bucket, bật <strong>Public Access</strong> (cho phép đọc ảnh công khai).<br />
                3. Tạo <strong>R2 API Token</strong> với quyền Object Read & Write, lấy <code>Access Key ID</code> và <code>Secret Access Key</code> dán vào <code>.env.local</code>.
              </p>
            </div>

            {/* Bước 3: GitHub */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800">
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mb-2">
                Bước 3: GitHub (Version Control)
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tạo Repository & Đẩy mã nguồn
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                1. Mở terminal tại thư mục này, chạy:<br />
                <code className="block bg-slate-100 dark:bg-slate-900 p-2 rounded-lg font-mono text-[11px] my-1">
                  git init<br />
                  git add .<br />
                  git commit -m &quot;feat: fullstack todo app&quot;
                </code>
                2. Tạo repository mới trên GitHub và chạy lệnh liên kết <code>git remote add origin ...</code> rồi <code>git push -u origin main</code>.
              </p>
            </div>

            {/* Bước 4: Vercel */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800">
              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 mb-2">
                Bước 4: Vercel (Deploy CI/CD)
              </span>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Triển khai 1-Click lên Production
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                1. Đăng nhập <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">vercel.com</a> bằng tài khoản GitHub.<br />
                2. Nhấn <strong>Add New -&gt; Project</strong> và chọn repo GitHub vừa tạo.<br />
                3. Trong phần <strong>Environment Variables</strong>, dán toàn bộ các biến trong <code>.env.local</code> vào.<br />
                4. Nhấn <strong>Deploy</strong>. Vercel sẽ tự động build và cung cấp domain chính thức!
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Create / Edit Modal */}
      <TodoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTodo}
        initialData={editingTodo}
      />
    </div>
  );
}
