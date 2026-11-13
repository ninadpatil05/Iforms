import React, { useState, useEffect, useCallback } from 'react';
import {
  getDuplicateOverrideRequests,
  approveDuplicateOverrideRequest,
  denyDuplicateOverrideRequest,
  DuplicateOverrideRequestItem,
} from '@/api/duplicateOverride';
import { Button } from '@/components/Button';
import { ShieldAlert, Check, X, RefreshCw, Inbox } from 'lucide-react';

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
    <div className="space-y-3 pt-3 border-t border-paper-border">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-ink-muted">
          OVERRIDE REQUESTS
        </span>
        <button
          type="button"
          onClick={loadRequests}
          disabled={isLoading}
          className="text-ink-muted hover:text-ink transition-colors p-1 rounded-sm cursor-pointer"
          title="Refresh requests"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <p className="text-xs font-mono text-brick font-semibold bg-brick-container/60 p-2.5 rounded-sm border border-brick-border">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-xs font-mono text-ink-muted italic">
          Loading pending override requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="p-8 bg-paper-lowest border border-dashed border-paper-border rounded-md text-center space-y-2 select-none">
          <Inbox size={22} className="mx-auto text-ink-subtle opacity-60" />
          <p className="text-xs font-mono text-ink-muted">
            No pending duplicate override requests to review.
          </p>
        </div>
      ) : (
        <div className="border border-paper-border bg-paper-lowest rounded-md overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-paper-border bg-paper-high/60 text-ink-muted">
                <th className="p-2.5">SUBMISSION</th>
                <th className="p-2.5">DUPLICATE VALUE</th>
                <th className="p-2.5">REQUESTED AT</th>
                <th className="p-2.5">STATUS</th>
                <th className="p-2.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-paper-border last:border-none hover:bg-paper-high/30">
                  <td className="p-2.5 font-bold text-ink">#{req.submission_id}</td>
                  <td className="p-2.5 max-w-[200px] truncate text-ink font-semibold">
                    {req.duplicate_value ? `"${req.duplicate_value}"` : '(No value)'}
                  </td>
                  <td className="p-2.5 text-ink-muted">
                    {new Date(req.requested_at).toLocaleString()}
                  </td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded-full bg-amber-container text-amber text-[10px] font-bold uppercase">
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
                      className="text-[10px] py-0.5 px-2 bg-forest hover:bg-forest/90 text-white"
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
