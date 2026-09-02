'use client';

import { Button } from '@/components/ui/button';
import { Tag, X } from 'lucide-react';
import EtiquetaBadge, { EtiquetaToggle, type Etiqueta } from '@/components/shared/EtiquetaBadge';
import { DATAS_COMEMORATIVAS } from '@/lib/datas-comemorativas';
import {
  GRUPOS_SITUACAO,
  ORDENS,
  SITUACOES,
  contarFiltrosAtivos,
  type FiltrosClientes,
  type OrdemCliente,
  type SituacaoCliente,
} from '@/lib/filtros-clientes';
import { cn } from '@/lib/utils';

/**
 * A barra de filtros da lista de clientes.
 *
 * Saiu da página porque ela já tinha mil linhas, mas principalmente porque os
 * filtros passaram a ter regra própria: eles se combinam. Etiqueta E situação E
 * data comemorativa acontecem ao mesmo tempo — "quem é corporativa, comprou no
 * Natal passado e está há três meses sem comprar" é uma pergunta só, e é
 * exatamente o tipo de recorte que faz a aluna pegar o telefone.
 *
 * As situações aparecem como botões, e não escondidas num menu, de propósito:
 * elas são a resposta pra "e agora, o que eu faço com essa base?". Um filtro
 * que ninguém descobre não filtra nada.
 */

