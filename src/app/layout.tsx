import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { ItemsProvider } from '@/contexts/ItemsContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mana Market',
  description:
    'Mana Market — list Magic The Gathering sealed products on eBay with UPC lookup, OCR photo scan, and pricing tools.',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AuthProvider>
            <UserSettingsProvider>
              <ItemsProvider>{children}</ItemsProvider>
            </UserSettingsProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
