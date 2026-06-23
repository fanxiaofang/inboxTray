import { cn } from '../../utils/cn';
import { ItemStatus } from '../../types';

interface BadgeProps {
  status: ItemStatus;
}

const statusConfig: Partial<Record<ItemStatus, { label: string; className: string }>> = {
  pending: { 
    label: '待处理', 
    className: 'border-[#f59e0b] text-[#f59e0b]' 
  },
  pushed: { 
    label: '已推送', 
    className: 'border-[#10b981] text-[#10b981]' 
  },
};

export default function Badge({ status }: BadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  
  return (
    <span className={cn(
      'text-[9px] px-1.5 py-0.5 border rounded-sm uppercase tracking-wider',
      config.className
    )}>
      {config.label}
    </span>
  );
}
