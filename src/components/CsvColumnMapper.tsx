import {
  CSV_COLUMN_KEYS,
  CSV_COLUMN_LABELS,
  type ColumnMappingChoice,
  type CSVColumnKey,
} from '../utils/csvParser';

interface CsvColumnMapperProps {
  unrecognizedHeaders: string[];
  mappings: Record<string, ColumnMappingChoice>;
  mappingWarnings?: string[];
  onMappingChange: (header: string, choice: ColumnMappingChoice) => void;
  onConfirm: () => void;
  onCancel: () => void;
  rowCount: number;
}

export function CsvColumnMapper({
  unrecognizedHeaders,
  mappings,
  mappingWarnings = [],
  onMappingChange,
  onConfirm,
  onCancel,
  rowCount,
}: CsvColumnMapperProps) {
  const headerList = unrecognizedHeaders.join(', ');

  return (
    <div className="csv-column-mapper">
      <div className="csv-column-mapper-banner">
        <p className="csv-column-mapper-title">We couldn&apos;t recognize these columns</p>
        <p className="csv-column-mapper-desc">
          Your file has {rowCount} data row{rowCount !== 1 ? 's' : ''} with extra columns ({headerList}).
          Map each one to a supported field or discard the data.
        </p>
      </div>

      {mappingWarnings.length > 0 && (
        <div className="form-error-banner csv-column-mapper-warnings" role="status">
          {mappingWarnings.map(warning => (
            <p key={warning} style={{ margin: 0 }}>{warning}</p>
          ))}
        </div>
      )}

      <div className="csv-column-mapper-list">
        {unrecognizedHeaders.map(header => (
          <div key={header} className="csv-column-mapper-row">
            <span className="csv-column-mapper-source">
              <code>{header}</code>
            </span>
            <span className="csv-column-mapper-arrow" aria-hidden="true">→</span>
            <select
              className="inline-select csv-column-mapper-select"
              value={mappings[header] ?? 'discard'}
              onChange={e => onMappingChange(header, e.target.value as ColumnMappingChoice)}
              aria-label={`Map column ${header}`}
            >
              <option value="discard">Discard data</option>
              {CSV_COLUMN_KEYS.map((key: CSVColumnKey) => (
                <option key={key} value={key}>
                  {CSV_COLUMN_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="tab-actions">
        <button type="button" className="btn-primary" onClick={onConfirm}>
          Continue with {rowCount} row{rowCount !== 1 ? 's' : ''}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel import
        </button>
      </div>
    </div>
  );
}
