import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil, somarDias } from '@/lib/datas';
import { ehDataISO } from '@/lib/agenda';

export const dynamic = 'force-dynamic';

/** Até onde a agenda enxerga sem pedir: um mês pra trás, quatro pra frente. */
const DIAS_ANTES = 31;
const DIAS_DEPOIS = 124;

/**
 * Os encontros da mentoria entre duas datas, pra agenda da aluna.
 *
 * Só leitura. Quem cadastra é a equipe, por /api/admin/encontros — a tabela
 * não tem policy de escrita para as alunas (migration 025).
 */
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

    const hoje = hojeBrasil();
    const params = request.nextUrl.searchParams;
    const de = ehDataISO(params.get('de')) ? (params.get('de') as string) : somarDias(hoje, -DIAS_ANTES);
    const ate = ehDataISO(params.get('ate')) ? (params.get('ate') as string) : somarDias(hoje, DIAS_DEPOIS);

    // As datas são de Brasília: o dia `ate` vai até a meia-noite seguinte.
    const { data, error } = await supabase
      .from('encontros')
      .select('id, titulo, descricao, inicio, duracao_minutos, link')
      .gte('inicio', `${de}T00:00:00-03:00`)
      .lt('inicio', `${somarDias(ate, 1)}T00:00:00-03:00`)
      .order('inicio', { ascending: true })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar encontros', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Erro ao buscar encontros:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
