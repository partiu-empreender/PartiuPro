import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

interface AtualizarLembreteRequest {
  data?: string;
  titulo?: string;
  observacao?: string | null;
  concluido?: boolean;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body: AtualizarLembreteRequest = await request.json();
    const patch: Record<string, unknown> = {};

    // Mesma validação do POST: sem ela uma data malformada viraria erro de
    // tipo do Postgres e chegaria na tela como "erro interno do servidor".
    if (body.data !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data)) {
        return NextResponse.json({ error: 'Data do lembrete inválida' }, { status: 400 });
      }
      patch.data = body.data;
    }
    if (body.titulo !== undefined) patch.titulo = body.titulo.trim();
    if (body.observacao !== undefined) patch.observacao = body.observacao?.trim() || null;
    // Desmarcar grava NULL: é o mesmo campo que diz "feito" e "quando foi
    // feito", então voltar atrás é apagar a data, não gravar um `false`.
    if (body.concluido !== undefined) {
      patch.concluido_em = body.concluido ? new Date().toISOString() : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lembretes')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao atualizar lembrete', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Lembrete atualizado' });
  } catch (error) {
    console.error('Erro na API de lembretes:', error);
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
 * Apaga a linha.
 *
 * Num lembrete manual isso é o fim dele. Num automático que foi materializado
 * (a aluna marcou como feito e se arrependeu), apagar a linha devolve o
 * lembrete ao estado calculado — ele volta a aparecer pendente na próxima
 * leitura, que é exatamente o "desfazer" que se espera.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { error } = await supabase
      .from('lembretes')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover lembrete', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Lembrete removido' });
  } catch (error) {
    console.error('Erro na API de lembretes:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}
