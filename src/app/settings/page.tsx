import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SettingsPage } from '@/views/SettingsPage';

export default function Page() {
  return (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  );
}
