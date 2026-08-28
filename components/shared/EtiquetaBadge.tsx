import { cn } from '@/lib/utils';
import { CORES_ETIQUETA, COR_PADRAO, ehCorValida, type CorEtiqueta } from '@/lib/etiquetas';

export { CORES_ETIQUETA, type CorEtiqueta };

export interface Etiqueta {
  id: string;
  nome: string;
  cor: string;
}

// As classes são escritas por extenso de propósito. O Tailwind decide o que
// entra no CSS varrendo o código-fonte, então uma classe montada em tempo de
// execução — `bg-${cor}-100` — não existiria no build e a etiqueta apareceria
// sem cor nenhuma em produção.
const ESTILOS: Record<CorEtiqueta, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
};

const ESTILOS_SELECIONAVEL: Record<CorEtiqueta, string> = {
  slate: 'border-slate-400 bg-slate-200 text-slate-900',
  red: 'border-red-400 bg-red-200 text-red-900',
  rose: 'border-rose-400 bg-rose-200 text-rose-900',
  orange: 'border-orange-400 bg-orange-200 text-orange-900',
  amber: 'border-amber-400 bg-amber-200 text-amber-900',
  emerald: 'border-emerald-400 bg-emerald-200 text-emerald-900',
  teal: 'border-teal-400 bg-teal-200 text-teal-900',
  sky: 'border-sky-400 bg-sky-200 text-sky-900',
  violet: 'border-violet-400 bg-violet-200 text-violet-900',
  fuchsia: 'border-fuchsia-400 bg-fuchsia-200 text-fuchsia-900',
};

function estilo(cor: string, selecionado = false): string {
  const chave = ehCorValida(cor) ? cor : COR_PADRAO;
  return selecionado ? ESTILOS_SELECIONAVEL[chave] : ESTILOS[chave];
}

export default function EtiquetaBadge({
  etiqueta,
  className,
}: {
  etiqueta: Etiqueta;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        estilo(etiqueta.cor),
        className,
      )}
    >
      {etiqueta.nome}
    </span>
  );
}

/** Mesma etiqueta, mas como botão de marcar/desmarcar. */
export function EtiquetaToggle({
  etiqueta,
  ativa,
  onClick,
}: {
  etiqueta: Etiqueta;
  ativa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        ativa
          ? estilo(etiqueta.cor, true)
          : 'border-input bg-white/60 text-muted-foreground backdrop-blur-md hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {etiqueta.nome}
    </button>
  );
}
