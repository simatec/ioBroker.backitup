/**
 * Own animations of the BackItUp tab. Every animation shows a state (backup runs, new backup, drag over...)
 * or answers the mouse. All of them stop when the system asks for less motion.
 */
import { keyframes } from '@mui/material/styles';

/** Spread into an `sx` object: no animation and no transition for users who want less motion */
export const NO_MOTION = {
    '@media (prefers-reduced-motion: reduce)': {
        animation: 'none !important',
        transition: 'none !important',
    },
} as const;

export const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
`;

/** A new row: slides in from above */
export const slideIn = keyframes`
    from { opacity: 0; transform: translateY(-12px); }
    to { opacity: 1; transform: none; }
`;

/** A new row: the background lights up and fades out, the color comes from `--bk-flash` */
export const flash = keyframes`
    0%, 15% { background-color: var(--bk-flash); }
    100% { background-color: transparent; }
`;

/** Light that runs over a database slice */
export const slicePulse = keyframes`
    0%, 55%, 100% { opacity: 0; }
    20% { opacity: 0.55; }
`;

/** Data points that rise from the database into the cloud */
export const rise = keyframes`
    0% { opacity: 0; transform: translateY(0); }
    25% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-17px); }
`;

/** Slow breathing of the cloud while a backup runs */
export const breathe = keyframes`
    0%, 100% { opacity: 1; }
    50% { opacity: 0.72; }
`;

/** Light streak along a line, used with `stroke-dasharray` */
export const streak = keyframes`
    from { stroke-dashoffset: 790; }
    to { stroke-dashoffset: 0; }
`;

export const float = keyframes`
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
`;

/** Ring that grows and fades, e.g. around the drop target */
export const ripple = keyframes`
    from { box-shadow: 0 0 0 0 var(--bk-ripple); }
    to { box-shadow: 0 0 0 18px transparent; }
`;

const drop = keyframes`
    0%, 100% { transform: translateY(0); }
    35% { transform: translateY(5px); }
    65% { transform: translateY(-1px); }
`;

const lift = keyframes`
    0%, 100% { transform: translateY(0); }
    35% { transform: translateY(-5px); }
    65% { transform: translateY(1px); }
`;

const wiggle = keyframes`
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-14deg); }
    60% { transform: rotate(10deg); }
`;

const lines = keyframes`
    0%, 100% { transform: scaleX(1); }
    40% { transform: scaleX(0.82); }
`;

/** How the icon of an action tile answers the mouse */
export type HoverEffect = 'spin' | 'drop' | 'lift' | 'wiggle' | 'lines';

/**
 * `sx` for the element around a tile icon (class `bk-tile-icon`), placed on the tile itself.
 *
 * @param effect kind of movement
 */
export function hoverEffectSx(effect: HoverEffect | undefined): Record<string, unknown> {
    if (!effect) {
        return {};
    }
    if (effect === 'spin') {
        return {
            '& .bk-tile-icon': { transition: 'transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1)' },
            '&:hover .bk-tile-icon, &:focus-visible .bk-tile-icon': { transform: 'rotate(90deg)' },
            '@media (prefers-reduced-motion: reduce)': { '& .bk-tile-icon': { transition: 'none' } },
        };
    }
    const animation = { drop, lift, wiggle, lines }[effect];
    return {
        '&:hover .bk-tile-icon, &:focus-visible .bk-tile-icon': {
            animation: `${animation} 0.55s ease-out`,
            transformOrigin: effect === 'lines' ? 'left center' : 'center',
        },
        '@media (prefers-reduced-motion: reduce)': {
            '&:hover .bk-tile-icon, &:focus-visible .bk-tile-icon': { animation: 'none' },
        },
    };
}

/**
 * `sx` of a block that fades in when the tab opens. The blocks follow each other.
 *
 * @param index position of the block
 */
export function revealSx(index: number): Record<string, unknown> {
    return {
        animation: `${fadeUp} 0.45s cubic-bezier(0.2, 0.7, 0.3, 1) both`,
        animationDelay: `${index * 70}ms`,
        ...NO_MOTION,
    };
}
