import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ReviewPage } from '@/views/ReviewPage';

export default function Page() {
  return (
    <ProtectedRoute>
      <ReviewPage />
    </ProtectedRoute>
  );
}
