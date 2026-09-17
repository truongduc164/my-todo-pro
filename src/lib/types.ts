export type PriorityLevel = 1 | 2 | 3; // 1: Thấp, 2: Trung bình, 3: Cao
export type TodoStatus = 'todo' | 'in_progress' | 'done';

export interface Todo {
  id: string;
  user_id?: string;
  title: string;
  description?: string | null;
  priority: PriorityLevel;
  status: TodoStatus;
  image_url?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TodoFilterState {
  search: string;
  status: 'all' | TodoStatus;
  priority: 'all' | PriorityLevel;
}
