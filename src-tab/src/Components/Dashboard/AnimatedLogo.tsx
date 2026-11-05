import React, { useId } from 'react';

import { Box } from '@mui/material';

import { breathe, NO_MOTION, rise, slicePulse } from './motion';

/** Database slices from bottom to top, the light runs upwards */
const SLICES = [
    'M37 59v7a13 4.5 0 0 0 26 0v-7a13 4.5 0 0 1 -26 0Z',
    'M37 48v7a13 4.5 0 0 0 26 0v-7a13 4.5 0 0 1 -26 0Z',
    'M37 37v7a13 4.5 0 0 0 26 0v-7a13 4.5 0 0 1 -26 0Z',
];

/**
 * The BackItUp logo (cloud with database) as inline SVG. While `active`, light runs up the database
 * and data points rise into the cloud - the backup is being made.
 *
 * @param props properties
 * @param props.active a backup runs
 * @param props.style styles of the svg
 */
export default function AnimatedLogo(props: { active: boolean; style?: React.CSSProperties }): React.JSX.Element {
    // useId may contain characters that break `url(#...)`
    const id = `bk${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const ref = (name: string): string => `url(#${id}${name})`;

    return (
        <Box
            component="svg"
            viewBox="0 4 100 76"
            role="img"
            aria-label="BackItUp"
            style={props.style}
            sx={{
                display: 'block',
                height: 'auto',
                overflow: 'visible',
                '& .bk-hl, & .bk-dot': { opacity: 0 },
                '& .bk-dot': { transformBox: 'fill-box' },
                ...(props.active
                    ? {
                          '& .bk-cloud': { animation: `${breathe} 2.4s ease-in-out infinite` },
                          '& .bk-hl': { animation: `${slicePulse} 1.8s ease-in-out infinite` },
                          '& .bk-hl1': { animationDelay: '0.25s' },
                          '& .bk-hl2': { animationDelay: '0.5s' },
                          '& .bk-hl3': { animationDelay: '0.75s' },
                          '& .bk-dot': { animation: `${rise} 1.8s ease-out infinite` },
                          '& .bk-dot1': { animationDelay: '0.6s' },
                          '& .bk-dot2': { animationDelay: '1.2s' },
                          '& .bk-hl, & .bk-dot, & .bk-cloud': NO_MOTION,
                      }
                    : null),
            }}
        >
            <defs>
                <linearGradient
                    id={`${id}Cloud`}
                    x1="14"
                    y1="14"
                    x2="88"
                    y2="62"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop
                        offset="0"
                        stopColor="#7CD8FF"
                    />
                    <stop
                        offset="0.5"
                        stopColor="#2FA4FF"
                    />
                    <stop
                        offset="1"
                        stopColor="#1667F2"
                    />
                </linearGradient>
                <linearGradient
                    id={`${id}Side`}
                    x1="37"
                    y1="0"
                    x2="63"
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop
                        offset="0"
                        stopColor="#1A5CE6"
                    />
                    <stop
                        offset="0.4"
                        stopColor="#4FB8FF"
                    />
                    <stop
                        offset="0.62"
                        stopColor="#7CD2FF"
                    />
                    <stop
                        offset="1"
                        stopColor="#1A52D0"
                    />
                </linearGradient>
                <linearGradient
                    id={`${id}Top`}
                    x1="37"
                    y1="32"
                    x2="63"
                    y2="42"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop
                        offset="0"
                        stopColor="#A6E6FF"
                    />
                    <stop
                        offset="1"
                        stopColor="#5BB8FF"
                    />
                </linearGradient>
                <filter
                    id={`${id}Glow`}
                    x="-30%"
                    y="-30%"
                    width="160%"
                    height="160%"
                >
                    <feGaussianBlur
                        stdDeviation="2.2"
                        result="blur"
                    />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                {/* keeps a gap between the cloud outline and the database in front of it */}
                <mask
                    id={`${id}Cut`}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="4"
                    width="100"
                    height="76"
                >
                    <rect
                        x="0"
                        y="4"
                        width="100"
                        height="76"
                        fill="#FFF"
                    />
                    <path
                        d="M37 37A13 4.5 0 0 1 63 37V66A13 4.5 0 0 1 37 66Z"
                        fill="#000"
                        stroke="#000"
                        strokeWidth="8"
                    />
                </mask>
            </defs>
            <path
                className="bk-cloud"
                d="M26 60H72A16 16 0 0 0 74.5 28.2A22 22 0 0 0 33 33.88A14 14 0 1 0 26 60Z"
                fill="none"
                stroke={ref('Cloud')}
                strokeWidth="6"
                strokeLinejoin="round"
                mask={ref('Cut')}
                filter={ref('Glow')}
            />
            <g filter={ref('Glow')}>
                <ellipse
                    cx="50"
                    cy="37"
                    rx="13"
                    ry="4.5"
                    fill={ref('Top')}
                />
                {SLICES.map(d => (
                    <path
                        key={d}
                        d={d}
                        fill={ref('Side')}
                    />
                ))}
            </g>
            {/* light that runs up the database */}
            {SLICES.map((d, i) => (
                <path
                    key={d}
                    className={`bk-hl bk-hl${i}`}
                    d={d}
                    fill="#E6F7FF"
                />
            ))}
            <ellipse
                className="bk-hl bk-hl3"
                cx="50"
                cy="37"
                rx="13"
                ry="4.5"
                fill="#FFFFFF"
            />
            {/* data points that rise into the cloud */}
            {[44, 56, 50].map((x, i) => (
                <circle
                    key={x}
                    className={`bk-dot bk-dot${i}`}
                    cx={x}
                    cy={30}
                    r={1.7}
                    fill="#D6F3FF"
                />
            ))}
        </Box>
    );
}
