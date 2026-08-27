'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';

interface Perfil {
  full_name: string;
  email: string;
  is_admin: boolean;
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/perfil');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar perfil');
      setPerfil(result.data);
      setNome(result.data.full_name);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const cancelar = () => {
    setNome(perfil?.full_name ?? '');
    setSenha('');
    setConfirmar('');
    setErro('');
    setEditando(false);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!nome.trim() || nome.trim().length < 2) {
      setErro('Informe seu nome.');
      return;
    }
    if (senha && senha.length < 6) {
      setErro('A nova senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não conferem.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: nome.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar perfil');

      if (senha) {
        const { error } = await supabase.auth.updateUser({ password: senha });
        if (error) throw new Error(error.message);
      }

      setPerfil(result.data);
      setSenha('');
      setConfirmar('');
      setEditando(false);
      setSucesso('Perfil atualizado!');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar perfil');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-center text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="container mx-auto max-w-xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
        <p className="text-sm text-muted-foreground">Seus dados de acesso.</p>
      </div>

      {sucesso && !editando && (
        <div className="mb-4 rounded-lg border border-emerald-600 bg-emerald-600/10 p-3 text-sm text-emerald-700">
          {sucesso}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Meus dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!editando ? (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b pb-3">
                  <dt className="text-muted-foreground">Nome</dt>
                  <dd className="truncate font-bold">{perfil?.full_name}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b pb-3">
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd className="truncate font-bold">{perfil?.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="font-bold">{perfil?.is_admin ? 'Admin' : 'Aluna'}</dd>
                </div>
              </dl>
              <Button size="lg" className="w-full" onClick={() => setEditando(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar perfil
              </Button>
            </>
          ) : (
            <form onSubmit={salvar} className="space-y-4">
              {erro && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  {erro}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Nova senha (opcional)</Label>
                <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar">Confirmar nova senha</Label>
                <Input id="confirmar" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={cancelar}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/dashboard/privacidade" className="hover:underline">
          Política de privacidade, meus dados e encerramento de conta
        </Link>
      </p>
    </div>
  );
}
