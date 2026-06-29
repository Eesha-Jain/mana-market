interface ProductExternalLinksProps {
  ebaySearchUrl?: string;
  tcgplayerUrl?: string;
  className?: string;
  linkClassName?: string;
}

export function ProductExternalLinks({
  ebaySearchUrl,
  tcgplayerUrl,
  className = 'product-match-links',
  linkClassName = 'product-match-link',
}: ProductExternalLinksProps) {
  if (!ebaySearchUrl && !tcgplayerUrl) return null;

  return (
    <div className={className}>
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
