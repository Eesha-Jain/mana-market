'use client';

export interface TabDefinition<T extends string> {
  id: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: readonly TabDefinition<T>[];
  active: T;
  onChange: (id: T) => void;
  disabled?: boolean;
  className?: string;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  disabled = false,
  className = 'tab-bar',
}: TabBarProps<T>) {
  return (
    <div className={className} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tab-btn${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
          disabled={disabled}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
