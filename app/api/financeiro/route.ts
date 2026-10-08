/**
 * Financeiro: as saídas do mês e o DRE calculado sobre elas.
 *
 * O DRE NÃO É GRAVADO, é derivado a cada consulta. Materializar criaria um
 * número que diverge da própria origem assim que uma venda for editada ou
 * cancelada — e vendas passaram a ser editáveis (etapa 1). Um DRE guardado
 * seria uma foto que ninguém sabe quando foi tirada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { calcularDRE, type SaidaParaDRE, type VendaParaDRE } from '@/lib/dre';
import { hojeBrasil, motivoDataDeVendaInvalida, partesHojeBrasil, recorteDoMes } from '@/lib/datas';
import { parsearMoeda } from '@/lib/moeda';
import {
  ancoraVigente,
  calcularSaldoDoMes,
  type Ancora,
  type EntradaDeCaixa,
  type SaldoDoMes,
} from '@/lib/saldo';
import type { SupabaseClient } from '@supabase/supabase-js';

const SELECT_SAIDA = 'id, data, descricao, valor, categoria, recorrente, observacao';

/**
 * Saldo em caixa do mês (ver lib/saldo.ts).
 *
 * Nunca derruba a tela: se a tabela ainda não existir (migration 022 não
 * aplicada) ou a consulta falhar, o DRE continua aparecendo e o cartão de
 * saldo some. O DRE é o que já existia; o saldo é o recurso novo, e não pode
 * levar o antigo junto quando falha.
 */
