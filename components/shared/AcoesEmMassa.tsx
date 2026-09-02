'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import type { Etiqueta } from '@/components/shared/EtiquetaBadge';

/**
 * A barra que aparece quando há clientes selecionadas.
 *
 * Fica fixa no rodapé, e não no topo, porque a seleção acontece rolando a
 * lista: uma barra no topo sairia da tela justamente enquanto está sendo
 * usada.
 *
 * Só faz uma coisa — pôr e tirar etiqueta. Excluir em massa ficou de fora de
 * propósito: é irreversível, e um clique errado num rodapé fixo apagaria a
 * base inteira sem chance de desfazer.
 */
export default function AcoesEmMassa({
  selecionadas,
  foraDaLista,
  totalVisivel,
  etiquetas,
  onSelecionarTodas,
  onLimpar,
  onSair,
  onAplicar,
  onGerenciarEtiquetas,
}: {
  selecionadas: number;
  /** Quantas das selecionadas não aparecem no recorte atual da lista. */
  foraDaLista: number;
  totalVisivel: number;
  etiquetas: Etiqueta[];
  onSelecionarTodas: () => void;
  onLimpar: () => void;
  onSair: () => void;
  onAplicar: (tagId: string, acao: 'aplicar' | 'remover') => Promise<void>;
  onGerenciarEtiquetas: () => void;
}) {
  const [tagId, setTagId] = useState('');
  const [ocupado, setOcupado] = useState<'aplicar' | 'remover' | null>(null);
  const [recado, setRecado] = useState('');

  const executar = async (acao: 'aplicar' | 'remover') => {
    if (!tagId) {
      setRecado('Escolha uma etiqueta primeiro.');
      return;
    }
    setRecado('');
    setOcupado(acao);
    try {
      await onAplicar(tagId, acao);
      const nome = etiquetas.find((e) => e.id === tagId)?.nome ?? 'Etiqueta';
      setRecado(
        acao === 'aplicar'
          ? `"${nome}" aplicada em ${selecionadas} cliente${selecionadas > 1 ? 's' : ''}.`
          : `"${nome}" tirada de ${selecionadas} cliente${selecionadas > 1 ? 's' : ''}.`,
      );
    } catch (error) {
      setRecado(error instanceof Error ? error.message : 'Não deu pra salvar.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    // z-30 e não z-40: o menu lateral é z-40 e cresce ao passar o mouse. Com a
    // barra por cima, ela cobria o menu aberto em telas de largura média.
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 sm:pb-4">
      <div className="vidro w-full max-w-3xl space-y-2 rounded-2xl border border-primary/30 p-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">
            {selecionadas} selecionada{selecionadas > 1 ? 's' : ''}
          </span>

          {/* Sem este aviso a barra dizia "18 selecionadas" sobre uma lista de
              3 — ou vazia — e a próxima ação pegaria gente que não está na
              tela. É o preço de a seleção sobreviver à troca de filtro, que é
              o comportamento certo: ela junta grupos de recortes diferentes. */}
          {foraDaLista > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
              {foraDaLista} fora do filtro atual
            </span>
          )}

          {selecionadas < totalVisivel && (
            <Button variant="ghost" size="sm" onClick={onSelecionarTodas}>
              Selecionar as {totalVisivel} da lista
            </Button>
          )}
          {/* Duas saídas diferentes: uma desmarca todo mundo e deixa você
              continuar escolhendo; a outra fecha o modo de seleção. Antes as
              duas eram o mesmo botão, chamado "Limpar seleção" — e ele saía do
              modo sem avisar. */}
          <Button variant="ghost" size="sm" onClick={onLimpar}>
            Desmarcar todas
          </Button>
          <Button variant="ghost" size="sm" onClick={onSair}>
            <X className="mr-1 h-3 w-3" /> Sair da seleção
          </Button>
        </div>

        {etiquetas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Você ainda não tem etiquetas.{' '}
            <button
              type="button"
              onClick={onGerenciarEtiquetas}
              className="font-medium text-primary underline underline-offset-2"
            >
              Criar agora
            </button>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tagId}
              onChange={(e) => {
                setTagId(e.target.value);
                setRecado('');
              }}
              aria-label="Etiqueta a aplicar ou tirar"
              className="h-9 min-w-[10rem] rounded-xl border border-input bg-white/70 px-3 text-xs text-foreground backdrop-blur-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Escolha a etiqueta...</option>
              {etiquetas.map((etiqueta) => (
                <option key={etiqueta.id} value={etiqueta.id}>
                  {etiqueta.nome}
                </option>
              ))}
            </select>

            <Button size="sm" disabled={ocupado !== null} onClick={() => executar('aplicar')}>
              <Check className="mr-1 h-3 w-3" />
              {ocupado === 'aplicar' ? 'Aplicando...' : 'Aplicar'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={ocupado !== null}
              onClick={() => executar('remover')}
            >
              {ocupado === 'remover' ? 'Tirando...' : 'Tirar'}
            </Button>
          </div>
        )}

        {recado && <p className="text-xs text-muted-foreground">{recado}</p>}
      </div>
    </div>
  );
}
