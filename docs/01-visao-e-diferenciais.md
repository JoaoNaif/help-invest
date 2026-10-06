# Visão e diferenciais

## Visão

Assistente de investimentos pessoal com IA. O usuário informa sua carteira, renda, objetivos e histórico. O sistema cruza isso com o cenário do mundo (Selic, IPCA, bolsa BR, bolsa internacional, cripto) e devolve sugestões **personalizadas ao momento do investidor**, não só ao momento do mercado.

Exemplo central: uma empresa pode estar ótima na bolsa, mas se o investidor já tem posição elevada nela, o sistema não sugere aumentar.

Além das sugestões: dashboard com números, métricas e filtros.

## Estratégia

1. Construir para uso próprio (aprendizado + utilidade real).
2. Validar com amigos e família.
3. Só então avaliar virar serviço (ver [03](03-alertas-regulatorios-e-riscos.md)).

## Por que não é "só um projeto no Claude"

- **Dados vivos e estado persistente**: macro e cotações entram sozinhos; o sistema lembra o que sugeriu antes.
- **Cálculo determinístico**: concentração, alocação, imposto e liquidez são código. O LLM **explica**, não decide números.
- **Consistência**: mesma situação, mesma resposta.

## Por que dashboard não basta

Corretoras já entregam dashboard. Ele é apenas parte de apoio, não o diferencial.

## Diferenciais candidatos

| # | Diferencial | Status |
|---|---|---|
| 1 | **Comparador de opções**: usuário envia vários produtos (CDBs, fundos, etc.) e a IA compara e alerta pegadinhas. Ver [02](02-ideia-comparador-de-investimentos.md) | [ideia] prioridade alta (dor real do autor) |
| 2 | **Motor de regras + LLM como explicador**: recomendações vêm de regras de carteira (concentração, alocação-alvo, objetivo) | [ideia] |
| 3 | **Histórico e prestação de contas**: toda recomendação é registrada e comparada depois com CDI/IBOV. Constrói confiança e mostra se o sistema funciona | [ideia] |
| 4 | **Independência**: sem comissão nem produto próprio para vender; recomenda só pelo objetivo do investidor | [ideia] |
| 5 | **Consolidação entre instituições** (B3, renda fixa, exterior, cripto). Já existe em Kinvo, Gorila, Investidor10, Status Invest — só vale se ligado às recomendações | [validar] |
| 6 | **Proteção contra si mesmo**: diz o que **não** fazer (FOMO, excesso de concentração, overtrading) | [ideia] |
| 7 | **Imposto brasileiro**: isenção de R$ 20 mil em ações, come-cotas, IR regressivo, DARF, compensação de prejuízo, declaração | [ideia] |

### Combinação que parece mais forte (hipótese)

Comparador de opções + motor de regras personalizado + registro de acertos/erros. Imposto como camada extra.

## Concorrentes a observar

Kinvo, Gorila, Investidor10, Status Invest, Grana, Mobills, robo-advisors das corretoras. Mapear melhor mais tarde (o que fazem, o que cobram, o que não fazem).

## Perguntas em aberto

- Qual decisão gera mais insegurança no dia a dia: quando aportar, onde aportar, quando vender, imposto? (O comparador já responde parte de "onde aportar".)
- Como o usuário informa os dados: manual, CSV, B3/CEI, Open Finance?
- Quais fontes de dados são confiáveis e gratuitas (BCB, B3, APIs de cotação)?
