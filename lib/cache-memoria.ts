// Guarda o que já foi carregado enquanto a aba está aberta.
//
// Toda tela do app busca os próprios dados ao montar. Sem isto, voltar pra uma
// tela que já foi vista mostra "Carregando..." de novo e espera a ida e volta
// inteira até o banco — mesmo que nada tenha mudado em dez segundos.
//
// Aqui a tela pinta na hora com o que já tinha e revalida em silêncio por trás.
// É memória do processo: um F5 zera, o que é o comportamento certo — cache que
// sobrevive a recarga vira dado velho difícil de explicar.

const memoria = new Map<string, unknown>();

let donoAtual: string | null = null;

export function lerMemoria<T>(chave: string): T | undefined {
  return memoria.get(chave) as T | undefined;
}

export function gravarMemoria<T>(chave: string, valor: T): void {
  memoria.set(chave, valor);
}

export function limparMemoria(): void {
  memoria.clear();
}

/**
 * Amarra o cache a uma pessoa e limpa tudo quando ela muda.
 *
 * Sair e entrar com outra conta é navegação de SPA: o módulo continua vivo, e
 * sem esta trava a segunda pessoa veria por um instante os dados da primeira.
 * Chamado no AppShell, que renderiza antes das telas — então a limpeza
 * acontece antes de qualquer tela ler o cache.
 */
export function garantirDono(identificador: string | undefined | null): void {
  const dono = identificador ?? null;
  if (donoAtual !== dono) {
    memoria.clear();
    donoAtual = dono;
  }
}
