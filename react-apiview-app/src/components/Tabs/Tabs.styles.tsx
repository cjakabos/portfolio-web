import styled from "styled-components";

type TabPanelProps = {
    height?: string;
};

export const TabContainer = styled.div`
  display: grid;
  grid-template-columns: 120px auto;
`;
export const TabPanelContainer = styled.div`
  overflow-y: scroll;
  height: 100vh;
`;