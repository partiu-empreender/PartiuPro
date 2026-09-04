'use client';

/**
 * A tela para onde o link do e-mail aponta.
 *
 * Quando a pessoa clica no link, o Supabase abre uma sessão de recuperação e
 * devolve os tokens no FRAGMENTO da URL (#access_token=...), não na query.
 * Fragmento não chega ao servidor — só o navegador o enxerga —, e é por isso
 * que esta tela é client-side e chama `setSession` na mão: sem esse passo o
 * link abriria uma tela deslogada e a troca de senha falharia sem explicação.
 *
 * Aqui NÃO se pede a senha antiga, de propósito: quem chegou até aqui provou
 * ter acesso à caixa de e-mail, que é justamente a prova que a senha antiga
 * daria — e pedi-la travaria exatamente quem esqueceu.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Estado = 'verificando' | 'pronto' | 'link_invalido' | 'salvo';

export default function NovaSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;

    (async () => {
      // 1. O caminho normal: tokens no fragmento da URL.
      const fragmento = new URLSearchParams(window.location.hash.slice(1));
      const access_token = fragmento.get('access_token');
      const refresh_token = fragmento.get('refresh_token');
      const erroDoLink = fragmento.get('error_description');

      if (erroDoLink) {
        if (ativo) setEstado('link_invalido');
        return;
      }

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!ativo) return;
        if (error) {
          setEstado('link_invalido');
          return;
        }
        // Tira os tokens da barra de endereço: eles dão acesso à conta e não
        // devem sobrar no histórico do navegador nem num print de tela.
        window.history.replaceState(null, '', window.location.pathname);
        setEstado('pronto');
        return;
      }

      // 2. Sem fragmento: pode ser que a sessão já tenha sido criada (recarga
      //    da página depois do passo acima). Vale checar antes de recusar.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!ativo) return;
      setEstado(session ? 'pronto' : 'link_invalido');
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.');
      return;
    }

    setSalvando(true);
    try {
      // updateUser pelo cliente do navegador, que é quem tem a sessão de
      // recuperação viva neste momento.
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setErro(
          /New password should be different/i.test(error.message)
            ? 'A nova senha precisa ser diferente da anterior.'
            : error.message,
        );
        return;
      }
      setEstado('salvo');
      // Leva pro painel: a sessão já está válida, não faz sentido pedir login
      // logo depois de ela provar quem é.
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1600);
    } catch {
      setErro('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (estado === 'verificando') {
    return (
      <Card className="w-full rounded-3xl">
        <CardContent className="py-12 text-center text-muted-foreground">
          Verificando o link...
        </CardContent>
      </Card>
    );
  }

  if (estado === 'link_invalido') {
    return (
      <Card className="w-full rounded-3xl">
        <CardHeader className="text-center">
          <CardTitle>Esse link não vale mais</CardTitle>
          <CardDescription>
            Links de recuperação valem por uma hora e só podem ser usados uma vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* buttonVariants em vez de <Button asChild>: este Button não
              suporta asChild, e <a> dentro de <button> é markup inválido. */}
          <Link href="/recuperar-senha" className={buttonVariants({ className: 'w-full' })}>
            Pedir um link novo
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: 'outline', className: 'w-full' })}
          >
            Voltar para entrar
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (estado === 'salvo') {
    return (
      <Card className="w-full rounded-3xl">
        <CardHeader className="text-center">
          <CardTitle>Senha alterada 🎉</CardTitle>
          <CardDescription>Levando você para o painel...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full rounded-3xl">
      <CardHeader className="text-center">
        <CardTitle>Criar nova senha</CardTitle>
        <CardDescription>Escolha uma senha de pelo menos 6 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="space-y-4">
          {erro && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {erro}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacao">Repita a nova senha</Label>
            <Input
              id="confirmacao"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
