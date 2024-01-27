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
    {tabKey: "openmaps", title: "Maps", route: "OpenMaps", color: "#efefef"},
    {tabKey: "openai", title: "openai", route: "Openai", color: "#efefef"},
    {tabKey: "jira", title: "jira", route: "Jira", color: "#efefef"},
    {tabKey: "mlops", title: "ML Segmentation", route: "Mlops", color: "#efefef"},
    {tabKey: "logout", title: "Logout", route: "Logout", color: "#ff9e9e"}
];
