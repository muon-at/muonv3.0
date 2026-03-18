interface Record {
  title: string;
  value: number;
  date: string;
}

interface RecordPlaqueProps {
  record: Record;
}

export default function RecordPlaque({ record }: RecordPlaqueProps) {
  return (
    <div className="record-plaque">
      <div className="plaque-icon">⭐</div>
      <div className="plaque-content">
        <div className="plaque-title">{record.title}</div>
        <div className="plaque-value-wreath">
          <svg className="wreath-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            {/* Top left curve */}
            <path d="M 50 50 Q 30 80 40 110" stroke="#6b5d29" strokeWidth="3" fill="none" strokeLinecap="round"/>
            {/* Top right curve */}
            <path d="M 150 50 Q 170 80 160 110" stroke="#6b5d29" strokeWidth="3" fill="none" strokeLinecap="round"/>
            {/* Bottom left curve */}
            <path d="M 40 110 Q 30 140 60 160" stroke="#6b5d29" strokeWidth="3" fill="none" strokeLinecap="round"/>
            {/* Bottom right curve */}
            <path d="M 160 110 Q 170 140 140 160" stroke="#6b5d29" strokeWidth="3" fill="none" strokeLinecap="round"/>
            {/* Left leaves */}
            <ellipse cx="45" cy="70" rx="6" ry="10" fill="#6b5d29" opacity="0.8" transform="rotate(-30 45 70)"/>
            <ellipse cx="35" cy="100" rx="6" ry="10" fill="#6b5d29" opacity="0.8" transform="rotate(-60 35 100)"/>
            <ellipse cx="40" cy="130" rx="6" ry="10" fill="#6b5d29" opacity="0.8" transform="rotate(-30 40 130)"/>
            {/* Right leaves */}
            <ellipse cx="155" cy="70" rx="6" ry="10" fill="#6b5d29" opacity="0.8" transform="rotate(30 155 70)"/>
            <ellipse cx="165" cy="100" rx="6" ry="10" fill="#6b5d29" opacity="0.8" transform="rotate(60 165 100)"/>
            <ellipse cx="160" cy="130" rx="6" ry="10" fill="#6b5d29" opacity="0.8" transform="rotate(30 160 130)"/>
          </svg>
          <div className="plaque-value">{record.value}</div>
        </div>
        <div className="plaque-date">{record.date}</div>
      </div>
    </div>
  );
}
