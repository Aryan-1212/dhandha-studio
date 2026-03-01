import React, { useState, useEffect } from 'react';
import { getAdminRefunds, approveAdminRefund, rejectAdminRefund } from '../../services/api.js';

export default function RefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLog, setActionLog] = useState({ text: '', type: 'success' });
  const [authError, setAuthError] = useState(false);

  const loadRefunds = () => {
    setLoading(true);
    setAuthError(false);
    getAdminRefunds()
      .then((res) => setRefunds(res.data || []))
      .catch((err) => {
        if (err.status === 401 || err.status === 403) setAuthError(true);
        setRefunds([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => loadRefunds(), []);

  const handleApprove = async (id) => {
    try {
      await approveAdminRefund(id);
      setRefunds((prev) => prev.filter((r) => r.id !== id));
      setActionLog({ text: 'Refund approved. Credit returned.', type: 'success' });
    } catch (err) {
      setActionLog({ text: err.message || 'Approve failed.', type: 'danger' });
    }
    setTimeout(() => setActionLog({ text: '', type: '' }), 4000);
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason (optional):');
    try {
      await rejectAdminRefund(id, reason);
      setRefunds((prev) => prev.filter((r) => r.id !== id));
      setActionLog({ text: 'Refund rejected.', type: 'success' });
    } catch (err) {
      setActionLog({ text: err.message || 'Reject failed.', type: 'danger' });
    }
    setTimeout(() => setActionLog({ text: '', type: '' }), 4000);
  };

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading refunds...</div>;
  if (authError) return <div className="card"><div className="empty-state"><div className="empty-title">Authentication required</div><div className="empty-desc">Set your API key to view refund requests.</div></div></div>;

  return (
    <div>
      <h1 className="page-title">Refund Requests</h1>
      <p className="page-desc">Review and manage pending refund requests from users.</p>

      {actionLog.text && <div className={`alert alert-${actionLog.type}`}>{actionLog.text}</div>}

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{refunds.length}</div>
          <div className="stat-label">Pending</div>
        </div>
      </div>

      {refunds.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <div className="empty-title">All clear!</div>
            <div className="empty-desc">No pending refund requests.</div>
          </div>
        </div>
      ) : (
        <div className="refund-list">
          {refunds.map((r) => (
            <div key={r.id} className="card refund-ticket" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {r.refund_id} · User: {r.user_id} · Job: {r.job_id} · {r.credits_requested} credit(s)
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Reason:</strong> {r.reason}
                  </div>
                  {r.prompt && (
                    <div style={{ marginBottom: 12, fontSize: 13 }}>
                      <strong>Prompt:</strong>
                      <pre style={{ margin: '4px 0 0', padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 80 }}>{typeof r.prompt === 'string' ? r.prompt : JSON.stringify(r.prompt)}</pre>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-sm btn-success" onClick={() => handleApprove(r.id)}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleReject(r.id)}>Reject</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {r.input_image_url && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Raw image</div>
                      <img src={r.input_image_url} alt="Raw" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                    </div>
                  )}
                  {r.output_url && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Generated</div>
                      <img src={r.output_url} alt="Generated" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
