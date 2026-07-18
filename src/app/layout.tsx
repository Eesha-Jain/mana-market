import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mana Market',
  description: 'Upload inventory, price from catalog data, and list across marketplaces.',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastProvider>
          <AuthProvider>
            <UserSettingsProvider>
              <InventoryProvider>{children}</InventoryProvider>
            </UserSettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
