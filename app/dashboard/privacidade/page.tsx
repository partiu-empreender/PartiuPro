'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { EMAIL_PRIVACIDADE } from '@/lib/legal';

interface AcessoLog {
  id: string;
  reason: string;
  accessed_at: string;
}

interface PrivacidadeData {
  termos_aceitos: { terms_version: string; accepted_at: string } | null;
  consentimento_divulgacao: { granted: boolean; version?: string; granted_at?: string; revoked_at?: string };
  historico_acessos: AcessoLog[];
}

export default function PrivacidadePage() {
  const router = useRouter();
  const [dados, setDados] = useState<PrivacidadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState('');
  const [encerrando, setEncerrando] = useState(false);

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

  useEffect(() => {
    carregar();
  }, []);

  const alternarDivulgacao = async (novoValor: boolean) => {
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const res = await fetch('/api/privacidade', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketing_consent: novoValor }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao atualizar autorização');
      setSucesso(result.message);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar autorização');
    } finally {
      setSalvando(false);
    }
  };

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

  const divulgacaoAtiva = dados?.consentimento_divulgacao?.granted ?? false;
  const assuntoOposicao = encodeURIComponent('Oposição ao tratamento de dados — Partiu PRO');
  const corpoOposicao = encodeURIComponent(
    'Olá, gostaria de me opor ao tratamento dos meus dados baseado em legítimo interesse (visão consolidada do produto), conforme previsto na Política de Privacidade.',
  );

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Privacidade</h1>
        <p className="text-sm text-muted-foreground">Como seus dados são tratados no Partiu PRO.</p>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mb-4 rounded-lg border border-emerald-600 bg-emerald-600/10 p-3 text-sm text-emerald-700">
          {sucesso}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Termos aceitos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {dados?.termos_aceitos ? (
              <p>
                Versão <strong>{dados.termos_aceitos.terms_version}</strong>, aceita em{' '}
                {new Date(dados.termos_aceitos.accepted_at).toLocaleDateString('pt-BR')}.
              </p>
            ) : (
              <p className="text-muted-foreground">Nenhum aceite registrado.</p>
            )}
            <p className="mt-2">
              <Link href="/politica-privacidade" target="_blank" className="text-primary hover:underline">
                Ler a Política de Privacidade completa
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso da plataforma em divulgação</CardTitle>
            <CardDescription>
              Autoriza usar dados reais seus (nunca de clientes) em fotos, vídeos ou capturas de tela pra divulgar o
              Partiu PRO. Não afeta seu acesso à ferramenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {divulgacaoAtiva ? 'Autorização concedida' : 'Autorização não concedida'}
            </span>
            <Button
              variant={divulgacaoAtiva ? 'outline' : 'default'}
              disabled={salvando}
              onClick={() => alternarDivulgacao(!divulgacaoAtiva)}
            >
              {divulgacaoAtiva ? 'Retirar autorização' : 'Conceder autorização'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de acessos da equipe</CardTitle>
            <CardDescription>Toda vez que a equipe abre o detalhe dos seus dados, fica registrado aqui.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!dados?.historico_acessos.length ? (
              <p className="text-sm text-muted-foreground">Nenhum acesso registrado.</p>
            ) : (
              dados.historico_acessos.map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                  <span>{log.reason}</span>
                  <span className="text-muted-foreground">
                    {new Date(log.accessed_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seus dados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <a href="/api/privacidade/exportar" className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
              Baixar cópia dos meus dados
            </a>
            <Link href="/dashboard/perfil" className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
              Corrigir meus dados
            </Link>
            <a
              href={`mailto:${EMAIL_PRIVACIDADE}?subject=${assuntoOposicao}&body=${corpoOposicao}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}
            >
              Me opor ao tratamento
            </a>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Encerrar conta</CardTitle>
            <CardDescription>
              Apaga permanentemente sua conta e todos os seus dados (produtos, vendas, atendimentos, metas). Não tem
              como desfazer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setConfirmarExclusao(true)}>
              Encerrar minha conta
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar conta</DialogTitle>
            <DialogDescription>
              Essa ação é permanente. Pra confirmar, digite <strong>EXCLUIR</strong> abaixo.
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
