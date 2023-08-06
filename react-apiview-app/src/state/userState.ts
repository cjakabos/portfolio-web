import { atom } from "recoil";
import {Store, STORE_KEY} from "../Store";

export const userState = atom<STORE_KEY>({
    key: "token",
    default: Store.getValue<STORE_KEY>(STORE_KEY.USERTOKEN)
});