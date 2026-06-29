interface BrandWordmarkProps {
  as?: 'span' | 'h1';
  className?: string;
}

export function BrandWordmark({ as: Tag = 'span', className = '' }: BrandWordmarkProps) {
  return (
    <Tag className={`brand-wordmark${className ? ` ${className}` : ''}`}>
      <span className="brand-wordmark-primary">Mana</span>
      <span className="brand-wordmark-secondary"> Market</span>
    </Tag>
  );
}
