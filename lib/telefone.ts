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
