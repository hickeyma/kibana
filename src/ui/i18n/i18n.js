import path from 'path';
import Promise from 'bluebird';
import { readFile } from 'fs';
import _ from 'lodash';

const asyncReadFile = Promise.promisify(readFile);

const TRANSLATION_FILE_EXTENSION = '.json';

function getLocaleFromFileName(fullFileName) {
  if (_.isEmpty(fullFileName)) throw new Error('Filename empty');

  const fileExt = path.extname(fullFileName);
  if (fileExt.length <= 0 || fileExt !== TRANSLATION_FILE_EXTENSION) {
    throw new Error('Translations must be in a JSON file. File being registered is ' + fullFileName);
  }

  return path.basename(fullFileName, TRANSLATION_FILE_EXTENSION);
}

function getBestLocaleMatch(languageTag, registeredLocales) {
  if (_.contains(registeredLocales, languageTag)) {
    return languageTag;
  }

  // Find the first registered locale that begins with one of the language codes from the provided language tag.
  // For example, if there is an 'en' language code, it would match an 'en-US' registered locale.
  const languageCode = _.first(languageTag.split('-')) || [];
  return _.find(registeredLocales, (locale) => _.startsWith(locale, languageCode));
}

export class I18n {

  constructor(defaultLocale = 'en') {
    this.defaultLocale = defaultLocale;
    this.registeredTranslations = {};
  }

  /**
   * Return all translations for regsitered locales
   * @return {Promise<Object>} translations - A Promise object where keys are
   *                                          the locale and values are Objects
   *                                          of translation keys and translations
   */
  getAllTranslations() {
    let localeTranslations = {};

    const locales = this.getRegisteredTranslationLocales();
    const translations = _.map(locales, (locale) => {
      return this.getTranslations(locale)
      .then(function (translations) {
        localeTranslations[locale] = translations;
      });
    });

    return Promise.all(translations)
    .then(translations => _.assign({}, localeTranslations));
  }

  /**
   * Return translations for a suitable locale from a user side locale list
   * @param {Array<Sring>} languageTags -  BCP 47 language tags. The tags are listed in priority order as set in the Accept-Language header.
   * @returns {Promise<Object>} translations - promise for an object where
   *                                           keys are translation keys and
   *                                           values are translations
   * This object will contain all registered translations for the highest priority locale which is registered with the i18n module.
   * This object can be empty if no locale in the language tags can be matched against the registered locales.
   */
  getTranslations(...languageTags) {
    const locale = this.getTranslationLocale(languageTags);
    return this.getTranslationsForLocale(locale);
  }

  /**
   * Return all translations registered for the default locale.
   * @returns {Promise<Object>} translations - promise for an object where
   *                                           keys are translation keys and
   *                                           values are translations
   */
  getTranslationsForDefaultLocale() {
    return this.getTranslationsForLocale(this.defaultLocale);
  }

  /**
   * The translation file is registered with i18n plugin. The plugin contains a list of registered translation file paths per language.
   * @param {String} absolutePluginTranslationFilePath - Absolute path to the translation file to register.
   */
  registerTranslations(absolutePluginTranslationFilePath) {
    const locale = getLocaleFromFileName(absolutePluginTranslationFilePath);

    this.registeredTranslations[locale] = _.uniq(_.get(this.registeredTranslations, locale, []).concat(absolutePluginTranslationFilePath));
  }

  /**
   * TODO (MH): This should be private method. How do you do this?
   */
  getRegisteredTranslationLocales() {
    return Object.keys(this.registeredTranslations);
  }

  /**
   * TODO (MH): This should be private method. How do you do this?
   */
  getTranslationLocale(languageTags) {
    let locale = '';
    const registeredLocales = this.getRegisteredTranslationLocales();
    _.forEach(languageTags, (tag) => {
      locale = locale || getBestLocaleMatch(tag, registeredLocales);
    });
    return locale;
  }

  /**
   * TODO (MH): This should be private method. How do you do this?
   */
  getTranslationsForLocale(locale) {
    if (!this.registeredTranslations.hasOwnProperty(locale)) {
      return Promise.resolve({});
    }

    const translationFiles = this.registeredTranslations[locale];
    const translations = _.map(translationFiles, (filename) => {
      return asyncReadFile(filename, 'utf8')
      .then(fileContents => JSON.parse(fileContents))
      .catch(SyntaxError, function (e) {
        throw new Error('Invalid json in ' + filename);
      })
      .catch(function (e) {
        throw new Error('Cannot read file ' + filename);
      });
    });

    return Promise.all(translations)
    .then(translations => _.assign({}, ...translations));
  }
}
