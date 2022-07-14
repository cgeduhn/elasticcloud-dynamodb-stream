const jest_es = require('@shelf/jest-elasticsearch/environment');

module.exports = async function () {
  await jest_es();
};
