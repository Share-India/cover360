"use client";

import { useEffect, useState } from 'react';
import styles from '../Dashboard.module.css';
import { fetchHistory } from '../../../utils/api'; // you can implement this API later

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchHistory();
        setHistory(data);
      } catch (e) {
        console.error('Failed to fetch history', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loader}></div>
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Loading history...</p>
      </div>
    );
  }

  return (
    <div className={`${styles.dashboard} p-4 sm:p-8`}>
      <header className={styles.header}>
        <h1 className={styles.title}>Policy History</h1>
      </header>
      {history.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '3rem 0' }}>
          No previous uploads.
        </p>
      ) : (
        <div className={styles.historyGrid}>
          {history.map((item) => (
            <div key={item.id} className={styles.historyCard}>
              <div className={styles.historyHeader}>
                <span className={styles.historyFile}>{item.file_name || 'Document'}</span>
                <span className={styles.historyDate}>
                  {new Date(item.upload_date).toLocaleDateString()}
                </span>
              </div>
              {item.uploadedBy && (
                <div style={{marginTop: '0.5rem'}}>
                  <div style={{fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.2rem'}}>Uploaded by</div>
                  <div style={{fontWeight: '600', color: 'var(--foreground)'}}>{item.uploadedBy.name} <span style={{fontWeight: 400, color: 'var(--muted)'}}>({item.uploadedBy.email})</span></div>
                </div>
              )}
              <div style={{marginTop: '0.5rem'}}>
                <div style={{fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.2rem'}}>Policy Holder</div>
                <div style={{fontWeight: '600', color: 'var(--foreground)'}}>{item.policyHolderName || 'N/A'} {item.age ? `(Age: ${item.age})` : ''}</div>
              </div>
              <div style={{marginTop: '0.5rem'}}>
                <div style={{fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.2rem'}}>Vehicle</div>
                <div style={{fontWeight: '600', color: 'var(--foreground)'}}>{item.vehicleModel || 'N/A'} {item.manufacturerYear ? `(${item.manufacturerYear})` : ''}</div>
              </div>
              <div style={{marginTop: '0.5rem'}}>
                <div style={{fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.2rem'}}>Registration</div>
                <div style={{fontWeight: '600', color: 'var(--foreground)'}}>{item.vehicleRegistrationNo || 'N/A'}</div>
              </div>
              <div style={{marginTop: '0.5rem'}}>
                <div style={{fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.2rem'}}>Estimated Cost</div>
                <div style={{fontWeight: '600', color: 'var(--foreground)'}}>{item.carCost || item.idv || 'N/A'}</div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
