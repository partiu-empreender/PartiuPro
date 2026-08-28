import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { COR_PADRAO, ehCorValida, type CorEtiqueta } from '@/lib/etiquetas';


interface CriarEtiquetaRequest {
  nome: string;
  cor?: CorEtiqueta;
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

    const { data: etiquetas, error } = await supabase
      .from('customer_tags')
      .select('id, nome, cor, created_at')
      .eq('workspace_id', user.id)
      .order('nome', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar etiquetas', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: etiquetas || [] });
  } catch (error) {
    console.error('Erro na API de etiquetas:', error);
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

    const body: CriarEtiquetaRequest = await request.json();
    const nome = body.nome?.trim();

    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome da etiqueta' }, { status: 400 });
    }

    const cor: CorEtiqueta = ehCorValida(body.cor) ? body.cor : COR_PADRAO;

    const { data: etiqueta, error } = await supabase
      .from('customer_tags')
      .insert({ workspace_id: user.id, nome, cor })
      .select('id, nome, cor')
      .single();

    if (error || !etiqueta) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'Você já tem uma etiqueta com esse nome.' }, { status: 409 });
      }
      return NextResponse.json(
        { error: 'Erro ao criar etiqueta', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: etiqueta }, { status: 201 });
  } catch (error) {
    console.error('Erro na API de etiquetas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
