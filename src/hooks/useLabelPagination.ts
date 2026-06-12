import { useMemo } from 'react';
import type { LabelDataItem, PrintSettings } from '../types/label';
import { paginateLabels } from '../utils/labelLayout';

export function useLabelPagination(items: LabelDataItem[], settings: PrintSettings) {
  return useMemo(() => paginateLabels(items, settings), [items, settings]);
}
