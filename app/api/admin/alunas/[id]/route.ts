import { NextResponse } from 'next/server';
import { isCurrentUserAdmin, supabaseAdmin } from '@/lib/supabase-server';
import { calcularMetricasVendas } from '@/lib/metrics';
import { hojeBrasil, primeiroDiaDoMesBrasil, diasAtrasBrasil, partesHojeBrasil } from '@/lib/datas';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  try {
    const workspaceId = params.id;

    const hoje = hojeBrasil();
    const primeiroDiaDoMes = primeiroDiaDoMesBrasil();
    const trintaDiasAtras = diasAtrasBrasil(30);
    const { ano: anoAtual, mes: mesAtual } = partesHojeBrasil();

    const [
      { data: perfil, error: perfilError },
      { data: produtos },
      { data: vendasDoMes },
      { data: atendimentos },
      { data: atendimentoHoje },
      { data: metaAtual },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('id, full_name, email').eq('id', workspaceId).single(),
      supabaseAdmin
        .from('products')
        .select('id, name, price, cost, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('vendas_diarias')
        .select(
          `id, data, cliente_nome, faturamento_total, status,
          venda_itens ( id, produto_nome, quantidade, preco_unitario, subtotal )`,
        )
        .eq('workspace_id', workspaceId)
        .gte('data', primeiroDiaDoMes)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('atendimentos_diarios')
        .select('id, data, pessoas_atendidas')
        .eq('workspace_id', workspaceId)
        .gte('data', trintaDiasAtras)
        .order('data', { ascending: false }),
      supabaseAdmin
        .from('atendimentos_diarios')
        .select('pessoas_atendidas')
        .eq('workspace_id', workspaceId)
        .eq('data', hoje)
        .maybeSingle(),
      supabaseAdmin
        .from('metas')
        .select('meta_mensal')
        .eq('workspace_id', workspaceId)
        .eq('mes', mesAtual)
        .eq('ano', anoAtual)
        .maybeSingle(),
    ]);

    if (perfilError || !perfil) {
      return NextResponse.json({ error: 'Aluna não encontrada' }, { status: 404 });
    }

    const vendasHoje = (vendasDoMes || []).filter((v) => v.data === hoje);
    const atendimentosHoje = atendimentoHoje?.pessoas_atendidas ?? 0;
    const metricas = calcularMetricasVendas(vendasHoje, vendasDoMes || [], atendimentosHoje);

    return NextResponse.json({
      success: true,
      data: {
        perfil,
        metricas,
        meta_mensal: metaAtual?.meta_mensal ?? 0,
        produtos: produtos || [],
        vendas_recentes: (vendasDoMes || []).slice(0, 30),
        atendimentos_recentes: atendimentos || [],
      },
    });
  } catch (error) {
    console.error('Erro na API de detalhe de aluna:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
