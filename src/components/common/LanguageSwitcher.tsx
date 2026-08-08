import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', flag: '🇬🇧' },
    { code: 'lo', flag: '🇱🇦' },
  ];

  const toggleLanguage = () => {
    const currentLang = i18n.language;
    const newLang = currentLang === 'en' ? 'lo' : 'en';
    i18n.changeLanguage(newLang);
  };

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center justify-center w-10 h-10 text-gray-700 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      aria-label="Toggle language"
      title={i18n.language === 'en' ? 'Switch to Lao' : 'Switch to English'}
    >
      <span className="text-xl">{currentLanguage.flag}</span>
    </button>
  );
};

export default LanguageSwitcher;

