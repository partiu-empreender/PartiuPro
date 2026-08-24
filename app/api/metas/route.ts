import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

interface SalvarMetaRequest {
  mes: number;
  ano: number;
  meta_mensal: number;
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
    const ano = parseInt(searchParams.get('ano') || '', 10) || new Date().getFullYear();

    const [{ data: metas, error: metasError }, { data: vendas, error: vendasError }] = await Promise.all([
      supabase
        .from('metas')
        .select('id, mes, ano, meta_mensal')
        .eq('workspace_id', user.id)
        .eq('ano', ano),
      supabase
        .from('vendas_diarias')
        .select('data, faturamento_total')
        .eq('workspace_id', user.id)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`),
    ]);

    if (metasError || vendasError) {
      return NextResponse.json(
        { error: 'Erro ao buscar metas', details: metasError?.message ?? vendasError?.message },
        { status: 500 },
      );
    }

    // Faturamento por mês (1-12), a partir das vendas do ano
    const faturamentoPorMes: Record<number, number> = {};
    for (const venda of vendas || []) {
      const mes = parseInt(venda.data.slice(5, 7), 10);
      faturamentoPorMes[mes] = (faturamentoPorMes[mes] || 0) + (venda.faturamento_total || 0);
    }

    return NextResponse.json({ success: true, data: metas, faturamentoPorMes, ano });
  } catch (error) {
    console.error('Erro na API de metas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
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

    const body: SalvarMetaRequest = await request.json();

    if (
      !Number.isInteger(body.mes) || body.mes < 1 || body.mes > 12 ||
      !Number.isInteger(body.ano) ||
      typeof body.meta_mensal !== 'number' || body.meta_mensal < 0
    ) {
      return NextResponse.json({ error: 'Dados de meta inválidos' }, { status: 400 });
    }

    const { data: meta, error } = await supabase
      .from('metas')
      .upsert(
        { workspace_id: user.id, mes: body.mes, ano: body.ano, meta_mensal: body.meta_mensal },
        { onConflict: 'workspace_id,mes,ano' },
      )
      .select()
      .single();

    if (error || !meta) {
      return NextResponse.json(
        { error: 'Erro ao salvar meta', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: meta, message: 'Meta atualizada com sucesso' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Erro na API de metas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
