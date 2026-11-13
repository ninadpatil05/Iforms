import React, { useState, useEffect, useCallback } from 'react';
import {
  getDuplicateOverrideRequests,
  approveDuplicateOverrideRequest,
  denyDuplicateOverrideRequest,
  DuplicateOverrideRequestItem,
} from '@/api/duplicateOverride';
import { Button } from '@/components/Button';
import { ShieldAlert, Check, X, RefreshCw } from 'lucide-react';

interface DuplicateOverridePanelProps {
  formId: number;
  duplicatePolicy: string;
}

export const DuplicateOverridePanel: React.FC<DuplicateOverridePanelProps> = ({
  formId,
  duplicatePolicy,
}) => {
  const [requests, setRequests] = useState<DuplicateOverrideRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (duplicatePolicy !== 'block') return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDuplicateOverrideRequests(formId);
      setRequests(data);
    } catch {
      setError('Failed to load pending duplicate override requests.');
    } finally {
      setIsLoading(false);
    }
  }, [formId, duplicatePolicy]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  if (duplicatePolicy !== 'block') {
    return null;
  }

  const handleApprove = async (reqId: number) => {
    setActionLoadingId(reqId);
    try {
      await approveDuplicateOverrideRequest(reqId);
      await loadRequests();
    } catch {
      setError('Failed to approve override request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeny = async (reqId: number) => {
    setActionLoadingId(reqId);
    try {
      await denyDuplicateOverrideRequest(reqId);
      await loadRequests();
    } catch {
      setError('Failed to deny override request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="border border-ink/20 bg-cream-soft p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-ink/15 pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-terracotta" />
          <div>
            <h3 className="font-display font-bold text-sm uppercase text-ink">
              Duplicate Override Requests
            </h3>
            <p className="text-xs text-slate">
              Respondents blocked by duplicate detection policy requesting single-entry exemptions.
            </p>
          </div>
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={loadRequests} isLoading={isLoading}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {error && (
        <p className="text-xs font-mono text-danger font-semibold bg-danger/10 p-2.5 rounded border border-danger/20">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-xs font-mono text-slate italic">
          Loading pending override requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="p-6 bg-white border border-dashed border-ink/20 text-center text-xs font-mono text-slate">
          No pending duplicate override requests for this form.
        </div>
      ) : (
        <div className="border border-ink/20 bg-white overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-ink/20 bg-cream-soft text-slate">
                <th className="p-2.5">SUBMISSION</th>
                <th className="p-2.5">DUPLICATE VALUE</th>
                <th className="p-2.5">REQUESTED AT</th>
                <th className="p-2.5">STATUS</th>
                <th className="p-2.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-ink/10 hover:bg-cream-soft/50">
                  <td className="p-2.5 font-bold text-ink">#{req.submission_id}</td>
                  <td className="p-2.5 max-w-[200px] truncate text-ink font-semibold">
                    {req.duplicate_value ? `"${req.duplicate_value}"` : '(No value)'}
                  </td>
                  <td className="p-2.5 text-slate">
                    {new Date(req.requested_at).toLocaleString()}
                  </td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 text-[10px] font-bold uppercase">
                      {req.status}
                    </span>
                  </td>
                  <td className="p-2.5 flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      isLoading={actionLoadingId === req.id}
                      onClick={() => handleApprove(req.id)}
                      className="text-[10px] py-0.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check size={12} /> Approve
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      isLoading={actionLoadingId === req.id}
                      onClick={() => handleDeny(req.id)}
                      className="text-[10px] py-0.5 px-2"
                    >
                      <X size={12} /> Deny
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
