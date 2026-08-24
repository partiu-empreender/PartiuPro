import { getCurrentUserWithWorkspace } from '@/lib/supabase-server';
import Navbar from '@/components/shared/Navbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUserWithWorkspace();
  const nome = result?.userData?.full_name || result?.user?.email || 'Empreendedora';
  const isAdmin = Boolean(result?.userData?.is_admin);

  return (
    <div className="min-h-screen bg-background">
      <Navbar nome={nome} isAdmin={isAdmin} />
      {children}
    </div>
  );
}
