import { PublicShell } from './public-shell';
import './public.css';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
