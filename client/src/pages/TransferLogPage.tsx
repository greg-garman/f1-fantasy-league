import { useState, useEffect } from 'react';
import { getTransferLog } from '../api/client';
import type { Transfer } from '../types';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

export default function TransferLogPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTransferLog()
      .then(setTransfers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <h1 className="page__title">Transfer Log</h1>

      {transfers.length === 0 ? (
        <p className="text-gray">No transfers recorded yet.</p>
      ) : (
        <Card>
          {transfers.map((t) => (
            <div key={t.id} className="transfer-item">
              <span className="transfer-item__player">{t.user_name || `User #${t.user_id}`}</span>
              <div className="transfer-item__arrow">
                {t.driver_out_id && (
                  <span className="transfer-item__out">
                    {t.driver_out_name || t.driver_out_id} (${t.price_out.toFixed(1)}M)
                  </span>
                )}
                {t.driver_out_id && <span>&rarr;</span>}
                <span className="transfer-item__in">
                  {t.driver_in_name || t.driver_in_id} (${t.price_in.toFixed(1)}M)
                </span>
              </div>
              <span className="transfer-item__time">
                {new Date(t.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
