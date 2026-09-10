/**
 * Atendimentos nominais: uma linha por pessoa atendida.
 *
 * Rota SEPARADA de /api/atendimentos de propósito. Aquela cuida da contagem
 * simples ("atendi 12 hoje"), que já tem histórico e alimenta a conversão dos
 * meses passados. Misturar as duas na mesma rota faria cada mudança numa
 * arriscar a outra, e o número que sai dali é o que a aluna usa para saber se
 * está melhorando.
 *
 * Como as duas convivem — vale o MAIOR dos dois por dia, nunca a soma — está
 * em lib/atendimentos.ts, com teste.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { normalizarTelefone } from '@/lib/telefone';
import { normalizarDDI } from '@/lib/paises';
import { hojeBrasil, motivoDataDeVendaInvalida } from '@/lib/datas';

const SELECT_PESSOA = 'id, data, nome, telefone, ddi, origem, observacao, venda_id, created_at';

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

    // Recorte opcional por mês, no mesmo formato do resto do sistema. Sem ele,
    // a lista cresceria sem limite conforme a aluna usa o sistema.
    const inicio = request.nextUrl.searchParams.get('inicio');
    const fim = request.nextUrl.searchParams.get('fim');

    let consulta = supabase
      .from('atendimentos_pessoas')
      .select(SELECT_PESSOA)
      .eq('workspace_id', user.id)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });

    if (inicio) consulta = consulta.gte('data', inicio);
    if (fim) consulta = consulta.lte('data', fim);

    const { data, error } = await consulta;

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar atendimentos', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data || [] });
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
      nome?: string;
      telefone?: string;
      ddi?: string;
      origem?: string;
      observacao?: string;
    } = await request.json();

    if (!body.nome?.trim()) {
      return NextResponse.json({ error: 'O atendimento precisa de um nome.' }, { status: 400 });
    }

    // Mesma validação de data da venda: nada no futuro, nada absurdo. Um
    // atendimento com data futura desalinharia a conversão do mês.
    const data = body.data?.trim() || hojeBrasil();
    const motivo = motivoDataDeVendaInvalida(data);
    if (motivo) {
      return NextResponse.json({ error: motivo }, { status: 400 });
    }

    const { data: criado, error } = await supabase
      .from('atendimentos_pessoas')
      .insert({
        workspace_id: user.id,
        data,
        nome: body.nome.trim(),
        // Só dígitos, igual ao cadastro de cliente: se um dia esta pessoa virar
        // cliente, os dois números precisam ser comparáveis.
        telefone: normalizarTelefone(body.telefone),
        ddi: normalizarDDI(body.ddi),
        origem: body.origem?.trim() || null,
        observacao: body.observacao?.trim() || null,
      })
      .select(SELECT_PESSOA)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao registrar atendimento', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: criado }, { status: 201 });
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
      return NextResponse.json({ error: 'Informe qual atendimento remover.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('atendimentos_pessoas')
      .delete()
      .eq('id', id)
      .eq('workspace_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover atendimento', details: error.message },
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
