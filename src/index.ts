import { Client, ClientOptions } from '@elastic/elasticsearch';
import * as AWS from 'aws-sdk';

import { DynamoDBStreamEvent } from 'aws-lambda';

const converter = AWS.DynamoDB.Converter.unmarshall;

const removeEventData = (body) => {
  delete body.SequenceNumber;
  delete body.SizeBytes;
  delete body.StreamViewType;
  return body;
};

const validateString = (param, paramName) => {
  if (!param || !(typeof param === 'string'))
    throw new Error(`Please provide correct value for ${paramName}`);
};
const validateBoolean = (param, paramName) => {
  if (!(typeof param === 'boolean'))
    throw new Error(`Please provide correct value for ${paramName}`);
};
const validateFunctionOrUndefined = (param, paramName) => {
  if (!(typeof param === 'undefined' || typeof param === 'function'))
    throw new Error(`Please provide correct value for ${paramName}`);
};

export interface PushStreamArgs {
  event: DynamoDBStreamEvent;
  host: string;
  index: string;
  refresh?: boolean;
  transformFunction?: (body: { [key: string]: any }) => { [key: string]: any };
  options?: ClientOptions;
}

export const pushStream = async ({
  event,
  host,
  index,
  refresh = false,
  transformFunction = undefined,
  options = {},
}: PushStreamArgs) => {
  validateString(index, 'index');
  validateString(index, 'host');
  validateBoolean(refresh, 'refresh');
  validateFunctionOrUndefined(transformFunction, 'transformFunction');

  const es = new Client({ node: host, ...options });

  //   const es = elastic(endpoint, testMode, elasticSearchOptions)
  for (const record of event.Records) {
    const keys = converter(record.dynamodb.Keys);
    const id = Object.values(keys).reduce((acc, curr) => acc.concat(curr), '');

    switch (record.eventName) {
      case 'REMOVE': {
        try {
          if (await es.exists({ index, id, refresh })) {
            await es.delete({ index, id, refresh });
          }
        } catch (e) {
          if (e.meta && e.meta.statusCode == 404) {
            console.log('Error Removing Object', e);

            if (Object.values(keys).length > 1) {
              const other_id = Object.values(keys)
                .reverse()
                .reduce((acc, curr) => acc.concat(curr), '');
              console.log('TRY OTHER ID', other_id);
              try {
                if (await es.exists({ index, id: other_id, refresh })) {
                  await es.delete({ index, id: other_id, refresh });
                }
              } catch (err) {
                console.log('DID NOT FOUND OTHER ID');
              }
            }
          } else {
            console.log(e.meta);
            throw new Error(e);
          }
        }
        break;
      }
      case 'MODIFY':
      case 'INSERT': {
        let body = converter(record.dynamodb.NewImage);
        body = removeEventData(body);
        if (transformFunction) {
          body = await Promise.resolve(transformFunction(body));
        }
        try {
          await es.index({ index, id, body, refresh });
        } catch (e) {
          console.log(e);
          throw new Error(e);
        }
        break;
      }
      default:
        throw new Error(record.eventName + " wasn't recognized");
    }
  }
};
