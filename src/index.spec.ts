import { Client } from '@elastic/elasticsearch';
import { DynamoDBStreamEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { pushStream, PushStreamArgs } from '.';

const buildStreamRecord = (obj, eventName = 'INSERT') => {
  return {
    eventName,
    dynamodb: {
      NewImage: AWS.DynamoDB.Converter.marshall(obj) as any,
      Keys: ['id', 'type'],
    },
  };
};

let partialArgs: PushStreamArgs = {
  event: { Records: [] },
  host: 'http://localhost:9200',
  index: process.env.INDEX,
};

describe('Testing Stream Events', () => {
  let es: Client;
  beforeAll(() => {
    es = new Client({ node: partialArgs.host });
  });

  it('should index Insert', async () => {
    let obj = { id: '1', type: 'test-Object', anything: 'hello world' };
    const ev1: DynamoDBStreamEvent = {
      Records: [buildStreamRecord(obj)],
    };

    await pushStream({ ...partialArgs, event: ev1, refresh: true });

    let result = await es.search({
      track_total_hits: true,
      body: {
        query: {
          bool: {
            filter: [{ term: { type: 'test-Object' } }, { term: { id: '1' } }],
          },
        },
      },
      index: partialArgs.index,
    });

    expect(result.body.hits.total.value).toEqual(1);
    expect(result.body.hits.hits).toBeDefined();
    expect(result.body.hits.hits.length).toEqual(1);
    expect(result.body.hits.hits[0]._source).toMatchObject(obj);
  });
});