function Chip({
  ativo,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        ativo
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-white/60 text-muted-foreground backdrop-blur-md hover:bg-accent',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const classeSelect =
  'h-9 rounded-xl border border-input bg-white/70 px-3 text-xs text-foreground backdrop-blur-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30';

export default function BarraDeFiltros({
  filtros,
  onChange,
  etiquetas,
  onGerenciarEtiquetas,
  onComemorativa,
  carregandoComemorativa,
  etiquetasVenda = [],
}: {
  filtros: FiltrosClientes;
  onChange: (filtros: FiltrosClientes) => void;
  etiquetas: Etiqueta[];
  onGerenciarEtiquetas: () => void;
  onComemorativa: (id: string) => void;
  carregandoComemorativa: boolean;
  /** Etiquetas de ocasião marcadas nas vendas (migration 010). */
  etiquetasVenda?: Etiqueta[];
}) {
  const alterar = (parcial: Partial<FiltrosClientes>) => onChange({ ...filtros, ...parcial });

  const alternarEtiqueta = (id: string) =>
    alterar({
      etiquetas: filtros.etiquetas.includes(id)
        ? filtros.etiquetas.filter((x) => x !== id)
        : [...filtros.etiquetas, id],
      // Marcar uma etiqueta e "sem etiqueta" ao mesmo tempo pediria uma lista
      // vazia por definição, então um desliga o outro.
      semEtiqueta: false,
    });

  const ativos = contarFiltrosAtivos(filtros);

  // Limpa também o seletor de data comemorativa. Enquanto o id do evento
  // morava no estado da página, este botão apagava os ids mas não o seletor:
  // ficava escrito "Natal" num filtro que já tinha sido desligado.
  const limpar = () =>
    alterar({
      situacao: 'todas',
      etiquetas: [],
      semEtiqueta: false,
      comemorativa: '',
      rotuloComemorativa: null,
      idsComemorativa: null,
    });

  return (
    <div className="space-y-3">
      {/* Etiquetas — o que só a aluna sabe */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Etiquetas
        </span>
        {etiquetas.map((etiqueta) => (
          <EtiquetaToggle
            key={etiqueta.id}
            etiqueta={etiqueta}
            ativa={filtros.etiquetas.includes(etiqueta.id)}
            onClick={() => alternarEtiqueta(etiqueta.id)}
          />
        ))}
        {/* "Sem etiqueta" só faz sentido quando existe alguma etiqueta: numa
            conta nova ele selecionaria a base inteira e ensinaria a coisa
            errada logo na primeira tela. */}
        {etiquetas.length > 0 ? (
          <Chip
            ativo={filtros.semEtiqueta}
            title="Clientes que ainda não foram classificadas"
            onClick={() => alterar({ semEtiqueta: !filtros.semEtiqueta, etiquetas: [] })}
          >
            Sem etiqueta
          </Chip>
        ) : (
          <span className="text-xs text-muted-foreground">
            você ainda não criou nenhuma —
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onGerenciarEtiquetas}>
          <Tag className="mr-2 h-3 w-3" /> {etiquetas.length > 0 ? 'Gerenciar' : 'Criar etiquetas'}
        </Button>

        {/* Só faz pergunta quando há duas etiquetas marcadas: com uma só, "e"
            e "ou" dão a mesma lista, e o controle seria ruído. */}
        {filtros.etiquetas.length > 1 && (
          <div className="flex items-center gap-1 rounded-full border border-input bg-white/60 p-1 text-xs backdrop-blur-md">
            {(
              [
                { valor: 'qualquer' as const, rotulo: 'Qualquer uma' },
                { valor: 'todas' as const, rotulo: 'Todas juntas' },
              ]
            ).map((modo) => (
              <button
                key={modo.valor}
                type="button"
                aria-pressed={filtros.modoEtiqueta === modo.valor}
                onClick={() => alterar({ modoEtiqueta: modo.valor })}
                className={cn(
                  'rounded-full px-2.5 py-1 font-medium transition-colors',
                  filtros.modoEtiqueta === modo.valor
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {modo.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Situação — o que o sistema calcula sozinho */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Situação
          </span>
          <Chip ativo={filtros.situacao === 'todas'} onClick={() => alterar({ situacao: 'todas' })}>
            Todas
          </Chip>
        </div>

        {GRUPOS_SITUACAO.map((grupo) => (
          <div key={grupo.valor} className="flex flex-wrap items-center gap-2 pl-0 sm:pl-1">
            <span className="w-full text-[11px] text-muted-foreground sm:w-auto sm:min-w-[7rem]">
              {grupo.rotulo}
            </span>
            {SITUACOES.filter((s) => s.grupo === grupo.valor).map((s) => (
              <Chip
                key={s.valor}
                title={s.ajuda}
                ativo={filtros.situacao === s.valor}
                onClick={() =>
                  alterar({
                    situacao:
                      filtros.situacao === s.valor ? 'todas' : (s.valor as SituacaoCliente),
                  })
                }
              >
                {s.rotulo}
              </Chip>
            ))}
          </div>
        ))}
      </div>

      {/* "Comprou em" — DUAS fontes no mesmo seletor.

          As datas comemorativas o sistema calcula sozinho, cruzando a data da
          venda com o calendário; as etiquetas de ocasião são o que a aluna
          marcou à mão na venda. Pra ela a pergunta é uma só ("quem comprou no
          Dia dos Namorados?"), e ela não deveria precisar saber de onde veio a
          resposta — por isso um seletor, com as fontes separadas em grupos só
          pra ficar claro o que é automático e o que foi marcado. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Comprou em
          <select
            value={filtros.comemorativa}
            onChange={(e) => onComemorativa(e.target.value)}
            className={classeSelect}
          >
            <option value="">Qualquer época</option>
            <optgroup label="Pela data da compra">
              {DATAS_COMEMORATIVAS.map((data) => (
                <option key={data.id} value={data.id}>
                  {data.nome}
                </option>
              ))}
            </optgroup>
            {etiquetasVenda.length > 0 && (
              <optgroup label="Pela ocasião marcada na venda">
                {etiquetasVenda.map((etiqueta) => (
                  <option key={etiqueta.id} value={`tag:${etiqueta.id}`}>
                    {etiqueta.nome}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {carregandoComemorativa && (
          <span className="text-xs text-muted-foreground">consultando as vendas...</span>
        )}
        {!carregandoComemorativa && filtros.rotuloComemorativa && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {filtros.rotuloComemorativa}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Ordenar por
          <select
            value={filtros.ordem}
            onChange={(e) => alterar({ ordem: e.target.value as OrdemCliente })}
            className={classeSelect}
          >
            {ORDENS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>

        {ativos > 0 && (
          <Button variant="ghost" size="sm" onClick={limpar}>
            <X className="mr-1 h-3 w-3" /> Limpar filtros ({ativos})
          </Button>
        )}
      </div>
    </div>
  );
}

/** As etiquetas marcadas, em texto, pro resumo acima da lista. */
export function ResumoDasEtiquetas({
  filtros,
  etiquetas,
}: {
  filtros: FiltrosClientes;
  etiquetas: Etiqueta[];
}) {
  const marcadas = etiquetas.filter((e) => filtros.etiquetas.includes(e.id));
  if (marcadas.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {marcadas.map((etiqueta) => (
        <EtiquetaBadge key={etiqueta.id} etiqueta={etiqueta} />
      ))}
    </div>
  );
}
