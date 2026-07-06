'use client';

import type { ReactNode } from 'react';

interface ModalProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  compact?: boolean;
  className?: string;
  overlayClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  headerInnerClassName?: string;
  subtitleClassName?: string;
  titleExtra?: ReactNode;
  footerClassName?: string;
  footerAfter?: ReactNode;
  afterPanel?: ReactNode;
  hideHeader?: boolean;
  hideClose?: boolean;
  bareBody?: boolean;
  closeOnOverlayClick?: boolean;
  overlayRole?: string;
  overlayAriaLive?: 'polite' | 'assertive' | 'off';
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
  compact = false,
  className = '',
  overlayClassName = '',
  bodyClassName = '',
  headerClassName = '',
  headerInnerClassName = '',
  subtitleClassName = '',
  titleExtra,
  footerClassName = '',
  footerAfter,
  afterPanel,
  hideHeader = false,
  hideClose = false,
  bareBody = false,
  closeOnOverlayClick = true,
  overlayRole,
  overlayAriaLive,
}: ModalProps) {
  const body = bareBody ? (
    children
  ) : (
    <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
      {children}
    </div>
  );

  return (
    <div
      className={`modal-overlay${overlayClassName ? ` ${overlayClassName}` : ''}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
      role={overlayRole}
      aria-live={overlayAriaLive}
    >
      <div
        className={`modal${wide ? ' modal--wide' : ''}${compact ? ' modal--compact' : ''}${className ? ` ${className}` : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {!hideHeader && (
          <div className={`modal-header${headerClassName ? ` ${headerClassName}` : ''}`}>
            <div className={headerInnerClassName || undefined}>
              {titleExtra ? (
                <div className="photo-review-title-row">
                  {title != null && <h2 className="modal-title">{title}</h2>}
                  {titleExtra}
                </div>
              ) : (
                title != null && <h2 className="modal-title">{title}</h2>
              )}
              {subtitle != null && (
                <p className={`modal-subtitle${subtitleClassName ? ` ${subtitleClassName}` : ''}`}>
                  {subtitle}
                </p>
              )}
            </div>
            {!hideClose && (
              <button className="modal-close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            )}
          </div>
        )}

        {body}

        {footer != null && (
          <div className={`modal-footer${footerClassName ? ` ${footerClassName}` : ''}`}>
            {footer}
          </div>
        )}

        {footerAfter}
      </div>

      {afterPanel}
    </div>
  );
}
