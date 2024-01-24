import styled from "styled-components";
import {NavLink} from "react-router-dom";

type TabListContainerProps = {
    height?: string;
};

export const TabListContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow-y: scroll;
  height: 100vh;
`;

export const StyledNavLink = styled(NavLink)`
  display: block;
  color: black;
  text-transform: capitalize;
  text-align: center;
  text-decoration: none;
  padding: 20px;
  height: 50px;
  border-top-right-radius: 40px;
  border-bottom-right-radius: 100px;
  transition: background-color 300ms ease;
  background-color: #efefef;
  &.active {
    border-left: 3px solid black;
    background-color: lightblue;
  }
  &.not {
    border-left: 3px solid black;
    background-color: lightblue;
  }
`;