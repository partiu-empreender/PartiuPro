import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

interface CriarProdutoRequest {
  name: string;
  price: number;
  cost?: number;
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

    const { data: produtos, error } = await supabase
      .from('products')
      .select('id, name, price, cost, created_at')
      .eq('workspace_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar produtos', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: produtos });
  } catch (error) {
    console.error('Erro na API de produtos:', error);
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

    const body: CriarProdutoRequest = await request.json();

    if (!body.name?.trim() || typeof body.price !== 'number' || body.price <= 0) {
      return NextResponse.json(
        { error: 'Informe nome e preço (maior que zero)' },
        { status: 400 },
      );
    }

    const cost = typeof body.cost === 'number' ? body.cost : 0;
    if (cost > body.price) {
      return NextResponse.json({ error: 'O custo não pode ser maior que o preço' }, { status: 400 });
    }

    const { data: produto, error } = await supabase
      .from('products')
      .insert({
        workspace_id: user.id,
        name: body.name.trim(),
        description: '',
        price: body.price,
        cost,
        is_active: true,
      })
      .select()
      .single();

    if (error || !produto) {
      return NextResponse.json(
        { error: 'Erro ao criar produto', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, data: produto, message: 'Produto cadastrado com sucesso' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Erro na API de produtos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
