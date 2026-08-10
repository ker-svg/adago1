import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

const adaGoTheme = {
  dark: false,
  colors: {
    primary: '#0A1628',
    secondary: '#134E4A',
    accent: '#10B981',
    background: '#F4F7F6',
    surface: '#FFFFFF',
    error: '#DC2626',
    success: '#059669',
    warning: '#D97706',
    info: '#0EA5E9',
  },
}

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'adaGoTheme',
    themes: {
      adaGoTheme,
    },
  },
  defaults: {
    VBtn: {
      rounded: 'lg',
      elevation: 0,
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
    },
  },
})
