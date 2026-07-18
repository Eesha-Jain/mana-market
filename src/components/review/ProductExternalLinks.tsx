'use client';

interface ProductExternalLinksProps {
  amazonUrl?: string;
  upcUrl?: string;
  ebaySearchUrl?: string;
  tcgplayerUrl?: string;
  className?: string;
  linkClassName?: string;
}

export function ProductExternalLinks({
  amazonUrl,
  upcUrl,
  ebaySearchUrl,
  tcgplayerUrl,
  className = 'product-match-links',
  linkClassName = 'product-match-link',
}: ProductExternalLinksProps) {
  if (!amazonUrl && !upcUrl && !ebaySearchUrl && !tcgplayerUrl) return null;

  return (
    <div className={className}>
      {amazonUrl && (
        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          View on Amazon ↗
        </a>
      )}
      {upcUrl && (
        <a
          href={upcUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          View UPC catalog ↗
        </a>
      )}
      {ebaySearchUrl && (
        <a
          href={ebaySearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          View on eBay ↗
        </a>
      )}
      {tcgplayerUrl && (
        <a
          href={tcgplayerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          Search TCGPlayer ↗
        </a>
      )}
    </div>
  );
}
