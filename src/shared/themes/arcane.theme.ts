import { type ThemeDefinition } from 'vuetify'
import { darkVariables, lightVariables } from '@/shared/themes/variables'

/*
|--------------------------------------------------------------------------
| Arcane
|--------------------------------------------------------------------------
|
| Purple, indigo and magical lavender.
| Best for a mystical, spell-oriented identity.
|
*/

export const arcaneLight: ThemeDefinition = {
    dark: false,
  
    colors: {
      background: '#F7F5FC',
      surface: '#FFFBFF',
      'surface-bright': '#FFFFFF',
      'surface-light': '#F0EBFA',
      'surface-variant': '#E5DEF1',
  
      primary: '#6847D9',
      'primary-darken-1': '#5033B4',
  
      secondary: '#57457F',
      'secondary-darken-1': '#403260',
  
      accent: '#9B7CE8',
      'accent-darken-1': '#7957CC',
  
      success: '#387A51',
      warning: '#A76116',
      error: '#B3263E',
      info: '#3C6E9D',
  
      'on-background': '#211D27',
      'on-surface': '#211D27',
      'on-surface-variant': '#514A5B',
  
      'on-primary': '#FFFFFF',
      'on-secondary': '#FFFFFF',
      'on-accent': '#211331',
  
      'on-success': '#FFFFFF',
      'on-warning': '#FFFFFF',
      'on-error': '#FFFFFF',
      'on-info': '#FFFFFF',
  
      /*
       * Custom Aventyr tokens
       */
      arcane: '#7C5CFF',
      'on-arcane': '#FFFFFF',
  
      mana: '#5B4AA2',
      'on-mana': '#FFFFFF',
  
      crystal: '#C9BAF8',
      'on-crystal': '#271D43',
  
      ether: '#E1D9F5',
      'on-ether': '#322A41',
  
      void: '#302840',
      'on-void': '#FFFFFF',
  
      rune: '#8256B5',
      'on-rune': '#FFFFFF',
  
      border: '#D3C9E2',
      divider: '#DED6E8',
  
      muted: '#756C7F',
      'on-muted': '#FFFFFF',
    },
  
    variables: {
      ...lightVariables,
  
      'border-color': '#62596D',
  
      'theme-kbd': '#3C3547',
      'theme-on-kbd': '#FFFFFF',
  
      'theme-code': '#EEE9F6',
      'theme-on-code': '#4A3471',
    },
  }
  
  export const arcaneDark: ThemeDefinition = {
    dark: true,
  
    colors: {
      background: '#121218',
      surface: '#1C1C26',
      'surface-bright': '#373642',
      'surface-light': '#282732',
      'surface-variant': '#312E3E',
  
      primary: '#A991FF',
      'primary-darken-1': '#8467E8',
  
      secondary: '#B4A2D2',
      'secondary-darken-1': '#8D79B0',
  
      accent: '#C6B3FF',
      'accent-darken-1': '#9E84EE',
  
      success: '#68C78B',
      warning: '#F4B35E',
      error: '#FF7B82',
      info: '#78B5DE',
  
      'on-background': '#E9E4F0',
      'on-surface': '#E9E4F0',
      'on-surface-variant': '#CCC3D8',
  
      'on-primary': '#241448',
      'on-secondary': '#231A2F',
      'on-accent': '#251643',
  
      'on-success': '#092315',
      'on-warning': '#291804',
      'on-error': '#37080E',
      'on-info': '#082237',
  
      arcane: '#9A7DFF',
      'on-arcane': '#1D0E3C',
  
      mana: '#7765C1',
      'on-mana': '#120A2E',
  
      crystal: '#CAB8FF',
      'on-crystal': '#24113F',
  
      ether: '#746A88',
      'on-ether': '#FFFFFF',
  
      void: '#24202F',
      'on-void': '#ECE6F4',
  
      rune: '#B482DF',
      'on-rune': '#2C123F',
  
      border: '#484351',
      divider: '#393642',
  
      muted: '#ABA2B6',
      'on-muted': '#19171D',
    },
  
    variables: {
      ...darkVariables,
  
      'border-color': '#D8D0E1',
  
      'theme-kbd': '#E6DFED',
      'theme-on-kbd': '#211D27',
  
      'theme-code': '#292633',
      'theme-on-code': '#CEB7FF',
    },
  }