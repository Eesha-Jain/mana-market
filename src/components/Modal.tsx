'use client';

import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
  className = '',
  bodyClassName = '',
}: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${wide ? ' modal--wide' : ''}${className ? ` ${className}` : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle != null && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
          {children}
        </div>

        {footer != null && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
