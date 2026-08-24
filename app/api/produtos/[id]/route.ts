import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

interface AtualizarProdutoRequest {
  name?: string;
  price?: number;
  cost?: number;
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

    const body: AtualizarProdutoRequest = await request.json();

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.price !== undefined) patch.price = body.price;
    if (body.cost !== undefined) patch.cost = body.cost;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    const { data: produto, error } = await supabase
      .from('products')
      .update(patch)
      .eq('id', params.id)
      .eq('workspace_id', user.id)
      .select()
      .single();

    if (error || !produto) {
      return NextResponse.json(
        { error: 'Erro ao atualizar produto', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: produto, message: 'Produto atualizado' });
  } catch (error) {
    console.error('Erro na API de produtos:', error);
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

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover produto', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Produto removido' });
  } catch (error) {
    console.error('Erro na API de produtos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
