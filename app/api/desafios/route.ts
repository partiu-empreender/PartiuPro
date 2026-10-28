import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil } from '@/lib/datas';

export const dynamic = 'force-dynamic';

/**
 * Os desafios do Mão na Massa que já começaram, com as tarefas e o que esta
 * aluna já marcou.
 *
 * Rascunho nunca chega aqui: a policy de `desafios` só devolve os publicados
 * (migration 025), então não depende de este filtro estar certo.
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

    const [{ data: desafios, error }, { data: feitas, error: erroFeitas }] = await Promise.all([
      supabase
        .from('desafios')
        .select('id, titulo, descricao, inicio, fim, publicado, tarefas:desafio_tarefas (id, ordem, texto)')
        .lte('inicio', hojeBrasil())
        .order('inicio', { ascending: false })
        .limit(100),
      supabase.from('desafio_progresso').select('tarefa_id').eq('workspace_id', user.id),
    ]);

    if (error || erroFeitas) {
      return NextResponse.json(
        { error: 'Erro ao buscar desafios', details: error?.message ?? erroFeitas?.message },
        { status: 500 },
      );
    }

    const lista = (desafios || []).map((d) => ({
      ...d,
      tarefas: [...(d.tarefas || [])].sort((a, b) => a.ordem - b.ordem),
    }));

    return NextResponse.json({
      success: true,
      data: lista,
      feitas: (feitas || []).map((f) => f.tarefa_id),
    });
  } catch (error) {
    console.error('Erro ao buscar desafios:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * Marca ou desmarca uma tarefa de desafio.
 *
 * Corpo: { tarefa_id, desafio_id, feito }. A policy confere que a tarefa é
 * mesmo daquele desafio e que ele está publicado; aqui só se valida o
 * formato, pra devolver um erro legível.
 */
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

    const body = await request.json();
    const tarefaId = typeof body?.tarefa_id === 'string' ? body.tarefa_id : '';
    const desafioId = typeof body?.desafio_id === 'string' ? body.desafio_id : '';
    if (!tarefaId || !desafioId || typeof body?.feito !== 'boolean') {
      return NextResponse.json({ error: 'Informe a tarefa e se ela foi feita.' }, { status: 400 });
    }

    if (body.feito) {
      // upsert: marcar duas vezes (dois cliques rápidos) não é erro.
      const { error } = await supabase
        .from('desafio_progresso')
        .upsert(
          { workspace_id: user.id, tarefa_id: tarefaId, desafio_id: desafioId },
          { onConflict: 'workspace_id,tarefa_id', ignoreDuplicates: true },
        );
      if (error) {
        return NextResponse.json(
          { error: 'Não deu pra marcar essa tarefa.', details: error.message },
          { status: 400 },
        );
      }
    } else {
      const { error } = await supabase
        .from('desafio_progresso')
        .delete()
        .eq('workspace_id', user.id)
        .eq('tarefa_id', tarefaId);
      if (error) {
        return NextResponse.json(
          { error: 'Não deu pra desmarcar essa tarefa.', details: error.message },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar tarefa do desafio:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
