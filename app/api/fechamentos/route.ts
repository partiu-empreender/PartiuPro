// app/api/fechamentos/route.ts
// ============================================
// FECHAMENTO MENSAL — o histórico preenchido à mão
// ============================================
// GET  /api/fechamentos?ano=2026  -> os 12 meses do ano, já resolvidos:
//      cada um diz se o número veio das vendas ou do que ela digitou.
// POST /api/fechamentos           -> grava (upsert) o fechamento de um mês.
// DELETE /api/fechamentos?mes=&ano= -> descarta o fechamento e volta a usar
//      as vendas daquele mês.
//
// A rota devolve o ano INTEIRO resolvido, e não a lista crua da tabela, de
// propósito: quem decide a fonte de cada mês é lib/fechamento.ts, e é ele que
// tem que responder tanto aqui quanto na tela. Mandar a tabela crua faria a
// tela reimplementar a regra.

import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { partesHojeBrasil } from '@/lib/datas';
import { parsearMoeda } from '@/lib/moeda';
import {
  motivoFechamentoInvalido,
  resolverNumerosDoMes,
  type ApuradoDasVendas,
  type FechamentoManual,
} from '@/lib/fechamento';

/**
 * Os campos numéricos que a aluna digita. Todos opcionais — quem só sabe o
 * faturamento manda o faturamento.
 */
interface SalvarFechamentoRequest {
  mes: number;
  ano: number;
  faturamento?: number | string | null;
  vendas?: number | string | null;
  produtos_vendidos?: number | string | null;
  atendimentos?: number | string | null;
  ticket_medio?: number | string | null;
  conversao?: number | string | null;
  observacao?: string | null;
}

/**
 * Lê um campo de dinheiro que pode vir vazio.
 *
 * Devolve `undefined` quando não dá pra interpretar e `null` quando ela
 * apagou o campo — a diferença importa: `null` grava "não sei" no banco,
 * enquanto `undefined` vira erro de validação. Number() não serve aqui pelo
 * motivo de sempre: Number('38.400') é 38, não trinta e oito mil.
 */
function lerDinheiro(bruto: unknown): number | null | undefined {
  if (bruto === null || bruto === undefined || bruto === '') return null;
  const n = parsearMoeda(bruto as string | number);
  return n === null ? undefined : n;
}

