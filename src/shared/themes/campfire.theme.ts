import { type ThemeDefinition } from 'vuetify'
import { darkVariables, lightVariables } from '@/shared/themes/variables'

/*
|--------------------------------------------------------------------------
| Campfire
|--------------------------------------------------------------------------
|
| Ember orange, firelight, wood and charcoal.
| Best for warmth, community and shared storytelling.
|
*/

export const campfireLight: ThemeDefinition = {
    dark: false,

    colors: {
        background: '#FBF4ED',
        surface: '#FFFCF8',
        'surface-bright': '#FFFFFF',
        'surface-light': '#F6E9DE',
        'surface-variant': '#EBDCCE',

        primary: '#B95527',
        'primary-darken-1': '#923E19',

        secondary: '#765244',
        'secondary-darken-1': '#593B31',

        accent: '#D89A43',
        'accent-darken-1': '#B67523',

        success: '#567B3F',
        warning: '#AA601A',
        error: '#B73545',
        info: '#416F86',

        'on-background': '#2B211C',
        'on-surface': '#2B211C',
        'on-surface-variant': '#5B4A40',

        'on-primary': '#FFFFFF',
        'on-secondary': '#FFFFFF',
        'on-accent': '#281A08',

        'on-success': '#FFFFFF',
        'on-warning': '#FFFFFF',
        'on-error': '#FFFFFF',
        'on-info': '#FFFFFF',

        ember: '#D96832',
        'on-ember': '#321408',

        flame: '#E99A42',
        'on-flame': '#2D1906',

        firelight: '#FFD08A',
        'on-firelight': '#37220C',

        charcoal: '#3D3531',
        'on-charcoal': '#FFFFFF',

        wood: '#845B43',
        'on-wood': '#FFFFFF',

        ash: '#9B918A',
        'on-ash': '#211D1B',

        hearth: '#B66A3C',
        'on-hearth': '#FFFFFF',

        border: '#DAC9BC',
        divider: '#E5D8CE',

        muted: '#776A62',
        'on-muted': '#FFFFFF',
    },

    variables: {
        ...lightVariables,

        'border-color': '#66554B',

        'theme-kbd': '#40352F',
        'theme-on-kbd': '#FFFFFF',

        'theme-code': '#F3E6DC',
        'theme-on-code': '#703719',
    },
}

export const campfireDark: ThemeDefinition = {
    dark: true,

    colors: {
        background: '#191614',
        surface: '#25211F',
        'surface-bright': '#403936',
        'surface-light': '#302B28',
        'surface-variant': '#39302C',

        primary: '#F08A4B',
        'primary-darken-1': '#D56D32',

        secondary: '#B49584',
        'secondary-darken-1': '#8C7163',

        accent: '#F1B760',
        'accent-darken-1': '#D39335',

        success: '#82B768',
        warning: '#F2A953',
        error: '#EC737A',
        info: '#79AEC3',

        'on-background': '#EFE7E1',
        'on-surface': '#EFE7E1',
        'on-surface-variant': '#D7C9C1',

        'on-primary': '#321509',
        'on-secondary': '#251A15',
        'on-accent': '#2D1B06',

        'on-success': '#10230B',
        'on-warning': '#2C1803',
        'on-error': '#35090D',
        'on-info': '#08232D',

        ember: '#E97B43',
        'on-ember': '#2E1106',

        flame: '#F4A54E',
        'on-flame': '#2D1804',

        firelight: '#FFD18A',
        'on-firelight': '#332006',

        charcoal: '#34302E',
        'on-charcoal': '#EFE8E3',

        wood: '#AE8063',
        'on-wood': '#25160F',

        ash: '#ACA29C',
        'on-ash': '#211D1B',

        hearth: '#D17A4B',
        'on-hearth': '#2A1208',

        border: '#514741',
        divider: '#3F3834',

        muted: '#ACA09A',
        'on-muted': '#1C1816',
    },

    variables: {
        ...darkVariables,

        'border-color': '#DDD1CB',

        'theme-kbd': '#E9DDD7',
        'theme-on-kbd': '#2B211C',

        'theme-code': '#302A27',
        'theme-on-code': '#F3B684',
    },
}
