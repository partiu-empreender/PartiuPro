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
        return NextResponse.json(
          { error: error.message },
          { status: 401 },
        );
      }

      return NextResponse.json(
        {
          message: 'Login realizado com sucesso',
          user: data.user,
        },
        { status: 200 },
      );
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
