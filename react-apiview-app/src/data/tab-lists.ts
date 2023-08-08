export type TabListType = {
    tabKey: string;
    title: string;
    route: string;
};
export const tabLists = [
    { tabKey: "home", title: "Home", route: "Hello"},
    { tabKey: "item", title: "Shop", route: "Shop"},
    { tabKey: "map", title: "Map", route: "Map"},
    { tabKey: "logout", title: "Logout", route: "Logout"}
];
