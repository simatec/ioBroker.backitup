/**
 * Colors of the BackItUp tab. One set per theme mode, so the dashboard looks the same
 * in all admin themes (modernDark, dark, modernLight, light).
 */
export interface DashboardTokens {
    dark: boolean;
    /** Page background behind the cards */
    page: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentStrong: string;
    cardBg: string;
    cardBorder: string;
    cardShadow: string;
    iconBoxBg: string;
    iconBoxBorder: string;
    iconBoxColor: string;
    divider: string;
    rowDivider: string;
    rowHover: string;
    tileBg: string;
    tileBorder: string;
    tileHoverBg: string;
    tileHoverBorder: string;
    tileIcon: string;
    roundButtonBg: string;
    roundButtonHoverBg: string;
    roundButtonColor: string;
    /** Dropdown menus (backup source) */
    menuBg: string;
    menuShadow: string;
    menuHover: string;
    success: string;
    successBg: string;
    successBorder: string;
    error: string;
    errorBg: string;
    errorBorder: string;
}

const DARK: DashboardTokens = {
    dark: true,
    page: '#0A121D',
    text: '#E8EDF5',
    textSecondary: '#A7B4C6',
    textMuted: '#7D8BA0',
    accent: '#4B9BFA',
    accentStrong: '#2F8BFF',
    cardBg: 'linear-gradient(180deg, rgba(24, 38, 60, 0.92) 0%, rgba(17, 28, 45, 0.92) 100%)',
    cardBorder: 'rgba(96, 140, 200, 0.22)',
    cardShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
    iconBoxBg: 'rgba(59, 130, 246, 0.14)',
    iconBoxBorder: 'rgba(96, 165, 250, 0.22)',
    iconBoxColor: '#60A5FA',
    divider: 'rgba(148, 163, 184, 0.2)',
    rowDivider: 'rgba(148, 163, 184, 0.12)',
    rowHover: 'rgba(255, 255, 255, 0.03)',
    tileBg: 'linear-gradient(180deg, rgba(30, 46, 70, 0.75) 0%, rgba(21, 33, 52, 0.75) 100%)',
    tileBorder: 'rgba(148, 163, 184, 0.24)',
    tileHoverBg: 'linear-gradient(180deg, rgba(38, 58, 88, 0.85) 0%, rgba(26, 41, 64, 0.85) 100%)',
    tileHoverBorder: 'rgba(96, 165, 250, 0.7)',
    tileIcon: '#7CC0FF',
    roundButtonBg: 'rgba(255, 255, 255, 0.07)',
    roundButtonHoverBg: 'rgba(255, 255, 255, 0.16)',
    roundButtonColor: '#E2E8F0',
    menuBg: '#16233A',
    menuShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
    menuHover: 'rgba(255, 255, 255, 0.06)',
    success: '#4ADE80',
    successBg: 'rgba(34, 197, 94, 0.14)',
    successBorder: 'rgba(74, 222, 128, 0.45)',
    error: '#F87171',
    errorBg: 'rgba(239, 68, 68, 0.14)',
    errorBorder: 'rgba(248, 113, 113, 0.45)',
};

const LIGHT: DashboardTokens = {
    dark: false,
    page: '#F4F7FB',
    text: '#101827',
    textSecondary: '#475569',
    textMuted: '#64748B',
    accent: '#0B6BE0',
    accentStrong: '#137BF8',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    cardShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
    iconBoxBg: '#EAF2FF',
    iconBoxBorder: '#D6E6FF',
    iconBoxColor: '#1D6FE8',
    divider: '#E2E8F0',
    rowDivider: '#EEF2F7',
    rowHover: 'rgba(15, 23, 42, 0.025)',
    tileBg: '#FFFFFF',
    tileBorder: '#DCE3EC',
    tileHoverBg: '#F5F9FF',
    tileHoverBorder: '#8DB9F5',
    tileIcon: '#1D6FE8',
    roundButtonBg: 'rgba(15, 23, 42, 0.05)',
    roundButtonHoverBg: 'rgba(15, 23, 42, 0.11)',
    roundButtonColor: '#334155',
    menuBg: '#FFFFFF',
    menuShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
    menuHover: 'rgba(15, 23, 42, 0.045)',
    success: '#15803D',
    successBg: 'rgba(34, 197, 94, 0.12)',
    successBorder: 'rgba(22, 163, 74, 0.4)',
    error: '#B91C1C',
    errorBg: 'rgba(239, 68, 68, 0.1)',
    errorBorder: 'rgba(220, 38, 38, 0.4)',
};

export function getTokens(dark: boolean): DashboardTokens {
    return dark ? DARK : LIGHT;
}

/** The hero card is blue in both modes, so it has fixed colors */
export const HERO = {
    background: 'linear-gradient(120deg, #0A2350 0%, #0B3478 45%, #0A4FB8 80%, #0B62D6 100%)',
    border: 'rgba(96, 165, 250, 0.45)',
    shadow: '0 10px 30px rgba(11, 98, 214, 0.25)',
    text: '#FFFFFF',
    label: 'rgba(214, 228, 255, 0.85)',
    divider: 'rgba(160, 200, 255, 0.28)',
    icon: '#9CCBFF',
    success: '#4ADE80',
    successBg: 'rgba(34, 197, 94, 0.16)',
    successBorder: 'rgba(74, 222, 128, 0.6)',
    error: '#FCA5A5',
    errorBg: 'rgba(239, 68, 68, 0.2)',
    errorBorder: 'rgba(252, 165, 165, 0.6)',
};

/** Primary action (start ioBroker backup) */
export const PRIMARY_TILE = {
    background: 'linear-gradient(180deg, #2E93F9 0%, #0B6BEA 100%)',
    hoverBackground: 'linear-gradient(180deg, #48A1FA 0%, #1B7BF5 100%)',
    border: 'rgba(147, 197, 253, 0.65)',
    shadow: '0 6px 22px rgba(19, 123, 248, 0.38)',
    text: '#FFFFFF',
};
