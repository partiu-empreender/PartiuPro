import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server';

const TAMANHO_MAX = 2 * 1024 * 1024; // 2 MB
const TIPOS_ACEITOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const form = await request.formData();
    const arquivo = form.get('avatar');

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Envie um arquivo de imagem' }, { status: 400 });
    }

    const extensao = TIPOS_ACEITOS[arquivo.type];
    if (!extensao) {
      return NextResponse.json(
        { error: 'Formato não aceito. Use JPG, PNG, WEBP ou GIF.' },
        { status: 400 },
      );
    }

    if (arquivo.size > TAMANHO_MAX) {
      return NextResponse.json({ error: 'A imagem precisa ter no máximo 2 MB.' }, { status: 400 });
    }

    // O caminho vem do usuário da sessão, nunca de dado enviado pelo navegador.
    const caminho = `${user.id}/avatar.${extensao}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(caminho, await arquivo.arrayBuffer(), {
        contentType: arquivo.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Erro ao enviar a imagem', details: uploadError.message },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('avatars').getPublicUrl(caminho);

    // O caminho é sempre o mesmo (upsert), então o navegador cachearia a foto
    // antiga — o parâmetro de versão força a atualização.
    const avatarUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao salvar a foto no perfil', details: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { avatar_url: avatarUrl } });
  } catch (error) {
    console.error('Erro no upload de avatar:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const caminhos = Object.values(TIPOS_ACEITOS).map((ext) => `${user.id}/avatar.${ext}`);
    await supabaseAdmin.storage.from('avatars').remove(caminhos);

    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: null })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao remover a foto', details: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Foto removida' });
  } catch (error) {
    console.error('Erro ao remover avatar:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
