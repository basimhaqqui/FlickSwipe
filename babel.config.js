module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@hooks': './src/hooks',
            '@types': './src/types',
            '@utils': './src/utils',
            '@context': './src/context',
            '@constants': './src/constants',
          },
        },
      ],
      'react-native-reanimated/plugin', // MUST be last
    ],
  };
};
