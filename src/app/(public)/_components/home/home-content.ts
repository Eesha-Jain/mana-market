export const HOME_FEATURES = [
  {
    icon: '📋',
    title: 'Bulk upload',
    description:
      'Paste product names, import a CSV, or drop in a spreadsheet. Barcodes and SKUs are recognized automatically.',
  },
  {
    icon: '📷',
    title: 'Photo scan',
    description:
      'Snap a photo of sealed product and let OCR extract names and details — no manual typing required.',
  },
  {
    icon: '🔍',
    title: 'Smart product lookup',
    description:
      'Match items against eBay listings with UPC and title search. Ambiguous matches are flagged for your review.',
  },
  {
    icon: '💰',
    title: 'Review & price',
    description:
      'Set condition and quantity, compare market prices, and apply pricing rules before you list.',
  },
  {
    icon: '📤',
    title: 'Export to eBay',
    description:
      'Download eBay-ready CSV or JSON when your batch is priced and ready to go live.',
  },
  {
    icon: '📊',
    title: 'Dashboard overview',
    description:
      'Track ready items, items needing attention, and estimated total value across your current batch.',
  },
] as const;

export const HOME_STEPS = [
  {
    step: '1',
    title: 'Add your inventory',
    description: 'Upload a list, CSV, or photo scan of the sealed MTG products you want to sell.',
  },
  {
    step: '2',
    title: 'Match & review',
    description: 'Products are looked up automatically. Resolve any ambiguous matches and set pricing.',
  },
  {
    step: '3',
    title: 'Export & list',
    description: 'Export your batch in eBay format and upload it to your seller account.',
  },
] as const;
