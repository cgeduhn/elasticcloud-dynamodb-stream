process.env.INDEX = 'jest-test-index';
const mapping = require('./es-mappings/mapping.json');
module.exports = () => {
    console.log('ES will be called', { mapping });
    return {
        esVersion: '7.6.0',
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
                    mappings: Object.assign({}, mapping),
                },
            },
        ],
    };
};
//# sourceMappingURL=jest-es-config.js.map