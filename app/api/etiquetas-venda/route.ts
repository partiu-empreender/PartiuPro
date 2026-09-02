import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { COR_PADRAO, ehCorValida, type CorEtiqueta } from '@/lib/etiquetas';

/**
 * Etiquetas de OCASIÃO da venda ("Aniversário", "Dia dos Namorados").
 *
 * Gêmea de app/api/etiquetas/route.ts, que faz o mesmo para as etiquetas da
 * CLIENTE. Rota separada porque a tabela é outra e o vocabulário é outro — ver
 * supabase/migrations/010_etiquetas_na_venda.sql.
 */

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
      .from('venda_tags')
      .select('id, nome, cor, created_at')
      .eq('workspace_id', user.id)
      .order('nome', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar etiquetas de venda', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: etiquetas || [] });
  } catch (error) {
    console.error('Erro na API de etiquetas de venda:', error);
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
      .from('venda_tags')
      .insert({ workspace_id: user.id, nome, cor })
      .select('id, nome, cor')
      .single();

    if (error || !etiqueta) {
      // 23505 = violação do UNIQUE(workspace_id, nome). Devolver 409 com texto
      // claro em vez de "erro interno": criar duas vezes a mesma ocasião é o
      // engano mais provável aqui, não uma falha do sistema.
      if (error?.code === '23505') {
        return NextResponse.json(
          { error: 'Você já tem uma etiqueta de venda com esse nome.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: 'Erro ao criar etiqueta de venda', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: etiqueta }, { status: 201 });
  } catch (error) {
    console.error('Erro na API de etiquetas de venda:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
