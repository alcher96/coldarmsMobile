// Плагин конфигурации Expo: release-сборка Android подписывается своим ключом Cold Arms, а не отладочным ключом из
// шаблона React Native (он одинаковый во всех проектах и публичный — по нему нельзя подтверждать ссылки coldarms.com:
// любое чужое приложение с тем же ключом перехватывало бы ссылки сброса пароля и подтверждения почты).
//
// Ключ и пароли в репозиторий не попадают:
//   COLDARMS_UPLOAD_STORE_FILE      — путь к хранилищу (по умолчанию %USERPROFILE%\.android-keys\coldarms-upload.jks)
//   COLDARMS_UPLOAD_STORE_PASSWORD  — пароль хранилища
//   COLDARMS_UPLOAD_KEY_ALIAS       — имя ключа (по умолчанию coldarms)
//   COLDARMS_UPLOAD_KEY_PASSWORD    — пароль ключа
// Нет пароля хранилища в окружении — release подписывается отладочным ключом, как раньше (сборка не ломается), но
// такой APK не пройдёт проверку ссылок coldarms.com (assetlinks.json — только отпечаток своего ключа).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// coldarms: release-signing';

const RELEASE_CONFIG = `
        ${MARK}
        release {
            def ksFile = System.getenv('COLDARMS_UPLOAD_STORE_FILE') ?: (System.getProperty('user.home') + '/.android-keys/coldarms-upload.jks')
            storeFile file(ksFile)
            storePassword System.getenv('COLDARMS_UPLOAD_STORE_PASSWORD')
            keyAlias System.getenv('COLDARMS_UPLOAD_KEY_ALIAS') ?: 'coldarms'
            keyPassword System.getenv('COLDARMS_UPLOAD_KEY_PASSWORD') ?: System.getenv('COLDARMS_UPLOAD_STORE_PASSWORD')
        }`;

/** Вставить release-подпись в build.gradle (повторный запуск ничего не меняет). */
function applySigning(gradle) {
  if (gradle.includes(MARK)) return gradle;
  // signingConfigs { debug { … } } — release рядом с debug
  const debugBlock = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
  if (!debugBlock.test(gradle)) throw new Error('release-signing: не найден signingConfigs.debug в build.gradle');
  gradle = gradle.replace(debugBlock, `$1${RELEASE_CONFIG}`);
  // в buildTypes.release — свой ключ, если пароль есть в окружении
  const releaseUse = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseUse.test(gradle)) throw new Error('release-signing: не найден buildTypes.release в build.gradle');
  return gradle.replace(
    releaseUse,
    "$1signingConfig System.getenv('COLDARMS_UPLOAD_STORE_PASSWORD') ? signingConfigs.release : signingConfigs.debug",
  );
}

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
module.exports.applySigning = applySigning;
