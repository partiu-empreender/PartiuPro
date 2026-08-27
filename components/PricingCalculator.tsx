// components/PricingCalculator.tsx
// ============================================
// CALCULADORA DE PRECIFICAÇÃO INTEGRADA
// Extraído do arquivo calculadora_precificacao_1.html
// ============================================

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type MargemType = 0.8 | 0.9 | 1.0 | 1.2;

interface PricingStep {
  id: number;
  title: string;
  icon: string;
}

const steps: PricingStep[] = [
  { id: 0, title: '1. Custo direto', icon: '💰' },
  { id: 1, title: '2. Despesas fixas', icon: '⚡' },
  { id: 2, title: '3. Margem de lucro', icon: '📈' },
  { id: 3, title: 'Calculadora', icon: '🧮' },
  { id: 4, title: 'Exemplo real', icon: '☕' },
];

const margemOpcoes = [
  { label: 'Moderada', value: 0.8 },
  { label: 'Recomendada', value: 0.9 },
  { label: 'Premium', value: 1.0 },
  { label: 'Alto valor', value: 1.2 },
];

export default function PricingCalculator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [custo, setCusto] = useState(75.16);
  const [fixoPct, setFixoPct] = useState(0.25);
  const [margem, setMargem] = useState<MargemType>(0.9);

  const calcularResultados = () => {
    const fixoVal = custo * fixoPct;
    const subtotal = custo + fixoVal;
    const margemVal = subtotal * margem;
    const precoFinal = subtotal + margemVal;

    return {
      custo: custo.toFixed(2),
      fixoVal: fixoVal.toFixed(2),
      subtotal: subtotal.toFixed(2),
      margemVal: margemVal.toFixed(2),
      precoFinal: precoFinal.toFixed(2),
      pctFixo: Math.round(fixoPct * 100),
      pctMargem: Math.round(margem * 100),
    };
  };

  const formatMoney = (value: string) => {
    return `R$ ${parseFloat(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const resultado = calcularResultados();

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(step.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              currentStep === step.id
                ? 'bg-primary text-primary-foreground'
                : 'border bg-card text-muted-foreground hover:border-primary/50'
            }`}
          >
            {step.title}
          </button>
        ))}
      </div>

      {/* STEP 0: Custo Direto */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Primeiro passo — o custo direto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quanto custa produzir esse produto? Inclui tudo, sem exceção:
            </p>
            <div className="space-y-3">
              {[
                { icon: '🍎', text: 'Alimentos e ingredientes' },
                { icon: '📦', text: 'Embalagem, caixa, bandeja' },
                { icon: '🎀', text: 'Laço, fita, celofane' },
                { icon: '🏷️', text: 'Tag, cartão, material gráfico' },
                { icon: '📫', text: 'Potinhos, saquinhos, suportes' },
                { icon: '✓', text: 'Todos os itens complementares' },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mt-4">
              <p className="text-sm text-purple-900">
                <strong>Regra:</strong> se você usou no produto, entra no custo. Até o metro de fita conta.
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setCurrentStep(1)}>
                Próximo →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 1: Despesas Fixas */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Segundo passo — despesas do negócio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gastos que mantêm sua operação funcionando:
            </p>
            <div className="space-y-3">
              {[
                { icon: '⚡', text: 'Água, luz, gás, internet' },
                { icon: '📱', text: 'Telefone, aplicativos, mensalidades' },
                { icon: '🚗', text: 'Gasolina, transporte' },
                { icon: '🧹', text: 'Material de limpeza' },
                { icon: '💵', text: 'Salário — inclusive o seu' },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
              <p className="text-sm text-yellow-900">
                <strong>Não sabe o total exato ainda?</strong> Use de 20% a 25% sobre o valor do custo direto.
                É um ponto de partida seguro até você mapear todos os seus custos fixos.
              </p>
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                ← Anterior
              </Button>
              <Button onClick={() => setCurrentStep(2)}>
                Próximo →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Margem de Lucro */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Terceiro passo — a margem de lucro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              A margem não é linear. Ela depende de três fatores:
            </p>
            <div className="space-y-3">
              {[
                { icon: '🧮', title: 'Custo:', desc: 'quanto você gastou para produzir (direto + fixos)' },
                { icon: '🏆', title: 'Posicionamento:', desc: 'como você quer ser percebida — popular, intermediária ou premium?' },
                { icon: '🔍', title: 'Mercado:', desc: 'o que as concorrentes cobram na sua região?' },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <strong className="text-sm">{item.title}</strong>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mt-4">
              <p className="text-sm text-green-900">
                Não precifique pelo que "acha que o cliente vai pagar". Precifique pelo que garante sua margem real.
                Cliente que só compra no barato não é seu cliente ideal.
              </p>
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                ← Anterior
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Calculadora →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Calculadora */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Calcule o preço do seu produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Custo direto total (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={custo}
                  onChange={(e) => setCusto(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Custo fixo
                </label>
                <select
                  value={fixoPct}
                  onChange={(e) => setFixoPct(parseFloat(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="0.20">20%</option>
                  <option value="0.25">25%</option>
                </select>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-3 font-medium">
                  Margem de lucro desejada:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {margemOpcoes.map((opcao) => (
                    <button
                      key={opcao.value}
                      onClick={() => setMargem(opcao.value as MargemType)}
                      className={`p-3 rounded-lg text-center transition-all ${
                        margem === opcao.value
                          ? 'border-2 border-primary bg-primary/10'
                          : 'border bg-muted hover:border-primary/50'
                      }`}
                    >
                      <p className="text-xs text-muted-foreground">{opcao.label}</p>
                      <p className="font-bold text-purple-700">{Math.round(opcao.value * 100)}%</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-purple-700">Custo direto</span>
                <span className="font-semibold text-purple-900">{formatMoney(resultado.custo)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-700">+ Custo fixo ({resultado.pctFixo}%)</span>
                <span className="font-semibold text-purple-900">{formatMoney(resultado.fixoVal)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-purple-200 pt-2">
                <span className="text-purple-700">Subtotal</span>
                <span className="font-semibold text-purple-900">{formatMoney(resultado.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-700">+ Margem ({resultado.pctMargem}%)</span>
                <span className="font-semibold text-purple-900">{formatMoney(resultado.margemVal)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-purple-700 pt-3">
                <span className="font-semibold text-purple-900">Preço de venda</span>
                <span className="text-2xl font-bold text-purple-900">{formatMoney(resultado.precoFinal)}</span>
              </div>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <p className="text-sm text-green-900">
                Arredonde para um valor comercialmente atraente. Ex: R$178,51 → R$179 ou R$180.
                Preço quebrado não existe no mercado de presentes.
              </p>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                ← Anterior
              </Button>
              <Button onClick={() => setCurrentStep(4)}>
                Ver exemplo →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Exemplo Real */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Exemplo real — café da manhã</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground font-medium mb-3">Custo direto detalhado:</p>
              {[
                { nome: 'Suco 300 ml', valor: 10.0 },
                { nome: 'Drip coffee', valor: 2.5 },
                { nome: 'Bolo 9 cm', valor: 3.0 },
                { nome: 'Waffle (1 un.)', valor: 2.25 },
                { nome: 'Pãozinho', valor: 2.69 },
                { nome: 'Croissant', valor: 8.9 },
                { nome: 'Dois biscoitos', valor: 1.9 },
                { nome: 'Ameixa (1 un.) + uva 100g', valor: 4.0 },
                { nome: 'Geleia artesanal 50 ml', valor: 7.0 },
                { nome: 'Queijo gouda 60g', valor: 5.7 },
                { nome: 'Peito de peru 17g', valor: 1.02 },
                { nome: 'Caixa de pinus 20x20', valor: 22.0 },
                { nome: 'Embalagens e acabamento', valor: 2.2 },
                { nome: 'Material gráfico + fita', valor: 2.4 },
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-foreground">{item.nome}</span>
                  <span className="font-semibold text-foreground">R$ {item.valor.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t font-bold text-foreground">
                <span>Custo direto</span>
                <span>R$ 75,16</span>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-purple-700">Custo direto</span>
                <span className="font-semibold">R$ 75,16</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-700">+ Custo fixo (25%)</span>
                <span className="font-semibold">R$ 18,79</span>
              </div>
              <div className="flex justify-between text-sm border-t border-purple-200 pt-2">
                <span className="text-purple-700">Subtotal</span>
                <span className="font-semibold">R$ 93,95</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-700">+ Margem (~90%)</span>
                <span className="font-semibold">R$ 85,05</span>
              </div>
              <div className="flex justify-between border-t-2 border-purple-700 pt-3">
                <span className="font-semibold text-purple-900">Preço final</span>
                <span className="text-2xl font-bold text-purple-900">R$ 179,00</span>
              </div>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <p className="text-sm text-green-900">
                R$179 é o preço com margem saudável — não é caro. É o preço justo para um produto que tem
                custo, tempo e dedicação embutidos.
              </p>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                ← Calculadora
              </Button>
              <Button onClick={() => setCurrentStep(0)}>
                Recomeçar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
