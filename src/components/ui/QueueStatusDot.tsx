const QUEUE_STATUS_ICONS: Record<string, string> = {
  idle: '⏳',
  searching: '🔍',
  found: '✅',
  ambiguous: '⚠️',
  not_found: '❌',
};

export function QueueStatusDot({ status }: { status: string }) {
  return <span title={status}>{QUEUE_STATUS_ICONS[status] ?? '•'}</span>;
}
