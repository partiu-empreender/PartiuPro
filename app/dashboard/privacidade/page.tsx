'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { EMAIL_PRIVACIDADE } from '@/lib/legal';

interface PrivacidadeData {
  termos_aceitos: { terms_version: string; accepted_at: string } | null;
  consentimento_divulgacao: { granted: boolean; version?: string; granted_at?: string; revoked_at?: string };
}

export default function PrivacidadePage() {
  const router = useRouter();
  const [dados, setDados] = useState<PrivacidadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState('');
  const [encerrando, setEncerrando] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/privacidade');
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Erro ao carregar dados de privacidade');
        setDados(result.data);
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Erro ao carregar dados de privacidade');
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const encerrarConta = async () => {
    setEncerrando(true);
    setErro('');
    try {
      const res = await fetch('/api/privacidade/conta', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao encerrar conta');
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao encerrar conta');
      setEncerrando(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-center text-muted-foreground">Carregando...</p>;
  }

  const divulgacao = dados?.consentimento_divulgacao;
  const assuntoOposicao = encodeURIComponent('Oposição ao tratamento de dados — Partiu PRO');
  const corpoOposicao = encodeURIComponent(
    'Olá, gostaria de me opor ao tratamento dos meus dados baseado em legítimo interesse (visão consolidada do produto), conforme previsto na Política de Privacidade.',
  );
  const assuntoRevogacao = encodeURIComponent('Revogação da autorização de divulgação — Partiu PRO');
  const corpoRevogacao = encodeURIComponent(
    'Olá, gostaria de revogar a autorização que dei no cadastro pro uso dos meus dados em materiais de divulgação do Partiu PRO.',
  );

  return (
    <div className="container mx-auto max-w-xl p-6 text-sm">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Privacidade</h1>
        <p className="text-muted-foreground">Como seus dados são tratados no Partiu PRO.</p>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-destructive">
          {erro}
        </div>
      )}

      <div className="space-y-5 text-muted-foreground">
        <p>
          {dados?.termos_aceitos ? (
            <>
              Você aceitou a versão <strong className="text-foreground">{dados.termos_aceitos.terms_version}</strong> dos
              termos em {new Date(dados.termos_aceitos.accepted_at).toLocaleDateString('pt-BR')}.
            </>
          ) : (
            'Nenhum aceite de termos registrado.'
          )}{' '}
          <Link href="/politica-privacidade" target="_blank" className="text-primary hover:underline">
            Ler a política de privacidade completa
          </Link>
          .
        </p>

        <p>
          {divulgacao?.granted ? (
            <>
              Você autorizou o uso de dados reais seus (nunca de clientes) em materiais de divulgação do Partiu PRO no
              cadastro
              {divulgacao.granted_at && ` (${new Date(divulgacao.granted_at).toLocaleDateString('pt-BR')})`}. Pra
              revogar essa autorização, entre em contato:{' '}
              <a
                href={`mailto:${EMAIL_PRIVACIDADE}?subject=${assuntoRevogacao}&body=${corpoRevogacao}`}
                className="text-primary hover:underline"
              >
                {EMAIL_PRIVACIDADE}
              </a>
              .
            </>
          ) : (
            'Você não autorizou o uso dos seus dados em materiais de divulgação.'
          )}
        </p>

        <p>
          <a href="/api/privacidade/exportar" className="text-primary hover:underline">
            Baixar cópia dos meus dados
          </a>{' '}
          · <Link href="/dashboard/perfil" className="text-primary hover:underline">Corrigir meus dados</Link>{' '}
          ·{' '}
          <a
            href={`mailto:${EMAIL_PRIVACIDADE}?subject=${assuntoOposicao}&body=${corpoOposicao}`}
            className="text-primary hover:underline"
          >
            Me opor ao tratamento
          </a>
        </p>

        <p>
          <button type="button" onClick={() => setConfirmarExclusao(true)} className="text-destructive hover:underline">
            Encerrar minha conta
          </button>
        </p>
      </div>

      <Dialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar conta</DialogTitle>
            <DialogDescription>
              Essa ação é permanente e apaga todos os seus dados (produtos, vendas, atendimentos, metas). Pra
              confirmar, digite <strong>EXCLUIR</strong> abaixo.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={textoConfirmacao}
            onChange={(e) => setTextoConfirmacao(e.target.value)}
            placeholder="EXCLUIR"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarExclusao(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={textoConfirmacao !== 'EXCLUIR' || encerrando}
              onClick={encerrarConta}
            >
              {encerrando ? 'Encerrando...' : 'Encerrar conta definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
