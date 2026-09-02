// Dinheiro digitado à mão, no formato que a Tania usa: 100.000,00.
//
// Existe por causa de um bug real. O campo de meta era <input type="number"
// step={100}> e abria preenchido com 10.000 — e o HTML valida o `step` a partir
// do valor inicial, não do zero. Digitar 100.000 caía fora da grade de passos e
// o navegador "corrigia" pro múltiplo válido mais próximo: 99.700. A aluna
// digitava cem mil e o sistema gravava noventa e nove mil e setecentos, sem
// avisar.
//
// A lição é a mesma do telefone (lib/telefone.ts): número que a pessoa digita é
// TEXTO até a hora de virar número. Quem interpreta é código nosso, que sabe
// que "100.000" em português são cem mil — e não cem, como Number() entende.

/**
 * Lê um valor em reais digitado à mão. Devolve null quando não dá pra
 * interpretar, pra quem chama decidir o que fazer — em vez de devolver 0 e
 * gravar meta zerada por causa de um campo vazio.
 *
 * Aceita as três formas que aparecem na prática:
 *   "100000"      -> 100000
 *   "100.000"     -> 100000   (ponto de milhar, não decimal)
 *   "100.000,50"  -> 100000.5
 *
 * O caso perigoso é o do meio: Number("100.000") devolve 100 em JavaScript,
 * porque o ponto é lido como decimal. Seria a meta de cem mil virando cem.
 */
export function parsearMoeda(bruto: string | number | null | undefined): number | null {
  if (typeof bruto === 'number') {
    return Number.isFinite(bruto) && bruto >= 0 ? bruto : null;
  }
  if (!bruto) return null;

  const limpo = bruto.replace(/[^\d.,-]/g, '').trim();
  if (!limpo || limpo.includes('-')) return null;

  // A vírgula é o separador decimal em português. Existindo vírgula, todo
  // ponto é milhar e some; o que vem depois da vírgula são os centavos.
  //
  // Sem vírgula, o ponto é ambíguo: "100.000" é cem mil e "100.50" seria cem e
  // cinquenta centavos. Desempatamos pelo tamanho do último grupo — separador
  // de milhar SEMPRE agrupa de três em três ("1.234.567"), então três dígitos
  // depois do último ponto significa milhar. É a mesma convenção que planilha
  // usa, e cobre o jeito que a Tania digita.
  let normalizado: string;
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = limpo.split('.');
    const ehMilhar = partes.length > 1 && partes.slice(1).every((p) => p.length === 3);
    normalizado = ehMilhar ? partes.join('') : limpo;
  }

  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0) return null;

  // Centavos e nada mais: dinheiro não tem terceira casa, e arredondar aqui
  // evita que 0.1 + 0.2 apareça numa tela de meta.
  return Math.round(numero * 100) / 100;
}

/** Formata pra leitura: R$ 100.000,00. */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Máscara progressiva, pra usar enquanto a pessoa digita.
 *
 * Só agrupa o milhar e preserva a vírgula que ela mesma digitou — não força
 * centavos nem completa nada. Forçar "0,00" no campo faria o cursor pular pra
 * depois da vírgula a cada tecla, que é o defeito clássico de campo de dinheiro
 * mascarado: a pessoa digita 100000 e sai 1.000,00.
 *
 * Como o telefone, isto é aparência. O que vai pro banco é `parsearMoeda`.
 */
export function aplicarMascaraMoeda(bruto: string | null | undefined): string {
  if (!bruto) return '';

  const limpo = bruto.replace(/[^\d,]/g, '');
  if (!limpo) return '';

  // Só a primeira vírgula conta; as outras são erro de digitação.
  const [inteira = '', ...resto] = limpo.split(',');
  const decimal = resto.join('').slice(0, 2);

  const inteiraAgrupada = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (limpo.includes(',')) return `${inteiraAgrupada},${decimal}`;
  return inteiraAgrupada;
}
