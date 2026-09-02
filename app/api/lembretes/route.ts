import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil, somarDias } from '@/lib/datas';
import {
  DIAS_DE_ATRASO_VISIVEL,
  gerarLembretesAutomaticos,
  juntarLembretes,
  type ClienteParaLembrete,
  type LembreteGravado,
} from '@/lib/lembretes';

/** Até onde a agenda enxerga por padrão. Dois meses cobrem qualquer preparo. */
const DIAS_A_FRENTE = 60;

interface CriarLembreteRequest {
  customer_id?: string | null;
  data?: string;
  titulo?: string;
  observacao?: string | null;
  origem?: string;
  /** Presente quando a tela está materializando um lembrete automático. */
  chave?: string | null;
  concluido?: boolean;
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
    const hoje = hojeBrasil();
    const desde = searchParams.get('desde') || somarDias(hoje, -DIAS_DE_ATRASO_VISIVEL);
    const ate = searchParams.get('ate') || somarDias(hoje, DIAS_A_FRENTE);
    const soDoCliente = searchParams.get('cliente');
    const incluirConcluidos = searchParams.get('concluidos') === '1';

    // As duas metades da agenda: o que já está gravado e a matéria-prima do
    // que é calculado. Vão juntas porque uma depende da outra pra saber o que
    // já foi resolvido.
    let consultaGravados = supabase
      .from('lembretes')
      .select('id, customer_id, data, titulo, observacao, origem, chave, concluido_em')
      .eq('workspace_id', user.id)
      .gte('data', desde)
      .lte('data', ate);

    let consultaClientes = supabase
      .from('customers')
      .select('id, name, phone, date_of_birth, created_at, last_order_at')
      .eq('workspace_id', user.id);

    if (soDoCliente) {
      consultaGravados = consultaGravados.eq('customer_id', soDoCliente);
      consultaClientes = consultaClientes.eq('id', soDoCliente);
    }

    const [{ data: gravados, error: erroGravados }, { data: clientes, error: erroClientes }] =
      await Promise.all([consultaGravados, consultaClientes]);

    if (erroGravados || erroClientes) {
      return NextResponse.json(
        {
          error: 'Erro ao buscar lembretes',
          details: erroGravados?.message || erroClientes?.message,
        },
        { status: 500 },
      );
    }

    const lista = juntarLembretes(
      (gravados || []) as LembreteGravado[],
      gerarLembretesAutomaticos((clientes || []) as ClienteParaLembrete[], desde, ate),
      (clientes || []) as ClienteParaLembrete[],
    );

    const visiveis = incluirConcluidos ? lista : lista.filter((l) => !l.concluido);

    return NextResponse.json({
      success: true,
      data: visiveis,
      // A tela usa isto pro resumo ("3 pra hoje, 1 atrasado") sem ter que
      // repetir aqui a regra de o que conta como atrasado.
      resumo: {
        hoje,
        pendentes: lista.filter((l) => !l.concluido).length,
        paraHoje: lista.filter((l) => !l.concluido && l.data === hoje).length,
        atrasados: lista.filter((l) => !l.concluido && l.data < hoje).length,
      },
    });
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

    const body: CriarLembreteRequest = await request.json();

    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'Escreva do que é o lembrete' }, { status: 400 });
    }
    if (!body.data) {
      return NextResponse.json({ error: 'Escolha a data do lembrete' }, { status: 400 });
    }

    // A RLS já barraria um lembrete gravado no workspace de outra pessoa, mas
    // não olha o `customer_id`: dava pra pendurar um lembrete na cliente de
    // outra aluna. Não vazava nada (o nome é resolvido a partir da lista dela,
    // então viria vazio), mas gravava lixo no banco de alguém.
    if (body.customer_id) {
      const { data: dona } = await supabase
        .from('customers')
        .select('id')
        .eq('id', body.customer_id)
        .eq('workspace_id', user.id)
        .maybeSingle();

      if (!dona) {
        return NextResponse.json({ error: 'Cliente não encontrada' }, { status: 404 });
      }
    }

    // O Postgres recusaria uma data inválida com um erro de tipo, que chegaria
    // na tela como "erro interno". Melhor dizer o que está errado.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data)) {
      return NextResponse.json({ error: 'Data do lembrete inválida' }, { status: 400 });
    }

    const linha = {
      workspace_id: user.id,
      customer_id: body.customer_id || null,
      data: body.data,
      titulo: body.titulo.trim(),
      observacao: body.observacao?.trim() || null,
      origem: body.origem || 'manual',
      chave: body.chave || null,
      concluido_em: body.concluido ? new Date().toISOString() : null,
    };

    // Com `chave` o pedido está materializando um lembrete automático — e a
    // tela pode mandar o mesmo duas vezes (clique duplo, aba aberta em dois
    // lugares). O upsert pela chave transforma a segunda vez em atualização
    // em vez de erro de UNIQUE.
    const consulta = body.chave
      ? supabase.from('lembretes').upsert(linha, { onConflict: 'workspace_id,chave' })
      : supabase.from('lembretes').insert(linha);

    const { data, error } = await consulta.select('id').single();

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao salvar lembrete', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
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
