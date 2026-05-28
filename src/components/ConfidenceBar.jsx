export default function ConfidenceBar({ confidence }) {
  const config = {
    low: {
      label: 'Getting it',
      color: 'bg-confidence-low',
      textColor: 'text-confidence-low',
      bgColor: 'bg-confidence-low-bg',
      width: '33%',
    },
    medium: {
      label: 'Mostly there',
      color: 'bg-confidence-medium',
      textColor: 'text-[#B8801A]',
      bgColor: 'bg-confidence-medium-bg',
      width: '66%',
    },
    high: {
      label: 'Solid',
      color: 'bg-confidence-high',
      textColor: 'text-[#15803D]',
      bgColor: 'bg-confidence-high-bg',
      width: '100%',
    },
  };

  const c = config[confidence] || config.low;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-navy-700/40 overflow-hidden">
        <div
          className={`h-full rounded-full ${c.color} transition-all duration-500 ease-out`}
          style={{ width: c.width, opacity: 0.7 }}
        />
      </div>
      <span
        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${c.bgColor} ${c.textColor} whitespace-nowrap`}
      >
        {c.label}
      </span>
    </div>
  );
}
