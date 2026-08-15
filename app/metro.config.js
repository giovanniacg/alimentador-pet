// Config do Metro: default do Expo + aliases dos modulos de node que a
// mqtt.js (e dependencias) podem pedir dentro do React Native.
//
// A mqtt 5.x declara a condicao "react-native" no package.json e o Metro do
// SDK 57 resolve package exports por padrao, entao o import cai no bundle de
// navegador (dist/mqtt.esm.js), que ja embute o essencial. Os aliases abaixo
// sao rede de seguranca para dependencias que ainda peguem os modulos crus.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer'),
  events: require.resolve('events'),
  process: require.resolve('process'),
};

module.exports = config;
