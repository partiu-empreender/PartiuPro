/**
 * Baixa de entregas antigas: marca como entregues, de uma vez, as vendas
 * antigas que ficaram "a entregar" só porque esse era o default (migration
 * 013). A regra de quais entram está em `entraNaBaixaDeEntregas`
 * (lib/situacao-venda.ts), e a consulta abaixo é a mesma regra em SQL.
 *
 * Três pedidos na mesma rota, sempre por POST:
 *   { ate, simular: true }  → só conta, não muda nada (a tela mostra antes)
 *   { ate }                 → aplica e devolve os ids alterados
 *   { desfazer: [ids] }     → volta essas vendas para "a entregar"
 *
 * O "desfazer" existe porque a ação é em lote: errar a data e marcar uma
 * entrega real como feita precisa ter volta imediata, não uma caça venda a
 * venda.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil, motivoDataDeVendaInvalida } from '@/lib/datas';

/** Teto do desfazer: bem acima do que uma aluna tem, e barra pedido absurdo. */
const MAXIMO_PARA_DESFAZER = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const body: { ate?: unknown; simular?: unknown; desfazer?: unknown } = await request.json();

    // ============================================
    // Desfazer
    // ============================================
    if (body.desfazer !== undefined) {
      const ids = body.desfazer;
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > MAXIMO_PARA_DESFAZER ||
        !ids.every((id) => typeof id === 'string' && UUID.test(id))
      ) {
        return NextResponse.json({ error: 'Nada para desfazer.' }, { status: 400 });
      }

      // Só volta o que ainda está 'entregue': se ela mexeu numa venda depois
      // da baixa (marcou "levou na hora", por exemplo), essa escolha vale mais.
      const { data, error } = await supabase
        .from('vendas_diarias')
        .update({ entrega: 'pendente' })
        .eq('workspace_id', user.id)
        .eq('entrega', 'entregue')
        .in('id', ids as string[])
        .select('id');

      if (error) {
        return NextResponse.json(
          { error: 'Não foi possível desfazer.', details: error.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ quantidade: data?.length ?? 0 });
    }

    // ============================================
    // Simular ou aplicar
    // ============================================
    const ate = typeof body.ate === 'string' ? body.ate.trim() : '';
    const motivo = motivoDataDeVendaInvalida(ate);
    if (motivo) {
      return NextResponse.json({ error: motivo }, { status: 400 });
    }

    // `hoje` vem do servidor, nunca do corpo: é ele que protege as entregas
    // agendadas, e não pode ser empurrado para trás por quem chama.
    const hoje = hojeBrasil();
    // O mesmo filtro nas duas consultas (contar e aplicar). Escrito duas vezes
    // em vez de uma função genérica porque os tipos do cliente do Supabase não
    // aguentam a abstração; a regra de verdade está testada em
    // `entraNaBaixaDeEntregas`, e qualquer mudança aqui deve ir lá também.
    const semEntregaFutura = `delivery_date.is.null,delivery_date.lt.${hoje}`;

    if (body.simular === true) {
      const { count, error } = await supabase
        .from('vendas_diarias')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', user.id)
        .eq('entrega', 'pendente')
        .neq('status', 'cancelada')
        .lte('data', ate)
        .or(semEntregaFutura);
      if (error) {
        return NextResponse.json(
          { error: 'Não foi possível contar as vendas.', details: error.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ quantidade: count ?? 0 });
    }

    const { data, error } = await supabase
      .from('vendas_diarias')
      .update({ entrega: 'entregue' })
      .eq('workspace_id', user.id)
      .eq('entrega', 'pendente')
      .neq('status', 'cancelada')
      .lte('data', ate)
      .or(semEntregaFutura)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: 'Não foi possível marcar as entregas.', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ quantidade: data?.length ?? 0, ids: (data || []).map((v) => v.id) });
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
