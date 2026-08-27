import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { normalizarTelefone } from '@/lib/telefone';
import { extrairEtiquetas } from '@/lib/crm';

interface AtualizarClienteRequest {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  date_of_birth?: string;
  tag_ids?: string[];
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const [{ data: cliente, error }, { data: compras }] = await Promise.all([
      supabase
        .from('customers')
        .select(
          `id, name, phone, email, notes, date_of_birth,
           total_orders, total_spent, last_order_at, created_at,
           customer_tag_links ( customer_tags ( id, nome, cor ) )`,
        )
        .eq('id', params.id)
        .eq('workspace_id', user.id)
        .single(),
      // Histórico de compras — o "contexto" que a Tania pediu pra saber que a
      // cliente comprou cesta de maternidade, e identificar quem é VIP.
      supabase
        .from('vendas_diarias')
        .select('id, data, faturamento_total, venda_itens ( produto_nome, quantidade, subtotal, tipo )')
        .eq('workspace_id', user.id)
        .eq('customer_id', params.id)
        .order('data', { ascending: false }),
    ]);

    if (error || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrada' }, { status: 404 });
    }

    const { customer_tag_links, ...resto } = cliente as unknown as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        ...resto,
        etiquetas: extrairEtiquetas(customer_tag_links),
        compras: compras || [],
      },
    });
  } catch (error) {
    console.error('Erro na API de clientes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
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

    const body: AtualizarClienteRequest = await request.json();

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.phone !== undefined) patch.phone = normalizarTelefone(body.phone);
    if (body.email !== undefined) patch.email = body.email.trim() || null;
    if (body.notes !== undefined) patch.notes = body.notes.trim() || null;
    if (body.date_of_birth !== undefined) patch.date_of_birth = body.date_of_birth || null;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('customers')
        .update(patch)
        .eq('id', params.id)
        .eq('workspace_id', user.id);

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'Você já tem uma cliente cadastrada com esse telefone.' },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: 'Erro ao atualizar cliente', details: error.message },
          { status: 500 },
        );
      }
    }

    // Etiquetas são substituídas por completo quando vêm no corpo: a tela
    // manda o conjunto final, não um delta. Simples e sem estado intermediário.
    if (body.tag_ids !== undefined) {
      await supabase.from('customer_tag_links').delete().eq('customer_id', params.id);
      if (body.tag_ids.length > 0) {
        await supabase
          .from('customer_tag_links')
          .insert(body.tag_ids.map((tag_id) => ({ customer_id: params.id, tag_id })));
      }
    }

    return NextResponse.json({ success: true, message: 'Cliente atualizada' });
  } catch (error) {
    console.error('Erro na API de clientes:', error);
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
      .from('customers')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao remover cliente', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Cliente removida' });
  } catch (error) {
    console.error('Erro na API de clientes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
