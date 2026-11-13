import api from './axios';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportFilters {
  status_filter?: 'in_progress' | 'submitted';
  date_from?: string;
  date_to?: string;
  search?: string;
}

export const exportSubmissions = async (
  formId: number,
  format: ExportFormat,
  filters?: ExportFilters
): Promise<void> => {
  const params: Record<string, string> = { format };
  if (filters?.status_filter) params.status_filter = filters.status_filter;
  if (filters?.date_from) params.date_from = filters.date_from;
  if (filters?.date_to) params.date_to = filters.date_to;
  if (filters?.search && filters.search.trim() !== '') params.search = filters.search.trim();

  const response = await api.get(`/export/${formId}/submissions`, {
    params,
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  let filename = `submissions.${format}`;
  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] as string,
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
