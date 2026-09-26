import {mergeExtensionTags, dedupeFetchedExtensions} from '../../../src/containers/extension-library.jsx';

describe('extension library de-duplication', () => {
    test('mergeExtensionTags preserves unique lowercase tags', () => {
        expect(mergeExtensionTags(['RemixWarp', 'tw'], ['astra', 'TW'])).toEqual(['remixwarp', 'tw', 'astra']);
    });

    test('dedupeFetchedExtensions removes duplicates by extensionId and merges tags', () => {
        const extensions = [
            {
                extensionId: 'foo',
                name: 'Foo',
                tags: ['remixwarp']
            },
            {
                id: 'foo',
                name: 'Foo Duplicate',
                tags: ['astra', 'remixwarp']
            },
            {
                extensionId: 'bar',
                name: 'Bar',
                tags: ['pinewarp']
            }
        ];
        const deduped = dedupeFetchedExtensions(extensions);
        expect(deduped).toHaveLength(2);
        expect(deduped.find(ext => ext.extensionId === 'foo')).toMatchObject({
            extensionId: 'foo',
            name: 'Foo Duplicate',
            tags: ['remixwarp', 'astra']
        });
        expect(deduped.find(ext => ext.extensionId === 'bar')).toMatchObject({
            extensionId: 'bar',
            name: 'Bar',
            tags: ['pinewarp']
        });
    });
});
