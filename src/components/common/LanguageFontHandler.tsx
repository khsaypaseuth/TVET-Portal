import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageFontHandler = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    const htmlElement = document.documentElement;
    
    if (i18n.language === 'lo') {
      htmlElement.classList.add('lang-lao');
      htmlElement.setAttribute('lang', 'lo');
    } else {
      htmlElement.classList.remove('lang-lao');
      htmlElement.setAttribute('lang', 'en');
    }
  }, [i18n.language]);

  return null;
};

export default LanguageFontHandler;

