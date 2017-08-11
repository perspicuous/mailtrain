'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const dtHelpers = require('../lib/dt-helpers');
const shortid = require('shortid');
const { enforce, filterObject } = require('../lib/helpers');
const interoperableErrors = require('../shared/interoperable-errors');
const shares = require('./shares');
const namespaceHelpers = require('../lib/namespace-helpers');

const UnsubscriptionMode = require('../shared/lists').UnsubscriptionMode;

const allowedKeys = new Set(['name', 'description', 'default_form', 'public_subscribe', 'unsubscription_mode', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}


async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'list', requiredOperations: ['view'] }],
        params,
        builder => builder
            .from('lists')
            .innerJoin('namespaces', 'namespaces.id', 'lists.namespace'),
        ['lists.id', 'lists.name', 'lists.cid', 'lists.subscribers', 'lists.description', 'namespaces.name']
    );
}

async function getById(context, id) {
    shares.enforceEntityPermission(context, 'list', id, 'view');

    const entity = await knex('lists').where('id', id).first();
    if (!entity) {
        throw new interoperableErrors.NotFoundError();
    }

    return entity;
}

async function create(context, entity) {
    let id;
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createList');

        await namespaceHelpers.validateEntity(tx, entity);
        enforce(entity.unsubscription_mode >= 0 && entity.unsubscription_mode < UnsubscriptionMode.MAX, 'Unknown unsubscription mode');

        const filteredEntity = filterObject(entity, allowedKeys);
        filteredEntity.cid = shortid.generate();

        const ids = await tx('lists').insert(filteredEntity);
        id = ids[0];

        await knex.schema.raw('CREATE TABLE `subscription__' + id + '` LIKE subscription');

        await shares.rebuildPermissions(tx, { entityTypeId: 'list', entityId: id });
    });

    return id;
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'list', entity.id, 'edit');

        const existing = await tx('lists').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (texistingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await namespaceHelpers.validateEntity(tx, entity);
        await namespaceHelpers.validateMove(context, entity, existing, 'list', 'createList', 'delete');
        enforce(entity.unsubscription_mode >= 0 && entity.unsubscription_mode < UnsubscriptionMode.MAX, 'Unknown unsubscription mode');

        await tx('lists').where('id', entity.id).update(filterObject(entity, allowedKeys));

        await shares.rebuildPermissions(tx, { entityTypeId: 'list', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'list', id, 'delete');

        await tx('lists').where('id', id).del();
        await knex.schema.dropTableIfExists('subscription__' + id);
    });
}


module.exports = {
    UnsubscriptionMode,
    hash,
    listDTAjax,
    getById,
    create,
    updateWithConsistencyCheck,
    remove
};