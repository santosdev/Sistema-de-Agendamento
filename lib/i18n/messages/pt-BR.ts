/**
 * Interface strings in Brazilian Portuguese (default locale).
 * Keys are English; values follow DESIGN.md section 12. No em dashes.
 */
export const ptBR = {
  meta: {
    title: "Agenda Tech Resolute",
    description: "Agende reuniões em poucos passos, no seu fuso horário.",
  },
  common: {
    skipToContent: "Pular para o conteúdo",
    tryAgain: "Tentar de novo",
    back: "Voltar",
    continue: "Continuar",
    loading: "Carregando",
    optional: "(opcional)",
  },
  home: {
    title: "Agendamento de reuniões",
    subtitle: "Em construção. Em breve você poderá marcar uma conversa com a gente por aqui.",
  },
} as const;

/** Same shape as pt-BR, any string values. */
type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

export type Messages = DeepStrings<typeof ptBR>;
