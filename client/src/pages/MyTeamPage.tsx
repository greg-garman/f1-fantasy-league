import { useState, useEffect, useMemo } from 'react';
import { getMyTeam, getDrivers, updateTeam, removeDriver, getRemainingTransfers } from '../api/client';
import type { UserTeamEntry, F1Driver } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import BudgetBar from '../components/team/BudgetBar';
import DriverCard from '../components/drivers/DriverCard';

export default function MyTeamPage() {
  const [team, setTeam] = useState<UserTeamEntry[]>([]);
  const [budget, setBudget] = useState(100);
  const [allDrivers, setAllDrivers] = useState<F1Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  /* transfer modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [slotToReplace, setSlotToReplace] = useState<UserTeamEntry | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<F1Driver | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'name'>('name');

  useEffect(() => {
    async function load() {
      try {
        const [t, d, r] = await Promise.all([
          getMyTeam(),
          getDrivers(),
          getRemainingTransfers().catch(() => ({ remaining: -1 })),
        ]);
        setTeam(t.team);
        setBudget(t.budget);
        setAllDrivers(d);
        setRemaining(r.remaining);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const spent = useMemo(
    () => team.reduce((s, t) => s + t.price_paid, 0),
    [team],
  );

  /* Drivers available for transfer: not already on team */
  const teamDriverIds = new Set(team.map((t) => t.driver_id));
  const available = useMemo(() => {
    let list = allDrivers
      .filter((d) => d.is_active && !teamDriverIds.has(d.driver_id))
      .filter((d) => {
        if (!filterText) return true;
        const q = filterText.toLowerCase();
        return (
          d.first_name.toLowerCase().includes(q) ||
          d.last_name.toLowerCase().includes(q) ||
          d.constructor_name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q)
        );
      });

    if (sortBy === 'price') list = list.sort((a, b) => b.current_price - a.current_price);
    else list = list.sort((a, b) => a.last_name.localeCompare(b.last_name));

    return list;
  }, [allDrivers, teamDriverIds, filterText, sortBy]);

  const openTransferModal = (slot: UserTeamEntry | null) => {
    setSlotToReplace(slot);
    setSelectedDriver(null);
    setError('');
    setFilterText('');
    setModalOpen(true);
  };

  const confirmTransfer = async () => {
    if (!selectedDriver) return;
    setTransferring(true);
    setError('');
    try {
      const slot = slotToReplace?.slot ?? [1, 2, 3, 4, 5].find((s) => !team.some((t) => t.slot === s))!;
      const res = await updateTeam(slot, selectedDriver.driver_id);
      setTeam(res.team);
      setBudget(res.budget);
      setModalOpen(false);
      getRemainingTransfers().then((r) => setRemaining(r.remaining)).catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const handleRemove = async (slot: UserTeamEntry) => {
    setRemoving(slot.slot);
    try {
      const res = await removeDriver(slot.slot);
      setTeam(res.team);
      setBudget(res.budget);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(null);
    }
  };

  const budgetAfterTransfer = useMemo(() => {
    if (!selectedDriver) return budget;
    const outPrice = slotToReplace ? slotToReplace.price_paid : 0;
    return budget + outPrice - selectedDriver.current_price;
  }, [selectedDriver, slotToReplace, budget]);

  if (loading) return <Spinner />;

  return (
    <div className="page">
      <h1 className="page__title">My Team</h1>

      <BudgetBar spent={spent} total={spent + budget} />

      {remaining !== null && remaining >= 0 && (
        <p className="text-gray mb-2" style={{ fontSize: '0.8125rem' }}>
          {remaining >= 999
            ? 'Unlimited transfers until qualifying starts'
            : <>Transfers remaining this race: <strong>{remaining}</strong></>}
        </p>
      )}

      {/* Team slots */}
      <Card title="Current Roster">
        {team.length === 0 && (
          <p className="text-gray">No drivers selected yet. Add drivers to your team!</p>
        )}
        {team.map((slot) => {
          const d = slot.driver;
          return (
            <div key={slot.id} className="driver-card" style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openTransferModal(slot)}>
                <div className="driver-card__info">
                  <span className="driver-card__name">
                    {d ? `${d.first_name} ${d.last_name}` : slot.driver_id}
                  </span>
                  <span className="driver-card__constructor">{d?.constructor_name || ''}</span>
                </div>
                <div className="driver-card__meta">
                  <span className="driver-card__price">
                    ${(d?.current_price ?? slot.price_paid).toFixed(1)}M
                  </span>
                  <span className="driver-card__code">{d?.code || ''}</span>
                </div>
              </div>
              {remaining !== null && remaining >= 999 && (
                <button
                  className="btn btn--danger btn--small"
                  style={{ marginLeft: '0.5rem', whiteSpace: 'nowrap' }}
                  disabled={removing === slot.slot}
                  onClick={(e) => { e.stopPropagation(); handleRemove(slot); }}
                >
                  {removing === slot.slot ? '...' : 'Remove'}
                </button>
              )}
            </div>
          );
        })}
        {team.length < 5 && (
          <Button variant="primary" size="small" className="mt-1" onClick={() => openTransferModal(null)}>
            + Add Driver
          </Button>
        )}
      </Card>

      {team.length > 0 && (
        <Button variant="secondary" onClick={() => openTransferModal(null)}>
          Make Transfer
        </Button>
      )}

      {/* Transfer Modal */}
      <Modal
        title={slotToReplace?.driver ? `Replace ${slotToReplace.driver.first_name} ${slotToReplace.driver.last_name}` : 'Add Driver'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="small" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={!selectedDriver || transferring || budgetAfterTransfer < 0}
              onClick={confirmTransfer}
            >
              {transferring ? 'Transferring...' : 'Confirm Transfer'}
            </Button>
          </>
        }
      >
        {error && <div className="login-card__error mb-1">{error}</div>}

        {selectedDriver && (
          <div className="mb-1" style={{ fontSize: '0.8125rem' }}>
            Budget after transfer:{' '}
            <strong className={budgetAfterTransfer < 0 ? 'text-danger' : 'text-green'}>
              ${budgetAfterTransfer.toFixed(1)}M
            </strong>
          </div>
        )}

        <div className="transfer-filter mb-1">
          <input
            type="text"
            placeholder="Filter drivers..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'price' | 'name')}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}
          >
            <option value="price">Price</option>
            <option value="name">Name</option>
          </select>
        </div>

        <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
          {available.map((d) => (
            <DriverCard
              key={d.id}
              driver={d}
              selected={selectedDriver?.id === d.id}
              onClick={() => setSelectedDriver(d)}
            />
          ))}
          {available.length === 0 && <p className="text-gray text-center mt-2">No drivers available</p>}
        </div>
      </Modal>
    </div>
  );
}
