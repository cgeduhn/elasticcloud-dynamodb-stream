declare function _exports(): {
    esVersion: string;
    clusterName: string;
    nodeName: string;
    port: number;
    indexes: {
        name: string;
        body: {
            settings: {
                number_of_shards: string;
                number_of_replicas: string;
            };
            mappings: any;
        };
    }[];
};
export = _exports;
