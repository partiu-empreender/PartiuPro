import { NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { CABECALHOS_CLIENTES, gerarCSV } from '@/lib/csv';
import { formatarTelefone } from '@/lib/telefone';
import { extrairEtiquetas } from '@/lib/crm';
import { hojeBrasil } from '@/lib/datas';

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

    const { data: clientes, error } = await supabase
      .from('customers')
      .select(
        `name, phone, email, date_of_birth, notes,
         customer_tag_links ( customer_tags ( id, nome, cor ) )`,
      )
      .eq('workspace_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao exportar clientes', details: error.message },
        { status: 500 },
      );
    }

    const linhas = ((clientes || []) as unknown as Record<string, unknown>[]).map((cliente) => [
      String(cliente.name ?? ''),
      // Formatado pra ficar legível na planilha. Na volta, o importador
      // normaliza de novo pra só dígitos.
      formatarTelefone(cliente.phone as string | null),
      String(cliente.email ?? ''),
      cliente.date_of_birth ? String(cliente.date_of_birth) : '',
      // Ponto e vírgula separa as etiquetas — vírgula confundiria com o
      // separador de colunas do próprio CSV.
      extrairEtiquetas(cliente.customer_tag_links)
        .map((e) => e.nome)
        .join('; '),
      String(cliente.notes ?? ''),
    ]);

    const csv = gerarCSV(CABECALHOS_CLIENTES, linhas);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="clientes-partiu-pro-${hojeBrasil()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Erro ao exportar clientes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
