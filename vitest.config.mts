import { defineConfig } from 'vitest/config';

/**
 * Testes só da lógica pura — datas, filtros e a geração de lembretes.
 *
 * É onde mora a regra de negócio e é o que quebra em silêncio: um filtro que
 * conta um dia a mais, um aniversário que cai no mês errado por causa de fuso.
 * Componente e rota de API não entram aqui de propósito; testá-los exigiria
 * navegador ou banco, e o retorno seria muito menor que o custo de manter.
 */
export default defineConfig({
  resolve: {
    // O mesmo `@/` do tsconfig. Sem isto, `import ... from '@/lib/datas'`
    // dentro das próprias bibliotecas não resolve.
    alias: { '@': import.meta.dirname },
  },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
