process.env.INDEX = 'jest-test-index';
const mapping = require('./es-mappings/mapping.json');
module.exports = () => {
  console.log('ES will be called', { mapping });
  return {
    esVersion: '7.6.0', // ! must be exact version. Ref: https://github.com/elastic/elasticsearch-js .
    // don't be shy to fork our code and update deps to correct.
    clusterName: 'your-cluster-name',
    nodeName: 'your-node-name',
    port: 9200,
    indexes: [
      {
        name: process.env.INDEX,
        body: {
          settings: {
            number_of_shards: '1',
            number_of_replicas: '1',
          },
          mappings: {
            ...mapping,
          },
        },
      },
    ],
  };
};
