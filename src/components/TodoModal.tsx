"use client";

import { useState, useEffect, useRef } from "react";
import { Todo, PriorityLevel, TodoStatus } from "@/lib/types";
import { X, Upload, Loader2, Image as ImageIcon, Trash2, Calendar, AlertCircle } from "lucide-react";

interface TodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Todo>) => Promise<void>;
  initialData?: Todo | null;
}

// Chuyển đổi timestamp UTC sang chuỗi YYYY-MM-DDTHH:mm theo giờ địa phương
function toLocalISOString(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export default function TodoModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: TodoModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>(2);
  const [status, setStatus] = useState<TodoStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Đóng modal bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setPriority(initialData.priority || 2);
      setStatus(initialData.status || "todo");
      setDueDate(toLocalISOString(initialData.due_date));
      setImageUrl(initialData.image_url || null);
    } else {
      setTitle("");
      setDescription("");
      setPriority(2);
      setStatus("todo");
      setDueDate("");
      setImageUrl(null);
    }
    setErrorMessage(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Vui lòng chọn file hình ảnh (PNG, JPG, WebP...)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Dung lượng ảnh tối đa là 5MB");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Tải ảnh thất bại");
      }

      setImageUrl(data.url);
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể tải ảnh lên");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Vui lòng nhập tiêu đề công việc");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const parsedDueDate = dueDate && !isNaN(new Date(dueDate).getTime())
        ? new Date(dueDate).toISOString()
        : null;

      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        due_date: parsedDueDate,
        image_url: imageUrl,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi lưu công việc");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {initialData ? "Chỉnh sửa công việc" : "Thêm công việc mới"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tiêu đề <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="VD: Triển khai dự án lên Vercel..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mô tả chi tiết / Ghi chú
            </label>
            <textarea
              rows={3}
              placeholder="Nhập nội dung chi tiết hoặc checklist..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mức ưu tiên
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as PriorityLevel)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value={1}>Thấp 🍃</option>
                <option value={2}>Trung bình ⚡</option>
                <option value={3}>Cao 🔥</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TodoStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="todo">Cần làm</option>
                <option value="in_progress">Đang làm</option>
                <option value="done">Hoàn thành</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Hạn hoàn thành (Due Date)
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          {/* Cloud Image Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ảnh đính kèm (Lưu trữ ảnh Cloud)
            </label>

            {imageUrl ? (
              <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden group">
                <img
                  src={imageUrl}
                  alt="Ảnh đính kèm"
                  className="w-full h-36 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md transition"
                  title="Gỡ ảnh"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500/70 hover:bg-indigo-50/20 transition group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center py-2 text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-1" />
                    <span className="text-xs">Đang tải ảnh lên...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    <Upload className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">Bấm để tải ảnh lên</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ JPG, PNG, WebP, GIF (tối đa 5MB)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 disabled:opacity-50 transition"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{initialData ? "Cập nhật" : "Tạo công việc"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
