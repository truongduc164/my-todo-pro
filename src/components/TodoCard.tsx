"use client";

import { useState } from "react";
import { Todo, TodoStatus } from "@/lib/types";
import { PRIORITY_CONFIG, formatDate } from "@/lib/utils";
import {
  CheckCircle,
  Circle,
  Calendar,
  MoreVertical,
  Edit3,
  Trash2,
  ImageIcon,
  Maximize2,
  X,
} from "lucide-react";

interface TodoCardProps {
  todo: Todo;
  onToggleStatus: (id: string, currentStatus: TodoStatus) => void;
  onUpdateStatus: (id: string, newStatus: TodoStatus) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

export default function TodoCard({
  todo,
  onToggleStatus,
  onUpdateStatus,
  onEdit,
  onDelete,
}: TodoCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  const priorityMeta = PRIORITY_CONFIG[todo.priority] || PRIORITY_CONFIG[2];
  const isDone = todo.status === "done";

  // Check if due date is overdue
  const isOverdue =
    todo.due_date &&
    !isDone &&
    new Date(todo.due_date).getTime() < Date.now();

  return (
    <>
      <div
        className={`group relative bg-white dark:bg-[#131b2e] border rounded-2xl p-4 transition-all duration-200 hover:shadow-md ${
          isDone
            ? "border-slate-200/60 dark:border-slate-800/60 opacity-80"
            : "border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50"
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Status Toggle Button */}
          <button
            onClick={() => onToggleStatus(todo.id, todo.status)}
            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition"
            title={isDone ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"}
          >
            {isDone ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* Priority badge */}
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${priorityMeta.border} ${priorityMeta.bg} ${priorityMeta.color}`}
              >
                {priorityMeta.label}
              </span>

              {/* Status Select */}
              <select
                value={todo.status}
                onChange={(e) => onUpdateStatus(todo.id, e.target.value as TodoStatus)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border border-transparent bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer`}
              >
                <option value="todo">Cần làm</option>
                <option value="in_progress">Đang làm</option>
                <option value="done">Hoàn thành</option>
              </select>

              {/* Due Date Indicator */}
              {todo.due_date && (
                <div
                  className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                    isOverdue
                      ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>
                    {formatDate(todo.due_date)} {isOverdue && "(Quá hạn)"}
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <h3
              className={`text-sm font-semibold break-words ${
                isDone
                  ? "line-through text-slate-400 dark:text-slate-500"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {todo.title}
            </h3>

            {/* Description */}
            {todo.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-line line-clamp-2">
                {todo.description}
              </p>
            )}

            {/* Image Thumbnail (Cloudflare R2) */}
            {todo.image_url && (
              <div className="mt-2.5">
                <div
                  onClick={() => setShowImageLightbox(true)}
                  className="relative group/img inline-block cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 max-w-[180px]"
                >
                  <img
                    src={todo.image_url}
                    alt={todo.title}
                    className="w-full h-24 object-cover group-hover/img:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                  <span className="absolute bottom-1 right-1 bg-black/60 text-[9px] text-white px-1 rounded flex items-center gap-0.5">
                    <ImageIcon className="w-2.5 h-2.5" /> Ảnh
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Menu (Edit / Delete) */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 text-xs">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(todo);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Sửa việc
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(todo.id);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {showImageLightbox && todo.image_url && (
        <div
          onClick={() => setShowImageLightbox(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center cursor-default"
          >
            <button
              onClick={() => setShowImageLightbox(false)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={todo.image_url}
              alt={todo.title}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
            <p className="text-white text-xs mt-3 bg-black/50 px-3 py-1 rounded-full">
              Lưu trữ qua Cloudflare R2 / S3 Storage
            </p>
          </div>
        </div>
      )}
    </>
  );
}
