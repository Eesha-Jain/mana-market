'use client';

import { ItemModalReview, type ItemModalReviewProps } from './ItemModalReview';

export type { BatchProgress } from './ItemModalShell';
export type { ItemModalReviewProps };

/** @deprecated Detail editing is handled by UserItemModal. */
export type ItemModalProps = ItemModalReviewProps;

export function ItemModal(props: ItemModalProps) {
  const { mode: _, ...reviewProps } = props;
  return <ItemModalReview {...reviewProps} />;
}
