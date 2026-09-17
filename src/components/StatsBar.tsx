import { Todo } from "@/lib/types";
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react";

interface StatsBarProps {
  todos: Todo[];
}

export default function StatsBar({ todos }: StatsBarProps) {
  const total = todos.length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const done = todos.filter((t) => t.status === "done").length;
  const highPriority = todos.filter((t) => t.priority === 3 && t.status !== "done").length;

  const stats = [
    {
      label: "Tổng công việc",
      value: total,
      icon: ListTodo,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-100 dark:border-indigo-900/50",
    },
    {
      label: "Đang tiến hành",
      value: inProgress,
      icon: Clock,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-100 dark:border-blue-900/50",
    },
    {
      label: "Đã hoàn thành",
      value: done,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-100 dark:border-emerald-900/50",
    },
    {
      label: "Ưu tiên cao",
      value: highPriority,
      icon: AlertTriangle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-100 dark:border-rose-900/50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-6">
      {stats.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={index}
            className={`p-4 rounded-2xl border ${item.border} ${item.bg} flex items-center justify-between transition-all hover:shadow-md`}
          >
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {item.label}
              </p>
              <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                {item.value}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${item.bg} ${item.color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
