import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin, supabaseAdmin } from '@/lib/supabase-server';
import { ehDataISO, ehHora, inicioEmBrasilia, linkSeguro } from '@/lib/agenda';

export const dynamic = 'force-dynamic';

/**
 * Cadastro dos encontros da mentoria, pelo painel admin.
 *
 * Toda rota confere is_admin ANTES de usar a service_role: é ela que ignora
 * o RLS, e a tabela não tem policy de escrita pra ninguém mais.
 */

const naoAutorizado = () => NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

interface DadosDoEncontro {
  titulo: string;
  descricao: string | null;
  inicio: string;
  duracao_minutos: number;
  link: string | null;
}

/** Valida o corpo do formulário. Devolve o erro em texto, pra tela mostrar. */
function lerEncontro(body: Record<string, unknown>): DadosDoEncontro | string {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) return 'Dê um nome ao encontro.';
  if (!ehDataISO(body.data)) return 'Escolha a data do encontro.';
  if (!ehHora(body.hora)) return 'Escolha o horário do encontro.';

  const duracao = Number(body.duracao_minutos ?? 60);
  if (!Number.isInteger(duracao) || duracao < 5 || duracao > 600) {
    return 'A duração precisa ficar entre 5 minutos e 10 horas.';
  }

  const link = linkSeguro(body.link);
  if (link === undefined) return 'O link da sala precisa começar com https://';

  const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
  return {
    titulo: titulo.slice(0, 200),
    descricao: descricao ? descricao.slice(0, 4000) : null,
    inicio: inicioEmBrasilia(body.data, body.hora),
    duracao_minutos: duracao,
    link,
  };
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  const { data, error } = await supabaseAdmin
    .from('encontros')
    .select('id, titulo, descricao, inicio, duracao_minutos, link')
    .order('inicio', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar encontros', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  const dados = lerEncontro(await request.json());
  if (typeof dados === 'string') return NextResponse.json({ error: dados }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('encontros').insert(dados).select().single();
  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar o encontro', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Informe qual encontro alterar.' }, { status: 400 });

  const dados = lerEncontro(await request.json());
  if (typeof dados === 'string') return NextResponse.json({ error: dados }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('encontros')
    .update({ ...dados, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar o encontro', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Informe qual encontro excluir.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('encontros').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Erro ao excluir o encontro', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
