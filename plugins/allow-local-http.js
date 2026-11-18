// Плагин конфигурации Expo: разрешить обычный HTTP только к этому компьютеру (127.0.0.1 / localhost), всё остальное —
// только HTTPS. Нужен, пока план тренировок считает сервер прототипа (annotator/api_server.py, порт 8058, телефон
// подключён по USB с adb reverse): release-сборка Android по умолчанию запрещает HTTP целиком.
// Убрать, когда план переедет на основной бэкенд (coldarms.com, HTTPS).
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILE = 'network_security_config';
const XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`;

function withLocalHttp(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${FILE}.xml`), XML);
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:networkSecurityConfig'] = `@xml/${FILE}`;
    return cfg;
  });
}

module.exports = withLocalHttp;
