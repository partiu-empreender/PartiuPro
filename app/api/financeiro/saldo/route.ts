/**
 * Saldo inicial do mês: informar (ou corrigir) e apagar.
 *
 * O cálculo do saldo não mora aqui — ele vem no GET de /api/financeiro, junto
 * do DRE, porque a tela mostra os dois lado a lado. Esta rota só grava o
 * ponto de partida. Ver lib/saldo.ts e a migration 022.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { partesHojeBrasil, recorteDoMes } from '@/lib/datas';
import { parsearMoeda } from '@/lib/moeda';
import { chaveDoMes } from '@/lib/saldo';

async function autenticar() {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

/** Mês válido e que não está no futuro. Devolve o motivo da recusa, ou null. */
function motivoMesInvalido(ano: number, mes: number): string | null {
  if (!recorteDoMes(ano, mes)) return 'Mês inválido.';
  const hoje = partesHojeBrasil();
  if (chaveDoMes({ ano, mes }) > chaveDoMes(hoje)) {
    return 'Não dá pra informar saldo de um mês que ainda não começou.';
  }
  return null;
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user } = await autenticar();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body: { ano?: unknown; mes?: unknown; valor?: unknown } = await request.json();
    const ano = Number(body.ano);
    const mes = Number(body.mes);

    const motivo = motivoMesInvalido(ano, mes);
    if (motivo) return NextResponse.json({ error: motivo }, { status: 400 });

    // String passa por `parsearMoeda`: Number('1.200') devolve 1.2. Aceita
    // sinal de menos na frente, porque conta no vermelho é saldo real.
    let valor: number;
    if (typeof body.valor === 'string') {
      const texto = body.valor.trim();
      // `includes` e não `startsWith`: "R$ -150,00" tem o sinal no meio.
      const negativo = texto.includes('-');
      const absoluto = parsearMoeda(texto.replace(/-/g, ''));
      valor = absoluto === null ? NaN : negativo ? -absoluto : absoluto;
    } else {
      valor = Number(body.valor);
    }
    if (!Number.isFinite(valor) || Math.abs(valor) >= 1e10) {
      return NextResponse.json({ error: 'Informe um valor válido.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('saldos_iniciais')
      .upsert(
        {
          workspace_id: user.id,
          ano,
          mes,
          valor: Math.round(valor * 100) / 100,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,ano,mes' },
      )
      .select('ano, mes, valor')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao salvar o saldo inicial', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
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
    const { supabase, user } = await autenticar();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const ano = Number(request.nextUrl.searchParams.get('ano'));
    const mes = Number(request.nextUrl.searchParams.get('mes'));
    if (!recorteDoMes(ano, mes)) {
      return NextResponse.json({ error: 'Mês inválido.' }, { status: 400 });
    }

    // `.select()` para conferir que apagou: sem política de DELETE o Postgres
    // responde sucesso sem apagar nada (o bug da migration 021).
    const { data, error } = await supabase
      .from('saldos_iniciais')
      .delete()
      .eq('workspace_id', user.id)
      .eq('ano', ano)
      .eq('mes', mes)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover o saldo inicial', details: error.message },
        { status: 500 },
      );
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Nenhum saldo informado nesse mês.' }, { status: 404 });
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
