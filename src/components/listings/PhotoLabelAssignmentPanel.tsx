'use client';

import type { OcrLineAssignment, OcrLineTarget } from '@/utils/ocr';
import type { ProductReviewData } from '@/utils/review';

interface PhotoLabelAssignmentPanelProps {
  data: ProductReviewData;
  lineAssignments: OcrLineAssignment[];
  onSetLineTarget: (line: string, target: OcrLineTarget) => void;
  onMoveLine: (index: number, direction: -1 | 1) => void;
  onResetAssignments: () => void;
}

export function PhotoLabelAssignmentPanel({
  data,
  lineAssignments,
  onSetLineTarget,
  onMoveLine,
  onResetAssignments,
}: PhotoLabelAssignmentPanelProps) {
  if (!data.parseResult && data.readableLines.length === 0) {
    return null;
  }

  return (
    <>
      {data.parseResult && (
        <div className="product-review-detected-banner">
          <span className="product-review-detected-label">Detected from label</span>
          <p className="product-review-detected-title">{data.parseResult.fullTitle}</p>
          <div className="photo-insight-chips">
            {data.parseResult.packType && (
              <span className="badge badge--gray">{data.parseResult.packType}</span>
            )}
            {data.parseResult.cardCount && (
              <span className="badge badge--gray">{data.parseResult.cardCount}</span>
            )}
          </div>
          <button
            type="button"
            className="btn-link btn-sm"
            onClick={onResetAssignments}
          >
            Reset label assignments
          </button>
        </div>
      )}

      {data.readableLines.length > 0 && (
        <section className="photo-review-section photo-review-labels">
          <div className="photo-review-section-head">
            <div>
              <h3 className="item-detail-section-title">Label text</h3>
              <p className="photo-labels-hint">
                Tap a destination for each line. Reorder with the arrows.
              </p>
            </div>
            <div className="photo-labels-legend" aria-hidden="true">
              <span className="photo-labels-legend-item photo-labels-legend-item--title">Title</span>
              <span className="photo-labels-legend-item photo-labels-legend-item--desc">Description</span>
              <span className="photo-labels-legend-item photo-labels-legend-item--skip">Skip</span>
            </div>
          </div>
          <div className="photo-line-target-list">
            {lineAssignments.map(({ line, target }, index) => (
              <div
                key={`${index}-${line}`}
                className={`photo-line-target-row photo-line-target-row--${target}`}
              >
                <span className="photo-line-index">{index + 1}</span>
                <div className="photo-line-target-main">
                  <div className="photo-line-reorder">
                    <button
                      type="button"
                      className="photo-line-reorder-btn"
                      disabled={index === 0}
                      onClick={() => onMoveLine(index, -1)}
                      aria-label={`Move "${line}" up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="photo-line-reorder-btn"
                      disabled={index === lineAssignments.length - 1}
                      onClick={() => onMoveLine(index, 1)}
                      aria-label={`Move "${line}" down`}
                    >
                      ↓
                    </button>
                  </div>
                  <span className="photo-line-target-text">{line}</span>
                </div>
                <div
                  className="photo-line-target-options photo-line-segment"
                  role="group"
                  aria-label={`Assign "${line}"`}
                >
                  {(['none', 'title', 'description'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      className={`photo-line-target-btn${target === option ? ' photo-line-target-btn--active' : ''}`}
                      onClick={() => onSetLineTarget(line, option)}
                    >
                      {option === 'none' ? 'Skip' : option === 'title' ? 'Title' : 'Description'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
