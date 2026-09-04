import { NextResponse } from 'next/server';
import { isCurrentUserAdmin, supabaseAdmin } from '@/lib/supabase-server';
import { calcularMetricasVendas } from '@/lib/metrics';
import { hojeBrasil, primeiroDiaDoMesBrasil, diasAtrasBrasil, partesHojeBrasil } from '@/lib/datas';
import { diasDesde, passoDoFunil } from '@/lib/ativacao';

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
      { count: totalMetas },
      { count: totalClientes },
      { count: totalVendas },
      { count: totalAtendimentos },
    ] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, full_name, email, created_at')
        .eq('id', workspaceId)
        .single(),
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
        // Mesmo motivo da rota da aluna: venda cancelada não conta como
        // faturamento, e a mentora precisa ver o mesmo número que ela.
        .neq('status', 'cancelada')
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
      // Sinais de configuração: existe QUALQUER linha, em qualquer data. São
      // marcos de onboarding, não atividade recente — cadastrar o catálogo em
      // agosto continua valendo em setembro. head+count não traz linha nenhuma.
      supabaseAdmin
        .from('metas')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabaseAdmin
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabaseAdmin
        .from('vendas_diarias')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabaseAdmin
        .from('atendimentos_diarios')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
    ]);

    if (perfilError || !perfil) {
      return NextResponse.json({ error: 'Aluna não encontrada' }, { status: 404 });
    }

    // O último login vive em auth.users — é o que separa "nunca abriu o
    // sistema" de "abriu e travou". Num usuário só, getUserById basta (a
    // listagem paginada é coisa do painel geral). Nunca derruba a página: sem
    // ele a tela mostra "—" e o resto do detalhe continua servindo.
    let ultimoLogin: string | null = null;
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(workspaceId);
      ultimoLogin = authUser?.user?.last_sign_in_at ?? null;
    } catch (error) {
      console.error('Não foi possível ler o último login da aluna:', error);
    }

    const vendasHoje = (vendasDoMes || []).filter((v) => v.data === hoje);
    const atendimentosHoje = atendimentoHoje?.pessoas_atendidas ?? 0;
    const metricas = calcularMetricasVendas(vendasHoje, vendasDoMes || [], atendimentosHoje);

    return NextResponse.json({
      success: true,
      data: {
        perfil,
        // Situação da conta: sem isto a mentora vê que a aluna não vendeu, mas
        // não sabe se ela chegou a abrir o sistema — e as duas coisas pedem
        // conversas completamente diferentes.
        conta: {
          criada_em: perfil.created_at ?? null,
          ultimo_login: ultimoLogin,
          dias_sem_entrar: diasDesde(ultimoLogin),
          passo: passoDoFunil(ultimoLogin, {
            temProduto: (produtos || []).length > 0,
            temCliente: (totalClientes ?? 0) > 0,
            temMeta: (totalMetas ?? 0) > 0,
            temAtendimento: (totalAtendimentos ?? 0) > 0,
            temVenda: (totalVendas ?? 0) > 0,
          }),
          totais: {
            produtos: (produtos || []).length,
            clientes: totalClientes ?? 0,
            metas: totalMetas ?? 0,
            vendas: totalVendas ?? 0,
            atendimentos: totalAtendimentos ?? 0,
          },
        },
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
