export default function ConceptCard({ concept, index }) {
  const pillConfig = {
    low: {
      label: 'Getting it',
      bg: '#FCE8E6',
      text: '#A82B2B',
      border: '#FAD2CD',
    },
    medium: {
      label: 'Mostly there',
      bg: '#FFF6E6',
      text: '#B8801A',
      border: '#FFE7C2',
    },
    high: {
      label: 'Solid',
      bg: '#EAF6EC',
      text: '#15803D',
      border: '#D5F0DB',
    },
  };

  const pill = pillConfig[concept.confidence] || pillConfig.low;

  return (
    <div
      className="animate-slide-up"
      style={{
        animationDelay: `${index * 80}ms`,
        background: '#F7F6F2',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 8,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>
          {concept.name}
        </h4>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: pill.text,
            background: pill.bg,
            border: `1px solid ${pill.border}`,
            borderRadius: 999,
            padding: '2px 10px',
            whiteSpace: 'nowrap',
            lineHeight: '18px',
          }}
        >
          {pill.label}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#7A7975', fontStyle: 'italic', lineHeight: 1.55, marginTop: 4 }}>
        "{concept.note}"
      </p>
    </div>
  );
}
