import React, {useState} from "react";
import {JiraTicket} from "../../data/dataJira";

const initialTicketValues = {
    summary: "",
    description: "",
};

interface Props {
    jiraTicket: JiraTicket
    closePopup: () => void
    submit: any
}

export const PopUp: React.FunctionComponent<Props> = ({
                                                          jiraTicket,
                                                          closePopup,
                                                          submit
                                                      }) => {

    const [updates, setUpdates] = useState(initialTicketValues);

    const change = (event: { target: { name: any; value: any; }; }) => {
        console.log(updates);
        const {name, value} = event.target;
        setUpdates({
            ...updates,
            [name]: value,
        });
    };


    console.log("jira ticket" + jiraTicket.fields.summary);
    return (
        <>
            <dialog className="popup-box" open>
                <div className="box">
                    <form onSubmit={() => submit(updates, jiraTicket)}>
                        <label>
                            Ticket info:
                            <p/>
                            <input
                                type="text"
                                name="summary"
                                defaultValue={jiraTicket.fields.summary}
                                //value={updates.summary}
                                onChange={change}
                                maxLength={50}
                                required
                                size={50}
                            />
                            <input
                                type="text"
                                name="description"
                                defaultValue={jiraTicket.fields.description}
                                //value={updates.description}
                                onChange={change}
                                maxLength={50}
                                required
                                size={50}
                            />
                        </label>
                        <br/>
                        <input className="popup-submit" id="submitButton" type="submit" value="Submit"/>
                    </form>

                    <form onSubmit={closePopup}>
                        <input className="popup-close" id="closeButton" type="submit" value="CLOSE"/>
                    </form>
                </div>
            </dialog>
        </>
    );
};