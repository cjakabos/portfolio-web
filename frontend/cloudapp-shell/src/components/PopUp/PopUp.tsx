import React, {useState} from "react";

const initialTicketValues = {
    summary: "",
    description: "",
};

interface Props {
    children: React.ReactNode;
}

export const PopUp: React.FunctionComponent<Props> = ({
                                                          children,
                                                      }) => {

    return (
        <>
            <dialog className="popup-box" open>
                <div className="box">
                    {children}
                </div>
            </dialog>
        </>
    );
};