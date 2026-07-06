'use client';

import { ItemModalDetail, type ItemModalDetailProps } from './ItemModalDetail';
import { ItemModalReview, type ItemModalReviewProps } from './ItemModalReview';

export type { BatchProgress } from './ItemModalShell';
export type { ItemModalDetailProps, ItemModalReviewProps };

export type ItemModalProps = ItemModalDetailProps | ItemModalReviewProps;

export function ItemModal(props: ItemModalProps) {
  if (props.mode === 'review') {
    const { mode: _, ...reviewProps } = props;
    return <ItemModalReview {...reviewProps} />;
  }
  const { mode: _, ...detailProps } = props;
  return <ItemModalDetail {...detailProps} />;
}
