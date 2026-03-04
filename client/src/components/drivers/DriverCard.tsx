import type { F1Driver } from '../../types';

interface DriverCardProps {
  driver: F1Driver;
  priceChange?: number;
  selected?: boolean;
  onClick?: () => void;
}

export default function DriverCard({ driver, priceChange, selected = false, onClick }: DriverCardProps) {
  const changeClass =
    priceChange && priceChange > 0
      ? 'driver-card__change driver-card__change--up'
      : priceChange && priceChange < 0
        ? 'driver-card__change driver-card__change--down'
        : '';

  return (
    <div
      className={`driver-card ${selected ? 'driver-card--selected' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="driver-card__info">
        <span className="driver-card__name">
          {driver.first_name} {driver.last_name}
        </span>
        <span className="driver-card__constructor">{driver.constructor_name}</span>
      </div>
      <div className="driver-card__meta">
        <span className="driver-card__price">${driver.current_price.toFixed(1)}M</span>
        <span className="driver-card__code">{driver.code}</span>
        {priceChange !== undefined && priceChange !== 0 && (
          <span className={changeClass}>
            {priceChange > 0 ? '\u25B2 +' : '\u25BC '}
            {priceChange.toFixed(1)}M
          </span>
        )}
      </div>
    </div>
  );
}
