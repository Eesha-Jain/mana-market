import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UploadPage } from '@/views/UploadPage';

export default function Page() {
  return (
    <ProtectedRoute>
      <UploadPage />
    </ProtectedRoute>
  );
}
