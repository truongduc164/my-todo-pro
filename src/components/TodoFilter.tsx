"use client";

import { TodoFilterState, TodoStatus, PriorityLevel } from "@/lib/types";
import { Search, Plus, Filter, X } from "lucide-react";

interface TodoFilterProps {
  filter: TodoFilterState;
  onChange: (filter: TodoFilterState) => void;
  onOpenCreateModal: () => void;
}

export default function TodoFilter({
  filter,
  onChange,
  onOpenCreateModal,
}: TodoFilterProps) {
  const statusOptions: { key: "all" | TodoStatus; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "todo", label: "Cần làm" },
    { key: "in_progress", label: "Đang làm" },
    { key: "done", label: "Hoàn thành" },
  ];

  const priorityOptions: { key: "all" | PriorityLevel; label: string }[] = [
    { key: "all", label: "Mức ưu tiên (Tất cả)" },
    { key: 3, label: "Ưu tiên: Cao 🔥" },
    { key: 2, label: "Ưu tiên: Trung bình ⚡" },
    { key: 1, label: "Ưu tiên: Thấp 🍃" },
  ];

  return (
    <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm công việc theo tiêu đề hoặc ghi chú..."
            value={filter.search}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
          />
          {filter.search && (
            <button
              onClick={() => onChange({ ...filter, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Priority Select */}
        <div className="flex items-center gap-2">
          <select
            value={filter.priority}
            onChange={(e) => {
              const val = e.target.value === "all" ? "all" : (Number(e.target.value) as PriorityLevel);
              onChange({ ...filter, priority: val });
            }}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {priorityOptions.map((opt) => (
              <option key={String(opt.key)} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Add Todo Button */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-md shadow-indigo-600/25 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">Thêm việc mới</span>
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 pt-1 border-t border-slate-100 dark:border-slate-800">
        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:inline" />
        {statusOptions.map((opt) => {
          const isActive = filter.status === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onChange({ ...filter, status: opt.key })}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
