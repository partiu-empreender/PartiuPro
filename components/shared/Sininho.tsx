'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, BellOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usarLembretes } from '@/lib/usar-lembretes';
import { hojeBrasil } from '@/lib/datas';
import {
  EVENTO_VER_PENDENCIAS,
  LINK_PENDENCIAS,
  montarAvisos,
  type SituacaoDasVendas,
} from '@/lib/notificacoes';
import { cn } from '@/lib/utils';

/** Onde fica o "já vi". Por navegador: trocar de aparelho mostra de novo. */
const CHAVE_VISTOS = 'partiu:avisos-vistos';
/** Teto da lista guardada: os ids antigos não voltam, não vale carregá-los. */
const MAXIMO_VISTOS = 60;
/** De quanto em quanto tempo as contas das vendas são refeitas. */
const INTERVALO_MS = 5 * 60 * 1000;

function lerVistos(): string[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE_VISTOS);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((id) => typeof id === 'string') : [];
  } catch {
    // Aba anônima ou armazenamento bloqueado: tudo conta como novo, e o
    // sininho segue funcionando.
    return [];
  }
}

function gravarVistos(ids: string[]) {
  try {
    window.localStorage.setItem(CHAVE_VISTOS, JSON.stringify(ids.slice(-MAXIMO_VISTOS)));
  } catch {
    // Mesmo caso de cima: sem onde guardar, só não lembra.
  }
}

/**
 * O sininho do topo: o que pede atenção hoje, em qualquer tela.
 *
 * O número vermelho conta só o que ela ainda não viu. Abrir a lista marca
 * tudo como visto — o aviso continua lá enquanto o assunto existir, só deixa
 * de gritar.
 */
export default function Sininho({ className }: { className?: string }) {
  const pathname = usePathname();
  const hoje = hojeBrasil();
  // Mesmo pedido do cartão "Pra falar hoje" do Dashboard: os dois dividem o
  // cache, então o sininho não custa uma segunda ida ao servidor.
  const { resumo, recarregar } = usarLembretes({ ate: hoje });
  const [vendas, setVendas] = useState<SituacaoDasVendas | null>(null);
  const [vistos, setVistos] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);

  const carregarVendas = useCallback(async () => {
    try {
      const res = await fetch('/api/notificacoes');
      if (!res.ok) return;
      const dados = await res.json();
      setVendas(dados.vendas ?? null);
    } catch {
      // Sem rede, fica com a última conta. O sininho não é lugar de erro.
    }
  }, []);

  useEffect(() => {
    setVistos(lerVistos());
    const intervalo = window.setInterval(carregarVendas, INTERVALO_MS);
    return () => window.clearInterval(intervalo);
  }, [carregarVendas]);

  // Trocar de tela refaz as contas: quem acabou de marcar uma entrega como
  // feita não pode continuar vendo "1 entrega atrasada". Na primeira vez só
  // as vendas: a agenda o próprio usarLembretes já está buscando.
  const primeiraTela = useRef(true);
  useEffect(() => {
    carregarVendas();
    if (primeiraTela.current) primeiraTela.current = false;
    else recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const avisos = useMemo(
    () =>
      montarAvisos({
        hoje,
        lembretesHoje: resumo?.paraHoje ?? 0,
        lembretesAtrasados: resumo?.atrasados ?? 0,
        vendas,
      }),
    [hoje, resumo, vendas],
  );

  const novos = avisos.filter((aviso) => !vistos.includes(aviso.id)).length;

  const aoAbrir = (abrir: boolean) => {
    setAberto(abrir);
    if (abrir && novos > 0) {
      const todos = Array.from(new Set([...vistos, ...avisos.map((a) => a.id)]));
      setVistos(todos);
      gravarVistos(todos);
    }
  };

  return (
    <DropdownMenu open={aberto} onOpenChange={aoAbrir}>
      <DropdownMenuTrigger
        aria-label={novos > 0 ? `Avisos: ${novos} novo${novos > 1 ? 's' : ''}` : 'Avisos'}
        className={cn(
          'vidro relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Bell className="h-[18px] w-[18px]" />
        {novos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground ring-2 ring-background">
            {novos > 9 ? '9+' : novos}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] bg-white p-2">
        <p className="px-2 pb-2 pt-1 text-sm font-semibold">Avisos</p>

        {avisos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <BellOff className="h-6 w-6" />
            Tudo em dia por aqui.
          </div>
        ) : (
          <ul className="space-y-1">
            {avisos.map((aviso) => (
              <li key={aviso.id}>
                <Link
                  href={aviso.href}
                  onClick={(evento) => {
                    setAberto(false);
                    if (aviso.href === LINK_PENDENCIAS && pathname === '/dashboard') {
                      evento.preventDefault();
                      window.dispatchEvent(new Event(EVENTO_VER_PENDENCIAS));
                    }
                  }}
                  className="flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      aviso.tom === 'urgente' ? 'bg-red-500' : 'bg-primary',
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {aviso.titulo}
                    </span>
                    {aviso.descricao && (
                      <span className="block text-xs text-muted-foreground">
                        {aviso.descricao}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
