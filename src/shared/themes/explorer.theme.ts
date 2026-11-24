import type { ThemeDefinition } from "vuetify"
import { darkVariables, lightVariables } from "@/shared/themes/variables"

/*
|--------------------------------------------------------------------------
| Explorer
|--------------------------------------------------------------------------
|
| Forest green, moss, stone and old-map gold.
| Best for wilderness, travel and discovery.
|
*/

export const explorerLight: ThemeDefinition = {
    dark: false,

    colors: {
        background: '#F5F5ED',
        surface: '#FCFCF6',
        'surface-bright': '#FFFFFF',
        'surface-light': '#ECEFE5',
        'surface-variant': '#DEE4D8',

        primary: '#3F6A4D',
        'primary-darken-1': '#2D5239',

        secondary: '#53634C',
        'secondary-darken-1': '#3C4937',

        accent: '#B18D4F',
        'accent-darken-1': '#8E6B35',

        success: '#4B7B4E',
        warning: '#A86720',
        error: '#B33D43',
        info: '#3C6F82',

        'on-background': '#1E251F',
        'on-surface': '#1E251F',
        'on-surface-variant': '#465047',

        'on-primary': '#FFFFFF',
        'on-secondary': '#FFFFFF',
        'on-accent': '#241A0C',

        'on-success': '#FFFFFF',
        'on-warning': '#FFFFFF',
        'on-error': '#FFFFFF',
        'on-info': '#FFFFFF',

        forest: '#4F7D5C',
        'on-forest': '#FFFFFF',

        moss: '#728764',
        'on-moss': '#172013',

        fern: '#8DA37B',
        'on-fern': '#152011',

        earth: '#74624B',
        'on-earth': '#FFFFFF',

        map: '#D2BD8C',
        'on-map': '#302616',

        trail: '#A67C45',
        'on-trail': '#21170B',

        stone: '#817D70',
        'on-stone': '#FFFFFF',

        border: '#C9CFC2',
        divider: '#D8DDD2',

        muted: '#687168',
        'on-muted': '#FFFFFF',
    },

    variables: {
        ...lightVariables,

        'border-color': '#536056',

        'theme-kbd': '#344037',
        'theme-on-kbd': '#FFFFFF',

        'theme-code': '#E8ECE3',
        'theme-on-code': '#31543C',
    },
}

export const explorerDark: ThemeDefinition = {
    dark: true,

    colors: {
        background: '#151916',
        surface: '#202620',
        'surface-bright': '#384038',
        'surface-light': '#2A312A',
        'surface-variant': '#30392F',

        primary: '#7EAC88',
        'primary-darken-1': '#5F8D6A',

        secondary: '#9CA893',
        'secondary-darken-1': '#77846F',

        accent: '#D1B371',
        'accent-darken-1': '#AD8C4C',

        success: '#75B978',
        warning: '#E2A054',
        error: '#E16D72',
        info: '#75ACBE',

        'on-background': '#E5EAE4',
        'on-surface': '#E5EAE4',
        'on-surface-variant': '#C6CEC4',

        'on-primary': '#102017',
        'on-secondary': '#182015',
        'on-accent': '#291F0D',

        'on-success': '#0C220D',
        'on-warning': '#281805',
        'on-error': '#36090D',
        'on-info': '#092229',

        forest: '#76A481',
        'on-forest': '#102017',

        moss: '#8BA17C',
        'on-moss': '#14200F',

        fern: '#A4B894',
        'on-fern': '#182013',

        earth: '#A08C70',
        'on-earth': '#21180D',

        map: '#CBB884',
        'on-map': '#281F0E',

        trail: '#C69255',
        'on-trail': '#24180B',

        stone: '#A39F93',
        'on-stone': '#20201B',

        border: '#465047',
        divider: '#353D36',

        muted: '#A4ADA3',
        'on-muted': '#171B17',
    },

    variables: {
        ...darkVariables,

        'border-color': '#D4DCD2',

        'theme-kbd': '#DFE6DD',
        'theme-on-kbd': '#1E251F',

        'theme-code': '#293029',
        'theme-on-code': '#A8CCAF',
    },
}