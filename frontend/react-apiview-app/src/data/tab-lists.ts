export type TabListType = {
    tabKey: string;
    title: string;
    route: string;
    color: string;
};
export const tabLists = [
    {tabKey: "home", title: "Home", route: "Hello", color: "#efefef"},
    {tabKey: "shop", title: "Shop", route: "Shop", color: "#efefef"},
    {tabKey: "pet", title: "Pet Store", route: "Pet Store", color: "#efefef"},
    {tabKey: "map", title: "Map", route: "Map", color: "#efefef"},
    {tabKey: "usmap", title: "USMap", route: "USMap", color: "#efefef"},
    {tabKey: "koreamap", title: "KoreaMap", route: "KoreaMap", color: "#efefef"},
    {tabKey: "openmaps", title: "OpenMaps", route: "OpenMaps", color: "#efefef"},
    {tabKey: "openai", title: "openai", route: "Openai", color: "#efefef"},
    {tabKey: "jira", title: "jira", route: "Jira", color: "#efefef"},
    {tabKey: "mlops", title: "ML Segmentation", route: "Mlops", color: "#efefef"},
    {tabKey: "logout", title: "Logout", route: "Logout", color: "#ff9e9e"}
];
