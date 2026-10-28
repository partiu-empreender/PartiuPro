'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { usarConta } from '@/components/shared/AppShell';
import { cn } from '@/lib/utils';

/** O mesmo limite da rota de upload, checado antes pra não esperar o envio falhar. */
const TAMANHO_MAX_FOTO = 2 * 1024 * 1024;

interface CartaoFotoProps {
  className?: string;
  /** O selo no canto de baixo: hoje as vendas do mês; depois, o nível. */
  selo?: { valor: string; legenda: string };
}

/**
 * A foto grande da aluna, no canto esquerdo da home. Ela troca a foto ali
 * mesmo, sem ir até o perfil — a mesma rota de upload do perfil, então a foto
 * nova aparece aqui e no topo de uma vez.
 */
export default function CartaoFoto({ className, selo }: CartaoFotoProps) {
  const conta = usarConta();
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const nome = conta?.nome ?? '';
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';
  const temFoto = Boolean(conta?.avatarUrl);

  const enviar = async (arquivo: File) => {
    setErro('');
    if (arquivo.size > TAMANHO_MAX_FOTO) {
      setErro('A foto precisa ter no máximo 2 MB.');
      return;
    }

    setEnviando(true);
    try {
      const dados = new FormData();
      dados.append('avatar', arquivo);
      const res = await fetch('/api/perfil/avatar', { method: 'POST', body: dados });
      const resultado = await res.json();
      if (!res.ok) throw new Error(resultado.error || 'Erro ao enviar a foto');
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao enviar a foto');
    } finally {
      setEnviando(false);
    }
  };

  const escolher = () => entrada.current?.click();

  return (
    <section
      className={cn(
        'relative isolate flex min-h-[22rem] overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-violet-300 via-primary/40 to-fuchsia-300 shadow-soft',
        className,
      )}
    >
      {temFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={conta?.avatarUrl ?? ''}
          alt={`Foto de ${nome}`}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center gap-4 pb-20">
          <span aria-hidden className="text-8xl font-bold text-white/85">
            {inicial}
          </span>
          <button
            type="button"
            onClick={escolher}
            disabled={enviando}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-primary shadow-soft transition-colors hover:bg-white disabled:opacity-60"
          >
            {enviando ? 'Enviando...' : 'Adicionar minha foto'}
          </button>
        </div>
      )}

      {temFoto && (
        <button
          type="button"
          onClick={escolher}
          disabled={enviando}
          aria-label="Trocar foto"
          title="Trocar foto"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md transition-colors hover:bg-white/40 disabled:opacity-60"
        >
          <Camera className="h-[18px] w-[18px]" />
        </button>
      )}

      {/* Degradê só embaixo, pra o nome ler sobre qualquer foto. */}
      <div className="mt-auto flex w-full items-end justify-between gap-3 bg-gradient-to-t from-black/65 via-black/25 to-transparent p-4 pt-20">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-white">{nome}</p>
          <p className="truncate text-sm text-white/80">
            {enviando ? 'Enviando foto...' : 'Partiu PRO'}
          </p>
        </div>
        {selo && (
          <div className="shrink-0 rounded-2xl border border-white/40 bg-white/15 px-3 py-2 text-right text-white backdrop-blur-md">
            <p className="text-base font-bold leading-tight">{selo.valor}</p>
            <p className="text-[11px] text-white/80">{selo.legenda}</p>
          </div>
        )}
      </div>

      {erro && (
        <p
          role="alert"
          className="absolute inset-x-3 top-3 rounded-xl bg-red-600/90 px-3 py-2 text-xs text-white"
        >
          {erro}
        </p>
      )}

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          // Limpa já: escolher a MESMA foto de novo depois de um erro tem que
          // disparar o onChange outra vez.
          evento.target.value = '';
          if (arquivo) enviar(arquivo);
        }}
      />
    </section>
  );
}
