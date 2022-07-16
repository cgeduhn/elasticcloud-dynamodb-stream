"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushStream = void 0;
const elasticsearch_1 = require("@elastic/elasticsearch");
const AWS = require("aws-sdk");
const flatMap = require("lodash.flatmap");
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
const handleBulkResponseErrors = (bulkResponse, body) => {
    if (bulkResponse.errors) {
        const erroredDocuments = [];
        bulkResponse.items.forEach((action, i) => {
            const operation = Object.keys(action)[0];
            if (action[operation].error) {
                erroredDocuments.push({
                    status: action[operation].status,
                    error: action[operation].error,
                    operation: body[i * 2],
                    document: body[i * 2 + 1],
                });
            }
        });
        console.error(erroredDocuments);
        throw new Error(erroredDocuments.map((obj) => obj.error.reason).join(','));
    }
};
const pushStream = async ({ event, host, index, refresh = false, transformFunction = undefined, useBulk = true, options = {}, }) => {
    validateString(index, 'index');
    validateString(index, 'host');
    validateBoolean(refresh, 'refresh');
    validateFunctionOrUndefined(transformFunction, 'transformFunction');
    const es = new elasticsearch_1.Client(Object.assign({ node: host }, options));
    const toRemove = [];
    const toUpsert = [];
    for (const record of event.Records) {
        const keys = converter(record.dynamodb.Keys);
        let vals = Object.values(keys);
        const id = vals.reduce((acc, curr) => acc.concat(curr), '');
        const reversed_id = vals.reverse().reduce((acc, curr) => acc.concat(curr), '');
        switch (record.eventName) {
            case 'REMOVE': {
                toRemove.push({ index, id, refresh });
                toRemove.push({ index, id: reversed_id, refresh });
                break;
            }
            case 'MODIFY':
            case 'INSERT': {
                let body = converter(record.dynamodb.NewImage);
                const oldBody = record.dynamodb.OldImage ? converter(record.dynamodb.OldImage) : undefined;
                body = removeEventData(body);
                if (transformFunction) {
                    body = await Promise.resolve(transformFunction(body, oldBody, record));
                }
                try {
                    if (body && Object.keys(body).length !== 0 && body.constructor === Object) {
                        toUpsert.push({ index, id, body, refresh });
                    }
                }
                catch (e) {
                    throw new Error(e);
                }
                break;
            }
            default:
                throw new Error(record.eventName + " wasn't recognized");
        }
    }
    if (toUpsert.length > 0) {
        if (useBulk === true) {
            const updateBody = flatMap(toUpsert, (doc) => [
                { index: { _index: doc.index, _id: doc.id } },
                doc.body,
            ]);
            const { body: bulkResponse } = await es.bulk({
                refresh: toUpsert[0].refresh,
                body: updateBody,
            });
            if (bulkResponse.errors) {
                handleBulkResponseErrors(bulkResponse, updateBody);
            }
        }
        else {
            for (const doc of toUpsert) {
                const { index, id, body, refresh } = doc;
                await es.index({ index, id, body, refresh });
            }
        }
    }
    if (toRemove.length > 0) {
        if (useBulk === true) {
            const bodyDelete = flatMap(toRemove, (doc) => [
                { delete: { _index: doc.index, _id: doc.id } },
            ]);
            const { body: bulkResponse } = await es.bulk({
                refresh: toRemove[0].refresh,
                body: bodyDelete,
            });
            if (bulkResponse.errors) {
                handleBulkResponseErrors(bulkResponse, bodyDelete);
            }
        }
        else {
            for (const doc of toRemove) {
                const { index, id, refresh } = doc;
                const { body: exists } = await es.exists({ index, id, refresh });
                if (exists) {
                    await es.delete({ index, id, refresh });
                }
            }
        }
    }
};
exports.pushStream = pushStream;
//# sourceMappingURL=index.js.map