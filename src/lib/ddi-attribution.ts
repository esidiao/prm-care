/**
 * Atribuição da base externa de interações (DDInter 2.0).
 *
 * FONTE ÚNICA — toda superfície que mostra resultado de interação deve usar
 * estas constantes. Antes de 31/08/2026 a atribuição existia só na tela
 * `/interactions`; a consulta salva, a janela de impressão, o PDF e o relatório
 * de conciliação saíam sem ela, e são justamente as saídas que circulam fora do
 * sistema (entregues a prescritor, anexadas a prontuário).
 *
 * A licença CC BY exige que a atribuição acompanhe o material em qualquer meio
 * em que ele seja distribuído — não basta constar na tela de origem.
 *
 * ⚠️ PENDÊNCIA JURÍDICA EM ABERTO — a atribuição abaixo satisfaz a cláusula BY,
 * mas NÃO resolve as outras duas do CC BY-NC-SA 4.0:
 *
 *   • NonCommercial — o produto cobra por pacotes de token (Mercado Pago).
 *   • ShareAlike    — material adaptado deve herdar a mesma licença, o que é
 *                     incompatível com software proprietário.
 *
 * Ver a análise completa e as opções em aberto no relatório de benchmark de
 * 31/08/2026 (lacuna 01). Enquanto a decisão não é tomada, manter a atribuição
 * correta é o mínimo exigível e demonstra boa-fé.
 */

/** Rótulo curto — chip/etiqueta ao lado de um achado da camada externa. */
export const DDI_SOURCE_LABEL = 'DDInter'

// O nome completo da fonte (campo `source` do motor) vive em `EXTERNAL_SOURCE`,
// dentro do arquivo gerado ddi-external.ts — não duplicado aqui de propósito,
// para não haver duas verdades sobre o mesmo rótulo.

/** Aviso de atribuição completo — creditação, licença e link, como a CC BY pede. */
export const DDI_ATTRIBUTION =
  'Parte das interações provém da base DDInter 2.0 (Xiong G. et al., 2022 — ddinter.scbdd.com), ' +
  'licença CC BY-NC-SA 4.0. Uso não-comercial/assistencial, com atribuição.'

/** Versão de uma linha, para rodapé de documento impresso ou PDF. */
export const DDI_ATTRIBUTION_SHORT =
  'Interações marcadas "DDInter": base DDInter 2.0 (Xiong G. et al., 2022), CC BY-NC-SA 4.0.'
