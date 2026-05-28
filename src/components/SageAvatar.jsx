export default function SageAvatar({ size = 'md', state = 'neutral' }) {
  const sizes = {
    sm: { box: 32, viewBox: 32 },
    md: { box: 48, viewBox: 32 },
    lg: { box: 80, viewBox: 32 },
  };

  const s = sizes[size] || sizes.md;

  // Face features by state
  const faces = {
    neutral: (
      <>
        {/* Eyes — open circles */}
        <circle cx="11" cy="14" r="1.8" fill="#3D2E1A" />
        <circle cx="21" cy="14" r="1.8" fill="#3D2E1A" />
        {/* Eye highlights */}
        <circle cx="11.6" cy="13.3" r="0.6" fill="white" opacity="0.7" />
        <circle cx="21.6" cy="13.3" r="0.6" fill="white" opacity="0.7" />
        {/* Slight smile */}
        <path d="M12.5 19.5 Q16 22 19.5 19.5" stroke="#3D2E1A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    ),
    thinking: (
      <>
        {/* Eyes — slightly narrowed (flat arcs) */}
        <path d="M9 14.5 Q11 12.5 13 14.5" stroke="#3D2E1A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M19 14.5 Q21 12.5 23 14.5" stroke="#3D2E1A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* Neutral mouth — gentle flat line */}
        <path d="M13 20 Q16 20.5 19 20" stroke="#3D2E1A" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </>
    ),
    happy: (
      <>
        {/* Eyes — raised happy arcs */}
        <path d="M9.2 15 Q11 12 12.8 15" stroke="#3D2E1A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M19.2 15 Q21 12 22.8 15" stroke="#3D2E1A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* Wider smile */}
        <path d="M11.5 19 Q16 23.5 20.5 19" stroke="#3D2E1A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    ),
  };

  return (
    <div
      className="rounded-full sage-avatar-shadow flex-shrink-0"
      style={{
        width: s.box,
        height: s.box,
        background: 'linear-gradient(145deg, #F7B733, #F5A623)',
      }}
    >
      <svg
        width={s.box}
        height={s.box}
        viewBox={`0 0 ${s.viewBox} ${s.viewBox}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {faces[state] || faces.neutral}
      </svg>
    </div>
  );
}
