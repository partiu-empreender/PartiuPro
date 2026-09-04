import { NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server';

export async function DELETE() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Deleta o usuário do Auth; o restante (perfil, produtos, vendas,
    // atendimentos, metas, consentimentos) cascateia via as FKs
    // ON DELETE CASCADE de 004_lgpd_consent.sql.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao encerrar conta', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Conta encerrada' });
  } catch (error) {
    console.error('Erro ao encerrar conta:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
