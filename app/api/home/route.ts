import { NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil, montarData, partesDaData, somarDias } from '@/lib/datas';
import { resumoDoMes } from '@/lib/home';
import {
  formasDePagamento,
  maisVendidos,
  recebimentoDoMes,
  recorteDoMesAteHoje,
  semanaDe,
  ultimosMeses,
  type PainelDaHome,
  type VendaDoMes,
} from '@/lib/painel';

/** Até quantos dias pra trás uma entrega esquecida ainda aparece nas tarefas. */
const DIAS_DE_ENTREGA_ATRASADA = 30;

// Depende da sessão (cookies): nunca pode ser gerada uma vez no build.
export const dynamic = 'force-dynamic';

/**
 * Tudo o que o topo do Dashboard mostra, num pedido só.
 *
 * Um pedido por cartão seriam oito idas ao servidor a cada vez que a aluna
 * abre o sistema, e a home ficaria se montando aos pedaços na frente dela.
 *
 * Os meses do gráfico são buscados um a um, só com o valor: cada consulta do
 * Supabase devolve no máximo mil linhas, e seis meses juntos de quem vende
 * muito passariam disso — o gráfico mostraria um mês cortado sem avisar.
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
    const { ano, mes } = partesDaData(hoje);
    const inicioDoMes = montarData(ano, mes, 1);
    const meses = ultimosMeses(hoje, 6);
    const semana = semanaDe(hoje);
    const fimDaSemana = semana[semana.length - 1]?.data ?? hoje;

    const totaisDosMeses = Promise.all(
      meses.map((m) => {
        const { inicio, fim } = recorteDoMesAteHoje(m, hoje);
        return supabase
          .from('vendas_diarias')
          .select('data, faturamento_total')
          .eq('workspace_id', user.id)
          .neq('status', 'cancelada')
          .gte('data', inicio)
          .lte('data', fim);
      }),
    );

    const [
      resultadosDosMeses,
      { data: doMes, error: erroDoMes },
      { data: metas },
      { data: atendimentos },
      { count: totalClientes },
      { count: novosNoMes },
      { data: aReceber },
      { data: entregas },
      { data: encontros },
    ] = await Promise.all([
      totaisDosMeses,
      supabase
        .from('vendas_diarias')
        .select(
          'id, data, created_at, cliente_nome, faturamento_total, status, forma_pagamento, venda_itens (produto_nome, quantidade, subtotal, tipo)',
        )
        .eq('workspace_id', user.id)
        .neq('status', 'cancelada')
        .gte('data', inicioDoMes)
        .lte('data', hoje)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('metas')
        .select('meta_mensal')
        .eq('workspace_id', user.id)
        .eq('ano', ano)
        .eq('mes', mes)
        // limit e não maybeSingle: se um dia houver duas linhas do mesmo mês,
        // maybeSingle daria erro e a meta sumiria da home.
        .limit(1),
      supabase
        .from('atendimentos_diarios')
        .select('pessoas_atendidas')
        .eq('workspace_id', user.id)
        .gte('data', inicioDoMes)
        .lte('data', hoje),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', user.id),
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', user.id)
        .gte('created_at', `${inicioDoMes}T03:00:00Z`),
      supabase
        .from('vendas_diarias')
        .select('faturamento_total')
        .eq('workspace_id', user.id)
        .eq('status', 'pendente'),
      supabase
        .from('vendas_diarias')
        .select('id, cliente_nome, delivery_date, delivery_period, entrega')
        .eq('workspace_id', user.id)
        .neq('status', 'cancelada')
        .neq('entrega', 'nao_aplica')
        .gte('delivery_date', somarDias(hoje, -DIAS_DE_ENTREGA_ATRASADA))
        .lte('delivery_date', fimDaSemana)
        .order('delivery_date', { ascending: true }),
      // Da semana em diante: a agenda da semana mostra os dela, e o
      // "próximo encontro" pode estar mais pra frente.
      supabase
        .from('encontros')
        .select('id, titulo, descricao, inicio, duracao_minutos, link')
        .gte('inicio', `${semana[0]?.data ?? hoje}T00:00:00-03:00`)
        .order('inicio', { ascending: true })
        .limit(10),
    ]);

    if (erroDoMes) {
      return NextResponse.json(
        { error: 'Erro ao montar a home', details: erroDoMes.message },
        { status: 500 },
      );
    }

    const vendasDoMes = (doMes || []) as unknown as VendaDoMes[];
    const totais = resultadosDosMeses.map(({ data }) =>
      (data || []).reduce((soma, v) => soma + (Number(v.faturamento_total) || 0), 0),
    );
    // O mês passado entra inteiro no resumo, que corta sozinho no mesmo dia.
    const doMesPassado = resultadosDosMeses[resultadosDosMeses.length - 2]?.data || [];

    const painel: PainelDaHome = {
      hoje,
      resumo: resumoDoMes([...vendasDoMes, ...doMesPassado], hoje),
      meses: meses.map((m, i) => ({
        rotulo: m.rotulo,
        total: totais[i] ?? 0,
        atual: i === meses.length - 1,
      })),
      meta: Number(metas?.[0]?.meta_mensal) || 0,
      atendimentos: (atendimentos || []).reduce((s, a) => s + (a.pessoas_atendidas || 0), 0),
      recebimento: recebimentoDoMes(vendasDoMes),
      formas: formasDePagamento(vendasDoMes),
      maisVendidos: maisVendidos(vendasDoMes),
      ultimasVendas: vendasDoMes.slice(0, 5).map((v) => ({
        id: v.id,
        cliente_nome: v.cliente_nome,
        data: v.data,
        valor: Number(v.faturamento_total) || 0,
        status: v.status,
      })),
      clientes: { total: totalClientes ?? 0, novosNoMes: novosNoMes ?? 0 },
      aReceber: {
        quantidade: (aReceber || []).length,
        valor: (aReceber || []).reduce((s, v) => s + (Number(v.faturamento_total) || 0), 0),
      },
      // Atrasada só interessa enquanto não foi entregue; a da semana aparece
      // de qualquer jeito, pra agenda mostrar o que já saiu.
      encontros: encontros || [],
      entregas: (entregas || [])
        .filter((e) => e.entrega === 'pendente' || e.delivery_date >= (semana[0]?.data ?? hoje))
        .map((e) => ({
          id: e.id,
          cliente_nome: e.cliente_nome,
          delivery_date: e.delivery_date,
          delivery_period: e.delivery_period,
          entregue: e.entrega === 'entregue',
        })),
    };

    return NextResponse.json({ success: true, data: painel });
  } catch (error) {
    console.error('Erro ao montar a home:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
