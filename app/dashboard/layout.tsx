import { getCurrentUserWithWorkspace } from '@/lib/supabase-server';
import AppShell from '@/components/shared/AppShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const result = await getCurrentUserWithWorkspace();
  const nome = result?.userData?.full_name || result?.user?.email || 'Empreendedora';
  const isAdmin = Boolean(result?.userData?.is_admin);

  return (
    <AppShell
      nome={nome}
      email={result?.user?.email}
      avatarUrl={result?.userData?.avatar_url}
      isAdmin={isAdmin}
    >
      {children}
    </AppShell>
  );
}
