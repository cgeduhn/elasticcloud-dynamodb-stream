import { ClientOptions } from '@elastic/elasticsearch';
import { DynamoDBStreamEvent } from 'aws-lambda';
export interface PushStreamArgs {
    event: DynamoDBStreamEvent;
    host: string;
    index: string;
    refresh?: boolean;
    useBulk?: boolean;
    transformFunction?: (body: {
        [key: string]: any;
    }, old_body?: {
        [key: string]: any;
    }, record?: any) => {
        [key: string]: any;
    };
    options?: ClientOptions;
}
export declare const pushStream: ({ event, host, index, refresh, transformFunction, useBulk, options, }: PushStreamArgs) => Promise<void>;
