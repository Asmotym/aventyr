import { type ThemeDefinition } from 'vuetify'
import { darkVariables, lightVariables } from '@/shared/themes/variables'

export const aventyrDark: ThemeDefinition = {
    dark: true,
    colors: {
        /*
         * Core surfaces
         *
         * Slightly warm neutrals avoid the generic blue-gray appearance
         * common in default dark themes.
         */
        background: '#171614',
        surface: '#211F1C',
        'surface-bright': '#3A3631',
        'surface-light': '#2D2A26',
        'surface-variant': '#37312B',

        /*
         * Brand colors
         *
         * The original guild orange works well in dark mode because dark
         * text has better contrast on it than white text.
         */
        primary: '#C17B3A',
        'primary-darken-1': '#A6612B',

        secondary: '#A48870',
        'secondary-darken-1': '#806650',

        accent: '#D9B779',
        'accent-darken-1': '#BF9855',

        /*
         * Semantic states
         */
        success: '#72A961',
        warning: '#E29A4D',
        error: '#E06B73',
        info: '#75A7C4',

        /*
         * Text rendered on theme colors
         */
        'on-background': '#EEE8DE',
        'on-surface': '#EEE8DE',
        'on-surface-variant': '#D6CABD',

        'on-primary': '#241A12',
        'on-secondary': '#1E1813',
        'on-accent': '#282014',

        'on-success': '#10200E',
        'on-warning': '#25190D',
        'on-error': '#2B1013',
        'on-info': '#10212B',

        /*
         * Custom Aventyr tokens
         */
        parchment: '#CDB98E',
        'on-parchment': '#251E15',

        leather: '#A26D45',
        'on-leather': '#21150E',

        map: '#A9946D',
        'on-map': '#211A12',

        forest: '#6D9363',
        'on-forest': '#101B0E',

        gold: '#D0A14C',
        'on-gold': '#21190B',

        border: '#514A42',
        divider: '#403B35',

        muted: '#A79C91',
        'on-muted': '#191715',
    },
    variables: darkVariables,
}


export const aventyrLight: ThemeDefinition = {
    dark: false,
    colors: {
        /*
         * Core surfaces
         */
        background: '#F7F3EA',
        surface: '#FFFDF8',
        'surface-bright': '#FFFFFF',
        'surface-light': '#F2EBDD',
        'surface-variant': '#E6DCCD',

        /*
         * Brand colors
         *
         * The light-theme primary is darker than the original #C17B3A
         * so white text remains readable on primary buttons.
         */
        primary: '#9A5725',
        'primary-darken-1': '#7D431B',

        secondary: '#6B513C',
        'secondary-darken-1': '#503B2C',

        accent: '#D9B779',
        'accent-darken-1': '#BE9452',

        /*
         * Semantic states
         */
        success: '#4F793F',
        warning: '#A86220',
        error: '#B33D48',
        info: '#416F8C',

        /*
         * Text rendered on theme colors
         */
        'on-background': '#28231E',
        'on-surface': '#28231E',
        'on-surface-variant': '#554A3F',

        'on-primary': '#FFFFFF',
        'on-secondary': '#FFFFFF',
        'on-accent': '#2D2418',

        'on-success': '#FFFFFF',
        'on-warning': '#FFFFFF',
        'on-error': '#FFFFFF',
        'on-info': '#FFFFFF',

        /*
         * Custom Aventyr tokens
         *
         * These can be used like any Vuetify theme color:
         * bg-parchment, text-leather, bg-map, etc.
         */
        parchment: '#EAD9B7',
        'on-parchment': '#352A1F',

        leather: '#7A5132',
        'on-leather': '#FFFFFF',

        map: '#D5C096',
        'on-map': '#33291E',

        forest: '#4F6B46',
        'on-forest': '#FFFFFF',

        gold: '#B98535',
        'on-gold': '#211A10',

        border: '#D5C9B8',
        divider: '#DED4C5',

        muted: '#746A5F',
        'on-muted': '#FFFFFF',
    },
    variables: lightVariables,
}