'use client';

import { useCallback, useEffect, useState } from 'react';
import { gravarMemoria, lerMemoria } from '@/lib/cache-memoria';
import { hojeBrasil, somarDias } from '@/lib/datas';
import type { Lembrete } from '@/lib/lembretes';

export interface ResumoLembretes {
  hoje: string;
  pendentes: number;
  paraHoje: number;
  atrasados: number;
}

interface Opcoes {
  /** Só os lembretes de uma cliente. Usado na ficha dela. */
  cliente?: string;
  ate?: string;
  incluirConcluidos?: boolean;
}

export interface NovoLembrete {
  customer_id?: string | null;
  data: string;
  titulo: string;
  observacao?: string | null;
}

/**
 * Carrega e mexe na agenda.
 *
 * O detalhe que justifica o arquivo: um lembrete automático **não tem linha no
 * banco** até alguém encostar nele. Então "marcar como feito" é uma operação
 * diferente conforme o caso — PATCH numa linha que existe, ou POST que cria a
 * linha já concluída. Deixar essa escolha espalhada por cada tela era pedir pra
 * uma delas errar; aqui ela acontece uma vez, em `concluir`.
 */
export function usarLembretes(opcoes: Opcoes = {}) {
  const { cliente, ate, incluirConcluidos = false } = opcoes;
  const chaveCache = `lembretes:${cliente ?? 'todos'}:${ate ?? ''}:${incluirConcluidos}`;

  const emCache = lerMemoria<{ lembretes: Lembrete[]; resumo: ResumoLembretes | null }>(chaveCache);
  const [lembretes, setLembretes] = useState<Lembrete[]>(emCache?.lembretes ?? []);
  const [resumo, setResumo] = useState<ResumoLembretes | null>(emCache?.resumo ?? null);
  const [carregando, setCarregando] = useState(emCache === undefined);

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (cliente) params.set('cliente', cliente);
      if (ate) params.set('ate', ate);
      if (incluirConcluidos) params.set('concluidos', '1');

      const res = await fetch(`/api/lembretes?${params.toString()}`);
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error || 'Erro ao carregar lembretes');

      setLembretes(dados.data || []);
      setResumo(dados.resumo || null);
      gravarMemoria(chaveCache, { lembretes: dados.data || [], resumo: dados.resumo || null });
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
    } finally {
      setCarregando(false);
    }
  }, [cliente, ate, incluirConcluidos, chaveCache]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Marca (ou desmarca) como feito.
   *
   * A tela é atualizada antes da resposta do servidor de propósito: marcar um
   * item é o gesto mais repetido da agenda, e esperar a ida e volta a cada
   * clique faz a lista parecer travada.
   */
  const concluir = useCallback(
    async (lembrete: Lembrete, feito: boolean) => {
      setLembretes((atual) =>
        atual.map((l) => (l.id === lembrete.id ? { ...l, concluido: feito } : l)),
      );

      try {
        if (lembrete.gravado) {
          await fetch(`/api/lembretes/${lembrete.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concluido: feito }),
          });
        } else {
          // Automático que nunca foi tocado: a linha nasce agora, já concluída,
          // carregando a chave que impede o gerador de recriá-lo pendente.
          await fetch('/api/lembretes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: lembrete.customer_id,
              data: lembrete.data,
              titulo: lembrete.titulo,
              observacao: lembrete.observacao,
              origem: lembrete.origem,
              chave: lembrete.chave,
              concluido: feito,
            }),
          });
        }
      } finally {
        await carregar();
      }
    },
    [carregar],
  );

  /**
   * Empurra o lembrete pra frente.
   *
   * Conta a partir de HOJE quando o lembrete já venceu, e a partir da data
   * dele quando ainda está no futuro. Sem esse cuidado, "adiar 1 semana" num
   * lembrete que era pra três dias atrás cairia em quatro dias atrás — e num
   * lembrete marcado pra daqui a um mês, adiar o traria pra mais perto.
   *
   * Num automático que ainda é só cálculo, adiar GRAVA a linha com a chave.
   * É isso que faz a nova data valer: na leitura seguinte o gerador encontra a
   * chave já existente e usa a linha gravada no lugar do candidato, que
   * continuaria apontando pro dia original.
   */
  const adiar = useCallback(
    async (lembrete: Lembrete, dias: number) => {
      const hoje = hojeBrasil();
      const partida = lembrete.data < hoje ? hoje : lembrete.data;
      const novaData = somarDias(partida, dias);

      setLembretes((atual) =>
        atual.map((l) => (l.id === lembrete.id ? { ...l, data: novaData } : l)),
      );

      try {
        if (lembrete.gravado) {
          await fetch(`/api/lembretes/${lembrete.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: novaData }),
          });
        } else {
          await fetch('/api/lembretes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: lembrete.customer_id,
              data: novaData,
              titulo: lembrete.titulo,
              observacao: lembrete.observacao,
              origem: lembrete.origem,
              chave: lembrete.chave,
              concluido: false,
            }),
          });
        }
      } finally {
        await carregar();
      }
    },
    [carregar],
  );

  const criar = useCallback(
    async (novo: NovoLembrete) => {
      const res = await fetch('/api/lembretes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error || 'Erro ao criar lembrete');
      await carregar();
    },
    [carregar],
  );

  const remover = useCallback(
    async (lembrete: Lembrete) => {
      // Um automático que nunca foi gravado não tem o que remover no banco —
      // some da tela e volta a ser calculado na próxima leitura.
      if (lembrete.gravado) {
        await fetch(`/api/lembretes/${lembrete.id}`, { method: 'DELETE' });
      }
      await carregar();
    },
    [carregar],
  );

  return { lembretes, resumo, carregando, recarregar: carregar, concluir, adiar, criar, remover };
}
