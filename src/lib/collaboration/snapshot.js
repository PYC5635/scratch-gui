import Emitter from './emitter.js';
import {SNAPSHOT, makeSnapshot} from './protocol.js';

const CHUNK_SIZE = 64 * 1024;
const SEND_WINDOW = 4;
const RECEIVE_TIMEOUT_MS = 60 * 1000;
// Cap resync/restream attempts so a project that can never be applied
// stops re-downloading in a loop and surfaces a real error instead.
const MAX_RESYNC_ATTEMPTS = 5;

/**
 * Convert an ArrayBuffer to a base64 string. PeerJS serializes objects as
 * JSON, which loses embedded ArrayBuffer fields — base64 encoding keeps
 * binary data intact through the JSON transport.
 * @param {ArrayBuffer} buffer Binary data.
 * @returns {string} Base64-encoded string.
 */
const arrayBufferToBase64 = buffer => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

/**
 * Convert a base64 string back to an ArrayBuffer.
 * @param {string} base64 Base64-encoded string.
 * @returns {ArrayBuffer} Decoded binary data.
 */
const base64ToArrayBuffer = base64 => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

const toArrayBuffer = data => {
    if (data instanceof ArrayBuffer) return data;
    if (ArrayBuffer.isView(data)) {
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    // Support base64-encoded strings (PeerJS JSON serialization safe).
    if (typeof data === 'string') {
        return base64ToArrayBuffer(data);
    }
    throw new Error('snapshot data must be binary');
};

/**
 * Host side of project onboarding: streams the serialized project (.sb3
 * bytes) to a newly approved client in acked 64KB chunks with a small
 * sliding window for backpressure. Transfers are fully independent per
 * client — any number of joiners can onboard concurrently.
 *
 * Events:
 *  - 'upload-start' ({peerId})
 *  - 'upload-progress' ({peerId, sent, total})
 *  - 'upload-complete' ({peerId})
 *  - 'upload-error' ({peerId, error})
 *  - 'project-pushed' ({peerId, buffer}) — a client pushed a whole-project
 *    replacement (it loaded a project locally). The host should adopt it
 *    and re-snapshot the room.
 */
class HostSnapshotService extends Emitter {
    /**
     * @param {object} options Options.
     * @param {HostSession} options.session The host session.
     * @param {Transport} options.transport The transport.
     * @param {Function} options.getProjectData Async () => ArrayBuffer of
     * the serialized project. Called once per transfer.
     */
    constructor ({session, transport, getProjectData, getTargetIds, getExtensions}) {
        super();
        this.session = session;
        this.transport = transport;
        this.getProjectData = getProjectData;
        // Optional () => [{id, name, isStage}] captured with the snapshot
        // so receivers can adopt our target ids (sb3 does not keep them).
        this.getTargetIds = getTargetIds || null;
        // Optional () => [{id, url?}]: every loaded extension, including
        // ones with no blocks in the project (sb3 drops those).
        this.getExtensions = getExtensions || null;
        this._transfers = new Map(); // peerId -> transfer state
        this._pushes = new Map(); // peerId -> client->host push state
        this._transferCounter = 0;

        this._onSnapshotNeeded = ({peerId}) => {
            this.startTransfer(peerId);
        };
        this._onSnapshotMessage = (peerId, envelope) => {
            if (envelope.type === SNAPSHOT.ACK) {
                this._onAck(peerId, envelope.payload);
            } else if (envelope.type === SNAPSHOT.REQUEST) {
                this.startTransfer(peerId);
            } else if (envelope.type === SNAPSHOT.PUSH) {
                this._onPushBegin(peerId, envelope.payload);
            } else if (envelope.type === SNAPSHOT.CHUNK) {
                this._onPushChunk(peerId, envelope.payload);
            } else if (envelope.type === SNAPSHOT.PUSH_COMPLETE) {
                this._onPushComplete(peerId, envelope.payload);
            }
        };
        this._onUserLeft = user => {
            this._transfers.delete(user.id);
            this._pushes.delete(user.id);
        };
        session.on('snapshot-needed', this._onSnapshotNeeded);
        session.on('snapshot-message', this._onSnapshotMessage);
        session.on('user-left', this._onUserLeft);
    }

    destroy () {
        this.session.off('snapshot-needed', this._onSnapshotNeeded);
        this.session.off('snapshot-message', this._onSnapshotMessage);
        this.session.off('user-left', this._onUserLeft);
        this._transfers.clear();
        this._pushes.clear();
        this.removeAllListeners();
    }

    /**
     * Begin (or restart) streaming the project to one client.
     * @param {string} peerId Destination client.
     * @returns {Promise<void>} Resolves once the transfer has started.
     */
    async startTransfer (peerId) {
        this._transferCounter++;
        const transferId = `snapshot-${this._transferCounter}`;
        // Claim the slot first so a re-request supersedes an older transfer.
        this._transfers.set(peerId, {transferId, starting: true});
        this.emit('upload-start', {peerId});

        let buffer;
        let atSeq;
        let targetIds;
        let extensions;
        try {
            // Capture the sequence number BEFORE serializing: ops that land
            // during serialization are not in the snapshot, and the client
            // replays everything after atSeq, so it must not skip them.
            atSeq = this.session.seq;
            buffer = toArrayBuffer(await this.getProjectData());
            // Capture the target id map and extension list AFTER serializing
            // so they describe exactly what the snapshot contains. Capturing
            // them before would leave peers with stale target ids for sprites
            // added while serializing, so later id-keyed ops would miss and
            // the peers' projects would drift apart.
            targetIds = this.getTargetIds ? this.getTargetIds() : null;
            extensions = this.getExtensions ? this.getExtensions() : null;
        } catch (error) {
            this._transfers.delete(peerId);
            this.emit('upload-error', {peerId, error});
            return;
        }

        const current = this._transfers.get(peerId);
        if (!current || current.transferId !== transferId) return; // superseded

        const chunkCount = Math.max(1, Math.ceil(buffer.byteLength / CHUNK_SIZE));
        const transfer = {
            transferId,
            buffer,
            chunkCount,
            nextIndex: 0,
            ackedCount: 0
        };
        this._transfers.set(peerId, transfer);

        const beginPayload = {
            transferId,
            totalBytes: buffer.byteLength,
            chunkCount,
            atSeq
        };
        if (targetIds) beginPayload.targetIds = targetIds;
        if (extensions) beginPayload.extensions = extensions;
        this.transport.send(peerId, makeSnapshot(SNAPSHOT.BEGIN, beginPayload));
        for (let i = 0; i < SEND_WINDOW; i++) {
            this._sendNextChunk(peerId, transfer);
        }
    }

    _sendNextChunk (peerId, transfer) {
        if (transfer.nextIndex >= transfer.chunkCount) return;
        const index = transfer.nextIndex++;
        const start = index * CHUNK_SIZE;
        const raw = transfer.buffer.slice(start, Math.min(start + CHUNK_SIZE, transfer.buffer.byteLength));
        // Encode as base64: PeerJS serializes objects as JSON, which would
        // lose the embedded ArrayBuffer. The protocol allows string data.
        const data = arrayBufferToBase64(raw);
        this.transport.send(peerId, makeSnapshot(SNAPSHOT.CHUNK, {
            transferId: transfer.transferId,
            index,
            data
        }));
    }

    _onAck (peerId, {transferId}) {
        const transfer = this._transfers.get(peerId);
        if (!transfer || transfer.transferId !== transferId || transfer.starting) return;
        transfer.ackedCount++;
        this.emit('upload-progress', {
            peerId,
            sent: Math.min(transfer.ackedCount * CHUNK_SIZE, transfer.buffer.byteLength),
            total: transfer.buffer.byteLength
        });
        if (transfer.ackedCount >= transfer.chunkCount) {
            this._transfers.delete(peerId);
            this.emit('upload-complete', {peerId});
            return;
        }
        this._sendNextChunk(peerId, transfer);
    }

    // ----- Client -> host project push (a peer loaded a local project) -----

    _onPushBegin (peerId, {transferId, totalBytes, chunkCount}) {
        this._pushes.set(peerId, {
            transferId,
            totalBytes,
            chunkCount,
            chunks: new Array(chunkCount),
            receivedCount: 0,
            receivedBytes: 0
        });
    }

    _onPushChunk (peerId, {transferId, index, data}) {
        const push = this._pushes.get(peerId);
        if (!push || push.transferId !== transferId) return;
        if (index >= push.chunkCount || push.chunks[index]) return;
        push.chunks[index] = toArrayBuffer(data);
        push.receivedCount++;
        push.receivedBytes += push.chunks[index].byteLength;
    }

    _onPushComplete (peerId, {transferId}) {
        const push = this._pushes.get(peerId);
        if (!push || push.transferId !== transferId) return;
        this._pushes.delete(peerId);
        if (push.receivedCount !== push.chunkCount || push.receivedBytes !== push.totalBytes) {
            return; // corrupt transfer; drop silently
        }
        const combined = new Uint8Array(push.receivedBytes);
        let offset = 0;
        push.chunks.forEach(chunk => {
            combined.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        });
        this.emit('project-pushed', {peerId, buffer: combined.buffer});
    }
}

/**
 * Client side of project onboarding: reassembles the streamed snapshot,
 * loads it into the local document, then unblocks the session's ordered
 * op stream at the snapshot's sequence number.
 *
 * Events:
 *  - 'download-start' ({totalBytes})
 *  - 'download-progress' ({loaded, total})
 *  - 'download-complete' ()
 *  - 'download-error' ({error})
 */
class ClientSnapshotService extends Emitter {
    /**
     * @param {object} options Options.
     * @param {ClientSession} options.session The client session.
     * @param {Transport} options.transport The transport.
     * @param {Function} options.applyProjectData Async (ArrayBuffer) =>
     * loads the project into the local document.
     */
    constructor ({session, transport, applyProjectData, remapTargetIds, loadExtensions}) {
        super();
        this.session = session;
        this.transport = transport;
        this.applyProjectData = applyProjectData;
        // Optional (targetIds) => void, adopts the host's target ids after
        // the loaded sb3 regenerated them.
        this.remapTargetIds = remapTargetIds || null;
        // Optional async ([{id, url?}]) => void, matches our loaded
        // extensions to the host's.
        this.loadExtensions = loadExtensions || null;
        this._incoming = null;
        this._timeout = null;
        this._resyncAttempts = 0;

        this._onSnapshotMessage = envelope => {
            if (envelope.type === SNAPSHOT.BEGIN) {
                this._onBegin(envelope.payload);
            } else if (envelope.type === SNAPSHOT.CHUNK) {
                this._onChunk(envelope.payload);
            }
        };
        this._onResyncNeeded = () => {
            this.requestResync();
        };
        session.on('snapshot-message', this._onSnapshotMessage);
        session.on('resync-needed', this._onResyncNeeded);
    }

    destroy () {
        this.session.off('snapshot-message', this._onSnapshotMessage);
        this.session.off('resync-needed', this._onResyncNeeded);
        this._clearTimeout();
        this._incoming = null;
        this.removeAllListeners();
    }

    /**
     * Ask the host for a fresh snapshot and drop local ordering state.
     * Used both when the session detects it cannot catch up and when the
     * host explicitly demands a resync. Bounded so a project that can
     * never be applied stops looping and surfaces a real error.
     */
    requestResync () {
        this._resyncAttempts++;
        if (this._resyncAttempts > MAX_RESYNC_ATTEMPTS) {
            const error = new Error(
                'Failed to synchronize with the host after multiple attempts');
            this._resyncAttempts = 0;
            this.emit('download-error', {error});
            return;
        }
        this.session.beginResync();
        this.transport.sendToHost(makeSnapshot(SNAPSHOT.REQUEST, {}));
    }

    /**
     * Push our locally loaded project to the host (member -> host whole-
     * project replacement). The host adopts it and re-snapshots the room,
     * so every peer — including us — converges on the pushed project.
     * Chunks are base64-encoded for the JSON transport, like snapshots.
     * @param {ArrayBuffer} buffer The serialized project bytes.
     */
    pushProject (buffer) {
        if (!buffer || buffer.byteLength === 0) return;
        const transferId = `push-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}`;
        const chunkCount = Math.max(1, Math.ceil(buffer.byteLength / CHUNK_SIZE));
        this.transport.sendToHost(makeSnapshot(SNAPSHOT.PUSH, {
            transferId,
            totalBytes: buffer.byteLength,
            chunkCount
        }));
        for (let index = 0; index < chunkCount; index++) {
            const start = index * CHUNK_SIZE;
            const raw = buffer.slice(start, Math.min(start + CHUNK_SIZE, buffer.byteLength));
            this.transport.sendToHost(makeSnapshot(SNAPSHOT.CHUNK, {
                transferId,
                index,
                data: arrayBufferToBase64(raw)
            }));
        }
        this.transport.sendToHost(makeSnapshot(SNAPSHOT.PUSH_COMPLETE, {transferId}));
    }

    _onBegin ({transferId, totalBytes, chunkCount, atSeq, targetIds, extensions}) {
        this._incoming = {
            transferId,
            totalBytes,
            chunkCount,
            atSeq,
            targetIds: targetIds || null,
            extensions: extensions || null,
            chunks: new Array(chunkCount),
            receivedCount: 0,
            receivedBytes: 0
        };
        this._armTimeout();
        this.emit('download-start', {totalBytes});
    }

    _onChunk ({transferId, index, data}) {
        const incoming = this._incoming;
        if (!incoming || incoming.transferId !== transferId) return;
        if (index >= incoming.chunkCount || incoming.chunks[index]) return;

        incoming.chunks[index] = toArrayBuffer(data);
        incoming.receivedCount++;
        incoming.receivedBytes += incoming.chunks[index].byteLength;
        this._armTimeout();

        this.transport.sendToHost(makeSnapshot(SNAPSHOT.ACK, {transferId, index}));
        this.emit('download-progress', {
            loaded: incoming.receivedBytes,
            total: incoming.totalBytes
        });

        if (incoming.receivedCount === incoming.chunkCount) {
            this._finish(incoming);
        }
    }

    async _finish (incoming) {
        this._incoming = null;
        this._clearTimeout();

        const combined = new Uint8Array(incoming.receivedBytes);
        let offset = 0;
        incoming.chunks.forEach(chunk => {
            combined.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        });
        if (combined.byteLength !== incoming.totalBytes) {
            const error = new Error(
                `snapshot size mismatch: expected ${incoming.totalBytes}, got ${combined.byteLength}`);
            this.emit('download-error', {error});
            this.requestResync();
            return;
        }

        // All bytes are in. Signal "download complete" BEFORE applying the
        // project: applyProjectData emits 'project-sync-apply-complete',
        // which is what clears the loading overlay. Emitting
        // 'download-complete' afterwards would re-arm the overlay with no
        // further event to clear it, leaving the editor stuck on "Loading…".
        this.emit('download-complete');

        try {
            await this.applyProjectData(combined.buffer);
        } catch (error) {
            this.emit('download-error', {error});
            this.requestResync();
            return;
        }

        // A full onboarding succeeded; earlier resyncs no longer count.
        this._resyncAttempts = 0;

        // Adopt the host's target ids BEFORE any queued ops replay, so op
        // targetIds resolve identically on every peer.
        if (incoming.targetIds && this.remapTargetIds) {
            try {
                this.remapTargetIds(incoming.targetIds);
            } catch (error) {
                // Ids stay divergent; name-based fallbacks still work.
            }
        }

        // Match the host's loaded extensions (the sb3 only carries the
        // ones with blocks in use) before ops that may need them replay.
        if (incoming.extensions && this.loadExtensions) {
            try {
                await this.loadExtensions(incoming.extensions);
            } catch (error) {
                // A failed extension load shouldn't abort onboarding.
            }
        }

        this.session.setBaseSeq(incoming.atSeq);
        this.transport.sendToHost(makeSnapshot(SNAPSHOT.COMPLETE, {
            transferId: incoming.transferId
        }));
    }

    _armTimeout () {
        this._clearTimeout();
        this._timeout = setTimeout(() => {
            const error = new Error('snapshot transfer stalled');
            this._incoming = null;
            this.emit('download-error', {error});
        }, RECEIVE_TIMEOUT_MS);
    }

    _clearTimeout () {
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    }
}

export {
    HostSnapshotService,
    ClientSnapshotService,
    CHUNK_SIZE,
    SEND_WINDOW
};
