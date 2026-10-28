import { NextRequest, NextResponse } from 'next/server';
import { isCurrentUserAdmin, supabaseAdmin } from '@/lib/supabase-server';
import { ehDataISO } from '@/lib/agenda';
import { hojeBrasil } from '@/lib/datas';

export const dynamic = 'force-dynamic';

/**
 * Cadastro dos desafios do Mão na Massa, pelo painel admin.
 *
 * Toda rota confere is_admin ANTES de usar a service_role (ver
 * /api/admin/encontros): as tabelas não têm policy de escrita pra aluna.
 */

const naoAutorizado = () => NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

interface TarefaDoFormulario {
  id?: string;
  texto: string;
}

interface DadosDoDesafio {
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string | null;
  publicado: boolean;
  tarefas: TarefaDoFormulario[];
}

function lerDesafio(body: Record<string, unknown>): DadosDoDesafio | string {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) return 'Dê um nome ao desafio.';

  const inicio = ehDataISO(body.inicio) ? body.inicio : hojeBrasil();
  const fim = body.fim ? (ehDataISO(body.fim) ? body.fim : 'invalido') : null;
  if (fim === 'invalido') return 'A data do prazo não é válida.';
  if (fim && fim < inicio) return 'O prazo precisa ser depois do início.';

  const tarefas = (Array.isArray(body.tarefas) ? body.tarefas : [])
    .map((t): TarefaDoFormulario | null => {
      if (typeof t !== 'object' || t === null) return null;
      const { id, texto } = t as { id?: unknown; texto?: unknown };
      const limpo = typeof texto === 'string' ? texto.trim() : '';
      if (!limpo) return null;
      return { id: typeof id === 'string' && id ? id : undefined, texto: limpo.slice(0, 500) };
    })
    .filter((t): t is TarefaDoFormulario => t !== null)
    .slice(0, 30);

  if (tarefas.length === 0) return 'Coloque pelo menos uma tarefa no desafio.';

  const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
  return {
    titulo: titulo.slice(0, 200),
    descricao: descricao ? descricao.slice(0, 4000) : null,
    inicio,
    fim,
    publicado: body.publicado === true,
    tarefas,
  };
}

/**
 * Grava as tarefas de um desafio.
 *
 * A tarefa que já existia é ATUALIZADA pelo id, não recriada: apagar e
 * inserir de novo levaria junto (pelo ON DELETE CASCADE) o check de todas as
 * alunas que já tinham feito — corrigir uma vírgula zeraria o progresso da
 * turma. Só a tarefa que saiu do formulário é removida.
 */
async function gravarTarefas(desafioId: string, tarefas: TarefaDoFormulario[]) {
  const { data: existentes, error } = await supabaseAdmin
    .from('desafio_tarefas')
    .select('id')
    .eq('desafio_id', desafioId);
  if (error) throw error;

  const idsExistentes = new Set((existentes || []).map((t) => t.id));
  const mantidas = new Set(tarefas.filter((t) => t.id && idsExistentes.has(t.id)).map((t) => t.id));
  const removidas = [...idsExistentes].filter((id) => !mantidas.has(id));

  if (removidas.length > 0) {
    const { error: erroRemover } = await supabaseAdmin.from('desafio_tarefas').delete().in('id', removidas);
    if (erroRemover) throw erroRemover;
  }

  for (const [ordem, tarefa] of tarefas.entries()) {
    if (tarefa.id && idsExistentes.has(tarefa.id)) {
      const { error: erroAtualizar } = await supabaseAdmin
        .from('desafio_tarefas')
        .update({ texto: tarefa.texto, ordem })
        .eq('id', tarefa.id);
      if (erroAtualizar) throw erroAtualizar;
    } else {
      const { error: erroInserir } = await supabaseAdmin
        .from('desafio_tarefas')
        .insert({ desafio_id: desafioId, texto: tarefa.texto, ordem });
      if (erroInserir) throw erroInserir;
    }
  }
}

