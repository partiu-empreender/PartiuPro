// Utilitários do CRM compartilhados entre as rotas de cliente.

export interface EtiquetaBruta {
  id: string;
  nome: string;
  cor: string;
}

/**
 * Achata as etiquetas que vêm aninhadas pela tabela de ligação.
 *
 * O tipo aqui é `unknown` de propósito. A inferência do Supabase trata a
 * relação aninhada como array (`customer_tags: Tag[]`), enquanto em tempo de
 * execução ela chega como objeto único — a ligação aponta pra exatamente uma
 * etiqueta. Em vez de forçar um cast e torcer, a função aceita as duas formas
 * e descarta o que não tiver id.
 *
 * `campo` diz de qual relação aninhada tirar a etiqueta: 'customer_tags' pras
 * etiquetas da CLIENTE, 'venda_tags' pras de OCASIÃO da venda (migration 010).
 * As duas têm a mesma forma — id, nome, cor —, então uma função só serve às
 * duas; duplicar isto seria manter dois lugares que precisam concordar sobre o
 * mesmo formato bagunçado do Supabase.
 */
export function extrairEtiquetas(
  links: unknown,
  campo: 'customer_tags' | 'venda_tags' = 'customer_tags',
): EtiquetaBruta[] {
  if (!Array.isArray(links)) return [];

  const etiquetas: EtiquetaBruta[] = [];
  for (const link of links) {
    const bruto = (link as Record<string, unknown> | null)?.[campo];
    const candidatas = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];

    for (const candidata of candidatas) {
      const tag = candidata as Partial<EtiquetaBruta> | null;
      if (tag && typeof tag.id === 'string') {
        etiquetas.push({
          id: tag.id,
          nome: typeof tag.nome === 'string' ? tag.nome : '',
          cor: typeof tag.cor === 'string' ? tag.cor : 'slate',
        });
      }
    }
  }
  return etiquetas;
}
