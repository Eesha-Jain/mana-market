import { ITEM_STATUS, type ItemStatus } from '@/types';

interface ItemStatusBadgeProps {
  status: ItemStatus;
  hasCondition: boolean;
}

export function ItemStatusBadge({ status, hasCondition }: ItemStatusBadgeProps) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    [ITEM_STATUS.Idle]: { label: 'Queued', cls: 'badge--gray' },
    [ITEM_STATUS.Searching]: { label: 'Searching…', cls: 'badge--blue badge--pulse' },
    [ITEM_STATUS.Found]: {
      label: hasCondition ? 'Ready' : 'Set condition',
      cls: hasCondition ? 'badge--green' : 'badge--yellow',
    },
    [ITEM_STATUS.Ambiguous]: { label: 'Ambiguous', cls: 'badge--yellow' },
    [ITEM_STATUS.NotFound]: { label: 'Not Found', cls: 'badge--red' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'badge--gray' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
