# Roadmap e validação

## Estratégia de validação

1. **Fase 1 — Uso próprio.** A maior validação: está sendo útil para mim? Mudou alguma decisão minha?
2. **Fase 2 — Amigos e família.** Teste fechado, sem cobrança, com aviso de que é experimental.
3. **Fase 3 — Avaliar serviço.** Só após validação + checklist de [03](03-alertas-regulatorios-e-riscos.md).

Objetivos paralelos: aprendizado e deixar a porta aberta para virar produto.

## Fase 1 — MVP pessoal (proposta, a refinar)

Candidatos a entrar, em ordem sugerida:

1. **Comparador de renda fixa** (CDBs etc.): é a dor concreta e tem escopo bem delimitado. Ver [02](02-ideia-comparador-de-investimentos.md).
2. **Cadastro da carteira** (manual ou CSV) + perfil/objetivo.
3. **Dados macro** do BCB (Selic, IPCA, câmbio) para contexto.
4. **Motor de regras de carteira** (concentração, alocação-alvo).
5. **Registro de recomendações** desde o primeiro dia.
6. **Relatório mensal** gerado pelo LLM a partir dos resultados das regras.

Dashboard e filtros vêm depois, como apoio.

## Critérios de sucesso da Fase 1

- Usei o comparador em decisões reais?
- Encontrou algum ponto que eu não teria notado sozinho (liquidez, risco, pegadinha)?
- As sugestões fazem sentido com a minha carteira?
- Confio nos números? (checados contra fonte)

## A definir

- Stack (backend, banco, qual modelo/API de LLM).
- Fontes de dados e limites de uso.
- Formato de entrada do comparador (print, texto, CSV).
