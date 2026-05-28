export default function PhaseBadge({ phase }) {
  const config = {
    teaching: {
      label: 'Teaching',
      bg: 'bg-accent-blue/10',
      text: 'text-[#1D4ED8]',
      dot: 'bg-accent-blue',
    },
    quiz: {
      label: 'Quiz',
      bg: 'bg-accent-amber/10',
      text: 'text-[#B8801A]',
      dot: 'bg-accent-amber',
    },
    results: {
      label: 'Results',
      bg: 'bg-confidence-high/10',
      text: 'text-[#15803D]',
      dot: 'bg-confidence-high',
    },
  };

  const c = config[phase] || config.teaching;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
