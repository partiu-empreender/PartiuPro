'use client';

/**
 * Onde a pessoa cria a senha nova.
 *
 * POR QUE CÓDIGO DIGITADO, E NÃO SÓ O LINK
 *
 * O fluxo original era só o link do e-mail, e ele falhava de forma
 * intermitente. A causa foi confirmada em teste, com token real: um link
 * gerado há segundos, aberto num navegador limpo, já volta com
 * `otp_expired`.
 *
 * O culpado é o pré-carregamento de e-mail — clientes de e-mail e scanners de
 * segurança abrem os links sozinhos pra verificar ameaças. Como o token é de
 * USO ÚNICO, ele é gasto antes de a pessoa clicar. Aparece nos logs do
 * Supabase como um `HEAD` no link um segundo antes do `GET` de verdade.
 *
 * Nenhum código do nosso lado conserta isso: quando o request chega aqui, o
 * token já morreu. Uma aluna precisou de quatro tentativas em cinco minutos
 * até acertar a janela.
 *
 * A saída é a que a própria documentação do Supabase recomenda: mandar um
 * CÓDIGO pra pessoa digitar. Pré-carregador não digita código, então o
 * problema simplesmente deixa de existir.
 *
 * O link continua sendo aceito, para quem já tem um e-mail antigo na caixa de
 * entrada — se ele funcionar, a tela pula direto pra senha.
 *
 * Aqui NÃO se pede a senha antiga, de propósito: quem chegou até aqui provou
 * ter acesso à caixa de e-mail, que é justamente a prova que a senha antiga
 * daria — e pedi-la travaria exatamente quem esqueceu.
 */

import { useEffect, useRef, useState } from 'react';
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

/**
 * `codigo`  — pede e-mail + código de 6 dígitos. É o caminho principal.
 * `senha`   — a sessão de recuperação existe; só falta escolher a senha.
 * `salvo`   — pronto, indo pro painel.
 */
type Estado = 'verificando' | 'codigo' | 'senha' | 'salvo';

export default function NovaSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>('verificando');

  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Só pra decidir o texto de ajuda: se a pessoa veio de um link que falhou,
  // a tela explica por que, em vez de só pedir o código do nada.
  const linkFalhou = useRef(false);

  useEffect(() => {
    let ativo = true;
    let desistir: ReturnType<typeof setTimeout> | undefined;
    let cancelar: (() => void) | undefined;

    // A ASSINATURA VEM PRIMEIRO, e isso é o ponto delicado desta tela.
    //
    // O supabase-js roda com `detectSessionInUrl` ligado (o padrão): ELE
    // processa o link sozinho ao carregar — pega o `?code=` (PKCE) ou os
    // tokens do fragmento, troca por sessão e LIMPA A URL.
    //
    // Duas armadilhas já caíram aqui:
    //
    // 1. Chamar `exchangeCodeForSession` na mão competia com o SDK pelo mesmo
    //    code de uso único. A troca falhava e a tela dizia "link inválido"
    //    logo depois de o Supabase ter ACEITO o link.
    //
    // 2. Checar `getSession()` primeiro é uma corrida: se o SDK ainda não
    //    terminou, não há sessão — e olhar a URL pra decidir se vale esperar
    //    também não funciona, porque a essa altura ele JÁ a limpou. A tela
    //    caía no formulário de código com a pessoa logada, que foi exatamente
    //    o relato ("o link me joga pra tela de código").
    //
    // Assinando antes, nenhum dos dois casos escapa: se a sessão chegar
    // depois, o aviso chega aqui.
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessaoNova) => {
      if (!ativo || !sessaoNova) return;
      window.history.replaceState(null, '', window.location.pathname);
      setEstado('senha');
      clearTimeout(desistir);
    });
    cancelar = () => assinatura.subscription.unsubscribe();

    (async () => {
      const erroDoLink =
        new URLSearchParams(window.location.search).get('error_description') ||
        new URLSearchParams(window.location.hash.slice(1)).get('error_description');

      if (erroDoLink) {
        // Quase sempre `otp_expired`, do pré-carregador de e-mail. Cai no código.
        linkFalhou.current = true;
        if (ativo) setEstado('codigo');
        return;
      }

      // Talvez a sessão já exista (recarga da página, ou o SDK foi mais rápido).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!ativo) return;

      if (session) {
        window.history.replaceState(null, '', window.location.pathname);
        setEstado('senha');
        clearTimeout(desistir);
        return;
      }

      // Sem sessão ainda. Em vez de decidir agora, dá um tempo curto pro SDK
      // terminar — quem abriu a página direto (sem link) espera 1,5s e vê o
      // formulário de código, que é o caminho principal mesmo.
      desistir = setTimeout(() => {
        if (!ativo) return;
        setEstado('codigo');
      }, 1500);
    })();

    return () => {
      ativo = false;
      clearTimeout(desistir);
      cancelar?.();
    };
  }, []);

  const verificarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const limpo = codigo.replace(/\D/g, '');
    if (limpo.length !== 6) {
      setErro('O código tem 6 números.');
      return;
    }
    if (!email.trim()) {
      setErro('Informe o e-mail que recebeu o código.');
      return;
    }

    setVerificando(true);
    try {
      // `type: 'recovery'` é o que casa com o e-mail de redefinição de senha.
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: limpo,
        type: 'recovery',
      });

      if (error) {
        setErro(
          /expired|invalid/i.test(error.message)
            ? 'Código inválido ou vencido. Peça um novo e tente de novo.'
            : error.message,
        );
        return;
      }
      setEstado('senha');
    } catch {
      setErro('Não foi possível verificar o código. Tente novamente.');
    } finally {
      setVerificando(false);
    }
  };

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
          Verificando...
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

  if (estado === 'codigo') {
    return (
      <Card className="w-full rounded-3xl">
        <CardHeader className="text-center">
          <CardTitle>Digite o código</CardTitle>
          <CardDescription>
            {linkFalhou.current
              ? 'O link do e-mail não valia mais — isso acontece quando o e-mail é aberto em mais de um lugar. Use o código de 6 números que veio na mesma mensagem.'
              : 'Enviamos um código de 6 números para o seu e-mail.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={verificarCodigo} className="space-y-4">
            {erro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Seu e-mail</Label>
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

            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              {/* inputMode numérico abre o teclado de números no celular, que
                  é onde a maioria vai digitar. `one-time-code` deixa o próprio
                  sistema oferecer o código copiado do e-mail. */}
              <Input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.4em]"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>

            <Button type="submit" className="w-full" disabled={verificando}>
              {verificando ? 'Verificando...' : 'Continuar'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Não recebeu?{' '}
              <Link
                href="/recuperar-senha"
                className="font-semibold text-primary hover:underline"
              >
                Pedir outro código
              </Link>
            </p>
          </form>
        </CardContent>
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
