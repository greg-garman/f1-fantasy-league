interface SpinnerProps {
  small?: boolean;
}

export default function Spinner({ small = false }: SpinnerProps) {
  return (
    <div className={`spinner ${small ? 'spinner--small' : ''}`}>
      <div className="spinner__circle" />
    </div>
  );
}
