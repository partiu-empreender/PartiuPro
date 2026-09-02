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

    // Clientes, etiquetas e lembretes faltavam aqui: a base de clientes é o
    // maior ativo da aluna e é justamente o que ela pediria numa portabilidade.
    // Os lembretes entram pelo mesmo motivo, com um agravante — o título deles
    // guarda o nome da cliente final ("Aniversário de Ana Paula"), então é
    // dado pessoal de terceiro sob a guarda dela.
    const [
      { data: perfil },
      { data: produtos },
      { data: vendas },
      { data: atendimentos },
      { data: metas },
      { data: termos },
      { data: consentimento },
      { data: clientes },
      { data: etiquetas },
      { data: lembretes },
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
      supabase
        .from('customers')
        .select('*, customer_tag_links ( customer_tags ( nome, cor ) )')
        .eq('workspace_id', user.id),
      supabase.from('customer_tags').select('*').eq('workspace_id', user.id),
      supabase.from('lembretes').select('*').eq('workspace_id', user.id),
    ]);

    const exportacao = {
      gerado_em: new Date().toISOString(),
      perfil,
      produtos: produtos ?? [],
      vendas: vendas ?? [],
      atendimentos: atendimentos ?? [],
      metas: metas ?? [],
      clientes: clientes ?? [],
      etiquetas: etiquetas ?? [],
      lembretes: lembretes ?? [],
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
