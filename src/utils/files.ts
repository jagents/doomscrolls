// File utilities for JSON read/write

import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Progress } from '../types';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const file = Bun.file(path);
    if (await file.exists()) {
      return await file.json() as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureDir(path);
  await Bun.write(path, JSON.stringify(data, null, 2));
}

export async function readProgress(path: string): Promise<Progress> {
  const progress = await readJson<Progress>(path);
  return progress ?? { completed: [], last_updated: new Date().toISOString() };
}

export async function saveProgress(path: string, completed: string[]): Promise<void> {
  const progress: Progress = {
    completed,
    last_updated: new Date().toISOString()
  };
  await writeJson(path, progress);
}

export async function appendToJsonArray<T>(path: string, items: T[]): Promise<void> {
  const existing = await readJson<T[]>(path) ?? [];
  await writeJson(path, [...existing, ...items]);
}