/** Mesma ideia, pros campos que são contagem (vendas, atendimentos). */
function lerInteiro(bruto: unknown): number | null | undefined {
  if (bruto === null || bruto === undefined || bruto === '') return null;
  const n = parsearMoeda(bruto as string | number);
  if (n === null) return undefined;
  return Math.round(n);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const hoje = partesHojeBrasil();
    const ano = parseInt(searchParams.get('ano') || '', 10) || hoje.ano;

    // Tudo do ano de uma vez. São 12 meses no máximo — o custo de montar o
    // ano inteiro é menor que o de 12 requisições, e é o que a tela mostra.
    const [
      { data: fechamentos, error: fechamentosError },
      { data: vendas, error: vendasError },
      { data: atendimentos, error: atendimentosError },
      { data: metas, error: metasError },
    ] = await Promise.all([
      supabase
        .from('fechamentos_mensais')
        .select(
          'mes, ano, faturamento, vendas, produtos_vendidos, atendimentos, ticket_medio, conversao, observacao, updated_at',
        )
        .eq('workspace_id', user.id)
        .eq('ano', ano),
      supabase
        .from('vendas_diarias')
        .select('data, faturamento_total, venda_itens (quantidade)')
        .eq('workspace_id', user.id)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`),
      supabase
        .from('atendimentos_diarios')
        .select('data, pessoas_atendidas')
        .eq('workspace_id', user.id)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`),
      supabase
        .from('metas')
        .select('mes, meta_mensal')
        .eq('workspace_id', user.id)
        .eq('ano', ano),
    ]);

    if (fechamentosError || vendasError || atendimentosError || metasError) {
      return NextResponse.json(
        {
          error: 'Erro ao buscar o histórico',
          details:
            fechamentosError?.message ??
            vendasError?.message ??
            atendimentosError?.message ??
            metasError?.message,
        },
        { status: 500 },
      );
    }

    // ---- Apuração das vendas reais, mês a mês ----
    const apuradoPorMes = new Map<number, ApuradoDasVendas>();
    const vazio = (): ApuradoDasVendas => ({
      faturamento: 0,
      vendas: 0,
      produtos_vendidos: 0,
      atendimentos: 0,
    });

    for (const venda of vendas || []) {
      const mes = parseInt(venda.data.slice(5, 7), 10);
      const atual = apuradoPorMes.get(mes) ?? vazio();
      atual.faturamento += Number(venda.faturamento_total) || 0;
      atual.vendas += 1;
      // Soma as QUANTIDADES: duas cestas numa venda contam 2, igual ao que
      // lib/metrics.ts chama de produtos_vendidos.
      atual.produtos_vendidos += (
        (venda.venda_itens as { quantidade: number }[] | null) || []
      ).reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
      apuradoPorMes.set(mes, atual);
    }

    for (const atendimento of atendimentos || []) {
      const mes = parseInt(atendimento.data.slice(5, 7), 10);
      const atual = apuradoPorMes.get(mes) ?? vazio();
      atual.atendimentos += Number(atendimento.pessoas_atendidas) || 0;
      apuradoPorMes.set(mes, atual);
    }

    // Number() em tudo que vem de coluna NUMERIC: chega como string, e aí as
    // comparações e somas daqui pra frente virariam de texto. É o mesmo
    // cuidado que a tela de Metas já toma com meta_mensal.
    const manualPorMes = new Map<number, FechamentoManual>();
    for (const f of fechamentos || []) {
      const numeroOuNulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      manualPorMes.set(f.mes, {
        mes: f.mes,
        ano: f.ano,
        faturamento: numeroOuNulo(f.faturamento),
        vendas: numeroOuNulo(f.vendas),
        produtos_vendidos: numeroOuNulo(f.produtos_vendidos),
        atendimentos: numeroOuNulo(f.atendimentos),
        ticket_medio: numeroOuNulo(f.ticket_medio),
        conversao: numeroOuNulo(f.conversao),
        observacao: f.observacao ?? null,
        updated_at: f.updated_at ?? null,
      });
    }

    const metaPorMes = new Map<number, number>();
    for (const m of metas || []) metaPorMes.set(m.mes, Number(m.meta_mensal) || 0);

    const meses = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const numeros = resolverNumerosDoMes(
        mes,
        ano,
        apuradoPorMes.get(mes) ?? vazio(),
        manualPorMes.get(mes) ?? null,
        hoje,
      );
      return {
        ...numeros,
        meta: metaPorMes.get(mes) ?? 0,
        /** O que está gravado no formulário, pra tela abrir já preenchida. */
        manual: manualPorMes.get(mes) ?? null,
      };
    });

    return NextResponse.json({ success: true, ano, meses });
  } catch (error) {
    console.error('Erro na API de fechamentos:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body: SalvarFechamentoRequest = await request.json();

    // A MESMA função que a tela usa. O navegador é o único lugar onde a regra
    // do "só mês encerrado" pode ser burlada, então ela é reaplicada aqui.
    const motivo = motivoFechamentoInvalido(body.mes, body.ano);
    if (motivo) {
      return NextResponse.json({ error: motivo }, { status: 400 });
    }

    const faturamento = lerDinheiro(body.faturamento);
    const ticket_medio = lerDinheiro(body.ticket_medio);
    const conversao = lerDinheiro(body.conversao);
    const vendas = lerInteiro(body.vendas);
    const produtos_vendidos = lerInteiro(body.produtos_vendidos);
    const atendimentos = lerInteiro(body.atendimentos);

    const invalido = [
      ['faturamento', faturamento],
      ['ticket médio', ticket_medio],
      ['taxa de conversão', conversao],
      ['nº de vendas', vendas],
      ['produtos vendidos', produtos_vendidos],
      ['atendimentos', atendimentos],
    ].find(([, v]) => v === undefined);

    if (invalido) {
      return NextResponse.json(
        { error: `Não consegui ler o valor de ${invalido[0]}. Confira o que foi digitado.` },
        { status: 400 },
      );
    }

    if (conversao !== null && conversao !== undefined && conversao > 100) {
      return NextResponse.json(
        { error: 'A taxa de conversão não pode passar de 100%.' },
        { status: 400 },
      );
    }

    const { data: fechamento, error } = await supabase
      .from('fechamentos_mensais')
      .upsert(
        {
          workspace_id: user.id,
          mes: body.mes,
          ano: body.ano,
          faturamento: faturamento ?? null,
          vendas: vendas ?? null,
          produtos_vendidos: produtos_vendidos ?? null,
          atendimentos: atendimentos ?? null,
          ticket_medio: ticket_medio ?? null,
          conversao: conversao ?? null,
          observacao: body.observacao?.trim() || null,
        },
        { onConflict: 'workspace_id,mes,ano' },
      )
      .select()
      .single();

    if (error || !fechamento) {
      return NextResponse.json(
        { error: 'Erro ao salvar o fechamento', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: fechamento, message: 'Fechamento do mês salvo.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Erro na API de fechamentos:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}

/**
 * Descarta o fechamento manual de um mês.
 *
 * É a saída do aviso de divergência: "há 3 vendas lançadas somando R$ 2.100
 * que não estão sendo contadas — [usar as vendas]". Sem isto, o número
 * digitado seria permanente e ela teria que zerar campo por campo.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || '', 10);
    const ano = parseInt(searchParams.get('ano') || '', 10);

    if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(ano)) {
      return NextResponse.json({ error: 'Mês ou ano inválido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('fechamentos_mensais')
      .delete()
      .eq('workspace_id', user.id)
      .eq('mes', mes)
      .eq('ano', ano);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao descartar o fechamento', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Fechamento descartado. O mês volta a usar as vendas registradas.',
    });
  } catch (error) {
    console.error('Erro na API de fechamentos:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}
