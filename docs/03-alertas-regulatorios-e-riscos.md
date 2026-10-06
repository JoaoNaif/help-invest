# Alertas regulatórios e riscos

> Documento a consultar **antes** de transformar o projeto em serviço para terceiros.

## 1. Regulação (CVM) — [validar com profissional]

No Brasil, recomendação **personalizada** de investimentos é atividade regulada:

- **Consultor de valores mobiliários**: Resolução CVM 19. Exige registro/autorização.
- **Analista de valores mobiliários**: Resolução CVM 20 (relatórios de análise).
- Possíveis enquadramentos adicionais conforme o modelo (gestão de carteira, plataforma, etc.).

Implicações:

- **Uso pessoal**: sem problema.
- **Amigos e família, sem cobrança, em teste**: zona de menor risco, mas manter deixando claro que é experimental/educacional. Ainda assim, vale cuidado.
- **Serviço aberto/pago**: precisa decidir entre (a) se registrar como consultor, (b) posicionar como ferramenta **informativa/educacional** sem recomendação personalizada de compra, ou (c) parceria com uma entidade regulada.

**Ação futura**: consultar um advogado especializado em mercado de capitais antes de abrir o serviço. Este texto não é aconselhamento jurídico.

## 2. Riscos do LLM

- **Alucinação de dados**: o modelo pode inventar taxas, cotações ou regras de imposto. Mitigação: dados vêm de fontes (BCB, B3, APIs), cálculos em código, LLM só explica.
- **Inconsistência**: mesma pergunta, respostas diferentes. Mitigação: motor de regras determinístico.
- **Excesso de confiança**: o tom do texto pode parecer certeza. Mitigação: mostrar premissas, incerteza e fontes.
- **Desatualização**: conhecimento do modelo envelhece. Mitigação: dados de mercado e regras tributárias carregados de fontes atualizáveis.

## 3. Outros riscos

- **LGPD**: carteira e renda são dados pessoais financeiros. Definir armazenamento, consentimento, exclusão e quais dados vão para o provedor do LLM.
- **Segurança**: nunca pedir senha de corretora; preferir import por arquivo ou conexões oficiais (Open Finance/B3) com consentimento.
- **Responsabilidade**: o usuário perde dinheiro por seguir a sugestão. Exigir avisos claros, registrar premissas e manter o usuário como decisor.
- **Conflito de interesse**: manter a independência (sem comissão por produto) é também diferencial; se mudar, declarar.

## 4. Checklist antes de abrir para terceiros

- [ ] Parecer jurídico sobre enquadramento na CVM
- [ ] Termos de uso e aviso de risco
- [ ] Política de privacidade (LGPD)
- [ ] Decisão sobre quais dados vão ao LLM e retenção
- [ ] Todos os números de produtos/impostos com fonte e data
- [ ] Registro de recomendações e premissas (auditoria)
- [ ] Plano para erros: como corrigir e avisar usuários