/**
 * Todas as marcações de todas as alunas, em páginas.
 *
 * O Supabase devolve no máximo mil linhas por consulta, e a turma inteira
 * marcando cinco tarefas por desafio passa disso rápido. Sem paginar, a
 * contagem de "concluíram" ficaria menor que a real, sem aviso nenhum.
 */
async function todoOProgresso(): Promise<{ desafio_id: string; workspace_id: string }[]> {
  const porPagina = 1000;
  const linhas: { desafio_id: string; workspace_id: string }[] = [];
  for (let pagina = 0; pagina < 100; pagina++) {
    const { data, error } = await supabaseAdmin
      .from('desafio_progresso')
      .select('desafio_id, workspace_id')
      .order('workspace_id')
      .order('tarefa_id')
      .range(pagina * porPagina, (pagina + 1) * porPagina - 1);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < porPagina) break;
  }
  return linhas;
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  let progresso: { desafio_id: string; workspace_id: string }[];
  try {
    progresso = await todoOProgresso();
  } catch (erro) {
    return NextResponse.json(
      { error: 'Erro ao buscar o progresso', details: erro instanceof Error ? erro.message : String(erro) },
      { status: 500 },
    );
  }

  const { data: desafios, error } = await supabaseAdmin
    .from('desafios')
    .select('id, titulo, descricao, inicio, fim, publicado, tarefas:desafio_tarefas (id, ordem, texto)')
    .order('inicio', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar desafios', details: error.message }, { status: 500 });
  }

  // Quantas tarefas cada aluna fez em cada desafio, pra contar quem começou
  // e quem concluiu.
  const porDesafio = new Map<string, Map<string, number>>();
  for (const linha of progresso) {
    const alunas = porDesafio.get(linha.desafio_id) ?? new Map<string, number>();
    alunas.set(linha.workspace_id, (alunas.get(linha.workspace_id) ?? 0) + 1);
    porDesafio.set(linha.desafio_id, alunas);
  }

  const lista = (desafios || []).map((d) => {
    const tarefas = [...(d.tarefas || [])].sort((a, b) => a.ordem - b.ordem);
    const alunas = porDesafio.get(d.id) ?? new Map<string, number>();
    const concluiram = [...alunas.values()].filter((n) => tarefas.length > 0 && n >= tarefas.length).length;
    return { ...d, tarefas, comecaram: alunas.size, concluiram };
  });

  return NextResponse.json({ success: true, data: lista });
}

export async function POST(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  const dados = lerDesafio(await request.json());
  if (typeof dados === 'string') return NextResponse.json({ error: dados }, { status: 400 });

  const { tarefas, ...desafio } = dados;
  const { data, error } = await supabaseAdmin.from('desafios').insert(desafio).select('id').single();
  if (error || !data) {
    return NextResponse.json({ error: 'Erro ao salvar o desafio', details: error?.message }, { status: 500 });
  }

  try {
    await gravarTarefas(data.id, tarefas);
  } catch (erro) {
    // Sem as tarefas o desafio não serve: desfaz pra não sobrar um pela metade.
    await supabaseAdmin.from('desafios').delete().eq('id', data.id);
    return NextResponse.json(
      { error: 'Erro ao salvar as tarefas', details: erro instanceof Error ? erro.message : String(erro) },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Informe qual desafio alterar.' }, { status: 400 });

  const dados = lerDesafio(await request.json());
  if (typeof dados === 'string') return NextResponse.json({ error: dados }, { status: 400 });

  const { tarefas, ...desafio } = dados;
  const { error } = await supabaseAdmin
    .from('desafios')
    .update({ ...desafio, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar o desafio', details: error.message }, { status: 500 });
  }

  try {
    await gravarTarefas(id, tarefas);
  } catch (erro) {
    return NextResponse.json(
      { error: 'Erro ao salvar as tarefas', details: erro instanceof Error ? erro.message : String(erro) },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) return naoAutorizado();

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Informe qual desafio excluir.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('desafios').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Erro ao excluir o desafio', details: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
