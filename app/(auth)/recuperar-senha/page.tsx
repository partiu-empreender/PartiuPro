'use client';

/**
 * "Esqueci minha senha" — o caminho de volta.
 *
 * Não existia. Quem esquecia a senha ficava sem saída nenhuma dentro do
 * sistema: a tela de login não oferecia caminho, e destravar exigia alguém da
 * Ponte redefinir a senha à mão no painel do Supabase. Com 69 contas
 * recém-criadas, isso viraria fila de suporte — e foi exatamente o que
 * aconteceu com a própria conta administradora.
 */

import { useState } from 'react';
import Link from 'next/link';
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
import { MailCheck } from 'lucide-react';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const pedirLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recuperar', email }),
      });
      const result = await res.json();

      if (!res.ok) {
        setErro(result.error || 'Não foi possível enviar o e-mail. Tente novamente.');
        return;
      }
      setEnviado(true);
    } catch {
      setErro('Não foi possível enviar o e-mail. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // Confirmação. Não diz "enviamos pra você" e sim "se existir uma conta":
  // a resposta é a mesma para e-mail cadastrado ou não, senão esta tela vira
  // um jeito de descobrir quem tem conta aqui.
  if (enviado) {
    return (
      <Card className="w-full rounded-3xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-7 w-7 text-primary" />
            </span>
          </div>
          <CardTitle>Confira seu e-mail</CardTitle>
          <CardDescription>
            Se existir uma conta com <strong>{email}</strong>, o link para criar uma nova
            senha chega em instantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O link vale por uma hora. Não achou? Veja também a caixa de spam.
          </p>
          {/* Link com cara de botão via buttonVariants: o Button daqui não
              tem `asChild`, e aninhar <a> dentro de <button> seria inválido. */}
          <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
            Voltar para entrar
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full rounded-3xl">
      <CardHeader className="text-center">
        <CardTitle>Esqueci minha senha</CardTitle>
        <CardDescription>
          Digite seu e-mail e enviamos um link para você criar uma nova.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={pedirLink} className="space-y-4">
          {erro && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {erro}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar link'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
