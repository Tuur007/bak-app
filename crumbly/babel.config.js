module.exports = function (api) {
  api.cache(true);
  // zustand 5 gebruikt import.meta in zijn ESM-bouw; de webbundel is geen module.
  return { presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]] };
};
