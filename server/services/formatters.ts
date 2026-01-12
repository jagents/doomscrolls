import type { Passage } from '../types';

export function formatPassage(row: any): Passage {
  return {
    id: row.id,
    text: row.text,
    type: row.type || 'passage',
    author: {
      id: row.author_id,
      name: row.author_name,
      slug: row.author_slug,
    },
    work: row.work_id ? {
      id: row.work_id,
      title: row.work_title,
      slug: row.work_slug,
    } : null,
    like_count: parseInt(row.like_count) || 0,
  };
}
