'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { validateEmail } from '@/lib/utils';
import { TERMS_TEXT, TERMS_CHECKBOX_LABEL, MARKETING_CONSENT_LABEL } from '@/lib/legal';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [autorizaDivulgacao, setAutorizaDivulgacao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!fullName.trim()) {
      setError('Nome completo é obrigatório');
      setLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setError('E-mail inválido');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      setLoading(false);
      return;
    }

    if (!termosAceitos) {
      setError('É preciso estar ciente de como seus dados são tratados para criar a conta');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          email,
          password,
          full_name: fullName,
          terms_accepted: termosAceitos,
          marketing_consent: autorizaDivulgacao,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Erro ao criar conta. Tente novamente.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full rounded-3xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <span className="text-4xl">🎁</span>
        </div>
        <CardTitle>Criar Conta</CardTitle>
        <CardDescription>Comece seu negócio de presentes</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Nome Completo</label>
            <Input
              type="text"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Senha</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Confirmar Senha</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="max-h-32 overflow-y-auto rounded-lg border p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {TERMS_TEXT}
          </div>
          <p className="text-xs text-muted-foreground">
            Texto completo na{' '}
            <Link href="/politica-privacidade" target="_blank" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>

          <div className="flex items-start gap-2">
            <Checkbox
              id="termos"
              checked={termosAceitos}
              onCheckedChange={(checked) => setTermosAceitos(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="termos" className="text-sm leading-snug">
              {TERMS_CHECKBOX_LABEL}
            </label>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="divulgacao"
              checked={autorizaDivulgacao}
              onCheckedChange={(checked) => setAutorizaDivulgacao(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="divulgacao" className="text-sm leading-snug text-muted-foreground">
              {MARKETING_CONSENT_LABEL}
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Já tem conta? </span>
          <Link href="/login" className="text-primary hover:underline font-semibold">
            Faça login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
