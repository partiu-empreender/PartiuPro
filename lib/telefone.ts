// Telefone é a chave que evita cliente duplicado: o banco tem
// UNIQUE(workspace_id, phone), e é por ele que a venda encontra a cliente já
// cadastrada e que a importação de CSV decide entre criar e atualizar.
//
// Por isso o telefone é SEMPRE guardado só com dígitos. Se um cadastro salvar
// "(21) 99999-8888" e outro "21999998888", o banco entende como duas pessoas
// diferentes e a Tania acaba com a mesma cliente duas vezes na lista — que é
// exatamente o problema que o CRM existe pra resolver.
//
// A formatação bonita é feita só na hora de exibir.

/** Só os dígitos. Devolve null quando não sobra nada — a coluna aceita nulo. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let digitos = bruto.replace(/\D/g, '');

  // Código do país digitado junto (5521999998888). Tiramos pra que o mesmo
  // número não vire dois cadastros dependendo de como foi digitado.
  if (digitos.length > 11 && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }

  return digitos.length > 0 ? digitos : null;
}

/** Formata pra leitura: (21) 99999-8888. Devolve o original se não reconhecer. */
export function formatarTelefone(telefone: string | null | undefined): string {
  const digitos = normalizarTelefone(telefone);
  if (!digitos) return '';

  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return digitos;
}

/** Link de conversa no WhatsApp, com código do país. Null se o número não parecer válido. */
export function linkWhatsApp(telefone: string | null | undefined): string | null {
  const digitos = normalizarTelefone(telefone);
  if (!digitos || digitos.length < 10) return null;
  return `https://wa.me/55${digitos}`;
}

/**
 * O mesmo link, já com o começo da mensagem escrito.
 *
 * A tela de clientes existe pra produzir listas de quem chamar. Sem isto, o
 * caminho era: filtrar, abrir a ficha, voltar, abrir a próxima — e escrever
 * "oi" vinte vezes. O texto é rascunho: o WhatsApp abre com ele preenchido e
 * ela edita antes de enviar.
 */
export function linkWhatsAppCom(
  telefone: string | null | undefined,
  texto: string,
): string | null {
  const base = linkWhatsApp(telefone);
  if (!base) return null;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

/** "Oi, Ana!" — só o primeiro nome, que é como se fala no WhatsApp. */
export function saudacao(nomeCompleto: string): string {
  const primeiro = (nomeCompleto || '').trim().split(/\s+/)[0];
  return primeiro ? `Oi, ${primeiro}!` : 'Oi!';
}

/**
 * Máscara progressiva, pra usar enquanto a pessoa digita:
 * (21) 9999-8888 até 10 dígitos, (21) 99999-8888 a partir de 11.
 *
 * Formata o que já foi digitado sem esperar o número ficar completo, e para
 * em 11 dígitos — digitar o 12º simplesmente não faz nada, em vez de
 * desmontar a máscara.
 *
 * O que vai pro banco continua sendo `normalizarTelefone`, só dígitos: a
 * máscara é aparência, não dado.
 */
export function aplicarMascaraTelefone(bruto: string | null | undefined): string {
  const digitos = (normalizarTelefone(bruto) ?? '').slice(0, 11);

  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);

  // Celular (9 dígitos) quebra em 5+4; fixo (8) quebra em 4+4.
  const tamanhoDoPrefixo = resto.length > 8 ? 5 : 4;

  if (resto.length <= tamanhoDoPrefixo) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, tamanhoDoPrefixo)}-${resto.slice(tamanhoDoPrefixo)}`;
}
