import { getRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server';
import { generateSlug, validateEmail, validatePhoneNumber } from '@/lib/utils';
import { TERMS_VERSION, TERMS_TEXT, MARKETING_CONSENT_VERSION } from '@/lib/legal';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { action, email, password, full_name, phone, terms_accepted, marketing_consent } = await request.json();

    const supabase = await getRouteHandlerSupabaseClient();

    if (action === 'signup') {
      // Validate inputs
      if (!validateEmail(email)) {
        return NextResponse.json(
          { error: 'E-mail inválido' },
          { status: 400 },
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Senha deve ter pelo menos 6 caracteres' },
          { status: 400 },
        );
      }

      if (terms_accepted !== true) {
        return NextResponse.json(
          { error: 'É preciso estar ciente de como os dados são tratados para criar a conta' },
          { status: 400 },
        );
      }

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 },
        );
      }

      if (!authData.user) {
        return NextResponse.json(
          { error: 'Falha ao criar usuário' },
          { status: 500 },
        );
      }

      // Generate workspace slug
      const workspaceSlug = generateSlug(full_name);

      // Create user profile — usa o cliente admin (bypassa RLS) porque
      // nesse ponto ainda não existe sessão (falta confirmar o e-mail),
      // então auth.uid() é nulo e a policy "auth.uid() = id" bloquearia
      // o insert feito com o cliente autenticado por sessão.
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert(
          {
            id: authData.user.id,
            email,
            full_name,
            workspace_slug: workspaceSlug,
          },
          { onConflict: 'id' },
        );

      if (profileError) {
        return NextResponse.json(
          { error: 'Falha ao criar perfil', details: profileError.message },
          { status: 500 },
        );
      }

      // Create default assistant settings (mesmo motivo: sem sessão ainda)
      const { error: assistantError } = await supabaseAdmin
        .from('assistant_settings')
        .insert({
          workspace_id: authData.user.id,
          name: 'Assistente',
          personality: 'Amigável, prestativo e entusiasmado em ajudar clientes a encontrar o presente perfeito.',
          system_prompt: 'Você é um assistente de vendas amigável e prestativo.',
          suggest_additionals: true,
        });

      if (assistantError) {
        console.error('Assistant settings error:', assistantError);
      }

      // Registro do aceite dos termos e, se marcado, do consentimento de
      // divulgação — mesmo motivo dos inserts acima: sem sessão ainda.
      const { error: termsError } = await supabaseAdmin.from('terms_acceptances').insert({
        user_id: authData.user.id,
        terms_version: TERMS_VERSION,
        terms_text: TERMS_TEXT,
      });

      if (termsError) {
        console.error('Terms acceptance error:', termsError);
      }

      if (marketing_consent === true) {
        const { error: consentError } = await supabaseAdmin.from('marketing_consents').upsert(
          {
            user_id: authData.user.id,
            version: MARKETING_CONSENT_VERSION,
            granted: true,
            granted_at: new Date().toISOString(),
            revoked_at: null,
          },
          { onConflict: 'user_id' },
        );

        if (consentError) {
          console.error('Marketing consent error:', consentError);
        }
      }

      return NextResponse.json(
        {
          message: 'Conta criada com sucesso',
          user: {
            id: authData.user.id,
            email: authData.user.email,
            workspace_slug: workspaceSlug,
          },
        },
        { status: 201 },
      );
    }

    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // O Supabase responde em ingles ("Invalid login credentials"), e essa
        // frase chegava crua na tela. Quem usa o sistema nao le em ingles.
        const emPortugues = /invalid login credentials/i.test(error.message)
          ? 'E-mail ou senha incorretos.'
          : /email not confirmed/i.test(error.message)
            ? 'Confirme seu e-mail antes de entrar. Procure a mensagem que enviamos no seu e-mail.'
            : error.message;

        return NextResponse.json({ error: emPortugues }, { status: 401 });
      }

      return NextResponse.json(
        {
          message: 'Login realizado com sucesso',
          user: data.user,
        },
        { status: 200 },
      );
    }

    // ============================================
    // RECUPERAR SENHA
    // ============================================
    // Sem isto, quem esquecia a senha nao tinha saida nenhuma dentro do
    // sistema: a tela de login nao oferecia caminho, e a unica forma de
    // destravar era alguem da Ponte redefinir a senha a mao no painel do
    // Supabase. Com 69 contas recem-criadas isso vira fila de suporte.
    if (action === 'recuperar') {
      if (!validateEmail(email)) {
        return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${new URL(request.url).origin}/nova-senha`,
      });

      // Responde SUCESSO mesmo quando da erro, de proposito.
      //
      // Se a resposta mudasse conforme o e-mail existir ou nao, qualquer um
      // descobriria qual e-mail tem conta aqui — e a base e de mulheres
      // empreendedoras com os dados do proprio negocio dentro. O custo e que
      // quem digitar o e-mail errado nao recebe aviso; o ganho e que a lista
      // de quem usa o sistema nao vaza pela tela de login.
      if (error) {
        console.error('Falha ao enviar e-mail de recuperação:', error.message);
      }

      return NextResponse.json(
        {
          message:
            'Se existir uma conta com esse e-mail, o link para criar uma nova senha chega em instantes.',
        },
        { status: 200 },
      );
    }

    // ============================================
    // DEFINIR A NOVA SENHA
    // ============================================
    // Roda depois que a pessoa clicou no link do e-mail: o Supabase ja criou
    // uma sessao de recuperacao, e e ela que autoriza a troca. Por isso aqui
    // NAO se pede a senha antiga — quem chegou ate aqui provou o acesso ao
    // e-mail.
    if (action === 'nova-senha') {
      if (typeof password !== 'string' || password.length < 6) {
        return NextResponse.json(
          { error: 'A senha precisa ter pelo menos 6 caracteres' },
          { status: 400 },
        );
      }

      const {
        data: { user: usuarioDaSessao },
      } = await supabase.auth.getUser();

      if (!usuarioDaSessao) {
        return NextResponse.json(
          {
            error:
              'Esse link expirou ou já foi usado. Peça um novo link na tela de login.',
          },
          { status: 401 },
        );
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ message: 'Senha alterada com sucesso' }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Ação não suportada' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}
