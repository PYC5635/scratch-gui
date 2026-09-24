import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({adapter: new Adapter()});

// jest 21's bundled jsdom does not expose localStorage. Many modules read it
// directly (addon settings, GUI prefs, ...), so provide an in-memory shim
// before any test module loads.
const createStorageShim = () => {
    let data = {};
    return {
        get length () {
            return Object.keys(data).length;
        },
        clear () {
            data = {};
        },
        getItem (key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        key (index) {
            return Object.keys(data)[index] || null;
        },
        removeItem (key) {
            delete data[key];
        },
        setItem (key, value) {
            data[key] = String(value);
        }
    };
};

if (typeof global.localStorage === 'undefined') {
    global.localStorage = createStorageShim();
}
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
    window.localStorage = global.localStorage;
}
