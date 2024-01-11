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
    {tabKey: "usmap", title: "USMap", route: "USMap"},
    {tabKey: "koreamap", title: "KoreaMap", route: "KoreaMap"},
    {tabKey: "openai", title: "openai", route: "Openai"},
    {tabKey: "jira", title: "jira", route: "Jira"},
    {tabKey: "mlops", title: "mlops", route: "Mlops"},
    {tabKey: "logout", title: "Logout", route: "Logout"}
];
