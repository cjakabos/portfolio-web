import {TabContainer, TabPanelContainer} from "./Tabs.styles";
import {TabListType} from "../../data/tab-lists";
import TabList from "../TabList/TabList";

type TabsProps = {
    children: JSX.Element;
    tabLists: TabListType[];
};

const Tabs = ({children, tabLists}: TabsProps) => {
    return (
        <TabContainer>
            <TabList tabLists={tabLists}/>
            <TabPanelContainer>{children}</TabPanelContainer>
        </TabContainer>
    );
};

export default Tabs;