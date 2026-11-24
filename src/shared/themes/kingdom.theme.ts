import { type ThemeDefinition } from 'vuetify'
import { darkVariables, lightVariables } from '@/shared/themes/variables'

/*
|--------------------------------------------------------------------------
| Kingdom
|--------------------------------------------------------------------------
|
| Royal violet, steel, stone and silver.
| Best for a serious, strategic, premium appearance.
|
*/

export const kingdomLight: ThemeDefinition = {
    dark: false,
  
    colors: {
      background: '#F6F5FA',
      surface: '#FEFBFF',
      'surface-bright': '#FFFFFF',
      'surface-light': '#ECEAF2',
      'surface-variant': '#E0DDE8',
  
      primary: '#6954C4',
      'primary-darken-1': '#5040A0',
  
      secondary: '#5F5A76',
      'secondary-darken-1': '#474258',
  
      accent: '#9A83E3',
      'accent-darken-1': '#7961C4',
  
      success: '#417859',
      warning: '#A65F1B',
      error: '#B3263D',
      info: '#416C91',
  
      'on-background': '#1E1E26',
      'on-surface': '#1E1E26',
      'on-surface-variant': '#4A4854',
  
      'on-primary': '#FFFFFF',
      'on-secondary': '#FFFFFF',
      'on-accent': '#211638',
  
      'on-success': '#FFFFFF',
      'on-warning': '#FFFFFF',
      'on-error': '#FFFFFF',
      'on-info': '#FFFFFF',
  
      royal: '#745FD1',
      'on-royal': '#FFFFFF',
  
      crown: '#B49443',
      'on-crown': '#211A0C',
  
      steel: '#667080',
      'on-steel': '#FFFFFF',
  
      silver: '#B6B5C2',
      'on-silver': '#24232B',
  
      banner: '#55497E',
      'on-banner': '#FFFFFF',
  
      castle: '#77727F',
      'on-castle': '#FFFFFF',
  
      border: '#CFCCD8',
      divider: '#DDD9E4',
  
      muted: '#6D6977',
      'on-muted': '#FFFFFF',
    },
  
    variables: {
      ...lightVariables,
  
      'border-color': '#595764',
  
      'theme-kbd': '#34323D',
      'theme-on-kbd': '#FFFFFF',
  
      'theme-code': '#ECEAF3',
      'theme-on-code': '#4A3B86',
    },
  }
  
  export const kingdomDark: ThemeDefinition = {
    dark: true,
  
    colors: {
      background: '#111318',
      surface: '#1C2028',
      'surface-bright': '#353A45',
      'surface-light': '#272C35',
      'surface-variant': '#2D303D',
  
      primary: '#A996FF',
      'primary-darken-1': '#8370E0',
  
      secondary: '#AAA4BF',
      'secondary-darken-1': '#837D98',
  
      accent: '#C4B5FF',
      'accent-darken-1': '#9F8AE9',
  
      success: '#70B58A',
      warning: '#EDAA60',
      error: '#ED7479',
      info: '#7EB1D6',
  
      'on-background': '#E5E6EC',
      'on-surface': '#E5E6EC',
      'on-surface-variant': '#C5C6D0',
  
      'on-primary': '#201542',
      'on-secondary': '#211E29',
      'on-accent': '#231743',
  
      'on-success': '#082117',
      'on-warning': '#281804',
      'on-error': '#35090D',
      'on-info': '#082137',
  
      royal: '#9885EE',
      'on-royal': '#1D123D',
  
      crown: '#D4B35A',
      'on-crown': '#241B08',
  
      steel: '#9BA6B8',
      'on-steel': '#181D25',
  
      silver: '#C8C7D1',
      'on-silver': '#202027',
  
      banner: '#8273B8',
      'on-banner': '#171028',
  
      castle: '#9A97A2',
      'on-castle': '#202027',
  
      border: '#494D58',
      divider: '#373B45',
  
      muted: '#A7A7B0',
      'on-muted': '#191A1E',
    },
  
    variables: {
      ...darkVariables,
  
      'border-color': '#D6D7DE',
  
      'theme-kbd': '#E0E1E7',
      'theme-on-kbd': '#1E1E26',
  
      'theme-code': '#272A33',
      'theme-on-code': '#C3B8FF',
    },
  }