import { redirect } from 'next/navigation';
import { getCurrentUserWithWorkspace, isCurrentUserAdmin } from '@/lib/supabase-server';
import AppShell from '@/components/shared/AppShell';
import AlunaDetalhe from './AlunaDetalhe';

export default async function AlunaDetalhePage({ params }: { params: { id: string } }) {
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
      <AlunaDetalhe workspaceId={params.id} />
    </AppShell>
  );
}
