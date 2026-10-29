'use server';

import { revalidatePath } from 'next/cache';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export type Task = {
  id: number;
  title: string;
  completed: boolean;
  /** Due date as 'YYYY-MM-DD', or null when the task has no due date. */
  due_date: string | null;
  created_at: string;
};

function revalidateTaskViews() {
  revalidatePath('/');
  revalidatePath('/calendar');
}

export async function getTasks(): Promise<Task[]> {
  const res = await fetch(`${API_URL}/tasks`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

/** Tasks due in the given month (month is 1-12), ordered by due date. */
export async function getCalendarTasks(year: number, month: number): Promise<Task[]> {
  const res = await fetch(`${API_URL}/calendar/${year}/${month}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch calendar tasks');
  return res.json();
}

export async function createTask(formData: FormData) {
  const title = formData.get('title') as string;
  const dueDate = formData.get('due_date');
  const body: { title: string; due_date?: string } = { title };
  if (typeof dueDate === 'string' && dueDate) body.due_date = dueDate;

  await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  revalidateTaskViews();
}

export async function toggleTask(id: number, completed: boolean) {
  await fetch(`${API_URL}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  revalidateTaskViews();
}

/** Set (as 'YYYY-MM-DD') or clear (null) a task's due date. */
export async function updateTaskDueDate(id: number, dueDate: string | null) {
  await fetch(`${API_URL}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ due_date: dueDate || null }),
  });
  revalidateTaskViews();
}
