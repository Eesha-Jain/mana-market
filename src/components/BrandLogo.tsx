import { LOGO_PATH, SITE_NAME } from '../brand';

interface BrandLogoProps {
  /** `nav` — compact header mark; `auth` — larger mark for sign-in pages. */
  variant?: 'nav' | 'auth';
  className?: string;
  /** Hide from assistive tech when the wordmark is shown alongside. */
  decorative?: boolean;
}

export function BrandLogo({
  variant = 'nav',
  className = '',
  decorative = false,
}: BrandLogoProps) {
  return (
    <img
      src={LOGO_PATH}
      alt={decorative ? '' : `${SITE_NAME} logo`}
      aria-hidden={decorative || undefined}
      className={`brand-logo brand-logo--${variant}${className ? ` ${className}` : ''}`}
    />
  );
}
