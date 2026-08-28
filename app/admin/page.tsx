import { redirect } from 'next/navigation';
import { getCurrentUserWithWorkspace, isCurrentUserAdmin } from '@/lib/supabase-server';
import AppShell from '@/components/shared/AppShell';
import AdminResumo from './AdminResumo';

export default async function AdminPage() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const result = await getCurrentUserWithWorkspace();
  const nome = result?.userData?.full_name || result?.user?.email || 'Mentora';

  return (
    <AppShell
      nome={nome}
      email={result?.user?.email}
      avatarUrl={result?.userData?.avatar_url}
      isAdmin={isAdmin}
    >
      <AdminResumo />
    </AppShell>
  );
}
