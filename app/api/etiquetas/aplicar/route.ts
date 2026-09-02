import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

/**
 * Aplica ou tira uma etiqueta de várias clientes de uma vez.
 *
 * O modelo que desenhamos concentra o trabalho manual num toque no momento da
 * venda — ótimo daqui pra frente. Mas a aluna começa importando a base que já
 * tem, e aí precisa classificar 40 clientes de uma vez: sem isto, são 40
 * diálogos de edição abertos e fechados um por um.
 *
 * É justamente o que a barra de filtros nova habilita: filtra "comprou no
 * Natal", seleciona todas, aplica "Cliente Corporativo". Trinta segundos.
 */

interface AplicarEtiquetaRequest {
  customer_ids?: string[];
  tag_id?: string;
  acao?: 'aplicar' | 'remover';
}

/** Teto por chamada. Protege contra um pedido absurdo sem atrapalhar o uso real. */
const MAXIMO_POR_VEZ = 500;

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

    const body: AplicarEtiquetaRequest = await request.json();
    const acao = body.acao === 'remover' ? 'remover' : 'aplicar';
    const pedidos = [...new Set(body.customer_ids ?? [])];

    if (!body.tag_id) {
      return NextResponse.json({ error: 'Escolha a etiqueta' }, { status: 400 });
    }
    if (pedidos.length === 0) {
      return NextResponse.json({ error: 'Nenhuma cliente selecionada' }, { status: 400 });
    }
    if (pedidos.length > MAXIMO_POR_VEZ) {
      return NextResponse.json(
        { error: `Dá pra etiquetar até ${MAXIMO_POR_VEZ} clientes de uma vez.` },
        { status: 400 },
      );
    }

    // A RLS de `customer_tag_links` já valida os dois lados na inserção, mas
    // ela falha em bloco e sem explicação. Conferindo antes, dá pra dizer o
    // que aconteceu — e uma lista com um id estranho no meio não derruba as
    // outras 39 clientes junto.
    const [{ data: etiqueta }, { data: minhas }] = await Promise.all([
      supabase
        .from('customer_tags')
        .select('id, nome')
        .eq('id', body.tag_id)
        .eq('workspace_id', user.id)
        .maybeSingle(),
      supabase.from('customers').select('id').eq('workspace_id', user.id).in('id', pedidos),
    ]);

    if (!etiqueta) {
      return NextResponse.json({ error: 'Etiqueta não encontrada' }, { status: 404 });
    }

    const ids = (minhas ?? []).map((c) => c.id as string);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nenhuma das clientes é sua' }, { status: 404 });
    }

    if (acao === 'remover') {
      const { error } = await supabase
        .from('customer_tag_links')
        .delete()
        .eq('tag_id', etiqueta.id)
        .in('customer_id', ids);

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao tirar a etiqueta', details: error.message },
          { status: 500 },
        );
      }
    } else {
      // `ignoreDuplicates` porque a seleção quase sempre mistura quem já tem a
      // etiqueta com quem não tem — e reaplicar não pode ser erro.
      const { error } = await supabase.from('customer_tag_links').upsert(
        ids.map((customer_id) => ({ customer_id, tag_id: etiqueta.id })),
        { onConflict: 'customer_id,tag_id', ignoreDuplicates: true },
      );

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao aplicar a etiqueta', details: error.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { afetadas: ids.length, etiqueta: etiqueta.nome, acao },
    });
  } catch (error) {
    console.error('Erro na API de etiquetas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}
