import { marshall } from '@aws-sdk/util-dynamodb';
import { Client } from '@elastic/elasticsearch';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { PushStreamArgs, pushStream } from '.';

const buildStreamRecord = (
  obj,
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE' = 'INSERT',
  reverse_key_order = false,
) => {
  let Keys = { id: { S: obj.id }, type: { S: obj.type } };
  if (reverse_key_order) {
    Keys = { type: { S: obj.type }, id: { S: obj.id } };
  }

  return {
    eventName,
    dynamodb: {
      NewImage: marshall(obj) as any,
      Keys,
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

  it('should Insert and Remove', async () => {
    let obj = { id: '1', type: 'test-Object', anything: 'hello world' };
    const ev1: DynamoDBStreamEvent = {
      Records: [buildStreamRecord(obj)],
    };

    await pushStream({ ...partialArgs, event: ev1, refresh: true, useBulk: true });

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

    const ev2: DynamoDBStreamEvent = {
      Records: [buildStreamRecord(obj, 'REMOVE')],
    };
    await pushStream({ ...partialArgs, event: ev2, refresh: true, useBulk: true });

    result = await es.search({
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

    expect(result.body.hits.total.value).toEqual(0);
  });

  it('should index Modify and transform', async () => {
    let obj = { id: '2', type: 'transformed-Object', anything: 'hello world too' };
    const ev1: DynamoDBStreamEvent = {
      Records: [buildStreamRecord(obj, 'MODIFY')],
    };

    await pushStream({
      ...partialArgs,
      event: ev1,
      refresh: true,
      useBulk: true,
      transformFunction: (body) => {
        body.transformed = true;
        return body;
      },
    });

    let result = await es.search({
      track_total_hits: true,
      body: {
        query: {
          bool: {
            filter: [{ term: { type: 'transformed-Object' } }, { term: { id: '2' } }],
          },
        },
      },
      index: partialArgs.index,
    });

    expect(result.body.hits.total.value).toEqual(1);
    expect(result.body.hits.hits).toBeDefined();
    expect(result.body.hits.hits.length).toEqual(1);
    expect(result.body.hits.hits[0]._source.transformed).toEqual(true);
    expect(result.body.hits.hits[0]._source).toMatchObject(obj);
  });

  it('should handle multiple Records', async () => {
    const ev1: DynamoDBStreamEvent = {
      Records: [
        buildStreamRecord({ type: 'multiple', id: '1', random_val: `${Math.random()}` }, 'MODIFY'),
        buildStreamRecord({ type: 'multiple', id: '2', random_val: `${Math.random()}` }, 'INSERT'),
        buildStreamRecord({ type: 'multiple', id: '3', random_val: `${Math.random()}` }, 'INSERT'),
      ],
    };

    await pushStream({
      ...partialArgs,
      event: ev1,
      refresh: true,
      useBulk: true,
    });

    let result = await es.search({
      track_total_hits: true,
      body: {
        query: {
          bool: {
            filter: [{ term: { type: 'multiple' } }],
          },
        },
      },
      index: partialArgs.index,
    });

    expect(result.body.hits.total.value).toEqual(3);

    for (const hit of result.body.hits.hits) {
      expect(hit._source.type).toEqual('multiple');
      expect(hit._source.id).toBeDefined();
      expect(hit._source.random_val).toBeDefined();
    }

    // delete again
    const ev2: DynamoDBStreamEvent = {
      Records: [
        buildStreamRecord({ type: 'multiple', id: '1', random_val: `${Math.random()}` }, 'REMOVE'),
        buildStreamRecord(
          { type: 'multiple', id: '2', random_val: `${Math.random()}` },
          'REMOVE',
          true,
        ),
      ],
    };
    await pushStream({
      ...partialArgs,
      event: ev2,
      refresh: true,
      useBulk: true,
    });

    result = await es.search({
      track_total_hits: true,
      body: {
        query: {
          bool: {
            filter: [{ term: { type: 'multiple' } }],
          },
        },
      },
      index: partialArgs.index,
    });

    expect(result.body.hits.total.value).toEqual(1);
  });

  it('can upload same object twice takes last value', async () => {
    let first_value = `${Math.random()}`;
    let second_value = `0.0`;
    // delete again
    const ev2: DynamoDBStreamEvent = {
      Records: [
        buildStreamRecord({ type: 'duplicated', id: '1', random_val: first_value }, 'INSERT'),
        buildStreamRecord({ type: 'duplicated', id: '1', random_val: second_value }, 'INSERT'),
      ],
    };

    await pushStream({
      ...partialArgs,
      event: ev2,
      refresh: true,
      useBulk: true,
    });

    let result = await es.search({
      track_total_hits: true,
      body: {
        query: {
          bool: {
            filter: [{ term: { type: 'duplicated' } }],
          },
        },
      },
      index: partialArgs.index,
    });
    expect(result.body.hits.total.value).toEqual(1);

    expect(result.body.hits.hits[0]._source.type).toEqual('duplicated');
    expect(result.body.hits.hits[0]._source.id).toEqual('1');
    expect(result.body.hits.hits[0]._source.random_val).toEqual(second_value);
  });
});
