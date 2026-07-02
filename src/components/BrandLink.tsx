import Link from 'next/link';
import { SITE_NAME } from '../brand';
import { BrandLogo } from './BrandLogo';
import { BrandWordmark } from './BrandWordmark';

interface BrandLinkProps {
  className?: string;
}

/** Logo mark + wordmark linked to home — use in navbar and other chrome. */
export function BrandLink({ className = 'navbar-brand' }: BrandLinkProps) {
  return (
    <Link href="/" className={className} aria-label={SITE_NAME}>
      <BrandLogo variant="nav" decorative />
      <BrandWordmark />
    </Link>
  );
}
