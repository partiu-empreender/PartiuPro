import { redirect } from 'next/navigation';
import { getCurrentUserWithWorkspace, isCurrentUserAdmin } from '@/lib/supabase-server';
import Navbar from '@/components/shared/Navbar';
import AlunaDetalhe from './AlunaDetalhe';

export default async function AlunaDetalhePage({ params }: { params: { id: string } }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const result = await getCurrentUserWithWorkspace();
  const nome = result?.userData?.full_name || result?.user?.email || 'Mentora';

  return (
    <div className="min-h-screen bg-background">
      <Navbar nome={nome} isAdmin={isAdmin} />
      <AlunaDetalhe workspaceId={params.id} />
    </div>
  );
}
