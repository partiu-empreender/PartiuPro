import { diasEntre } from '@/lib/datas';

// Mão na Massa (Marco 1, item 1.9): os desafios que a Tânia publica e as
// tarefas que a aluna marca. Puro, pra ser testado.

export interface TarefaDoDesafio {
  id: string;
  ordem: number;
  texto: string;
}

export interface Desafio {
  id: string;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string | null;
  publicado: boolean;
  tarefas: TarefaDoDesafio[];
}

export interface Progresso {
  feitas: number;
  total: number;
  percentual: number;
  concluido: boolean;
}

/** Quanto do desafio ela já fez. Desafio sem tarefa nunca conta como concluído. */
export function progressoDoDesafio(desafio: { tarefas: { id: string }[] }, feitas: Set<string>): Progresso {
  const total = desafio.tarefas.length;
  const quantas = desafio.tarefas.filter((t) => feitas.has(t.id)).length;
  return {
    feitas: quantas,
    total,
    percentual: total > 0 ? (quantas / total) * 100 : 0,
    concluido: total > 0 && quantas === total,
  };
}

export type SituacaoDoDesafio = 'em-breve' | 'aberto' | 'encerrado';

/** Aberto do início até o fim do dia do prazo, inclusive. Sem prazo, não encerra. */
export function situacaoDoDesafio(desafio: Pick<Desafio, 'inicio' | 'fim'>, hoje: string): SituacaoDoDesafio {
  if (hoje < desafio.inicio) return 'em-breve';
  if (desafio.fim && hoje > desafio.fim) return 'encerrado';
  return 'aberto';
}

/** "último dia hoje", "falta 1 dia", "faltam 5 dias", ou null sem prazo. */
export function prazoDoDesafio(fim: string | null, hoje: string): string | null {
  if (!fim) return null;
  const dias = diasEntre(hoje, fim);
  if (dias < 0) return 'encerrado';
  if (dias === 0) return 'último dia hoje';
  return dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`;
}

/** Desafio "novo" pro sininho: aberto e publicado nos últimos 7 dias. */
export function ehDesafioNovo(desafio: Pick<Desafio, 'inicio' | 'fim'>, hoje: string): boolean {
  return situacaoDoDesafio(desafio, hoje) === 'aberto' && diasEntre(desafio.inicio, hoje) <= 7;
}

/** Limpa a lista de tarefas que vem do formulário: sem linha vazia, sem espaço sobrando. */
export function limparTarefas(textos: unknown): string[] {
  if (!Array.isArray(textos)) return [];
  return textos
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30);
}
