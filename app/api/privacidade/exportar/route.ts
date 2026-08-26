import { NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const [
      { data: perfil },
      { data: produtos },
      { data: vendas },
      { data: atendimentos },
      { data: metas },
      { data: termos },
      { data: consentimento },
    ] = await Promise.all([
      supabase.from('users').select('id, email, full_name, created_at').eq('id', user.id).single(),
      supabase.from('products').select('*').eq('workspace_id', user.id),
      supabase
        .from('vendas_diarias')
        .select('*, venda_itens(*)')
        .eq('workspace_id', user.id),
      supabase.from('atendimentos_diarios').select('*').eq('workspace_id', user.id),
      supabase.from('metas').select('*').eq('workspace_id', user.id),
      supabase.from('terms_acceptances').select('terms_version, accepted_at').eq('user_id', user.id),
      supabase.from('marketing_consents').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const exportacao = {
      gerado_em: new Date().toISOString(),
      perfil,
      produtos: produtos ?? [],
      vendas: vendas ?? [],
      atendimentos: atendimentos ?? [],
      metas: metas ?? [],
      termos_aceitos: termos ?? [],
      consentimento_divulgacao: consentimento ?? null,
    };

    return new NextResponse(JSON.stringify(exportacao, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="meus-dados-partiu-pro.json"',
      },
    });
  } catch (error) {
    console.error('Erro ao exportar dados:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
