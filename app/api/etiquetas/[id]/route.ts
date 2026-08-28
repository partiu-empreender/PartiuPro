import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { ehCorValida, type CorEtiqueta } from '@/lib/etiquetas';

interface AtualizarEtiquetaRequest {
  nome?: string;
  cor?: CorEtiqueta;
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

    const body: AtualizarEtiquetaRequest = await request.json();
    const patch: Record<string, unknown> = {};
    if (body.nome !== undefined && body.nome.trim()) patch.nome = body.nome.trim();
    if (body.cor !== undefined && ehCorValida(body.cor)) patch.cor = body.cor;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    const { error } = await supabase
      .from('customer_tags')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', user.id);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Você já tem uma etiqueta com esse nome.' }, { status: 409 });
      }
      return NextResponse.json(
        { error: 'Erro ao atualizar etiqueta', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Etiqueta atualizada' });
  } catch (error) {
    console.error('Erro na API de etiquetas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}

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

    // Os vínculos com as clientes somem junto, pelo ON DELETE CASCADE — a
    // cliente permanece, só perde a etiqueta.
    const { error } = await supabase
      .from('customer_tags')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover etiqueta', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Etiqueta removida' });
  } catch (error) {
    console.error('Erro na API de etiquetas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