async function saldoDoMes(
  supabase: SupabaseClient,
  workspaceId: string,
  alvo: { ano: number; mes: number },
  fimDoMes: string,
): Promise<{ saldo: SaldoDoMes | null; disponivel: boolean }> {
  try {
    const { data: linhas, error } = await supabase
      .from('saldos_iniciais')
      .select('ano, mes, valor')
      .eq('workspace_id', workspaceId);
    if (error) throw error;

    const ancoras: Ancora[] = (linhas || []).map((l) => ({
      ano: Number(l.ano),
      mes: Number(l.mes),
      valor: Number(l.valor) || 0,
    }));
    const ancora = ancoraVigente(ancoras, alvo);
    if (!ancora) return { saldo: null, disponivel: true };

    const inicio = `${ancora.ano}-${String(ancora.mes).padStart(2, '0')}-01`;
    const [{ data: vendas, error: vendasError }, { data: saidas, error: saidasError }] =
      await Promise.all([
        supabase
          .from('vendas_diarias')
          .select('data, faturamento_total, shipping_cost, status')
          .eq('workspace_id', workspaceId)
          .neq('status', 'cancelada')
          .gte('data', inicio)
          .lte('data', fimDoMes),
        supabase
          .from('saidas_financeiras')
          .select('data, valor')
          .eq('workspace_id', workspaceId)
          .gte('data', inicio)
          .lte('data', fimDoMes),
      ]);
    if (vendasError || saidasError) throw vendasError ?? saidasError;

    // Entra só a venda PAGA: "a receber" ainda não está na conta. O frete sai
    // de toda venda que vale, paga ou não — quem entrega cobra do mesmo jeito.
    const entradas: EntradaDeCaixa[] = (vendas || [])
      .filter((v) => v.status === 'pago')
      .map((v) => ({ data: v.data, valor: Number(v.faturamento_total) || 0 }));
    const saidasDeCaixa: EntradaDeCaixa[] = [
      ...(saidas || []).map((s) => ({ data: s.data, valor: Number(s.valor) || 0 })),
      ...(vendas || [])
        .filter((v) => Number(v.shipping_cost) > 0)
        .map((v) => ({ data: v.data, valor: Number(v.shipping_cost) || 0 })),
    ];

    return {
      saldo: calcularSaldoDoMes(ancoras, entradas, saidasDeCaixa, alvo),
      disponivel: true,
    };
  } catch (error) {
    console.error('Não foi possível calcular o saldo do mês:', error);
    return { saldo: null, disponivel: false };
  }
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

    const hoje = partesHojeBrasil();
    const ano = Number(request.nextUrl.searchParams.get('ano')) || hoje.ano;
    const mes = Number(request.nextUrl.searchParams.get('mes')) || hoje.mes;

    const recorte = recorteDoMes(ano, mes);
    if (!recorte) {
      return NextResponse.json({ error: 'Mês inválido.' }, { status: 400 });
    }

    const [
      { data: saidas, error: saidasError },
      { data: vendas, error: vendasError },
      saldo,
    ] = await Promise.all([
      supabase
        .from('saidas_financeiras')
        .select(SELECT_SAIDA)
        .eq('workspace_id', user.id)
        .gte('data', recorte.inicio)
        .lte('data', recorte.fim)
        .order('data', { ascending: false }),
      supabase
        .from('vendas_diarias')
        .select(
          `faturamento_total, shipping_cost,
           venda_itens ( quantidade, produto_id, products ( cost ) )`,
        )
        .eq('workspace_id', user.id)
        // Venda cancelada não entra no DRE pelo mesmo motivo de não entrar no
        // Raio-X: ela não aconteceu. Filtrado na origem para que nenhuma
        // consulta nova esqueça.
        .neq('status', 'cancelada')
        .gte('data', recorte.inicio)
        .lte('data', recorte.fim),
      saldoDoMes(supabase, user.id, { ano, mes }, recorte.fim),
    ]);

    if (saidasError || vendasError) {
      return NextResponse.json(
        {
          error: 'Erro ao carregar o financeiro',
          details: saidasError?.message ?? vendasError?.message,
        },
        { status: 500 },
      );
    }

    // O custo vem do CATÁLOGO, via join: gravar o custo na venda seria melhor
    // (o custo de hoje não é o de março), mas `venda_itens` não tem essa
    // coluna e criá-la não corrigiria o passado. A tela diz que o custo é o
    // atual, em vez de fingir precisão histórica.
    type ItemBruto = {
      quantidade: number;
      products?: { cost?: number | null } | { cost?: number | null }[] | null;
    };

    const vendasParaDRE: VendaParaDRE[] = (vendas || []).map((venda) => ({
      faturamento_total: Number(venda.faturamento_total) || 0,
      shipping_cost: Number(venda.shipping_cost) || 0,
      venda_itens: ((venda.venda_itens || []) as ItemBruto[]).map((item) => {
        // O join volta objeto ou array dependendo da cardinalidade inferida.
        const produto = Array.isArray(item.products) ? item.products[0] : item.products;
        return {
          quantidade: Number(item.quantidade) || 0,
          custo_unitario: Number(produto?.cost) || 0,
        };
      }),
    }));

    const saidasParaDRE: SaidaParaDRE[] = (saidas || []).map((s) => ({
      valor: Number(s.valor) || 0,
      categoria: s.categoria || 'Outros',
    }));

    return NextResponse.json({
      saidas: saidas || [],
      dre: calcularDRE(vendasParaDRE, saidasParaDRE),
      saldo: saldo.saldo,
      saldo_disponivel: saldo.disponivel,
      periodo: { ano, mes },
    });
  } catch (error) {
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

    const body: {
      data?: string;
      descricao?: string;
      valor?: unknown;
      categoria?: string;
      recorrente?: boolean;
      observacao?: string;
    } = await request.json();

    if (!body.descricao?.trim()) {
      return NextResponse.json({ error: 'Descreva a saída.' }, { status: 400 });
    }

    // `parsearMoeda` quando vem string: Number('1.200') devolve 1.2, e a
    // despesa de mil e duzentos reais viraria um real e vinte.
    const valor =
      typeof body.valor === 'string' ? (parsearMoeda(body.valor) ?? NaN) : Number(body.valor);

    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: 'O valor precisa ser maior que zero.' }, { status: 400 });
    }

    const data = body.data?.trim() || hojeBrasil();
    const motivo = motivoDataDeVendaInvalida(data);
    if (motivo) {
      return NextResponse.json({ error: motivo }, { status: 400 });
    }

    const { data: criada, error } = await supabase
      .from('saidas_financeiras')
      .insert({
        workspace_id: user.id,
        data,
        descricao: body.descricao.trim(),
        valor,
        categoria: body.categoria?.trim() || 'Outros',
        recorrente: Boolean(body.recorrente),
        observacao: body.observacao?.trim() || null,
      })
      .select(SELECT_SAIDA)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao registrar a saída', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: criada }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}

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

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Informe qual saída remover.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('saidas_financeiras')
      .delete()
      .eq('id', id)
      .eq('workspace_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover a saída', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}
