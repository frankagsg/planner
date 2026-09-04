import type { FamilyMember } from '../types';

// A round avatar chip: member emoji or first initial on their color.
export function MemberAvatar({
  member,
  size = 40,
}: {
  member: FamilyMember;
  size?: number;
}) {
  const initial = (member.name || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 kiosk-nosel shadow-soft"
      style={{
        backgroundColor: member.color,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      title={member.name}
      aria-label={member.name}
    >
      {member.emoji ? <span style={{ fontSize: Math.round(size * 0.5) }}>{member.emoji}</span> : initial}
    </span>
  );
}

// A small colored dot for a member (used inline on list rows). Null => shared.
export function MemberDot({ color }: { color?: string | null }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
      style={{ backgroundColor: color || 'rgb(var(--content-faint))' }}
    />
  );
}

// A horizontal segmented filter: All + one chip per member. Touch-friendly.
export function MemberFilter({
  members,
  value,
  onChange,
}: {
  members: FamilyMember[];
  value: number | null; // null = All
  onChange: (id: number | null) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button
        onClick={() => onChange(null)}
        className={`btn !py-2 !px-4 ${value === null ? 'btn-primary' : 'btn-ghost'}`}
      >
        Everyone
      </button>
      {members.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`btn !py-2 !px-4 gap-2 ${value === m.id ? '' : 'btn-ghost'}`}
          style={value === m.id ? { backgroundColor: m.color, color: '#fff' } : undefined}
        >
          <MemberAvatar member={m} size={26} />
          {m.name}
        </button>
      ))}
    </div>
  );
}

// A <select> of members for edit modals (value "" = shared/unassigned).
export function MemberSelect({
  members,
  value,
  onChange,
  allowShared = true,
  sharedLabel = 'Shared / everyone',
}: {
  members: FamilyMember[];
  value: number | null;
  onChange: (id: number | null) => void;
  allowShared?: boolean;
  sharedLabel?: string;
}) {
  return (
    <select
      className="input"
      data-vkeyboard="off"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      {allowShared && <option value="">{sharedLabel}</option>}
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.emoji ? `${m.emoji} ` : ''}
          {m.name}
        </option>
      ))}
    </select>
  );
}
