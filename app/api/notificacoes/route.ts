import { NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil, somarDias } from '@/lib/datas';
import { ehDesafioNovo, progressoDoDesafio } from '@/lib/desafios';
import { situacaoDasVendas } from '@/lib/notificacoes';

// Depende da sessão (cookies): nunca pode ser gerada uma vez no build.
export const dynamic = 'force-dynamic';

/**
 * O que vira aviso no sininho do topo: as contas das vendas que pedem ação,
 * os encontros de hoje e os desafios novos que ela ainda não concluiu.
 *
 * Das vendas, devolve só as contas, não a lista: o sininho roda em toda tela,
 * e mandar as vendas inteiras a cada página aberta seria pagar banda pra
 * mostrar um número. A lista de verdade continua nas pendências do Dashboard.
 */
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

    const hoje = hojeBrasil();

    // Só o que pode virar aviso: a receber, ou entrega com data até hoje.
    // Venda antiga sem data de entrega fica de fora já na consulta.
    const [{ data, error }, { data: encontros }, { data: desafios }, { data: feitas }] = await Promise.all([
      supabase
        .from('vendas_diarias')
        .select('status, entrega, delivery_date, faturamento_total')
        .eq('workspace_id', user.id)
        .neq('status', 'cancelada')
        .or(`status.eq.pendente,and(entrega.eq.pendente,delivery_date.lte.${hoje})`)
        .limit(1000),
      // Hoje, no relógio de Brasília.
      supabase
        .from('encontros')
        .select('id, titulo, inicio, duracao_minutos')
        .gte('inicio', `${hoje}T00:00:00-03:00`)
        .lt('inicio', `${somarDias(hoje, 1)}T00:00:00-03:00`)
        .order('inicio'),
      supabase
        .from('desafios')
        .select('id, titulo, inicio, fim, tarefas:desafio_tarefas (id)')
        .lte('inicio', hoje)
        .gte('inicio', somarDias(hoje, -7)),
      supabase.from('desafio_progresso').select('tarefa_id').eq('workspace_id', user.id),
    ]);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar avisos', details: error.message },
        { status: 500 },
      );
    }

    // Encontros e desafios são extras: se falharem, o sininho segue com as vendas.
    const marcadas = new Set((feitas || []).map((f) => f.tarefa_id));
    const desafiosNovos = (desafios || [])
      .filter((d) => ehDesafioNovo(d, hoje))
      .filter((d) => !progressoDoDesafio({ tarefas: d.tarefas || [] }, marcadas).concluido)
      .map((d) => ({ id: d.id, titulo: d.titulo }));

    return NextResponse.json({
      success: true,
      hoje,
      vendas: situacaoDasVendas(data || [], hoje),
      encontrosHoje: encontros || [],
      desafiosNovos,
    });
  } catch (error) {
    console.error('Erro ao buscar avisos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
