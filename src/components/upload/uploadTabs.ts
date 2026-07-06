export const UPLOAD_TABS = [
  { id: 'single', label: 'Single Entry' },
  { id: 'bulk', label: 'Bulk Names' },
  { id: 'csv', label: 'CSV / Spreadsheet' },
  { id: 'photo', label: 'Photo Scan' },
] as const;

export type UploadTabId = (typeof UPLOAD_TABS)[number]['id'];
