import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { generateSlug, validateEmail, validatePhoneNumber } from '@/lib/utils';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { action, email, password, full_name, phone } = await request.json();

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

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          full_name,
          workspace_slug: workspaceSlug,
        });

      if (profileError) {
        return NextResponse.json(
          { error: 'Falha ao criar perfil' },
          { status: 500 },
        );
      }

      // Create default assistant settings
      const { error: assistantError } = await supabase
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
