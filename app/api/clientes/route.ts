import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { normalizarTelefone } from '@/lib/telefone';
import { extrairEtiquetas } from '@/lib/crm';

interface CriarClienteRequest {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  date_of_birth?: string;
  tag_ids?: string[];
}

// Colunas do cliente + etiquetas ligadas. O !inner não é usado de propósito:
// cliente sem etiqueta precisa aparecer na lista.
const SELECT_CLIENTE = `
  id, name, phone, email, notes, date_of_birth,
  total_orders, total_spent, last_order_at, created_at,
  customer_tag_links ( tag_id, customer_tags ( id, nome, cor ) )
`;

function comEtiquetas(cliente: Record<string, unknown>) {
  const { customer_tag_links, ...resto } = cliente;
  return { ...resto, etiquetas: extrairEtiquetas(customer_tag_links) };
}

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

    const { searchParams } = new URL(request.url);
    const busca = (searchParams.get('busca') || '').trim();
    const tagId = searchParams.get('etiqueta');

    let query = supabase
      .from('customers')
      .select(SELECT_CLIENTE)
      .eq('workspace_id', user.id)
      .order('name', { ascending: true });

    if (busca) {
      // A Tania busca por nome ou digitando o telefone. Como o telefone é
      // guardado só com dígitos, a busca também precisa ser normalizada —
      // senão procurar "(21) 99999" nunca acharia nada.
      const digitos = normalizarTelefone(busca);
      const filtros = [`name.ilike.%${busca}%`];
      if (digitos) filtros.push(`phone.ilike.%${digitos}%`);
      query = query.or(filtros.join(','));
    }

    const { data: clientes, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar clientes', details: error.message },
        { status: 500 },
      );
    }

    let lista = ((clientes || []) as unknown as Record<string, unknown>[]).map(comEtiquetas);

    // Filtro por etiqueta aplicado aqui e não no banco: filtrar pela tabela de
    // ligação faria a consulta devolver só a etiqueta procurada, e a lista
    // perderia as outras etiquetas de cada cliente. Com 10-40 clientes por
    // aluna, filtrar em memória é irrelevante em custo.
    if (tagId) {
      lista = lista.filter((cliente) => cliente.etiquetas.some((tag) => tag.id === tagId));
    }

    return NextResponse.json({ success: true, data: lista });
  } catch (error) {
    console.error('Erro na API de clientes:', error);
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

    const body: CriarClienteRequest = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Informe o nome da cliente' }, { status: 400 });
    }

    const phone = normalizarTelefone(body.phone);

    const { data: cliente, error } = await supabase
      .from('customers')
      .insert({
        workspace_id: user.id,
        name: body.name.trim(),
        phone,
        email: body.email?.trim() || null,
        notes: body.notes?.trim() || null,
        date_of_birth: body.date_of_birth || null,
      })
      .select('id')
      .single();

    if (error || !cliente) {
      // 23505 = violação de UNIQUE(workspace_id, phone).
      if (error?.code === '23505') {
        return NextResponse.json(
          { error: 'Você já tem uma cliente cadastrada com esse telefone.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: 'Erro ao cadastrar cliente', details: error?.message },
        { status: 500 },
      );
    }

    if (body.tag_ids?.length) {
      await supabase
        .from('customer_tag_links')
        .insert(body.tag_ids.map((tag_id) => ({ customer_id: cliente.id, tag_id })));
    }

    return NextResponse.json(
      { success: true, data: cliente, message: 'Cliente cadastrada' },
      { status: 201 },
    );
  } catch (error) {
    console.error('Erro na API de clientes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
