export type TabListType = {
    tabKey: string;
    title: string;
    route: string;
};
export const tabLists = [
    {tabKey: "home", title: "Home", route: "Hello"},
    {tabKey: "shop", title: "Shop", route: "Shop"},
    {tabKey: "pet", title: "Pet Store", route: "Pet Store"},
    {tabKey: "map", title: "Map", route: "Map"},
    {tabKey: "openai", title: "openai", route: "OpenAI"},
    {tabKey: "logout", title: "Logout", route: "Logout"}
];
