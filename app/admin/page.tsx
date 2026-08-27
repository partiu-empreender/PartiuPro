import { redirect } from 'next/navigation';
import { getCurrentUserWithWorkspace, isCurrentUserAdmin } from '@/lib/supabase-server';
import Navbar from '@/components/shared/Navbar';
import AdminResumo from './AdminResumo';

export default async function AdminPage() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const result = await getCurrentUserWithWorkspace();
  const nome = result?.userData?.full_name || result?.user?.email || 'Mentora';

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        nome={nome}
        email={result?.user?.email}
        avatarUrl={result?.userData?.avatar_url}
        isAdmin={isAdmin}
      />
      <AdminResumo />
    </div>
  );
}
