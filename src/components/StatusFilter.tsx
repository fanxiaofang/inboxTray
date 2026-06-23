import { ItemStatus } from '../types';

interface StatusFilterProps {
  value: ItemStatus | 'all';
  onChange: (status: ItemStatus | 'all') => void;
}

const options: { value: ItemStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'pushed', label: '已推送' },
];

export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div className="flex">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 text-xs transition-all border-b-2 ${
              value === opt.value
                ? 'text-app-accent-hover border-app-accent'
                : 'text-app-muted border-transparent hover:text-app-accent'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
