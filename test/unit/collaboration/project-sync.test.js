import {createRoom} from '../../fixtures/collab-harness.js';
import {HostSnapshotService, ClientSnapshotService} from '../../../src/lib/collaboration/snapshot.js';
import {OP, CTRL, makeCtrl} from '../../../src/lib/collaboration/protocol.js';

// The fake hub is synchronous but snapshot finish paths are async;
// alternate flushing and yielding until everything settles.
const settle = async hub => {
    for (let i = 0; i < 50; i++) {
        hub.flush();
        await Promise.resolve();
        await Promise.resolve();
    }
};

const encodeDoc = doc => {
    const bytes = Buffer.from(JSON.stringify(doc));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
const decodeDoc = arrayBuffer => JSON.parse(Buffer.from(arrayBuffer).toString());

const wireSnapshots = room => {
    const hostService = new HostSnapshotService({
        session: room.host.session,
        transport: room.host.transport,
        getProjectData: () => Promise.resolve(encodeDoc(room.host.applier.doc))
    });
    const wireClient = client => new ClientSnapshotService({
        session: client.session,
        transport: client.transport,
        applyProjectData: arrayBuffer => {
            client.applier.loadSnapshot(decodeDoc(arrayBuffer));
            return Promise.resolve();
        }
    });
    return {hostService, wireClient};
};

const blockEvent = (targetId, event) => ({targetId, event});
const createBlock = (targetId, blockId) => blockEvent(targetId, {type: 'create', blockId});

describe('whole-project replacement', () => {
    test('a host-issued RESYNC_REQUIRED re-onboards every client from a fresh snapshot', async () => {
        const room = await createRoom({clientCount: 1, autoSnapshot: false});
        const {hostService, wireClient} = wireSnapshots(room);
        const client = room.clients[0];
        const service = wireClient(client);
        await settle(room.hub);

        // The host loads a new project: new doc content lands on the host,
        // then the facade broadcasts RESYNC_REQUIRED (like a host-side
        // vm.loadProject does).
        room.host.applier.doc.blocks.reloaded = {fields: {}, pos: {x: 0, y: 0}};
        room.host.transport.broadcast(makeCtrl(CTRL.RESYNC_REQUIRED, {}));
        await settle(room.hub);

        expect(client.applier.snapshot()).toEqual(room.host.applier.snapshot());
        expect(client.applier.doc.blocks.reloaded).toBeDefined();
        expect(client.session.lastAppliedSeq).toBe(room.host.session.seq);

        hostService.destroy();
        service.destroy();
        room.destroy();
    });

    test('a client push delivers the replacement project to the host intact', async () => {
        const room = await createRoom({clientCount: 1, autoSnapshot: false});
        const {hostService, wireClient} = wireSnapshots(room);
        const client = room.clients[0];
        const service = wireClient(client);
        await settle(room.hub);

        const pushed = [];
        hostService.on('project-pushed', ({peerId, buffer}) => {
            pushed.push({peerId, buffer});
        });

        const payload = 'a member loaded this project locally';
        const bytes = Buffer.from(payload);
        service.pushProject(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        await settle(room.hub);

        expect(pushed).toHaveLength(1);
        expect(pushed[0].peerId).toBe(client.id);
        expect(Buffer.from(pushed[0].buffer).toString()).toBe(payload);

        hostService.destroy();
        service.destroy();
        room.destroy();
    });

    test('a corrupt push is dropped without emitting project-pushed', async () => {
        const room = await createRoom({clientCount: 1, autoSnapshot: false});
        const {hostService, wireClient} = wireSnapshots(room);
        const client = room.clients[0];
        const service = wireClient(client);
        await settle(room.hub);

        const pushed = jest.fn();
        hostService.on('project-pushed', pushed);

        // BEGIN announces 3 chunks but only 1 chunk + COMPLETE arrive.
        service.transport.sendToHost({
            v: 1,
            kind: 'snapshot',
            type: 'snapshot-push',
            ts: Date.now(),
            payload: {transferId: 'broken', totalBytes: 300, chunkCount: 3}
        });
        service.transport.sendToHost({
            v: 1,
            kind: 'snapshot',
            type: 'snapshot-chunk',
            ts: Date.now(),
            payload: {
                transferId: 'broken',
                index: 0,
                data: Buffer.alloc(100).toString('base64')
            }
        });
        service.transport.sendToHost({
            v: 1,
            kind: 'snapshot',
            type: 'snapshot-push-complete',
            ts: Date.now(),
            payload: {transferId: 'broken'}
        });
        await settle(room.hub);

        expect(pushed).not.toHaveBeenCalled();

        hostService.destroy();
        service.destroy();
        room.destroy();
    });
});
