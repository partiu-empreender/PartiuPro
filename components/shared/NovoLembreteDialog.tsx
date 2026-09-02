'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { hojeBrasil, somarDias } from '@/lib/datas';
import type { NovoLembrete } from '@/lib/usar-lembretes';

interface ClienteSimples {
  id: string;
  name: string;
}

/** Atalhos de data. Digitar "daqui a uma semana" num campo de data é o tipo de
 *  atrito que faz a pessoa desistir de criar o lembrete. */
const ATALHOS = [
  { rotulo: 'Hoje', dias: 0 },
  { rotulo: 'Amanhã', dias: 1 },
  { rotulo: 'Em 1 semana', dias: 7 },
  { rotulo: 'Em 1 mês', dias: 30 },
];

export default function NovoLembreteDialog({
  aberto,
  onOpenChange,
  onCriar,
  clienteFixo,
  clientes = [],
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  onCriar: (novo: NovoLembrete) => Promise<void>;
  /** Quando o lembrete já nasce ligado a alguém — o caso da ficha da cliente. */
  clienteFixo?: ClienteSimples;
  clientes?: ClienteSimples[];
}) {
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState(hojeBrasil());
  const [observacao, setObservacao] = useState('');
  const [clienteId, setClienteId] = useState(clienteFixo?.id ?? '');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const clienteEscolhido = clientes.find((c) => c.id === clienteId);

  // Uma lista rolável com trinta nomes já é pior que digitar três letras, e a
  // base de algumas alunas vai passar disso. Mostra no máximo oito: mais que
  // isso vira rolagem dentro de um diálogo, que no celular é um inferno.
  const sugestoes = buscaCliente.trim()
    ? clientes
        .filter((c) => c.name.toLowerCase().includes(buscaCliente.trim().toLowerCase()))
        .slice(0, 8)
    : clientes.slice(0, 8);

  // Reabrir o diálogo tem que dar uma folha em branco: sem isto, o texto do
  // lembrete anterior ainda estaria lá no próximo.
  useEffect(() => {
    if (aberto) {
      setTitulo('');
      setData(hojeBrasil());
      setObservacao('');
      setClienteId(clienteFixo?.id ?? '');
      setBuscaCliente('');
      setErro('');
    }
  }, [aberto, clienteFixo?.id]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro('Escreva do que é o lembrete.');
      return;
    }

    setSalvando(true);
    try {
      await onCriar({
        customer_id: clienteId || null,
        data,
        titulo: titulo.trim(),
        observacao: observacao.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar lembrete');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lembrete</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          {erro && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {erro}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lembrete-titulo">
              O que lembrar <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lembrete-titulo"
              value={titulo}
              placeholder="Ligar pra Ana sobre a cesta do casamento"
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lembrete-data">Quando</Label>
            <Input
              id="lembrete-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {ATALHOS.map((atalho) => {
                // O atalho fica marcado quando a data escolhida é a dele.
                // Antes eles não tinham estado nenhum: clicar em "Hoje" mudava
                // o campo de data e o botão continuava igual aos outros, então
                // não dava pra saber se o clique tinha pegado.
                const dataDoAtalho = somarDias(hojeBrasil(), atalho.dias);
                const marcado = data === dataDoAtalho;

                return (
                  <Button
                    key={atalho.rotulo}
                    type="button"
                    variant={marcado ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={marcado}
                    onClick={() => setData(dataDoAtalho)}
                  >
                    {atalho.rotulo}
                  </Button>
                );
              })}
            </div>
          </div>

          {clienteFixo ? (
            <p className="text-xs text-muted-foreground">
              Ligado a <strong>{clienteFixo.name}</strong>.
            </p>
          ) : (
            clientes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="lembrete-cliente">Sobre qual cliente</Label>

                {clienteEscolhido ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                    <span className="truncate font-medium">{clienteEscolhido.name}</span>
                    <button
                      type="button"
                      onClick={() => setClienteId('')}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="sr-only">Tirar a cliente do lembrete</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="lembrete-cliente"
                      value={buscaCliente}
                      placeholder="Digite o nome pra procurar..."
                      onChange={(e) => setBuscaCliente(e.target.value)}
                    />
                    {sugestoes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sugestoes.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => setClienteId(cliente.id)}
                            className="rounded-full border border-input bg-white/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            {cliente.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma cliente com esse nome.
                      </p>
                    )}
                  </>
                )}

                <p className="text-xs text-muted-foreground">
                  Ligando a uma cliente, o lembrete aparece na ficha dela e ganha o botão do
                  WhatsApp. Deixando em branco, ele fica solto na sua agenda.
                </p>
              </div>
            )
          )}

          <div className="space-y-2">
            <Label htmlFor="lembrete-observacao">Observação</Label>
            <textarea
              id="lembrete-observacao"
              rows={2}
              className="flex w-full rounded-xl border border-input bg-white/70 px-4 py-2 text-sm backdrop-blur-md transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Ela pediu pra confirmar o sabor uma semana antes."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Criar lembrete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
