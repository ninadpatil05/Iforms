import api from './axios';
import { AiAnalysisReport, AiAnalysisReportSummary } from '@/types/aiAnalysis';

export const runAnalysis = async (formVersionId: number): Promise<AiAnalysisReport> => {
  const response = await api.post<AiAnalysisReport>(`/ai/analysis/${formVersionId}/run`);
  return response.data;
};

export const getLatestReport = async (
  formVersionId: number
): Promise<AiAnalysisReport | null> => {
  try {
    const response = await api.get<AiAnalysisReport>(`/ai/analysis/${formVersionId}/latest`);
    return response.data;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      return null;
    }
    throw err;
  }
};

export const getReportHistory = async (
  formVersionId: number
): Promise<AiAnalysisReportSummary[]> => {
  const response = await api.get<AiAnalysisReportSummary[]>(
    `/ai/analysis/${formVersionId}/history`
  );
  return response.data;
};

export const seedDemoSubmissions = async (formVersionId: number): Promise<{ message: string; count: number }> => {
  const response = await api.post<{ message: string; count: number }>(`/submissions/form-version/${formVersionId}/seed-demo`);
  return response.data;
};
