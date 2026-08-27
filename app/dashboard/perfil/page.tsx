'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Pencil, Trash2 } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';

interface Perfil {
  full_name: string;
  email: string;
  is_admin: boolean;
  avatar_url: string | null;
}

export default function PerfilPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);

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

  const enviarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite reenviar o mesmo arquivo depois
    if (!arquivo) return;

    setErro('');
    setSucesso('');

    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem (JPG, PNG, WEBP ou GIF).');
      return;
    }
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro('A imagem precisa ter no máximo 2 MB.');
      return;
    }

    setEnviandoFoto(true);
    try {
      const dados = new FormData();
      dados.append('avatar', arquivo);
      const res = await fetch('/api/perfil/avatar', { method: 'POST', body: dados });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao enviar a foto');

      setPerfil((atual) => (atual ? { ...atual, avatar_url: result.data.avatar_url } : atual));
      setSucesso('Foto atualizada!');
      router.refresh(); // atualiza a foto na navbar
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao enviar a foto');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = async () => {
    setErro('');
    setSucesso('');
    setEnviandoFoto(true);
    try {
      const res = await fetch('/api/perfil/avatar', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao remover a foto');

      setPerfil((atual) => (atual ? { ...atual, avatar_url: null } : atual));
      setSucesso('Foto removida.');
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao remover a foto');
    } finally {
      setEnviandoFoto(false);
    }
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
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar perfil');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <PageShell width="narrow">
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      </PageShell>
    );
  }

  const inicial = (perfil?.full_name || '?').trim().charAt(0).toUpperCase();

  return (
    <PageShell width="narrow">
      <PageHeader title="Perfil" description="Seus dados de acesso." />

      {sucesso && (
        <div className="rounded-lg border border-emerald-600 bg-emerald-600/10 p-3 text-sm text-emerald-700">
          {sucesso}
        </div>
      )}
      {erro && !editando && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          {perfil?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.avatar_url}
              alt="Sua foto de perfil"
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {inicial}
            </span>
          )}

          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              disabled={enviandoFoto}
              onClick={() => inputFoto.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              {enviandoFoto ? 'Enviando...' : perfil?.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
            </Button>
            {perfil?.avatar_url && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                disabled={enviandoFoto}
                onClick={removerFoto}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remover
              </Button>
            )}
            <input
              ref={inputFoto}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={enviarFoto}
            />
          </div>
        </CardContent>
      </Card>

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

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/dashboard/privacidade" className="hover:underline">
          Política de privacidade, meus dados e encerramento de conta
        </Link>
      </p>
    </PageShell>
  );
}
