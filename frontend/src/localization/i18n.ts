import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        appName: 'Performance Management System',
        savingLives: 'Saving Lives Livelihoods',
        needHelp: 'Need help? Contact your supervisor or HR.',
        exportReport: 'Export Report',
      },
    },
  },
})

export default i18n
