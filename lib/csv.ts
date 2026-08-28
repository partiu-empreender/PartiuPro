// Leitura e escrita de CSV para importar/exportar a base de clientes.
//
// Escrito à mão em vez de adicionar uma biblioteca: o formato aqui é uma
// planilha simples exportada do Excel ou do Google Sheets, e um parser de 40
// linhas cobre isso sem trazer dependência nova pro projeto.

/** Uma linha da planilha, já com os cabeçalhos como chave. */
export type LinhaCSV = Record<string, string>;

/**
 * Descobre se a planilha usa vírgula ou ponto e vírgula.
 *
 * Aceitar os dois ao mesmo tempo parece tolerante, mas corrompe dados: numa
 * planilha separada por ponto e vírgula, um campo de etiquetas como
 * "VIP, Natal" seria partido ao meio e empurraria todas as colunas seguintes
 * pra posição errada — o contexto do cliente acabaria dentro da coluna de
 * etiquetas. Peguei exatamente isso testando.
 *
 * A contagem é feita só no cabeçalho e ignora o que está entre aspas.
 */
function detectarSeparador(primeiraLinha: string): ',' | ';' {
  let virgulas = 0;
  let pontoEVirgula = 0;
  let dentroDeAspas = false;

  for (const char of primeiraLinha) {
    if (char === '"') dentroDeAspas = !dentroDeAspas;
    else if (!dentroDeAspas && char === ',') virgulas++;
    else if (!dentroDeAspas && char === ';') pontoEVirgula++;
  }

  return pontoEVirgula > virgulas ? ';' : ',';
}

/**
 * Divide o texto do CSV respeitando aspas.
 *
 * As aspas importam de verdade: um contexto como
 *   "Comprou cesta de maternidade, adorou"
 * tem vírgula DENTRO do campo. Um split ingênuo quebraria a linha em duas
 * colunas e jogaria metade do texto pra coluna errada.
 */
function dividirLinhas(texto: string, separador: ',' | ';'): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroDeAspas = false;

  // Remove o BOM que o Excel escreve no início do arquivo. Sem isso, o
  // primeiro cabeçalho vira "\uFEFFnome" e nunca casa com "nome".
  const conteudo = texto.replace(/^\uFEFF/, '');

  for (let i = 0; i < conteudo.length; i++) {
    const char = conteudo[i];

    if (dentroDeAspas) {
      if (char === '"') {
        // Aspas duplicadas ("") são uma aspa literal dentro do campo.
        if (conteudo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campo += char;
      }
      continue;
    }

    if (char === '"') {
      dentroDeAspas = true;
    } else if (char === separador) {
      linha.push(campo.trim());
      campo = '';
    } else if (char === '\n') {
      linha.push(campo.trim());
      linhas.push(linha);
      linha = [];
      campo = '';
    } else if (char !== '\r') {
      campo += char;
    }
  }

  if (campo || linha.length > 0) {
    linha.push(campo.trim());
    linhas.push(linha);
  }

  return linhas.filter((l) => l.some((c) => c !== ''));
}

/** Tira acento, espaço e pontuação pra comparar cabeçalhos. */
function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Nomes que a Tania (ou a planilha que ela já tem) pode ter usado. A ideia é
// ela não precisar reformatar nada: se o cabeçalho for reconhecível, entra.
const SINONIMOS: Record<string, string[]> = {
  nome: ['nome', 'cliente', 'nomecliente', 'nomecompleto', 'name'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'numero', 'phone'],
  email: ['email', 'mail'],
  aniversario: ['aniversario', 'nascimento', 'datanascimento', 'datadenascimento', 'dtnascimento'],
  etiquetas: ['etiquetas', 'etiqueta', 'tags', 'tag', 'marcadores', 'categoria', 'categorias'],
  contexto: ['contexto', 'observacoes', 'observacao', 'obs', 'notas', 'nota', 'anotacoes', 'historico'],
};

function campoCanonico(cabecalho: string): string | null {
  const normalizado = normalizarCabecalho(cabecalho);
  for (const [canonico, variacoes] of Object.entries(SINONIMOS)) {
    if (variacoes.includes(normalizado)) return canonico;
  }
  return null;
}

export interface ResultadoLeitura {
  linhas: LinhaCSV[];
  /** Cabeçalhos que não foram reconhecidos — avisados na tela, não descartados em silêncio. */
  colunasIgnoradas: string[];
  temColunaNome: boolean;
}

