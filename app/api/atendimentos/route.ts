import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

interface RegistrarAtendimentoRequest {
  data?: string; // yyyy-mm-dd, default hoje
  pessoas_atendidas: number;
}

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

    const [{ data: atendimentos, error: atendimentosError }, { data: vendas, error: vendasError }] =
      await Promise.all([
        supabase
          .from('atendimentos_diarios')
          .select('id, data, pessoas_atendidas')
          .eq('workspace_id', user.id)
          .order('data', { ascending: false }),
        supabase.from('vendas_diarias').select('data').eq('workspace_id', user.id),
      ]);

    if (atendimentosError || vendasError) {
      return NextResponse.json(
        { error: 'Erro ao buscar atendimentos', details: atendimentosError?.message ?? vendasError?.message },
        { status: 500 },
      );
    }

    // Vendas por dia, para calcular a conversão de cada linha do histórico
    const vendasPorDia: Record<string, number> = {};
    for (const venda of vendas || []) {
      vendasPorDia[venda.data] = (vendasPorDia[venda.data] || 0) + 1;
    }

    return NextResponse.json({ success: true, data: atendimentos, vendasPorDia });
  } catch (error) {
    console.error('Erro na API de atendimentos:', error);
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

    const body: RegistrarAtendimentoRequest = await request.json();

    if (typeof body.pessoas_atendidas !== 'number' || body.pessoas_atendidas < 0) {
      return NextResponse.json({ error: 'Informe quantas pessoas foram atendidas' }, { status: 400 });
    }

    const data = body.data || new Date().toISOString().split('T')[0];

    const { data: atendimento, error } = await supabase
      .from('atendimentos_diarios')
      .upsert(
        { workspace_id: user.id, data, pessoas_atendidas: Math.round(body.pessoas_atendidas) },
        { onConflict: 'workspace_id,data' },
      )
      .select()
      .single();

    if (error || !atendimento) {
      return NextResponse.json(
        { error: 'Erro ao registrar atendimento', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: atendimento, message: 'Atendimento registrado com sucesso' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Erro na API de atendimentos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
