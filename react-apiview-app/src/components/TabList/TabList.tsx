import {TabListType} from "../../data/tab-lists";
import {TabListContainer, StyledNavLink} from "./TabList.styles";

type TabListProps = {
    tabLists: TabListType[];
};

const TabList = ({tabLists}: TabListProps) => {
    return (
        <TabListContainer>
            {tabLists.map((TabList) => (
                <StyledNavLink key={TabList.tabKey} to={TabList.tabKey} style={{background: TabList.color}}>
                    {TabList.title}
                </StyledNavLink>
            ))}
        </TabListContainer>
    );
};

export default TabList;