export function lerCSV(texto: string): ResultadoLeitura {
  const semBOM = texto.replace(/^\uFEFF/, '');
  const separador = detectarSeparador(semBOM.split('\n')[0] ?? '');
  const linhas = dividirLinhas(semBOM, separador);
  if (linhas.length === 0) {
    return { linhas: [], colunasIgnoradas: [], temColunaNome: false };
  }

  const cabecalhos = linhas[0] ?? [];
  const colunasIgnoradas: string[] = [];
  const mapa = cabecalhos.map((cabecalho) => {
    const canonico = campoCanonico(cabecalho);
    if (!canonico && cabecalho) colunasIgnoradas.push(cabecalho);
    return canonico;
  });

  const registros: LinhaCSV[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const valores = linhas[i] ?? [];
    const registro: LinhaCSV = {};
    mapa.forEach((canonico, coluna) => {
      if (canonico) registro[canonico] = valores[coluna] ?? '';
    });
    if (registro.nome) registros.push(registro);
  }

  return {
    linhas: registros,
    colunasIgnoradas,
    temColunaNome: mapa.includes('nome'),
  };
}

/** Escapa um valor para CSV. */
function escapar(valor: string | null | undefined): string {
  const texto = valor ?? '';
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Gera o arquivo que a aluna abre no Excel ou no Google Sheets.
 *
 * Separador PONTO E VÍRGULA de propósito. O Excel usa o separador de listas do
 * Windows, e no Brasil ele é `;` — com vírgula, o arquivo abre com tudo
 * empilhado na coluna A, que é justamente onde ela vai abrir. O Google Sheets
 * detecta sozinho, então não perde nada. E a leitura aqui aceita os dois.
 *
 * O BOM no início faz o Excel abrir a acentuação certa; sem ele, "aniversário"
 * vira "aniversÃ¡rio". Na volta, `lerCSV` remove.
 */
export function gerarCSV(
  cabecalhos: string[],
  linhas: (string | null | undefined)[][],
  separador: ',' | ';' = ';',
): string {
  const corpo = [cabecalhos, ...linhas]
    .map((linha) => linha.map(escapar).join(separador))
    .join('\r\n');
  return `\uFEFF${corpo}`;
}

/**
 * Converte data em texto para YYYY-MM-DD.
 * Aceita 25/12/1990 e 1990-12-25. Devolve null se não reconhecer — data
 * inválida não pode derrubar a importação inteira.
 */
export function lerData(texto: string | undefined): string | null {
  if (!texto?.trim()) return null;
  const valor = texto.trim();

  const brasileira = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brasileira) {
    const [, dia, mes, ano] = brasileira;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  return null;
}

/** "VIP; Natal" ou "VIP, Natal" -> ['VIP', 'Natal'] */
export function lerEtiquetas(texto: string | undefined): string[] {
  if (!texto?.trim()) return [];
  return texto
    .split(/[;,|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// Cabeçalhos do arquivo de clientes. São os mesmos que o importador reconhece,
// então o que sai da exportação volta sem edição nenhuma — e o modelo em
// branco nasce igual ao arquivo real.
//
// Ficam aqui, e não na rota de exportar, porque a tela precisa deles pra
// montar o modelo no navegador — e importar um route.ts pro cliente traria
// código de servidor junto.
export const CABECALHOS_CLIENTES = [
  'nome',
  'telefone',
  'email',
  'aniversario',
  'etiquetas',
  'contexto',
];

/**
 * Linhas de exemplo do modelo.
 *
 * Elas ensinam o formato — data em DD/MM/AAAA, etiquetas separadas por ponto
 * e virgula, coluna vazia quando nao ha o dado. Mas exemplo dentro do arquivo
 * vira cliente de mentira na base se ninguem apagar, entao o nome anuncia o
 * que a linha e. Se escapar, aparece assim mesmo na tela de conferencia, que
 * e obrigatoria antes de gravar.
 *
 * A segunda linha existe pra mostrar que so nome e telefone ja bastam.
 */
export const LINHAS_EXEMPLO_CLIENTES: string[][] = [
  [
    'EXEMPLO 1 - apague esta linha',
    '(21) 99999-8888',
    'maria@email.com',
    '25/12/1990',
    'Cliente VIP; Dia das Mães',
    'Prefere receber à tarde. Comprou cesta de café da manhã.',
  ],
  ['EXEMPLO 2 - apague esta linha', '(11) 3333-4444', '', '', '', ''],
];
