import { useMemo } from 'react';
import type { PrintSettings } from '../types/label';
import { paginateLabels } from '../utils/labelLayout';

export function useLabelPagination<T>(items: T[], settings: PrintSettings) {
  return useMemo(() => paginateLabels(items, settings), [items, settings]);
}
