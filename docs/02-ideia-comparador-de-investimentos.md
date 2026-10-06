# Ideia: comparador de investimentos

Status: [ideia] — origem: dor pessoal do autor.

## Dor

Ao abrir a corretora para comprar, por exemplo, um CDB, há dezenas de opções. Fica a dúvida de qual escolher, e coisas importantes passam batido: liquidez, quando o dinheiro poderá ser retirado, se a taxa é plausível, se o emissor é confiável, se há pegadinhas.

## Solução

O usuário envia as opções (print, texto, lista, CSV) e a IA:

1. **Extrai** os dados de cada opção.
2. **Normaliza** para comparar de verdade (ex.: tudo em taxa líquida a.a. equivalente, após IR, para o mesmo prazo).
3. **Compara** lado a lado.
4. **Alerta** pontos de atenção.
5. **Cruza com a carteira do usuário** (já tem muito desse emissor? precisa de liquidez? qual o objetivo?).
6. **Recomenda** com justificativa e mostra o raciocínio.

## O que checar em renda fixa (CDB, LCI/LCA, LC, debêntures, CRI/CRA)

- **Liquidez**: diária, no vencimento, com carência? Quando consigo sacar sem perder?
- **Vencimento** vs. horizonte do usuário.
- **Indexador**: prefixado, % do CDI, IPCA+, ou CDI + spread. Comparar com cenário de Selic/IPCA.
- **Taxa plausível?** Compara com curva de mercado e com o que o emissor costuma pagar. Taxa muito acima da média é sinal de risco, não de oportunidade.
- **Emissor**: porte, banco pequeno vs. grande, histórico, indicadores públicos (ex.: Basileia, dados do BCB).
- **Cobertura do FGC**: limite de R$ 250 mil por CPF por instituição (e R$ 1 milhão a cada 4 anos). Cobre CDB/LCI/LCA/LC; **não** cobre debêntures, CRI/CRA, fundos. Cruzar com o que o usuário já tem no mesmo emissor.
- **Imposto**: tabela regressiva de IR (isento em LCI/LCA para pessoa física), IOF nos primeiros dias, comparar taxa **líquida**.
- **Marcação a mercado**: se vender antes do vencimento, pode perder?
- **Pegadinhas**: liquidez "diária" mas com carência, cláusula de resgate antecipado com taxa, rentabilidade que só vale se mantiver até o fim, taxa "de até" X%, bônus condicionado.
- **Concentração**: muito dinheiro no mesmo emissor/indexador/vencimento.

## Extensão: bolsa e outros ativos

Mesma lógica de comparar e alertar, com critérios próprios:

- **Ações**: preço vs. fundamentos, liquidez da ação, concentração do usuário no ativo/setor, imposto (isenção de R$ 20 mil/mês em vendas), momento do usuário.
- **FIIs**: tipo (tijolo, papel, fundo de fundos), P/VP, dividend yield sustentável vs. pontual, vacância, concentração de inquilinos, liquidez.
- **Fundos**: taxa de administração e performance, come-cotas, prazo de resgate (cotização), histórico vs. benchmark.
- **Cripto/Exterior**: risco cambial, custódia, tributação.

## Princípios de implementação

- Números e normalização são **código**, não LLM. O LLM interpreta a entrada (extração) e redige a explicação.
- Sempre mostrar **de onde veio cada dado** e o que foi suposto.
- Quando faltar informação, o sistema **pergunta** em vez de supor.
- Registrar a comparação e a escolha do usuário; depois comparar com o resultado (liga com o diferencial #3).

## Pontos em aberto

- Formato de entrada: prints (visão do LLM), texto colado, CSV, integração com corretora?
- Onde achar dados de emissores e taxas de referência de forma confiável e gratuita?
- Como tratar produtos com regras complexas (debêntures incentivadas, COE)?
