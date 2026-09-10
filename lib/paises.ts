/**
 * DDI dos países, com o Brasil como padrão.
 *
 * POR QUE ISTO EXISTE, E O CUIDADO QUE ELE CARREGA
 *
 * O sistema nasceu assumindo Brasil em dois lugares que se contradizem:
 * `normalizarTelefone` REMOVE o 55 ao gravar, e `linkWhatsApp` CRAVA o 55 ao
 * montar o link. Funciona perfeitamente enquanto todo mundo é brasileiro — e
 * perde o número inteiro no primeiro cadastro estrangeiro, porque o DDI some
 * na gravação e um 55 errado entra na hora de conversar.
 *
 * A saída é guardar o DDI ao lado do número, em vez de embutido nele: o
 * telefone continua sendo só dígitos nacionais (a chave de deduplicação não
 * muda, e nenhum cadastro existente precisa ser migrado), e o país vira um
 * campo próprio com '55' de default.
 *
 * A lista é curta de propósito: os países onde a clientela brasileira de fato
 * tem parentes e amigos. Uma lista com os 195 do mundo transformaria o caso
 * comum — Brasil — numa busca dentro de um seletor gigante.
 */

export interface Pais {
  /** DDI, só dígitos, sem o '+'. */
  ddi: string;
  nome: string;
  /** Bandeira em emoji: identifica mais rápido que o texto num seletor. */
  bandeira: string;
}

export const PAIS_PADRAO = '55';

export const PAISES: Pais[] = [
  { ddi: '55', nome: 'Brasil', bandeira: '🇧🇷' },
  { ddi: '351', nome: 'Portugal', bandeira: '🇵🇹' },
  { ddi: '1', nome: 'Estados Unidos / Canadá', bandeira: '🇺🇸' },
  { ddi: '44', nome: 'Reino Unido', bandeira: '🇬🇧' },
  { ddi: '34', nome: 'Espanha', bandeira: '🇪🇸' },
  { ddi: '39', nome: 'Itália', bandeira: '🇮🇹' },
  { ddi: '33', nome: 'França', bandeira: '🇫🇷' },
  { ddi: '49', nome: 'Alemanha', bandeira: '🇩🇪' },
  { ddi: '353', nome: 'Irlanda', bandeira: '🇮🇪' },
  { ddi: '41', nome: 'Suíça', bandeira: '🇨🇭' },
  { ddi: '61', nome: 'Austrália', bandeira: '🇦🇺' },
  { ddi: '81', nome: 'Japão', bandeira: '🇯🇵' },
  { ddi: '54', nome: 'Argentina', bandeira: '🇦🇷' },
  { ddi: '598', nome: 'Uruguai', bandeira: '🇺🇾' },
  { ddi: '595', nome: 'Paraguai', bandeira: '🇵🇾' },
  { ddi: '56', nome: 'Chile', bandeira: '🇨🇱' },
];

/** Aceita só DDI que existe na lista. Qualquer outra coisa vira Brasil. */
export function normalizarDDI(bruto: string | null | undefined): string {
  if (!bruto) return PAIS_PADRAO;
  const digitos = String(bruto).replace(/\D/g, '');
  return PAISES.some((p) => p.ddi === digitos) ? digitos : PAIS_PADRAO;
}

export function nomeDoPais(ddi: string): string {
  return PAISES.find((p) => p.ddi === normalizarDDI(ddi))?.nome ?? 'Brasil';
}

/**
 * Link de WhatsApp respeitando o país.
 *
 * Substitui o `linkWhatsApp` de lib/telefone.ts nos lugares que conhecem o
 * DDI. Onde o DDI não existe (cadastros antigos), o default '55' devolve
 * exatamente o comportamento de antes — nenhum link brasileiro muda.
 */
export function linkWhatsAppComPais(
  telefoneSoDigitos: string | null | undefined,
  ddi: string | null | undefined,
): string | null {
  const numero = (telefoneSoDigitos || '').replace(/\D/g, '');
  if (numero.length < 8) return null;
  return `https://wa.me/${normalizarDDI(ddi)}${numero}`;
}
