const NAME = "website";

export enum STORE_KEY {
    USERTOKEN = "store.user.token",
}

interface StoredData {
    [STORE_KEY.USERTOKEN]: string;
}

const defaultValues = {
    [STORE_KEY.USERTOKEN]: "defaultToken",
};

let storedData: StoredData = {...defaultValues};
const storedStringData = localStorage.getItem(NAME);
if (storedStringData) {
    try {
        storedData = {...defaultValues, ...JSON.parse(storedStringData)};
    } catch (err) {
    }
}

export const Store = {
    getValue<T>(key: keyof StoredData) {
        return storedData[key] as unknown as T;
    },

    setValue<Key extends keyof StoredData>(key: Key, value: StoredData[Key]) {
        storedData[key] = value;

        try {
            localStorage.setItem(NAME, JSON.stringify(storedData));
        } catch (err) {
        }
    },

    getStorage() {
        return storedData;
    },
};
